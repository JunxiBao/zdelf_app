import os
import logging
from datetime import timedelta, date
from dotenv import load_dotenv
from flask import Blueprint, request, jsonify
import mysql.connector
from mysql.connector import errors as mysql_errors

load_dotenv()

logger = logging.getLogger("app.stats")

stats_blueprint = Blueprint('stats', __name__)

DB_CONFIG = {
    "host": os.getenv("DB_HOST"),
    "user": os.getenv("DB_USER"),
    "password": os.getenv("DB_PASSWORD"),
    "database": os.getenv("DB_NAME"),
}

# 所有记录表的列表
RECORD_TABLES = [
    "metrics_files",
    "diet_files",
    "case_files",
    "symptom_files",
]


def _get_conn():
    """获取数据库连接"""
    conn = mysql.connector.connect(**DB_CONFIG, connection_timeout=5, autocommit=False)
    cur = conn.cursor()
    try:
        cur.execute("SET SESSION MAX_EXECUTION_TIME=30000")  # 30s for batch operations
    finally:
        cur.close()
    return conn


def _ensure_streak_columns(conn):
    """确保users表中有连续天数统计字段"""
    cur = conn.cursor()
    try:
        # 检查current_streak字段是否存在
        cur.execute("SHOW COLUMNS FROM users LIKE 'current_streak'")
        if not cur.fetchone():
            logger.info("Adding current_streak column to users table")
            cur.execute("ALTER TABLE users ADD COLUMN current_streak INT DEFAULT 0 COMMENT '当前连续记录天数'")
        
        # 检查max_streak字段是否存在
        cur.execute("SHOW COLUMNS FROM users LIKE 'max_streak'")
        if not cur.fetchone():
            logger.info("Adding max_streak column to users table")
            cur.execute("ALTER TABLE users ADD COLUMN max_streak INT DEFAULT 0 COMMENT '历史最长连续记录天数'")
        
        conn.commit()
    except Exception as e:
        logger.exception("Error ensuring streak columns: %s", e)
        conn.rollback()
        raise
    finally:
        try:
            cur.close()
        except Exception:
            pass


def _get_user_record_dates(user_id, conn):
    """
    获取用户在所有记录表中的所有记录日期（去重）
    返回一个日期集合（set of date objects）
    """
    all_dates = set()
    cursor = conn.cursor()
    
    try:
        for table in RECORD_TABLES:
            try:
                # 查询该表中该用户的所有记录日期
                query = f"""
                    SELECT DISTINCT DATE(created_at) as record_date
                    FROM {table}
                    WHERE user_id = %s
                    ORDER BY record_date
                """
                cursor.execute(query, (user_id,))
                rows = cursor.fetchall()
                
                for row in rows:
                    if row[0]:  # 确保日期不为None
                        all_dates.add(row[0])
                        
            except mysql_errors.ProgrammingError as e:
                # 表不存在，跳过
                if e.errno == 1146:  # Table doesn't exist
                    logger.debug("Table %s does not exist, skipping", table)
                    continue
                else:
                    raise
            except Exception as e:
                logger.warning("Error querying table %s for user %s: %s", table, user_id, e)
                continue
                
    finally:
        try:
            cursor.close()
        except Exception:
            pass
    
    return sorted(all_dates)


def _calculate_streaks(record_dates):
    """
    计算连续天数统计
    参数: record_dates - 已排序的日期列表（date对象）
    返回: (current_streak, max_streak)
    """
    if not record_dates:
        return (0, 0)
    
    today = date.today()
    yesterday = today - timedelta(days=1)
    
    # 计算当前连续天数（从今天或昨天往前数）
    current_streak = 0
    
    # 确定起始日期：如果今天有记录从今天开始，否则从昨天开始
    start_date = today if today in record_dates else yesterday
    
    # 如果起始日期在记录中，开始计算连续天数
    if start_date in record_dates:
        current_streak = 1
        # 从起始日期往前数连续的天数
        check_date = start_date - timedelta(days=1)
        while check_date in record_dates:
            current_streak += 1
            check_date -= timedelta(days=1)
    
    # 计算历史最长连续天数
    max_streak = 0
    if record_dates:
        current_run = 1
        for i in range(1, len(record_dates)):
            # 计算两个日期之间的天数差
            days_diff = (record_dates[i] - record_dates[i-1]).days
            if days_diff == 1:
                # 连续的一天
                current_run += 1
            else:
                # 中断了，更新最大连续天数
                max_streak = max(max_streak, current_run)
                current_run = 1
        # 最后一段连续天数
        max_streak = max(max_streak, current_run)
    
    return (current_streak, max_streak)


def _update_user_streak(user_id, current_streak, max_streak, conn):
    """更新用户的连续天数统计"""
    cursor = conn.cursor()
    try:
        # 获取当前的最大连续天数，如果新的current_streak更大，则更新max_streak
        cursor.execute("SELECT max_streak FROM users WHERE user_id = %s", (user_id,))
        row = cursor.fetchone()
        existing_max_streak = row[0] if row else 0
        
        # 如果当前连续天数超过了历史最大，则更新历史最大
        final_max_streak = max(existing_max_streak, max_streak, current_streak)
        
        cursor.execute(
            "UPDATE users SET current_streak = %s, max_streak = %s WHERE user_id = %s",
            (current_streak, final_max_streak, user_id)
        )
        conn.commit()
        return True
    except Exception as e:
        logger.exception("Error updating streak for user %s: %s", user_id, e)
        conn.rollback()
        return False
    finally:
        try:
            cursor.close()
        except Exception:
            pass


def update_user_streak_async(user_id):
    """
    异步更新单个用户的连续天数统计（在后台线程中执行，不阻塞主流程）
    这个函数可以在用户上传记录后调用，自动更新统计
    """
    import threading
    
    def _update_in_background():
        try:
            conn = _get_conn()
            try:
                _ensure_streak_columns(conn)
                record_dates = _get_user_record_dates(user_id, conn)
                current_streak, max_streak = _calculate_streaks(record_dates)
                _update_user_streak(user_id, current_streak, max_streak, conn)
                logger.debug("Auto-updated streak for user %s: current=%d, max=%d", 
                           user_id, current_streak, max_streak)
            finally:
                try:
                    conn.close()
                except Exception:
                    pass
        except Exception as e:
            logger.warning("Failed to auto-update streak for user %s: %s", user_id, e)
    
    # 在后台线程中执行，不阻塞主流程
    thread = threading.Thread(target=_update_in_background, daemon=True)
    thread.start()


@stats_blueprint.route('/stats/update_streak', methods=['POST', 'OPTIONS'])
def update_streak():
    """
    更新用户的连续记录天数统计
    可以更新单个用户或所有用户
    
    Request JSON:
    {
        "user_id": "optional-user-id"  # 如果提供，只更新该用户；否则更新所有用户
    }
    """
    if request.method == 'OPTIONS':
        return '', 200
    
    try:
        data = request.get_json(silent=True) or {}
        user_id = (data.get("user_id") or "").strip() or None
        
        conn = _get_conn()
        try:
            # 确保字段存在
            _ensure_streak_columns(conn)
            
            cursor = conn.cursor()
            try:
                if user_id:
                    # 更新单个用户
                    user_ids = [user_id]
                else:
                    # 获取所有用户ID
                    cursor.execute("SELECT user_id FROM users")
                    user_ids = [row[0] for row in cursor.fetchall()]
                
                updated_count = 0
                failed_count = 0
                
                for uid in user_ids:
                    try:
                        # 获取该用户的所有记录日期
                        record_dates = _get_user_record_dates(uid, conn)
                        
                        # 计算连续天数
                        current_streak, max_streak = _calculate_streaks(record_dates)
                        
                        # 更新数据库
                        if _update_user_streak(uid, current_streak, max_streak, conn):
                            updated_count += 1
                            logger.debug("Updated streak for user %s: current=%d, max=%d", 
                                       uid, current_streak, max_streak)
                        else:
                            failed_count += 1
                            
                    except Exception as e:
                        logger.exception("Error processing user %s: %s", uid, e)
                        failed_count += 1
                        continue
                
                logger.info("/stats/update_streak completed: updated=%d, failed=%d", 
                          updated_count, failed_count)
                
                return jsonify({
                    "success": True,
                    "message": f"统计完成：成功更新 {updated_count} 个用户，失败 {failed_count} 个",
                    "updated_count": updated_count,
                    "failed_count": failed_count
                })
                
            finally:
                try:
                    cursor.close()
                except Exception:
                    pass
                    
        finally:
            try:
                conn.close()
            except Exception:
                pass
            
    except mysql_errors.Error as e:
        if getattr(e, 'errno', None) in (3024, 1205, 1213):
            logger.warning("/stats/update_streak db timeout/deadlock errno=%s msg=%s", 
                         getattr(e, 'errno', None), str(e))
            return jsonify({"success": False, "message": "数据库超时或死锁，请稍后重试"}), 504
        logger.exception("/stats/update_streak db error: %s", e)
        return jsonify({"success": False, "message": "数据库错误", "error": str(e)}), 500
    except Exception as e:
        logger.exception("/stats/update_streak server error: %s", e)
        return jsonify({"success": False, "message": "服务器错误", "error": str(e)}), 500


@stats_blueprint.route('/stats/get_streak', methods=['POST', 'OPTIONS'])
def get_streak():
    """
    获取用户的连续记录天数统计
    
    Request JSON:
    {
        "user_id": "required-user-id"  # 或 "username": "username"
    }
    """
    if request.method == 'OPTIONS':
        return '', 200
    
    try:
        data = request.get_json(silent=True) or {}
        user_id = (data.get("user_id") or "").strip() or None
        username = (data.get("username") or "").strip() or None
        
        if not user_id and not username:
            return jsonify({"success": False, "message": "必须提供user_id或username"}), 400
        
        conn = _get_conn()
        try:
            _ensure_streak_columns(conn)
            
            cursor = conn.cursor(dictionary=True)
            try:
                if user_id:
                    cursor.execute(
                        "SELECT user_id, username, current_streak, max_streak FROM users WHERE user_id = %s",
                        (user_id,)
                    )
                else:
                    cursor.execute(
                        "SELECT user_id, username, current_streak, max_streak FROM users WHERE username = %s",
                        (username,)
                    )
                
                user = cursor.fetchone()
                if not user:
                    return jsonify({"success": False, "message": "用户不存在"}), 404
                
                return jsonify({
                    "success": True,
                    "data": {
                        "user_id": user["user_id"],
                        "username": user["username"],
                        "current_streak": user.get("current_streak", 0) or 0,
                        "max_streak": user.get("max_streak", 0) or 0
                    }
                })
                
            finally:
                try:
                    cursor.close()
                except Exception:
                    pass
                    
        finally:
            try:
                conn.close()
            except Exception:
                pass
            
    except mysql_errors.Error as e:
        logger.exception("/stats/get_streak db error: %s", e)
        return jsonify({"success": False, "message": "数据库错误", "error": str(e)}), 500
    except Exception as e:
        logger.exception("/stats/get_streak server error: %s", e)
        return jsonify({"success": False, "message": "服务器错误", "error": str(e)}), 500

