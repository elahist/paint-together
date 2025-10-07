import { palette } from "../../const/palette.js";
import { Room } from "../schema/roomSchema.js";
import { getRawCache } from "./roomCacheUtils.js";
import { saveRoom } from "./roomPersistenceUtils.js";

let maintenanceLock = false;

export async function roomMaintenance(io) {
    if (maintenanceLock) return;

    maintenanceLock = true;

    const roomCache = getRawCache();
    const now = Date.now();

    try {
        for (const [roomID, room] of roomCache) {
            // no changes for an hour AND no users = inactive
            const inactive =
                now - room.lastUpdate > 1 * 60 * 60 * 1000 &&
                room.users.size === 0;

            // active -> continue with periodic save
            if (!inactive) {
                await saveRoom(room);
                continue;
            }

            const isBlank = room.grid.every((row) =>
                row.every((cell) => cell === palette.white)
            );
            // inactive && blank grid -> delete
            if (isBlank) {
                await Room.deleteOne({ roomID });
                console.log(
                    `[roomMaintenance] deleted inactive blank room ${roomID}`
                );
            } else {
                // inactive && not blank -> save and close
                await Room.updateOne({ roomID }, { is_available: false });
                io.to(roomID).emit("roomClosed");
                console.log(`[roomMaintenance] closed inactive room ${roomID}`);
            }
            // remove from cache to prevent memory leak
            roomCache.delete(roomID);
        }
    } catch (err) {
        console.error("[roomMaintenance] maintenance failed:", err);
    } finally {
        maintenanceLock = false;
    }
}

export async function closeRoom(roomID, creatorToken, io) {
    const room = await Room.findOne({ roomID });
    if (!room) {
        console.error("[roomMaintenance] room to close not found");
        io.to(roomID).emit("error", "room not found");
        return false;
    }
    if (room.creatorToken !== creatorToken) {
        console.error("[roomMaintenance] unauthorized close room request");
        io.to(roomID).emit("error", "unauthorized");
        return false;
    }

    const roomCache = getRawCache();
    const cachedRoom = roomCache.get(roomID);

    // update db doc with cached grid if it exists
    if (cachedRoom) {
        room.grid = cachedRoom.grid;
        room.updated_at = new Date(cachedRoom.lastUpdate);
        cachedRoom.isAvailable = false;
    }

    room.is_available = false;
    await room.save();

    roomCache.delete(roomID);

    io.to(roomID).emit("roomClosed");
    console.log(`[roomMaintenance] room ${roomID} closed on request`);
    return true;
}
