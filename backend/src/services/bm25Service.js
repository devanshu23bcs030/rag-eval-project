export function tokenize(text) {
  if (!text) return [];
  return text
    .toLowerCase()
    .replace(/[^\w\s]/g, ' ')
    .split(/\s+/)
    .filter(token => token.length > 2);
}

export class BM25 {
  constructor(corpus, k1 = 1.5, b = 0.75) {
    this.k1 = k1;
    this.b = b;
    this.corpus = corpus;
    this.corpusSize = corpus.length;
    
    this.docTokens = corpus.map(doc => {
      const text = typeof doc === 'string' ? doc : (doc.pageContent || doc.text || '');
      return tokenize(text);
    });
    
    this.docLengths = this.docTokens.map(tokens => tokens.length);
    const totalLength = this.docLengths.reduce((sum, len) => sum + len, 0);
    this.avgDocLength = this.corpusSize > 0 ? (totalLength / this.corpusSize) : 1;

    this.docFreqs = {};
    this.termFreqs = this.docTokens.map(tokens => {
      const tf = {};
      const uniqueTerms = new Set();
      for (const t of tokens) {
        tf[t] = (tf[t] || 0) + 1;
        uniqueTerms.add(t);
      }
      for (const t of uniqueTerms) {
        this.docFreqs[t] = (this.docFreqs[t] || 0) + 1;
      }
      return tf;
    });

    this.idf = {};
    for (const term in this.docFreqs) {
      const df = this.docFreqs[term];
      this.idf[term] = Math.log(1 + (this.corpusSize - df + 0.5) / (df + 0.5));
    }
  }

  search(query, topK = 10) {
    const queryTokens = tokenize(query);
    if (queryTokens.length === 0 || this.corpusSize === 0) return [];

    const scores = [];
    for (let i = 0; i < this.corpusSize; i++) {
      let score = 0;
      const tfMap = this.termFreqs[i];
      const docLen = this.docLengths[i];
      const norm = 1 - this.b + this.b * (docLen / this.avgDocLength);

      for (const token of queryTokens) {
        const idfVal = this.idf[token] || 0;
        const tf = tfMap[token] || 0;
        if (tf > 0) {
          score += idfVal * ((tf * (this.k1 + 1)) / (tf + this.k1 * norm));
        }
      }
      if (score > 0) {
        scores.push({ index: i, score, chunk: this.corpus[i] });
      }
    }

    scores.sort((a, b) => b.score - a.score);
    return scores.slice(0, topK);
  }
}

export function reciprocalRankFusion(denseList, bm25List, topK = 4, rrfK = 60) {
  const rrfScores = new Map();

  const getKey = (chunk) => {
    if (chunk.id) return chunk.id;
    const preview = (chunk.pageContent || '').slice(0, 60).trim();
    const page = chunk.metadata?.pageNumber || 'p1';
    return `${page}_${preview}`;
  };

  denseList.forEach((chunk, idx) => {
    const rank = idx + 1;
    const key = getKey(chunk);
    const existing = rrfScores.get(key) || { score: 0, chunk };
    existing.score += 1 / (rrfK + rank);
    rrfScores.set(key, existing);
  });

  bm25List.forEach((chunk, idx) => {
    const rank = idx + 1;
    const key = getKey(chunk);
    const existing = rrfScores.get(key) || { score: 0, chunk };
    existing.score += 1 / (rrfK + rank);
    rrfScores.set(key, existing);
  });

  const fused = Array.from(rrfScores.values())
    .sort((a, b) => b.score - a.score)
    .slice(0, topK)
    .map(item => item.chunk);

  return fused;
}
