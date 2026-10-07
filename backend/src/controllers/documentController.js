import fs from 'fs';
import { Queue } from 'bullmq';
import IORedis from 'ioredis';
import Document from '../models/Document.js';
import Chat from '../models/Chat.js';
import User from '../models/User.js';
import { logInteraction } from '../services/dbService.js';
import { parsePdf } from '../services/pdfService.js';
import { chunkFixedSize, chunkSemantic } from '../services/chunkingService.js';
import { storeChunksInChroma, retrieveRelevantChunks, retrieveHybridChunks, deleteCollectionFromChroma } from '../services/vectorStore.js';
import { generateAnswer } from '../services/llmService.js';
import { uploadToCloudinary } from '../services/cloudinaryService.js';

const redisConnection = new IORedis({
  host: process.env.REDIS_HOST || '127.0.0.1',
  port: parseInt(process.env.REDIS_PORT || '6379', 10),
  maxRetriesPerRequest: null,
});

export const pdfQueue = new Queue('pdf-processing-queue', { connection: redisConnection });

export async function handlePdfUpload(req, res) {
  try {
    if (!req.file) return res.status(400).json({ error: 'No PDF provided.' });

    const user = await User.findById(req.user.userId);
    if (!user) {
      if (req.file && fs.existsSync(req.file.path)) fs.unlinkSync(req.file.path);
      return res.status(401).json({ error: 'User not found.' });
    }

    if (typeof user.credits !== 'number') {
      user.credits = 5;
      await user.save();
    }

    if (user.credits <= 0) {
      if (req.file && fs.existsSync(req.file.path)) fs.unlinkSync(req.file.path);
      return res.status(403).json({
        error: 'You have 0 credits remaining. Please buy more credits to upload.',
        outOfCredits: true
      });
    }

    user.credits = Math.max(0, user.credits - 1);
    await user.save();

    const strategy = ['semantic', 'hybrid'].includes(req.body.strategy) ? req.body.strategy : 'fixed';

    console.log(`1. Uploading PDF to Cloudinary: ${req.file.originalname}`);
    const fileUrl = await uploadToCloudinary(req.file.path);

    if (fs.existsSync(req.file.path)) fs.unlinkSync(req.file.path);

    const baseCollectionName = req.file.originalname.replace(/[^a-zA-Z0-9]/g, '_').toLowerCase();
    const collectionName = `${baseCollectionName}_${strategy}_${req.user.userId.slice(-6)}`;

    const newDoc = new Document({
      filename: req.file.originalname,
      collectionName: collectionName,
      chunkingStrategy: strategy,
      fileUrl: fileUrl,
      userId: req.user.userId,
      status: 'processing',
    });

    await newDoc.save();
    console.log(`-> Document metadata saved to MongoDB with status 'processing' (ID: ${newDoc._id})`);

    await pdfQueue.add('process-pdf', {
      documentId: newDoc._id.toString(),
      fileUrl: newDoc.fileUrl,
      collectionName: newDoc.collectionName,
      strategy: strategy,
    });
    console.log(`-> Enqueued PDF processing job for document: ${newDoc._id}`);

    res.status(202).json({
      message: 'PDF successfully uploaded. Processing queued in background.',
      document: newDoc,
      collectionName: newDoc.collectionName,
      fileUrl: newDoc.fileUrl,
      status: 'processing',
      credits: user.credits,
    });
  } catch (error) {
    if (req.file && fs.existsSync(req.file.path)) fs.unlinkSync(req.file.path);
    console.error('Upload pipeline failed:', error);
    res.status(500).json({ error: 'Failed to process document pipeline.' });
  }
}

export async function getUserDocuments(req, res) {
  try {
    const docs = await Document.find({ userId: req.user.userId })
      .sort({ createdAt: -1 })
      .lean();
    res.status(200).json({ documents: docs });
  } catch (error) {
    res.status(500).json({ error: 'Failed to retrieve documents.' });
  }
}

export async function downloadDocument(req, res) {
  try {
    const doc = await Document.findOne({ _id: req.params.id, userId: req.user.userId });
    if (!doc) return res.status(404).json({ error: 'Document not found.' });

    res.status(200).json({ downloadUrl: doc.fileUrl });
  } catch (error) {
    res.status(500).json({ error: 'Failed to retrieve download URL.' });
  }
}

export async function askQuestion(req, res) {
  try {
    const { question, collectionName } = req.body;
    
    const docOwner = await Document.findOne({ collectionName, userId: req.user.userId });
    if (!docOwner) {
      return res.status(403).json({ error: "Unauthorized access to this document." });
    }
    
    if (!question || !collectionName) {
      return res.status(400).json({ error: "Please provide both 'question' and 'collectionName'." });
    }

    const strategy = req.body.strategy || docOwner.chunkingStrategy || 'fixed';
    console.log(`-> Question asked: "${question}" (Strategy: ${strategy})`);
    console.log(`-> Searching collection: ${collectionName}`);

    const chunks = strategy === 'hybrid'
      ? await retrieveHybridChunks(question, collectionName, 4)
      : await retrieveRelevantChunks(question, collectionName, 4);

    if (chunks.length === 0) {
      return res.status(404).json({ error: "No relevant information found in the document." });
    }

    console.log(`-> Found ${chunks.length} relevant chunks. Generating answer...`);
    const answer = await generateAnswer(question, chunks);

    try {
      const sourcesForLog = chunks.map(c => ({
        page: c.metadata.pageNumber,
        text: c.pageContent
      }));
      await logInteraction(collectionName, question, answer, sourcesForLog);
      console.log('-> Interaction saved to SQLite evaluation database.');
    } catch (dbError) {
      console.error('-> [!] Failed to log to SQLite:', dbError);
    }

    try {
      const newChat = new Chat({
        question: question,
        collectionName: collectionName,
        answer: answer,
        userId: req.user.userId,
        retrievedChunks: chunks.map(c => ({
          page: c.metadata.pageNumber,
          preview: c.pageContent.substring(0, 150)
        }))
      });
      await newChat.save();
      console.log('-> Chat metadata saved to MongoDB.');
    } catch (mongoErr) {
      console.error('-> [!] Failed to log chat to MongoDB:', mongoErr);
    }

    res.status(200).json({
      answer: answer,
      sources: chunks.map(c => ({
        page: c.metadata.pageNumber,
        preview: c.pageContent.substring(0, 150) + "..."
      }))
    });

  } catch (error) {
    console.error("Q&A failed:", error);
    res.status(500).json({ error: "Failed to generate answer." });
  }
}
export async function getChatHistory(req, res) {
  try {
    const { collectionName } = req.params;
    
    const docOwner = await Document.findOne({ collectionName, userId: req.user.userId });
    if (!docOwner) {
      return res.status(403).json({ error: "Unauthorized access." });
    }

    const history = await Chat.find({ collectionName, userId: req.user.userId })
      .sort({ timestamp: 1 })
      .lean();

    res.status(200).json({ history });
  } catch (error) {
    console.error("Failed to fetch history:", error);
    res.status(500).json({ error: "Failed to retrieve chat history." });
  }
}

export async function deleteDocument(req, res) {
  try {
    const { id } = req.params;
    const userId = req.user.userId;

    const document = await Document.findOne({ _id: id, userId });
    if (!document) {
      return res.status(404).json({ error: "Document not found." });
    }

    const { collectionName } = document;

    await Document.deleteOne({ _id: id, userId });
    await Chat.deleteMany({ collectionName, userId });
    await deleteCollectionFromChroma(collectionName);

    res.status(200).json({ message: "Document and associated chat history successfully deleted." });
  } catch (error) {
    console.error("Failed to delete document:", error);
    res.status(500).json({ error: "Failed to delete document." });
  }
}