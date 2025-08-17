import os
import re
import logging
from dotenv import load_dotenv
from flask import Blueprint, request, jsonify
import mysql.connector

load_dotenv()

logger = logging.getLogger("editdata")

editdata_blueprint = Blueprint('editdata', __name__)

# Database config
db_config = {
    "host": os.getenv("DB_HOST"),
    "user": os.getenv("DB_USER"),
    "password": os.getenv("DB_PASSWORD"),
    "database": os.getenv("DB_NAME"),
}

ALLOWED_TABLES = {"users"}  # 为了安全只允许更新 users 表，如需扩展可加入白名单


def _validate_table(name: str) -> bool:
    if not name:
        return False
    if name in ALLOWED_TABLES:
        return True
    # 可选：放开更多表时使用字符校验（字母/数字/下划线）
    return bool(re.fullmatch(r"[A-Za-z0-9_]+", name))


@editdata_blueprint.route('/editdata', methods=['POST', 'OPTIONS'])
def editdata():
    """
    更新用户资料（age / password）。

    请求 JSON 示例：
    {
      "table_name": "users",            # 可选，默认 users
      "user_id": "uuid-xxx",            # user_id 和 username 至少提供一个
      "username": "JunxiBao",
      "age": 20,                          # 可选：更新年龄（0~120 的整数）
      "new_password": "Abc12345"         # 可选：更新密码（或使用字段名 password）
    }

    响应：
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
        data = request.get_json(force=True)
        logger.info("/editdata request data=%s", data)

        table_name = (data.get("table_name") or "users").strip()
        user_id = data.get("user_id")
        username = data.get("username")

        # 验证表名
        if not _validate_table(table_name):
            logger.warning("/editdata invalid table_name=%s", table_name)
            return jsonify({"success": False, "message": "非法表名"}), 400

        if not user_id and not username:
            logger.warning("/editdata missing user identity user_id=%s username=%s", user_id, username)
            return jsonify({"success": False, "message": "缺少用户标识（user_id 或 username）"}), 400

        # 读取将要更新的字段
        updated_fields = []
        params = []

        # 年龄校验
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

        # 密码校验（new_password 或 password 二选一）
        new_password = data.get("new_password") or data.get("password")
        if new_password is not None and new_password != "":
            # 至少 1 大写 + 1 小写 + 1 数字，长度 8-20，允许常见符号
            if not re.fullmatch(r"(?=.*[a-z])(?=.*[A-Z])(?=.*\d)[A-Za-z\d!@#$%^&*()_+\-=?\[\]{};':\"\\|,.<>\/?]{8,20}", str(new_password)):
                logger.warning("/editdata invalid password format username=%s user_id=%s", username, user_id)
                return jsonify({"success": False, "message": "新密码必须为8到20位，包含大写字母、小写字母和数字，一些特殊字符不能包括"}), 400
            updated_fields.append("password = %s")
            params.append(new_password)

        if not updated_fields:
            logger.warning("/editdata no fields to update username=%s user_id=%s", username, user_id)
            return jsonify({"success": False, "message": "没有需要更新的字段"}), 400

        # WHERE 条件
        where_clause = ""
        if user_id:
            where_clause = " WHERE user_id = %s"
            params.append(user_id)
        else:
            where_clause = " WHERE username = %s"
            params.append(username)

        # 执行更新
        conn = mysql.connector.connect(**db_config)
        cursor = conn.cursor(dictionary=True)

        update_sql = f"UPDATE {table_name} SET " + ", ".join(updated_fields) + where_clause
        logger.info("/editdata executing update table=%s set=%s where=%s params=%s", table_name, ", ".join(updated_fields), where_clause.strip(), params)
        cursor.execute(update_sql, params)
        conn.commit()

        affected = cursor.rowcount
        if affected <= 0:
            logger.warning("/editdata no match or unchanged table=%s username=%s user_id=%s", table_name, username, user_id)
            cursor.close(); conn.close()
            return jsonify({"success": False, "message": "未找到匹配用户或数据未变更", "affected": 0}), 404

        # 可选：返回最新数据
        # 重新查询更新后的记录
        select_params = []
        select_where = ""
        if user_id:
            select_where = " WHERE user_id = %s"; select_params.append(user_id)
        else:
            select_where = " WHERE username = %s"; select_params.append(username)
        select_sql = f"SELECT * FROM {table_name}" + select_where
        cursor.execute(select_sql, select_params)
        updated_row = cursor.fetchone()

        cursor.close()
        conn.close()

        logger.info("/editdata success table=%s affected=%d username=%s user_id=%s updated_fields=%s", table_name, affected, username, user_id, [f.split('=')[0].strip() for f in updated_fields])

        return jsonify({
            "success": True,
            "message": "更新成功",
            "affected": affected,
            "updated_fields": [f.split('=')[0].strip() for f in updated_fields],
            "data": updated_row
        })

    except Exception as e:
        logger.exception("/editdata server error: %s", e)
        return jsonify({"success": False, "message": "服务器错误", "error": str(e)}), 500