"""
Created on Thu Aug 21 2025 21:53:58
Author: JunxiBao
File: image_upload.py
Description: Generic image upload routes for metrics, diet, case records, etc.
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

logger = logging.getLogger("app.image_upload")
image_upload_blueprint = Blueprint('image_upload', __name__)

# 数据库配置
db_config = {
    "host": os.getenv("DB_HOST"),
    "user": os.getenv("DB_USER"),
    "password": os.getenv("DB_PASSWORD"),
    "database": os.getenv("DB_NAME")
}

# 配置图片存储目录
IMAGE_UPLOAD_FOLDER = os.path.join(os.path.dirname(__file__), '../../statics/images')
# 确保路径正确
if not os.path.exists(IMAGE_UPLOAD_FOLDER):
    os.makedirs(IMAGE_UPLOAD_FOLDER, exist_ok=True)

ALLOWED_EXTENSIONS = {'png', 'jpg', 'jpeg', 'gif', 'webp'}
MAX_FILE_SIZE = 2 * 1024 * 1024  # 2MB
MAX_IMAGE_SIZE = (1920, 1080)  # 最大分辨率

# 确保图片目录存在
os.makedirs(IMAGE_UPLOAD_FOLDER, exist_ok=True)

def _get_conn():
    """获取数据库连接"""
    conn = mysql.connector.connect(**db_config, connection_timeout=5, autocommit=False)
    cur = conn.cursor()
    try:
        cur.execute("SET SESSION MAX_EXECUTION_TIME=15000")  # 15s
    finally:
        cur.close()
    return conn

def process_image(image_data, image_type, user_id):
    """处理图片，保存到文件系统"""
    try:
        # 如果是base64数据，解码
        if isinstance(image_data, str) and image_data.startswith('data:image'):
            # 移除data:image/xxx;base64,前缀
            header, encoded = image_data.split(',', 1)
            image_data = base64.b64decode(encoded)
        
        # 打开图片
        image = Image.open(io.BytesIO(image_data))
        
        # 验证图片尺寸
        if image.width > MAX_IMAGE_SIZE[0] or image.height > MAX_IMAGE_SIZE[1]:
            logger.warning(f"图片尺寸过大，实际: {image.size}")
            # 如果尺寸过大，调整大小
            image.thumbnail(MAX_IMAGE_SIZE, Image.Resampling.LANCZOS)
        
        # 保存图片文件
        filename = f"{image_type}_{user_id}_{uuid.uuid4().hex[:8]}.jpg"
        filepath = os.path.join(IMAGE_UPLOAD_FOLDER, filename)
        
        # 保存为JPEG格式，优化压缩
        image.save(filepath, 'JPEG', quality=85, optimize=True)
        
        # 记录文件大小
        file_size = os.path.getsize(filepath)
        logger.info(f"图片文件已保存: {filename}, 大小: {file_size} bytes")
        
        # 返回相对路径
        return f"/src/statics/images/{filename}"
        
    except Exception as e:
        logger.error(f"处理图片失败: {str(e)}")
        raise Exception("图片处理失败")

@image_upload_blueprint.route('/upload_image', methods=['POST'])
def upload_image():
    """上传图片到文件系统"""
    if request.method == 'OPTIONS':
        return '', 200
    
    try:
        data = request.get_json(silent=True) or {}
        logger.info("/upload_image request data keys=%s", list(data.keys()))
        
        # 获取用户标识
        user_id = data.get('user_id')
        username = data.get('username')
        
        if not user_id and not username:
            logger.warning("/upload_image missing user identity")
            return jsonify({
                'success': False,
                'message': '缺少用户标识'
            }), 400
        
        # 获取图片数据
        image_data = data.get('image_data')
        if not image_data:
            logger.warning("/upload_image missing image data")
            return jsonify({
                'success': False,
                'message': '缺少图片数据'
            }), 400
        
        # 获取图片类型
        image_type = data.get('image_type', 'generic')
        
        # 处理图片
        image_url = process_image(image_data, image_type, user_id or username)
        
        logger.info("/upload_image success user_id=%s username=%s image_url=%s", 
                   user_id, username, image_url)
        
        return jsonify({
            'success': True,
            'message': '图片上传成功',
            'data': {
                'image_url': image_url
            }
        }), 200
        
    except Exception as e:
        logger.exception("/upload_image server error: %s", e)
        return jsonify({
            'success': False,
            'message': f'图片上传失败: {str(e)}'
        }), 500

@image_upload_blueprint.route('/upload_multiple_images', methods=['POST'])
def upload_multiple_images():
    """批量上传图片到文件系统"""
    if request.method == 'OPTIONS':
        return '', 200
    
    try:
        data = request.get_json(silent=True) or {}
        logger.info("/upload_multiple_images request data keys=%s", list(data.keys()))
        
        # 获取用户标识
        user_id = data.get('user_id')
        username = data.get('username')
        
        if not user_id and not username:
            logger.warning("/upload_multiple_images missing user identity")
            return jsonify({
                'success': False,
                'message': '缺少用户标识'
            }), 400
        
        # 获取图片数据列表
        images_data = data.get('images_data', [])
        if not images_data or not isinstance(images_data, list):
            logger.warning("/upload_multiple_images missing images data")
            return jsonify({
                'success': False,
                'message': '缺少图片数据'
            }), 400
        
        # 获取图片类型
        image_type = data.get('image_type', 'generic')
        
        # 处理所有图片
        image_urls = []
        for i, image_data in enumerate(images_data):
            try:
                image_url = process_image(image_data, f"{image_type}_{i}", user_id or username)
                image_urls.append(image_url)
            except Exception as e:
                logger.error(f"处理第{i+1}张图片失败: {str(e)}")
                # 继续处理其他图片，不中断整个流程
                continue
        
        if not image_urls:
            return jsonify({
                'success': False,
                'message': '所有图片处理失败'
            }), 400
        
        logger.info("/upload_multiple_images success user_id=%s username=%s uploaded_count=%s", 
                   user_id, username, len(image_urls))
        
        return jsonify({
            'success': True,
            'message': f'成功上传{len(image_urls)}张图片',
            'data': {
                'image_urls': image_urls
            }
        }), 200
        
    except Exception as e:
        logger.exception("/upload_multiple_images server error: %s", e)
        return jsonify({
            'success': False,
            'message': f'批量图片上传失败: {str(e)}'
        }), 500
