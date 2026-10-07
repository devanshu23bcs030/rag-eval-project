# PDF Chat & RAG Retrieval Benchmarking Engine

A full-stack RAG (Retrieval-Augmented Generation) platform that lets you chat with PDFs, with a built-in evaluation harness comparing three retrieval strategies: fixed-size chunking, semantic chunking, and hybrid search (BM25 + vector search merged with Reciprocal Rank Fusion). Retrieval quality is measured with Hit Rate and Mean Reciprocal Rank (MRR), not just eyeballed.

## What it does

- Upload a PDF and pick a chunking/retrieval strategy, or let the app default to one.
- Ask questions about the document and get answers generated from the retrieved context, with source chunks cited.
- Processing (parsing, chunking, embedding, indexing) runs asynchronously via a BullMQ/Redis job queue, so large PDFs don't block the server.
- Every retrieval run can be logged and benchmarked against a ground-truth question set to compare strategies objectively.

## Benchmark results

A dedicated evaluation script (`backend/benchmarks/runEvals.js`) tests each retrieval strategy against a hand-curated set of 15 technical questions (`groundTruth.json`) over a database-systems PDF. Each strategy's effectiveness is measured by Hit Rate (did the correct chunk appear in the top 4 results) and MRR (how high it ranked when it did).

| Strategy | Chunking | Search | Questions | Hit Rate | MRR |
|---|---|---|---|---|---|
| Fixed-size (baseline) | Recursive character split, 1000 chars / 200 overlap | Dense vector cosine similarity | 15 | 73.33% | 0.5556 |
| Semantic | Paragraph/sentence-boundary split | Dense vector cosine similarity | 15 | 80.00% | 0.7000 |
| Hybrid | Semantic boundary split | BM25 + vector search, merged via RRF | 15 | 80.00% | 0.6889 |

Takeaways:
- Fixed-size chunking frequently splits a sentence or idea across an arbitrary 1000-character boundary, which hurts both hit rate and rank. Semantic chunking keeps complete ideas together, which is the main driver of the MRR improvement.
- Hybrid search's BM25 component helps catch exact technical terms and acronyms (e.g. "DCL", "BCNF") that pure vector search can sometimes miss, even though in this run its MRR came in slightly below pure semantic chunking — worth digging into further rather than assuming hybrid always wins.


```

## Retrieval strategies

**Fixed-size chunking** — splits text every 1000 characters with a 200-character overlap, using LangChain's `RecursiveCharacterTextSplitter`. Fast and simple, but can cut a sentence or idea in half purely by coincidence of character count.

**Semantic chunking** — splits along paragraph and sentence boundaries instead, grouping sentences into topically coherent windows (roughly 800-1200 characters). Keeps related ideas in the same chunk.

**Hybrid search** — runs a dense vector search (ChromaDB, cosine similarity over embeddings) and a sparse keyword search (custom BM25 implementation, k1=1.5, b=0.75) in parallel, then merges the two ranked lists with Reciprocal Rank Fusion (k=60) so a chunk doesn't need to be the top hit in either individual method to be ranked highly overall.

## Architecture

PDF upload goes to the Express API, which stores the file in Cloudinary and enqueues a background job. A BullMQ worker (backed by Redis) picks up the job, parses and chunks the PDF, generates embeddings locally using a Hugging Face ONNX model (`all-MiniLM-L6-v2`), and indexes the vectors in ChromaDB. Document status is tracked in MongoDB throughout.

When a question is asked, the API retrieves relevant chunks from ChromaDB (and BM25, for hybrid mode), sends them to Gemini for answer generation, and logs the interaction to both MongoDB (for chat history) and SQLite (for evaluation telemetry).

## Tech stack

**Frontend:** React 19, Vite, Tailwind CSS, Clerk (auth), React Markdown

**Backend:** Node.js, Express 5, Multer, BullMQ, IORedis

**AI / retrieval:** LangChain, ChromaDB, Hugging Face Transformers (`all-MiniLM-L6-v2`, local ONNX), Google Gemini (answer generation), custom BM25 + Reciprocal Rank Fusion

**Data:** MongoDB (documents, chat history, users) via Mongoose; SQLite (evaluation telemetry)

**Storage:** Cloudinary


## Setup

**Prerequisites:** Node.js 18+, Redis, ChromaDB, MongoDB (local or Atlas).

Run Redis and ChromaDB locally with Docker:
```bash
docker run -d --name redis-server -p 6379:6379 redis:alpine
docker run -d --name chromadb -p 8000:8000 chromadb/chroma
```

**Backend:**
```bash
cd backend
npm install
```
Create a `.env` with `PORT`, `MONGO_URI`, `JWT_SECRET`, `GEMINI_API_KEY`, `REDIS_HOST`, `REDIS_PORT`, `CHROMA_URL`, and Cloudinary credentials, then:
```bash
npm run dev
```

**Frontend:**
```bash
cd frontend
npm install
```
Create a `.env` with `VITE_CLERK_PUBLISHABLE_KEY`, then:
```bash
npm run dev
```

**Running the benchmark:**
```bash
cd backend
node benchmarks/runEvals.js
```
This loads the ground-truth questions, queries each retrieval strategy, scores hit rate and rank, writes the results to SQLite, and prints a comparison table.
