import os
from dotenv import load_dotenv
from flask import Blueprint, request, jsonify, Response, stream_template
import json
import requests
import time

load_dotenv()

deepseek_blueprint = Blueprint('deepseek', __name__)
API_KEY = os.getenv('DEEPSEEK_API_KEY')
API_URL = 'https://api.deepseek.com/v1/chat/completions'

headers = {
    'Content-Type': 'application/json',
    'Authorization': f'Bearer {API_KEY}'
}

@deepseek_blueprint.route('/chat', methods=['POST'])
def deepseek_chat():
    """传统聊天接口 - 完整返回回复"""
    if request.method == 'OPTIONS':
        return '', 200
    try:
        user_input = request.json.get('message', '')
        if not user_input:
            return jsonify({'error': 'Missing message'}), 400

        data = {
            "model": "deepseek-chat",
            "messages": [
                {"role": "system", "content": "You are a helpful assistant."},
                {"role": "user", "content": user_input}
            ],
            "temperature": 0.7
        }

        response = requests.post(API_URL, headers=headers, json=data)

        if response.status_code == 200:
            result = response.json()
            reply = result['choices'][0]['message']['content']
            return jsonify({'reply': reply})
        else:
            return jsonify({'error': response.text}), response.status_code
        
    except Exception as e:
        print("❌ deepseek请求错误：", e)
        return jsonify({"success": False, "message": "服务器错误", "error": str(e)}), 500

@deepseek_blueprint.route('/chat_stream', methods=['POST'])
def deepseek_chat_stream():
    """流式聊天接口 - 支持一个字一个字返回"""
    if request.method == 'OPTIONS':
        return '', 200
    try:
        user_input = request.json.get('message', '')
        if not user_input:
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

        response = requests.post(API_URL, headers=headers, json=data, stream=True)

        if response.status_code == 200:
            def generate():
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
                                            # 返回完整的文本块，前端处理打字效果
                                            yield f"data: {json.dumps({'content': content, 'type': 'content'})}\n\n"
                                except json.JSONDecodeError:
                                    continue
                except Exception as e:
                    print(f"流式响应错误: {e}")
                    yield f"data: {json.dumps({'error': str(e), 'type': 'error'})}\n\n"
                finally:
                    yield "data: [DONE]\n\n"

            return Response(generate(), mimetype='text/plain')
        else:
            return jsonify({'error': response.text}), response.status_code
        
    except Exception as e:
        print("❌ deepseek流式请求错误：", e)
        return jsonify({"success": False, "message": "服务器错误", "error": str(e)}), 500




@deepseek_blueprint.route('/structured', methods=['POST'])
def deepseek_structured():
    if request.method == 'OPTIONS':
        return '', 200
    try:
        user_input = request.json.get('message', '')
        if not user_input:
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

        response = requests.post(API_URL, headers=headers, json=data)

        if response.status_code == 200:
            result = response.json()
            reply = result['choices'][0]['message']['content']
            # 去除 markdown 包裹
            if reply.startswith("```json"):
                reply = reply.strip("`")  # 去掉所有反引号
                reply = reply.replace("json", "", 1).strip()  # 去掉 "json" 标签
            try:
                parsed = json.loads(reply)
                return jsonify(parsed)
            except json.JSONDecodeError:
                return jsonify({"raw": reply})
        else:
            return jsonify({'error': response.text}), response.status_code
        
    except Exception as e:
        print("❌ deepseek/structured 请求错误：", e)
        return jsonify({"success": False, "message": "服务器错误", "error": str(e)}), 500