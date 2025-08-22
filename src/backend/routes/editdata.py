import os
import re
import logging
from dotenv import load_dotenv
from flask import Blueprint, request, jsonify
import mysql.connector
from mysql.connector import errors as mysql_errors

# read information of DB
load_dotenv()

logger = logging.getLogger("app.editdata")

editdata_blueprint = Blueprint('editdata', __name__)

# Database config
db_config = {
    "host": os.getenv("DB_HOST"),
    "user": os.getenv("DB_USER"),
    "password": os.getenv("DB_PASSWORD"),
    "database": os.getenv("DB_NAME"),
}

def _get_conn():
    # Connection timeout: 5 seconds; After entering the session, set the maximum execution time of the statement to 15 seconds to avoid freezing
    conn = mysql.connector.connect(**db_config, connection_timeout=5, autocommit=False)
    cur = conn.cursor()
    try:
        cur.execute("SET SESSION MAX_EXECUTION_TIME=15000")  # 15s
    finally:
        cur.close()
    return conn

ALLOWED_TABLES = {"users"}  # For security reasons, only the users table is allowed to be updated. If you need to expand it, you can add it to the whitelist

def _validate_table(name: str):
    if not name:
        return False
    if name in ALLOWED_TABLES:
        return True
    # Optional: Use character validation (letters/numbers/underscores) when expanding to more tables
    return bool(re.fullmatch(r"[A-Za-z0-9_]+", name))


@editdata_blueprint.route('/editdata', methods=['POST', 'OPTIONS'])
def editdata():
    """
    Update user profile(age / password).

    Request JSON example:
    {
      "table_name": "users",            # Optional, default is users
      "user_id": "uuid-xxx",            # user_id and username must provide at least one
      "username": "JunxiBao",
      "age": 20,                          # Optional: update age (integer 0~120)
      "new_password": "Abc12345"         # Optional: update password (or use field name password)
    }

    Response:
    {
      "success": true,
      "message": "更新成功",
      "affected": 1,
      "updated_fields": ["age", "password"],
      "data": { ... 可选：更新后的记录 ... }
    }
    """
    if request.method == 'OPTIONS':
        return '', 200

    try:
        data = request.get_json(silent=True) or {}
        logger.info("/editdata request data=%s", data)

        table_name = (data.get("table_name") or "users").strip()
        user_id = data.get("user_id")
        username = data.get("username")

        # Verification form name
        if not _validate_table(table_name):
            logger.warning("/editdata invalid table_name=%s", table_name)
            return jsonify({"success": False, "message": "非法表名"}), 400

        if not user_id and not username:
            logger.warning("/editdata missing user identity user_id=%s username=%s", user_id, username)
            return jsonify({"success": False, "message": "缺少用户标识（user_id 或 username）"}), 400

        # Read the fields to be updated
        updated_fields = []
        params = []

        # Age validation
        if "age" in data and data.get("age") is not None:
            try:
                age_val = int(data.get("age"))
            except (TypeError, ValueError):
                logger.warning("/editdata invalid age format age=%r username=%s user_id=%s", data.get("age"), username, user_id)
                return jsonify({"success": False, "message": "年龄必须为整数"}), 400
            if age_val < 0 or age_val > 120:
                logger.warning("/editdata invalid age range age=%s username=%s user_id=%s", age_val, username, user_id)
                return jsonify({"success": False, "message": "年龄范围应在 0~120"}), 400
            updated_fields.append("age = %s")
            params.append(age_val)

        # Password validation (new_password or password, one of them must be provided)
        new_password = data.get("new_password") or data.get("password")
        if new_password is not None and new_password != "":
            # At least 1 uppercase + 1 lowercase + 1 number, length 8-20, allow common symbols
            if not re.fullmatch(r"(?=.*[a-z])(?=.*[A-Z])(?=.*\d)[A-Za-z\d!@#$%^&*()_+\-=?\[\]{};':\"\\|,.<>\/?]{8,20}", str(new_password)):
                logger.warning("/editdata invalid password format username=%s user_id=%s", username, user_id)
                return jsonify({"success": False, "message": "新密码必须为8到20位，包含大写字母、小写字母和数字"}), 400
            updated_fields.append("password = %s")
            params.append(new_password)

        if not updated_fields:
            logger.warning("/editdata no fields to update username=%s user_id=%s", username, user_id)
            return jsonify({"success": False, "message": "没有需要更新的字段"}), 400

        # WHERE Condition
        where_clause = ""
        if user_id:
            where_clause = " WHERE user_id = %s"
            params.append(user_id)
        else:
            where_clause = " WHERE username = %s"
            params.append(username)

        # Perform the update
        conn = _get_conn()
        cursor = conn.cursor(dictionary=True)
        try:
            update_sql = f"UPDATE {table_name} SET " + ", ".join(updated_fields) + where_clause
            logger.info("/editdata executing update table=%s set=%s where=%s params=%s", table_name, ", ".join(updated_fields), where_clause.strip(), params)
            cursor.execute(update_sql, params)
            conn.commit()

            affected = cursor.rowcount
            if affected <= 0:
                logger.warning("/editdata no match or unchanged table=%s username=%s user_id=%s", table_name, username, user_id)
                return jsonify({"success": False, "message": "未找到匹配用户或数据未变更", "affected": 0}), 404

            # Return the latest data
            select_params = []
            select_where = ""
            if user_id:
                select_where = " WHERE user_id = %s"; select_params.append(user_id)
            else:
                select_where = " WHERE username = %s"; select_params.append(username)
            select_sql = f"SELECT * FROM {table_name}" + select_where
            cursor.execute(select_sql, select_params)
            updated_row = cursor.fetchone()
        finally:
            try:
                cursor.close()
            except Exception:
                pass
            try:
                conn.close()
            except Exception:
                pass

        logger.info("/editdata success table=%s affected=%d username=%s user_id=%s updated_fields=%s", table_name, affected, username, user_id, [f.split('=')[0].strip() for f in updated_fields])

        return jsonify({
            "success": True,
            "message": "更新成功",
            "affected": affected,
            "updated_fields": [f.split('=')[0].strip() for f in updated_fields],
            "data": updated_row
        })

    except mysql_errors.Error as e:
        # 3024: MAX_EXECUTION_TIME exceeded; 1205: Lock wait timeout; 1213: Deadlock found
        if getattr(e, 'errno', None) in (3024, 1205, 1213):
            logger.warning("/editdata db timeout/deadlock errno=%s msg=%s", getattr(e, 'errno', None), str(e))
            return jsonify({"success": False, "message": "数据库超时或死锁，请稍后重试"}), 504
        logger.exception("/editdata db error: %s", e)
        return jsonify({"success": False, "message": "数据库错误", "error": str(e)}), 500
    except Exception as e:
        logger.exception("/editdata server error: %s", e)
        return jsonify({"success": False, "message": "服务器错误", "error": str(e)}), 500