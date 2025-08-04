import requests

# 替换为你的 API 密钥
API_KEY = 'your-deepseek-api-key'

# DeepSeek 的 API 地址（兼容 OpenAI 接口）
API_URL = 'https://api.deepseek.com/v1/chat/completions'

# 构建请求数据
headers = {
    'Content-Type': 'application/json',
    'Authorization': f'Bearer {API_KEY}'
}

data = {
    "model": "deepseek-chat",
    "messages": [
        {"role": "system", "content": "You are a helpful assistant."},
        {"role": "user", "content": "什么是量子计算？"}
    ],
    "temperature": 0.7
}

# 发送请求
response = requests.post(API_URL, headers=headers, json=data)

# 解析响应
if response.status_code == 200:
    result = response.json()
    reply = result['choices'][0]['message']['content']
    print("AI 回复：", reply)
else:
    print("请求失败：", response.status_code)
    print(response.text)