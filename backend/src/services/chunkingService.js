import { RecursiveCharacterTextSplitter } from '@langchain/textsplitters';
import { Document } from '@langchain/core/documents';

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

export async function chunkSemantic(docs, targetChunkSize = 1000) {
  if (!docs) return [];
  const docList = Array.isArray(docs) ? docs : [docs];
  if (docList.length === 0) return [];

  const paragraphs = [];

  for (const doc of docList) {
    const content = typeof doc === 'string' ? doc : (doc.pageContent || '');
    const meta = typeof doc === 'object' && doc.metadata ? { ...doc.metadata } : {};
    const pageNumber = meta.loc?.pageNumber ?? meta.pageNumber ?? meta.page ?? 1;

    const rawParagraphs = content.split(/\r?\n\s*\r?\n/);
    for (const raw of rawParagraphs) {
      const trimmed = raw.trim();
      if (trimmed.length > 0) {
        paragraphs.push({
          text: trimmed,
          pageNumber,
          metadata: meta,
        });
      }
    }
  }

  const chunks = [];
  let currentGroup = [];
  let currentLength = 0;

  const flushGroup = () => {
    if (currentGroup.length === 0) return;
    const combinedText = currentGroup.map((p) => p.text).join('\n\n');
    const primary = currentGroup[0];

    const chunkDoc = new Document({
      pageContent: combinedText,
      metadata: {
        ...(primary.metadata || {}),
        pageNumber: primary.pageNumber,
        loc: {
          ...((primary.metadata && primary.metadata.loc) || {}),
          pageNumber: primary.pageNumber,
        },
        strategy: 'semantic',
      },
    });

    chunks.push(chunkDoc);
    currentGroup = [];
    currentLength = 0;
  };

  for (const paragraph of paragraphs) {
    const pLength = paragraph.text.length;
    const separatorLength = currentGroup.length > 0 ? 2 : 0;

    if (currentGroup.length > 0 && currentLength + separatorLength + pLength > targetChunkSize) {
      flushGroup();
    }

    currentGroup.push(paragraph);
    currentLength += (currentGroup.length > 1 ? 2 : 0) + pLength;

    if (currentLength >= targetChunkSize) {
      flushGroup();
    }
  }

  flushGroup();
  return chunks;
}