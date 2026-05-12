import urllib.request
import json
import sqlite3
import os

url = "https://todo-sc0t.onrender.com/api/tasks"
local_db_path = "local.db"

if os.path.exists(local_db_path):
    os.remove(local_db_path)

conn = sqlite3.connect(local_db_path)
cursor = conn.cursor()

cursor.execute('''
    CREATE TABLE tasks (
        id INTEGER PRIMARY KEY,
        content TEXT NOT NULL,
        entry_date VARCHAR(20) NOT NULL,
        urgent BOOLEAN NOT NULL,
        due_date VARCHAR(20),
        assignee VARCHAR(50),
        completed BOOLEAN NOT NULL,
        completed_date VARCHAR(20)
    )
''')

req = urllib.request.Request(url)
with urllib.request.urlopen(req) as response:
    data = json.loads(response.read().decode())

    for t in data:
        cursor.execute('''
            INSERT INTO tasks (id, content, entry_date, urgent, due_date, assignee, completed, completed_date)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?)
        ''', (
            t.get('id'), 
            t.get('content'), 
            t.get('entry_date'), 
            t.get('urgent', False), 
            t.get('due_date'), 
            t.get('assignee'), 
            t.get('completed', False), 
            t.get('completed_date')
        ))

conn.commit()
conn.close()

print(f"Migration complete. Imported {len(data)} tasks to local.db")
