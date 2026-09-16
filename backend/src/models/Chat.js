import mongoose from 'mongoose';

const chatSchema = new mongoose.Schema({
  question: { type: String, required: true },
  collectionName: { type: String, required: true },
  answer: { type: String, required: true },
  retrievedChunks: [{
    page: Number,
    preview: String
  }],
  timestamp: { type: Date, default: Date.now }
});

export default mongoose.model('Chat', chatSchema);