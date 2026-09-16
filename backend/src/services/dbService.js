import sqlite3 from 'sqlite3';
import { open } from 'sqlite';
import path from 'path';

const dbPath = path.resolve(process.cwd(), 'rag_evaluation.db');
let dbInstance = null;

export async function getDb() {
  if (dbInstance) return dbInstance;

  dbInstance = await open({
    filename: dbPath,
    driver: sqlite3.Database
  });

  // 1. Existing qa_logs table (Application Chat Logs)
  await dbInstance.exec(`
    CREATE TABLE IF NOT EXISTS qa_logs (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      collection_name TEXT,
      user_question TEXT,
      ai_answer TEXT,
      retrieved_context TEXT,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    )
  `);

  // 2. NEW: Evaluation Ground Truth Questions
  await dbInstance.exec(`
    CREATE TABLE IF NOT EXISTS eval_questions (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      pdf_name TEXT,
      question_text TEXT,
      expected_answer TEXT,
      expected_chunk_text TEXT
    )
  `);

  // 3. NEW: Evaluation Strategies (e.g., 'fixed', 'semantic')
  await dbInstance.exec(`
    CREATE TABLE IF NOT EXISTS eval_strategies (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      strategy_name TEXT UNIQUE
    )
  `);

  // 4. NEW: Evaluation Runs (The actual test results)
  await dbInstance.exec(`
    CREATE TABLE IF NOT EXISTS eval_runs (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      question_id INTEGER,
      strategy_id INTEGER,
      was_chunk_retrieved BOOLEAN,
      retrieval_rank INTEGER,
      generated_answer TEXT,
      timestamp DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY(question_id) REFERENCES eval_questions(id),
      FOREIGN KEY(strategy_id) REFERENCES eval_strategies(id)
    )
  `);

  console.log('-> SQLite Database initialized with Evaluation schemas.');
  return dbInstance;
}

// --- EXISTING LOGGING FUNCTION ---
export async function logInteraction(collectionName, question, answer, sources) {
  const db = await getDb();
  const contextString = JSON.stringify(sources);
  await db.run(
    `INSERT INTO qa_logs (collection_name, user_question, ai_answer, retrieved_context) 
     VALUES (?, ?, ?, ?)`,
    [collectionName, question, answer, contextString]
  );
}

// --- NEW EVALUATION FUNCTIONS ---

export async function insertEvalStrategy(strategyName) {
  const db = await getDb();
  // Insert the strategy if it doesn't exist yet
  await db.run(`INSERT OR IGNORE INTO eval_strategies (strategy_name) VALUES (?)`, [strategyName]);
  // Return the ID of the strategy
  const row = await db.get(`SELECT id FROM eval_strategies WHERE strategy_name = ?`, [strategyName]);
  return row.id;
}

export async function insertEvalQuestion(pdfName, questionText, expectedAnswer, expectedChunkText) {
  const db = await getDb();
  const result = await db.run(
    `INSERT INTO eval_questions (pdf_name, question_text, expected_answer, expected_chunk_text) 
     VALUES (?, ?, ?, ?)`,
    [pdfName, questionText, expectedAnswer, expectedChunkText]
  );
  return result.lastID;
}

export async function insertEvalRun(questionId, strategyId, wasChunkRetrieved, retrievalRank, generatedAnswer) {
  const db = await getDb();
  // SQLite doesn't have a native BOOLEAN, so we convert true/false to 1/0
  const retrievedBool = wasChunkRetrieved ? 1 : 0;
  
  await db.run(
    `INSERT INTO eval_runs (question_id, strategy_id, was_chunk_retrieved, retrieval_rank, generated_answer) 
     VALUES (?, ?, ?, ?, ?)`,
    [questionId, strategyId, retrievedBool, retrievalRank, generatedAnswer]
  );
}

export async function getStrategyComparison() {
  const db = await getDb();
  
  // This aggregation query calculates Hit Rate % and Mean Reciprocal Rank (MRR)
  const rows = await db.all(`
    SELECT 
      s.strategy_name,
      COUNT(r.id) as total_runs,
      ROUND(SUM(CASE WHEN r.was_chunk_retrieved = 1 THEN 1 ELSE 0 END) * 100.0 / COUNT(r.id), 2) as hit_rate_percentage,
      ROUND(AVG(CASE WHEN r.retrieval_rank > 0 THEN 1.0 / r.retrieval_rank ELSE 0.0 END), 4) as mean_reciprocal_rank
    FROM eval_runs r
    JOIN eval_strategies s ON r.strategy_id = s.id
    GROUP BY s.strategy_name
  `);
  
  return rows;
}