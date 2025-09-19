import os
import logging
from typing import Optional

from dotenv import load_dotenv
from flask import Blueprint, request, jsonify
import mysql.connector
from mysql.connector import errors as mysql_errors

load_dotenv()

logger = logging.getLogger("app.getjson")

getjson_blueprint = Blueprint("getjson", __name__)

DB_CONFIG = {
    "host": os.getenv("DB_HOST"),
    "user": os.getenv("DB_USER"),
    "password": os.getenv("DB_PASSWORD"),
    "database": os.getenv("DB_NAME"),
}

# 支持的数据类型
KIND_TO_TABLE = {
    "metrics": "metrics_files",
    "diet": "diet_files", 
    "case": "case_files",
}

def _get_conn():
    conn = mysql.connector.connect(**DB_CONFIG, connection_timeout=5, autocommit=True)
    cur = conn.cursor()
    try:
        cur.execute("SET SESSION MAX_EXECUTION_TIME=15000")
    finally:
        cur.close()
    return conn

def _parse_kind(kind: str) -> Optional[str]:
    kind = (kind or "").strip().lower()
    return kind if kind in KIND_TO_TABLE else None

@getjson_blueprint.route("/getjson/<kind>", methods=["GET", "OPTIONS"])
def get_user_files(kind):
    if request.method == "OPTIONS":
        return "", 200

    try:
        kind = _parse_kind(kind)
        if not kind:
            return jsonify({"success": False, "message": "非法的类型（仅支持 metrics/diet/case）"}), 400

        # 获取查询参数
        user_id = (request.args.get("user_id") or "").strip() or None
        username = (request.args.get("username") or "").strip() or None
        limit = request.args.get("limit", "50")
        
        # 验证用户标识
        if not user_id and not username:
            return jsonify({"success": False, "message": "缺少用户标识（user_id 或 username）"}), 400

        # 解析限制数量
        try:
            limit = int(limit)
            if limit <= 0 or limit > 500:
                limit = 50
        except (ValueError, TypeError):
            limit = 50

        table_name = KIND_TO_TABLE[kind]
        conn = _get_conn()
        
        try:
            cur = conn.cursor(dictionary=True)
            try:
                # 构建查询语句
                if user_id:
                    query = f"""
                        SELECT id, user_id, username, file_name, created_at, 
                               SUBSTRING(content, 1, 200) as content_preview
                        FROM {table_name} 
                        WHERE user_id = %s 
                        ORDER BY created_at DESC 
                        LIMIT %s
                    """
                    params = (user_id, limit)
                else:
                    query = f"""
                        SELECT id, user_id, username, file_name, created_at,
                               SUBSTRING(content, 1, 200) as content_preview
                        FROM {table_name} 
                        WHERE username = %s 
                        ORDER BY created_at DESC 
                        LIMIT %s
                    """
                    params = (username, limit)
                
                logger.info("/getjson/%s executing query=%s params=%s", kind, query, params)
                cur.execute(query, params)
                rows = cur.fetchall()
                
                # 处理内容预览
                for row in rows:
                    if row.get('content_preview'):
                        try:
                            import json
                            preview_data = json.loads(row['content_preview'])
                            row['preview'] = preview_data
                        except:
                            row['preview'] = None
                    else:
                        row['preview'] = None
                    
                    # 移除原始的长内容字段
                    if 'content_preview' in row:
                        del row['content_preview']
                        
            finally:
                try:
                    cur.close()
                except Exception:
                    pass
        finally:
            try:
                conn.close()
            except Exception:
                pass

        return jsonify({
            "success": True, 
            "data": rows or [],
            "count": len(rows),
            "kind": kind
        })

    except mysql_errors.Error as e:
        logger.exception("/getjson db error: %s", e)
        return jsonify({"success": False, "message": "数据库错误", "error": str(e)}), 500
    except Exception as e:
        logger.exception("/getjson server error: %s", e)
        return jsonify({"success": False, "message": "服务器错误", "error": str(e)}), 500

@getjson_blueprint.route("/getjson/<kind>/<file_id>", methods=["GET", "OPTIONS"])
def get_file_detail(kind, file_id):
    if request.method == "OPTIONS":
        return "", 200

    try:
        kind = _parse_kind(kind)
        if not kind:
            return jsonify({"success": False, "message": "非法的类型（仅支持 metrics/diet/case）"}), 400

        table_name = KIND_TO_TABLE[kind]
        conn = _get_conn()
        
        try:
            cur = conn.cursor(dictionary=True)
            try:
                query = f"""
                    SELECT id, user_id, username, file_name, content, created_at
                    FROM {table_name} 
                    WHERE id = %s 
                    LIMIT 1
                """
                cur.execute(query, (file_id,))
                row = cur.fetchone()
                
                if not row:
                    return jsonify({"success": False, "message": "未找到记录"}), 404
                
                # 解析 JSON 内容
                try:
                    import json
                    row['content'] = json.loads(row.get('content') or '{}')
                except:
                    row['content'] = {}
                    
            finally:
                try:
                    cur.close()
                except Exception:
                    pass
        finally:
            try:
                conn.close()
            except Exception:
                pass

        return jsonify({"success": True, "data": row})

    except mysql_errors.Error as e:
        logger.exception("/getjson detail db error: %s", e)
        return jsonify({"success": False, "message": "数据库错误", "error": str(e)}), 500
    except Exception as e:
        logger.exception("/getjson detail server error: %s", e)
        return jsonify({"success": False, "message": "服务器错误", "error": str(e)}), 500

