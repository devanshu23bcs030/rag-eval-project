import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { insertEvalRun, getStrategyComparison, getDb, insertEvalStrategy } from '../src/services/dbService.js';
import { retrieveRelevantChunks, retrieveHybridChunks } from '../src/services/vectorStore.js';
import { ChromaClient } from 'chromadb';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

function normalizeText(text) {
  return (text || '').toLowerCase().replace(/\s+/g, ' ').trim();
}

async function runBenchmark() {
  console.log('====================================================');
  console.log('   STARTING STANDALONE RAG BENCHMARK EVALUATION     ');
  console.log('====================================================\n');

  const db = await getDb();
  const groundTruthPath = path.join(__dirname, 'groundTruth.json');
  const groundTruth = JSON.parse(fs.readFileSync(groundTruthPath, 'utf8'));
  console.log(`-> Loaded ${groundTruth.length} ground truth questions from groundTruth.json.`);

  for (const item of groundTruth) {
    await db.run(
      `INSERT OR REPLACE INTO eval_questions (id, pdf_name, question_text, expected_answer, expected_chunk_text)
       VALUES (?, ?, ?, ?, ?)`,
      [item.id, 'gfgDBMS.pdf', item.question, item.expected_needle, item.expected_needle]
    );
  }

  await db.run('DELETE FROM eval_runs');

  const collections = {
    fixed: 'gfgdbms_pdf_fixed_6d36bb',
    semantic: 'gfgdbms_pdf_semantic_6d36bb',
    hybrid: 'gfgdbms_pdf_hybrid_6d36bb',
  };

  try {
    const chroma = new ChromaClient({ path: process.env.CHROMA_URL || 'http://localhost:8000' });
    const cols = await chroma.listCollections();
    const colNames = cols.map((c) => (typeof c === 'string' ? c : c.name));
    for (const strat of ['fixed', 'semantic', 'hybrid']) {
      const match = colNames.find((c) => c.includes('gfgdbms_pdf') && c.includes(strat));
      if (match) collections[strat] = match;
    }
  } catch (err) {
    console.warn('-> Chroma listCollections fallback to defaults:', err.message);
  }

  console.log('-> Target Collections:', collections);

  const strategies = ['fixed', 'semantic', 'hybrid'];
  const strategyIds = {};
  for (const strat of strategies) {
    strategyIds[strat] = await insertEvalStrategy(strat);
    console.log(`-> Strategy '${strat}' registered with ID: ${strategyIds[strat]}`);
  }

  console.log('\n--- EXECUTING LIVE RETRIEVAL BENCHMARKS ---');

  for (const item of groundTruth) {
    console.log(`\nEvaluating Question ${item.id}: "${item.question}"`);
    const expectedNeedle = item.expected_needle || '';
    const normNeedle = normalizeText(expectedNeedle);

    for (const strat of strategies) {
      const collectionName = collections[strat];
      const strategyId = strategyIds[strat];

      const chunks = strat === 'hybrid'
        ? await retrieveHybridChunks(item.question, collectionName, 4)
        : await retrieveRelevantChunks(item.question, collectionName, 4);

      let rank = 0;
      for (let i = 0; i < chunks.length && i < 4; i++) {
        const rawContent = (chunks[i].pageContent || '').toLowerCase();
        const normContent = normalizeText(chunks[i].pageContent);

        if (rawContent.includes(expectedNeedle.toLowerCase()) || normContent.includes(normNeedle)) {
          rank = i + 1;
          break;
        }
      }

      const wasRetrieved = rank > 0;

      await insertEvalRun(item.id, strategyId, wasRetrieved, rank, "Eval Harness Execution");

      const rankBadge = wasRetrieved ? `HIT (Rank ${rank})` : 'MISS (Rank 0)';
      console.log(`  [${strat.toUpperCase().padEnd(8)}] -> ${rankBadge}`);
    }
  }

  console.log('\n====================================================');
  console.log('          FINAL RAG STRATEGY EVALUATION REPORT      ');
  console.log('====================================================');
  const report = await getStrategyComparison();
  console.table(report);
}

runBenchmark().catch((err) => {
  console.error('Benchmark execution error:', err);
  process.exit(1);
});
