import mongoose from "mongoose";

const roomSchema = new mongoose.Schema({
    roomID: {type: Number, required: true, unique: true},
    canvas_height: Number,
    canvas_width: Number,
    grid_height: Number,
    grid_width: Number,
    grid: [[String]],
    users: [String],
    creationDate: {type: Date, default: Date.now},
    lastUpdated: {type: Date, default: Date.now},
    isAvailable: {type: Boolean, default: true}
})

export const Room = mongoose.model("Room", roomSchema);