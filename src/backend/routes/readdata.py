import os
from dotenv import load_dotenv
from flask import Blueprint, request, jsonify
import mysql.connector
import logging

load_dotenv()

logger = logging.getLogger("readdata")

readdata_blueprint = Blueprint('readdata', __name__)

db_config = {
    "host": os.getenv("DB_HOST"),
    "user": os.getenv("DB_USER"),
    "password": os.getenv("DB_PASSWORD"),
    "database": os.getenv("DB_NAME")
}

@readdata_blueprint.route('/readdata', methods=['POST', 'OPTIONS'])
def readdata():
    if request.method == 'OPTIONS':
        return '', 200
    try:
        data = request.get_json(force=True)
        logger.info("/readdata request data=%s", data)

        table_name = data.get("table_name")
        user_id = data.get("user_id")
        username = data.get("username")
        
        if not table_name:
            logger.warning("/readdata missing table_name in request data=%s", data)
            return jsonify({"success": False, "message": "缺少表名参数"}), 400

        conn = mysql.connector.connect(**db_config)
        cursor = conn.cursor(dictionary=True)

        query = f"SELECT * FROM {table_name}"
        params = []
        
        if user_id:
            query += " WHERE user_id = %s"
            params.append(user_id)
        elif username:
            query += " WHERE username = %s"
            params.append(username)
        
        logger.info("/readdata executing query=%s params=%s", query, params)
        
        cursor.execute(query, params)
        results = cursor.fetchall()

        cursor.close()
        conn.close()

        logger.info("/readdata success table=%s count=%d", table_name, len(results))

        return jsonify({
            "success": True, 
            "message": "数据读取成功",
            "data": results,
            "count": len(results)
        })

    except Exception as e:
        logger.exception("/readdata server error: %s", e)
        return jsonify({"success": False, "message": "服务器错误", "error": str(e)}), 500