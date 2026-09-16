import mongoose from 'mongoose';
import dotenv from 'dotenv';

dotenv.config();

export async function connectMongo() {
  try {
    const uri = process.env.MONGO_URI || 'mongodb://127.0.0.1:27017/pdf_rag_app';
    await mongoose.connect(uri);
    console.log('-> MongoDB Database initialized.');
  } catch (error) {
    console.error('-> [!] MongoDB connection error:', error);
  }
}