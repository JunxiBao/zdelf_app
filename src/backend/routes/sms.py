"""
SMS routes (send / verify) for CN mainland phone numbers.
- Stores OTP hashes locally (no plaintext) with TTL.
- Delegates rate limiting to Aliyun (no local cooldown or daily limit).
- Verification enforces TTL and max fail attempts locally.

短信路由（发送/校验），中国大陆手机号：
- 本地仅存验证码哈希与过期时间；
- 频控交由阿里云；
- 校验时做有效期和最大失败次数限制。
"""

import os
import re
import hmac
import uuid
import time
import hashlib
import random
from datetime import datetime, timedelta
import logging

from dotenv import load_dotenv
from flask import Blueprint, request, jsonify
import mysql.connector

# 可选：阿里云短信 SDK（需要: pip install alibabacloud_dysmsapi20170525 alibabacloud_tea_openapi alibabacloud_tea_util）
try:
    from alibabacloud_dysmsapi20170525.client import Client as DysmsapiClient
    from alibabacloud_tea_openapi import models as open_api_models
    from alibabacloud_dysmsapi20170525 import models as dysmsapi_20170525_models
    from alibabacloud_tea_util import models as util_models
    _ALIYUN_SMS_AVAILABLE = True
except Exception:
    DysmsapiClient = None
    open_api_models = None
    dysmsapi_20170525_models = None
    util_models = None
    _ALIYUN_SMS_AVAILABLE = False

load_dotenv()

logger = logging.getLogger("sms")

# Flask blueprint that mounts /sms/send and /sms/verify
sms_blueprint = Blueprint('sms', __name__)

# --- Configuration (env-driven). Do not hardcode secrets.
DB_CONFIG = {
    "host": os.getenv("DB_HOST"),
    "user": os.getenv("DB_USER"),
    "password": os.getenv("DB_PASSWORD"),
    "database": os.getenv("DB_NAME"),
}

ALIYUN_ACCESS_KEY_ID = os.getenv("ALIYUN_ACCESS_KEY_ID")
ALIYUN_ACCESS_KEY_SECRET = os.getenv("ALIYUN_ACCESS_KEY_SECRET")
ALIYUN_REGION_ID = os.getenv("ALIYUN_REGION_ID", "cn-hangzhou")
ALIYUN_SIGN_NAME = os.getenv("ALIYUN_SIGN_NAME")
ALIYUN_TEMPLATE_CODE = os.getenv("ALIYUN_TEMPLATE_CODE")  # 模板示例：您的验证码为：${code}，5分钟内有效

SERVER_SECRET = os.getenv("SERVER_SECRET", "replace-with-strong-random")

OTP_TTL_SECONDS = int(os.getenv("OTP_TTL_SECONDS", "300"))
OTP_LENGTH = int(os.getenv("OTP_LENGTH", "6"))
OTP_SEND_COOLDOWN_SECONDS = int(os.getenv("OTP_SEND_COOLDOWN_SECONDS", "60"))
OTP_DAILY_LIMIT_PER_PHONE = int(os.getenv("OTP_DAILY_LIMIT_PER_PHONE", "10"))
OTP_VERIFY_MAX_FAILS = int(os.getenv("OTP_VERIFY_MAX_FAILS", "5"))

# Generic E.164-ish quick check (loose). Real validation is in normalize_cn_phone().
PHONE_REGEX = re.compile(r"^\+?\d{6,15}$")

# 仅支持中国大陆手机号：+86***********、86***********、或 11 位以 1 开头
CN_MOBILE_RE = re.compile(r"^1[3-9]\d{9}$")

def normalize_cn_phone(raw: str) -> str:
    """Normalize CN mainland phone to E.164 (+86XXXXXXXXXXX).
    Accepts inputs like '+86...', '86...', or plain 11-digit starting with '1'.
    Returns normalized "+86" format, or empty string if invalid.
    """
    if not raw:
        return ''
    s = str(raw).strip().replace(' ', '').replace('-', '')
    # 去掉前缀，拿出纯数字
    digits = re.sub(r"[^0-9]", "", s)
    # +86 / 86 前缀
    if s.startswith('+86') or s.startswith('86'):
        digits = digits[-11:]  # 取末 11 位
    # 纯 11 位以 1 开头
    if len(digits) == 11 and CN_MOBILE_RE.match(digits):
        return '+86' + digits
    return ''

# ---------- 工具函数 ----------

def get_db():
    """Create a new MySQL connection using DB_CONFIG."""
    return mysql.connector.connect(**DB_CONFIG)


def ensure_tables():
    """Ensure the sms_codes table exists. Does not mutate users schema."""
    conn = get_db()
    cur = conn.cursor()
    # 存储验证码与频控数据
    cur.execute(
        """
        CREATE TABLE IF NOT EXISTS sms_codes (
            phone VARCHAR(20) PRIMARY KEY,
            code_hash VARCHAR(64),
            expires_at DATETIME,
            last_sent_at DATETIME,
            day_key DATE,
            daily_count INT DEFAULT 0,
            fail_count INT DEFAULT 0
        ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
        """
    )
    conn.commit()
    cur.close()
    conn.close()


# 哈希验证码（不明文入库）

def hash_code(phone: str, code: str) -> str:
    """HMAC-SHA256 of "phone:code" using SERVER_SECRET; stored in DB (no plaintext)."""
    msg = f"{phone}:{code}".encode("utf-8")
    key = SERVER_SECRET.encode("utf-8")
    return hmac.new(key, msg, hashlib.sha256).hexdigest()


def gen_code(length: int = 6) -> str:
    """Generate a zero-padded numeric OTP of given length."""
    n = random.randint(0, 10 ** length - 1)
    return str(n).zfill(length)


# ---------- 阿里云短信 ----------

def get_aliyun_client():
    """Create and return a DysmsapiClient. Raises if SDK/keys missing."""
    if not _ALIYUN_SMS_AVAILABLE:
        raise RuntimeError("阿里云短信 SDK 未安装，请先 pip install alibabacloud_dysmsapi20170525 alibabacloud_tea_openapi alibabacloud_tea_util")
    if not (ALIYUN_ACCESS_KEY_ID and ALIYUN_ACCESS_KEY_SECRET and ALIYUN_SIGN_NAME and ALIYUN_TEMPLATE_CODE):
        raise RuntimeError("缺少阿里云短信配置，请在环境变量中设置 ALIYUN_ACCESS_KEY_ID/SECRET、ALIYUN_SIGN_NAME、ALIYUN_TEMPLATE_CODE")

    config = open_api_models.Config(
        access_key_id=ALIYUN_ACCESS_KEY_ID,
        access_key_secret=ALIYUN_ACCESS_KEY_SECRET,
        region_id=ALIYUN_REGION_ID,
        endpoint='dysmsapi.aliyuncs.com',
    )
    return DysmsapiClient(config)


def send_sms_code_via_aliyun(phone: str, code: str):
    """Call Aliyun SMS to send a single OTP. Raises RuntimeError on non-OK code."""
    client = get_aliyun_client()
    send_req = dysmsapi_20170525_models.SendSmsRequest(
        sign_name=ALIYUN_SIGN_NAME,
        template_code=ALIYUN_TEMPLATE_CODE,
        phone_numbers=phone,
        template_param=f'{{"code":"{code}"}}',
    )
    runtime = util_models.RuntimeOptions()
    resp = client.send_sms_with_options(send_req, runtime)
    body = getattr(resp, 'body', None)
    if not body or getattr(body, 'code', None) != 'OK':
        raise RuntimeError(getattr(body, 'message', 'SMS send failed'))
    return True


# ---------- 路由 ----------

@sms_blueprint.route('/sms/send', methods=['POST', 'OPTIONS'])
def sms_send():
    """POST /sms/send
    Body: {"phone": "+86..." or plain 11-digit}
    Behavior: normalize phone, upsert OTP hash/expiry, then call Aliyun to send.
    No local cooldown or daily limit; Aliyun enforces provider-side throttling.
    """
    if request.method == 'OPTIONS':
        return '', 200

    try:
        ensure_tables()
        data = request.get_json(force=True)
        raw_phone = (data or {}).get('phone', '').strip()
        if not raw_phone:
            logger.warning("/sms/send invalid phone raw=%r", raw_phone)
            return jsonify({"success": False, "message": "手机号格式不正确（仅支持中国大陆 11 位或带 +86）"}), 400

        phone = normalize_cn_phone(raw_phone)
        if not phone:
            logger.warning("/sms/send invalid phone raw=%r", raw_phone)
            return jsonify({"success": False, "message": "手机号格式不正确（仅支持中国大陆 11 位或带 +86）"}), 400

        logger.info("/sms/send request phone=%s", phone)

        now = datetime.utcnow()  # store UTC timestamps in DB

        conn = get_db()
        cur = conn.cursor(dictionary=True)

        # Read existing OTP row for this phone (if any)
        cur.execute("SELECT * FROM sms_codes WHERE phone=%s", (phone,))
        row = cur.fetchone()


        # Generate a new OTP and store only its HMAC hash (+ expiry)
        code = gen_code(OTP_LENGTH)
        masked_code = code[:2] + "*"*(len(code)-2)
        expires_at = now + timedelta(seconds=OTP_TTL_SECONDS)
        logger.debug("/sms/send generated OTP(masked) for %s expires_at=%s", phone, expires_at.isoformat())

        code_hash = hash_code(phone, code)

        if row:
            cur.execute(
                """
                UPDATE sms_codes SET code_hash=%s, expires_at=%s, last_sent_at=%s
                WHERE phone=%s
                """,
                (code_hash, expires_at, now, phone)
            )
        else:
            cur.execute(
                """
                INSERT INTO sms_codes (phone, code_hash, expires_at, last_sent_at, day_key, daily_count, fail_count)
                VALUES (%s, %s, %s, %s, NULL, 0, 0)
                """,
                (phone, code_hash, expires_at, now)
            )
        conn.commit()
        cur.close(); conn.close()

        # Send via Aliyun (provider-side throttling such as daily caps is expected)
        try:
            send_sms_code_via_aliyun(phone, code)
            logger.info("/sms/send success phone=%s", phone)
        except Exception as e:
            logger.exception("/sms/send failed phone=%s error=%s", phone, e)
            # 发送失败时，建议回滚当次计数（这里简单返回错误信息，不做回滚）
            # Hint: BUSINESS_LIMIT_CONTROL indicates Aliyun daily cap has been hit.
            return jsonify({"success": False, "message": f"短信发送失败: {str(e)}"}), 500

        return jsonify({"success": True, "message": "验证码已发送"})

    except Exception as e:
        logger.exception("/sms/send server error: %s", e)
        return jsonify({"success": False, "message": "服务器错误", "error": str(e)}), 500


@sms_blueprint.route('/sms/verify', methods=['POST', 'OPTIONS'])
def sms_verify():
    """POST /sms/verify
    Body: {"phone": "+86...", "code": "######"}
    Behavior: normalize phone, check OTP hash + TTL + fail_count; on success, clear OTP and
    return user id if the phone is registered in users table.
    """
    if request.method == 'OPTIONS':
        return '', 200

    try:
        ensure_tables()
        data = request.get_json(force=True)
        raw_phone = (data or {}).get('phone', '').strip()
        code = (data or {}).get('code', '').strip()
        # Basic format validation
        phone = normalize_cn_phone(raw_phone)
        if not phone:
            logger.warning("/sms/verify invalid phone raw=%r", raw_phone)
            return jsonify({"success": False, "message": "手机号格式不正确（仅支持中国大陆 11 位或带 +86）"}), 400
        if not code or not code.isdigit() or len(code) != OTP_LENGTH:
            logger.warning("/sms/verify invalid code format phone=%s", phone)
            return jsonify({"success": False, "message": f"验证码应为 {OTP_LENGTH} 位数字"}), 400

        conn = get_db()
        cur = conn.cursor(dictionary=True)

        # Fetch current OTP row
        cur.execute("SELECT * FROM sms_codes WHERE phone=%s", (phone,))
        row = cur.fetchone()
        if not row or not row.get('code_hash'):
            cur.close(); conn.close()
            return jsonify({"success": False, "message": "验证码不存在或已过期"}), 400

        # TTL check
        expires_at = row['expires_at']
        if isinstance(expires_at, str):
            expires_at = datetime.fromisoformat(expires_at)
        if datetime.utcnow() > expires_at:
            logger.info("/sms/verify expired phone=%s", phone)
            cur.close(); conn.close()
            return jsonify({"success": False, "message": "验证码已过期"}), 400

        # Max wrong attempts (local protection)
        fail_count = row.get('fail_count', 0) or 0
        if fail_count >= OTP_VERIFY_MAX_FAILS:
            logger.warning("/sms/verify too many attempts phone=%s fail_count=%d", phone, fail_count)
            cur.close(); conn.close()
            return jsonify({"success": False, "message": "尝试次数过多，请稍后再试"}), 429

        # Hash compare (no plaintext OTP stored)
        incoming_hash = hash_code(phone, code)
        if incoming_hash != row['code_hash']:
            cur.execute("UPDATE sms_codes SET fail_count = fail_count + 1 WHERE phone=%s", (phone,))
            conn.commit()
            cur.close(); conn.close()
            left = max(0, OTP_VERIFY_MAX_FAILS - fail_count - 1)
            logger.warning("/sms/verify wrong code phone=%s attempts_left=%d", phone, left)
            return jsonify({"success": False, "message": f"验证码不正确，还可尝试 {left} 次"}), 400

        # Success: clear OTP state
        cur.execute(
            "UPDATE sms_codes SET code_hash=NULL, expires_at=NULL, fail_count=0 WHERE phone=%s",
            (phone,)
        )

        # Map phone to user (supports legacy username==+86...)
        try:
            logger.info("/sms/verify lookup phone=%s", phone)
        except Exception:
            pass
        cur.execute("SELECT user_id FROM users WHERE phone_number=%s OR username=%s LIMIT 1", (phone, phone))
        user = cur.fetchone()
        try:
            logger.info("/sms/verify user lookup result: %s", user)
        except Exception:
            pass

        conn.commit()
        cur.close(); conn.close()

        if user and user.get('user_id'):
            logger.info("/sms/verify success with user user_id=%s phone=%s", user["user_id"], phone)
            # 与 /login 的返回风格对齐，同时兼容前端已使用的 user_id 键
            return jsonify({
                "success": True,
                "message": "验证码校验通过",
                "user_id": user["user_id"],
                "userId": user["user_id"]
            })
        else:
            logger.info("/sms/verify success without user phone=%s", phone)
            return jsonify({
                "success": True,
                "message": "验证码校验通过"
            })

    except Exception as e:
        logger.exception("/sms/verify server error: %s", e)
        return jsonify({"success": False, "message": "服务器错误", "error": str(e)}), 500