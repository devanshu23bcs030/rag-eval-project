import './workers/pdfWorker.js';
import { authenticate } from './middleware/authMiddleware.js';
import { register, login, googleAuth, gmailAuth, getMe, addDummyCredits } from './controllers/authController.js';
import express from 'express';
import cors from 'cors';
import dotenv from 'dotenv';

import { upload } from './middleware/upload.js';
import { 
  handlePdfUpload, 
  askQuestion, 
  getUserDocuments, 
  downloadDocument ,
  getChatHistory
} from './controllers/documentController.js';
import documentRoutes from './routes/documentRoutes.js';
import { connectMongo } from './services/mongoService.js';

dotenv.config();

const app = express();
const PORT = process.env.PORT || 5000;

app.use(cors());
app.use(express.json());

app.post('/api/auth/register', register);
app.post('/api/auth/login', login);
app.post('/api/auth/google', googleAuth);
app.post('/api/auth/google-gmail', gmailAuth);
app.get('/api/auth/me', authenticate, getMe);
app.post('/api/auth/add-dummy-credits', authenticate, addDummyCredits);

app.use('/api/documents', documentRoutes);
app.get('/api/documents', authenticate, getUserDocuments);
app.get('/api/documents/:id/download', authenticate, downloadDocument);
app.post('/api/documents/upload', authenticate, upload.single('pdf'), handlePdfUpload);
app.post('/api/documents/ask', authenticate, askQuestion);
app.get('/api/documents/chat/:collectionName', authenticate, getChatHistory);

await connectMongo() ;

app.listen(PORT, () => {
  console.log(`Backend running on http://localhost:${PORT}`);
});