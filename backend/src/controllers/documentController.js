import { logInteraction } from '../services/dbService.js';
import Document from '../models/Document.js';
import Chat from '../models/Chat.js';
import { parsePdf } from '../services/pdfService.js';
import { chunkFixedSize } from '../services/chunkingService.js';
import { storeChunksInChroma } from '../services/vectorStore.js';
import { retrieveRelevantChunks } from '../services/vectorStore.js';
import { generateAnswer } from '../services/llmService.js';
import { chunkSemantic } from '../services/chunkingService.js';

export async function handlePdfUpload(req, res) {
  try {
    if (!req.file) return res.status(400).json({ error: 'No PDF provided.' });

    const strategy = req.body.strategy === 'semantic' ? 'semantic' : 'fixed';

    console.log(`1. Parsing PDF: ${req.file.originalname}`);
    const docs = await parsePdf(req.file.path);
    console.log(`2. Chunking Document (Strategy: ${strategy})`);
    let chunks;
    if (strategy === 'semantic') {
      chunks = await chunkSemantic(docs);
    } else {
      chunks = await chunkFixedSize(docs);
    }

    const validChunks = chunks
      .filter(chunk => chunk.pageContent.trim().length > 0)
      .map(chunk => {
        chunk.metadata = { ...chunk.metadata, strategy: strategy };
        return chunk;
      });

    console.log(`-> Kept ${validChunks.length} valid chunks.`);

    if (validChunks.length === 0) {
      return res.status(422).json({ error: 'Could not extract any readable text.' });
    }

    console.log(`3. Generating Embeddings and Storing in Chroma...`);

   const baseCollectionName = req.file.originalname.replace(/[^a-zA-Z0-9]/g, '_').toLowerCase();
    const collectionName = `${baseCollectionName}_${strategy}`;
    
    await storeChunksInChroma(validChunks, collectionName);
    const newDoc = new Document({
      filename: req.file.originalname,
      collectionName: collectionName,
      pageCount: docs.length,
      chunkCount: validChunks.length,
      chunkingStrategy: strategy
    });
    await newDoc.save();
    console.log('-> Document metadata saved to MongoDB.');

    res.status(200).json({
      message: 'PDF successfully parsed, chunked, and stored in vector database.',
      collectionName,
      stats: {
        totalPages: docs.length,
        totalChunksGenerated: validChunks.length,
        strategyUsed: strategy
      }
    });
  } catch (error) {
    console.error('Pipeline failed:', error);
    res.status(500).json({ error: 'Failed to process document pipeline.' });
  }
}

export async function askQuestion(req, res) {
  try {
    const { question, collectionName } = req.body;

    if (!question || !collectionName) {
      return res.status(400).json({ error: "Please provide both 'question' and 'collectionName'." });
    }

    console.log(`-> Question asked: "${question}"`);
    console.log(`-> Searching collection: ${collectionName}`);
    
    const chunks = await retrieveRelevantChunks(question, collectionName, 4);
    
    if (chunks.length === 0) {
      return res.status(404).json({ error: "No relevant information found in the document." });
    }

    console.log(`-> Found ${chunks.length} relevant chunks. Generating answer...`);
    const answer = await generateAnswer(question, chunks);
    
    // SQLite Evaluation Logging
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

    // MongoDB Application Metadata Logging
    try {
      const newChat = new Chat({
        question: question,
        collectionName: collectionName,
        answer: answer,
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