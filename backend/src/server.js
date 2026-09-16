import express from 'express';
import cors from 'cors';
import dotenv from 'dotenv';

import { upload } from './middleware/upload.js';
import { handlePdfUpload , askQuestion } from './controllers/documentController.js';
import { connectMongo } from './services/mongoService.js';

dotenv.config();

const app = express();
app.use(cors())
const PORT = process.env.PORT || 5000;

app.use(cors());
app.use(express.json());

app.post('/api/documents/upload', upload.single('pdf'), handlePdfUpload);
app.post('/api/documents/ask', askQuestion);
await connectMongo() ;
app.listen(PORT, () => {
  console.log(`Backend running on http://localhost:${PORT}`);
});