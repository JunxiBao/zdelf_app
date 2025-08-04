from flask import Flask
from flask_cors import CORS
from routes.login import login_blueprint
from routes.register import register_blueprint
from routes.readdata import readdata_blueprint

app = Flask(__name__)
app.register_blueprint(login_blueprint)
app.register_blueprint(register_blueprint)
app.register_blueprint(readdata_blueprint)
CORS(app, resources={r"/*": {"origins": "https://zhucan.xyz"}}, supports_credentials=True)

db_config = {
    "host": "localhost",  # 或者改成你数据库实际主机名
    "user": "junxibao",
    "password": "Bjx81402",
    "database": "health"
}

if __name__ == '__main__':
    app.run(
    host='0.0.0.0',
    port=5000,
    ssl_context=(
        '/etc/letsencrypt/live/zhucan.xyz/fullchain.pem',
        '/etc/letsencrypt/live/zhucan.xyz/privkey.pem'
    )
)