import mongoose from 'mongoose';

const userSchema = new mongoose.Schema({
  username: { type: String },
  email: { type: String, required: true, unique: true },
  passwordHash: { type: String },
  googleId: { type: String, sparse: true, unique: true },
  credits: { type: Number, default: 5 },
  createdAt: { type: Date, default: Date.now }
});

export default mongoose.model('User', userSchema);