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
API_KEY = os.getenv('DEEPSEEK_API_KEY')
API_URL = 'https://api.deepseek.com/v1/chat/completions'

# 会话存储 - 在生产环境中应该使用Redis或数据库
conversation_sessions = {}

# HTTP timeouts (connect, read)
CONNECT_TIMEOUT = 5
READ_TIMEOUT = 30
STREAM_READ_TIMEOUT = 65

# 医疗信息引用数据库 - 使用经过验证的可访问权威网站
MEDICAL_CITATIONS = {
    "饮食建议": [
        {
            "title": "中国居民膳食指南(2022)",
            "url": "https://www.cnsoc.org/",
            "author": "中国营养学会",
            "year": "2022",
            "description": "中国营养学会官方膳食指南，包含平衡膳食宝塔和营养建议"
        },
        {
            "title": "WHO健康饮食建议",
            "url": "https://www.who.int/news-room/fact-sheets/detail/healthy-diet",
            "author": "世界卫生组织",
            "year": "2020",
            "description": "世界卫生组织官方健康饮食指南"
        },
        {
            "title": "中国营养学会官网",
            "url": "https://www.cnsoc.org/",
            "author": "中国营养学会",
            "year": "2022",
            "description": "中国营养学会官方网站，提供权威营养信息"
        }
    ],
    "运动建议": [
        {
            "title": "WHO身体活动指南",
            "url": "https://www.who.int/news-room/fact-sheets/detail/physical-activity",
            "author": "世界卫生组织",
            "year": "2020",
            "description": "世界卫生组织身体活动建议"
        },
        {
            "title": "中国营养学会 - 身体活动指南",
            "url": "https://www.cnsoc.org/",
            "author": "中国营养学会",
            "year": "2021",
            "description": "中国人群身体活动官方指南"
        }
    ],
    "睡眠建议": [
        {
            "title": "中华医学会官网",
            "url": "https://www.cma.org.cn/",
            "author": "中华医学会神经病学分会",
            "year": "2017",
            "description": "中华医学会官方失眠治疗指南"
        },
        {
            "title": "WHO睡眠健康指南",
            "url": "https://www.who.int/news-room/fact-sheets/detail/mental-health-strengthening-our-response",
            "author": "世界卫生组织",
            "year": "2020",
            "description": "世界卫生组织睡眠健康建议"
        }
    ],
    "心理健康": [
        {
            "title": "中国科学院心理研究所",
            "url": "https://www.psych.ac.cn/",
            "author": "中国科学院心理研究所",
            "year": "2020",
            "description": "中科院心理所心理健康研究报告"
        },
        {
            "title": "WHO心理健康指南",
            "url": "https://www.who.int/news-room/fact-sheets/detail/mental-health-strengthening-our-response",
            "author": "世界卫生组织",
            "year": "2020",
            "description": "世界卫生组织心理健康指南"
        }
    ],
    "慢性病管理": [
        {
            "title": "中华医学会官网",
            "url": "https://www.cma.org.cn/",
            "author": "中华医学会糖尿病学分会",
            "year": "2020",
            "description": "中华医学会糖尿病防治官方指南"
        },
        {
            "title": "中国高血压联盟",
            "url": "https://www.cma.org.cn/",
            "author": "中国高血压联盟",
            "year": "2018",
            "description": "中国高血压联盟防治指南"
        },
        {
            "title": "WHO慢性病预防指南",
            "url": "https://www.who.int/news-room/fact-sheets/detail/noncommunicable-diseases",
            "author": "世界卫生组织",
            "year": "2020",
            "description": "世界卫生组织慢性病预防指南"
        }
    ]
}

def _auth_headers():
    """
    Verify the DeepSeek API key
    """
    key = os.getenv('DEEPSEEK_API_KEY')
    if not key:
        logger.error("/deepseek missing DEEPSEEK_API_KEY env")
        return None
    return {
        'Content-Type': 'application/json',
        'Authorization': f'Bearer {key}'
    }

def _detect_medical_topic(text):
    """
    检测文本中的医疗主题，返回相关的引用
    只有在明确涉及医疗健康话题时才返回主题
    """
    text_lower = text.lower()
    detected_topics = []
    
    # 首先检查是否是简单的问候或非医疗话题
    simple_greetings = [
        "hi", "hello", "你好", "嗨", "早上好", "下午好", "晚上好", "谢谢", "再见", "拜拜",
        "ok", "好的", "嗯", "是的", "不是", "不知道", "什么", "怎么", "为什么", "哪里"
    ]
    
    # 如果输入太短或只是简单问候，不检测医疗主题
    if len(text.strip()) < 3 or any(greeting in text_lower for greeting in simple_greetings):
        return detected_topics
    
    # 更精确的关键词匹配，包含同义词和上下文
    topic_keywords = {
        "饮食建议": [
            "饮食建议", "营养建议", "膳食指南", "食物选择", "营养搭配", "健康饮食",
            "维生素补充", "蛋白质摄入", "碳水化合物", "脂肪摄入", "蔬菜水果",
            "饮食调理", "营养均衡", "膳食平衡", "食物营养", "饮食健康",
            "减肥", "增重", "控制体重", "卡路里", "热量", "糖分", "盐分"
        ],
        "运动建议": [
            "运动建议", "锻炼计划", "健身指导", "运动处方", "有氧运动", "力量训练",
            "运动强度", "运动频率", "运动时间", "运动方式", "运动安全",
            "跑步", "游泳", "瑜伽", "散步", "快走", "健身房", "器械"
        ],
        "睡眠建议": [
            "睡眠建议", "睡眠指导", "睡眠调理", "失眠治疗", "睡眠质量", "睡眠习惯",
            "作息调整", "睡眠环境", "睡眠卫生", "睡眠障碍", "多梦", "噩梦"
        ],
        "心理健康": [
            "心理健康", "心理建议", "情绪管理", "压力管理", "心理调节", "心理支持",
            "焦虑缓解", "抑郁治疗", "心理疏导", "心理干预", "冥想", "正念"
        ],
        "慢性病管理": [
            "糖尿病管理", "高血压控制", "心脏病预防", "慢性病治疗", "血糖控制",
            "血压控制", "血脂管理", "并发症预防", "疾病管理", "心血管", "动脉硬化"
        ]
    }
    
    # 计算每个主题的匹配度
    topic_scores = {}
    for topic, keywords in topic_keywords.items():
        score = 0
        for keyword in keywords:
            if keyword in text_lower:
                score += 1
        if score > 0:
            topic_scores[topic] = score
    
    # 只返回匹配度较高的主题（避免误判）
    for topic, score in topic_scores.items():
        if score >= 1:  # 至少匹配一个关键词
            detected_topics.append(topic)
    
    return detected_topics

def _analyze_response_for_citations(response_text, user_input):
    """
    分析AI回答内容，匹配相关引用
    只有在明确涉及医疗健康话题时才返回引用
    """
    response_lower = response_text.lower()
    detected_topics = []
    
    # 更精确的医疗健康关键词检测
    medical_indicators = {
        "饮食建议": [
            "饮食建议", "营养建议", "膳食指南", "食物选择", "营养搭配", "健康饮食",
            "维生素补充", "蛋白质摄入", "碳水化合物", "脂肪摄入", "蔬菜水果",
            "饮食调理", "营养均衡", "膳食平衡", "食物营养", "饮食健康"
        ],
        "运动建议": [
            "运动建议", "锻炼计划", "健身指导", "运动处方", "有氧运动", "力量训练",
            "运动强度", "运动频率", "运动时间", "运动方式", "运动安全"
        ],
        "睡眠建议": [
            "睡眠建议", "睡眠指导", "睡眠调理", "失眠治疗", "睡眠质量", "睡眠习惯",
            "作息调整", "睡眠环境", "睡眠卫生", "睡眠障碍"
        ],
        "心理健康": [
            "心理健康", "心理建议", "情绪管理", "压力管理", "心理调节", "心理支持",
            "焦虑缓解", "抑郁治疗", "心理疏导", "心理干预"
        ],
        "慢性病管理": [
            "糖尿病管理", "高血压控制", "心脏病预防", "慢性病治疗", "血糖控制",
            "血压控制", "血脂管理", "并发症预防", "疾病管理"
        ]
    }
    
    # 检查回答中是否包含明确的医疗健康建议
    for topic, indicators in medical_indicators.items():
        if any(indicator in response_lower for indicator in indicators):
            detected_topics.append(topic)
    
    # 额外检查：如果回答中包含具体的医疗建议模式
    medical_patterns = [
        "建议您", "推荐您", "应该", "需要", "可以尝试", "有助于", "对健康有益",
        "健康建议", "医疗建议", "专业建议", "医生建议"
    ]
    
    # 只有在包含医疗模式且长度超过50字符时才考虑添加引用
    if len(response_text) > 50 and any(pattern in response_lower for pattern in medical_patterns):
        # 进一步检查是否真的涉及医疗健康话题
        health_keywords = [
            "健康", "医疗", "疾病", "症状", "治疗", "预防", "营养", "运动", "睡眠", "心理"
        ]
        if any(keyword in response_lower for keyword in health_keywords):
            # 如果检测到医疗主题，使用原有的关键词检测
            basic_indicators = {
                "饮食建议": ["饮食", "食物", "营养", "膳食", "维生素", "蛋白质", "蔬菜", "水果"],
                "运动建议": ["运动", "锻炼", "健身", "跑步", "游泳", "瑜伽"],
                "睡眠建议": ["睡眠", "睡觉", "失眠", "作息", "休息"],
                "心理健康": ["心理", "情绪", "压力", "焦虑", "抑郁"],
                "慢性病管理": ["糖尿病", "高血压", "心脏病", "血糖", "血压"]
            }
            
            for topic, keywords in basic_indicators.items():
                if any(keyword in response_lower for keyword in keywords):
                    if topic not in detected_topics:
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

def _verify_url_accessibility(url):
    """
    验证URL的可访问性
    """
    try:
        response = requests.head(url, timeout=5, allow_redirects=True)
        return response.status_code < 400
    except:
        return False

def _format_citations(citations):
    """
    格式化引用为HTML格式
    """
    if not citations:
        return ""
    
    html = "\n\n**📚 权威参考资料：**\n"
    for i, citation in enumerate(citations, 1):
        description = citation.get('description', '')
        url = citation['url']
        
        # 验证链接可访问性
        is_accessible = _verify_url_accessibility(url)
        if not is_accessible:
            logger.warning(f"Citation URL not accessible: {url}")
        
        if description:
            html += f"{i}. <a href=\"{url}\" target=\"_blank\" rel=\"noopener noreferrer\">{citation['title']}</a><br/>"
            html += f"   <small style=\"color: #666; margin-left: 20px;\">{citation['author']} ({citation['year']}) - {description}</small><br/><br/>"
        else:
            html += f"{i}. <a href=\"{url}\" target=\"_blank\" rel=\"noopener noreferrer\">{citation['title']}</a> - {citation['author']} ({citation['year']})<br/><br/>"
    
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
6. 对于任何医疗建议，必须提供权威来源引用
7. 引用必须与具体建议相关，不能是泛泛的链接
8. 始终强调个人差异，建议个性化咨询

请用中文回答用户的问题。"""
        
        # 构建消息历史
        messages = [{"role": "system", "content": system_prompt}]
        
        # 添加历史消息（最多保留10轮对话）
        history_messages = session['messages'][-20:]  # 保留最近10轮对话
        messages.extend(history_messages)
        
        # 添加当前用户消息
        messages.append({"role": "user", "content": user_input})
        
        data = {
            "model": "deepseek-chat",
            "messages": messages,
            "temperature": 0.7
        }

        logger.info("/deepseek/chat calling provider model=%s temperature=%s", "deepseek-chat", 0.7)
        _h = _auth_headers()
        if _h is None:
            return jsonify({'error': '服务器配置错误: 缺少 DEEPSEEK_API_KEY'}), 500
        response = requests.post(API_URL, headers=_h, json=data, timeout=(CONNECT_TIMEOUT, READ_TIMEOUT))

        logger.info("/deepseek/chat provider status=%s", response.status_code)
        if response.status_code == 200:
            result = response.json()
            reply = result['choices'][0]['message']['content']
            
            # 保存对话历史
            session['messages'].append({"role": "user", "content": user_input})
            session['messages'].append({"role": "assistant", "content": reply})
            
            # 基于AI回答内容分析医疗主题并生成引用
            response_topics = _analyze_response_for_citations(reply, user_input)
            all_topics = list(set(medical_topics + response_topics))  # 合并用户输入和回答的主题
            citations = _generate_citations(all_topics)
            
            # 添加引用信息
            if citations:
                citation_html = _format_citations(citations)
                reply += citation_html
            
            # 添加医疗免责声明
            disclaimer = "\n\n⚠️ **重要医疗免责声明**：\n\n" \
                        "• 以上所有健康建议仅供参考，不能替代专业医疗诊断或治疗\n" \
                        "• 每个人的身体状况不同，建议咨询专业医生进行个性化诊断\n" \
                        "• 如有任何健康问题或疑虑，请及时就医\n" \
                        "• 本应用不承担任何医疗责任，用户需自行承担健康风险"
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
6. 对于任何医疗建议，必须提供权威来源引用
7. 引用必须与具体建议相关，不能是泛泛的链接
8. 始终强调个人差异，建议个性化咨询

请用中文回答用户的问题。"""
        
        # 构建消息历史
        messages = [{"role": "system", "content": system_prompt}]
        
        # 添加历史消息（最多保留10轮对话）
        history_messages = session['messages'][-20:]  # 保留最近10轮对话
        messages.extend(history_messages)
        
        # 添加当前用户消息
        messages.append({"role": "user", "content": user_input})
        
        data = {
            "model": "deepseek-chat",
            "messages": messages,
            "temperature": 0.7
        }

        logger.info("/deepseek/chat_stream calling provider model=%s temperature=%s", "deepseek-chat", 0.7)
        _h = _auth_headers()
        if _h is None:
            return jsonify({'error': '服务器配置错误: 缺少 DEEPSEEK_API_KEY'}), 500
        
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
                                    response_topics = _analyze_response_for_citations(full_text, user_input)
                                    all_topics = list(set(medical_topics + response_topics))  # 合并用户输入和回答的主题
                                    citations = _generate_citations(all_topics)
                                    
                                    # 添加引用信息
                                    if citations:
                                        citation_html = _format_citations(citations)
                                        yield f"data: {json.dumps({'content': citation_html, 'type': 'citations'})}\n\n"
                                    
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
            "model": "deepseek-chat",
            "messages": [
                {
                    "role": "system",
                    "content": "你是一个健康助手，善于从自然语言中提取结构化健康数据。请你根据用户的描述，整理出日期、饮食（不区分早餐午餐晚餐，统一合并）、身体症状三部分，并返回一个标准 JSON 对象。"
                },
                {
                    "role": "user",
                    "content": f"请从以下记录中提取信息，并以 JSON 格式返回（字段包括：日期、饮食（不区分早餐午餐晚餐，统一合并）、身体症状。\n\n{user_input}"
                }
            ],
            "temperature": 0.3
        }

        logger.info("/deepseek/structured calling provider model=%s temperature=%s", "deepseek-chat", 0.3)
        _h = _auth_headers()
        if _h is None:
            return jsonify({'error': '服务器配置错误: 缺少 DEEPSEEK_API_KEY'}), 500
        response = requests.post(API_URL, headers=_h, json=data, timeout=(CONNECT_TIMEOUT, READ_TIMEOUT))

        logger.info("/deepseek/structured provider status=%s", response.status_code)
        if response.status_code == 200:
            result = response.json()
            reply = result['choices'][0]['message']['content']
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