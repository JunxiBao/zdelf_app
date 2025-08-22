import os
from dotenv import load_dotenv
from flask import Blueprint, request, jsonify
import mysql.connector
from mysql.connector import errors as mysql_errors
import logging

load_dotenv()

logger = logging.getLogger("app.readdata")

readdata_blueprint = Blueprint('readdata', __name__)

db_config = {
    "host": os.getenv("DB_HOST"),
    "user": os.getenv("DB_USER"),
    "password": os.getenv("DB_PASSWORD"),
    "database": os.getenv("DB_NAME")
}

# Allowed table whitelist to prevent SQL injection risks
ALLOWED_TABLES = {"users"}

def _get_conn():
    # Read-only query: connection timeout 5s, and set single statement max execution 15s
    conn = mysql.connector.connect(**db_config, connection_timeout=5, autocommit=True)
    cur = conn.cursor()
    try:
        cur.execute("SET SESSION MAX_EXECUTION_TIME=15000")  # 15s
    finally:
        cur.close()
    return conn

@readdata_blueprint.route('/readdata', methods=['POST', 'OPTIONS'])
def readdata():
    if request.method == 'OPTIONS':
        return '', 200
    try:
        data = request.get_json(silent=True) or {}
        logger.info("/readdata request data=%s", data)

        table_name = data.get("table_name")
        user_id = data.get("user_id")
        username = data.get("username")
        
        table_name = (table_name or "").strip()
        username = (username or "").strip() or None
        user_id = (user_id or "").strip() or None

        if table_name not in ALLOWED_TABLES:
            logger.warning("/readdata illegal table_name=%s", table_name)
            return jsonify({"success": False, "message": "不允许访问该表"}), 400

        conn = _get_conn()
        cursor = conn.cursor(dictionary=True)
        try:
            query = f"SELECT * FROM {table_name}"
            params = []
            if user_id:
                query += " WHERE user_id = %s"
                params.append(user_id)
            elif username:
                query += " WHERE username = %s"
                params.append(username)
            query += " LIMIT 1000"

            logger.info("/readdata executing query=%s params=%s", query, params)
            cursor.execute(query, params)
            results = cursor.fetchall()
        finally:
            try:
                cursor.close()
            except Exception:
                pass
            try:
                conn.close()
            except Exception:
                pass

        logger.info("/readdata success table=%s count=%d", table_name, len(results))

        return jsonify({
            "success": True, 
            "message": "数据读取成功",
            "data": results,
            "count": len(results)
        })

    except mysql_errors.Error as e:
        if getattr(e, 'errno', None) in (3024, 1205, 1213):
            logger.warning("/readdata db timeout/deadlock errno=%s msg=%s", getattr(e, 'errno', None), str(e))
            return jsonify({"success": False, "message": "数据库超时或死锁，请稍后重试"}), 504
        logger.exception("/readdata db error: %s", e)
        return jsonify({"success": False, "message": "数据库错误", "error": str(e)}), 500
    except Exception as e:
        logger.exception("/readdata server error: %s", e)
        return jsonify({"success": False, "message": "服务器错误", "error": str(e)}), 500