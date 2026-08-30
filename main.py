
from flask import Flask, jsonify, request
from flask_sqlalchemy import SQLAlchemy
import os

app = Flask(__name__)

# SQLite Database Setup
basedir = os.path.abspath(os.path.dirname(__file__))
app.config['SQLALCHEMY_DATABASE_URI'] = 'sqlite:///' + os.path.join(basedir, 'secure_file.db')
app.config['SQLALCHEMY_TRACK_MODIFICATIONS'] = False

# ফাইল আপলোডের জন্য ফোল্ডার পাথ
UPLOAD_FOLDER = os.path.join(basedir, 'uploads')
os.makedirs(UPLOAD_FOLDER, exist_ok=True)
app.config['UPLOAD_FOLDER'] = UPLOAD_FOLDER

db = SQLAlchemy(app)

# User Model (Authentication ও User এর জন্য)
class User(db.Model):
    id = db.Column(db.Integer, primary_key=True)
    username = db.Column(db.String(80), unique=True, nullable=False)
    email = db.Column(db.String(120), unique=True, nullable=False)
    password = db.Column(db.String(120), nullable=False)

    def to_dict(self):
        return {"id": self.id, "username": self.username, "email": self.email}

with app.app_context():
    db.create_all()

@app.route("/")
def read_root():
    return jsonify({"message": "Welcome to Secure File System Backend with SQLite & File Upload!"})

# ১. ইউজার রেজিস্ট্রেশন (Authentication Basic Setup)
@app.route("/register", methods=["POST"])
def register():
    data = request.json
    if User.query.filter_by(username=data.get("username")).first():
        return jsonify({"error": "User already exists!"}), 400
    
    new_user = User(
        username=data.get("username"), 
        email=data.get("email"),
        password=data.get("password")  # প্রেজেন্টেশনের জন্য সিম্পল পাসওয়ার্ড
    )
    db.session.add(new_user)
    db.session.commit()
    return jsonify({"message": "User registered successfully!", "user": new_user.to_dict()}), 201

# ২. ইউজার লিস্ট দেখার রাউট
@app.route("/users", methods=["GET"])
def get_users():
    users = User.query.all()
    return jsonify([user.to_dict() for user in users])

# ৩. সিকিওর ফাইল আপলোড রাউট (Secure File Upload Workflow)
@app.route("/upload", methods=["POST"])
def upload_file():
    if 'file' not in request.files:
        return jsonify({"error": "No file part in the request"}), 400
    file = request.files['file']
    if file.filename == '':
        return jsonify({"error": "No selected file"}), 400
    
    file_path = os.path.join(app.config['UPLOAD_FOLDER'], file.filename)
    file.save(file_path)
    return jsonify({"message": "File uploaded successfully!", "filename": file.filename}), 200

if __name__ == "__main__":
    app.run(debug=True, port=8000)