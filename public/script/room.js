import { palette } from "../../const/palette.js";

let canvas = document.querySelector('canvas');
let ctx = canvas.getContext('2d');
ctx.imageSmoothingEnabled = false; // useful for pixel art

// configs
let cfg = {
    canvas_height: 550,
    canvas_width: 550,
    grid_height: 30,
    grid_width: 30,
    grid: [],
    current_color: palette.cyan_dark
}

const socket = io(location.href);
socket.on("init", (serverGrid) => {
    cfg.grid = serverGrid;
    init();
});

function drawPixel(x, y, color){
    let cellWidth = cfg.canvas_width / cfg.grid_width;
    let cellHeight = cfg.canvas_height / cfg.grid_height;

    ctx.fillStyle = color;
    ctx.fillRect(x * cellWidth, y * cellHeight, cellWidth, cellHeight);
    ctx.strokeStyle = palette.black;
    ctx.strokeRect(x * cellWidth, y * cellHeight, cellWidth, cellHeight);
    cfg.grid[x][y] = color;
}

function paintCell(e){
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
    if(e.buttons === 2) return drawPixel(w, h, palette.white);

    drawPixel(w, h, cfg.current_color)
}

function init(){
    canvas.height = cfg.canvas_height;
    canvas.width = cfg.canvas_width;
    
    // draw blank grid
    for(let w = 0; w < cfg.grid_width; w++){
        cfg.grid[w] = [];
        for(let h = 0; h < cfg.grid_height; h++){
            drawPixel(w, h, palette.white);
        }
    }

    // draw buttons
    for(let [name, color] of Object.entries(palette)){
        let btn = document.createElement("button");
        btn.title = name; // accessibility
        btn.style.backgroundColor = color;
        btn.dataset.color = color;
        btn.addEventListener("click", (e)=>{
            cfg.current_color = e.target.dataset.color;
        })
        document.querySelector(".controls").appendChild(btn);
    }    
}

// for click-and-drag painting
let isDrawing = false;

canvas.addEventListener("mousedown", (e)=>{
    isDrawing = true;
    paintCell(e);
});

canvas.addEventListener("mousemove", (e)=>{
    if(isDrawing) paintCell(e);
});

// keeps redrawing when we leave and re-enter the canvas
document.addEventListener("mouseup", (e)=>{
    isDrawing = false;
});

// stops drawing if we leave the canvas
// canvas.addEventListener("mouseleave", (e)=>{
//     isDrawing = false;
// });

// disable ctxmenu because it should erase
canvas.addEventListener('contextmenu', event => event.preventDefault());

init();