const socket = io();
const board = document.getElementById("board");
const contextMenu = document.getElementById('contextMenu');
const gridSize = 50;
const tokenSize = 30;

let turnOrder = [];
let currentTurn = -1;
let combatActive = false;
let activeToken = null;
let selectedTokenId = null;

// Map upload handler
document.getElementById("mapUpload").addEventListener("change", function(event) {
    let file = event.target.files[0];
    let formData = new FormData();
    formData.append("file", file);

    fetch("/upload", { method: "POST", body: formData })
        .then(response => response.json())
        .then(data => {
            if (data.status === "success") {
                board.style.backgroundImage = `url(${data.url})`;
            }
        });
});

// Token Management
function addToken(type) {
    const initialX = Math.floor(board.offsetWidth / 2 / gridSize) * gridSize + (gridSize - tokenSize)/2;
    const initialY = Math.floor(board.offsetHeight / 2 / gridSize) * gridSize + (gridSize - tokenSize)/2;
    socket.emit("add_token", {
        x: initialX,
        y: initialY,
        type: type
    });
}

// Combat Functions
function toggleCombat() { socket.emit("toggle_combat"); }
function nextTurn() { socket.emit("next_turn"); }

// Dice Functions
function rollDice(diceType) { socket.emit("roll_dice", { player: "DM", roll: '1' + diceType }); }
function manualRoll() {
    const roll = document.getElementById("diceInput").value;
    if (roll) socket.emit("roll_dice", { player: "DM", roll: roll });
}

// Context Menu Functions
function showCharacterSheet(event) {
    event.stopPropagation();
    const tokenElement = document.querySelector(`[data-id="${selectedTokenId}"]`);
    if (!tokenElement) return;

    try {
        const tokenData = JSON.parse(tokenElement.getAttribute("data-text") || "{}");
        document.getElementById("charName").value = tokenData.name || "";
        document.getElementById("charHP").value = tokenData.hp || "";
        document.getElementById("charNotes").value = tokenData.notes || "";
        document.getElementById("characterSheet").style.display = "block";
    } catch (e) {
        console.error("Error parsing character data:", e);
    }
    contextMenu.style.display = "none";
}

function deleteSelectedToken(event) {
    event.stopPropagation();
    if (selectedTokenId) socket.emit("delete_token", { id: selectedTokenId });
    contextMenu.style.display = 'none';
}

function saveCharacterData(event) {
    event.stopPropagation();
    const tokenElement = document.querySelector(`[data-id="${selectedTokenId}"]`);
    if (!tokenElement) return;

    const charData = {
        name: document.getElementById("charName").value,
        hp: document.getElementById("charHP").value,
        notes: document.getElementById("charNotes").value
    };

    socket.emit("update_text", {
        id: selectedTokenId,
        text: JSON.stringify(charData)
    });

    document.getElementById("characterSheet").style.display = "none";
}

// Event Listeners
document.addEventListener('click', function(e) {
    if (!contextMenu.contains(e.target)) contextMenu.style.display = 'none';
    if (!document.getElementById("characterSheet").contains(e.target)) {
        document.getElementById("characterSheet").style.display = 'none';
    }
});

// Socket Handlers
socket.on("board_state", function(data) {
    document.querySelectorAll(".token").forEach(t => t.remove());
    data.tokens.forEach(token => createToken(token));
    combatActive = data.combat_active;
    currentTurn = data.current_turn;
    highlightCurrentTurn();
    if (data.image) board.style.backgroundImage = `url(${data.image})`;
});

socket.on("token_moved", function(data) {
    const token = document.querySelector(`[data-id="${data.id}"]`);
    if (token) {
        token.style.left = `${data.x}px`;
        token.style.top = `${data.y}px`;
    }
});

socket.on("token_deleted", function(data) {
    const token = document.querySelector(`[data-id="${data.id}"]`);
    if (token) token.remove();
});

socket.on("combat_status", function(data) {
    combatActive = data.active;
    currentTurn = data.current_turn;
    highlightCurrentTurn();
});

socket.on("turn_updated", function(data) {
    currentTurn = data.current_turn;
    highlightCurrentTurn();
});

socket.on("dice_result", function(data) {
    let chatMessages = document.getElementById("chatMessages");
    let message = document.createElement("li");
    message.innerHTML = data.message;
    chatMessages.appendChild(message);
    chatMessages.scrollTop = chatMessages.scrollHeight;
});

socket.on("token_added", function(data) {
    createToken(data);
});

// Token Creation
function createToken(data) {
    let token = document.createElement("div");
    token.classList.add("token");
    token.innerText = data.type[0];
    token.style.backgroundColor = data.color;
    token.style.left = `${data.x}px`;
    token.style.top = `${data.y}px`;
    token.setAttribute("data-id", data.id);
    token.setAttribute("data-type", data.type);
    token.setAttribute("data-text", data.text || "");
    board.appendChild(token);
    makeDraggable(token);
}

// Dragging Logic
function makeDraggable(token) {
    let offsetX = 0, offsetY = 0;
    let isDragging = false;
    let mouseDownTime = 0;
    let selectedToken = null;

    token.addEventListener("contextmenu", function(event) {
        event.preventDefault();
        selectedTokenId = parseInt(token.getAttribute("data-id"));
        const viewportWidth = window.innerWidth;
        const viewportHeight = window.innerHeight;
        contextMenu.style.display = 'block';

        const menuWidth = contextMenu.offsetWidth;
        const menuHeight = contextMenu.offsetHeight;
        let leftPosition = event.clientX;
        let topPosition = event.clientY;

        if (leftPosition + menuWidth > viewportWidth) leftPosition = viewportWidth - menuWidth - 5;
        if (topPosition + menuHeight > viewportHeight) topPosition = viewportHeight - menuHeight - 5;

        contextMenu.style.left = `${leftPosition}px`;
        contextMenu.style.top = `${topPosition}px`;
    });

    token.addEventListener("mousedown", function(event) {
        if (event.button === 2) return;
        event.stopPropagation();
        mouseDownTime = Date.now();
        isDragging = false;
        selectedToken = token;

        let rect = token.getBoundingClientRect();
        offsetX = event.clientX - rect.left;
        offsetY = event.clientY - rect.top;

        document.addEventListener("mousemove", moveToken);
        document.addEventListener("mouseup", releaseToken);
    });

    function moveToken(event) {
        if (!selectedToken) return;
        let newX = event.clientX - offsetX - board.getBoundingClientRect().left;
        let newY = event.clientY - offsetY - board.getBoundingClientRect().top;

        newX = Math.floor((newX + gridSize/2) / gridSize) * gridSize - tokenSize/2;
        newY = Math.floor((newY + gridSize/2) / gridSize) * gridSize - tokenSize/2;

        selectedToken.style.left = `${newX}px`;
        selectedToken.style.top = `${newY}px`;
        isDragging = true;
    }

    function releaseToken() {
        if (!selectedToken) return;
        document.removeEventListener("mousemove", moveToken);
        document.removeEventListener("mouseup", releaseToken);

        let clickDuration = Date.now() - mouseDownTime;
        if (!isDragging && clickDuration < 300) {
            showTextBox(selectedToken);
        } else {
            socket.emit("move_token", {
                id: parseInt(selectedToken.getAttribute("data-id")),
                x: parseInt(selectedToken.style.left),
                y: parseInt(selectedToken.style.top)
            });
        }
        selectedToken = null;
    }
}

// Initialization
socket.emit("request_board_state");

// Helper Functions
function highlightCurrentTurn() {
    document.querySelectorAll(".token").forEach(token => {
        token.classList.remove("active-turn");
        let tokenId = parseInt(token.getAttribute("data-id"));
        if (turnOrder[currentTurn] === tokenId) token.classList.add("active-turn");
    });
}

function showTextBox(token) {
    // Your existing textbox handling logic
    const text = token.getAttribute("data-text") || "";
    textBox.value = text;
    textBox.style.display = "block";
    textBox.style.left = `${parseInt(token.style.left) + 35}px`;
    textBox.style.top = `${parseInt(token.style.top) + 35}px`;

    textBox.onkeyup = function(e) {
        token.setAttribute("data-text", textBox.value);
        socket.emit("update_text", {
            id: parseInt(token.getAttribute("data-id")),
            text: textBox.value
        });
    };
}