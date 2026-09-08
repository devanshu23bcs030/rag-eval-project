import { parsePdf } from '../services/pdfService.js';
import { chunkFixedSize } from '../services/chunkingService.js';
import { storeChunksInChroma } from '../services/vectorStore.js';
import { retrieveRelevantChunks } from '../services/vectorStore.js';
import { generateAnswer } from '../services/llmService.js';

export async function handlePdfUpload(req, res) {
  try {
    if (!req.file) return res.status(400).json({ error: 'No PDF provided.' });

    console.log(`1. Parsing PDF: ${req.file.originalname}`);
    const docs = await parsePdf(req.file.path);

    console.log(`2. Chunking Document (Strategy: Fixed-Size)`);
    const chunks = await chunkFixedSize(docs);

    // FIX: Filter out any chunks that are completely empty or just whitespace
    const validChunks = chunks.filter(chunk => chunk.pageContent.trim().length > 0);

    console.log(`-> Kept ${validChunks.length} valid chunks out of ${chunks.length} total.`);

    // If the PDF was totally unreadable (e.g., a scanned image), stop here.
    if (validChunks.length === 0) {
      return res.status(422).json({ 
        error: 'Could not extract any readable text from this PDF. It might be a scanned image or an incompatible slide deck.' 
      });
    }

    console.log(`3. Generating Embeddings and Storing in Chroma...`);
    // Create a safe, lowercase collection name
    const collectionName = req.file.originalname.replace(/[^a-zA-Z0-9]/g, '_').toLowerCase();
    
    // Pass ONLY the valid chunks to Chroma
    await storeChunksInChroma(validChunks, collectionName);

    res.status(200).json({
      message: 'PDF successfully parsed, chunked, and stored in vector database.',
      collectionName,
      stats: {
        totalPages: docs.length,
        totalChunksGenerated: validChunks.length,
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

    const ans = answer 
    console.log(ans)

    // Return the final answer alongside the exact chunks it used (great for debugging!)
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