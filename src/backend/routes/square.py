"""
Created on Thu Oct 09 2025
Author: JunxiBao
File: square.py
Description: Square (广场) posts backend routes: create table, publish and list posts
"""
import os
import uuid
import json
import logging
from datetime import datetime

from dotenv import load_dotenv
from flask import Blueprint, request, jsonify
import mysql.connector
from mysql.connector import errors as mysql_errors

load_dotenv()

logger = logging.getLogger("app.square")

square_blueprint = Blueprint("square", __name__)

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
    ddl = """
    CREATE TABLE IF NOT EXISTS square_posts (
        id VARCHAR(64) PRIMARY KEY,
        user_id VARCHAR(128) NULL,
        username VARCHAR(128) NULL,
        avatar_url VARCHAR(500) NULL,
        text_content VARCHAR(1000) NULL,
        image_urls JSON NULL,
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


@square_blueprint.route("/square/list", methods=["POST", "OPTIONS"])
def list_posts():
    if request.method == "OPTIONS":
        return "", 200
    try:
        payload = request.get_json(silent=True) or {}
        logger.info("/square/list body_keys=%s", list(payload.keys()))

        # pagination params
        limit = payload.get("limit") or 15
        try:
            limit = int(limit)
        except Exception:
            limit = 15
        limit = max(1, min(50, limit))

        offset = payload.get("offset") or 0
        try:
            offset = int(offset)
        except Exception:
            offset = 0
        offset = max(0, offset)

        conn = _get_conn()
        try:
            _ensure_table(conn)
            cur = conn.cursor(dictionary=True)
            try:
                cur.execute(
                    """
                    SELECT id, user_id, username, avatar_url, text_content, image_urls, created_at
                    FROM square_posts
                    ORDER BY created_at DESC
                    LIMIT %s OFFSET %s
                    """,
                    (limit, offset),
                )
                rows = cur.fetchall()
            finally:
                cur.close()
        finally:
            conn.close()

        # Normalize records
        records = []
        for r in rows:
            images = r.get("image_urls")
            if isinstance(images, str):
                try:
                    images = json.loads(images)
                except Exception:
                    images = []
            records.append(
                {
                    "id": r.get("id"),
                    "user_id": r.get("user_id"),
                    "username": r.get("username"),
                    "avatar_url": r.get("avatar_url"),
                    "text": r.get("text_content") or "",
                    "images": images or [],
                    "created_at": r.get("created_at").isoformat() if r.get("created_at") else None,
                }
            )

        has_more = len(rows) == limit
        next_offset = offset + len(rows)
        return jsonify({
            "success": True,
            "data": records,
            "count": len(records),
            "has_more": has_more,
            "next_offset": next_offset
        })

    except mysql_errors.Error as e:
        if getattr(e, "errno", None) in (3024, 1205, 1213):
            logger.warning("/square/list db timeout/deadlock errno=%s msg=%s", getattr(e, "errno", None), str(e))
            return jsonify({"success": False, "message": "数据库超时或死锁，请稍后重试"}), 504
        logger.exception("/square/list db error: %s", e)
        return jsonify({"success": False, "message": "数据库错误", "error": str(e)}), 500
    except Exception as e:
        logger.exception("/square/list server error: %s", e)
        return jsonify({"success": False, "message": "服务器错误", "error": str(e)}), 500


@square_blueprint.route("/square/publish", methods=["POST", "OPTIONS"])
def publish_post():
    if request.method == "OPTIONS":
        return "", 200
    try:
        body = request.get_json(silent=True) or {}
        logger.info("/square/publish body_keys=%s", list(body.keys()))

        user_id = (body.get("user_id") or "").strip() or None
        username = (body.get("username") or "").strip() or None
        avatar_url = (body.get("avatar_url") or "").strip() or None
        text_content = (body.get("text") or body.get("text_content") or "").strip() or None
        images = body.get("images") or []

        if not (user_id or username):
            return jsonify({"success": False, "message": "缺少用户标识"}), 400

        if (not text_content) and (not images):
            return jsonify({"success": False, "message": "内容不能为空"}), 400

        # Ensure images is JSON-serializable list of strings
        safe_images = []
        if isinstance(images, list):
            for it in images:
                if isinstance(it, str) and it:
                    safe_images.append(it)

        post_id = uuid.uuid4().hex

        conn = _get_conn()
        try:
            _ensure_table(conn)
            cur = conn.cursor()
            try:
                cur.execute(
                    """
                    INSERT INTO square_posts (id, user_id, username, avatar_url, text_content, image_urls)
                    VALUES (%s, %s, %s, %s, %s, %s)
                    """,
                    (post_id, user_id, username, avatar_url, text_content, json.dumps(safe_images, ensure_ascii=False)),
                )
                conn.commit()
            finally:
                cur.close()
        finally:
            conn.close()

        return jsonify({
            "success": True,
            "message": "发布成功",
            "data": {"id": post_id}
        })

    except mysql_errors.Error as e:
        if getattr(e, "errno", None) in (3024, 1205, 1213):
            logger.warning("/square/publish db timeout/deadlock errno=%s msg=%s", getattr(e, "errno", None), str(e))
            return jsonify({"success": False, "message": "数据库超时或死锁，请稍后重试"}), 504
        logger.exception("/square/publish db error: %s", e)
        return jsonify({"success": False, "message": "数据库错误", "error": str(e)}), 500
    except Exception as e:
        logger.exception("/square/publish server error: %s", e)
        return jsonify({"success": False, "message": "服务器错误", "error": str(e)}), 500


