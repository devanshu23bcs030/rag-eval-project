import bcrypt from 'bcrypt';
import jwt from 'jsonwebtoken';
import { OAuth2Client } from 'google-auth-library';
import User from '../models/User.js';

const googleClient = new OAuth2Client(process.env.GOOGLE_CLIENT_ID);

const generateToken = (user) => {
  return jwt.sign({ userId: user._id, email: user.email }, process.env.JWT_SECRET, { expiresIn: '7d' });
};

const formatUserResponse = (user) => ({
  id: user._id,
  email: user.email,
  username: user.username || user.email.split('@')[0],
  authType: 'Google Gmail',
  credits: typeof user.credits === 'number' ? user.credits : 5
});

export async function gmailAuth(req, res) {
  try {
    let { email, name, googleId, token } = req.body;

    if (token && process.env.GOOGLE_CLIENT_ID) {
      try {
        const ticket = await googleClient.verifyIdToken({
          idToken: token,
          audience: process.env.GOOGLE_CLIENT_ID,
        });
        const payload = ticket.getPayload();
        email = payload.email;
        name = payload.name;
        googleId = payload.sub;
      } catch (err) {
        return res.status(401).json({ error: 'Google verification failed.' });
      }
    }

    const cleanEmail = (email || '').trim().toLowerCase();
    if (!cleanEmail || !cleanEmail.endsWith('@gmail.com')) {
      return res.status(400).json({ error: 'Authorization restricted to @gmail.com accounts only.' });
    }

    let user = await User.findOne({ email: cleanEmail });
    if (!user) {
      user = new User({
        email: cleanEmail,
        username: name?.trim() || cleanEmail.split('@')[0],
        googleId: googleId || undefined,
        credits: 5
      });
      await user.save();
    } else {
      if (googleId && !user.googleId) user.googleId = googleId;
      if (typeof user.credits !== 'number') user.credits = 5;
      await user.save();
    }

    res.status(200).json({ token: generateToken(user), user: formatUserResponse(user) });
  } catch (err) {
    res.status(500).json({ error: 'Gmail authentication failed.' });
  }
}

export async function getMe(req, res) {
  try {
    const user = await User.findById(req.user.userId);
    if (!user) return res.status(404).json({ error: 'User not found.' });
    if (typeof user.credits !== 'number') {
      user.credits = 5;
      await user.save();
    }
    res.status(200).json({ user: formatUserResponse(user) });
  } catch (err) {
    res.status(500).json({ error: 'Failed to fetch user data.' });
  }
}

export async function addDummyCredits(req, res) {
  try {
    const user = await User.findById(req.user.userId);
    if (!user) return res.status(404).json({ error: 'User not found.' });

    const amount = Number(req.body.amount) || 5;
    user.credits = (typeof user.credits === 'number' ? user.credits : 0) + amount;
    await user.save();

    res.status(200).json({
      message: `${amount} credits added successfully.`,
      user: formatUserResponse(user)
    });
  } catch (err) {
    res.status(500).json({ error: 'Failed to add credits.' });
  }
}

export async function register(req, res) {
  return gmailAuth(req, res);
}

export async function login(req, res) {
  return gmailAuth(req, res);
}

export async function googleAuth(req, res) {
  return gmailAuth(req, res);
}