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
        # 可选：按记录日期过滤（YYYY-MM-DD），以 exportInfo.recordTime 的日期为准
        filter_date = (request.args.get("date") or "").strip() or None
        
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
                filtered_rows = []
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

                    # 如指定 date，则按 exportInfo.recordTime(缺失退回 exportTime) 的日期过滤；
                    # 若为 diet，再进一步按每餐的 date/timestamp 进行匹配，任一餐命中即可。
                    if filter_date:
                        try:
                            exp = (row.get('preview') or {}).get('exportInfo') or {}
                            rt = (exp.get('recordTime') or exp.get('exportTime') or '').strip()
                            ds = None
                            if rt:
                                import re
                                m = re.match(r"^(\d{4})[-/.](\d{2})[-/.](\d{2})", rt)
                                if m:
                                    ds = f"{m.group(1)}-{m.group(2)}-{m.group(3)}"
                            if ds == filter_date:
                                filtered_rows.append(row)
                            else:
                                # 预览内容不足时，回退读取完整 content 再判断
                                try:
                                    cur2 = conn.cursor(dictionary=True)
                                    try:
                                        cur2.execute(f"SELECT content FROM {table_name} WHERE id=%s LIMIT 1", (row['id'],))
                                        full = cur2.fetchone()
                                    finally:
                                        try:
                                            cur2.close()
                                        except Exception:
                                            pass
                                    if full and full.get('content'):
                                        import json, re
                                        try:
                                            content_obj = json.loads(full['content'])
                                        except Exception:
                                            content_obj = {}
                                        exp2 = (content_obj.get('exportInfo') or {})
                                        rt2 = (exp2.get('recordTime') or exp2.get('exportTime') or '').strip()
                                        ds2 = None
                                        if rt2:
                                            m2 = re.match(r"^(\d{4})[-/.](\d{2})[-/.](\d{2})", rt2)
                                            if m2:
                                                ds2 = f"{m2.group(1)}-{m2.group(2)}-{m2.group(3)}"
                                        include = (ds2 == filter_date)
                                        # diet: 任一餐命中也包括
                                        if not include and kind == 'diet':
                                            try:
                                                diet_data = content_obj.get('dietData') or {}
                                                for meal in (diet_data.values() if isinstance(diet_data, dict) else []):
                                                    if not isinstance(meal, dict):
                                                        continue
                                                    md = (meal.get('date') or '').strip()
                                                    mt = (meal.get('timestamp') or '').strip()
                                                    mds = None
                                                    if md:
                                                        mds = md
                                                    elif mt:
                                                        m3 = re.match(r"^(\d{4})[-/.](\d{2})[-/.](\d{2})", mt)
                                                        if m3:
                                                            mds = f"{m3.group(1)}-{m3.group(2)}-{m3.group(3)}"
                                                    if mds == filter_date:
                                                        include = True
                                                        break
                                            except Exception:
                                                pass
                                        if include:
                                            filtered_rows.append(row)
                                except Exception:
                                    pass
                        except Exception:
                            # 忽略解析失败
                            pass
                    else:
                        filtered_rows.append(row)
                        
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
            "data": filtered_rows if filter_date is not None else (rows or []),
            "count": len(filtered_rows) if filter_date is not None else len(rows),
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

