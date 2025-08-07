import os
from dotenv import load_dotenv
from flask import Blueprint, request, jsonify
import json
import requests

load_dotenv()

deepseek_blueprint = Blueprint('deepseek', __name__)
API_KEY = os.getenv('DEEPSEEK_API_KEY')
API_URL = 'https://api.deepseek.com'

headers = {
    'Content-Type': 'application/json',
    'Authorization': f'Bearer {API_KEY}'
}

@deepseek_blueprint.route('/deepseek', methods=['POST'])
def deepseek_chat():
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


# 新增结构化提取路由
@deepseek_blueprint.route('/deepseek/structured', methods=['POST'])
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