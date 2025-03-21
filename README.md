**D&D Virtual Tabletop (DND Board)**

A lightweight, real-time Dungeons & Dragons board for remote gameplay. Drag-and-drop tokens, manage turns, upload battle maps, and roll dice—all in the browser.

**Features**

- Dice rolling with support for custom input (e.g. `2d6+3`)
- Add draggable tokens (Users, NPCs, Enemies) with color coding
- Right-click tokens to open a character sheet or delete them
- Real-time sync via WebSockets (Socket.IO)
- Upload and display a background map
- Combat mode with turn tracking
- Persistent state (tokens + map) saved to a JSON file

**Project Structure**

dashBoard/
├── app.py                 # Flask + Socket.IO backend
├── templates/
│   ├── index.html         # Main game board UI
│   └── character.html     # Pop-up character sheet viewer
├── static/
│   ├── styles.css         # Custom styling (optional)
│   └── uploads/           # Uploaded map images
└── tokens.json            # Auto-generated board state

> ℹ️ The main application script is `index.html`, backed by the `app.py` Flask server.

## 🛠️ Setup & Run

**Clone the repo**
   git clone https://github.com/firatdem/dashBoard.git
   cd dashBoard
   
**Install dependencies**

pip install -r requirements.txt

**Run the app**

python app.py

**Open in browser**

Go to: http://localhost:10000/
⚙️ Requirements
Python 3.x
Flask
Flask-SocketIO
These are included in requirements.txt

**How to Use**
Upload a map using the file input
Add tokens with the User/NPC/Enemy buttons
Right-click a token to open character sheet or delete
Click a token to add notes
Toggle combat mode to start turn-based play
📸 Screenshots (Optional)
You can add images or GIFs here of the board in action.

**License**
MIT License

Have fun rolling initiative!
