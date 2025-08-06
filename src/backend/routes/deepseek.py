import os
from dotenv import load_dotenv
from flask import Blueprint, request, jsonify
import requests

load_dotenv()

deepseek_blueprint = Blueprint('deepseek', __name__)
API_KEY = os.getenv('DEEPSEEK_API_KEY')
API_URL = 'https://api.deepseek.com/v1/chat/completions'

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