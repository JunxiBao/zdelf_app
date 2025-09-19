import os
import uuid
import json
import logging
from datetime import datetime
from typing import Optional

from dotenv import load_dotenv
from flask import Blueprint, request, jsonify
import mysql.connector
from mysql.connector import errors as mysql_errors

load_dotenv()

logger = logging.getLogger("app.uploadjson")

uploadjson_blueprint = Blueprint("uploadjson", __name__)

DB_CONFIG = {
    "host": os.getenv("DB_HOST"),
    "user": os.getenv("DB_USER"),
    "password": os.getenv("DB_PASSWORD"),
    "database": os.getenv("DB_NAME"),
}


def _get_conn():
    conn = mysql.connector.connect(**DB_CONFIG, connection_timeout=5, autocommit=False)
    cur = conn.cursor()
    try:
        cur.execute("SET SESSION MAX_EXECUTION_TIME=15000")
    finally:
        cur.close()
    return conn


KIND_TO_TABLE = {
    "metrics": "metrics_files",
    "diet": "diet_files",
    "case": "case_files",
}

def _analyze_data_type(content: dict) -> str:
    """
    自动分析数据类型并返回对应的表类型
    根据数据内容特征判断是健康指标、饮食记录还是病例记录
    """
    try:
        # 检查是否有exportInfo字段
        export_info = content.get('exportInfo', {})
        data_type = export_info.get('dataType', '')
        
        # 根据dataType字段判断
        if data_type == 'health_metrics':
            return 'metrics'
        elif data_type == 'diet_record':
            return 'diet'
        elif data_type == 'case_record':
            return 'case'
        
        # 如果没有dataType字段，根据数据结构特征判断
        if 'metricsData' in content:
            return 'metrics'
        elif 'dietData' in content:
            return 'diet'
        elif 'caseData' in content:
            return 'case'
        
        # 根据数据内容特征进一步判断
        content_str = json.dumps(content, ensure_ascii=False).lower()
        
        # 健康指标特征关键词
        metrics_keywords = [
            'symptoms', 'temperature', 'urinalysis', 'blood-test',
            'bleeding-point', 'self-rating', 'proteinuria', 'urinalysis-matrix',
            '症状', '体温', '尿常规', '血常规', '出血点', '自我评分'
        ]
        
        # 饮食记录特征关键词
        diet_keywords = [
            'meal', 'food', 'time', 'breakfast', 'lunch', 'dinner',
            '餐', '食物', '时间', '早餐', '午餐', '晚餐'
        ]
        
        # 病例记录特征关键词
        case_keywords = [
            'diagnosis', 'treatment', 'medication', 'doctor', 'hospital',
            '诊断', '治疗', '药物', '医生', '医院'
        ]
        
        # 计算匹配度
        metrics_score = sum(1 for keyword in metrics_keywords if keyword in content_str)
        diet_score = sum(1 for keyword in diet_keywords if keyword in content_str)
        case_score = sum(1 for keyword in case_keywords if keyword in content_str)
        
        # 返回得分最高的类型
        if metrics_score > diet_score and metrics_score > case_score:
            return 'metrics'
        elif diet_score > case_score:
            return 'diet'
        elif case_score > 0:
            return 'case'
        else:
            # 默认返回metrics
            return 'metrics'
            
    except Exception as e:
        logger.warning(f"分析数据类型失败: {e}")
        return 'metrics'  # 默认返回健康指标


def _ensure_table(conn, table_name: str) -> None:
    ddl = f"""
    CREATE TABLE IF NOT EXISTS {table_name} (
        id VARCHAR(64) PRIMARY KEY,
        user_id VARCHAR(128) NULL,
        username VARCHAR(128) NULL,
        file_name VARCHAR(255) NOT NULL,
        content LONGTEXT NOT NULL,
        created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
        INDEX idx_user_id (user_id),
        INDEX idx_username (username),
        INDEX idx_created_at (created_at)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
    """
    cur = conn.cursor()
    try:
        cur.execute(ddl)
        conn.commit()
    finally:
        try:
            cur.close()
        except Exception:
            pass


def _parse_kind(kind: str) -> Optional[str]:
    kind = (kind or "").strip().lower()
    return kind if kind in KIND_TO_TABLE else None


def _generate_file_name(username: Optional[str], user_id: Optional[str], kind: str) -> str:
    base = username or user_id or "unknown"
    ts = datetime.utcnow().strftime("%Y%m%dT%H%M%SZ")
    return f"{base}_{kind}_{ts}.json"


def _safe_json_dumps(obj) -> str:
    try:
        return json.dumps(obj, ensure_ascii=False, separators=(",", ":"))
    except Exception:
        return str(obj)


@uploadjson_blueprint.route("/uploadjson/auto", methods=["POST", "OPTIONS"])  # 自动分析数据类型
def upload_json_auto():
    """自动分析数据类型并存储到相应表"""
    if request.method == "OPTIONS":
        return "", 200

    try:
        data = request.get_json(silent=True) or {}
        logger.info("/uploadjson/auto body=%s", (str(data)[:800] + "...") if len(str(data)) > 800 else data)

        user_id = (data.get("user_id") or "").strip() or None
        username = (data.get("username") or "").strip() or None
        content = data.get("content")
        custom_file_name = (data.get("file_name") or "").strip() or None

        if not content:
            return jsonify({"success": False, "message": "缺少 content 数据"}), 400

        # 解析content（可能是字符串或字典）
        if isinstance(content, str):
            try:
                content_dict = json.loads(content)
            except json.JSONDecodeError:
                return jsonify({"success": False, "message": "content 不是有效的JSON格式"}), 400
        else:
            content_dict = content

        # 自动分析数据类型
        detected_kind = _analyze_data_type(content_dict)
        logger.info(f"自动检测到数据类型: {detected_kind}")

        # 生成文件名
        if custom_file_name:
            file_name = custom_file_name
        else:
            timestamp = datetime.now().strftime("%Y%m%d_%H%M%S")
            file_name = f"{detected_kind}_{timestamp}.json"

        # 生成唯一ID
        file_id = str(uuid.uuid4())

        # 获取对应的表名
        table_name = KIND_TO_TABLE[detected_kind]

        # 存储到数据库
        conn = _get_conn()
        try:
            _ensure_table(conn, table_name)
            cur = conn.cursor()
            try:
                content_json = json.dumps(content_dict, ensure_ascii=False, separators=(",", ":"))
                cur.execute(
                    f"INSERT INTO {table_name} (id, user_id, username, file_name, content) VALUES (%s, %s, %s, %s, %s)",
                    (file_id, user_id, username, file_name, content_json),
                )
                conn.commit()
                logger.info(f"数据已存储到表 {table_name}, ID: {file_id}")
            finally:
                cur.close()
        finally:
            conn.close()

        return jsonify({
            "success": True,
            "message": f"数据已自动分析并存储为 {detected_kind} 类型",
            "data": {
                "file_id": file_id,
                "detected_type": detected_kind,
                "table_name": table_name,
                "file_name": file_name
            }
        })

    except Exception as e:
        logger.exception("/uploadjson/auto server error: %s", e)
        return jsonify({"success": False, "message": "服务器错误", "error": str(e)}), 500


@uploadjson_blueprint.route("/uploadjson/<kind>", methods=["POST", "OPTIONS"])  # kind: metrics|diet|case
def upload_json(kind):
    if request.method == "OPTIONS":
        return "", 200

    try:
        kind = _parse_kind(kind)
        if not kind:
            return jsonify({"success": False, "message": "非法的类型（仅支持 metrics/diet/case）"}), 400

        data = request.get_json(silent=True) or {}
        logger.info("/uploadjson/%s body=%s", kind, (str(data)[:800] + "...") if len(str(data)) > 800 else data)

        user_id = (data.get("user_id") or "").strip() or None
        username = (data.get("username") or "").strip() or None
        payload = data.get("payload")
        custom_file_name = (data.get("file_name") or "").strip() or None

        if payload is None:
            return jsonify({"success": False, "message": "缺少 payload(JSON)"}), 400

        payload_text = _safe_json_dumps(payload)
        if len(payload_text.encode("utf-8")) > 2 * 1024 * 1024:
            return jsonify({"success": False, "message": "JSON 体积过大（>2MB）"}), 413

        table_name = KIND_TO_TABLE[kind]

        conn = _get_conn()
        try:
            _ensure_table(conn, table_name)

            rec_id = uuid.uuid4().hex
            file_name = custom_file_name or _generate_file_name(username, user_id, kind)

            cur = conn.cursor()
            try:
                sql = f"INSERT INTO {table_name} (id, user_id, username, file_name, content) VALUES (%s, %s, %s, %s, %s)"
                cur.execute(sql, (rec_id, user_id, username, file_name, payload_text))
                conn.commit()
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

        return jsonify({"success": True, "message": "上传成功", "id": rec_id, "file_name": file_name, "kind": kind})

    except mysql_errors.Error as e:
        logger.exception("/uploadjson db error: %s", e)
        return jsonify({"success": False, "message": "数据库错误", "error": str(e)}), 500
    except Exception as e:
        logger.exception("/uploadjson server error: %s", e)
        return jsonify({"success": False, "message": "服务器错误", "error": str(e)}), 500


@uploadjson_blueprint.route("/uploadjson/<kind>/list", methods=["GET", "OPTIONS"])  # 按用户列出
def list_user_files(kind):
    if request.method == "OPTIONS":
        return "", 200

    try:
        kind = _parse_kind(kind)
        if not kind:
            return jsonify({"success": False, "message": "非法的类型（仅支持 metrics/diet/case）"}), 400

        user_id = (request.args.get("user_id") or "").strip() or None
        username = (request.args.get("username") or "").strip() or None
        if not user_id and not username:
            return jsonify({"success": False, "message": "缺少用户标识（user_id 或 username）"}), 400

        table_name = KIND_TO_TABLE[kind]
        conn = _get_conn()
        try:
            _ensure_table(conn, table_name)
            cur = conn.cursor(dictionary=True)
            try:
                if user_id:
                    cur.execute(
                        f"SELECT id, user_id, username, file_name, created_at FROM {table_name} WHERE user_id=%s ORDER BY created_at DESC LIMIT 500",
                        (user_id,),
                    )
                else:
                    cur.execute(
                        f"SELECT id, user_id, username, file_name, created_at FROM {table_name} WHERE username=%s ORDER BY created_at DESC LIMIT 500",
                        (username,),
                    )
                rows = cur.fetchall()
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

        return jsonify({"success": True, "data": rows or []})

    except mysql_errors.Error as e:
        logger.exception("/uploadjson list db error: %s", e)
        return jsonify({"success": False, "message": "数据库错误", "error": str(e)}), 500
    except Exception as e:
        logger.exception("/uploadjson list server error: %s", e)
        return jsonify({"success": False, "message": "服务器错误", "error": str(e)}), 500


@uploadjson_blueprint.route("/uploadjson/<kind>/<file_id>", methods=["GET", "OPTIONS"])  # 获取单条
def get_file(kind, file_id):
    if request.method == "OPTIONS":
        return "", 200

    try:
        kind = _parse_kind(kind)
        if not kind:
            return jsonify({"success": False, "message": "非法的类型（仅支持 metrics/diet/case）"}), 400

        table_name = KIND_TO_TABLE[kind]
        conn = _get_conn()
        try:
            _ensure_table(conn, table_name)
            cur = conn.cursor(dictionary=True)
            try:
                cur.execute(
                    f"SELECT id, user_id, username, file_name, content, created_at FROM {table_name} WHERE id=%s LIMIT 1",
                    (file_id,),
                )
                row = cur.fetchone()
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

        if not row:
            return jsonify({"success": False, "message": "未找到记录"}), 404

        try:
            row["content"] = json.loads(row.get("content") or "{}")
        except Exception:
            pass

        return jsonify({"success": True, "data": row})

    except mysql_errors.Error as e:
        logger.exception("/uploadjson get db error: %s", e)
        return jsonify({"success": False, "message": "数据库错误", "error": str(e)}), 500
    except Exception as e:
        logger.exception("/uploadjson get server error: %s", e)
        return jsonify({"success": False, "message": "服务器错误", "error": str(e)}), 500


