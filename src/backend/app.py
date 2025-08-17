from flask import Flask, request, g, jsonify
from flask_cors import CORS
from routes.login import login_blueprint
from routes.register import register_blueprint
from routes.readdata import readdata_blueprint
from routes.editdata import editdata_blueprint
from routes.deepseek import deepseek_blueprint
from routes.sms import sms_blueprint
import logging
import time, uuid
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

# ===== Request lifecycle logging & health check =====
@app.before_request
def _start_timer():
    g._ts = time.time()
    g.request_id = request.headers.get("X-Request-ID", str(uuid.uuid4()))
    logging.getLogger("app").info("[%s] -> %s %s body_len=%s", g.request_id, request.method, request.path, request.content_length or 0)

@app.after_request
def _log_response(resp):
    try:
        dur_ms = (time.time() - g._ts) * 1000
    except Exception:
        dur_ms = -1
    resp.headers["X-Request-ID"] = getattr(g, "request_id", "-")
    logging.getLogger("app").info("[%s] <- %s in %.1fms status=%s", getattr(g, "request_id", "-"), request.path, dur_ms, resp.status_code)
    return resp

@app.errorhandler(Exception)
def _handle_err(e):
    rid = getattr(g, "request_id", "-")
    logging.getLogger("app").exception("[%s] Unhandled error: %s", rid, e)
    return jsonify({"error": "internal_error", "request_id": rid}), 500

@app.get("/healthz")
def _healthz():
    return {"status": "ok"}, 200
# ===== End request lifecycle logging =====

os.makedirs("./log", exist_ok=True)
handler = RotatingFileHandler("./log/app.out", maxBytes=5_000_000, backupCount=3, encoding="utf-8")
formatter = logging.Formatter("%(asctime)s [%(levelname)s] [%(name)s] %(message)s")
handler.setFormatter(formatter)

root = logging.getLogger()
root.setLevel(logging.INFO)
if not any(isinstance(h, RotatingFileHandler) and getattr(h, "baseFilename", "").endswith("app.out") for h in root.handlers):
    root.addHandler(handler)

# NOTE: Do not run a dev server in production. Use Gunicorn/Uvicorn, e.g.:
# gunicorn app:app --bind 127.0.0.1:8000 --workers 2 --threads 4 --timeout 30