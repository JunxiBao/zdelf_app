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
QWEN_API_KEY = os.getenv('QWEN_API_KEY')
QWEN_API_URL = 'https://dashscope.aliyuncs.com/api/v1/services/aigc/text-generation/generation'

# 会话存储 - 在生产环境中应该使用Redis或数据库
conversation_sessions = {}

# HTTP timeouts (connect, read)
CONNECT_TIMEOUT = 5
READ_TIMEOUT = 30
STREAM_READ_TIMEOUT = 65

# 医疗信息引用数据库
MEDICAL_CITATIONS = {
    "饮食建议": [
        {
            "title": "中国居民膳食指南(2022)",
            "url": "https://www.cnsoc.org/",
            "author": "中国营养学会",
            "year": "2022"
        },
        {
            "title": "WHO健康饮食建议",
            "url": "https://www.who.int/news-room/fact-sheets/detail/healthy-diet",
            "author": "世界卫生组织",
            "year": "2020"
        },
        {
            "title": "中国营养学会官网",
            "url": "https://www.cnsoc.org/",
            "author": "中国营养学会",
            "year": "2022"
        }
    ],
    "运动建议": [
        {
            "title": "WHO身体活动指南",
            "url": "https://www.who.int/news-room/fact-sheets/detail/physical-activity",
            "author": "世界卫生组织",
            "year": "2020"
        },
        {
            "title": "中国营养学会官网",
            "url": "https://www.cnsoc.org/",
            "author": "中国营养学会",
            "year": "2021"
        }
    ],
    "睡眠建议": [
        {
            "title": "中华医学会官网",
            "url": "https://www.cma.org.cn/",
            "author": "中华医学会神经病学分会",
            "year": "2017"
        },
        {
            "title": "WHO睡眠健康指南",
            "url": "https://www.who.int/news-room/fact-sheets/detail/healthy-diet",
            "author": "世界卫生组织",
            "year": "2020"
        }
    ],
    "心理健康": [
        {
            "title": "中国科学院心理研究所",
            "url": "https://www.psych.ac.cn/",
            "author": "中国科学院心理研究所",
            "year": "2020"
        },
        {
            "title": "WHO心理健康指南",
            "url": "https://www.who.int/news-room/fact-sheets/detail/mental-health-strengthening-our-response",
            "author": "世界卫生组织",
            "year": "2020"
        }
    ],
    "慢性病管理": [
        {
            "title": "中华医学会官网",
            "url": "https://www.cma.org.cn/",
            "author": "中华医学会糖尿病学分会",
            "year": "2020"
        },
        {
            "title": "WHO慢性病预防指南",
            "url": "https://www.who.int/news-room/fact-sheets/detail/noncommunicable-diseases",
            "author": "世界卫生组织",
            "year": "2020"
        },
        {
            "title": "中国高血压联盟",
            "url": "https://www.cma.org.cn/",
            "author": "中国高血压联盟",
            "year": "2018"
        }
    ]
}

def _auth_headers():
    """
    Verify the Qwen API key
    """
    key = os.getenv('QWEN_API_KEY')
    if not key:
        logger.error("/deepseek missing QWEN_API_KEY env")
        return None
    return {
        'Content-Type': 'application/json',
        'Authorization': f'Bearer {key}'
    }

def _detect_medical_topic(text):
    """
    检测文本中的医疗主题，返回相关的引用
    """
    text_lower = text.lower()
    detected_topics = []
    
    # 关键词匹配
    topic_keywords = {
        "饮食建议": ["饮食", "食物", "营养", "膳食", "吃", "喝", "维生素", "蛋白质", "碳水化合物", "脂肪"],
        "运动建议": ["运动", "锻炼", "健身", "跑步", "游泳", "瑜伽", "有氧", "力量训练"],
        "睡眠建议": ["睡眠", "睡觉", "失眠", "熬夜", "作息", "休息"],
        "心理健康": ["心理", "情绪", "压力", "焦虑", "抑郁", "心情", "精神"],
        "慢性病管理": ["糖尿病", "高血压", "心脏病", "慢性病", "血糖", "血压", "胆固醇"]
    }
    
    for topic, keywords in topic_keywords.items():
        if any(keyword in text_lower for keyword in keywords):
            detected_topics.append(topic)
    
    return detected_topics

def _generate_citations(topics):
    """
    根据检测到的主题生成相应的引用
    """
    citations = []
    for topic in topics:
        if topic in MEDICAL_CITATIONS:
            citations.extend(MEDICAL_CITATIONS[topic])
    
    # 去重
    seen = set()
    unique_citations = []
    for citation in citations:
        citation_key = (citation['title'], citation['url'])
        if citation_key not in seen:
            seen.add(citation_key)
            unique_citations.append(citation)
    
    return unique_citations

def _format_citations(citations):
    """
    格式化引用为HTML格式
    """
    if not citations:
        return ""
    
    html = "\n\n**参考资料：**\n"
    for i, citation in enumerate(citations, 1):
        html += f"{i}. <a href=\"{citation['url']}\" target=\"_blank\" rel=\"noopener noreferrer\">{citation['title']}</a> - {citation['author']} ({citation['year']})\n"
    
    return html

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
        medical_topics = _detect_medical_topic(user_input)
        citations = _generate_citations(medical_topics)
        
        # 构建系统提示词，包含医疗免责声明
        system_prompt = """你是一个专业的健康助手。请记住以下重要原则：

1. 你提供的所有健康建议仅供参考，不能替代专业医疗诊断或治疗
2. 对于任何健康问题，建议用户咨询专业医生
3. 在回答中，请始终强调"建议咨询专业医生"的重要性
4. 如果涉及医疗建议，请在回答末尾添加相关参考资料
5. 保持对话的连贯性，记住之前的对话内容

请用中文回答用户的问题。"""
        
        # 构建消息历史
        messages = [{"role": "system", "content": system_prompt}]
        
        # 添加历史消息（最多保留10轮对话）
        history_messages = session['messages'][-20:]  # 保留最近10轮对话
        messages.extend(history_messages)
        
        # 添加当前用户消息
        messages.append({"role": "user", "content": user_input})
        
        data = {
            "model": "qwen-turbo",
            "input": {
                "messages": messages
            },
            "parameters": {
                "temperature": 0.7,
                "max_tokens": 2000
            }
        }

        logger.info("/deepseek/chat calling provider model=%s temperature=%s", "qwen-turbo", 0.7)
        _h = _auth_headers()
        if _h is None:
            return jsonify({'error': '服务器配置错误: 缺少 QWEN_API_KEY'}), 500
        response = requests.post(QWEN_API_URL, headers=_h, json=data, timeout=(CONNECT_TIMEOUT, READ_TIMEOUT))

        logger.info("/deepseek/chat provider status=%s", response.status_code)
        if response.status_code == 200:
            result = response.json()
            reply = result['output']['text']
            
            # 保存对话历史
            session['messages'].append({"role": "user", "content": user_input})
            session['messages'].append({"role": "assistant", "content": reply})
            
            # 添加引用信息
            if citations:
                citation_html = _format_citations(citations)
                reply += citation_html
            
            # 添加医疗免责声明
            disclaimer = "\n\n⚠️ **重要提醒**：以上建议仅供参考，不能替代专业医疗诊断或治疗。如有健康问题，请及时咨询专业医生。"
            reply += disclaimer
            
            logger.info("/deepseek/chat success reply_len=%d citations=%d", len(reply or ""), len(citations))
            return jsonify({
                'reply': reply,
                'citations': citations,
                'medical_topics': medical_topics,
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
        medical_topics = _detect_medical_topic(user_input)
        citations = _generate_citations(medical_topics)
        
        # 构建系统提示词，包含医疗免责声明
        system_prompt = """你是一个专业的健康助手。请记住以下重要原则：

1. 你提供的所有健康建议仅供参考，不能替代专业医疗诊断或治疗
2. 对于任何健康问题，建议用户咨询专业医生
3. 在回答中，请始终强调"建议咨询专业医生"的重要性
4. 如果涉及医疗建议，请在回答末尾添加相关参考资料
5. 保持对话的连贯性，记住之前的对话内容

请用中文回答用户的问题。"""
        
        # 构建消息历史
        messages = [{"role": "system", "content": system_prompt}]
        
        # 添加历史消息（最多保留10轮对话）
        history_messages = session['messages'][-20:]  # 保留最近10轮对话
        messages.extend(history_messages)
        
        # 添加当前用户消息
        messages.append({"role": "user", "content": user_input})
        
        data = {
            "model": "qwen-turbo",
            "input": {
                "messages": messages
            },
            "parameters": {
                "temperature": 0.7,
                "max_tokens": 2000
            }
        }

        logger.info("/deepseek/chat_stream calling provider model=%s temperature=%s", "qwen-turbo", 0.7)
        _h = _auth_headers()
        if _h is None:
            return jsonify({'error': '服务器配置错误: 缺少 QWEN_API_KEY'}), 500
        response = requests.post(QWEN_API_URL, headers=_h, json=data, timeout=(CONNECT_TIMEOUT, READ_TIMEOUT))

        logger.info("/deepseek/chat_stream provider status=%s", response.status_code)
        if response.status_code == 200:
            result = response.json()
            reply = result['output']['text']
            
            # 保存对话历史
            session['messages'].append({"role": "user", "content": user_input})
            session['messages'].append({"role": "assistant", "content": reply})
            
            def generate():
                logger.info("/deepseek/chat_stream stream start")
                try:
                    # 模拟流式响应
                    full_text = reply
                    chunk_size = 3  # 每次发送3个字符
                    
                    for i in range(0, len(full_text), chunk_size):
                        chunk = full_text[i:i + chunk_size]
                        yield f"data: {json.dumps({'content': chunk, 'type': 'content'})}\n\n"
                        # 模拟网络延迟
                        import time
                        time.sleep(0.05)
                    
                    # 添加引用信息
                    if citations:
                        citation_html = _format_citations(citations)
                        yield f"data: {json.dumps({'content': citation_html, 'type': 'citations'})}\n\n"
                    
                    # 添加医疗免责声明
                    disclaimer = "\n\n⚠️ **重要提醒**：以上建议仅供参考，不能替代专业医疗诊断或治疗。如有健康问题，请及时咨询专业医生。"
                    yield f"data: {json.dumps({'content': disclaimer, 'type': 'disclaimer'})}\n\n"
                    
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

@deepseek_blueprint.route('/structured', methods=['POST'])
def deepseek_structured():
    '''This function will extract the information input by the user into JSON format and return it'''
    if request.method == 'OPTIONS':
        return '', 200
    try:
        user_input = (request.get_json(silent=True) or {}).get('message', '')
        logger.info("/deepseek/structured request message_len=%d", len(user_input or ""))
        if not user_input:
            logger.warning("/deepseek/structured missing message in request")
            return jsonify({'error': '缺少信息'}), 400

        data = {
            "model": "qwen-turbo",
            "input": {
                "messages": [
                    {
                        "role": "system",
                        "content": "你是一个健康助手，善于从自然语言中提取结构化健康数据。请你根据用户的描述，整理出日期、饮食（不区分早餐午餐晚餐，统一合并）、身体症状三部分，并返回一个标准 JSON 对象。"
                    },
                    {
                        "role": "user",
                        "content": f"请从以下记录中提取信息，并以 JSON 格式返回（字段包括：日期、饮食（不区分早餐午餐晚餐，统一合并）、身体症状。\n\n{user_input}"
                    }
                ]
            },
            "parameters": {
                "temperature": 0.3,
                "max_tokens": 1000
            }
        }

        logger.info("/deepseek/structured calling provider model=%s temperature=%s", "qwen-turbo", 0.3)
        _h = _auth_headers()
        if _h is None:
            return jsonify({'error': '服务器配置错误: 缺少 QWEN_API_KEY'}), 500
        response = requests.post(QWEN_API_URL, headers=_h, json=data, timeout=(CONNECT_TIMEOUT, READ_TIMEOUT))

        logger.info("/deepseek/structured provider status=%s", response.status_code)
        if response.status_code == 200:
            result = response.json()
            reply = result['output']['text']
            logger.info("/deepseek/structured success reply_len=%d", len(reply or ""))
            # Remove the markdown package
            if reply.startswith("```json"):
                reply = reply.strip("`")  # Remove all backticks
                reply = reply.replace("json", "", 1).strip()  # Remove the "json" label
            try:
                parsed = json.loads(reply)
                try_keys = list(parsed.keys()) if isinstance(parsed, dict) else None
                logger.info("/deepseek/structured parsed_json keys=%s", try_keys)
                return jsonify(parsed)
            except json.JSONDecodeError:
                logger.warning("/deepseek/structured json decode failed returning raw reply_len=%d", len(reply or ""))
                return jsonify({"raw": reply})
        else:
            logger.warning("/deepseek/structured provider error status=%s body_len=%d", response.status_code, len(response.text or ""))
            return jsonify({'error': response.text}), response.status_code
        
    except Exception as e:
        logger.exception("/deepseek/structured server error: %s", e)
        return jsonify({"success": False, "message": "服务器错误", "error": str(e)}), 500

@deepseek_blueprint.route('/clear_session', methods=['POST'])
def clear_session():
    """清除会话历史"""
    if request.method == 'OPTIONS':
        return '', 200
    try:
        session_id = (request.get_json(silent=True) or {}).get('session_id', '')
        if session_id and session_id in conversation_sessions:
            del conversation_sessions[session_id]
            logger.info("Cleared session: %s", session_id)
            return jsonify({'success': True, 'message': '会话已清除'})
        else:
            return jsonify({'error': '会话不存在'}), 404
    except Exception as e:
        logger.exception("/deepseek/clear_session server error: %s", e)
        return jsonify({"success": False, "message": "服务器错误", "error": str(e)}), 500

@deepseek_blueprint.route('/session_info', methods=['GET'])
def session_info():
    """获取会话信息"""
    try:
        session_id = request.args.get('session_id', '')
        if session_id and session_id in conversation_sessions:
            session = conversation_sessions[session_id]
            return jsonify({
                'session_id': session_id,
                'message_count': len(session['messages']),
                'created_at': session['created_at'].isoformat(),
                'last_activity': session['last_activity'].isoformat()
            })
        else:
            return jsonify({'error': '会话不存在'}), 404
    except Exception as e:
        logger.exception("/deepseek/session_info server error: %s", e)
        return jsonify({"success": False, "message": "服务器错误", "error": str(e)}), 500

# 定期清理旧会话
_cleanup_old_sessions()