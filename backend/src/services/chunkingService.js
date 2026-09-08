import { RecursiveCharacterTextSplitter } from '@langchain/textsplitters';

export async function chunkFixedSize(docs, chunkSize = 1000, chunkOverlap = 200) {
  const splitter = new RecursiveCharacterTextSplitter({
    chunkSize,
    chunkOverlap,
  });

  const chunks = await splitter.splitDocuments(docs);
  
  return chunks.map(chunk => {
    chunk.metadata = {
      ...chunk.metadata,
      strategy: 'fixed-size',
    };
    return chunk;
  });
}