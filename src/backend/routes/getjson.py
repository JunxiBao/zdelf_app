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
    "symptoms": "symptom_files",
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

@getjson_blueprint.route("/getjson/symptoms/monthly/<user_id>/<year>/<month>", methods=["GET", "OPTIONS"])
def get_monthly_symptoms(user_id, year, month):
    """获取用户指定月份的症状数据，用于日历高亮显示"""
    if request.method == "OPTIONS":
        return "", 200
        
    try:
        # 参数验证
        try:
            year = int(year)
            month = int(month)
            if not (1 <= month <= 12):
                return jsonify({"success": False, "message": "月份必须在1-12之间"}), 400
        except ValueError:
            return jsonify({"success": False, "message": "年份和月份必须是数字"}), 400
            
        user_id = user_id.strip()
        if not user_id:
            return jsonify({"success": False, "message": "用户ID不能为空"}), 400
            
        # 计算查询的日期范围
        from datetime import datetime, timedelta
        start_date = datetime(year, month, 1)
        if month == 12:
            end_date = datetime(year + 1, 1, 1) - timedelta(days=1)
        else:
            end_date = datetime(year, month + 1, 1) - timedelta(days=1)
            
        table_name = KIND_TO_TABLE["symptoms"]
        conn = _get_conn()
        
        try:
            cur = conn.cursor(dictionary=True)
            try:
                # 查询指定月份的症状数据
                sql = f"""
                SELECT 
                    JSON_EXTRACT(content, '$.exportInfo.recordTime') as record_time,
                    JSON_EXTRACT(content, '$.symptomData.symptoms') as symptoms
                FROM {table_name} 
                WHERE user_id = %s 
                AND DATE(JSON_UNQUOTE(JSON_EXTRACT(content, '$.exportInfo.recordTime'))) BETWEEN %s AND %s
                ORDER BY JSON_UNQUOTE(JSON_EXTRACT(content, '$.exportInfo.recordTime'))
                """
                
                cur.execute(sql, (user_id, start_date.date(), end_date.date()))
                rows = cur.fetchall()
                
                # 处理数据，按日期分组，支持同一天多个症状记录
                daily_symptoms = {}
                for row in rows:
                    if row['record_time'] and row['symptoms']:
                        # 提取日期部分
                        record_time = row['record_time'].strip('"')
                        date_part = record_time.split(' ')[0]  # 获取 YYYY-MM-DD 部分
                        
                        # 解析症状数组
                        import json
                        try:
                            symptoms = json.loads(row['symptoms'])
                            if isinstance(symptoms, list):
                                # 如果该日期已有症状记录，合并症状数组
                                if date_part in daily_symptoms:
                                    # 合并症状，去重但保持顺序
                                    existing_symptoms = daily_symptoms[date_part]
                                    combined_symptoms = existing_symptoms + symptoms
                                    # 去重但保持顺序（后面的症状优先级更高）
                                    seen = set()
                                    unique_symptoms = []
                                    for symptom in combined_symptoms:
                                        if symptom not in seen:
                                            seen.add(symptom)
                                            unique_symptoms.append(symptom)
                                    daily_symptoms[date_part] = unique_symptoms
                                else:
                                    daily_symptoms[date_part] = symptoms
                        except (json.JSONDecodeError, TypeError):
                            continue
                            
                return jsonify({
                    "success": True, 
                    "data": daily_symptoms,
                    "month": f"{year}-{month:02d}",
                    "message": f"获取{year}年{month}月症状数据成功"
                })
                
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
                
    except Exception as e:
        logger.exception(f"/getjson/symptoms/monthly server error: {e}")
        return jsonify({"success": False, "message": "服务器错误", "error": str(e)}), 500

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
        # 可选：按开始日期过滤（YYYY-MM-DD），限制数据的时间范围
        start_date = (request.args.get("start_date") or "").strip() or None
        
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
                base_where = "user_id = %s" if user_id else "username = %s"
                base_param = user_id if user_id else username
                
                # 添加时间范围过滤
                time_filter = ""
                params = [base_param]
                
                if start_date:
                    time_filter = " AND created_at >= %s"
                    params.append(f"{start_date} 00:00:00")
                
                query = f"""
                    SELECT id, user_id, username, file_name, created_at, 
                           SUBSTRING(content, 1, 200) as content_preview
                    FROM {table_name} 
                    WHERE {base_where}{time_filter}
                    ORDER BY created_at DESC 
                    LIMIT %s
                """
                params.append(limit)
                
                logger.info("/getjson/%s executing query=%s params=%s", kind, query, params)
                logger.info("/getjson/%s start_date=%s", kind, start_date)
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

