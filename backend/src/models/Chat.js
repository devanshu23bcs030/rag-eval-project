import mongoose from 'mongoose';

const chatSchema = new mongoose.Schema({
  question: { type: String, required: true },
  collectionName: { type: String, required: true },
  answer: { type: String, required: true },
  retrievedChunks: [{
    page: Number,
    preview: String
  }],
  userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  timestamp: { type: Date, default: Date.now }
});

export default mongoose.model('Chat', chatSchema);