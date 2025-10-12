"""
Created on October 12 2025
Author: JunxiBao
File: report.py
Description: Content reporting system for square posts and comments
"""
import os
import uuid
import logging
from datetime import datetime

from dotenv import load_dotenv
from flask import Blueprint, request, jsonify
import mysql.connector
from mysql.connector import errors as mysql_errors

load_dotenv()

logger = logging.getLogger("app.report")

report_blueprint = Blueprint("report", __name__)

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


def _ensure_table(conn):
    """Create reports table if it doesn't exist"""
    ddl = """
    CREATE TABLE IF NOT EXISTS content_reports (
        id VARCHAR(64) PRIMARY KEY,
        reporter_id VARCHAR(128) NOT NULL,
        content_type ENUM('post', 'comment') NOT NULL,
        content_id VARCHAR(64) NOT NULL,
        reported_user_id VARCHAR(128) NULL,
        reason VARCHAR(50) NOT NULL,
        details TEXT NULL,
        status ENUM('pending', 'reviewed', 'resolved', 'dismissed') DEFAULT 'pending',
        created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
        INDEX idx_reporter (reporter_id),
        INDEX idx_content (content_type, content_id),
        INDEX idx_reported_user (reported_user_id),
        INDEX idx_status (status),
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


@report_blueprint.route("/report/content", methods=["POST", "OPTIONS"])
def report_content():
    """Report a post or comment"""
    if request.method == "OPTIONS":
        return "", 200
    
    try:
        body = request.get_json(silent=True) or {}
        logger.info("/report/content body_keys=%s", list(body.keys()))
        
        reporter_id = (body.get("reporter_id") or "").strip()
        content_type = (body.get("content_type") or "").strip()  # 'post' or 'comment'
        content_id = (body.get("content_id") or "").strip()
        reported_user_id = (body.get("reported_user_id") or "").strip() or None
        reason = (body.get("reason") or "").strip()
        details = (body.get("details") or "").strip() or None
        
        # Validation
        if not reporter_id:
            return jsonify({"success": False, "message": "缺少举报人ID"}), 400
        
        if content_type not in ['post', 'comment']:
            return jsonify({"success": False, "message": "无效的内容类型"}), 400
        
        if not content_id:
            return jsonify({"success": False, "message": "缺少内容ID"}), 400
        
        if not reason:
            return jsonify({"success": False, "message": "请选择举报原因"}), 400
        
        # Valid reasons
        valid_reasons = [
            'spam', 'harassment', 'hate_speech', 'violence', 
            'adult_content', 'misleading', 'privacy_violation', 'other'
        ]
        if reason not in valid_reasons:
            return jsonify({"success": False, "message": "无效的举报原因"}), 400
        
        report_id = uuid.uuid4().hex
        
        conn = _get_conn()
        try:
            _ensure_table(conn)
            
            # Check if user has already reported this content
            cur = conn.cursor(dictionary=True)
            try:
                cur.execute(
                    """
                    SELECT id FROM content_reports 
                    WHERE reporter_id = %s AND content_type = %s AND content_id = %s
                    """,
                    (reporter_id, content_type, content_id)
                )
                existing = cur.fetchone()
                
                if existing:
                    return jsonify({
                        "success": False, 
                        "message": "您已经举报过此内容"
                    }), 400
                
                # Insert new report
                cur.execute(
                    """
                    INSERT INTO content_reports 
                    (id, reporter_id, content_type, content_id, reported_user_id, reason, details, status)
                    VALUES (%s, %s, %s, %s, %s, %s, %s, 'pending')
                    """,
                    (report_id, reporter_id, content_type, content_id, reported_user_id, reason, details)
                )
                conn.commit()
            finally:
                cur.close()
        finally:
            conn.close()
        
        return jsonify({
            "success": True,
            "message": "举报已提交，感谢您的反馈",
            "data": {"report_id": report_id}
        })
    
    except mysql_errors.Error as e:
        logger.exception("/report/content db error: %s", e)
        return jsonify({"success": False, "message": "数据库错误"}), 500
    except Exception as e:
        logger.exception("/report/content server error: %s", e)
        return jsonify({"success": False, "message": "服务器错误"}), 500


@report_blueprint.route("/report/list", methods=["POST", "OPTIONS"])
def list_reports():
    """List all reports (admin endpoint)"""
    if request.method == "OPTIONS":
        return "", 200
    
    try:
        payload = request.get_json(silent=True) or {}
        logger.info("/report/list body_keys=%s", list(payload.keys()))
        
        status = payload.get("status")  # Optional filter by status
        limit = min(int(payload.get("limit", 50)), 200)
        
        conn = _get_conn()
        try:
            _ensure_table(conn)
            cur = conn.cursor(dictionary=True)
            try:
                if status:
                    cur.execute(
                        """
                        SELECT id, reporter_id, content_type, content_id, reported_user_id, 
                               reason, details, status, created_at
                        FROM content_reports
                        WHERE status = %s
                        ORDER BY created_at DESC
                        LIMIT %s
                        """,
                        (status, limit)
                    )
                else:
                    cur.execute(
                        """
                        SELECT id, reporter_id, content_type, content_id, reported_user_id, 
                               reason, details, status, created_at
                        FROM content_reports
                        ORDER BY created_at DESC
                        LIMIT %s
                        """,
                        (limit,)
                    )
                
                rows = cur.fetchall()
            finally:
                cur.close()
        finally:
            conn.close()
        
        # Format results
        reports = []
        for r in rows:
            reports.append({
                "id": r.get("id"),
                "reporter_id": r.get("reporter_id"),
                "content_type": r.get("content_type"),
                "content_id": r.get("content_id"),
                "reported_user_id": r.get("reported_user_id"),
                "reason": r.get("reason"),
                "details": r.get("details"),
                "status": r.get("status"),
                "created_at": r.get("created_at").isoformat() if r.get("created_at") else None
            })
        
        return jsonify({"success": True, "data": reports, "count": len(reports)})
    
    except mysql_errors.Error as e:
        logger.exception("/report/list db error: %s", e)
        return jsonify({"success": False, "message": "数据库错误"}), 500
    except Exception as e:
        logger.exception("/report/list server error: %s", e)
        return jsonify({"success": False, "message": "服务器错误"}), 500

