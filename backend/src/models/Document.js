import mongoose from 'mongoose';

const documentSchema = new mongoose.Schema({
  filename: { type: String, required: true },
  collectionName: { type: String, required: true },
  pageCount: { type: Number, default: 0 },
  chunkCount: { type: Number, default: 0 },
  chunkingStrategy: { type: String, default: 'fixed' },
  fileUrl: { type: String, required: true },
  userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  status: { type: String, enum: ['processing', 'ready', 'failed'], default: 'processing' },
  createdAt: { type: Date, default: Date.now },
});

export default mongoose.model('Document', documentSchema);