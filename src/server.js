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
    roomMaintenance,
    updateOnlineUsers,
    saveRoomImmediate,
    closeRoom,
    getHistoricalUsers,
} from "./utils/utils.js";
import { palette } from "../const/palette.js";

const app = express();
const httpServer = createServer(app);
const io = new Server(httpServer, {
    cors: {
        origin: "*",
        methods: ["GET", "POST"],
    },
});

// serve client
app.use(express.json());
app.use(express.static("public"));
app.use("/const", express.static("const"));
app.use("/api", APIRoutes);
app.use("/", viewRoutes);

connectDB();

// rate limiter
const ratelimit = false;
const lastDrawTime = new Map();
const THROTTLE_DELAY_MS = 100;

const roomCache = new Map(); // Map<roomID, { grid, lastSavedGrid, isAvailable, lastUpdate, users, userData: {}, isSaving }>

//socket set up
io.on("connection", (socket) => {
    socket.on("joinRoom", async ({ roomID, creatorToken, clientID }) => {
        try {
            roomID = String(roomID);
            const room = await Room.findOne({ roomID: Number(roomID) });
            if (!room) return socket.emit("error", "Room not found");

            const isClosed = room.available_at === null;
            socket.join(roomID);

            // capture non-duplicate ip of visitor ONLY if room is active
            const ip = socket.handshake.address;
            if (!room.users.includes(ip) && !isClosed) {
                room.users.push(ip);
                await room.save(); // update db immediately
            }

            // put room in cache if not already
            const cachedRoom = getOrCreateCachedRoom(roomID, room, roomCache);
            cachedRoom.lastUpdate = Date.now();

            // if room is active: show online users
            // if room is closed: show historical users
            let usersToSend;
            if (!isClosed) {
                // remove old socket if same client reconnects
                const existingEntry = Object.entries(cachedRoom.userData).find(
                    ([_, data]) => data.clientID === clientID
                );
                if (existingEntry) {
                    const [oldSocketID] = existingEntry;
                    cachedRoom.users.delete(oldSocketID);
                    delete cachedRoom.userData[oldSocketID];
                }

                cachedRoom.users.add(socket.id);

                // assign nickname bcz socket.id is too long
                assignNickAndColor(socket.id, cachedRoom, clientID);
                // send to front end
                updateOnlineUsers(io, roomID, cachedRoom);
                usersToSend = cachedRoom.userData;
            } else {
                // room is closed: show historical users
                usersToSend = getHistoricalUsers(room.users);
            }

            // send data
            socket.emit("init", {
                room_id: roomID,
                grid: room.grid,
                canvas_height: room.canvas_height,
                canvas_width: room.canvas_width,
                grid_height: room.grid_height,
                grid_width: room.grid_width,
                is_owner: creatorToken === room.creatorToken,
                is_available: cachedRoom.isAvailable,
                userData: usersToSend,
            });

            // save room on user join
            await saveRoomImmediate(roomID, roomCache);
        } catch (error) {
            console.error("error joining room:", error);
            socket.emit("error", error.message);
        }
    });

    // sync painting
    socket.on("drawPixel", async ({ roomID, x, y, color }) => {
        try {
            if (ratelimit) {
                const now = Date.now();
                const lastDraw = lastDrawTime.get(socket.id) || 0;
                if (now - lastDraw < THROTTLE_DELAY_MS) return;
                lastDrawTime.set(socket.id, now);
            }

            const validColors = Object.values(palette);
            if (!validColors.includes(color))
                return socket.emit("error", "Invalid color");

            const room = roomCache.get(String(roomID));
            if (!room || !room.isAvailable) return;

            // bounds checking
            if (
                x < 0 ||
                x >= room.grid.length ||
                y < 0 ||
                y >= room.grid[0].length
            ) {
                return socket.emit("error", "Pixel out of bounds");
            }

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

    socket.on("disconnect", async () => {
        for (const [roomID, cachedRoom] of roomCache) {
            if (cachedRoom.users.has(socket.id)) {
                cachedRoom.users.delete(socket.id);
                delete cachedRoom.userData[socket.id];
                updateOnlineUsers(io, roomID, cachedRoom);
                try {
                    // save room on user disconnect
                    await saveRoomImmediate(roomID, roomCache);
                } catch (error) {
                    console.error("error saving room:", error);
                }
            }
        }
    });

    socket.on("closeRoom", async ({ roomID, creatorToken }) => {
        try {
            console.log("closing room on request");
            await closeRoom(roomID, creatorToken, roomCache, io);
            socket.emit("roomClosed");
        } catch (error) {
            console.error("error closing room:", error);
            socket.emit("error", error.message);
        }
    });
});

// 60 sec co-routine for saving room state
setInterval(async () => {
    try {
        await roomMaintenance(io, roomCache);
    } catch (err) {
        console.error("maintenance failed:", err);
    }
}, 60000);

// start server
const PORT = process.env.PORT || 3000;
httpServer.listen(PORT, () => console.log(`listening on port ${PORT}`));
