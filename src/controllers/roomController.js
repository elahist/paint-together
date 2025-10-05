import { Room } from "../schema/roomSchema.js";
import { palette } from "../../const/palette.js";

// generate a unique 4 digit room ID
async function generateRoomID(){
    let id;
    let exists = true;
    while(exists) {
        id = Math.floor(1000 + Math.random() * 9000); // random 4 digit number
        exists = await Room.findOne({roomID: id});
    }
    return id;
}

export async function createRoom(req, res) {
    try{
        // not letting user configure canvas for now
        const gridWidth = 30, gridHeight = 30;
        // blank grid
        const blankGrid = Array.from({length: gridWidth}, () =>
            Array(gridHeight).fill(palette.white)
        );

        const roomID = await generateRoomID();
        
        const room = new Room({
            roomID,
            canvas_height: 550,
            canvas_width: 550,
            grid_height: gridHeight,
            grid_width: gridWidth,
            grid: blankGrid,
            users: [], // will append ip once creator joins
            creationDate: new Date(),
            lastUpdated: new Date(),
            isAvailable: true
        });

        await room.save();
        res.status(200).json({ roomID });
    } catch (err) {
        console.error("Error creating room:", err);
        res.status(500).json({ error: "Failed to create room" });
    }   
}