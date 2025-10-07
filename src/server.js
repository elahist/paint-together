import { Server } from "socket.io";
import express from "express";
import { createServer } from "http";
import { connectDB } from "./db/connect.js";
import APIRoutes from "./routes/APIRoutes.js";
import viewRoutes from "./routes/viewRoutes.js";
import { Room } from "./schema/roomSchema.js";
import "dotenv/config";
import { palette } from "../const/palette.js";
import {
    getRoom,
    setPixel,
    ensureRoom,
    hasRoom,
    touchRoom,
} from "./utils/roomCacheUtils.js";
import { roomMaintenance, closeRoom } from "./utils/roomMaintenanceUtils.js";
import { saveRoomNow } from "./utils/roomPersistenceUtils.js";
import {
    assignNickAndColor,
    getHistoricalUsers,
    safeUserData,
    updateOnlineUsers,
    removeUser,
} from "./utils/userCacheUtils.js";

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

// socket set up
io.on("connection", (socket) => {
    socket.on("joinRoom", async ({ roomID, creatorToken, clientID }) => {
        try {
            roomID = Number(roomID);
            const room = await Room.findOne({ roomID });
            if (!room) {
                console.error(`[socket] room ${roomID} does not exist`);
                socket.emit("error", "Room does not exist");
                return;
            }

            const isClosed = !room.is_available;
            socket.join(roomID);

            // capture non-duplicate ip of visitor ONLY if room is active
            const ip = socket.handshake.address;
            const existingUser = room.users.find((u) => u.ip === ip);
            if (!existingUser && !isClosed) {
                room.users.push({ ip, socketID: socket.id, clientID });
                await room.save();
            }

            // put room in cache if not already
            const cachedRoom = ensureRoom(roomID, {
                grid: room.grid,
                isAvailable: room.is_available,
            });
            touchRoom(roomID);

            // if room is active: show online users
            // if room is closed: show historical users
            let usersToSend;
            if (!isClosed) {
                // take care of ghost sockets
                const existingEntry = Object.entries(cachedRoom.userData).find(
                    ([_, data]) => data.clientID === clientID
                );
                if (existingEntry) {
                    const [oldSocketID] = existingEntry;
                    cachedRoom.users.delete(oldSocketID);
                    delete cachedRoom.userData[oldSocketID];
                }

                cachedRoom.users.add(socket.id);

                // assign nickname and color
                assignNickAndColor({
                    socketID: socket.id,
                    clientID,
                    ip,
                    cachedRoom,
                });

                // send to front end
                updateOnlineUsers(io, roomID, cachedRoom);
                usersToSend = safeUserData(cachedRoom);
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
            await saveRoomNow(cachedRoom);
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
            if (!validColors.includes(color)) {
                console.error(`[socket] invalid color: ${color}`);
                return socket.emit("error", "invalid color");
            }

            const room = getRoom(roomID);
            if (!room || !room.isAvailable)
                return console.error(
                    `[socket] room ${roomID} is not available`
                );

            // bounds checking
            if (
                x < 0 ||
                x >= room.grid.length ||
                y < 0 ||
                y >= room.grid[0]?.length
            )
                return console.error(`[socket] out of bounds: x=${x}, y=${y}`);

            // update pixel in cache
            const success = setPixel(roomID, x, y, color);
            if (!success)
                return console.error(`[socket] setPixel in cache failed`);

            // get user's color from userData
            const userColor = room.userData[socket.id]?.color;

            // send changes to everyone else WITH user info for cursor
            socket.to(roomID).emit("drawPixel", {
                x,
                y,
                color,
                userId: socket.id,
                userColor: userColor,
            });
        } catch (error) {
            console.error("error in drawPixel:", error);
            socket.emit("error", error.message);
        }
    });

    socket.on("disconnect", async () => {
        // find which room this socket was in
        for (const roomID of socket.rooms) {
            if (roomID === socket.id) continue; // skip socket's own room

            const cachedRoom = getRoom(roomID);
            if (cachedRoom && removeUser(socket.id, cachedRoom)) {
                updateOnlineUsers(io, roomID, cachedRoom);
                try {
                    await saveRoomNow(cachedRoom);
                } catch (error) {
                    console.error(`error saving room ${roomID}:`, error);
                }
            }
        }
    });

    socket.on("closeRoom", async ({ roomID, creatorToken }) => {
        try {
            await closeRoom(roomID, creatorToken, io);
            socket.emit("roomClosed");
        } catch (error) {
            console.error("error closing room:", error);
            socket.emit("error", error.message);
        }
    });
});

// 60 sec co-routine for maintenance checks
setInterval(async () => {
    try {
        await roomMaintenance(io);
    } catch (err) {
        console.error("maintenance failed:", err);
    }
}, 60000);

// start server
const PORT = process.env.PORT || 3000;
httpServer.listen(PORT, () => console.log(`listening on port ${PORT}`));
