import { useState } from 'react';

export default function UploadScreen({ onUploadSuccess }) {
  const [file, setFile] = useState(null);
  const [strategy, setStrategy] = useState('semantic');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const handleUpload = async (e) => {
    e.preventDefault();
    if (!file) return setError('Please select a PDF file.');
    
    setLoading(true);
    setError('');

    const formData = new FormData();
    formData.append('pdf', file);
    formData.append('strategy', strategy);

    try {
      const response = await fetch('http://localhost:5000/api/documents/upload', {
        method: 'POST',
        body: formData,
      });
      const data = await response.json();

      if (!response.ok) throw new Error(data.error || 'Upload failed');
      
      onUploadSuccess(data); 
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="max-w-md mx-auto mt-20 p-6 bg-white rounded-xl shadow-md border border-gray-100">
      <h2 className="text-2xl font-bold mb-6 text-center text-gray-800">Knowledge Base Setup</h2>
      
      <form onSubmit={handleUpload} className="space-y-4">
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">Upload PDF Document</label>
          <input 
            type="file" 
            accept="application/pdf"
            onChange={(e) => setFile(e.target.files[0])}
            className="w-full border border-gray-300 p-2 rounded-lg"
          />
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">Chunking Strategy</label>
          <select 
            value={strategy}
            onChange={(e) => setStrategy(e.target.value)}
            className="w-full border border-gray-300 p-2 rounded-lg bg-white"
          >
            <option value="semantic">Semantic (Smart breaks) - Recommended</option>
            <option value="fixed">Fixed-Size (1000 chars)</option>
          </select>
        </div>

        {error && <p className="text-red-500 text-sm">{error}</p>}

        <button 
          type="submit" 
          disabled={loading}
          className="w-full bg-blue-600 hover:bg-blue-700 text-white font-semibold py-2 rounded-lg transition-colors disabled:bg-blue-300 cursor-pointer"
        >
          {loading ? 'Processing Document (This may take a minute)...' : 'Process & Vectorize'}
        </button>
      </form>
    </div>
  );
}