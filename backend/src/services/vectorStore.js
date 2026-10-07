import { Chroma } from '@langchain/community/vectorstores/chroma';
import { ChromaClient } from 'chromadb';
import { HuggingFaceTransformersEmbeddings } from '@langchain/community/embeddings/hf_transformers';
import { BM25, reciprocalRankFusion } from './bm25Service.js';
import dotenv from 'dotenv';

dotenv.config();

const embeddings = new HuggingFaceTransformersEmbeddings({
  modelName: 'Xenova/all-MiniLM-L6-v2',
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
      const alphanumericCount = (chunk.pageContent.match(/[a-zA-Z0-9]/g) || []).length;
      return alphanumericCount > 15;
    }); 

    console.log(`-> Prepared ${cleanChunks.length} strictly cleaned chunks.`);

    const client = new ChromaClient({ path: process.env.CHROMA_URL || 'http://localhost:8000' });
    try {
      await client.getCollection({ name: collectionName });
      console.log(`-> Resetting existing Chroma collection '${collectionName}'...`);
      await client.deleteCollection({ name: collectionName });
    } catch {
    }

    const vectorStore = new Chroma(embeddings, {
      collectionName: collectionName,
      url: process.env.CHROMA_URL || 'http://localhost:8000',
    });

    const BATCH_SIZE = 50; 
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
        console.error(`   [!] Batch ${batchNum} failed:`, batchError);
      }
    }
    
    console.log(`-> Finished! Successfully stored ${successfulBatches} out of ${Math.ceil(cleanChunks.length / BATCH_SIZE)} batches in Chroma.`);
    return vectorStore;
  } catch (error) {
    console.error('Error in vector store pipeline:', error);
    throw error;
  }
}

export async function retrieveRelevantChunks(query, collectionName, topK = 4) {
  try {
    const vectorStore = new Chroma(embeddings, {
      collectionName: collectionName,
      url: process.env.CHROMA_URL || 'http://localhost:8000',
    });
    
    const results = await vectorStore.similaritySearch(query, topK);
    return results;
  } catch (error) {
    console.error("Error retrieving chunks:", error);
    throw error;
  }
}

export async function getAllChunksFromChroma(collectionName) {
  const client = new ChromaClient({ path: process.env.CHROMA_URL || 'http://localhost:8000' });
  const collection = await client.getCollection({ name: collectionName });
  const data = await collection.get({
    include: ['documents', 'metadatas']
  });

  const chunks = [];
  if (data && data.documents) {
    for (let i = 0; i < data.documents.length; i++) {
      chunks.push({
        id: data.ids[i],
        pageContent: data.documents[i],
        metadata: data.metadatas[i] || {}
      });
    }
  }
  return chunks;
}

export async function retrieveHybridChunks(query, collectionName, topK = 4) {
  try {
    console.log(`-> Running Hybrid Search (Dense Chroma + Sparse BM25 + RRF) on ${collectionName}`);
    const candidateLimit = Math.max(topK * 2, 8);

    const vectorStore = new Chroma(embeddings, {
      collectionName: collectionName,
      url: process.env.CHROMA_URL || 'http://localhost:8000',
    });
    const denseResults = await vectorStore.similaritySearch(query, candidateLimit);

    let bm25Results = [];
    try {
      const allChunks = await getAllChunksFromChroma(collectionName);
      if (allChunks.length > 0) {
        const bm25 = new BM25(allChunks);
        const ranked = bm25.search(query, candidateLimit);
        bm25Results = ranked.map(r => r.chunk);
      }
    } catch (lexicalErr) {
      console.warn('   [!] Lexical search fallback (proceeding with dense):', lexicalErr.message);
    }

    const fusedResults = reciprocalRankFusion(denseResults, bm25Results, topK);
    console.log(`-> Hybrid RRF fused ${denseResults.length} dense and ${bm25Results.length} sparse chunks into top ${fusedResults.length} results.`);
    return fusedResults.length > 0 ? fusedResults : denseResults.slice(0, topK);
  } catch (error) {
    console.error("Error retrieving hybrid chunks:", error);
    return retrieveRelevantChunks(query, collectionName, topK);
  }
}

export async function deleteCollectionFromChroma(collectionName) {
  try {
    const client = new ChromaClient({ path: process.env.CHROMA_URL || 'http://localhost:8000' });
    await client.deleteCollection({ name: collectionName });
    console.log(`-> Deleted Chroma collection: ${collectionName}`);
  } catch (err) {
    console.warn(`-> Could not delete Chroma collection ${collectionName}:`, err.message);
  }
}