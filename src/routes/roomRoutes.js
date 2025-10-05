import express from "express";
import { createRoom } from "../controllers/roomController.js";

const router = express.Router();
// POST /api/cretaeRoom
router.post("/createRoom", createRoom);

export default router;