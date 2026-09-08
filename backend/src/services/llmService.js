import { ChatGoogleGenerativeAI } from "@langchain/google-genai";
import dotenv from 'dotenv';

dotenv.config();

// We use gemini-1.5-flash because it is lightning fast for RAG tasks
const llm = new ChatGoogleGenerativeAI({
  apiKey: process.env.GEMINI_API_KEY,
  model : "gemini-2.5-flash",
  temperature: 0.2,
});

export async function generateAnswer(query, retrievedChunks) {
  // 1. Combine the retrieved chunks into a single text block
  const contextText = retrievedChunks.map(chunk => chunk.pageContent).join("\n\n---\n\n");

  // 2. Construct the strict RAG prompt
  const prompt = `You are an intelligent assistant helping a user extract information from a document.
  Use the following retrieved context to answer the user's question.
  If you cannot find the answer in the context, strictly reply with "I cannot answer this based on the provided document." Do not guess.

  Context:
  ${contextText}

  User Question: ${query}

  Answer:`;

  // 3. Generate the response
  const response = await llm.invoke(prompt);
  return response.content;
}