import { nicknames } from "../../const/nicknames";
import { pastelColors } from "../../const/pastelColors";

export function getOrCreateCachedRoom(roomID, roomData, roomCache) {
    if (!roomCache.has(roomID)) {
        roomCache.set(roomID, {
            grid: room.grid,
            lastSavedGrid: JSON.stringify(room.grid),
            isAvailable: room.available_at !== null, // null = closed, Date = available
            lastUpdate: Date.now(),
            users: new Set(), // online users only
            userData: {},
        });
    }
    return roomCache.get(roomID);
}

export function assignNickAndColor(socketID, cachedRoom) {
    // nick already exists
    if (cachedRoom.userData[socketID]) return cachedRoom.userData[socketID];

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

    cachedRoom.userData[socketID] = { nickname: nick, color };
    return cachedRoom.userData[socketID];
}

export function updateOnlineUsers(io, roomID, cachedRoom) {
    io.to(roomID).emit("updateUsers", cachedRoom.userData);
}

export async function saveRoomStates() {
  for (const [roomID, room] of roomCache) {
    // skip closed rooms
    if (!room.isAvailable) continue;

    const currentGridStr = JSON.stringify(room.grid);
    
    // skip if no changes
    if (currentGridStr === room.lastSavedGrid) continue;

    try {
      await Room.updateOne(
        { roomID: Number(roomID) },
        { grid: room.grid, updated_at: room.lastUpdate }
      );

      // save last saved grid
      room.lastSavedGrid = currentGridStr;
      console.log(`saved room ${roomID}`);
    } catch (err) {
      console.error(`failed to save room ${roomID}:`, err);
    }
  }
}

