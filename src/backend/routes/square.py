import os
import re
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


def _ensure_tables(conn):
    """Ensure square_posts table exists; add missing columns if needed."""
    ddl = (
        """
        CREATE TABLE IF NOT EXISTS square_posts (
            id VARCHAR(64) PRIMARY KEY,
            user_id VARCHAR(128) NULL,
            username VARCHAR(128) NULL,
            content_html LONGTEXT NOT NULL,
            images LONGTEXT NULL,
            created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
            INDEX idx_user_id (user_id),
            INDEX idx_username (username),
            INDEX idx_created_at (created_at)
        ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
        """
    )
    cur = conn.cursor()
    try:
        cur.execute(ddl)
        # Ensure users.avatar_url exists for avatar join (idempotent)
        try:
            cur.execute("SHOW COLUMNS FROM users LIKE 'avatar_url'")
            if not cur.fetchone():
                cur.execute("ALTER TABLE users ADD COLUMN avatar_url VARCHAR(500) NULL")
        except Exception:
            pass
        conn.commit()
    finally:
        try:
            cur.close()
        except Exception:
            pass


_SCRIPT_TAG_RE = re.compile(r"<\s*script[^>]*>.*?<\s*/\s*script\s*>", re.IGNORECASE | re.DOTALL)
_EVENT_HANDLER_RE = re.compile(r"\son[a-zA-Z]+\s*=\s*\"[^\"]*\"|\son[a-zA-Z]+\s*=\s*'[^']*'|\son[a-zA-Z]+\s*=\s*[^\s>]+", re.IGNORECASE)
_JS_PROTOCOL_RE = re.compile(r"(href|src)\s*=\s*(['\"])\s*javascript:.*?\2", re.IGNORECASE)


def _sanitize_html(html_text: str) -> str:
    """Very small sanitizer: strip <script>, inline event handlers, javascript: URLs.
    Note: Keep basic formatting tags (b, i, u, span with style), imgs with http(s)/data urls.
    """
    if not html_text:
        return ""
    # Hard-cap size to avoid abuse
    if len(html_text) > 20000:
        html_text = html_text[:20000]
    cleaned = _SCRIPT_TAG_RE.sub("", html_text)
    cleaned = _EVENT_HANDLER_RE.sub("", cleaned)
    cleaned = _JS_PROTOCOL_RE.sub("", cleaned)
    return cleaned


@square_blueprint.route("/square/post", methods=["POST", "OPTIONS"])
def create_post():
    if request.method == "OPTIONS":
        return "", 200
    try:
        data = request.get_json(silent=True) or {}
        logger.info("/square/post body_keys=%s", list(data.keys()))

        user_id = (data.get("user_id") or "").strip() or None
        username = (data.get("username") or "").strip() or None
        content_html = (data.get("content_html") or "").strip()
        images = data.get("images")  # optional list[str]

        if not user_id and not username:
            return jsonify({"success": False, "message": "缺少用户标识（user_id 或 username）"}), 400
        if not content_html:
            return jsonify({"success": False, "message": "内容不能为空"}), 400

        safe_html = _sanitize_html(content_html)
        images_json = None
        if isinstance(images, list):
            try:
                # Keep at most 9 images
                images = images[:9]
                images_json = json.dumps(images, ensure_ascii=False, separators=(",", ":"))
            except Exception:
                images_json = None

        conn = _get_conn()
        try:
            _ensure_tables(conn)
            cur = conn.cursor()
            try:
                post_id = uuid.uuid4().hex
                sql = (
                    "INSERT INTO square_posts (id, user_id, username, content_html, images, created_at) "
                    "VALUES (%s, %s, %s, %s, %s, %s)"
                )
                cur.execute(sql, (post_id, user_id, username, safe_html, images_json, datetime.utcnow()))
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

        return jsonify({
            "success": True,
            "message": "发布成功",
            "data": {"id": post_id}
        })
    except mysql_errors.Error as e:
        logger.exception("/square/post db error: %s", e)
        return jsonify({"success": False, "message": "数据库错误", "error": str(e)}), 500
    except Exception as e:
        logger.exception("/square/post server error: %s", e)
        return jsonify({"success": False, "message": "服务器错误", "error": str(e)}), 500


@square_blueprint.route("/square/list", methods=["GET", "OPTIONS"])
def list_posts():
    if request.method == "OPTIONS":
        return "", 200
    try:
        limit = request.args.get("limit", "50")
        try:
            limit = int(limit)
            if limit <= 0 or limit > 200:
                limit = 50
        except Exception:
            limit = 50

        conn = _get_conn()
        try:
            _ensure_tables(conn)
            cur = conn.cursor(dictionary=True)
            try:
                # Left join users twice: by user_id and by username; prefer user_id match
                query = (
                    """
                    SELECT p.id, p.user_id, p.username,
                           COALESCE(u1.username, u2.username, p.username) AS display_name,
                           COALESCE(u1.avatar_url, u2.avatar_url) AS avatar_url,
                           p.content_html, p.images, p.created_at
                    FROM square_posts p
                    LEFT JOIN users u1 ON (u1.user_id = p.user_id AND p.user_id IS NOT NULL)
                    LEFT JOIN users u2 ON (u2.username = p.username AND p.username IS NOT NULL)
                    ORDER BY p.created_at DESC
                    LIMIT %s
                    """
                )
                cur.execute(query, (limit,))
                rows = cur.fetchall() or []

                for row in rows:
                    # Normalize images
                    imgs = row.get("images")
                    try:
                        row["images"] = json.loads(imgs) if imgs else []
                    except Exception:
                        row["images"] = []

                return jsonify({
                    "success": True,
                    "data": rows,
                    "count": len(rows)
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
    except mysql_errors.Error as e:
        logger.exception("/square/list db error: %s", e)
        return jsonify({"success": False, "message": "数据库错误", "error": str(e)}), 500
    except Exception as e:
        logger.exception("/square/list server error: %s", e)
        return jsonify({"success": False, "message": "服务器错误", "error": str(e)}), 500


