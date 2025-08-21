import os
import logging
from dotenv import load_dotenv
from flask import Blueprint, request, jsonify, Response, stream_template
import json
import requests

load_dotenv()

logger = logging.getLogger("app.deepseek")

deepseek_blueprint = Blueprint('deepseek', __name__)
API_KEY = os.getenv('DEEPSEEK_API_KEY')
API_URL = 'https://api.deepseek.com/v1/chat/completions'

headers = {
    'Content-Type': 'application/json',
    'Authorization': f'Bearer {API_KEY}'
}

# HTTP timeouts (connect, read)
CONNECT_TIMEOUT = 5
READ_TIMEOUT = 30
STREAM_READ_TIMEOUT = 65

def _auth_headers():
    key = os.getenv('DEEPSEEK_API_KEY')
    if not key:
        logger.error("/deepseek missing DEEPSEEK_API_KEY env")
        return None
    return {
        'Content-Type': 'application/json',
        'Authorization': f'Bearer {key}'
    }

@deepseek_blueprint.route('/chat', methods=['POST'])
def deepseek_chat():
    """传统聊天接口 - 完整返回回复"""
    if request.method == 'OPTIONS':
        return '', 200
    try:
        user_input = (request.get_json(silent=True) or {}).get('message', '')
        logger.info("/deepseek/chat request message_len=%d", len(user_input or ""))
        if not user_input:
            logger.warning("/deepseek/chat missing message in request")
            return jsonify({'error': 'Missing message'}), 400

        data = {
            "model": "deepseek-chat",
            "messages": [
                {"role": "system", "content": "You are a helpful assistant."},
                {"role": "user", "content": user_input}
            ],
            "temperature": 0.7
        }

        logger.info("/deepseek/chat calling provider model=%s temperature=%s", "deepseek-chat", 0.7)
        _h = _auth_headers()
        if _h is None:
            return jsonify({'error': 'Server misconfigured: missing DEEPSEEK_API_KEY'}), 500
        response = requests.post(API_URL, headers=_h, json=data, timeout=(CONNECT_TIMEOUT, READ_TIMEOUT))

        logger.info("/deepseek/chat provider status=%s", response.status_code)
        if response.status_code == 200:
            result = response.json()
            reply = result['choices'][0]['message']['content']
            logger.info("/deepseek/chat success reply_len=%d", len(reply or ""))
            return jsonify({'reply': reply})
        else:
            logger.warning("/deepseek/chat provider error status=%s body_len=%d", response.status_code, len(response.text or ""))
            return jsonify({'error': response.text}), response.status_code
        
    except Exception as e:
        logger.exception("/deepseek/chat server error: %s", e)
        return jsonify({"success": False, "message": "服务器错误", "error": str(e)}), 500

@deepseek_blueprint.route('/chat_stream', methods=['POST'])
def deepseek_chat_stream():
    """流式聊天接口 - 支持一个字一个字返回"""
    if request.method == 'OPTIONS':
        return '', 200
    try:
        user_input = (request.get_json(silent=True) or {}).get('message', '')
        logger.info("/deepseek/chat_stream request message_len=%d", len(user_input or ""))
        if not user_input:
            logger.warning("/deepseek/chat_stream missing message in request")
            return jsonify({'error': 'Missing message'}), 400

        data = {
            "model": "deepseek-chat",
            "messages": [
                {"role": "system", "content": "You are a helpful assistant."},
                {"role": "user", "content": user_input}
            ],
            "temperature": 0.7,
            "stream": True
        }

        logger.info("/deepseek/chat_stream calling provider model=%s temperature=%s stream=%s", "deepseek-chat", 0.7, True)
        _h = _auth_headers()
        if _h is None:
            return jsonify({'error': 'Server misconfigured: missing DEEPSEEK_API_KEY'}), 500
        response = requests.post(API_URL, headers=_h, json=data, stream=True, timeout=(CONNECT_TIMEOUT, STREAM_READ_TIMEOUT))

        logger.info("/deepseek/chat_stream provider status=%s", response.status_code)
        if response.status_code == 200:
            def generate():
                logger.info("/deepseek/chat_stream stream start")
                try:
                    for line in response.iter_lines():
                        if line:
                            line = line.decode('utf-8')
                            if line.startswith('data: '):
                                data_str = line[6:]
                                if data_str == '[DONE]':
                                    break
                                try:
                                    chunk = json.loads(data_str)
                                    if 'choices' in chunk and len(chunk['choices']) > 0:
                                        delta = chunk['choices'][0].get('delta', {})
                                        if 'content' in delta:
                                            content = delta['content']
                                            # debug: chunk length only, never log full content
                                            logger.debug("/deepseek/chat_stream chunk len=%d", len(content or ""))
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
    if request.method == 'OPTIONS':
        return '', 200
    try:
        user_input = (request.get_json(silent=True) or {}).get('message', '')
        logger.info("/deepseek/structured request message_len=%d", len(user_input or ""))
        if not user_input:
            logger.warning("/deepseek/structured missing message in request")
            return jsonify({'error': 'Missing message'}), 400

        data = {
            "model": "deepseek-chat",
            "messages": [
                {
                    "role": "system",
                    "content": "你是一个健康助手，善于从自然语言中提取结构化健康数据。请你根据用户的描述，整理出日期、饮食内容、身体症状三部分，并返回一个标准 JSON 对象。"
                },
                {
                    "role": "user",
                    "content": f"请从以下记录中提取信息，并以 JSON 格式返回（字段包括：日期、饮食、身体症状）。\n\n{user_input}"
                }
            ],
            "temperature": 0.3
        }

        logger.info("/deepseek/structured calling provider model=%s temperature=%s", "deepseek-chat", 0.3)
        _h = _auth_headers()
        if _h is None:
            return jsonify({'error': 'Server misconfigured: missing DEEPSEEK_API_KEY'}), 500
        response = requests.post(API_URL, headers=_h, json=data, timeout=(CONNECT_TIMEOUT, READ_TIMEOUT))

        logger.info("/deepseek/structured provider status=%s", response.status_code)
        if response.status_code == 200:
            result = response.json()
            reply = result['choices'][0]['message']['content']
            logger.info("/deepseek/structured success reply_len=%d", len(reply or ""))
            # 去除 markdown 包裹
            if reply.startswith("```json"):
                reply = reply.strip("`")  # 去掉所有反引号
                reply = reply.replace("json", "", 1).strip()  # 去掉 "json" 标签
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