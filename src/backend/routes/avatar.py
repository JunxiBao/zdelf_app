"""
Created on Thu Aug 21 2025 21:53:58
Author: JunxiBao
File: avatar.py
Description: Avatar upload and management routes for user profile pictures.
"""
import os
import uuid
import base64
import logging
from dotenv import load_dotenv
from flask import Blueprint, request, jsonify
import mysql.connector
from mysql.connector import errors as mysql_errors
from PIL import Image
import io

load_dotenv()

logger = logging.getLogger("app.avatar")
avatar_blueprint = Blueprint('avatar', __name__)

# 数据库配置
db_config = {
    "host": os.getenv("DB_HOST"),
    "user": os.getenv("DB_USER"),
    "password": os.getenv("DB_PASSWORD"),
    "database": os.getenv("DB_NAME")
}

# 配置头像存储目录
AVATAR_UPLOAD_FOLDER = os.path.join(os.path.dirname(__file__), '../../statics/avatars')
# 确保路径正确
if not os.path.exists(AVATAR_UPLOAD_FOLDER):
    os.makedirs(AVATAR_UPLOAD_FOLDER, exist_ok=True)
ALLOWED_EXTENSIONS = {'png', 'jpg', 'jpeg', 'gif', 'webp'}
MAX_FILE_SIZE = 2 * 1024 * 1024  # 2MB (保持压缩处理)
MAX_IMAGE_SIZE = (512, 512)  # 最大分辨率 512x512
AVATAR_SIZE = (200, 200)  # 最终头像尺寸 200x200

# 确保头像目录存在
os.makedirs(AVATAR_UPLOAD_FOLDER, exist_ok=True)

def _get_conn():
    """获取数据库连接"""
    conn = mysql.connector.connect(**db_config, connection_timeout=5, autocommit=False)
    cur = conn.cursor()
    try:
        cur.execute("SET SESSION MAX_EXECUTION_TIME=15000")  # 15s
    finally:
        cur.close()
    return conn

def allowed_file(filename):
    """检查文件扩展名是否允许"""
    return '.' in filename and \
           filename.rsplit('.', 1)[1].lower() in ALLOWED_EXTENSIONS

def process_avatar_image(image_data, user_id):
    """处理头像图片，前端已经完成压缩和裁剪，这里直接保存"""
    try:
        # 如果是base64数据，解码
        if isinstance(image_data, str) and image_data.startswith('data:image'):
            # 移除data:image/xxx;base64,前缀
            header, encoded = image_data.split(',', 1)
            image_data = base64.b64decode(encoded)
        
        # 打开图片（前端已经压缩到200x200）
        image = Image.open(io.BytesIO(image_data))
        
        # 验证图片尺寸（前端应该已经处理好了）
        if image.width != AVATAR_SIZE[0] or image.height != AVATAR_SIZE[1]:
            logger.warning(f"图片尺寸不是预期的 {AVATAR_SIZE}，实际: {image.size}")
            # 如果尺寸不对，强制调整
            image = image.resize(AVATAR_SIZE, Image.Resampling.LANCZOS)
        
        # 保存头像文件，使用用户ID作为文件名
        filename = f"{user_id}.png"
        filepath = os.path.join(AVATAR_UPLOAD_FOLDER, filename)
        
        # 直接保存，前端已经完成了压缩和圆形处理
        # 由于文件名固定为 {user_id}.png，新文件会直接覆盖旧文件
        image.save(filepath, 'PNG', optimize=True, compress_level=6)
        
        # 记录文件大小
        file_size = os.path.getsize(filepath)
        logger.info(f"头像文件已保存: {filename}, 大小: {file_size} bytes")
        
        # 返回相对路径（修正为正确的路径）
        return f"/src/statics/avatars/{filename}"
        
    except Exception as e:
        logger.error(f"处理头像图片失败: {str(e)}")
        raise Exception("头像处理失败")

@avatar_blueprint.route('/upload_avatar', methods=['POST'])
def upload_avatar():
    """上传用户头像"""
    if request.method == 'OPTIONS':
        return '', 200
    
    try:
        data = request.get_json(silent=True) or {}
        logger.info("/upload_avatar request data keys=%s", list(data.keys()))
        
        # 获取用户标识
        user_id = data.get('user_id')
        username = data.get('username')
        
        if not user_id and not username:
            logger.warning("/upload_avatar missing user identity")
            return jsonify({
                'success': False,
                'message': '缺少用户标识'
            }), 400
        
        # 获取头像数据
        avatar_data = data.get('avatar_data')
        if not avatar_data:
            logger.warning("/upload_avatar missing avatar data")
            return jsonify({
                'success': False,
                'message': '缺少头像数据'
            }), 400
        
        # 处理头像图片
        avatar_url = process_avatar_image(avatar_data, user_id or username)
        
        # 更新数据库中的avatar_url字段
        conn = _get_conn()
        cursor = conn.cursor()
        try:
            # 首先检查用户是否存在
            if user_id:
                cursor.execute("SELECT user_id FROM users WHERE user_id=%s", (user_id,))
            else:
                cursor.execute("SELECT user_id FROM users WHERE username=%s", (username,))
            
            user_record = cursor.fetchone()
            if not user_record:
                logger.warning("/upload_avatar user not found user_id=%s username=%s", user_id, username)
                return jsonify({
                    'success': False,
                    'message': '用户不存在'
                }), 404
            
            # 检查avatar_url字段是否存在，如果不存在则添加
            cursor.execute("SHOW COLUMNS FROM users LIKE 'avatar_url'")
            if not cursor.fetchone():
                logger.info("/upload_avatar adding avatar_url column to users table")
                cursor.execute("ALTER TABLE users ADD COLUMN avatar_url VARCHAR(500) NULL")
            
            # 获取用户当前的头像URL（如果存在）
            old_avatar_url = None
            if user_id:
                cursor.execute("SELECT avatar_url FROM users WHERE user_id=%s", (user_id,))
            else:
                cursor.execute("SELECT avatar_url FROM users WHERE username=%s", (username,))
            
            user_data = cursor.fetchone()
            if user_data and user_data[0]:
                old_avatar_url = user_data[0]
                logger.info("/upload_avatar found old avatar: %s", old_avatar_url)
            
            # 更新用户的头像URL
            if user_id:
                cursor.execute("UPDATE users SET avatar_url=%s WHERE user_id=%s", (avatar_url, user_id))
            else:
                cursor.execute("UPDATE users SET avatar_url=%s WHERE username=%s", (avatar_url, username))
            
            conn.commit()
            logger.info("/upload_avatar success user_id=%s username=%s avatar_url=%s", user_id, username, avatar_url)
            
            # 由于现在使用固定的文件名 {user_id}.png，新文件会直接覆盖旧文件
            # 不需要手动删除旧文件
            
        except mysql_errors.Error as e:
            conn.rollback()
            if getattr(e, 'errno', None) in (3024, 1205, 1213):
                logger.warning("/upload_avatar db timeout/deadlock errno=%s msg=%s", getattr(e, 'errno', None), str(e))
                return jsonify({"success": False, "message": "数据库超时或死锁，请稍后重试"}), 504
            logger.exception("/upload_avatar db error: %s", e)
            return jsonify({"success": False, "message": "数据库错误", "error": str(e)}), 500
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
            'success': True,
            'message': '头像上传成功',
            'data': {
                'avatar_url': avatar_url
            }
        }), 200
        
    except Exception as e:
        logger.exception("/upload_avatar server error: %s", e)
        return jsonify({
            'success': False,
            'message': f'头像上传失败: {str(e)}'
        }), 500

@avatar_blueprint.route('/get_avatar/<user_id>', methods=['GET'])
def get_avatar(user_id):
    """获取用户头像"""
    try:
        conn = _get_conn()
        cursor = conn.cursor(dictionary=True)
        try:
            # 从数据库获取用户的头像URL
            cursor.execute("SELECT avatar_url FROM users WHERE user_id=%s", (user_id,))
            user_record = cursor.fetchone()
            
            if not user_record:
                logger.warning("/get_avatar user not found user_id=%s", user_id)
                return jsonify({
                    'success': False,
                    'message': '用户不存在'
                }), 404
            
            avatar_url = user_record.get('avatar_url')
            if not avatar_url:
                # 如果没有头像，返回默认头像
                avatar_url = "/statics/avatars/default.png"
            
            return jsonify({
                'success': True,
                'data': {
                    'avatar_url': avatar_url
                }
            }), 200
            
        except mysql_errors.Error as e:
            if getattr(e, 'errno', None) in (3024, 1205, 1213):
                logger.warning("/get_avatar db timeout/deadlock errno=%s msg=%s", getattr(e, 'errno', None), str(e))
                return jsonify({"success": False, "message": "数据库超时或死锁，请稍后重试"}), 504
            logger.exception("/get_avatar db error: %s", e)
            return jsonify({"success": False, "message": "数据库错误", "error": str(e)}), 500
        finally:
            try:
                cursor.close()
            except Exception:
                pass
            try:
                conn.close()
            except Exception:
                pass
        
    except Exception as e:
        logger.exception("/get_avatar server error: %s", e)
        return jsonify({
            'success': False,
            'message': f'获取头像失败: {str(e)}'
        }), 500

@avatar_blueprint.route('/cleanup_avatars', methods=['POST'])
def cleanup_avatars():
    """清理孤立的头像文件（管理员功能）"""
    try:
        # 获取数据库中所有有效的头像URL
        conn = _get_conn()
        cursor = conn.cursor()
        try:
            cursor.execute("SELECT avatar_url FROM users WHERE avatar_url IS NOT NULL AND avatar_url != ''")
            valid_avatars = set()
            for row in cursor.fetchall():
                if row[0]:
                    filename = row[0].split('/')[-1]
                    valid_avatars.add(filename)
            
            # 获取文件系统中的所有头像文件
            if os.path.exists(AVATAR_UPLOAD_FOLDER):
                all_files = os.listdir(AVATAR_UPLOAD_FOLDER)
                orphaned_files = []
                
                for filename in all_files:
                    if filename.startswith('avatar_') and filename not in valid_avatars:
                        orphaned_files.append(filename)
                
                # 删除孤立文件
                deleted_count = 0
                for filename in orphaned_files:
                    try:
                        filepath = os.path.join(AVATAR_UPLOAD_FOLDER, filename)
                        os.remove(filepath)
                        deleted_count += 1
                        logger.info("Cleaned up orphaned avatar: %s", filename)
                    except Exception as e:
                        logger.warning("Failed to delete orphaned avatar %s: %s", filename, str(e))
                
                return jsonify({
                    'success': True,
                    'message': f'清理完成，删除了 {deleted_count} 个孤立文件',
                    'data': {
                        'deleted_count': deleted_count,
                        'orphaned_files': orphaned_files
                    }
                }), 200
            else:
                return jsonify({
                    'success': True,
                    'message': '头像目录不存在',
                    'data': {'deleted_count': 0}
                }), 200
                
        finally:
            cursor.close()
            conn.close()
            
    except Exception as e:
        logger.exception("/cleanup_avatars error: %s", e)
        return jsonify({
            'success': False,
            'message': '清理头像文件失败'
        }), 500
