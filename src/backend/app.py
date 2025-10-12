"""
 Created on Thu Aug 21 2025 21:53:58
 Author: JunxiBao
 File: app.py
 Description: This is the main application file for the Flask backend. Users can run this file to start the server.
    Server files include
        - login
        - register
        - readdata
        - editdata
        - deepseek
        - sms
"""
from flask import Flask, request, g, jsonify
from werkzeug.exceptions import HTTPException
from flask_cors import CORS
from routes.login import login_blueprint
from routes.account import register_blueprint
from routes.readdata import readdata_blueprint
from routes.editdata import editdata_blueprint
from routes.deepseek import deepseek_blueprint
from routes.getjson import getjson_blueprint
from routes.sms import sms_blueprint
from routes.uploadjson import uploadjson_blueprint
from routes.avatar import avatar_blueprint
from routes.image_upload import image_upload_blueprint
from routes.square import square_blueprint
from routes.report import report_blueprint
from routes.block import block_blueprint
import logging
import time, uuid
import os
from concurrent_log_handler import ConcurrentRotatingFileHandler as RotatingFileHandler

# make blue prints
app = Flask(__name__)
app.register_blueprint(login_blueprint)
app.register_blueprint(register_blueprint, url_prefix="/account")
app.register_blueprint(readdata_blueprint)
app.register_blueprint(editdata_blueprint)
app.register_blueprint(deepseek_blueprint, url_prefix='/deepseek')
app.register_blueprint(getjson_blueprint)
app.register_blueprint(sms_blueprint)
app.register_blueprint(uploadjson_blueprint)
app.register_blueprint(avatar_blueprint)
app.register_blueprint(image_upload_blueprint)
app.register_blueprint(square_blueprint)
app.register_blueprint(report_blueprint)
app.register_blueprint(block_blueprint)

# *CORS rule，Prevent unauthorized requests, enhance security
CORS(app, resources={r"/*": {"origins": "*"}}, supports_credentials=True)

# Request lifecycle logging & health check

# set timer and calculate the time the request need 
@app.before_request
def _start_timer() -> None:
    g._ts = time.perf_counter()
    g.request_id = request.headers.get("X-Request-ID", str(uuid.uuid4()))
    logging.getLogger("app").info("[%s] -> %s %s body_len=%s", g.request_id, request.method, request.path, request.content_length or 0)

@app.after_request
def _log_response(resp)-> None:
    try:
        dur_ms = (time.perf_counter() - g._ts) * 1000
    except Exception:
        dur_ms = -1
    resp.headers["X-Request-ID"] = getattr(g, "request_id", "-")
    resp.headers["Server-Timing"] = f"app;dur={dur_ms:.1f}"
    logging.getLogger("app").info("[%s] <- %s in %.1fms status=%s", getattr(g, "request_id", "-"), request.path, dur_ms, resp.status_code)
    return resp


# let frontend get JSON response
@app.errorhandler(HTTPException)
def _handle_http_exc(e):
    rid = getattr(g, "request_id", "-")
    return jsonify({
        "error": e.name,
        "message": e.description,
        "request_id": rid
    }), e.code

# exception of the previous response
@app.errorhandler(Exception)
def _handle_err(e):
    if isinstance(e, HTTPException):
        raise e
    rid = getattr(g, "request_id", "-")
    logging.getLogger("app").exception("[%s] Unhandled error: %s", rid, e)
    return jsonify({"error": "internal_error", "request_id": rid}), 500


# Health check URL
@app.get("/healthz")
def _healthz():
    return {"status": "ok"}, 200
# End request lifecycle logging
# * log config
# Logging configuration
os.makedirs("../../log", exist_ok=True)

root = logging.getLogger()
root.setLevel(logging.INFO)
# Color (ANSI) file
file_handler = RotatingFileHandler("../../log/app.out", maxBytes=5_000_000, backupCount=3, encoding="utf-8")

# the color of logs
class ConsoleColorFormatter(logging.Formatter):
    COLORS = {
        logging.DEBUG: "\033[37m",
        logging.INFO: "\033[36m",
        logging.WARNING: "\033[33m",
        logging.ERROR: "\033[31m",
        logging.CRITICAL: "\033[41m"
    }
    RESET = "\033[0m"

    def format(self, record):
        color = self.COLORS.get(record.levelno, self.RESET)
        message = super().format(record)
        return f"{color}{message}{self.RESET}"

console_formatter = ConsoleColorFormatter("%(asctime)s [%(levelname)s] [%(name)s] %(message)s")
plain_formatter = logging.Formatter("%(asctime)s [%(levelname)s] [%(name)s] %(message)s")
file_handler.setFormatter(plain_formatter)

# Attach handler once
def _has_file_handler(base_name: str) -> bool:
    return any(isinstance(h, RotatingFileHandler) and getattr(h, "baseFilename", "").endswith(base_name) for h in root.handlers)

if not _has_file_handler("app.out"):
    root.addHandler(file_handler)

def _has_console_handler() -> bool:
    return any(isinstance(h, logging.StreamHandler) for h in root.handlers)

if not _has_console_handler():
    console_handler = logging.StreamHandler()
    console_handler.setFormatter(console_formatter)
    root.addHandler(console_handler)

# use app to replace root, enhance logging
_app_logger = logging.getLogger("app")
_app_logger.setLevel(logging.INFO)

# !Do not run a dev server in production. Use Gunicorn/Uvicorn, e.g.:
