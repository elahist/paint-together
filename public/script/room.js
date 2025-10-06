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
};

// extract room ID from url: /room/8992
const roomID = window.location.pathname.split("/")[2];
const socket = io();

socket.on("connect", () => {
    console.log("connected to socket server:", socket.id);
});

socket.on("error", (error) => {
    console.error("an error occured:", error);
});

const creatorToken = localStorage.getItem(`creatorToken-${roomID}`);
// create one if client ID doesn't exist
let clientID = localStorage.getItem(`paintClientID`);
if (!clientID) {
    clientID = crypto.randomUUID();
    localStorage.setItem(`paintClientID`, clientID);
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
    setUI(room.is_available);
    displayUsers(room.userData);
    init();
});

// reflect everyone else's drawing
socket.on("drawPixel", ({ x, y, color }) => {
    drawPixel(x, y, color);
});

// add and remove users (only for active rooms)
socket.on("updateUsers", (userData) => {
    displayUsers(userData);
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
    infoDiv.querySelector(".user-pill").forEach((user) => user.remove());

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

function setUI(isAvailable) {
    document.querySelector(".controls").style.display = isAvailable
        ? "flex"
        : "none";
    closeBtn.style.display = isAvailable ? "flex" : "none";

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

function paintCell(e) {
    if (cfg.read_only) return;

    // mouse co-ords INSIDE the canvas at (0,0)
    let rect = canvas.getBoundingClientRect();
    let x = e.clientX - rect.left;
    let y = e.clientY - rect.top;

    let cellWidth = cfg.canvas_width / cfg.grid_width;
    let cellHeight = cfg.canvas_height / cfg.grid_height;

    // cell co-ords based on mouse co-ords
    let w = Math.floor(x / cellWidth);
    let h = Math.floor(y / cellHeight);

    // erase if it's a right click
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
