"""
Created on October 12 2025
Author: JunxiBao
File: block.py
Description: User blocking system to prevent abusive users
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

logger = logging.getLogger("app.block")

block_blueprint = Blueprint("block", __name__)

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
    """Create blocked_users table if it doesn't exist"""
    ddl = """
    CREATE TABLE IF NOT EXISTS blocked_users (
        id VARCHAR(64) PRIMARY KEY,
        blocker_id VARCHAR(128) NOT NULL,
        blocked_id VARCHAR(128) NOT NULL,
        created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
        UNIQUE KEY unique_block (blocker_id, blocked_id),
        INDEX idx_blocker (blocker_id),
        INDEX idx_blocked (blocked_id)
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


@block_blueprint.route("/block/user", methods=["POST", "OPTIONS"])
def block_user():
    """Block a user"""
    if request.method == "OPTIONS":
        return "", 200
    
    try:
        body = request.get_json(silent=True) or {}
        logger.info("/block/user body_keys=%s", list(body.keys()))
        
        blocker_id = (body.get("blocker_id") or "").strip()
        blocked_id = (body.get("blocked_id") or "").strip()
        
        # Validation
        if not blocker_id:
            return jsonify({"success": False, "message": "缺少用户ID"}), 400
        
        if not blocked_id:
            return jsonify({"success": False, "message": "缺少被屏蔽用户ID"}), 400
        
        if blocker_id == blocked_id:
            return jsonify({"success": False, "message": "不能屏蔽自己"}), 400
        
        block_id = uuid.uuid4().hex
        
        conn = _get_conn()
        try:
            _ensure_table(conn)
            cur = conn.cursor()
            try:
                # Use INSERT IGNORE to handle duplicate blocks gracefully
                cur.execute(
                    """
                    INSERT IGNORE INTO blocked_users (id, blocker_id, blocked_id)
                    VALUES (%s, %s, %s)
                    """,
                    (block_id, blocker_id, blocked_id)
                )
                conn.commit()
                
                # Check if actually inserted (rowcount will be 0 if already exists)
                was_inserted = cur.rowcount > 0
            finally:
                cur.close()
        finally:
            conn.close()
        
        if was_inserted:
            return jsonify({
                "success": True,
                "message": "已屏蔽该用户",
                "data": {"block_id": block_id}
            })
        else:
            return jsonify({
                "success": True,
                "message": "该用户已经被屏蔽",
                "data": {"block_id": None}
            })
    
    except mysql_errors.Error as e:
        logger.exception("/block/user db error: %s", e)
        return jsonify({"success": False, "message": "数据库错误"}), 500
    except Exception as e:
        logger.exception("/block/user server error: %s", e)
        return jsonify({"success": False, "message": "服务器错误"}), 500


@block_blueprint.route("/block/unblock", methods=["POST", "OPTIONS"])
def unblock_user():
    """Unblock a user"""
    if request.method == "OPTIONS":
        return "", 200
    
    try:
        body = request.get_json(silent=True) or {}
        logger.info("/block/unblock body_keys=%s", list(body.keys()))
        
        blocker_id = (body.get("blocker_id") or "").strip()
        blocked_id = (body.get("blocked_id") or "").strip()
        
        # Validation
        if not blocker_id:
            return jsonify({"success": False, "message": "缺少用户ID"}), 400
        
        if not blocked_id:
            return jsonify({"success": False, "message": "缺少被屏蔽用户ID"}), 400
        
        conn = _get_conn()
        try:
            _ensure_table(conn)
            cur = conn.cursor()
            try:
                cur.execute(
                    """
                    DELETE FROM blocked_users
                    WHERE blocker_id = %s AND blocked_id = %s
                    """,
                    (blocker_id, blocked_id)
                )
                conn.commit()
                affected_rows = cur.rowcount
            finally:
                cur.close()
        finally:
            conn.close()
        
        if affected_rows > 0:
            return jsonify({"success": True, "message": "已取消屏蔽"})
        else:
            return jsonify({"success": True, "message": "该用户未被屏蔽"})
    
    except mysql_errors.Error as e:
        logger.exception("/block/unblock db error: %s", e)
        return jsonify({"success": False, "message": "数据库错误"}), 500
    except Exception as e:
        logger.exception("/block/unblock server error: %s", e)
        return jsonify({"success": False, "message": "服务器错误"}), 500


@block_blueprint.route("/block/list", methods=["POST", "OPTIONS"])
def list_blocked_users():
    """Get list of blocked users for a user"""
    if request.method == "OPTIONS":
        return "", 200
    
    try:
        payload = request.get_json(silent=True) or {}
        logger.info("/block/list body_keys=%s", list(payload.keys()))
        
        blocker_id = (payload.get("blocker_id") or "").strip()
        
        if not blocker_id:
            return jsonify({"success": False, "message": "缺少用户ID"}), 400
        
        conn = _get_conn()
        try:
            _ensure_table(conn)
            cur = conn.cursor(dictionary=True)
            try:
                cur.execute(
                    """
                    SELECT blocked_id, created_at
                    FROM blocked_users
                    WHERE blocker_id = %s
                    ORDER BY created_at DESC
                    """,
                    (blocker_id,)
                )
                rows = cur.fetchall()
            finally:
                cur.close()
        finally:
            conn.close()
        
        # Format results
        blocked_users = []
        for r in rows:
            blocked_users.append({
                "user_id": r.get("blocked_id"),
                "blocked_at": r.get("created_at").isoformat() if r.get("created_at") else None
            })
        
        return jsonify({
            "success": True,
            "data": blocked_users,
            "count": len(blocked_users)
        })
    
    except mysql_errors.Error as e:
        logger.exception("/block/list db error: %s", e)
        return jsonify({"success": False, "message": "数据库错误"}), 500
    except Exception as e:
        logger.exception("/block/list server error: %s", e)
        return jsonify({"success": False, "message": "服务器错误"}), 500


@block_blueprint.route("/block/check", methods=["POST", "OPTIONS"])
def check_blocked():
    """Check if a user is blocked"""
    if request.method == "OPTIONS":
        return "", 200
    
    try:
        payload = request.get_json(silent=True) or {}
        logger.info("/block/check body_keys=%s", list(payload.keys()))
        
        blocker_id = (payload.get("blocker_id") or "").strip()
        blocked_id = (payload.get("blocked_id") or "").strip()
        
        if not blocker_id or not blocked_id:
            return jsonify({"success": False, "message": "缺少必要参数"}), 400
        
        conn = _get_conn()
        try:
            _ensure_table(conn)
            cur = conn.cursor()
            try:
                cur.execute(
                    """
                    SELECT COUNT(*) as count
                    FROM blocked_users
                    WHERE blocker_id = %s AND blocked_id = %s
                    """,
                    (blocker_id, blocked_id)
                )
                result = cur.fetchone()
                is_blocked = result[0] > 0 if result else False
            finally:
                cur.close()
        finally:
            conn.close()
        
        return jsonify({
            "success": True,
            "data": {"is_blocked": is_blocked}
        })
    
    except mysql_errors.Error as e:
        logger.exception("/block/check db error: %s", e)
        return jsonify({"success": False, "message": "数据库错误"}), 500
    except Exception as e:
        logger.exception("/block/check server error: %s", e)
        return jsonify({"success": False, "message": "服务器错误"}), 500

