import { PDFLoader } from '@langchain/community/document_loaders/fs/pdf';

export async function parsePdf(filePath) {
  // splitPages: true creates one Document object per PDF page
  const loader = new PDFLoader(filePath, { splitPages: true });
  const docs = await loader.load();
  return docs;
}