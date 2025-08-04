from flask import Blueprint, request, jsonify
import mysql.connector

login_blueprint = Blueprint('login', __name__)

db_config = {
    "host": "localhost",
    "user": "junxibao",
    "password": "Bjx81402",
    "database": "health"
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
        print("❌ 错误：", e)
        return jsonify({"success": False, "message": "服务器错误", "error": str(e)}), 500