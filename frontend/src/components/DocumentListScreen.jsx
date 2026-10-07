import { useEffect, useState } from 'react';

export default function DocumentListScreen({ token, user, onSelectDocument, onNewUpload, onGoToPayment }) {
  const [documents, setDocuments] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  const fetchDocuments = async () => {
    try {
      setLoading(true);
      const res = await fetch('http://localhost:5000/api/documents', {
        headers: { Authorization: `Bearer ${token}` },
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Failed to load documents');
      setDocuments(data.documents);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchDocuments();
  }, []);

  const handleDownload = async (e, docId) => {
    e.stopPropagation();
    try {
      const res = await fetch(`http://localhost:5000/api/documents/${docId}/download`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      const data = await res.json();
      if (data.downloadUrl) {
        window.open(data.downloadUrl, '_blank');
      }
    } catch (err) {
      alert('Could not download document.');
    }
  };

  const handleDelete = async (id, e) => {
    e.stopPropagation();
    if (!window.confirm('Are you sure you want to delete this document?')) {
      return;
    }
    try {
      const res = await fetch(`http://localhost:5000/api/documents/${id}`, {
        method: 'DELETE',
        headers: { Authorization: `Bearer ${token}` },
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Failed to delete document');
      setDocuments(prev => prev.filter(doc => doc._id !== id));
    } catch (err) {
      alert(err.message || 'Could not delete document.');
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h2 className="text-xl font-semibold text-gray-900">Documents</h2>
          <p className="text-xs text-gray-500 mt-0.5">
            Select an uploaded document to chat, or add a new PDF.
          </p>
        </div>
        <button
          onClick={onNewUpload}
          className="bg-gray-900 hover:bg-black text-white text-xs font-medium px-4 py-2 rounded-lg transition cursor-pointer inline-flex items-center gap-2 self-start"
        >
          <span>+</span> Upload PDF
        </button>
      </div>

      {error && (
        <div className="bg-red-50 border border-red-200 text-red-700 p-3 rounded-lg text-xs">
          {error}
        </div>
      )}

      {loading ? (
        <div className="text-center py-16 text-gray-400 text-sm">
          Loading documents...
        </div>
      ) : documents.length === 0 ? (
        <div className="bg-white border border-dashed border-gray-300 rounded-xl p-12 text-center">
          <div className="w-12 h-12 bg-gray-100 rounded-lg flex items-center justify-center mx-auto mb-3 text-xl">
            📄
          </div>
          <h3 className="font-semibold text-gray-800 text-sm">No documents found</h3>
          <p className="text-xs text-gray-500 mt-1 max-w-sm mx-auto">
            You haven't uploaded any documents yet. Upload a PDF to start searching and reasoning.
          </p>
          <button
            onClick={onNewUpload}
            className="mt-4 bg-gray-900 text-white text-xs font-medium px-4 py-2 rounded-lg hover:bg-black cursor-pointer"
          >
            Upload First PDF
          </button>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {documents.map((doc) => {
            const isProcessing = doc.status === 'processing';
            return (
              <div
                key={doc._id}
                onClick={() => {
                  if (isProcessing) return;
                  onSelectDocument({
                    fileUrl: doc.fileUrl,
                    collectionName: doc.collectionName,
                    stats: {
                      totalChunksGenerated: doc.chunkCount,
                      strategyUsed: doc.chunkingStrategy,
                    },
                  });
                }}
                className={`bg-white border border-gray-200 transition rounded-xl p-5 flex flex-col justify-between group ${
                  isProcessing
                    ? 'opacity-60 cursor-not-allowed'
                    : 'hover:border-gray-400 hover:shadow-sm cursor-pointer'
                }`}
              >
                <div>
                  <div className="flex items-start justify-between gap-2 mb-2">
                    {isProcessing ? (
                      <span className="text-xs font-medium px-2 py-0.5 rounded bg-gray-200 text-gray-800 border border-gray-300 uppercase tracking-wide">
                        Uploading...
                      </span>
                    ) : (
                      <span className="text-xs font-medium px-2 py-0.5 rounded bg-gray-100 text-gray-700 border border-gray-200 uppercase tracking-wide">
                        {doc.chunkingStrategy}
                      </span>
                    )}
                    <div className="flex items-center gap-1">
                      <button
                        onClick={(e) => handleDownload(e, doc._id)}
                        title="Download Original PDF"
                        className="text-gray-500 hover:text-gray-900 text-xs p-1 rounded hover:bg-gray-100 transition"
                      >
                        ⬇ Download
                      </button>
                      <button
                        onClick={(e) => handleDelete(doc._id, e)}
                        title="Delete Document"
                        className="text-gray-500 hover:text-red-700 hover:bg-red-50 text-xs p-1 rounded transition"
                      >
                        🗑️ Delete
                      </button>
                    </div>
                  </div>
                  <h4 className="font-medium text-sm text-gray-900 line-clamp-1 group-hover:text-black">
                    {doc.filename}
                  </h4>
                  <p className="text-[11px] text-gray-400 mt-1">
                    Uploaded on {new Date(doc.createdAt).toLocaleDateString()}
                  </p>
                </div>

                <div className="mt-4 pt-3 border-t border-gray-100 flex items-center justify-between text-xs text-gray-500">
                  <span>{doc.pageCount} Pages</span>
                  <span>{doc.chunkCount} Chunks</span>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}