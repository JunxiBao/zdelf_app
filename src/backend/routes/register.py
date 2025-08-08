import os
from dotenv import load_dotenv
from flask import Blueprint, request, jsonify
import mysql.connector
import uuid

load_dotenv()

register_blueprint = Blueprint('register', __name__)

db_config = {
    "host": os.getenv("DB_HOST"),
    "user": os.getenv("DB_USER"),
    "password": os.getenv("DB_PASSWORD"),
    "database": os.getenv("DB_NAME")
}

@register_blueprint.route('/register', methods=['POST', 'OPTIONS'])
def register():
    if request.method == 'OPTIONS':
        return '', 200
    try:
        data = request.get_json(force=True)
        print("注册收到的数据：", data)

        username = data.get("username")
        password = data.get("password")
        age = data.get("age")
        try:
            age = int(age)
            if age < 1 or age > 120:
                return jsonify({"success": False, "message": "年龄必须是1-120之间的整数"}), 400
        except (TypeError, ValueError):
            return jsonify({"success": False, "message": "年龄格式不正确"}), 400

        if not username or not password or age is None:
            return jsonify({"success": False, "message": "缺少用户名、密码或年龄"}), 400

        conn = mysql.connector.connect(**db_config)
        cursor = conn.cursor(dictionary=True)

        cursor.execute("SELECT * FROM users WHERE username=%s", (username,))
        existing_user = cursor.fetchone()
        if existing_user:
            cursor.close()
            conn.close()
            return jsonify({"success": False, "message": "用户名已存在"}), 409

        user_id = str(uuid.uuid4())
        cursor.execute(
            "INSERT INTO users (user_id, username, password, age) VALUES (%s, %s, %s, %s)",
            (user_id, username, password, age)
        )
        conn.commit()

        cursor.close()
        conn.close()

        return jsonify({"success": True, "message": "注册成功"})

    except Exception as e:
        print("❌ 注册错误：", e)
        return jsonify({"success": False, "message": "服务器错误", "error": str(e)}), 500