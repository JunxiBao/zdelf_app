from flask import Flask
from flask_cors import CORS
from routes.login import login_blueprint
from routes.register import register_blueprint
from routes.readdata import readdata_blueprint
from routes.editdata import editdata_blueprint
from routes.deepseek import deepseek_blueprint
from routes.sms import sms_blueprint
import logging
import os
from logging.handlers import RotatingFileHandler


app = Flask(__name__)
app.register_blueprint(login_blueprint)
app.register_blueprint(register_blueprint)
app.register_blueprint(readdata_blueprint)
app.register_blueprint(editdata_blueprint)
app.register_blueprint(deepseek_blueprint, url_prefix='/deepseek')
app.register_blueprint(sms_blueprint)
CORS(app, resources={r"/*": {"origins": "https://zhucan.xyz"}}, supports_credentials=True)

os.makedirs("./log", exist_ok=True)
handler = RotatingFileHandler("./log/app.out", maxBytes=5_000_000, backupCount=3, encoding="utf-8")
formatter = logging.Formatter("%(asctime)s [%(levelname)s] [%(name)s] %(message)s")
handler.setFormatter(formatter)

root = logging.getLogger()
root.setLevel(logging.INFO)
if not any(isinstance(h, RotatingFileHandler) and getattr(h, "baseFilename", "").endswith("app.out") for h in root.handlers):
    root.addHandler(handler)

if __name__ == '__main__':
    app.run(
    host='0.0.0.0',
    port=5000,
    ssl_context=(
        '/etc/letsencrypt/live/zhucan.xyz/fullchain.pem',
        '/etc/letsencrypt/live/zhucan.xyz/privkey.pem'
    )
)