// only deals with cached rooms
const roomCache = new Map();

export function getRoom(roomID) {
    return roomCache.get(roomID) || null;
}

export function setRoom(roomID, data) {
    roomCache.set(roomID, data);
}

export function hasRoom(roomID) {
    return roomCache.has(roomID);
}

export function deleteRoom(roomID) {
    return roomCache.delete(roomID);
}

export function listRooms() {
    return Array.from(roomCache.keys());
}

export function ensureRoom(roomID, defaults = {}) {
    if (!hasRoom(roomID)) {
        setRoom(roomID, {
            roomID,
            users: new Set(),
            grid: [],
            isAvailable: true,
            isSaving: false,
            lastUpdate: Date.now(),
            userData: {},
            lastSavedGrid: null,
            ...defaults,
        });
    }
    return roomCache.get(roomID);
}

// nice try diddy
export function touchRoom(roomID) {
    const room = getRoom(roomID);
    if (room) room.lastUpdate = Date.now();
}

export function setPixel(roomID, x, y, color) {
    const room = getRoom(roomID);
    // loving this
    if (!room?.grid?.[x]?.[y] || typeof room.grid[x][y] === "undefined")
        return false;
    room.grid[x][y] = color;
    touchRoom(roomID);
    return true;
}

export function getRawCache() {
    return roomCache;
}
