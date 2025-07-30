from flask import Flask, request, jsonify
from flask_cors import CORS
import mysql.connector
import uuid

app = Flask(__name__)
CORS(app, resources={r"/*": {"origins": "https://zhucan.xyz"}})

db_config = {
    "host": "localhost",  # 或者改成你数据库实际主机名
    "user": "junxibao",
    "password": "Bjx81402",
    "database": "health"
}

@app.route('/login', methods=['POST'])
def login():
    try:
        # ✅ 尝试读取 JSON（加 force=True 以确保 Flask 不依赖 headers 判断）
        data = request.get_json(force=True)
        print("收到的数据：", data)

        username = data.get("username")
        password = data.get("password")

        if not username or not password:
            return jsonify({"success": False, "message": "缺少用户名或密码"}), 400

        # ✅ 连接数据库
        conn = mysql.connector.connect(**db_config)
        cursor = conn.cursor(dictionary=True)

        cursor.execute("SELECT * FROM users WHERE username=%s AND password=%s", (username, password))
        user = cursor.fetchone()

        cursor.close()
        conn.close()

        if user:
            user_id = str(uuid.uuid4())  # 你可以改成数据库里的ID
            return jsonify({"success": True, "userId": user_id})
        else:
            return jsonify({"success": False, "message": "用户名或密码错误"}), 401

    except Exception as e:
        print("❌ 错误：", e)
        return jsonify({"success": False, "message": "服务器错误", "error": str(e)}), 500

if __name__ == '__main__':
    app.run(
    host='0.0.0.0',
    port=5000,
    ssl_context=(
        '/etc/letsencrypt/live/zhucan.xyz/fullchain.pem',
        '/etc/letsencrypt/live/zhucan.xyz/privkey.pem'
    )
)