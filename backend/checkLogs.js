import sqlite3 from 'sqlite3';
import { open } from 'sqlite';
import path from 'path';

async function viewLogs() {
  const dbPath = path.resolve(process.cwd(), 'rag_evaluation.db');
  const db = await open({ filename: dbPath, driver: sqlite3.Database });
  
  // Fetch all logs, but only select the columns we want to read right now
  const logs = await db.all("SELECT id, user_question, ai_answer, created_at FROM qa_logs");
  
  console.log(`\n--- FOUND ${logs.length} INTERACTION LOGS ---`);
  console.log(logs);
}

viewLogs();