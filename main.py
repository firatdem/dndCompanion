from flask import Flask, render_template, request, send_from_directory
from flask_socketio import SocketIO, emit
import os
import random

app = Flask(__name__)
socketio = SocketIO(app, cors_allowed_origins="*")

UPLOAD_FOLDER = "static/uploads"
os.makedirs(UPLOAD_FOLDER, exist_ok=True)

user_colors = ["red", "blue", "green", "purple", "orange"]
tokens = []  # Store token data

@app.route("/")
def index():
    return render_template("index.html")

@app.route("/upload", methods=["POST"])
def upload():
    if "file" in request.files:
        file = request.files["file"]
        if file.filename != "":
            filepath = os.path.join(UPLOAD_FOLDER, "map.png")
            file.save(filepath)
            return {"status": "success", "url": "/static/uploads/map.png"}
    return {"status": "error"}

@socketio.on("add_token")
def add_token(data):
    """Add a new token and broadcast it to all clients."""
    token = {
        "id": len(tokens),
        "x": data["x"],
        "y": data["y"],
        "type": data["type"],
        "color": random.choice(user_colors) if data["type"] == "User" else "black"
    }
    tokens.append(token)
    emit("token_added", token, broadcast=True)

@socketio.on("move_token")
def move_token(data):
    """Update token position and broadcast it."""
    for token in tokens:
        if token["id"] == data["id"]:
            token["x"] = data["x"]
            token["y"] = data["y"]
            break
    emit("token_moved", data, broadcast=True)

if __name__ == "__main__":
    socketio.run(app, host="0.0.0.0", port=5000, debug=True)
