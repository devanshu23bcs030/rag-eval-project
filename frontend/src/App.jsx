import { useState } from 'react';
import UploadScreen from './components/UploadScreen';
import ChatScreen from './components/ChatScreen';

function App() {
  const [collectionData, setCollectionData] = useState(null);

  return (
    <div className="min-h-screen bg-gray-50">
      <header className="bg-white shadow-sm py-4">
        <div className="max-w-4xl mx-auto px-4 flex items-center justify-between">
          <h1 className="text-xl font-bold text-gray-800">RAG Document Intelligence</h1>
        </div>
      </header>

      <main className="px-4">
        {!collectionData ? (
          <UploadScreen onUploadSuccess={(data) => setCollectionData(data)} />
        ) : (
          <ChatScreen collectionData={collectionData} />
        )}
      </main>
    </div>
  );
}

export default App;