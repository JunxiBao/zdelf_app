from flask import Blueprint, request, jsonify
import mysql.connector
from mysql.connector import errors as mysql_errors
import os
from dotenv import load_dotenv
import logging

load_dotenv()

logger = logging.getLogger("app.login")

login_blueprint = Blueprint('login', __name__)

db_config = {
    "host": os.getenv("DB_HOST"),
    "user": os.getenv("DB_USER"),
    "password": os.getenv("DB_PASSWORD"),
    "database": os.getenv("DB_NAME")
}


# Helper to get MySQL connection with timeouts and per-session query timeout
def _get_conn():
    # 登录查询：连接超时 5s，并设置单条语句最大执行 15s，避免卡住
    conn = mysql.connector.connect(**db_config, connection_timeout=5, autocommit=True)
    cur = conn.cursor()
    try:
        cur.execute("SET SESSION MAX_EXECUTION_TIME=15000")  # 15s
    finally:
        cur.close()
    return conn

@login_blueprint.route('/login', methods=['POST', 'OPTIONS'])
def login():
    if request.method == 'OPTIONS':
        return '', 200
    try:
        data = request.get_json(silent=True) or {}
        logger.info("/login request username=%s", (data.get("username") if isinstance(data, dict) else None))

        username = data.get("username")
        password = data.get("password")

        if not username or not password:
            logger.warning("/login missing username or password data=%s", data)
            return jsonify({"success": False, "message": "缺少用户名或密码"}), 400

        conn = _get_conn()
        cursor = conn.cursor(dictionary=True)
        try:
            cursor.execute("SELECT * FROM users WHERE username=%s AND password=%s", (username, password))
            user = cursor.fetchone()
        finally:
            try:
                cursor.close()
            except Exception:
                pass
            try:
                conn.close()
            except Exception:
                pass

        if user:
            logger.info("/login success username=%s user_id=%s", username, user['user_id'])
            return jsonify({"success": True, "userId": user["user_id"]})
        else:
            logger.warning("/login failed invalid credentials username=%s", username)
            return jsonify({"success": False, "message": "用户名或密码错误"}), 401

    except mysql_errors.Error as e:
        # 3024: MAX_EXECUTION_TIME exceeded; 1205: Lock wait timeout; 1213: Deadlock found
        if getattr(e, 'errno', None) in (3024, 1205, 1213):
            logger.warning("/login db timeout/deadlock errno=%s msg=%s", getattr(e, 'errno', None), str(e))
            return jsonify({"success": False, "message": "数据库超时或死锁，请稍后重试"}), 504
        logger.exception("/login db error: %s", e)
        return jsonify({"success": False, "message": "数据库错误", "error": str(e)}), 500
    except Exception as e:
        logger.exception("/login server error: %s", e)
        return jsonify({"success": False, "message": "服务器错误", "error": str(e)}), 500