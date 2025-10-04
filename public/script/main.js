let canvas = document.querySelector('canvas');
let ctx = canvas.getContext('2d');
ctx.imageSmoothingEnabled = false; // useful for pixel art

let palette = {
  "red_light": "rgba(255, 199, 199, 1)",
  "red_medium": "rgba(204, 102, 102, 1)",
  "red_dark": "rgba(153, 51, 51, 1)",
  "blue_light": "rgba(173, 216, 230, 1)",
  "blue_medium": "rgba(100, 149, 237, 1)",
  "blue_dark": "rgba(65, 105, 145, 1)",
  "green_light": "rgba(180, 238, 180, 1)",
  "green_medium": "rgba(102, 180, 102, 1)",
  "green_dark": "rgba(56, 94, 56, 1)",
  "yellow_light": "rgba(255, 255, 153, 1)",
  "yellow_medium": "rgba(255, 218, 110, 1)",
  "yellow_dark": "rgba(204, 153, 0, 1)",
  "purple_light": "rgba(221, 160, 221, 1)",
  "purple_medium": "rgba(147, 112, 219, 1)",
  "purple_dark": "rgba(106, 90, 205, 1)",
  "orange_light": "rgba(255, 204, 153, 1)",
  "orange_medium": "rgba(255, 140, 0, 1)",
  "orange_dark": "rgba(204, 102, 0, 1)",
  "cyan_light": "rgba(175, 238, 238, 1)",
  "cyan_medium": "rgba(0, 139, 139, 1)",
  "cyan_dark": "rgba(0, 100, 100, 1)",
  "brown_light": "rgba(210, 180, 140, 1)",
  "brown_medium": "rgba(139, 69, 19, 1)",
  "brown_dark": "rgba(101, 67, 33, 1)",
  "gray_light": "rgba(220, 220, 220, 1)",
  "gray_medium": "rgba(169, 169, 169, 1)",
  "gray_dark": "rgba(105, 105, 105, 1)",
  "white": "rgba(255, 255, 255, 1)",
  "black": "rgba(0, 0, 0, 1)"
}

// configs
let cfg = {
    canvas_height: 550,
    canvas_width: 550,
    grid_height: 50,
    grid_width: 50,
    grid: [],
    current_color: palette.cyan_dark
}

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

canvas.addEventListener("mouseup", (e)=>{
    isDrawing = false;
});

canvas.addEventListener("mouseleave", (e)=>{
    isDrawing = false;
});

// disable ctxmenu because it should erase
canvas.addEventListener('contextmenu', event => event.preventDefault());

init();