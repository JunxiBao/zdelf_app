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
from flask import Blueprint, jsonify, request, abort

logs_blueprint = Blueprint("logs", __name__)

# 计算日志目录：相对当前文件 ../../log
_BASE_DIR = os.path.dirname(os.path.abspath(__file__))
LOG_DIR = os.path.normpath(os.path.join(_BASE_DIR, "../../log"))


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
    """高效读取文件尾部若干行"""
    if max_lines <= 0:
        return ""
    # 若文件较小，直接读取
    try:
        size = os.path.getsize(path)
    except OSError:
        abort(404, description="文件不存在")

    # 逐块向后读取
    chunk_size = 4096
    with open(path, "rb") as f:
        if size == 0:
            return ""
        # 从文件末尾开始
        f.seek(0, io.SEEK_END)
        buffer = bytearray()
        lines_found = 0
        while f.tell() > 0 and lines_found <= max_lines:
            read_size = min(chunk_size, f.tell())
            f.seek(-read_size, io.SEEK_CUR)
            data = f.read(read_size)
            f.seek(-read_size, io.SEEK_CUR)
            buffer.extendleft(data[::-1])  # 反向插入以避免频繁拼接
            lines_found = buffer.count(b"\n")
            if f.tell() == 0:
                break
        # 取最后 max_lines 行
        parts = buffer[::-1].split(b"\n")
        tail = parts[-max_lines - 1:] if len(parts) > max_lines else parts
        text = b"\n".join(tail).decode(encoding, errors="replace")
        return text


@logs_blueprint.get("/logs/files")
def list_files():
    return jsonify({"files": _list_log_files()})


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
    return jsonify({
        "file": name,
        "tail": tail_lines,
        "content": content,
        "size": getattr(st, "st_size", 0),
        "mtime": getattr(st, "st_mtime", int(time.time()))
    })


