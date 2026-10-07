import { ChromaClient } from "chromadb";

async function peekInsideChroma() {
  const client = new ChromaClient({ path: "http://localhost:8000" });

  try {
    const collectionName = "gfgdbms_pdf"; 
    const collection = await client.getCollection({ name: collectionName });

    const data = await collection.get({
        limit: 1,
        include: ["embeddings", "documents", "metadatas"]
    });

    console.log(`\n--- DOCUMENT TEXT ---`);
    console.log(data.documents[0]);

    console.log(`\n--- METADATA ---`);
    console.log(data.metadatas[0]);

    console.log(`\n--- VECTOR EMBEDDING (First 15 numbers out of 768) ---`);
    console.log(data.embeddings[0].slice(0, 150), "...\n[truncated]");
    
    console.log(`\n-> Total dimensions (length) of this single vector: ${data.embeddings[0].length}`);

  } catch (error) {
    console.error("Error:", error.message);
  }
}

peekInsideChroma();