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

export function getHistoricalUsers(users) {
    const userData = {};

    // deduplicate by clientID (fallback to ip if not available)
    const uniqueUsers = [];
    const seenClientIDs = new Set();
    const seenIPs = new Set();

    users.forEach((user) => {
        const id = user.clientID || user.ip;
        if (user.clientID && !seenClientIDs.has(user.clientID)) {
            seenClientIDs.add(user.clientID);
            uniqueUsers.push(user);
        } else if (!user.clientID && !seenIPs.has(user.ip)) {
            seenIPs.add(user.ip);
            uniqueUsers.push(user);
        }
    });

    const usedNicks = [];
    const usedColors = [];

    uniqueUsers.forEach((user, index) => {
        // pick unique nickname
        const availableNicks = nicknames.filter((n) => !usedNicks.includes(n));
        const nick = availableNicks.length
            ? pickRandom(availableNicks)
            : generateRandomName();
        usedNicks.push(nick);

        // pick unique color
        const availableColors = pastelColors.filter(
            (c) => !usedColors.includes(c)
        );
        const color = availableColors.length
            ? pickRandom(availableColors)
            : "#DDD";
        usedColors.push(color);

        userData[`historical-${index}`] = {
            socketID: `historical-${index}`,
            clientID: user.clientID || `historical-${index}`,
            nickname: nick,
            color: color,
            joinedAt: user.joinedAt || 0,
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
