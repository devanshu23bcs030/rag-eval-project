import { useState } from 'react';

export default function ChatScreen({ collectionData }) {
  const [question, setQuestion] = useState('');
  const [chatHistory, setChatHistory] = useState([]);
  const [loading, setLoading] = useState(false);

  const handleAsk = async (e) => {
    e.preventDefault();
    if (!question.trim()) return;

    const userQ = question;
    setQuestion('');
    setChatHistory(prev => [...prev, { type: 'user', text: userQ }]);
    setLoading(true);

    try {
      const response = await fetch('http://localhost:5000/api/documents/ask', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ 
          question: userQ, 
          collectionName: collectionData.collectionName 
        }),
      });
      const data = await response.json();

      if (!response.ok) throw new Error(data.error);

      setChatHistory(prev => [...prev, { 
        type: 'ai', 
        text: data.answer, 
        sources: data.sources 
      }]);
    } catch (err) {
      setChatHistory(prev => [...prev, { type: 'error', text: err.message }]);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="max-w-4xl mx-auto mt-10 p-4">
      <div className="bg-blue-50 p-4 rounded-lg border border-blue-100 mb-6 flex justify-between items-center">
        <div>
          <h3 className="font-semibold text-blue-900">Active Collection: {collectionData.collectionName}</h3>
          <p className="text-sm text-blue-700">Indexed {collectionData.stats.totalChunksGenerated} chunks using {collectionData.stats.strategyUsed} strategy.</p>
        </div>
        <button onClick={() => window.location.reload()} className="text-sm bg-white text-blue-600 px-3 py-1 rounded border border-blue-200 hover:bg-blue-50 cursor-pointer">Upload New</button>
      </div>

      <div className="bg-white rounded-xl shadow-sm border border-gray-200 min-h-[500px] flex flex-col">
        <div className="flex-1 p-6 overflow-y-auto space-y-6">
          {chatHistory.length === 0 && <p className="text-gray-400 text-center mt-10">Ask a question about your document to get started.</p>}
          
          {chatHistory.map((msg, i) => (
            <div key={i} className={`flex flex-col ${msg.type === 'user' ? 'items-end' : 'items-start'}`}>
              <div className={`max-w-[80%] p-4 rounded-2xl ${msg.type === 'user' ? 'bg-blue-600 text-white' : msg.type === 'error' ? 'bg-red-100 text-red-700' : 'bg-gray-100 text-gray-800'}`}>
                {msg.text}
              </div>
              
              {msg.sources && (
                <div className="mt-2 flex flex-wrap gap-2 max-w-[80%]">
                  {msg.sources.map((src, idx) => (
                    <div key={idx} className="bg-white border border-gray-200 rounded-md p-2 text-xs text-gray-500 w-full sm:w-[calc(50%-0.5rem)] shadow-sm">
                      <span className="font-bold text-gray-700 mb-1 block">Page {src.page}</span>
                      <p className="line-clamp-3 italic">"{src.preview}"</p>
                    </div>
                  ))}
                </div>
              )}
            </div>
          ))}
          {loading && <div className="text-gray-500 text-sm animate-pulse">AI is thinking and searching database...</div>}
        </div>

        <form onSubmit={handleAsk} className="p-4 border-t border-gray-100 flex gap-2">
          <input
            type="text"
            value={question}
            onChange={(e) => setQuestion(e.target.value)}
            placeholder="Ask your document a question..."
            className="flex-1 border border-gray-300 p-3 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
          />
          <button 
            type="submit" 
            disabled={loading}
            className="bg-blue-600 hover:bg-blue-700 text-white font-semibold px-6 py-3 rounded-lg transition-colors cursor-pointer"
          >
            Ask
          </button>
        </form>
      </div>
    </div>
  );
}