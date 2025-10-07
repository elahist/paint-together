import { palette } from "../../const/palette.js";

let canvas = document.querySelector("canvas");
let ctx = canvas.getContext("2d");
ctx.imageSmoothingEnabled = false; // useful for pixel art

let closeBtn = document.getElementById("close_canvas");

// configs
let cfg = {
    canvas_height: 550,
    canvas_width: 550,
    grid_height: 30,
    grid_width: 30,
    grid: [],
    current_color: palette.cyan_dark,
    read_only: false,
    userCursors: {}, // track last drawn position for each user
};

// extract room ID from url: /room/8992
const roomID = Number(window.location.pathname.split("/")[2]);
const socket = io();

socket.on("connect", () => {
    console.log("connected to socket server:", socket.id);
});

socket.on("error", (error) => {
    console.error("an error occured:", error);
    window.location.href = `/error.html?message=${encodeURIComponent(error)}`;
});

const creatorToken = localStorage.getItem(`creatorToken-${roomID}`);
let clientID = localStorage.getItem(`paintClientID`);
// create one if client ID doesn't exist
if (!clientID) {
    // fallback for browsers that don't support crypto api
    clientID = crypto.randomUUID ? crypto.randomUUID() : generateUUID();
    localStorage.setItem(`paintClientID`, clientID);
}

// fallback UUID generator
function generateUUID() {
    return "xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx".replace(
        /[xy]/g,
        function (c) {
            const r = (Math.random() * 16) | 0;
            const v = c === "x" ? r : (r & 0x3) | 0x8;
            return v.toString(16);
        }
    );
}

// tell server we joined the room
socket.emit("joinRoom", { roomID, creatorToken, clientID });

socket.on("init", (room) => {
    cfg.canvas_width = room.canvas_width;
    cfg.canvas_height = room.canvas_height;
    cfg.grid_height = room.grid_height;
    cfg.grid_width = room.grid_width;
    cfg.grid = room.grid;

    document.getElementById("room_id").innerText = roomID;
    console.log(`creator: ${room.is_owner}`);
    console.log(`available: ${room.is_available}`);

    cfg.read_only = !room.is_available;
    setUI(room.is_available, room.is_owner);
    displayUsers(room.userData);
    init();
});

// reflect everyone else's drawing
socket.on("drawPixel", ({ x, y, color, userId, userColor }) => {
    drawPixel(x, y, color);

    // update cursor position for this user
    if (userId && userColor) {
        cfg.userCursors[userId] = { x, y, color: userColor };

        // redraw canvas with new cursor positions
        redrawCanvas();

        // auto-remove cursor after 2 seconds of inactivity
        setTimeout(() => {
            if (
                cfg.userCursors[userId] &&
                cfg.userCursors[userId].x === x &&
                cfg.userCursors[userId].y === y
            ) {
                delete cfg.userCursors[userId];
                redrawCanvas();
            }
        }, 2000);
    }
});

// add and remove users (only for active rooms)
socket.on("updateUsers", (userData) => {
    displayUsers(userData);

    // remove cursors for users who left
    const activeUserIds = Object.keys(userData);
    for (const userId in cfg.userCursors) {
        if (!activeUserIds.includes(userId)) {
            delete cfg.userCursors[userId];
        }
    }
    redrawCanvas();
});

closeBtn.addEventListener("dblclick", () => {
    socket.emit("closeRoom", { roomID, creatorToken });
});

socket.on("roomClosed", () => {
    cfg.read_only = true;
    setUI(false);
});

function displayUsers(userData) {
    const infoDiv = document.querySelector(".info");
    infoDiv.querySelectorAll(".user-pill").forEach((user) => user.remove());

    Object.entries(userData).forEach(([id, { nickname, color }]) => {
        const span = document.createElement("span");
        span.className = "pill user-pill";
        span.style.backgroundColor = color;
        span.id = `user-${id}`;
        span.style.border = `2px solid ${color}`;
        span.innerHTML = `<span class="material-symbols-rounded">person</span><span>${nickname}</span>`; // accessibility
        infoDiv.appendChild(span);
    });
}

function setUI(isAvailable, isCreator = false) {
    document.querySelector(".controls").style.display = isAvailable
        ? "flex"
        : "none";

    closeBtn.style.display = isAvailable && isCreator ? "flex" : "none";

    const canvas = document.querySelector("canvas");
    canvas.style.cursor = isAvailable ? "crosshair" : "not-allowed";
}

function drawPixel(x, y, color) {
    let cellWidth = cfg.canvas_width / cfg.grid_width;
    let cellHeight = cfg.canvas_height / cfg.grid_height;

    ctx.fillStyle = color;
    ctx.fillRect(x * cellWidth, y * cellHeight, cellWidth, cellHeight);
    ctx.strokeStyle = palette.black;
    ctx.strokeRect(x * cellWidth, y * cellHeight, cellWidth, cellHeight);
    cfg.grid[x][y] = color;
}

function drawCursorHighlights() {
    let cellWidth = cfg.canvas_width / cfg.grid_width;
    let cellHeight = cfg.canvas_height / cfg.grid_height;

    for (const [userId, data] of Object.entries(cfg.userCursors)) {
        const { x, y, color } = data;

        // draw thick colored border around the cell
        ctx.strokeStyle = color;
        ctx.lineWidth = 3;
        ctx.strokeRect(
            x * cellWidth + 1.5,
            y * cellHeight + 1.5,
            cellWidth - 3,
            cellHeight - 3
        );
    }

    // reset line width
    ctx.lineWidth = 1;
}

function redrawCanvas() {
    if (!cfg.grid || cfg.grid.length === 0) {
        console.warn("grid not ready for draw yet");
        return;
    }
    // redraw all pixels
    for (let w = 0; w < cfg.grid_width; w++) {
        for (let h = 0; h < cfg.grid_height; h++) {
            drawPixel(w, h, cfg.grid[w][h]);
        }
    }
    // draw cursor highlights on top
    drawCursorHighlights();
}

function resizeCanvas() {
    const container = canvas.parentElement;
    const padding = 20;
    const availableWidth = container.clientWidth - padding * 2;
    const availableHeight = container.clientHeight - padding * 2;

    const displaySize = Math.min(availableWidth, availableHeight, 550);
    const dpr = window.devicePixelRatio || 1;

    canvas.width = displaySize * dpr;
    canvas.height = displaySize * dpr;

    canvas.style.width = displaySize + "px";
    canvas.style.height = displaySize + "px";

    ctx.setTransform(1, 0, 0, 1, 0, 0);
    ctx.scale(dpr, dpr);

    cfg.canvas_width = displaySize;
    cfg.canvas_height = displaySize;

    canvas.style.display = "block";
    canvas.style.margin = "0 auto";

    redrawCanvas();
}

function paintCell(e) {
    if (cfg.read_only) return;

    let clientX, clientY;
    if (e.touches && e.touches.length > 0) {
        // touch event
        clientX = e.touches[0].clientX;
        clientY = e.touches[0].clientY;
    } else {
        // mouse event
        clientX = e.clientX;
        clientY = e.clientY;
    }

    // co-ords INSIDE the canvas at (0,0)
    let rect = canvas.getBoundingClientRect();
    let x = clientX - rect.left;
    let y = clientY - rect.top;

    let cellWidth = cfg.canvas_width / cfg.grid_width;
    let cellHeight = cfg.canvas_height / cfg.grid_height;

    // cell co-ords based on mouse co-ords
    let w = Math.floor(x / cellWidth);
    let h = Math.floor(y / cellHeight);

    // erase if it's a right click (mouse only)
    let color = e.buttons === 2 ? palette.white : cfg.current_color;

    drawPixel(w, h, color);

    // let everyone else know
    socket.emit("drawPixel", { roomID, x: w, y: h, color });
}

function init() {
    canvas.height = cfg.canvas_height;
    canvas.width = cfg.canvas_width;
    // draw blank grid
    for (let w = 0; w < cfg.grid_width; w++) {
        for (let h = 0; h < cfg.grid_height; h++) {
            drawPixel(w, h, cfg.grid[w][h]);
        }
    }
    if (cfg.read_only) return;
    // draw buttons
    for (let [name, color] of Object.entries(palette)) {
        let btn = document.createElement("button");
        btn.title = name; // accessibility
        btn.style.backgroundColor = color;
        btn.dataset.color = color;
        btn.addEventListener("click", (e) => {
            cfg.current_color = e.target.dataset.color;
        });
        document.querySelector(".controls").appendChild(btn);
    }

    resizeCanvas();

    let resizeTimeout;
    window.addEventListener("resize", () => {
        clearTimeout(resizeTimeout);
        resizeTimeout = setTimeout(resizeCanvas, 150);
    });
}

// for click-and-drag painting
let isDrawing = false;

canvas.addEventListener("mousedown", (e) => {
    isDrawing = true;
    paintCell(e);
});

canvas.addEventListener("mousemove", (e) => {
    if (isDrawing) paintCell(e);
});

// keeps redrawing when we leave and re-enter the canvas
document.addEventListener("mouseup", (e) => {
    isDrawing = false;
});

// stops drawing if we leave the canvas
// canvas.addEventListener("mouseleave", (e)=>{
//     isDrawing = false;
// });

// disable ctxmenu because it should erase
canvas.addEventListener("contextmenu", (event) => event.preventDefault());

// touch support for mobile devices
canvas.addEventListener("touchstart", (e) => {
    e.preventDefault(); // prevent scrolling/pull down to reload
    isDrawing = true;
    paintCell(e);
});

canvas.addEventListener("touchmove", (e) => {
    e.preventDefault(); // prevent scrolling
    if (isDrawing) paintCell(e);
});

canvas.addEventListener("touchend", (e) => {
    e.preventDefault();
    isDrawing = false;
});

canvas.addEventListener("touchcancel", (e) => {
    e.preventDefault();
    isDrawing = false;
});
