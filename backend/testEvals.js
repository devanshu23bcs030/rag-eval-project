import { insertEvalStrategy, insertEvalQuestion, insertEvalRun, getStrategyComparison, getDb } from './src/services/dbService.js';

async function runTest() {
  await getDb(); // Initialize tables

  // 1. Add strategies
  const fixedId = await insertEvalStrategy('fixed');
  const semanticId = await insertEvalStrategy('semantic');

  // 2. Add a mock ground truth question
  const questionId = await insertEvalQuestion(
    'gfgDBMS.pdf', 
    'What is DML?', 
    'Data Manipulation Language...', 
    'DML deals with data manipulation...'
  );

  // 3. Log some mock test runs 
  // (Pretending 'fixed' found it at rank 3, and 'semantic' found it at rank 1)
  await insertEvalRun(questionId, fixedId, true, 3, "AI Answer 1");
  await insertEvalRun(questionId, semanticId, true, 1, "AI Answer 2");
  
  // Pretending we ran a second question where 'fixed' failed completely
  await insertEvalRun(questionId, fixedId, false, 0, "I don't know");
  await insertEvalRun(questionId, semanticId, true, 2, "AI Answer 4");

  // 4. Run the comparison report!
  const report = await getStrategyComparison();
  console.log('\n--- RAG STRATEGY EVALUATION REPORT ---');
  console.table(report);
}

runTest();