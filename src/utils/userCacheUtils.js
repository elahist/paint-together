import { nicknames } from "../../const/nicknames.js";
import { pastelColors } from "../../const/pastelColors.js";
import { touchRoom } from "./roomCacheUtils.js";

function pickRandom(array) {
    return array[Math.floor(Math.random() * array.length)];
}

function generateRandomName() {
    return `User${Math.floor(Math.random() * 1000)}`;
}

export function assignNickAndColor({ socketID, clientID, ip, cachedRoom }) {
    // reconnect case
    const existingUser = Object.values(cachedRoom.userData).find(
        (u) => u.clientID === clientID
    );
    if (existingUser) {
        cachedRoom.userData[socketID] = { ...existingUser, socketID, ip };
        return cachedRoom.userData[socketID];
    }

    // new conn case
    const usedNicks = Object.values(cachedRoom.userData).map((u) => u.nickname);
    const availableNicks = nicknames.filter((n) => !usedNicks.includes(n));
    const nick = availableNicks.length
        ? pickRandom(availableNicks)
        : generateRandomName();

    const usedColors = Object.values(cachedRoom.userData).map((u) => u.color);
    const availableColors = pastelColors.filter((c) => !usedColors.includes(c));
    const color = availableColors.length ? pickRandom(availableColors) : "#DDD";

    // new record
    const newUser = {
        socketID,
        clientID,
        ip,
        nickname: nick,
        color,
        joinedAt: Date.now(),
    };

    cachedRoom.userData[socketID] = newUser;
    return newUser;
}

export function getHistoricalUsers(userIPs) {
    const userData = {};

    userIPs.forEach((ip, index) => {
        userData[`historical-${index}`] = {
            socketID: `historical-${index}`,
            clientID: `historical-${index}`,
            // ip,
            nickname: `User${index + 1}`,
            color: "#DDD",
            joinedAt: 0,
        };
    });

    return userData;
}

export function safeUserData(cachedRoom) {
    const userData = { ...cachedRoom.userData };
    Object.values(userData).forEach((u) => delete u.ip);
    return userData;
}

export function updateOnlineUsers(io, roomID, cachedRoom) {
    io.to(roomID).emit("updateUsers", safeUserData(cachedRoom));
}

export function removeUser(socketID, cachedRoom) {
    if (cachedRoom.users.has(socketID)) {
        cachedRoom.users.delete(socketID);
        delete cachedRoom.userData[socketID];
        touchRoom(cachedRoom.roomID);
        return true;
    }
    return false;
}
