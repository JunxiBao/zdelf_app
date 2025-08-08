from flask import Blueprint, request, jsonify
import mysql.connector
import os
from dotenv import load_dotenv

load_dotenv()

login_blueprint = Blueprint('login', __name__)

db_config = {
    "host": os.getenv("DB_HOST"),
    "user": os.getenv("DB_USER"),
    "password": os.getenv("DB_PASSWORD"),
    "database": os.getenv("DB_NAME")
}

@login_blueprint.route('/login', methods=['POST', 'OPTIONS'])
def login():
    if request.method == 'OPTIONS':
        return '', 200
    try:
        data = request.get_json(force=True)
        print("收到的数据：", data)

        username = data.get("username")
        password = data.get("password")

        if not username or not password:
            return jsonify({"success": False, "message": "缺少用户名或密码"}), 400

        conn = mysql.connector.connect(**db_config)
        cursor = conn.cursor(dictionary=True)

        cursor.execute("SELECT * FROM users WHERE username=%s AND password=%s", (username, password))
        user = cursor.fetchone()

        cursor.close()
        conn.close()

        if user:
            return jsonify({"success": True, "userId": user["user_id"]})
        else:
            return jsonify({"success": False, "message": "用户名或密码错误"}), 401

    except Exception as e:
        print("❌ 登陆错误：", e)
        return jsonify({"success": False, "message": "服务器错误", "error": str(e)}), 500