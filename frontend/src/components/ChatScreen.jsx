import { useState, useRef, useEffect } from 'react';
import ReactMarkdown from 'react-markdown';

export default function ChatScreen({ token, collectionData }) {
  const [messages, setMessages] = useState([]);
  const [isLoadingHistory, setIsLoadingHistory] = useState(true);
  const [activePage, setActivePage] = useState(1);

  useEffect(() => {
    const loadHistory = async () => {
      try {
        const res = await fetch(`http://localhost:5000/api/documents/chat/${collectionData.collectionName}`, {
          headers: { Authorization: `Bearer ${token}` }
        });
        if (!res.ok) {
          throw new Error(`Failed to load history (${res.status})`);
        }
        const data = await res.json();
        
        if (data.history && data.history.length > 0) {
          const pastMessages = [];
          data.history.forEach(chat => {
            pastMessages.push({ role: 'user', content: chat.question });
            pastMessages.push({ 
              role: 'assistant', 
              content: chat.answer,
              sources: chat.retrievedChunks || []
            });
          });
          setMessages(pastMessages);
        } else {
          setMessages([{ role: 'assistant', content: 'Hello, what would you like to know about this document?' }]);
        }
      } catch (error) {
        console.error("Error loading history", error);
        setMessages([{ role: 'assistant', content: 'Hello, what would you like to know about this document?' }]);
      } finally {
        setIsLoadingHistory(false);
      }
    };

    loadHistory();
  }, [collectionData.collectionName, token]);

  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(false);
  const messagesEndRef = useRef(null);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  useEffect(() => scrollToBottom(), [messages]);

  const handleSend = async (e) => {
    e.preventDefault();
    if (!input.trim()) return;

    const userMsg = input.trim();
    setInput('');
    setMessages(prev => [...prev, { role: 'user', content: userMsg }]);
    setLoading(true);

    try {
      const res = await fetch('http://localhost:5000/api/documents/ask', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`
        },
        body: JSON.stringify({
          question: userMsg,
          collectionName: collectionData.collectionName
        })
      });

      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Failed to get answer');

      setMessages(prev => [...prev, { role: 'assistant', content: data.answer, sources: data.sources }]);
    } catch (err) {
      setMessages(prev => [...prev, { role: 'assistant', content: `Error: ${err.message}` }]);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="flex flex-col lg:flex-row h-[calc(100vh-8rem)] gap-4 w-full max-w-full">
      <div className="w-full lg:w-1/2 h-[50vh] lg:h-full bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden flex flex-col">
        <div className="bg-gray-50 border-b border-gray-200 px-4 py-3 flex justify-between items-center">
          <div className="flex items-center gap-2">
            <span className="text-sm font-medium text-gray-800">Document</span>
            {activePage > 1 && (
              <span className="text-xs bg-gray-200 text-gray-700 px-2 py-0.5 rounded font-mono">
                Page {activePage}
              </span>
            )}
          </div>
          {collectionData?.fileUrl && (
            <a 
              href={collectionData.fileUrl} 
              target="_blank" 
              rel="noreferrer" 
              className="text-xs text-gray-600 hover:text-gray-900 underline font-medium"
            >
              Open in new tab
            </a>
          )}
        </div>
        
        {collectionData?.fileUrl ? (
          <iframe 
            key={activePage}
            src={`${collectionData.fileUrl}#page=${activePage}&view=FitH`} 
            className="w-full h-full border-none bg-gray-100"
            title="PDF Viewer"
          />
        ) : (
          <div className="flex-1 flex flex-col items-center justify-center text-sm text-gray-400 bg-gray-50">
            <span className="text-2xl mb-2">📄</span>
            PDF preview not available
          </div>
        )}
      </div>

      <div className="w-full lg:w-1/2 h-[60vh] lg:h-full bg-white rounded-xl shadow-sm border border-gray-200 flex flex-col">
        <div className="bg-gray-50 border-b border-gray-200 px-4 py-3">
          <span className="text-sm font-medium text-gray-800">Chat</span>
        </div>
        
        <div className="flex-1 p-4 overflow-y-auto space-y-4 bg-gray-50/50">
          {isLoadingHistory && (
            <div className="flex justify-center my-4">
              <span className="text-xs text-gray-400">Loading conversation...</span>
            </div>
          )}
          {messages.map((msg, i) => (
            <div key={i} className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}>
              <div 
                className={`max-w-[85%] p-3.5 rounded-lg text-sm leading-relaxed shadow-sm
                  ${msg.role === 'user' 
                    ? 'bg-gray-900 text-white' 
                    : 'bg-white border border-gray-200 text-gray-800'}`}
              >
                {msg.role === 'user' ? (
                  msg.content
                ) : (
                  <div>
                    <div className="text-sm text-gray-800">
                      <ReactMarkdown 
                        components={{
                          p: ({node, ...props}) => <p className="mb-2 last:mb-0 leading-relaxed" {...props} />,
                          ul: ({node, ...props}) => <ul className="list-disc pl-5 mb-2 space-y-1 marker:text-gray-400" {...props} />,
                          ol: ({node, ...props}) => <ol className="list-decimal pl-5 mb-2 space-y-1 marker:text-gray-400" {...props} />,
                          li: ({node, ...props}) => <li className="pl-1" {...props} />,
                          strong: ({node, ...props}) => <strong className="font-semibold text-gray-900" {...props} />,
                          h1: ({node, ...props}) => <h1 className="text-base font-semibold text-gray-900 mb-2 mt-3" {...props} />,
                          h2: ({node, ...props}) => <h2 className="text-sm font-semibold text-gray-900 mb-2 mt-2" {...props} />,
                          h3: ({node, ...props}) => <h3 className="text-xs font-semibold text-gray-900 mb-1 mt-1" {...props} />,
                          code: ({node, inline, ...props}) => 
                            inline 
                              ? <code className="bg-gray-100 text-gray-900 px-1.5 py-0.5 rounded text-xs font-mono" {...props} />
                              : <pre className="bg-gray-800 text-gray-100 p-3 rounded text-xs overflow-x-auto mb-2 font-mono"><code {...props} /></pre>
                        }}
                      >
                        {msg.content}
                      </ReactMarkdown>
                    </div>

                    {msg.sources && msg.sources.length > 0 && (
                      <div className="mt-3 pt-2.5 border-t border-gray-100">
                        <span className="text-[11px] text-gray-400 mb-1.5 block">
                          Referenced pages (click to view):
                        </span>
                        <div className="flex flex-wrap gap-1.5">
                          {msg.sources.map((src, idx) => (
                            <button
                              key={idx} 
                              type="button"
                              onClick={() => {
                                const pageNum = parseInt(src.page, 10) || 1;
                                setActivePage(pageNum);
                              }}
                              className={`border text-xs px-2.5 py-1 rounded transition-colors cursor-pointer inline-flex items-center gap-1 ${
                                activePage === src.page
                                  ? 'bg-gray-900 text-white border-gray-900'
                                  : 'bg-gray-50 border-gray-200 text-gray-700 hover:bg-gray-200 hover:border-gray-400'
                              }`}
                              title={src.preview ? `Page ${src.page}: ${src.preview}` : `Jump to Page ${src.page}`}
                            >
                              <span>Page {src.page}</span>
                              <span className="text-[10px] opacity-70">↗</span>
                            </button>
                          ))}
                        </div>
                      </div>
                    )}
                  </div>
                )}
              </div>
            </div>
          ))}
          
          {loading && (
            <div className="flex justify-start">
              <div className="bg-white border border-gray-200 text-gray-500 px-3.5 py-2 rounded-lg text-sm">
                generating the ans .....
              </div>
            </div>
          )}
          <div ref={messagesEndRef} />
        </div>

        <div className="p-3 border-t border-gray-200 bg-white rounded-b-xl">
          <form onSubmit={handleSend} className="flex gap-2">
            <input 
              type="text" 
              value={input}
              onChange={e => setInput(e.target.value)}
              placeholder="Ask a question about this document..." 
              className="flex-1 border border-gray-300 rounded-lg px-3.5 py-2 text-sm focus:outline-none focus:border-gray-900 focus:ring-1 focus:ring-gray-900"
            />
            <button 
              type="submit" 
              disabled={loading || !input.trim()}
              className="bg-gray-900 hover:bg-black text-white px-4 py-2 rounded-lg text-sm font-medium transition disabled:bg-gray-400 disabled:cursor-not-allowed shadow-sm"
            >
              Send
            </button>
          </form>
        </div>
      </div>
      
    </div>
  );
}