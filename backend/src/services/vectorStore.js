import { Chroma } from '@langchain/community/vectorstores/chroma';
import { GoogleGenerativeAIEmbeddings } from '@langchain/google-genai';
import dotenv from 'dotenv';

dotenv.config();

const embeddings = new GoogleGenerativeAIEmbeddings({
  apiKey: process.env.GEMINI_API_KEY,
  modelName: 'gemini-embedding-2', 
});

export async function storeChunksInChroma(chunks, collectionName = 'pdf_eval_collection') {
  try {
    console.log("-> Sanitizing chunks and metadata for Chroma...");
    
    let cleanChunks = chunks.map(chunk => {
      chunk.pageContent = chunk.pageContent.replace(/\0/g, '').trim(); 
      chunk.metadata = {
        strategy: chunk.metadata.strategy || 'fixed-size',
        source: typeof chunk.metadata.source === 'string' ? chunk.metadata.source : 'unknown',
        pageNumber: chunk.metadata.loc?.pageNumber || 1,
      };
      return chunk;
    }).filter(chunk => {
      // STRICT FILTER: The chunk must contain at least 15 alphanumeric characters.
      // This prevents formatting blocks or empty spaces from crashing the API.
      const alphanumericCount = (chunk.pageContent.match(/[a-zA-Z0-9]/g) || []).length;
      return alphanumericCount > 15;
    }); 

    console.log(`-> Prepared ${cleanChunks.length} strictly cleaned chunks. Sending in batches...`);

    const vectorStore = new Chroma(embeddings, {
      collectionName: collectionName,
      url: process.env.CHROMA_URL || 'http://localhost:8000',
    });

    // We are lowering the batch size to 10 chunks at a time
    const BATCH_SIZE = 10; 
    let successfulBatches = 0;

    for (let i = 0; i < cleanChunks.length; i += BATCH_SIZE) {
      const batch = cleanChunks.slice(i, i + BATCH_SIZE);
      const batchNum = Math.floor(i / BATCH_SIZE) + 1;
      const totalBatches = Math.ceil(cleanChunks.length / BATCH_SIZE);
      
      console.log(`   -> Uploading batch ${batchNum} / ${totalBatches}...`);
      
      try {
        await vectorStore.addDocuments(batch);
        successfulBatches++;
      } catch (batchError) {
        console.warn(`   [!] Batch ${batchNum} failed. Rate limit likely hit.`);
      }
      
      // THE FIX: Wait a massive 12 seconds between batches.
      // 10 chunks * 12 seconds = slow, but guaranteed to stay under 15 Requests Per Minute.
      console.log(`      Waiting 12 seconds for API cooldown...`);
      await new Promise(resolve => setTimeout(resolve, 12000));
    }
    
    console.log(`-> Finished! Successfully stored ${successfulBatches} out of ${Math.ceil(cleanChunks.length / BATCH_SIZE)} batches in Chroma.`);
    return vectorStore;
  } catch (error) {
    console.error('Error in vector store pipeline:', error);
    throw error;
  }
}
// Add this to the bottom of vectorStore.js
export async function retrieveRelevantChunks(query, collectionName, topK = 4) {
  try {
    const vectorStore = new Chroma(embeddings, {
      collectionName: collectionName,
      url: process.env.CHROMA_URL || 'http://localhost:8000',
    });
    
    // Chroma handles the vector math and ranking automatically in milliseconds!
    const results = await vectorStore.similaritySearch(query, topK);
    return results;
  } catch (error) {
    console.error("Error retrieving chunks:", error);
    throw error;
  }
}