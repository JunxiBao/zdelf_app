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
from routes.logs import logs_blueprint
from routes.stats import stats_blueprint, check_and_reset_streaks_for_missing_checkins
import logging
import time, uuid
import os
from concurrent_log_handler import ConcurrentRotatingFileHandler as RotatingFileHandler
from apscheduler.schedulers.background import BackgroundScheduler
from apscheduler.triggers.cron import CronTrigger

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
app.register_blueprint(logs_blueprint)
app.register_blueprint(stats_blueprint)

# *CORS rule，Prevent unauthorized requests, enhance security
CORS(app, resources={r"/*": {"origins": "*"}}, supports_credentials=True)

# Request lifecycle logging & health check

# set timer and calculate the time the request need 
def _should_log(path: str) -> bool:
    try:
        # 忽略日志监视器自身的接口，防止刷屏
        if path.startswith("/logs/"):
            return False
    except Exception:
        pass
    return True

@app.before_request
def _start_timer() -> None:
    g._ts = time.perf_counter()
    g.request_id = request.headers.get("X-Request-ID", str(uuid.uuid4()))
    rid = g.request_id
    rid_short = (rid.split("-")[0] if isinstance(rid, str) and "-" in rid else str(rid)[:8])
    if _should_log(request.path):
        logging.getLogger("app").info("%s -> %s %s len=%s", rid_short, request.method, request.path, request.content_length or 0)

@app.after_request
def _log_response(resp)-> None:
    try:
        dur_ms = (time.perf_counter() - g._ts) * 1000
    except Exception:
        dur_ms = -1
    rid = getattr(g, "request_id", "-")
    resp.headers["X-Request-ID"] = rid
    resp.headers["Server-Timing"] = f"app;dur={dur_ms:.1f}"
    rid_short = (rid.split("-")[0] if isinstance(rid, str) and "-" in rid else str(rid)[:8])
    if _should_log(request.path):
        logging.getLogger("app").info("%s <- %s %.1fms %s", rid_short, request.path, dur_ms, resp.status_code)
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
    rid_short = (rid.split("-")[0] if isinstance(rid, str) and "-" in rid else str(rid)[:8])
    logging.getLogger("app").exception("%s !! %s", rid_short, e)
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

# 简短格式：HH:MM:SS L message（L 为等级首字母）
_SHORT_FMT = "%(asctime)s %(levelname).1s %(message)s"
_DATE_FMT = "%H:%M:%S"
console_formatter = ConsoleColorFormatter(_SHORT_FMT, datefmt=_DATE_FMT)
plain_formatter = logging.Formatter(_SHORT_FMT, datefmt=_DATE_FMT)
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

# 设置定时任务：每天0点检查所有用户的打卡情况并重置未打卡用户的连续天数
scheduler = BackgroundScheduler(timezone='Asia/Shanghai')
scheduler.add_job(
    func=check_and_reset_streaks_for_missing_checkins,
    trigger=CronTrigger(hour=0, minute=0),  # 每天0点执行
    id='daily_checkin_check',
    name='每日打卡检查任务',
    replace_existing=True
)
scheduler.start()
_app_logger.info("定时任务已启动：每天0点自动检查用户打卡情况")

# !Do not run a dev server in production. Use Gunicorn/Uvicorn, e.g.:
