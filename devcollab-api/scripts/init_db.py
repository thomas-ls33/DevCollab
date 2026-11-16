import sys

from env import ROOT, load_env

load_env()
sys.path.insert(0, str(ROOT))

from common.db import get_conn

conn = get_conn()
conn.run((ROOT / "sql" / "schema.sql").read_text(encoding="utf-8"))
tables = conn.run("SELECT table_name FROM information_schema.tables WHERE table_schema = 'public' ORDER BY table_name")
print("Schéma appliqué. Tables :", ", ".join(t[0] for t in tables))
