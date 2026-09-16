import mongoose from 'mongoose';

const documentSchema = new mongoose.Schema({
  filename: { type: String, required: true },
  collectionName: { type: String, required: true },
  pageCount: { type: Number, required: true },
  chunkCount: { type: Number, required: true },
  chunkingStrategy: { type: String, default: 'fixed' },
  uploadedAt: { type: Date, default: Date.now }
});

export default mongoose.model('Document', documentSchema);