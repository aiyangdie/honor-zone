import pymysql
import re

raw = open("init_db.sql", encoding="utf-8").read()
raw = re.sub(r"--[^\n]*", "", raw)
stmts = [s.strip() for s in raw.split(";") if s.strip()]

conn = pymysql.connect(host="localhost", user="root", password="", charset="utf8mb4")
cur = conn.cursor()
for s in stmts:
    try:
        cur.execute(s)
    except Exception as e:
        if "1007" not in str(e) and "1050" not in str(e) and "1061" not in str(e):
            print("warn:", s[:60], "->", e)
conn.commit()
cur.execute(
    "CREATE USER IF NOT EXISTS 'game_user'@'localhost' IDENTIFIED BY 'game_password'"
)
cur.execute("GRANT ALL ON game_leaderboard.* TO 'game_user'@'localhost'")
cur.execute("FLUSH PRIVILEGES")
conn.commit()
cur.execute("USE game_leaderboard")
cur.execute("SHOW TABLES")
print("tables:", cur.fetchall())
conn.close()
print("db ok")
