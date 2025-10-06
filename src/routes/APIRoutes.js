import express from "express";
import { createRoom } from "../controllers/roomController.js";

const router = express.Router();
// POST /api/room
router.post("/room", createRoom);

export default router;
