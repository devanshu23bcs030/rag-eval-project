import { Worker } from 'bullmq';
import Document from '../models/Document.js';
import { parsePdf } from '../services/pdfService.js';
import { chunkFixedSize, chunkSemantic } from '../services/chunkingService.js';
import { storeChunksInChroma } from '../services/vectorStore.js';
import dotenv from 'dotenv';

dotenv.config();

const connection = {
  host: process.env.REDIS_HOST || '127.0.0.1',
  port: parseInt(process.env.REDIS_PORT || '6379', 10),
  maxRetriesPerRequest: null,
};

export const pdfWorker = new Worker(
  'pdf-processing-queue',
  async (job) => {
    const { documentId, fileUrl, collectionName, strategy: jobStrategy } = job.data;
    console.log(`\n[Worker] Picked up job ${job.id} for document: ${documentId}`);

    try {
      const document = await Document.findById(documentId);
      if (!document) {
        throw new Error(`Document ${documentId} not found in database.`);
      }

      const strategy = jobStrategy || document.chunkingStrategy || 'fixed';

      console.log(`[Worker] 1. Parsing PDF from ${fileUrl}...`);
      const docs = await parsePdf(fileUrl);

      console.log(`[Worker] 2. Chunking Document (Strategy: ${strategy})...`);
      let chunks;
      if (strategy === 'semantic' || strategy === 'hybrid') {
        chunks = await chunkSemantic(docs);
      } else {
        chunks = await chunkFixedSize(docs);
      }

      const validChunks = chunks
        .filter(chunk => chunk.pageContent && chunk.pageContent.trim().length > 0)
        .map(chunk => {
          chunk.metadata = { ...chunk.metadata, strategy };
          return chunk;
        });

      if (validChunks.length === 0) {
        throw new Error('Could not extract any readable text from PDF.');
      }

      console.log(`[Worker] 3. Storing ${validChunks.length} chunks in Chroma (${collectionName})...`);
      await storeChunksInChroma(validChunks, collectionName);

      await Document.findByIdAndUpdate(documentId, {
        status: 'ready',
        pageCount: docs.length,
        chunkCount: validChunks.length,
      });

      console.log(`[Worker] -> Document ${documentId} successfully processed and marked ready.\n`);
      return { success: true, documentId, chunksCount: validChunks.length };
    } catch (err) {
      console.error(`[Worker] [!] Error processing job ${job.id} for document ${documentId}:`, err);
      try {
        await Document.findByIdAndUpdate(documentId, { status: 'failed' });
      } catch (updateErr) {
        console.error(`[Worker] Could not mark document ${documentId} as failed:`, updateErr);
      }
      throw err;
    }
  },
  { connection }
);

pdfWorker.on('completed', (job) => {
  console.log(`[Worker] Job ${job.id} completed successfully.`);
});

pdfWorker.on('failed', (job, err) => {
  console.error(`[Worker] Job ${job?.id} failed:`, err?.message);
});

pdfWorker.on('error', (err) => {
  console.error('[Worker] Redis worker error:', err.message);
});

console.log('-> PDF Processing BullMQ Worker initialized and listening on queue "pdf-processing-queue".');
