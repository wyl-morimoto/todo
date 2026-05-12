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
database_path = os.environ.get('DATABASE_PATH', os.path.join(os.path.dirname(__file__), 'tasks.db'))

# RenderのPostgreSQLは 'postgres://' 形式で渡されることがあるため 'postgresql://' に修正する
if database_url and database_url.startswith("postgres://"):
    database_url = database_url.replace("postgres://", "postgresql://", 1)

app.config['SQLALCHEMY_DATABASE_URI'] = database_url or f"sqlite:///{database_path}"
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

class Assignee(db.Model):
    __tablename__ = 'assignees'
    id = db.Column(db.Integer, primary_key=True)
    name = db.Column(db.String(50), nullable=False, unique=True)

    def to_dict(self):
        return {
            'id': self.id,
            'name': self.name
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

    # デフォルト担当者の追加
    if Assignee.query.count() == 0:
        default_assignees = ['森本', '黒瀬', '浅井']
        for name in default_assignees:
            db.session.add(Assignee(name=name))
        db.session.commit()

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

@app.route('/api/assignees', methods=['GET'])
def get_assignees():
    assignees = Assignee.query.order_by(Assignee.id).all()
    return jsonify([a.to_dict() for a in assignees])

@app.route('/api/assignees', methods=['POST'])
def create_assignee():
    data = request.json
    name = data.get('name')
    if not name:
        return jsonify({'error': 'Name is required'}), 400

    existing = Assignee.query.filter_by(name=name).first()
    if existing:
        return jsonify({'error': 'Assignee already exists'}), 400

    new_assignee = Assignee(name=name)
    db.session.add(new_assignee)
    db.session.commit()
    
    return jsonify(new_assignee.to_dict()), 201

if __name__ == '__main__':
    app.run(debug=True, port=3000)
