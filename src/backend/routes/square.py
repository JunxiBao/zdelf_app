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
import re
from datetime import datetime

from dotenv import load_dotenv
from flask import Blueprint, request, jsonify
import mysql.connector
from mysql.connector import errors as mysql_errors
import requests

load_dotenv()

logger = logging.getLogger("app.square")

square_blueprint = Blueprint("square", __name__)

# DeepSeek API 配置（用于内容审核）
DEEPSEEK_API_KEY = os.getenv('DEEPSEEK_API_KEY')
DEEPSEEK_API_URL = 'https://api.deepseek.com/v1/chat/completions'
CONNECT_TIMEOUT = 5
READ_TIMEOUT = 10

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


def _check_content_moderation(content):
    """
    使用 AI 审核内容，检查是否包含非法内容或辱骂性词语
    返回: (is_safe: bool, reason: str)
    """
    if not content or not content.strip():
        return True, ""
    
    # 首先进行简单的关键词过滤（备用机制，确保基本防护）
    # 注意：这些是明显的辱骂性词语，即使AI审核失败也能拦截
    banned_keywords = [
        '傻逼', 'sb', '草泥马', '操', 'fuck', 'shit', '去死', '滚', 
        '垃圾', '白痴', '智障', '脑残', '弱智', '蠢货', '傻x', '傻X'
    ]
    content_lower = content.lower()
    for keyword in banned_keywords:
        # 使用更精确的匹配，避免误判（例如"死"这个词单独出现时）
        if keyword.lower() in content_lower:
            logger.warning(f"Content moderation: banned keyword detected: {keyword} in content: {content[:50]}")
            return False, f"检测到违规词语「{keyword}」：包含不当用语"
    
    if not DEEPSEEK_API_KEY:
        logger.error("DEEPSEEK_API_KEY not configured! Content moderation will use keyword filter only.")
        # 如果未配置 API key，只使用关键词过滤（已经在上面完成）
        return True, ""
    
    try:
        system_prompt = """你是一个内容审核助手。请仔细检查用户提交的内容，判断是否包含以下违规内容：
1. 非法内容（如色情、暴力、恐怖主义、毒品等）
2. 辱骂性词语或人身攻击
3. 仇恨言论或歧视性内容
4. 虚假信息或谣言
5. 其他违反法律法规或社会公德的内容

请用简洁的中文回答，格式如下：
- 如果内容安全，只回答：安全
- 如果内容违规，回答：违规：[具体违规的词语或短语]，[违规类型说明]

例如：
- 违规：傻逼，包含辱骂性词语
- 违规：去死，包含人身攻击
- 违规：色情内容，包含不当信息

重要：必须明确指出具体违规的词语或短语，这样用户才能知道哪里有问题。"""
        
        data = {
            "model": "deepseek-chat",
            "messages": [
                {"role": "system", "content": system_prompt},
                {"role": "user", "content": f"请审核以下内容：\n\n{content}"}
            ],
            "temperature": 0.3,
            "max_tokens": 100  # 增加token数量以支持返回具体违规词语
        }
        
        headers = {
            'Content-Type': 'application/json',
            'Authorization': f'Bearer {DEEPSEEK_API_KEY}'
        }
        
        response = requests.post(
            DEEPSEEK_API_URL,
            headers=headers,
            json=data,
            timeout=(CONNECT_TIMEOUT, READ_TIMEOUT)
        )
        
        if response.status_code != 200:
            error_detail = ""
            try:
                error_detail = response.text[:200]
            except:
                pass
            logger.error(f"Content moderation API error: status={response.status_code}, detail={error_detail}")
            # API 错误时，如果关键词过滤已通过，则允许通过（避免影响用户体验）
            # 但会记录错误日志，提醒管理员检查API配置
            return True, ""
        
        try:
            result = response.json()
        except json.JSONDecodeError as e:
            logger.error(f"Content moderation API JSON decode error: {e}, response text: {response.text[:200]}")
            # JSON解析错误时，关键词过滤已在函数开头完成
            return True, ""
        
        # 检查API返回结构
        if 'choices' not in result or not result.get('choices'):
            logger.error(f"Content moderation API returned invalid structure: {result}")
            # 如果API返回结构异常，关键词过滤已在函数开头完成
            return True, ""
        
        reply = result.get('choices', [{}])[0].get('message', {}).get('content', '').strip()
        
        if not reply:
            logger.error(f"Content moderation API returned empty reply: {result}")
            # 如果返回为空，关键词过滤已在函数开头完成
            return True, ""
        
        logger.info(f"Content moderation API result for content '{content[:30]}...': {reply}")
        
        # 严格检查回复格式
        reply_lower = reply.lower()
        if '安全' in reply or reply_lower.startswith('safe') or reply_lower == '安全':
            return True, ""
        elif '违规' in reply or reply_lower.startswith('violat') or '不通过' in reply or '拒绝' in reply:
            # 提取违规原因，格式：违规：[具体词语]，[说明]
            # 移除"违规"关键词
            reason_part = reply.replace('违规', '').strip()
            
            # 处理不同的分隔符格式
            # 优先处理冒号格式：违规：词语，说明
            if '：' in reason_part or ':' in reason_part:
                # 格式：违规：词语，说明 或 违规：词语:说明
                parts = reason_part.replace('：', ':').split(':', 1)  # 只分割第一个冒号
                if len(parts) >= 2:
                    # 提取具体违规词语和说明
                    violation_word = parts[0].strip()
                    violation_type = parts[1].replace('，', '').replace(',', '').strip()
                    if violation_word and violation_type:
                        reason = f"检测到违规词语「{violation_word}」：{violation_type}"
                    elif violation_word:
                        reason = f"检测到违规词语「{violation_word}」"
                    else:
                        reason = violation_type if violation_type else "内容包含不当信息"
                else:
                    reason = reason_part.replace('，', '').replace(',', '').strip()
            elif '，' in reason_part or ',' in reason_part:
                # 格式：违规，词语，说明
                parts = reason_part.split('，' if '，' in reason_part else ',', 1)
                if len(parts) >= 2:
                    violation_word = parts[0].strip()
                    violation_type = parts[1].strip()
                    if violation_word and violation_type:
                        reason = f"检测到违规词语「{violation_word}」：{violation_type}"
                    elif violation_word:
                        reason = f"检测到违规词语「{violation_word}」"
                    else:
                        reason = violation_type if violation_type else "内容包含不当信息"
                else:
                    reason = reason_part.replace('，', '').replace(',', '').strip()
            else:
                # 格式：违规 词语 说明（空格分隔）
                reason = reason_part.strip()
                # 如果包含引号，尝试提取引号内的内容作为违规词语
                if '"' in reason or '"' in reason or '「' in reason or '」' in reason:
                    # 提取引号或书名号内的内容
                    matches = re.findall(r'[""「]([^""」]+)[""」]', reason)
                    if matches:
                        violation_word = matches[0]
                        reason = f"检测到违规词语「{violation_word}」"
            
            # 如果原因为空或太短，使用默认原因
            if not reason or len(reason) < 2:
                reason = "内容包含不当信息，请检查是否有违规词语"
            return False, reason
        else:
            # 如果返回格式不符合预期，为了安全起见，进行二次判断
            # 检查回复中是否包含明显的安全词汇
            safe_keywords = ['安全', '通过', '可以', '允许', 'safe', 'pass', 'ok', '正常']
            unsafe_keywords = ['违规', '不通过', '拒绝', '禁止', 'violat', 'reject', '禁止']
            
            reply_clean = reply.strip()
            # 如果包含不安全关键词，拒绝通过
            if any(keyword in reply_clean for keyword in unsafe_keywords):
                logger.warning(f"Content moderation: unsafe keywords found in reply, rejecting: {reply}")
                return False, "内容包含不当信息，请修改后重试"
            # 如果包含安全关键词，允许通过
            elif any(keyword in reply_clean for keyword in safe_keywords):
                logger.info(f"Content moderation: safe keywords found, allowing: {reply}")
                return True, ""
            else:
                # 如果格式不符合预期且没有明确的安全/不安全词汇，为了安全起见，拒绝通过
                logger.warning(f"Unexpected moderation result format, rejecting for safety: {reply}")
                return False, "内容审核结果不明确，请修改后重试"
            
    except requests.exceptions.Timeout:
        logger.error("Content moderation API timeout - content will be checked by keyword filter only")
        # 超时时，关键词过滤已在函数开头完成，如果通过则允许
        return True, ""
    except json.JSONDecodeError as e:
        logger.error(f"Content moderation API JSON decode error: {e}")
        # JSON解析错误时，使用关键词过滤结果
        return True, ""
    except Exception as e:
        logger.exception(f"Content moderation unexpected error: {e}")
        # 异常时，关键词过滤已在函数开头完成，如果通过则允许
        return True, ""


def _ensure_table(conn):
    # 创建广场消息表
    posts_ddl = """
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
    
    # 创建评论表
    comments_ddl = """
    CREATE TABLE IF NOT EXISTS square_comments (
        id VARCHAR(64) PRIMARY KEY,
        post_id VARCHAR(64) NOT NULL,
        parent_comment_id VARCHAR(64) NULL,
        user_id VARCHAR(128) NULL,
        username VARCHAR(128) NULL,
        avatar_url VARCHAR(500) NULL,
        text_content VARCHAR(500) NOT NULL,
        created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
        INDEX idx_post_id (post_id),
        INDEX idx_parent_comment_id (parent_comment_id),
        INDEX idx_user_id (user_id),
        INDEX idx_created_at (created_at),
        FOREIGN KEY (post_id) REFERENCES square_posts(id) ON DELETE CASCADE,
        FOREIGN KEY (parent_comment_id) REFERENCES square_comments(id) ON DELETE CASCADE
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
    """
    
    cur = conn.cursor()
    try:
        cur.execute(posts_ddl)
        cur.execute(comments_ddl)
        
        # 检查并添加parent_comment_id字段（如果不存在）
        try:
            cur.execute("ALTER TABLE square_comments ADD COLUMN parent_comment_id VARCHAR(64) NULL")
            cur.execute("ALTER TABLE square_comments ADD INDEX idx_parent_comment_id (parent_comment_id)")
            cur.execute("ALTER TABLE square_comments ADD FOREIGN KEY (parent_comment_id) REFERENCES square_comments(id) ON DELETE CASCADE")
        except mysql_errors.ProgrammingError as e:
            # 字段已存在，忽略错误
            if "Duplicate column name" not in str(e) and "Duplicate key name" not in str(e):
                raise
        
        # 检查并添加tags字段（如果不存在）
        try:
            cur.execute("ALTER TABLE square_posts ADD COLUMN tags JSON NULL")
        except mysql_errors.ProgrammingError as e:
            # 字段已存在，忽略错误
            if "Duplicate column name" not in str(e):
                raise
        
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

        limit = payload.get("limit") or 50
        current_user_id = payload.get("current_user_id")  # 当前用户ID，用于判断删除权限
        try:
            limit = int(limit)
        except Exception:
            limit = 50
        limit = max(1, min(200, limit))

        conn = _get_conn()
        try:
            _ensure_table(conn)
            cur = conn.cursor(dictionary=True)
            try:
                # 获取筛选tag
                filter_tag = payload.get("tag")
                
                # If current_user_id is provided, filter out posts from blocked users
                if current_user_id:
                    if filter_tag:
                        # 使用JSON_CONTAINS检查数组中是否包含指定tag，同时处理NULL情况
                        # JSON_CONTAINS检查字符串是否在JSON数组中
                        cur.execute(
                            """
                            SELECT p.id, p.user_id, p.username, p.avatar_url, p.text_content, p.image_urls, p.tags, p.created_at
                            FROM square_posts p
                            LEFT JOIN blocked_users b ON b.blocker_id = %s AND b.blocked_id = p.user_id
                            WHERE b.id IS NULL AND p.tags IS NOT NULL AND JSON_CONTAINS(p.tags, %s)
                            ORDER BY p.created_at DESC
                            LIMIT %s
                            """,
                            (current_user_id, json.dumps(filter_tag), limit),
                        )
                    else:
                        cur.execute(
                            """
                            SELECT p.id, p.user_id, p.username, p.avatar_url, p.text_content, p.image_urls, p.tags, p.created_at
                            FROM square_posts p
                            LEFT JOIN blocked_users b ON b.blocker_id = %s AND b.blocked_id = p.user_id
                            WHERE b.id IS NULL
                            ORDER BY p.created_at DESC
                            LIMIT %s
                            """,
                            (current_user_id, limit),
                        )
                else:
                    if filter_tag:
                        # 使用JSON_CONTAINS检查数组中是否包含指定tag，同时处理NULL情况
                        # JSON_CONTAINS检查字符串是否在JSON数组中
                        cur.execute(
                            """
                            SELECT id, user_id, username, avatar_url, text_content, image_urls, tags, created_at
                            FROM square_posts
                            WHERE tags IS NOT NULL AND JSON_CONTAINS(tags, %s)
                            ORDER BY created_at DESC
                            LIMIT %s
                            """,
                            (json.dumps(filter_tag), limit),
                        )
                    else:
                        cur.execute(
                            """
                            SELECT id, user_id, username, avatar_url, text_content, image_urls, tags, created_at
                            FROM square_posts
                            ORDER BY created_at DESC
                            LIMIT %s
                            """,
                            (limit,),
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
            
            tags = r.get("tags")
            if isinstance(tags, str):
                try:
                    tags = json.loads(tags)
                except Exception:
                    tags = []
            if not isinstance(tags, list):
                tags = []
            
            # 检查是否是匿名消息
            is_anonymous = r.get("username") == "匿名用户"
            
            # 如果是匿名消息且不是当前用户的消息，隐藏user_id
            if is_anonymous and r.get("user_id") != current_user_id:
                user_id = None
            else:
                user_id = r.get("user_id")
            
            records.append(
                {
                    "id": r.get("id"),
                    "user_id": user_id,  # 匿名消息且非当前用户时返回None
                    "username": r.get("username"),
                    "avatar_url": r.get("avatar_url"),
                    "text": r.get("text_content") or "",
                    "images": images or [],
                    "tags": tags or [],
                    "created_at": r.get("created_at").isoformat() if r.get("created_at") else None,
                }
            )

        return jsonify({"success": True, "data": records, "count": len(records)})

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
        tags = body.get("tags") or []

        # 检查是否是匿名发布（用户名为"匿名用户"）
        is_anonymous = username == "匿名用户"

        if not (user_id or username):
            return jsonify({"success": False, "message": "缺少用户标识"}), 400

        if (not text_content) and (not images):
            return jsonify({"success": False, "message": "内容不能为空"}), 400

        # AI 内容审核
        if text_content:
            logger.info(f"Content moderation check for post: {text_content[:50]}...")
            is_safe, reason = _check_content_moderation(text_content)
            logger.info(f"Content moderation result: is_safe={is_safe}, reason={reason}")
            if not is_safe:
                logger.warning(f"Content moderation failed for post: {text_content[:50]}..., reason: {reason}")
                return jsonify({
                    "success": False,
                    "message": f"内容审核未通过：{reason}，请修改后重新发布"
                }), 400

        # Ensure images is JSON-serializable list of strings
        safe_images = []
        if isinstance(images, list):
            for it in images:
                if isinstance(it, str) and it:
                    safe_images.append(it)
        
        # Ensure tags is JSON-serializable list of strings
        safe_tags = []
        if isinstance(tags, list):
            for it in tags:
                if isinstance(it, str) and it.strip():
                    safe_tags.append(it.strip())

        post_id = uuid.uuid4().hex

        conn = _get_conn()
        try:
            _ensure_table(conn)
            cur = conn.cursor()
            try:
                # 匿名发布时也记录user_id，但显示时保持匿名
                cur.execute(
                    """
                    INSERT INTO square_posts (id, user_id, username, avatar_url, text_content, image_urls, tags)
                    VALUES (%s, %s, %s, %s, %s, %s, %s)
                    """,
                    (post_id, user_id, username, avatar_url, text_content, json.dumps(safe_images, ensure_ascii=False), json.dumps(safe_tags, ensure_ascii=False) if safe_tags else None),
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


@square_blueprint.route("/square/comments", methods=["POST", "OPTIONS"])
def list_comments():
    """获取指定消息的评论列表"""
    if request.method == "OPTIONS":
        return "", 200
    try:
        payload = request.get_json(silent=True) or {}
        logger.info("/square/comments body_keys=%s", list(payload.keys()))

        post_id = payload.get("post_id")
        current_user_id = payload.get("current_user_id")  # 当前用户ID，用于判断删除权限
        if not post_id:
            return jsonify({"success": False, "message": "缺少消息ID"}), 400

        conn = _get_conn()
        try:
            _ensure_table(conn)
            cur = conn.cursor(dictionary=True)
            try:
                # If current_user_id is provided, filter out comments from blocked users
                if current_user_id:
                    cur.execute(
                        """
                        SELECT c.id, c.parent_comment_id, c.user_id, c.username, c.avatar_url, c.text_content, c.created_at
                        FROM square_comments c
                        LEFT JOIN blocked_users b ON b.blocker_id = %s AND b.blocked_id = c.user_id
                        WHERE c.post_id = %s AND b.id IS NULL
                        ORDER BY c.created_at ASC
                        """,
                        (current_user_id, post_id),
                    )
                else:
                    cur.execute(
                        """
                        SELECT id, parent_comment_id, user_id, username, avatar_url, text_content, created_at
                        FROM square_comments
                        WHERE post_id = %s
                        ORDER BY created_at ASC
                        """,
                        (post_id,),
                    )
                rows = cur.fetchall()
            finally:
                cur.close()
        finally:
            conn.close()

        # 格式化评论数据
        comments = []
        for r in rows:
            # 检查是否是匿名评论
            is_anonymous = r.get("username") == "匿名用户"
            
            # 如果是匿名评论且不是当前用户的评论，隐藏user_id
            if is_anonymous and r.get("user_id") != current_user_id:
                user_id = None
            else:
                user_id = r.get("user_id")
            
            comments.append({
                "id": r.get("id"),
                "parent_comment_id": r.get("parent_comment_id"),
                "user_id": user_id,  # 匿名评论且非当前用户时返回None
                "username": r.get("username"),
                "avatar_url": r.get("avatar_url"),
                "text": r.get("text_content") or "",
                "created_at": r.get("created_at").isoformat() if r.get("created_at") else None,
            })

        return jsonify({"success": True, "data": comments, "count": len(comments)})

    except mysql_errors.Error as e:
        if getattr(e, "errno", None) in (3024, 1205, 1213):
            logger.warning("/square/comments db timeout/deadlock errno=%s msg=%s", getattr(e, "errno", None), str(e))
            return jsonify({"success": False, "message": "数据库超时或死锁，请稍后重试"}), 504
        logger.exception("/square/comments db error: %s", e)
        return jsonify({"success": False, "message": "数据库错误", "error": str(e)}), 500
    except Exception as e:
        logger.exception("/square/comments server error: %s", e)
        return jsonify({"success": False, "message": "服务器错误", "error": str(e)}), 500


@square_blueprint.route("/square/comment", methods=["POST", "OPTIONS"])
def add_comment():
    """添加评论"""
    if request.method == "OPTIONS":
        return "", 200
    try:
        body = request.get_json(silent=True) or {}
        logger.info("/square/comment body_keys=%s", list(body.keys()))

        post_id = (body.get("post_id") or "").strip()
        parent_comment_id = (body.get("parent_comment_id") or "").strip() or None
        user_id = (body.get("user_id") or "").strip() or None
        username = (body.get("username") or "").strip() or None
        avatar_url = (body.get("avatar_url") or "").strip() or None
        text_content = (body.get("text") or body.get("text_content") or "").strip()

        if not post_id:
            return jsonify({"success": False, "message": "缺少消息ID"}), 400

        if not text_content:
            return jsonify({"success": False, "message": "评论内容不能为空"}), 400

        # AI 内容审核
        logger.info(f"Content moderation check for comment: {text_content[:50]}...")
        is_safe, reason = _check_content_moderation(text_content)
        logger.info(f"Content moderation result: is_safe={is_safe}, reason={reason}")
        if not is_safe:
            logger.warning(f"Content moderation failed for comment: {text_content[:50]}..., reason: {reason}")
            return jsonify({
                "success": False,
                "message": f"内容审核未通过：{reason}，请修改后重新发送"
            }), 400

        if not (user_id or username):
            return jsonify({"success": False, "message": "缺少用户标识"}), 400

        comment_id = uuid.uuid4().hex

        conn = _get_conn()
        try:
            _ensure_table(conn)
            cur = conn.cursor()
            try:
                cur.execute(
                    """
                    INSERT INTO square_comments (id, post_id, parent_comment_id, user_id, username, avatar_url, text_content)
                    VALUES (%s, %s, %s, %s, %s, %s, %s)
                    """,
                    (comment_id, post_id, parent_comment_id, user_id, username, avatar_url, text_content),
                )
                conn.commit()
            finally:
                cur.close()
        finally:
            conn.close()

        return jsonify({
            "success": True,
            "message": "评论成功",
            "data": {"id": comment_id}
        })

    except mysql_errors.Error as e:
        if getattr(e, "errno", None) in (3024, 1205, 1213):
            logger.warning("/square/comment db timeout/deadlock errno=%s msg=%s", getattr(e, "errno", None), str(e))
            return jsonify({"success": False, "message": "数据库超时或死锁，请稍后重试"}), 504
        logger.exception("/square/comment db error: %s", e)
        return jsonify({"success": False, "message": "数据库错误", "error": str(e)}), 500
    except Exception as e:
        logger.exception("/square/comment server error: %s", e)
        return jsonify({"success": False, "message": "服务器错误", "error": str(e)}), 500


@square_blueprint.route("/square/related", methods=["POST", "OPTIONS"])
def list_user_related():
    """列出与当前用户相关的所有评论与回复
    - 用户自己发布的帖子下的所有评论（含嵌套回复，因同属同一post_id）
    - 所有对当前用户评论的直接回复（不局限于其帖子）
    返回扁平列表，并附带所属帖子的基础信息，按时间倒序。
    """
    if request.method == "OPTIONS":
        return "", 200
    try:
        payload = request.get_json(silent=True) or {}
        current_user_id = (payload.get("current_user_id") or "").strip()
        limit = payload.get("limit") or 200
        try:
            limit = int(limit)
        except Exception:
            limit = 200
        limit = max(1, min(500, limit))

        if not current_user_id:
            return jsonify({"success": False, "message": "缺少用户ID"}), 400

        conn = _get_conn()
        try:
            _ensure_table(conn)
            cur = conn.cursor(dictionary=True)
            try:
                # 1) 找到当前用户发布的帖子ID
                cur.execute(
                    "SELECT id FROM square_posts WHERE user_id = %s",
                    (current_user_id,)
                )
                post_rows = cur.fetchall() or []
                my_post_ids = [r["id"] for r in post_rows]

                related_comments = []

                # 2) 这些帖子下的全部评论（包含嵌套，因为同post_id）
                if my_post_ids:
                    in_clause = ",".join(["%s"] * len(my_post_ids))
                    query = f"""
                        SELECT c.id, c.post_id, c.parent_comment_id, c.user_id, c.username, c.avatar_url, c.text_content, c.created_at,
                               p.user_id AS post_user_id, p.username AS post_username
                        FROM square_comments c
                        JOIN square_posts p ON p.id = c.post_id
                        WHERE c.post_id IN ({in_clause})
                    """
                    cur.execute(query, tuple(my_post_ids))
                    related_comments.extend(cur.fetchall() or [])

                # 3) 所有对当前用户评论的直接回复（parent_comment_id 属于我发的评论）
                cur.execute(
                    "SELECT id FROM square_comments WHERE user_id = %s",
                    (current_user_id,)
                )
                my_comment_rows = cur.fetchall() or []
                my_comment_ids = [r["id"] for r in my_comment_rows]
                if my_comment_ids:
                    in_clause = ",".join(["%s"] * len(my_comment_ids))
                    query = f"""
                        SELECT c.id, c.post_id, c.parent_comment_id, c.user_id, c.username, c.avatar_url, c.text_content, c.created_at,
                               p.user_id AS post_user_id, p.username AS post_username
                        FROM square_comments c
                        JOIN square_posts p ON p.id = c.post_id
                        WHERE c.parent_comment_id IN ({in_clause})
                    """
                    cur.execute(query, tuple(my_comment_ids))
                    related_comments.extend(cur.fetchall() or [])

                # 去重（按评论ID）并按时间倒序
                uniq = {}
                for r in related_comments:
                    uniq[r["id"]] = r
                items = list(uniq.values())
                items.sort(key=lambda r: r.get("created_at") or datetime(1970,1,1), reverse=True)
                items = items[:limit]

                # 过滤被我拉黑的用户内容（如果存在block表）
                # 这里保持简单：仅在最终列表中过滤
                try:
                    cur.execute(
                        "SELECT blocked_id FROM blocked_users WHERE blocker_id = %s",
                        (current_user_id,)
                    )
                    blocked = {row["blocked_id"] for row in (cur.fetchall() or [])}
                except Exception:
                    blocked = set()

            finally:
                cur.close()
        finally:
            conn.close()

        data = []
        for r in items:
            # 匿名处理：匿名且不是我时隐藏user_id
            is_anon_comment = (r.get("username") == "匿名用户") and (r.get("user_id") != current_user_id)
            user_id = None if is_anon_comment else r.get("user_id")

            if user_id and user_id in blocked:
                continue

            data.append({
                "id": r.get("id"),
                "post_id": r.get("post_id"),
                "parent_comment_id": r.get("parent_comment_id"),
                "user_id": user_id,
                "username": r.get("username"),
                "avatar_url": r.get("avatar_url"),
                "text": r.get("text_content") or "",
                "created_at": r.get("created_at").isoformat() if r.get("created_at") else None,
                "post_user_id": r.get("post_user_id"),
                "post_username": r.get("post_username"),
            })

        return jsonify({"success": True, "data": data, "count": len(data)})

    except mysql_errors.Error as e:
        if getattr(e, "errno", None) in (3024, 1205, 1213):
            logger.warning("/square/related db timeout/deadlock errno=%s msg=%s", getattr(e, "errno", None), str(e))
            return jsonify({"success": False, "message": "数据库超时或死锁，请稍后重试"}), 504
        logger.exception("/square/related db error: %s", e)
        return jsonify({"success": False, "message": "数据库错误", "error": str(e)}), 500
    except Exception as e:
        logger.exception("/square/related server error: %s", e)
        return jsonify({"success": False, "message": "服务器错误", "error": str(e)}), 500

@square_blueprint.route("/square/post/<post_id>", methods=["DELETE", "OPTIONS"])
def delete_post(post_id):
    """删除消息"""
    if request.method == "OPTIONS":
        return "", 200
    try:
        if not post_id:
            return jsonify({"success": False, "message": "缺少消息ID"}), 400

        conn = _get_conn()
        try:
            _ensure_table(conn)
            cur = conn.cursor()
            try:
                # 删除消息（评论会因为外键级联删除自动删除）
                # 由于外键约束：FOREIGN KEY (post_id) REFERENCES square_posts(id) ON DELETE CASCADE
                # 删除帖子时会自动删除所有相关的主评论和子评论
                cur.execute(
                    "DELETE FROM square_posts WHERE id = %s",
                    (post_id,),
                )
                conn.commit()
                affected_rows = cur.rowcount
            finally:
                cur.close()
        finally:
            conn.close()

        if affected_rows == 0:
            return jsonify({"success": False, "message": "消息不存在"}), 404

        return jsonify({
            "success": True,
            "message": "删除成功"
        })

    except mysql_errors.Error as e:
        if getattr(e, "errno", None) in (3024, 1205, 1213):
            logger.warning("/square/post delete db timeout/deadlock errno=%s msg=%s", getattr(e, "errno", None), str(e))
            return jsonify({"success": False, "message": "数据库超时或死锁，请稍后重试"}), 504
        logger.exception("/square/post delete db error: %s", e)
        return jsonify({"success": False, "message": "数据库错误", "error": str(e)}), 500
    except Exception as e:
        logger.exception("/square/post delete server error: %s", e)
        return jsonify({"success": False, "message": "服务器错误", "error": str(e)}), 500


@square_blueprint.route("/square/comment/<comment_id>", methods=["DELETE", "OPTIONS"])
def delete_comment(comment_id):
    """删除评论"""
    if request.method == "OPTIONS":
        return "", 200
    try:
        if not comment_id:
            return jsonify({"success": False, "message": "缺少评论ID"}), 400

        conn = _get_conn()
        try:
            _ensure_table(conn)
            cur = conn.cursor()
            try:
                # 删除评论（子评论会因为外键级联删除自动删除）
                # 由于外键约束：FOREIGN KEY (parent_comment_id) REFERENCES square_comments(id) ON DELETE CASCADE
                # 删除主评论时会自动删除所有相关的子评论
                cur.execute(
                    "DELETE FROM square_comments WHERE id = %s",
                    (comment_id,),
                )
                conn.commit()
                affected_rows = cur.rowcount
            finally:
                cur.close()
        finally:
            conn.close()

        if affected_rows == 0:
            return jsonify({"success": False, "message": "评论不存在"}), 404

        return jsonify({
            "success": True,
            "message": "删除成功"
        })

    except mysql_errors.Error as e:
        if getattr(e, "errno", None) in (3024, 1205, 1213):
            logger.warning("/square/comment delete db timeout/deadlock errno=%s msg=%s", getattr(e, "errno", None), str(e))
            return jsonify({"success": False, "message": "数据库超时或死锁，请稍后重试"}), 504
        logger.exception("/square/comment delete db error: %s", e)
        return jsonify({"success": False, "message": "数据库错误", "error": str(e)}), 500
    except Exception as e:
        logger.exception("/square/comment delete server error: %s", e)
        return jsonify({"success": False, "message": "服务器错误", "error": str(e)}), 500


