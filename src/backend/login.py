from flask import Flask, request, jsonify
import mysql.connector
import uuid
from flask_cors import CORS

app = Flask(__name__)
CORS(app, resources={r"/*": {"origins": "http://47.117.186.20"}})

# 数据库连接配置
db_config = {
    "host": "localhost",
    "user": "your_mysql_user",
    "password": "your_mysql_password",
    "database": "your_database_name"
}

@app.route('/login', methods=['POST'])
def login():
    data = request.get_json()
    username = data.get("username")
    password = data.get("password")

    # 链接数据库
    conn = mysql.connector.connect(**db_config)
    cursor = conn.cursor(dictionary=True)

    # 查找用户
    cursor.execute("SELECT * FROM users WHERE username=%s AND password=%s", (username, password))
    user = cursor.fetchone()

    cursor.close()
    conn.close()

    if user:
        user_id = str(uuid.uuid4())  # 随机生成 user ID
        return jsonify({"success": True, "userId": user_id})
    else:
        return jsonify({"success": False})

if __name__ == '__main__':
    app.run(host="0.0.0.0", port=5000)