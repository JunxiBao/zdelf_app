"""
 Created on Fri Aug 22 2025 09:38:32
 Author: JunxiBao
 File: deepseek.py
 Description: This file contains the Qwen blueprint, users can use js to interact with the Qwen API
    routes include:
        - /chat (chat_stream)
        - /structure
        - /chat_with_context (支持上下文的聊天)
"""

import os
import logging
from dotenv import load_dotenv
from flask import Blueprint, request, jsonify, Response, stream_template
import json
import requests
import re
import uuid
from datetime import datetime, timedelta

# read API key from .env
load_dotenv()

logger = logging.getLogger("app.deepseek")

deepseek_blueprint = Blueprint('deepseek', __name__)

# 火山引擎 DeepSeek v3.1 配置
ARK_API_KEY = os.getenv('ARK_API_KEY')  # 按照官网示例使用 ARK_API_KEY
VOLCENGINE_MODEL_ID = os.getenv('VOLCENGINE_MODEL_ID')  # 推理接入点的 model_id
VOLCENGINE_BOT_ID = os.getenv('VOLCENGINE_BOT_ID')  # Bot ID (bot-开头)
VOLCENGINE_API_URL = 'https://ark.cn-beijing.volces.com/api/v3/chat/completions'
VOLCENGINE_BOT_API_URL = 'https://ark.cn-beijing.volces.com/api/v3/bots'  # Bot API 端点

# 备用：原始 DeepSeek API
DEEPSEEK_API_KEY = os.getenv('DEEPSEEK_API_KEY')
DEEPSEEK_API_URL = 'https://api.deepseek.com/v1/chat/completions'

# 优先使用火山引擎 DeepSeek v3.1，如果配置不存在则回退到原始API
if ARK_API_KEY and (VOLCENGINE_MODEL_ID or VOLCENGINE_BOT_ID):
    API_KEY = ARK_API_KEY
    # 优先使用 Model ID，如果没有则使用 Bot ID
    if VOLCENGINE_MODEL_ID:
        API_URL = VOLCENGINE_API_URL
        MODEL_ID = VOLCENGINE_MODEL_ID
        USE_BOT_API = False
    else:
        API_URL = VOLCENGINE_BOT_API_URL
        MODEL_ID = VOLCENGINE_BOT_ID  # 使用 Bot ID 作为模型名称
        USE_BOT_API = True
    USE_VOLCENGINE = True
    logger.info("使用火山引擎 DeepSeek v3.1 联网版本")
else:
    API_KEY = DEEPSEEK_API_KEY
    API_URL = DEEPSEEK_API_URL
    MODEL_ID = "deepseek-chat"
    USE_VOLCENGINE = False
    USE_BOT_API = False
    logger.info("使用原始 DeepSeek API")

# 会话存储 - 在生产环境中应该使用Redis或数据库
conversation_sessions = {}

# HTTP timeouts (connect, read)
CONNECT_TIMEOUT = 5
READ_TIMEOUT = 30
STREAM_READ_TIMEOUT = 65

# 注意：使用火山引擎 DeepSeek v3.1 联网版本时，不再需要静态引用数据库
# v3.1 版本会自动进行联网搜索并提供实时引用

def _auth_headers():
    """
    Verify the API key and return appropriate headers
    """
    if not API_KEY:
        logger.error("API_KEY not found in environment variables")
        return None
    
    if USE_VOLCENGINE:
        # 火山引擎 DeepSeek v3.1 请求头
        headers = {
            'Authorization': f'Bearer {API_KEY}',
            'Content-Type': 'application/json'
        }
        
        # Bot API 使用标准请求头，不需要额外参数
            
        return headers
    else:
        # 原始 DeepSeek API 请求头
        return {
            'Authorization': f'Bearer {API_KEY}',
            'Content-Type': 'application/json'
        }

# 注意：使用火山引擎 DeepSeek v3.1 联网版本时，不再需要这些函数
# v3.1 版本会自动进行联网搜索并提供实时引用，无需手动匹配关键字或生成静态引用

def _get_or_create_session(session_id):
    """
    获取或创建会话
    """
    if session_id not in conversation_sessions:
        conversation_sessions[session_id] = {
            'messages': [],
            'created_at': datetime.now(),
            'last_activity': datetime.now()
        }
    else:
        # 更新最后活动时间
        conversation_sessions[session_id]['last_activity'] = datetime.now()
    
    return conversation_sessions[session_id]

def _cleanup_old_sessions():
    """
    清理超过24小时的旧会话
    """
    cutoff_time = datetime.now() - timedelta(hours=24)
    to_remove = []
    
    for session_id, session_data in conversation_sessions.items():
        if session_data['last_activity'] < cutoff_time:
            to_remove.append(session_id)
    
    for session_id in to_remove:
        del conversation_sessions[session_id]
        logger.info(f"Cleaned up old session: {session_id}")

@deepseek_blueprint.route('/chat', methods=['POST'])
def deepseek_chat():
    """Traditional chat interface - Complete return reply"""
    if request.method == 'OPTIONS':
        return '', 200
    try:
        user_input = (request.get_json(silent=True) or {}).get('message', '')
        session_id = (request.get_json(silent=True) or {}).get('session_id', str(uuid.uuid4()))
        
        logger.info("/deepseek/chat request message_len=%d session_id=%s", len(user_input or ""), session_id)
        if not user_input:
            logger.warning("/deepseek/chat missing message in request")
            return jsonify({'error': '缺少消息内容'}), 400

        # 获取或创建会话
        session = _get_or_create_session(session_id)
        
        # 检测医疗主题
        # v3.1 版本会自动进行联网搜索并提供实时引用
        medical_topics = []
        citations = []
        
        # 构建系统提示词，包含医疗免责声明
        system_prompt = """你是一个专业的健康助手。请记住以下重要原则：

1. 你提供的所有健康建议仅供参考，不能替代专业医疗诊断或治疗
2. 对于任何健康问题，建议用户咨询专业医生
3. 在回答中，请始终强调"建议咨询专业医生"的重要性
4. 保持对话的连贯性，记住之前的对话内容
5. 始终强调个人差异，建议个性化咨询
6. 使用联网搜索功能获取最新的权威医疗信息
7. 在回答中提供相关的权威来源引用

请用中文回答用户的问题。"""
        
        # 构建消息历史
        messages = [{"role": "system", "content": system_prompt}]
        
        # 添加历史消息（最多保留10轮对话）
        history_messages = session['messages'][-20:]  # 保留最近10轮对话
        messages.extend(history_messages)
        
        # 添加当前用户消息
        messages.append({"role": "user", "content": user_input})
        
        # 使用配置的模型ID
        model_name = MODEL_ID
        
        data = {
            "model": model_name,
            "messages": messages,
            "temperature": 0.7
        }
        
        # Bot API 使用标准格式，不需要额外参数
        if USE_VOLCENGINE and USE_BOT_API:
            data["stream"] = False  # Bot API 可能不支持流式

        logger.info("/deepseek/chat calling provider model=%s temperature=%s", model_name, 0.7)
        _h = _auth_headers()
        if _h is None:
            error_msg = '服务器配置错误: 缺少 ARK_API_KEY 和 (VOLCENGINE_MODEL_ID 或 VOLCENGINE_BOT_ID)' if USE_VOLCENGINE else '服务器配置错误: 缺少 DEEPSEEK_API_KEY'
            return jsonify({'error': error_msg}), 500
        response = requests.post(API_URL, headers=_h, json=data, timeout=(CONNECT_TIMEOUT, READ_TIMEOUT))

        logger.info("/deepseek/chat provider status=%s", response.status_code)
        if response.status_code == 200:
            result = response.json()
            reply = result['choices'][0]['message']['content']
            
            # 保存对话历史
            session['messages'].append({"role": "user", "content": user_input})
            session['messages'].append({"role": "assistant", "content": reply})
            
            # 基于AI回答内容分析医疗主题并生成引用
            # v3.1 版本会自动进行联网搜索并提供实时引用
            response_topics = []
            all_topics = []
            citations = []
            
            # 添加引用信息
            # v3.1 版本会自动在回答中包含引用，无需手动添加
            
            # 添加医疗免责声明
            disclaimer = "\n\n⚠️ **重要医疗免责声明**：\n\n" \
                        "• 以上所有健康建议仅供参考，不能替代专业医疗诊断或治疗\n" \
                        "• 每个人的身体状况不同，建议咨询专业医生进行个性化诊断\n" \
                        "• 如有任何健康问题或疑虑，请及时就医\n" \
                        "• 本应用不承担任何医疗责任，用户需自行承担健康风险"
            reply += disclaimer
            
            logger.info("/deepseek/chat success reply_len=%d", len(reply or ""))
            return jsonify({
                'reply': reply,
                # v3.1 版本会自动提供引用，无需手动返回
                'session_id': session_id
            })
        else:
            logger.warning("/deepseek/chat provider error status=%s body_len=%d", response.status_code, len(response.text or ""))
            return jsonify({'error': response.text}), response.status_code
        
    except Exception as e:
        logger.exception("/deepseek/chat server error: %s", e)
        return jsonify({"success": False, "message": "服务器错误", "error": str(e)}), 500

@deepseek_blueprint.route('/chat_stream', methods=['POST'])
def deepseek_chat_stream():
    """Streaming chat interface - Supports returning word by word"""
    if request.method == 'OPTIONS':
        return '', 200
    try:
        user_input = (request.get_json(silent=True) or {}).get('message', '')
        session_id = (request.get_json(silent=True) or {}).get('session_id', str(uuid.uuid4()))
        
        logger.info("/deepseek/chat_stream request message_len=%d session_id=%s", len(user_input or ""), session_id)
        if not user_input:
            logger.warning("/deepseek/chat_stream missing message in request")
            return jsonify({'error': '缺少信息'}), 400

        # 获取或创建会话
        session = _get_or_create_session(session_id)
        
        # 检测医疗主题
        # v3.1 版本会自动进行联网搜索并提供实时引用
        medical_topics = []
        citations = []
        
        # 构建系统提示词，包含医疗免责声明
        system_prompt = """你是一个专业的健康助手。请记住以下重要原则：

1. 你提供的所有健康建议仅供参考，不能替代专业医疗诊断或治疗
2. 对于任何健康问题，建议用户咨询专业医生
3. 在回答中，请始终强调"建议咨询专业医生"的重要性
4. 保持对话的连贯性，记住之前的对话内容
5. 始终强调个人差异，建议个性化咨询
6. 使用联网搜索功能获取最新的权威医疗信息
7. 在回答中提供相关的权威来源引用

请用中文回答用户的问题。"""
        
        # 构建消息历史
        messages = [{"role": "system", "content": system_prompt}]
        
        # 添加历史消息（最多保留10轮对话）
        history_messages = session['messages'][-20:]  # 保留最近10轮对话
        messages.extend(history_messages)
        
        # 添加当前用户消息
        messages.append({"role": "user", "content": user_input})
        
        # 使用配置的模型ID
        model_name = MODEL_ID
        
        data = {
            "model": model_name,
            "messages": messages,
            "temperature": 0.7
        }
        
        # Bot API 使用标准格式，不需要额外参数
        if USE_VOLCENGINE and USE_BOT_API:
            data["stream"] = False  # Bot API 可能不支持流式

        logger.info("/deepseek/chat_stream calling provider model=%s temperature=%s", model_name, 0.7)
        _h = _auth_headers()
        if _h is None:
            error_msg = '服务器配置错误: 缺少 ARK_API_KEY 和 (VOLCENGINE_MODEL_ID 或 VOLCENGINE_BOT_ID)' if USE_VOLCENGINE else '服务器配置错误: 缺少 DEEPSEEK_API_KEY'
            return jsonify({'error': error_msg}), 500
        
        # 添加流式参数
        data["stream"] = True
        response = requests.post(API_URL, headers=_h, json=data, stream=True, timeout=(CONNECT_TIMEOUT, STREAM_READ_TIMEOUT))

        logger.info("/deepseek/chat_stream provider status=%s", response.status_code)
        if response.status_code == 200:
            def generate():
                logger.info("/deepseek/chat_stream stream start")
                full_text = ""
                try:
                    for line in response.iter_lines():
                        if line:
                            line = line.decode('utf-8')
                            if line.startswith('data: '):
                                data_str = line[6:]
                                if data_str == '[DONE]':
                                    # 保存对话历史
                                    session['messages'].append({"role": "user", "content": user_input})
                                    session['messages'].append({"role": "assistant", "content": full_text})
                                    
                                    # 基于AI回答内容分析医疗主题并生成引用
                                    # v3.1 版本会自动进行联网搜索并提供实时引用
                                    
                                    # 添加医疗免责声明
                                    disclaimer = "\n\n⚠️ **重要提醒**：以上建议仅供参考，不能替代专业医疗诊断或治疗。如有健康问题，请及时咨询专业医生。"
                                    yield f"data: {json.dumps({'content': disclaimer, 'type': 'disclaimer'})}\n\n"
                                    break
                                try:
                                    chunk = json.loads(data_str)
                                    if 'choices' in chunk and len(chunk['choices']) > 0:
                                        delta = chunk['choices'][0].get('delta', {})
                                        if 'content' in delta:
                                            content = delta['content']
                                            full_text += content
                                            yield f"data: {json.dumps({'content': content, 'type': 'content'})}\n\n"
                                except json.JSONDecodeError:
                                    logger.debug("/deepseek/chat_stream non-json line encountered")
                                    continue
                except Exception as e:
                    logger.exception("/deepseek/chat_stream stream error: %s", e)
                    yield f"data: {json.dumps({'error': str(e), 'type': 'error'})}\n\n"
                finally:
                    logger.info("/deepseek/chat_stream stream end")
                    yield "data: [DONE]\n\n"

            return Response(generate(), mimetype='text/event-stream', headers={'Cache-Control': 'no-cache', 'X-Accel-Buffering': 'no'})
        else:
            logger.warning("/deepseek/chat_stream provider error status=%s body_len=%d", response.status_code, len(response.text or ""))
            return jsonify({'error': response.text}), response.status_code
        
    except Exception as e:
        logger.exception("/deepseek/chat_stream server error: %s", e)
        return jsonify({"success": False, "message": "服务器错误", "error": str(e)}), 500

# 注意：已删除不需要的接口
# - /structured: 结构化数据提取接口
# - /clear_session: 清除会话接口  
# - /session_info: 会话信息接口
# 现在只保留核心的聊天功能：/chat 和 /chat_stream

# 定期清理旧会话
_cleanup_old_sessions()