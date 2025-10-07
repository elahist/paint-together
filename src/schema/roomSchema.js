import mongoose from "mongoose";

const userSchema = new mongoose.Schema(
  {
    ip: { type: String, required: true },
    socketId: { type: String, required: true },
    clientID: { type: String, required: true },
  },
  { _id: false }
);

const roomSchema = new mongoose.Schema({
  roomID: { type: Number, required: true, unique: true },

  canvas_height: Number,
  canvas_width: Number,
  grid_height: Number,
  grid_width: Number,
  grid: [[String]],

  creator: {
    ip: { type: String, required: true },
    socketId: { type: String, required: true },
    clientID: { type: String, required: true },
  },

  creatorToken: { type: String, required: true },
  users: [userSchema],

  is_available: { type: Boolean, default: true },

  created_at: { type: Date, default: Date.now },
  updated_at: { type: Date, default: Date.now },
});

roomSchema.pre("save", function (next) {
  this.updated_at = new Date();
  next();
});

export const Room = mongoose.model("Room", roomSchema);
