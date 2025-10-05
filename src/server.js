import { Server } from "socket.io";
import express from "express";
import {createServer} from "http";
import { palette } from "../const/palette.js";
import { connectDB } from "./db/connect.js";
import roomRoutes from "./routes/roomRoutes.js";
import dotenv from "dotenv";

dotenv.config();

const app = express();
const httpServer = createServer(app);
const io = new Server(httpServer);

// serve client
app.use(express.json())
app.use(express.static("public"));
app.use("/const", express.static("const"));
app.use("/api", roomRoutes);

connectDB();

//socket set up
io.on('connection', (socket) => {
    console.log('a user connected', socket.id);
    socket.on("disconnect", () => {
        console.log("user disconnected:", socket.id);
  });
});


// start server
const PORT = process.env.PORT || 3000;
httpServer.listen(PORT, () => console.log(`listening on port ${PORT}`));