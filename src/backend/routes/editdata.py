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

def _ensure_columns(conn, table_name):
    """确保users表中有所有需要的字段，如果不存在则自动添加"""
    cursor = conn.cursor()
    try:
        # 需要检查的字段列表
        columns_to_check = [
            ("gender", "VARCHAR(10) NULL COMMENT '性别'"),
            ("region", "VARCHAR(100) NULL COMMENT '地区'"),
            ("occupation", "VARCHAR(100) NULL COMMENT '职业'"),
            ("purpura_type", "VARCHAR(100) NULL COMMENT '紫癜类型'"),
            ("first_onset_time", "VARCHAR(50) NULL COMMENT '首次发病时间'"),
        ]
        
        for column_name, column_def in columns_to_check:
            cursor.execute(f"SHOW COLUMNS FROM {table_name} LIKE %s", (column_name,))
            if not cursor.fetchone():
                logger.info(f"/editdata adding column {column_name} to {table_name} table")
                cursor.execute(f"ALTER TABLE {table_name} ADD COLUMN {column_name} {column_def}")
        
        conn.commit()
    except Exception as e:
        logger.exception(f"/editdata error ensuring columns: {e}")
        conn.rollback()
        raise
    finally:
        try:
            cursor.close()
        except Exception:
            pass

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
    Update user profile information.

    Request JSON example:
    {
      "table_name": "users",            # Optional, default is users
      "user_id": "uuid-xxx",            # user_id and username must provide at least one
      "username": "JunxiBao",           # Optional: update username (will check for duplicates)
      "gender": "男",                    # Optional: update gender
      "age": 20,                        # Optional: update age (integer 0~120, can be null)
      "region": "北京",                  # Optional: update region (can be null)
      "occupation": "学生",              # Optional: update occupation (can be null)
      "purpura_type": "皮肤型过敏性紫癜", # Optional: update purpura type (can be null)
      "first_onset_time": "12月1日",     # Optional: update first onset time (can be null)
      "new_password": "Abc12345"        # Optional: update password
    }

    Response:
    {
      "success": true,
      "message": "更新成功",
      "affected": 1,
      "updated_fields": ["username", "age", "gender"],
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

        # Ensure columns exist
        conn = _get_conn()
        try:
            _ensure_columns(conn, table_name)
        except Exception as e:
            logger.exception("/editdata error ensuring columns: %s", e)
            try:
                conn.close()
            except Exception:
                pass
            return jsonify({"success": False, "message": "数据库字段检查失败"}), 500

        # Read the fields to be updated
        updated_fields = []
        params = []

        # Get current user_id if only username is provided
        current_user_id = user_id
        if not current_user_id and username:
            cursor = conn.cursor(dictionary=True)
            try:
                cursor.execute("SELECT user_id FROM users WHERE username=%s", (username,))
                result = cursor.fetchone()
                if result:
                    current_user_id = result['user_id']
            finally:
                try:
                    cursor.close()
                except Exception:
                    pass

        # Username validation and duplicate check
        new_username = data.get("username")
        if new_username is not None:
            new_username = new_username.strip()
            if not new_username:
                logger.warning("/editdata username cannot be empty username=%s user_id=%s", username, user_id)
                try:
                    conn.close()
                except Exception:
                    pass
                return jsonify({"success": False, "message": "用户名不能为空"}), 400
            if len(new_username) > 20:
                logger.warning("/editdata username too long username=%s user_id=%s", new_username, user_id)
                try:
                    conn.close()
                except Exception:
                    pass
                return jsonify({"success": False, "message": "用户名不能超过20位"}), 400
            # Check if username already exists (excluding current user)
            need_check = True
            if not current_user_id and new_username == username:
                # Same username and no user_id, no need to check
                need_check = False
            
            if need_check:
                cursor = conn.cursor(dictionary=True)
                try:
                    if current_user_id:
                        cursor.execute("SELECT user_id FROM users WHERE username=%s AND user_id!=%s", (new_username, current_user_id))
                    else:
                        cursor.execute("SELECT user_id FROM users WHERE username=%s", (new_username,))
                    if cursor.fetchone():
                        logger.warning("/editdata username already exists username=%s user_id=%s", new_username, current_user_id)
                        try:
                            conn.close()
                        except Exception:
                            pass
                        return jsonify({"success": False, "message": "用户名已存在"}), 409
                finally:
                    try:
                        cursor.close()
                    except Exception:
                        pass
            updated_fields.append("username = %s")
            params.append(new_username)

        # Gender validation
        if "gender" in data:
            gender_val = data.get("gender")
            if gender_val is not None:
                gender_val = gender_val.strip() if isinstance(gender_val, str) else None
                updated_fields.append("gender = %s")
                params.append(gender_val if gender_val else None)

        # Age validation
        if "age" in data:
            age_val = data.get("age")
            if age_val is not None:
                if age_val == "" or age_val is None:
                    updated_fields.append("age = %s")
                    params.append(None)
                else:
                    try:
                        age_val = int(age_val)
                    except (TypeError, ValueError):
                        logger.warning("/editdata invalid age format age=%r username=%s user_id=%s", data.get("age"), username, user_id)
                        try:
                            conn.close()
                        except Exception:
                            pass
                        return jsonify({"success": False, "message": "年龄必须为整数"}), 400
                    if age_val < 0 or age_val > 120:
                        logger.warning("/editdata invalid age range age=%s username=%s user_id=%s", age_val, username, user_id)
                        try:
                            conn.close()
                        except Exception:
                            pass
                        return jsonify({"success": False, "message": "年龄范围应在 0~120"}), 400
                    updated_fields.append("age = %s")
                    params.append(age_val)

        # Region validation
        if "region" in data:
            region_val = data.get("region")
            if region_val is not None:
                region_val = region_val.strip() if isinstance(region_val, str) else None
                updated_fields.append("region = %s")
                params.append(region_val if region_val else None)

        # Occupation validation
        if "occupation" in data:
            occupation_val = data.get("occupation")
            if occupation_val is not None:
                occupation_val = occupation_val.strip() if isinstance(occupation_val, str) else None
                updated_fields.append("occupation = %s")
                params.append(occupation_val if occupation_val else None)

        # Purpura type validation
        if "purpura_type" in data:
            purpura_type_val = data.get("purpura_type")
            if purpura_type_val is not None:
                purpura_type_val = purpura_type_val.strip() if isinstance(purpura_type_val, str) else None
                updated_fields.append("purpura_type = %s")
                params.append(purpura_type_val if purpura_type_val else None)

        # First onset time validation
        if "first_onset_time" in data:
            first_onset_time_val = data.get("first_onset_time")
            if first_onset_time_val is not None:
                first_onset_time_val = first_onset_time_val.strip() if isinstance(first_onset_time_val, str) else None
                updated_fields.append("first_onset_time = %s")
                params.append(first_onset_time_val if first_onset_time_val else None)

        # Password validation (new_password or password, one of them must be provided)
        new_password = data.get("new_password") or data.get("password")
        if new_password is not None and new_password != "":
            # At least 1 uppercase + 1 lowercase + 1 number, length 8-20, allow common symbols
            if not re.fullmatch(r"(?=.*[a-z])(?=.*[A-Z])(?=.*\d)[A-Za-z\d!@#$%^&*()_+\-=?\[\]{};':\"\\|,.<>\/?]{8,20}", str(new_password)):
                logger.warning("/editdata invalid password format username=%s user_id=%s", username, user_id)
                try:
                    conn.close()
                except Exception:
                    pass
                return jsonify({"success": False, "message": "新密码必须为8到20位，包含大写字母、小写字母和数字"}), 400
            updated_fields.append("password = %s")
            params.append(new_password)

        if not updated_fields:
            logger.warning("/editdata no fields to update username=%s user_id=%s", username, user_id)
            try:
                conn.close()
            except Exception:
                pass
            return jsonify({"success": False, "message": "没有需要更新的字段"}), 400

        # WHERE Condition - prefer user_id for accuracy
        where_clause = ""
        if current_user_id:
            where_clause = " WHERE user_id = %s"
            params.append(current_user_id)
        elif user_id:
            where_clause = " WHERE user_id = %s"
            params.append(user_id)
        else:
            where_clause = " WHERE username = %s"
            params.append(username)

        # Perform the update
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

            # Return the latest data - use user_id if available, otherwise use new username or old username
            select_params = []
            select_where = ""
            if current_user_id:
                select_where = " WHERE user_id = %s"; select_params.append(current_user_id)
            elif user_id:
                select_where = " WHERE user_id = %s"; select_params.append(user_id)
            else:
                # Use new username if updated, otherwise use old username
                select_username = new_username if new_username else username
                select_where = " WHERE username = %s"; select_params.append(select_username)
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