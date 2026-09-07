import { parsePdf } from '../services/pdfService.js';

export async function handlePdfUpload(req, res) {
  try {
    if (!req.file) return res.status(400).json({ error: 'No PDF provided.' });

    const filePath = req.file.path;
    const docs = await parsePdf(filePath);

    res.status(200).json({
      message: 'PDF successfully parsed',
      totalPages: docs.length,
      totalCharacters: docs.reduce((acc, doc) => acc + doc.pageContent.length, 0),
      preview: docs[0]?.pageContent.slice(0, 200) + '...'
    });
  } catch (error) {
    console.error('Parsing failed:', error);
    res.status(500).json({ error: 'Failed to parse PDF.' });
  }
}