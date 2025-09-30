"""
Created on Thu Aug 21 2025 21:53:58
Author: JunxiBao
File: avatar.py
Description: Avatar upload and management routes for user profile pictures.
"""
from flask import Blueprint, request, jsonify, current_app
import os
import uuid
import base64
from PIL import Image
import io
import logging

avatar_blueprint = Blueprint('avatar', __name__)

# 配置头像存储目录
AVATAR_UPLOAD_FOLDER = os.path.join(os.path.dirname(__file__), '../../statics/avatars')
ALLOWED_EXTENSIONS = {'png', 'jpg', 'jpeg', 'gif', 'webp'}
MAX_FILE_SIZE = 5 * 1024 * 1024  # 5MB

# 确保头像目录存在
os.makedirs(AVATAR_UPLOAD_FOLDER, exist_ok=True)

def allowed_file(filename):
    """检查文件扩展名是否允许"""
    return '.' in filename and \
           filename.rsplit('.', 1)[1].lower() in ALLOWED_EXTENSIONS

def process_avatar_image(image_data, user_id):
    """处理头像图片，裁剪为圆形并调整大小"""
    try:
        # 如果是base64数据，解码
        if isinstance(image_data, str) and image_data.startswith('data:image'):
            # 移除data:image/xxx;base64,前缀
            header, encoded = image_data.split(',', 1)
            image_data = base64.b64decode(encoded)
        
        # 打开图片
        image = Image.open(io.BytesIO(image_data))
        
        # 转换为RGB模式（处理RGBA等）
        if image.mode != 'RGB':
            image = image.convert('RGB')
        
        # 创建圆形蒙版
        size = min(image.size)
        # 创建正方形图片
        left = (image.width - size) // 2
        top = (image.height - size) // 2
        right = left + size
        bottom = top + size
        
        # 裁剪为正方形
        image = image.crop((left, top, right, bottom))
        
        # 调整大小为200x200
        image = image.resize((200, 200), Image.Resampling.LANCZOS)
        
        # 创建圆形蒙版
        from PIL import ImageDraw
        mask = Image.new('L', (200, 200), 0)
        draw = ImageDraw.Draw(mask)
        draw.ellipse((0, 0, 200, 200), fill=255)
        
        # 应用圆形蒙版
        output = Image.new('RGBA', (200, 200), (255, 255, 255, 0))
        output.paste(image, (0, 0))
        output.putalpha(mask)
        
        # 保存头像文件
        filename = f"avatar_{user_id}_{uuid.uuid4().hex[:8]}.png"
        filepath = os.path.join(AVATAR_UPLOAD_FOLDER, filename)
        output.save(filepath, 'PNG')
        
        # 返回相对路径
        return f"/statics/avatars/{filename}"
        
    except Exception as e:
        logging.error(f"处理头像图片失败: {str(e)}")
        raise Exception("头像处理失败")

@avatar_blueprint.route('/upload_avatar', methods=['POST'])
def upload_avatar():
    """上传用户头像"""
    try:
        data = request.get_json()
        
        if not data:
            return jsonify({
                'success': False,
                'message': '请求数据为空'
            }), 400
        
        # 获取用户ID
        user_id = data.get('user_id')
        username = data.get('username')
        
        if not user_id and not username:
            return jsonify({
                'success': False,
                'message': '缺少用户标识'
            }), 400
        
        # 获取头像数据
        avatar_data = data.get('avatar_data')
        if not avatar_data:
            return jsonify({
                'success': False,
                'message': '缺少头像数据'
            }), 400
        
        # 处理头像图片
        avatar_url = process_avatar_image(avatar_data, user_id or username)
        
        # 这里可以更新数据库中的avatar_url字段
        # 由于没有看到具体的数据库操作代码，这里返回成功响应
        # 实际应用中需要更新用户表中的avatar_url字段
        
        return jsonify({
            'success': True,
            'message': '头像上传成功',
            'data': {
                'avatar_url': avatar_url
            }
        }), 200
        
    except Exception as e:
        logging.error(f"头像上传失败: {str(e)}")
        return jsonify({
            'success': False,
            'message': f'头像上传失败: {str(e)}'
        }), 500

@avatar_blueprint.route('/get_avatar/<user_id>', methods=['GET'])
def get_avatar(user_id):
    """获取用户头像"""
    try:
        # 这里应该从数据库获取用户的avatar_url
        # 暂时返回默认头像路径
        default_avatar = "/statics/avatars/default.png"
        
        # 检查用户是否有自定义头像
        # 实际应用中需要查询数据库
        avatar_path = f"/statics/avatars/avatar_{user_id}_*.png"
        
        return jsonify({
            'success': True,
            'data': {
                'avatar_url': default_avatar
            }
        }), 200
        
    except Exception as e:
        logging.error(f"获取头像失败: {str(e)}")
        return jsonify({
            'success': False,
            'message': f'获取头像失败: {str(e)}'
        }), 500
