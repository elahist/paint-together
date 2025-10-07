import { Room } from "../schema/roomSchema.js";

// record of rooms currently being saved
const savingLocks = new Set();

// save single room if modified
export async function saveRoom(room) {
    if (!room) return false;

    if (!room.roomID) {
        console.error("[roomPersistence] Missing roomID on room");
        return false;
    }

    const roomID = room.roomID;

    if (savingLocks.has(roomID)) return false;
    const currentGrid = JSON.stringify(room.grid);

    // no change
    if (currentGrid === room.lastSavedGrid) return false;

    savingLocks.add(roomID);

    try {
        await Room.updateOne(
            { roomID },
            { grid: room.grid, updated_at: new Date(room.lastUpdate) }
        );
        room.lastSavedGrid = currentGrid;
        console.log(`[roomPersistence] saved room ${roomID}`);
        return true;
    } catch (err) {
        console.error(`[roomPersistence] failed to save ${roomID}:`, err);
        return false;
    } finally {
        savingLocks.delete(roomID);
    }
}

export async function saveRoomNow(room) {
    return saveRoom(room);
}
