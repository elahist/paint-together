import { Server } from "socket.io";
import express from "express";
import { createServer } from "http";
import { connectDB } from "./db/connect.js";
import APIRoutes from "./routes/APIRoutes.js";
import viewRoutes from "./routes/viewRoutes.js";
import { Room } from "./schema/roomSchema.js";
import "dotenv/config";
import {
    assignNickAndColor,
    getOrCreateCachedRoom,
    saveRoomStates,
} from "./utils/utils.js";
import { setInterval } from "timers/promises";

const app = express();
const httpServer = createServer(app);
const io = new Server(httpServer);

// serve client
app.use(express.json());
app.use(express.static("public"));
app.use("/const", express.static("const"));
app.use("/api", APIRoutes);
app.use("/", viewRoutes);

connectDB();

const roomCache = new Map(); // Map<roomID, { grid, lastSavedGrid, isAvailable, lastUpdate, users, userData: {} }>

//socket set up
io.on("connection", (socket) => {
    socket.on("joinRoom", async (roomID) => {
        try {
            roomID = String(roomID);
            const room = await Room.findOne({ roomID: Number(roomID) });
            if (!room) return socket.emit("error", "Room not found");

            socket.join(roomID);

            // capture non-duplicate ip of visitor
            const ip = socket.handshake.address;
            if (!room.users.includes(ip)) {
                room.users.push(ip);
                await room.save(); // update db immediately
            }

            // put room in cache if not already
            const cachedRoom = getOrCreateCachedRoom(roomID, room, roomCache);
            cachedRoom.users.add(socket.id);

            // assign nickname bcz socket.id is too long
            assignNickAndColor(socket.id, cachedRoom);
            // send to front end
            updateOnlineUsers(io, roomID, cachedRoom);

            // send data
            socket.emit("init", {
                room_id: roomID,
                grid: room.grid,
                canvas_height: room.canvas_height,
                canvas_width: room.canvas_width,
                grid_height: room.grid_height,
                grid_width: room.grid_width,
                users: Array.from(cachedRoom.users),
            });
        } catch (error) {
            console.error("error joining room:", error);
            socket.emit("error", error.message);
        }
    });

    // sync painting
    socket.on("drawPixel", async ({ roomID, x, y, color }) => {
        try {
            const room = roomCache.get(String(roomID));
            if (!room || !room.isAvailable) return;

            // update cache
            room.grid[x][y] = color;
            room.lastUpdate = Date.now();

            // send changes to everyone else
            socket.to(roomID).emit("drawPixel", { x, y, color });
        } catch (error) {
            console.error("error in drawPixel:", error);
            socket.emit("error", error.message);
        }
    });

    socket.on("disconnect", () => {
        // remove from all rooms in cache
        roomCache.forEach((cachedRoom, roomID) => {
            if (cachedRoom.users.has(socket.id)) {
                cachedRoom.users.delete(socket.id);
                delete cachedRoom.userData[socket.id];
                io.to(roomID).emit("updateUsers", cachedRoom.userData);
            }
        });
    });
});

// 5 sec co-routine for saving room state
setInterval(saveRoomStates, 5000);

// start server
const PORT = process.env.PORT || 3000;
httpServer.listen(PORT, () => console.log(`listening on port ${PORT}`));
