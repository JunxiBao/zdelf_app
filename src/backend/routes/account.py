import os
from dotenv import load_dotenv
from flask import Blueprint, request, jsonify
import mysql.connector
from mysql.connector import errors as mysql_errors
import uuid
import re
import logging

load_dotenv()

logger = logging.getLogger("app.register")

register_blueprint = Blueprint('register', __name__)

db_config = {
    "host": os.getenv("DB_HOST"),
    "user": os.getenv("DB_USER"),
    "password": os.getenv("DB_PASSWORD"),
    "database": os.getenv("DB_NAME")
}

def _get_conn():
    # Write operation: connection timeout 5s, set single statement max execution 15s, avoid long blocking
    conn = mysql.connector.connect(**db_config, connection_timeout=5, autocommit=False)
    cur = conn.cursor()
    try:
        cur.execute("SET SESSION MAX_EXECUTION_TIME=15000")  # 15s
    finally:
        cur.close()
    return conn

# Supported input:+86***********、86***********、1**********（11）
PHONE_RE = re.compile(r"^\+?\d{6,15}$")

def normalize_cn_phone(raw: str) -> str:
    if not raw:
        return ''
    s = re.sub(r"\s", "", str(raw))
    # Only numbers and optional + are accepted
    if not PHONE_RE.match(s) and not (s.startswith('1') and len(s) == 11 and s.isdigit()):
        return ''
    # Normalize
    digits = re.sub(r"[^0-9]", "", s)
    if s.startswith('+86') or s.startswith('86'):
        # Take last 11 digits
        digits = digits[-11:]
        if len(digits) != 11:
            return ''
        return '+86' + digits
    if s.startswith('1') and len(s) == 11:
        return '+86' + s
    # Other circumstances are not accepted (only mobile phone numbers from Chinese mainland are allowed)
    return ''

@register_blueprint.route('/register', methods=['POST', 'OPTIONS'])
def register():
    if request.method == 'OPTIONS':
        return '', 200
    try:
        data = request.get_json(silent=True) or {}
        logger.info("/register request data=%s", data)

        username = (data.get("username") or '').strip()
        password = (data.get("password") or '')
        age = data.get("age")
        phone_raw = (data.get("phone") or '').strip()
        phone = normalize_cn_phone(phone_raw)

        # Age verification
        try:
            age = int(age)
            if age < 1 or age > 120:
                logger.warning("/register invalid age=%s for username=%s", age, username)
                return jsonify({"success": False, "message": "年龄必须是1-120之间的整数"}), 400
        except (TypeError, ValueError):
            logger.warning("/register invalid age format=%s", age)
            return jsonify({"success": False, "message": "年龄格式不正确"}), 400

        # Mandatory verification
        if not username or not password or age is None or not phone:
            logger.warning("/register missing fields username=%s age=%s phone=%s", username, age, phone)
            return jsonify({"success": False, "message": "缺少用户名、密码、年龄或手机号，或手机号格式不正确（仅支持中国大陆）"}), 400

        conn = _get_conn()
        cursor = conn.cursor(dictionary=True)
        try:
            # If a placeholder account (username=phone and phone_number is empty) has been created in sms/verify before, claim it directly and update it to the official information
            cursor.execute(
                "SELECT user_id FROM users WHERE username=%s AND (phone_number IS NULL OR phone_number='')",
                (phone,)
            )
            placeholder = cursor.fetchone()
            if placeholder:
                cursor.execute(
                    "UPDATE users SET username=%s, password=%s, age=%s, phone_number=%s WHERE user_id=%s",
                    (username, password, age, phone, placeholder['user_id'])
                )
                conn.commit()
                logger.info("/register updated placeholder user_id=%s phone=%s username=%s", placeholder['user_id'], phone, username)
                return jsonify({"success": True, "message": "注册成功（占位账号已更新）"})

            # User name unique
            cursor.execute("SELECT 1 FROM users WHERE username=%s", (username,))
            if cursor.fetchone():
                logger.warning("/register username exists username=%s", username)
                conn.rollback()
                return jsonify({"success": False, "message": "用户名已存在"}), 409

            # Phone number unique
            cursor.execute("SELECT 1 FROM users WHERE phone_number=%s", (phone,))
            if cursor.fetchone():
                logger.warning("/register phone already registered phone=%s", phone)
                conn.rollback()
                return jsonify({"success": False, "message": "该手机号已注册"}), 409

            user_id = str(uuid.uuid4())
            cursor.execute(
                "INSERT INTO users (user_id, username, password, age, phone_number) VALUES (%s, %s, %s, %s, %s)",
                (user_id, username, password, age, phone)
            )
            conn.commit()
            logger.info("/register new user created user_id=%s username=%s phone=%s", user_id, username, phone)
        finally:
            try:
                cursor.close()
            except Exception:
                pass
            try:
                conn.close()
            except Exception:
                pass

        return jsonify({"success": True, "message": "注册成功"})

    except mysql_errors.Error as e:
        # 3024: MAX_EXECUTION_TIME exceeded; 1205: Lock wait timeout; 1213: Deadlock found
        if getattr(e, 'errno', None) in (3024, 1205, 1213):
            logger.warning("/register db timeout/deadlock errno=%s msg=%s", getattr(e, 'errno', None), str(e))
            return jsonify({"success": False, "message": "数据库超时或死锁，请稍后重试"}), 504
        logger.exception("/register db error: %s", e)
        return jsonify({"success": False, "message": "数据库错误", "error": str(e)}), 500
    except Exception as e:
        logger.exception("/register server error: %s", e)
        return jsonify({"success": False, "message": "服务器错误", "error": str(e)}), 500


# 账号注销
@register_blueprint.route('/delete_account', methods=['POST', 'OPTIONS'])
def delete_account():
    if request.method == 'OPTIONS':
        return '', 200
    try:
        data = request.get_json(silent=True) or {}
        username = (data.get("username") or '').strip()
        user_id = (data.get("user_id") or '').strip()
        logger.info("/delete_account request username=%s user_id=%s", username, user_id)

        if not username and not user_id:
            return jsonify({"success": False, "message": "必须提供用户名或用户ID"}), 400

        conn = _get_conn()
        cursor = conn.cursor()
        try:
            # 先获取用户的手机号，用于删除短信验证码记录
            phone_number = None
            if user_id:
                cursor.execute("SELECT phone_number FROM users WHERE user_id=%s", (user_id,))
            else:
                cursor.execute("SELECT phone_number FROM users WHERE username=%s", (username,))
            
            user_record = cursor.fetchone()
            if not user_record:
                conn.rollback()
                return jsonify({"success": False, "message": "未找到对应的账号"}), 404
            
            phone_number = user_record[0]
            
            # 获取用户头像URL（如果存在）
            avatar_url = None
            if user_id:
                cursor.execute("SELECT avatar_url FROM users WHERE user_id=%s", (user_id,))
            else:
                cursor.execute("SELECT avatar_url FROM users WHERE username=%s", (username,))
            
            user_avatar_record = cursor.fetchone()
            if user_avatar_record and user_avatar_record[0]:
                avatar_url = user_avatar_record[0]
            
            # 定义需要删除用户数据的表列表
            tables_to_clean = [
                "metrics_files",     # 健康指标数据
                "diet_files",        # 饮食记录数据
                "case_files",        # 病例记录数据
                "symptom_files",     # 症状跟踪数据
                "square_posts",      # 广场帖子数据
                "square_comments",   # 广场评论数据
            ]
            
            # 删除用户在各个数据表中的记录
            deleted_counts = {}
            for table in tables_to_clean:
                try:
                    if user_id:
                        cursor.execute(f"DELETE FROM {table} WHERE user_id=%s", (user_id,))
                    else:
                        cursor.execute(f"DELETE FROM {table} WHERE username=%s", (username,))
                    deleted_counts[table] = cursor.rowcount
                    logger.info("/delete_account deleted from %s: %d records", table, cursor.rowcount)
                except Exception as e:
                    logger.warning("/delete_account failed to delete from %s: %s", table, str(e))
                    # 继续删除其他表，不因某个表删除失败而中断
            
            # 删除短信验证码记录（如果有手机号）
            if phone_number:
                try:
                    cursor.execute("DELETE FROM sms_codes WHERE phone=%s", (phone_number,))
                    deleted_counts["sms_codes"] = cursor.rowcount
                    logger.info("/delete_account deleted from sms_codes: %d records", cursor.rowcount)
                except Exception as e:
                    logger.warning("/delete_account failed to delete from sms_codes: %s", str(e))
            
            # 删除屏蔽用户记录（该用户作为屏蔽者和被屏蔽者的记录）
            try:
                blocked_count = 0
                # 删除该用户屏蔽的其他用户
                if user_id:
                    cursor.execute("DELETE FROM blocked_users WHERE blocker_id=%s", (user_id,))
                    blocked_count += cursor.rowcount
                    # 删除其他用户屏蔽该用户的记录
                    cursor.execute("DELETE FROM blocked_users WHERE blocked_id=%s", (user_id,))
                    blocked_count += cursor.rowcount
                else:
                    cursor.execute("DELETE FROM blocked_users WHERE blocker_id=%s", (username,))
                    blocked_count += cursor.rowcount
                    cursor.execute("DELETE FROM blocked_users WHERE blocked_id=%s", (username,))
                    blocked_count += cursor.rowcount
                
                deleted_counts["blocked_users"] = blocked_count
                logger.info("/delete_account deleted from blocked_users: %d records", blocked_count)
            except Exception as e:
                logger.warning("/delete_account failed to delete from blocked_users: %s", str(e))
            
            # 删除举报记录（该用户作为举报者和被举报者的记录）
            try:
                report_count = 0
                # 删除该用户提交的举报
                if user_id:
                    cursor.execute("DELETE FROM content_reports WHERE reporter_id=%s", (user_id,))
                    report_count += cursor.rowcount
                    # 删除针对该用户的举报
                    cursor.execute("DELETE FROM content_reports WHERE reported_user_id=%s", (user_id,))
                    report_count += cursor.rowcount
                else:
                    cursor.execute("DELETE FROM content_reports WHERE reporter_id=%s", (username,))
                    report_count += cursor.rowcount
                    cursor.execute("DELETE FROM content_reports WHERE reported_user_id=%s", (username,))
                    report_count += cursor.rowcount
                
                deleted_counts["content_reports"] = report_count
                logger.info("/delete_account deleted from content_reports: %d records", report_count)
            except Exception as e:
                logger.warning("/delete_account failed to delete from content_reports: %s", str(e))
            
            # 删除用户头像文件
            if avatar_url:
                try:
                    import os
                    # 从URL中提取文件名
                    avatar_filename = avatar_url.split('/')[-1]
                    avatar_folder = os.path.join(os.path.dirname(__file__), '../../statics/avatars')
                    avatar_filepath = os.path.join(avatar_folder, avatar_filename)
                    
                    if os.path.exists(avatar_filepath):
                        os.remove(avatar_filepath)
                        deleted_counts["avatar_file"] = 1
                        logger.info("/delete_account deleted avatar file: %s", avatar_filename)
                    else:
                        logger.warning("/delete_account avatar file not found: %s", avatar_filepath)
                except Exception as e:
                    logger.warning("/delete_account failed to delete avatar file: %s", str(e))
            
            # 删除用户上传的其他图片文件
            try:
                import os
                import glob
                images_folder = os.path.join(os.path.dirname(__file__), '../../statics/images')
                user_identifier = user_id or username
                
                # 查找该用户的所有图片文件
                pattern = os.path.join(images_folder, f"*_{user_identifier}_*")
                user_image_files = glob.glob(pattern)
                
                deleted_image_count = 0
                for image_file in user_image_files:
                    try:
                        if os.path.exists(image_file):
                            os.remove(image_file)
                            deleted_image_count += 1
                            logger.info("/delete_account deleted user image: %s", os.path.basename(image_file))
                    except Exception as e:
                        logger.warning("/delete_account failed to delete image %s: %s", image_file, str(e))
                
                if deleted_image_count > 0:
                    deleted_counts["user_images"] = deleted_image_count
                    logger.info("/delete_account deleted %d user image files", deleted_image_count)
                    
            except Exception as e:
                logger.warning("/delete_account failed to delete user images: %s", str(e))
            
            # 最后删除用户主记录
            if user_id:
                cursor.execute("DELETE FROM users WHERE user_id=%s", (user_id,))
            else:
                cursor.execute("DELETE FROM users WHERE username=%s", (username,))
            
            if cursor.rowcount == 0:
                conn.rollback()
                return jsonify({"success": False, "message": "未找到对应的账号"}), 404
            
            conn.commit()
            logger.info("/delete_account success username=%s user_id=%s deleted_counts=%s", 
                       username, user_id, deleted_counts)
        finally:
            try:
                cursor.close()
            except Exception:
                pass
            try:
                conn.close()
            except Exception:
                pass

        return jsonify({
            "success": True, 
            "message": "账号已注销，所有相关数据已删除",
            "deleted_counts": deleted_counts
        })

    except mysql_errors.Error as e:
        if getattr(e, 'errno', None) in (3024, 1205, 1213):
            logger.warning("/delete_account db timeout/deadlock errno=%s msg=%s", getattr(e, 'errno', None), str(e))
            return jsonify({"success": False, "message": "数据库超时或死锁，请稍后重试"}), 504
        logger.exception("/delete_account db error: %s", e)
        return jsonify({"success": False, "message": "数据库错误", "error": str(e)}), 500
    except Exception as e:
        logger.exception("/delete_account server error: %s", e)
        return jsonify({"success": False, "message": "服务器错误", "error": str(e)}), 500