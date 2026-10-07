import express from 'express';
import { authenticate } from '../middleware/authMiddleware.js';
import { deleteDocument } from '../controllers/documentController.js';

const router = express.Router();

router.delete('/:id', authenticate, deleteDocument);

export default router;
