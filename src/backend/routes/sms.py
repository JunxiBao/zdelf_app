import os
import re
import hmac
import uuid
import time
import hashlib
import random
from datetime import datetime, timedelta

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

sms_blueprint = Blueprint('sms', __name__)

# ---------- 环境变量与配置 ----------
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

PHONE_REGEX = re.compile(r"^\+?\d{6,15}$")

# ---------- 工具函数 ----------

def get_db():
    return mysql.connector.connect(**DB_CONFIG)


def ensure_tables():
    """初始化所需表：sms_codes 和 users（若不存在 users 则不会创建字段，请按业务已有结构为准）。"""
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
    msg = f"{phone}:{code}".encode("utf-8")
    key = SERVER_SECRET.encode("utf-8")
    return hmac.new(key, msg, hashlib.sha256).hexdigest()


def gen_code(length: int = 6) -> str:
    n = random.randint(0, 10 ** length - 1)
    return str(n).zfill(length)


# ---------- 阿里云短信 ----------

def get_aliyun_client():
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
    if request.method == 'OPTIONS':
        return '', 200

    try:
        ensure_tables()
        data = request.get_json(force=True)
        phone = (data or {}).get('phone', '').strip()

        if not PHONE_REGEX.match(phone):
            return jsonify({"success": False, "message": "手机号格式不正确（需包含区号，如 +86xxxxxxxx）"}), 400

        now = datetime.utcnow()
        today = now.date()

        conn = get_db()
        cur = conn.cursor(dictionary=True)

        # 读取现有记录
        cur.execute("SELECT * FROM sms_codes WHERE phone=%s", (phone,))
        row = cur.fetchone()

        # 频控：冷却时间
        if row and row.get('last_sent_at'):
            last_sent = row['last_sent_at']
            if isinstance(last_sent, str):
                last_sent = datetime.fromisoformat(last_sent)
            delta = (now - last_sent).total_seconds()
            if delta < OTP_SEND_COOLDOWN_SECONDS:
                left = int(OTP_SEND_COOLDOWN_SECONDS - delta)
                cur.close(); conn.close()
                return jsonify({"success": False, "message": f"发送过于频繁，请 {left}s 后重试"}), 429

        # 频控：每日上限
        daily_count = 0
        if row:
            daily_count = row.get('daily_count', 0) or 0
            day_key = row.get('day_key')
            if str(day_key) != str(today):
                daily_count = 0  # 新的一天重置
        if daily_count >= OTP_DAILY_LIMIT_PER_PHONE:
            cur.close(); conn.close()
            return jsonify({"success": False, "message": "当日发送次数已达上限"}), 429

        # 生成验证码并入库（哈希）
        code = gen_code(OTP_LENGTH)
        code_hash = hash_code(phone, code)
        expires_at = now + timedelta(seconds=OTP_TTL_SECONDS)

        if row:
            cur.execute(
                """
                UPDATE sms_codes SET code_hash=%s, expires_at=%s, last_sent_at=%s,
                    day_key=%s, daily_count=%s
                WHERE phone=%s
                """,
                (code_hash, expires_at, now, today, daily_count + 1, phone)
            )
        else:
            cur.execute(
                """
                INSERT INTO sms_codes (phone, code_hash, expires_at, last_sent_at, day_key, daily_count, fail_count)
                VALUES (%s, %s, %s, %s, %s, %s, 0)
                """,
                (phone, code_hash, expires_at, now, today, 1)
            )
        conn.commit()
        cur.close(); conn.close()

        # 发送短信
        try:
            send_sms_code_via_aliyun(phone, code)
        except Exception as e:
            # 发送失败时，建议回滚当次计数（这里简单返回错误信息，不做回滚）
            return jsonify({"success": False, "message": f"短信发送失败: {str(e)}"}), 500

        return jsonify({"success": True, "message": "验证码已发送"})

    except Exception as e:
        return jsonify({"success": False, "message": "服务器错误", "error": str(e)}), 500


@sms_blueprint.route('/sms/verify', methods=['POST', 'OPTIONS'])
def sms_verify():
    if request.method == 'OPTIONS':
        return '', 200

    try:
        ensure_tables()
        data = request.get_json(force=True)
        phone = (data or {}).get('phone', '').strip()
        code = (data or {}).get('code', '').strip()

        if not PHONE_REGEX.match(phone):
            return jsonify({"success": False, "message": "手机号格式不正确"}), 400
        if not code or not code.isdigit() or len(code) != OTP_LENGTH:
            return jsonify({"success": False, "message": f"验证码应为 {OTP_LENGTH} 位数字"}), 400

        conn = get_db()
        cur = conn.cursor(dictionary=True)

        cur.execute("SELECT * FROM sms_codes WHERE phone=%s", (phone,))
        row = cur.fetchone()
        if not row or not row.get('code_hash'):
            cur.close(); conn.close()
            return jsonify({"success": False, "message": "验证码不存在或已过期"}), 400

        # 过期检查
        expires_at = row['expires_at']
        if isinstance(expires_at, str):
            expires_at = datetime.fromisoformat(expires_at)
        if datetime.utcnow() > expires_at:
            cur.close(); conn.close()
            return jsonify({"success": False, "message": "验证码已过期"}), 400

        # 失败次数检查
        fail_count = row.get('fail_count', 0) or 0
        if fail_count >= OTP_VERIFY_MAX_FAILS:
            cur.close(); conn.close()
            return jsonify({"success": False, "message": "尝试次数过多，请稍后再试"}), 429

        # 校验
        incoming_hash = hash_code(phone, code)
        if incoming_hash != row['code_hash']:
            cur.execute("UPDATE sms_codes SET fail_count = fail_count + 1 WHERE phone=%s", (phone,))
            conn.commit()
            cur.close(); conn.close()
            left = max(0, OTP_VERIFY_MAX_FAILS - fail_count - 1)
            return jsonify({"success": False, "message": f"验证码不正确，还可尝试 {left} 次"}), 400

        # 成功：清除验证码与失败计数
        cur.execute(
            "UPDATE sms_codes SET code_hash=NULL, expires_at=NULL, fail_count=0 WHERE phone=%s",
            (phone,)
        )

        conn.commit()
        cur.close(); conn.close()

        return jsonify({"success": True, "message": "验证码校验通过"})

    except Exception as e:
        return jsonify({"success": False, "message": "服务器错误", "error": str(e)}), 500