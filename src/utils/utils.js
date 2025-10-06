import { log } from "console";
import { nicknames } from "../../const/nicknames.js";
import { palette } from "../../const/palette.js";
import { pastelColors } from "../../const/pastelColors.js";
import { Room } from "../schema/roomSchema.js";

export function getOrCreateCachedRoom(roomID, roomData, roomCache) {
    if (!roomCache.has(roomID)) {
        roomCache.set(roomID, {
            grid: roomData.grid,
            lastSavedGrid: JSON.stringify(roomData.grid),
            isAvailable: roomData.available_at !== null, // null = closed, Date = available
            lastUpdate: Date.now(),
            users: new Set(), // online users only
            userData: {},
            isSaving: false,
        });
    }
    return roomCache.get(roomID);
}

export function assignNickAndColor(socketID, cachedRoom, clientID) {
    // check if clientID already exists
    const exists = Object.values(cachedRoom.userData).find(
        (u) => u.clientID === clientID
    );
    if (exists) {
        cachedRoom.userData[socketID] = { ...exists, socketID };
        return cachedRoom.userData[socketID];
    }

    const usedNicks = Object.values(cachedRoom.userData).map((u) => u.nickname);
    const availableNicks = nicknames.filter((n) => !usedNicks.includes(n));
    // pick a nick if available else use User-XXX
    const nick = availableNicks.length
        ? availableNicks[Math.floor(Math.random() * availableNicks.length)]
        : `User${Math.floor(Math.random() * 1000)}`;

    const usedColors = Object.values(cachedRoom.userData).map((u) => u.color);
    const availableColors = pastelColors.filter((c) => !usedColors.includes(c));
    // pick a color if available else use #DDD
    const color = availableColors.length
        ? availableColors[Math.floor(Math.random() * availableColors.length)]
        : "#DDD";

    cachedRoom.userData[socketID] = { nickname: nick, color, clientID };
    return cachedRoom.userData[socketID];
}

export function getHistoricalUsers(userIPs) {
    const userData = {};

    userIPs.forEach((ip, index) => {
        const nick = nicknames[index % nicknames.length] || `User${index + 1}`;
        const color = pastelColors[index % pastelColors.length] || "#DDD";

        // use ip as key since there's no socket for historical users
        userData[`historical-${index}`] = {
            nickname: nick,
            color: color,
        };
    });

    return userData;
}

export function updateOnlineUsers(io, roomID, cachedRoom) {
    io.to(roomID).emit("updateUsers", cachedRoom.userData);
}

export async function saveRoom(roomID, room) {
    if (room.isSaving) return false;

    // return if no changes
    const currentGridStr = JSON.stringify(room.grid);
    if (currentGridStr === room.lastSavedGrid) return false;

    // acquire lock
    room.isSaving = true;
    try {
        await Room.updateOne(
            { roomID: Number(roomID) },
            { grid: room.grid, updated_at: room.lastUpdate }
        );
        room.lastSavedGrid = currentGridStr;
        console.log(`saved room ${roomID}`);
        return true;
    } catch (err) {
        console.error(`failed to save room ${roomID}:`, err);
        return false;
    } finally {
        room.isSaving = false;
    }
}

export async function saveRoomImmediate(roomID, roomCache) {
    const room = roomCache.get(String(roomID));
    if (!room || !room.isAvailable) return;
    await saveRoom(roomID, room);
}

// maintenance lock to prevent race
let isMaintaining = false;

// auto closes/saves rooms and deletes them if empty
export async function roomMaintenance(io, roomCache) {
    // prevent concurrent maintenance
    if (isMaintaining) return;

    isMaintaining = true;
    const now = Date.now();

    try {
        for (const [roomID, room] of roomCache) {
            // prevent memory leak from accumulated closed rooms
            if (!room.isAvailable && room.readOnly && room.users.size === 0) {
                roomCache.delete(roomID);
                console.log(`deleted empty room ${roomID}`);
                continue;
            }

            // skip already closed rooms for saving/maintenance
            // we still keep them in cache, but mark them read-only
            if (!room.isAvailable && room.readOnly) continue;

            // if: no users for 1h OR no changes for 3h -> auto-close
            const noUsers = room.users.size === 0;
            const inactiveFor3h = now - room.lastUpdate > 3 * 60 * 60 * 1000;
            const emptyFor1h =
                noUsers && now - room.lastUpdate > 1 * 60 * 60 * 1000;

            if (inactiveFor3h || emptyFor1h) {
                const isEmpty = room.grid.every((col) =>
                    col.every((cell) => cell === palette.white)
                );

                // delete inactive room entirely if it was white
                if (isEmpty) {
                    await Room.deleteOne({ roomID: Number(roomID) });
                    roomCache.delete(roomID);
                    console.log(`deleted empty room ${roomID}`);
                } else {
                    await saveRoom(roomID, room);

                    // mark as closed/read-only
                    await Room.updateOne(
                        { roomID: Number(roomID) },
                        { available_at: null }
                    );
                    room.isAvailable = false;
                    room.readOnly = true; // mark in cache as read-only
                    io.to(roomID).emit("roomClosed"); // notify connected clients
                    console.log(`closed inactive room ${roomID}`);
                }

                continue; // skip further saving for this room
            }

            // SAVE if changed and not inactive
            await saveRoom(roomID, room);
        }
    } finally {
        isMaintaining = false;
    }
}

export async function closeRoom(roomID, creatorToken, roomCache, io) {
    roomID = String(roomID);
    const room = await Room.findOne({ roomID: Number(roomID) });
    if (!room) throw new Error("room not found");

    // only creator can close room
    if (room.creatorToken !== creatorToken) {
        throw new Error("unauthorized");
    }

    // mark unavailable in db
    room.available_at = null;
    await room.save();

    // update cache
    const cachedRoom = roomCache.get(roomID);
    if (cachedRoom) {
        cachedRoom.isAvailable = false;
        cachedRoom.readOnly = true;
    }

    // notify everyone in room
    io.to(roomID).emit("roomClosed");

    return true;
}
