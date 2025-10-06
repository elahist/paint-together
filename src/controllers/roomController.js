import { Room } from "../schema/roomSchema.js";
import { palette } from "../../const/palette.js";
import crypto from "crypto";

// generate a unique 4 digit room ID
async function generateRoomID() {
    let id;
    let exists = true;
    do {
        id = Math.floor(1000 + Math.random() * 9000); // random 4 digit number
        exists = await Room.findOne({ roomID: id });
    } while (exists);
    return id;
}

export async function createRoom(req, res) {
    try {
        const { row = 30, col = 30 } = req.body;
        // validating input 5-100
        const gridWidth = Math.min(Math.max(Number(col), 5), 100);
        const gridHeight = Math.min(Math.max(Number(row), 5), 100);

        // blank grid
        const blankGrid = Array.from({ length: gridWidth }, () =>
            Array(gridHeight).fill(palette.white)
        );

        const roomID = await generateRoomID();
        const creatorIP = req.ip;
        const creatorToken = crypto.randomUUID(); // unique per room

        const room = new Room({
            roomID,
            canvas_height: 550,
            canvas_width: 550,
            grid_height: gridHeight,
            grid_width: gridWidth,
            grid: blankGrid,
            creatorIP,
            creatorToken,
            users: [], // will append ip once creator joins
            created_at: new Date(),
            updated_at: new Date(),
            available_at: new Date(),
        });

        await room.save();
        // send the token to creator only
        res.status(200).json({ roomID, creatorToken });
    } catch (err) {
        console.error("error creating room:", err);
        res.status(500).json({ error: "Failed to create room" });
    }
}
