import mongoose from "mongoose";

const roomSchema = new mongoose.Schema({
    roomID: { type: Number, required: true, unique: true },
    canvas_height: Number,
    canvas_width: Number,
    grid_height: Number,
    grid_width: Number,
    grid: [[String]],
    creatorIP: String,
    creatorToken: { type: String, required: true },
    users: [String],
    created_at: { type: Date, default: Date.now },
    updated_at: { type: Date, default: Date.now },
    available_at: { type: Date, default: Date.now, required: false },
});

export const Room = mongoose.model("Room", roomSchema);
