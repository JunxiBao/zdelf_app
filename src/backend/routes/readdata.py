from flask import Blueprint, request, jsonify
import mysql.connector

readdata_blueprint = Blueprint('readdata', __name__)

db_config = {
    "host": "localhost",
    "user": "junxibao",
    "password": "Bjx81402",
    "database": "health"
}

@readdata_blueprint.route('/readdata', methods=['POST', 'OPTIONS'])
def readdata():
    if request.method == 'OPTIONS':
        return '', 200
    try:
        data = request.get_json(force=True)
        print("读取数据收到的请求：", data)

        table_name = data.get("table_name")
        user_id = data.get("user_id")
        username = data.get("username")
        
        if not table_name:
            return jsonify({"success": False, "message": "缺少表名参数"}), 400

        conn = mysql.connector.connect(**db_config)
        cursor = conn.cursor(dictionary=True)

        query = f"SELECT * FROM {table_name}"
        params = []
        
        if user_id:
            query += " WHERE user_id = %s"
            params.append(user_id)
        elif username:
            query += " WHERE username = %s"
            params.append(username)
        
        print(f"执行查询: {query} 参数: {params}")
        
        cursor.execute(query, params)
        results = cursor.fetchall()

        cursor.close()
        conn.close()

        return jsonify({
            "success": True, 
            "message": "数据读取成功",
            "data": results,
            "count": len(results)
        })

    except Exception as e:
        print("❌ 读取数据错误：", e)
        return jsonify({"success": False, "message": "服务器错误", "error": str(e)}), 500