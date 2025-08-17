import os
from dotenv import load_dotenv
from flask import Blueprint, request, jsonify
import mysql.connector
import uuid
import re
import logging

load_dotenv()

logger = logging.getLogger("register")

register_blueprint = Blueprint('register', __name__)

db_config = {
    "host": os.getenv("DB_HOST"),
    "user": os.getenv("DB_USER"),
    "password": os.getenv("DB_PASSWORD"),
    "database": os.getenv("DB_NAME")
}

# 将中国大陆手机号标准化为 E.164（+86xxxxxxxxxxx）。
# 支持输入：+86***********、86***********、1**********（11位）
PHONE_RE = re.compile(r"^\+?\d{6,15}$")

def normalize_cn_phone(raw: str) -> str:
    if not raw:
        return ''
    s = re.sub(r"\s", "", str(raw))
    # 仅接受数字和可选+
    if not PHONE_RE.match(s) and not (s.startswith('1') and len(s) == 11 and s.isdigit()):
        return ''
    # 规范化
    digits = re.sub(r"[^0-9]", "", s)
    if s.startswith('+86') or s.startswith('86'):
        # 取末尾 11 位
        digits = digits[-11:]
        if len(digits) != 11:
            return ''
        return '+86' + digits
    if s.startswith('1') and len(s) == 11:
        return '+86' + s
    # 其他情况不接受（只允许中国大陆手机号）
    return ''

@register_blueprint.route('/register', methods=['POST', 'OPTIONS'])
def register():
    if request.method == 'OPTIONS':
        return '', 200
    try:
        data = request.get_json(force=True)
        logger.info("/register request data=%s", data)

        username = (data.get("username") or '').strip()
        password = (data.get("password") or '')
        age = data.get("age")
        phone_raw = (data.get("phone") or '').strip()
        phone = normalize_cn_phone(phone_raw)

        # 年龄校验
        try:
            age = int(age)
            if age < 1 or age > 120:
                logger.warning("/register invalid age=%s for username=%s", age, username)
                return jsonify({"success": False, "message": "年龄必须是1-120之间的整数"}), 400
        except (TypeError, ValueError):
            logger.warning("/register invalid age format=%s", age)
            return jsonify({"success": False, "message": "年龄格式不正确"}), 400

        # 必填校验
        if not username or not password or age is None or not phone:
            logger.warning("/register missing fields username=%s age=%s phone=%s", username, age, phone)
            return jsonify({"success": False, "message": "缺少用户名、密码、年龄或手机号，或手机号格式不正确（仅支持中国大陆）"}), 400

        conn = mysql.connector.connect(**db_config)
        cursor = conn.cursor(dictionary=True)

        # 若之前在 /sms/verify 中创建过占位账号（username=phone 且 phone_number 为空），则直接认领并更新为正式信息
        cursor.execute(
            "SELECT user_id FROM users WHERE username=%s AND (phone_number IS NULL OR phone_number='')",
            (phone,)
        )
        placeholder = cursor.fetchone()
        if placeholder:
            cursor.execute(
                "UPDATE users SET username=%s, password=%s, age=%s, phone_number=%s WHERE user_id=%s",
                (username, password, age, phone, placeholder['user_id'])
            )
            conn.commit()
            logger.info("/register updated placeholder user_id=%s phone=%s username=%s", placeholder['user_id'], phone, username)
            cursor.close()
            conn.close()
            return jsonify({"success": True, "message": "注册成功（占位账号已更新）"})

        # 用户名唯一
        cursor.execute("SELECT 1 FROM users WHERE username=%s", (username,))
        if cursor.fetchone():
            logger.warning("/register username exists username=%s", username)
            cursor.close()
            conn.close()
            return jsonify({"success": False, "message": "用户名已存在"}), 409

        # 手机号唯一
        cursor.execute("SELECT 1 FROM users WHERE phone_number=%s", (phone,))
        if cursor.fetchone():
            logger.warning("/register phone already registered phone=%s", phone)
            cursor.close()
            conn.close()
            return jsonify({"success": False, "message": "该手机号已注册"}), 409

        user_id = str(uuid.uuid4())
        cursor.execute(
            "INSERT INTO users (user_id, username, password, age, phone_number) VALUES (%s, %s, %s, %s, %s)",
            (user_id, username, password, age, phone)
        )
        conn.commit()
        logger.info("/register new user created user_id=%s username=%s phone=%s", user_id, username, phone)

        cursor.close()
        conn.close()

        return jsonify({"success": True, "message": "注册成功"})

    except Exception as e:
        logger.exception("/register server error: %s", e)
        return jsonify({"success": False, "message": "服务器错误", "error": str(e)}), 500