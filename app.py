from flask import Flask, render_template, request, jsonify
from flask_socketio import SocketIO, emit
import os
import json
import random
import re  # For parsing dice rolls
from flask import url_for

app = Flask(__name__)
socketio = SocketIO(app, cors_allowed_origins="*")

UPLOAD_FOLDER = "static/uploads"
TOKEN_FILE = "tokens.json"
os.makedirs(UPLOAD_FOLDER, exist_ok=True)

user_colors = ["red", "blue", "green", "purple", "orange"]
tokens = []  # Store token data
board_image = None  # Store the uploaded board image
turn_order = []  # Track turn sequence
current_turn_index = -1  # Index for turn tracking
combat_active = False  # Flag for combat mode

# 🔥 Load saved tokens from file on server startup
if os.path.exists(TOKEN_FILE):
    with open(TOKEN_FILE, "r") as f:
        try:
            data = json.load(f)
            tokens = data.get("tokens", [])
            board_image = data.get("image", None)
        except json.JSONDecodeError:
            tokens = []

def save_tokens():
    """Save the current board state to a file."""
    with open(TOKEN_FILE, "w") as f:
        json.dump({"tokens": tokens, "image": board_image}, f)

@app.route("/")
def index():
    return render_template("index.html")

@socketio.on("request_board_state")
def send_board_state():
    """Send the latest board state, including turn order and combat state."""
    emit("board_state", {
        "tokens": tokens,
        "image": board_image,
        "turn_order": turn_order,
        "current_turn": current_turn_index,
        "combat_active": combat_active
    })

@socketio.on("toggle_combat")
def toggle_combat():
    """Start or stop combat mode and reset turn order."""
    global combat_active, current_turn_index
    combat_active = not combat_active

    if combat_active:
        current_turn_index = 0 if turn_order else -1
    else:
        current_turn_index = -1

    emit("combat_status", {"active": combat_active, "current_turn": current_turn_index}, broadcast=True)


@socketio.on("next_turn")
def next_turn():
    """Advance to the next turn in the turn order."""
    global current_turn_index
    if not turn_order or not combat_active:
        return

    current_turn_index = (current_turn_index + 1) % len(turn_order)
    emit("turn_updated", {"current_turn": current_turn_index}, broadcast=True)


@socketio.on("add_token")
def add_token(data):
    """Add a new token and include it in turn order if combat is active."""
    global tokens
    token_id = random.randint(1000, 9999)
    token = {
        "id": token_id,
        "x": data["x"],
        "y": data["y"],
        "type": data["type"],
        "color": random.choice(user_colors) if data["type"] == "User" else "black",
        "text": ""
    }
    tokens.append(token)

    if combat_active and token["type"] == "User":
        turn_order.append(token_id)

    save_tokens()  # 🔥 Save tokens after adding
    emit("token_added", token, broadcast=True)


@socketio.on("roll_dice")
def roll_dice(data):
    """Process dice roll requests and broadcast the results."""
    pattern = re.compile(r"(\d+)d(\d+)([+-]\d+)?")  # Regex for dice notation (e.g., "2d6+1")
    match = pattern.match(data["roll"])

    if not match:
        return  # Invalid roll format

    num_dice, dice_sides, modifier = int(match[1]), int(match[2]), int(match[3] or 0)
    rolls = [random.randint(1, dice_sides) for _ in range(num_dice)]
    total = sum(rolls) + modifier
    result_text = f"{data['player']} rolled {data['roll']} → {rolls} {'+' if modifier > 0 else ''}{modifier} = **{total}**"

    emit("dice_result", {"message": result_text}, broadcast=True)


@socketio.on("delete_token")
def delete_token(data):
    """Remove a token and update turn order if necessary."""
    global tokens, turn_order, current_turn_index
    tokens = [token for token in tokens if token["id"] != data["id"]]
    turn_order = [tid for tid in turn_order if tid != data["id"]]

    if current_turn_index >= len(turn_order):
        current_turn_index = max(0, len(turn_order) - 1)

    save_tokens()  # 🔥 Save tokens after deletion
    emit("token_deleted", {"id": data["id"]}, broadcast=True)


@socketio.on("move_token")
def move_token(data):
    """Update token position in memory and broadcast it."""
    global tokens
    for token in tokens:
        if token["id"] == data["id"]:
            token["x"] = data["x"]
            token["y"] = data["y"]
            break

    save_tokens()  # 🔥 Save updated token positions
    emit("token_moved", data, broadcast=True)


@socketio.on("update_text")
def update_text(data):
    """Update token text in memory and save."""
    global tokens
    for token in tokens:
        if token["id"] == data["id"]:
            token["text"] = data["text"]
            break

    save_tokens()  # 🔥 Save updated text to JSON
    emit("text_updated", data, broadcast=True)


@app.route("/upload", methods=["POST"])
def upload_file():
    """Handle map image uploads and update board background."""
    global board_image
    if "file" not in request.files:
        return jsonify({"status": "error", "message": "No file uploaded"}), 400

    file = request.files["file"]
    if file.filename == "":
        return jsonify({"status": "error", "message": "No selected file"}), 400

    if file:
        filename = os.path.join(UPLOAD_FOLDER, file.filename)
        file.save(filename)
        board_image = filename
        save_tokens()  # Save the new board image reference
        return jsonify({
            "status": "success",
            "url": url_for("static", filename=f"uploads/{file.filename}")
        })


if __name__ == "__main__":
    socketio.run(app, host="0.0.0.0", port=10000, debug=True)
