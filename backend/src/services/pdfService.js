import { PDFLoader } from '@langchain/community/document_loaders/fs/pdf';

export async function parsePdf(filePathOrUrl) {
  if (typeof filePathOrUrl === 'string' && (filePathOrUrl.startsWith('http://') || filePathOrUrl.startsWith('https://'))) {
    const res = await fetch(filePathOrUrl);
    const blob = await res.blob();
    const loader = new PDFLoader(blob, { splitPages: true });
    return await loader.load();
  }

  const loader = new PDFLoader(filePathOrUrl, { splitPages: true });
  const docs = await loader.load();
  return docs;
}