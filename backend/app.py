import os
from flask import Flask, request, jsonify, send_from_directory
from flask_cors import CORS
from flask_sqlalchemy import SQLAlchemy
from sqlalchemy import text

frontend_dir = os.path.abspath(os.path.join(os.path.dirname(__file__), '..', 'frontend'))
app = Flask(__name__, static_folder=frontend_dir, static_url_path='')
CORS(app)

# データベース設定
# Render提供の DATABASE_URL があればPostgreSQL、なければローカルのSQLiteを使用する
database_url = os.environ.get('DATABASE_URL')
# RenderのPostgreSQLは 'postgres://' 形式で渡されることがあるため 'postgresql://' に修正する
if database_url and database_url.startswith("postgres://"):
    database_url = database_url.replace("postgres://", "postgresql://", 1)

app.config['SQLALCHEMY_DATABASE_URI'] = database_url or f"sqlite:///{os.path.join(os.path.dirname(__file__), 'tasks.db')}"
app.config['SQLALCHEMY_TRACK_MODIFICATIONS'] = False

db = SQLAlchemy(app)

# テーブルモデル定義
class Task(db.Model):
    __tablename__ = 'tasks'
    id = db.Column(db.Integer, primary_key=True)
    content = db.Column(db.Text, nullable=False)
    entry_date = db.Column(db.String(20), nullable=False)
    urgent = db.Column(db.Boolean, nullable=False, default=False)
    due_date = db.Column(db.String(20))
    assignee = db.Column(db.String(50))
    completed = db.Column(db.Boolean, nullable=False, default=False)
    completed_date = db.Column(db.String(20))

    def to_dict(self):
        return {
            'id': self.id,
            'content': self.content,
            'entry_date': self.entry_date,
            'urgent': self.urgent,
            'due_date': self.due_date,
            'assignee': self.assignee,
            'completed': self.completed,
            'completed_date': self.completed_date
        }

# アプリケーションコンテキスト内でテーブル作成 (存在しない場合のみ作成される)
with app.app_context():
    db.create_all()
    # マイグレーション: 新規カラムの追加（既に存在する場合はエラーになるため無視する）
    try:
        db.session.execute(text("ALTER TABLE tasks ADD COLUMN completed_date VARCHAR(20)"))
        db.session.commit()
    except Exception:
        db.session.rollback()

@app.route('/')
def index():
    return send_from_directory(frontend_dir, 'index.html')

@app.route('/<path:path>')
def serve_static(path):
    if os.path.exists(os.path.join(frontend_dir, path)):
        return send_from_directory(frontend_dir, path)
    return send_from_directory(frontend_dir, 'index.html')

@app.route('/api/tasks', methods=['GET'])
def get_tasks():
    tasks = Task.query.order_by(Task.id.desc()).all()
    return jsonify([task.to_dict() for task in tasks])

@app.route('/api/tasks', methods=['POST'])
def create_task():
    data = request.json
    content = data.get('content')
    entry_date = data.get('entry_date')

    if not content or not entry_date:
        return jsonify({'error': 'Content and entry_date are required'}), 400

    new_task = Task(
        content=content,
        entry_date=entry_date,
        urgent=bool(data.get('urgent', False)),
        due_date=data.get('due_date'),
        assignee=data.get('assignee'),
        completed=bool(data.get('completed', False))
    )
    
    db.session.add(new_task)
    db.session.commit()
    
    return jsonify({'id': new_task.id}), 201

@app.route('/api/tasks/<int:task_id>', methods=['PUT'])
def update_task(task_id):
    task = Task.query.get(task_id)
    if not task:
        return jsonify({'error': 'Task not found'}), 404
        
    data = request.json
    if 'content' in data:
        task.content = data['content']
    if 'entry_date' in data:
        task.entry_date = data['entry_date']
    if 'urgent' in data:
        task.urgent = bool(data['urgent'])
    if 'due_date' in data:
        task.due_date = data['due_date']
    if 'assignee' in data:
        task.assignee = data['assignee']
    if 'completed' in data:
        task.completed = bool(data['completed'])
    if 'completed_date' in data:
        task.completed_date = data['completed_date']
        
    db.session.commit()
    return jsonify({'success': True})

@app.route('/api/tasks/<int:task_id>', methods=['DELETE'])
def delete_task(task_id):
    task = Task.query.get(task_id)
    if not task:
        return jsonify({'error': 'Task not found'}), 404
        
    db.session.delete(task)
    db.session.commit()
    return jsonify({'success': True})

if __name__ == '__main__':
    app.run(debug=True, port=3000)
