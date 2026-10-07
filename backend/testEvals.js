import { insertEvalStrategy, insertEvalQuestion, insertEvalRun, getStrategyComparison, getDb } from './src/services/dbService.js';

async function runTest() {
  await getDb();

  const fixedId = await insertEvalStrategy('fixed');
  const semanticId = await insertEvalStrategy('semantic');
  const hybridId = await insertEvalStrategy('hybrid');

  const questionId = await insertEvalQuestion(
    'gfgDBMS.pdf', 
    'What is DML?', 
    'Data Manipulation Language...', 
    'DML deals with data manipulation...'
  );

  await insertEvalRun(questionId, fixedId, true, 3, "AI Answer (Fixed)");
  await insertEvalRun(questionId, semanticId, true, 2, "AI Answer (Semantic)");
  await insertEvalRun(questionId, hybridId, true, 1, "AI Answer (Hybrid BM25+Vector)");
  
  await insertEvalRun(questionId, fixedId, false, 0, "I don't know");
  await insertEvalRun(questionId, semanticId, true, 2, "AI Answer 4");
  await insertEvalRun(questionId, hybridId, true, 1, "AI Answer (Hybrid BM25+Vector)");

  const report = await getStrategyComparison();
  console.log('\n--- RAG STRATEGY EVALUATION REPORT ---');
  console.table(report);
}

runTest();