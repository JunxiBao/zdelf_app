"""
日志监视器后端接口
- 列出日志目录下可用的日志文件
- 读取日志文件尾部内容（按行数 tail）
"""
from __future__ import annotations

import os
import io
import time
from typing import List
from flask import Blueprint, jsonify, request, abort, make_response

logs_blueprint = Blueprint("logs", __name__)

# 计算日志目录：相对当前文件 ../../../log
# routes/logs.py 位于 www/src/backend/routes
# 后端日志写入 www/log，因此需要回到 www 目录后进入 log
_BASE_DIR = os.path.dirname(os.path.abspath(__file__))  # .../www/src/backend/routes
LOG_DIR = os.path.normpath(os.path.join(_BASE_DIR, "../../../log"))  # .../www/log


def _ensure_log_dir() -> None:
    try:
        os.makedirs(LOG_DIR, exist_ok=True)
    except Exception:
        # 目录创建失败时走只读模式（列出与读取可能仍失败）
        pass


def _safe_join_log(basename: str) -> str:
    # 禁止目录穿越，仅允许文件名
    if not basename or os.path.sep in basename or basename.startswith("."):
        abort(400, description="非法文件名")
    path = os.path.normpath(os.path.join(LOG_DIR, basename))
    if not path.startswith(LOG_DIR):
        abort(400, description="非法路径")
    return path


def _list_log_files() -> List[dict]:
    _ensure_log_dir()
    if not os.path.isdir(LOG_DIR):
        return []
    files = []
    for name in os.listdir(LOG_DIR):
        full = os.path.join(LOG_DIR, name)
        if os.path.isfile(full):
            try:
                st = os.stat(full)
                files.append({
                    "name": name,
                    "size": st.st_size,
                    "mtime": st.st_mtime
                })
            except OSError:
                # 跳过不可读或已删除文件
                continue
    # 按修改时间倒序
    files.sort(key=lambda x: x.get("mtime", 0), reverse=True)
    return files


def _tail_lines(path: str, max_lines: int = 1000, encoding: str = "utf-8") -> str:
    """高效读取文件尾部若干行（兼容超大文件）"""
    if max_lines <= 0:
        return ""
    try:
        size = os.path.getsize(path)
    except OSError:
        abort(404, description="文件不存在")

    # 小文件直接读取
    if size <= 2_000_000:  # 2MB
        try:
            with open(path, "r", encoding=encoding, errors="replace") as f:
                data = f.read()
        except UnicodeDecodeError:
            with open(path, "rb") as f:
                data = f.read().decode(encoding, errors="replace")
        lines = data.splitlines()
        return "\n".join(lines[-max_lines:])

    # 大文件块读，从末尾往前直到凑够行数
    chunk_size = 8192
    chunks = []
    lines_count = 0
    with open(path, "rb") as f:
        pos = size
        while pos > 0 and lines_count <= max_lines:
            read_size = chunk_size if pos >= chunk_size else pos
            pos -= read_size
            f.seek(pos)
            chunk = f.read(read_size)
            chunks.append(chunk)
            lines_count += chunk.count(b"\n")
        data = b"".join(reversed(chunks))
    parts = data.split(b"\n")
    tail = parts[-max_lines:] if len(parts) > max_lines else parts
    return b"\n".join(tail).decode(encoding, errors="replace")


@logs_blueprint.get("/logs/files")
def list_files():
    resp = jsonify({"files": _list_log_files()})
    # 禁止缓存，确保轮询拿到最新列表
    resp.headers["Cache-Control"] = "no-store, no-cache, must-revalidate, max-age=0"
    resp.headers["Pragma"] = "no-cache"
    resp.headers["Expires"] = "0"
    return resp


@logs_blueprint.get("/logs/content")
def get_content():
    name = request.args.get("file", "").strip()
    tail = request.args.get("tail", "").strip()
    try:
        tail_lines = int(tail) if tail else 1000
        if tail_lines <= 0:
            tail_lines = 1000
        tail_lines = min(tail_lines, 10000)  # 上限，避免过大
    except ValueError:
        tail_lines = 1000
    path = _safe_join_log(name)
    if not os.path.exists(path) or not os.path.isfile(path):
        abort(404, description="文件不存在")
    try:
        content = _tail_lines(path, tail_lines)
        st = os.stat(path)
    except Exception as e:
        abort(500, description=f"读取失败: {e}")
    resp = jsonify({
        "file": name,
        "tail": tail_lines,
        "content": content,
        "size": getattr(st, "st_size", 0),
        "mtime": getattr(st, "st_mtime", int(time.time()))
    })
    # 禁止缓存，确保轮询拿到最新内容
    resp.headers["Cache-Control"] = "no-store, no-cache, must-revalidate, max-age=0"
    resp.headers["Pragma"] = "no-cache"
    resp.headers["Expires"] = "0"
    return resp


