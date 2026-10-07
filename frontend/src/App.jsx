import { useState, useEffect } from 'react';
import { useUser, useClerk } from '@clerk/react';
import AuthScreen from './components/AuthScreen';
import UploadScreen from './components/UploadScreen';
import ChatScreen from './components/ChatScreen';
import DocumentListScreen from './components/DocumentListScreen';
import PaymentScreen from './components/PaymentScreen';

function App() {
  const { user: clerkUser, isLoaded: isClerkLoaded, isSignedIn: isClerkSignedIn } = useUser();
  const { signOut } = useClerk();

  const [token, setToken] = useState(() => localStorage.getItem('token') || null);
  const [user, setUser] = useState(() => {
    try {
      const saved = localStorage.getItem('user');
      return saved ? JSON.parse(saved) : null;
    } catch {
      return null;
    }
  });

  const [currentView, setCurrentView] = useState('list');
  const [collectionData, setCollectionData] = useState(null);

  const updateCredits = (newCredits) => {
    setUser((prev) => {
      if (!prev) return prev;
      const updated = { ...prev, credits: newCredits };
      localStorage.setItem('user', JSON.stringify(updated));
      return updated;
    });
  };

  useEffect(() => {
    if (isClerkLoaded && isClerkSignedIn && clerkUser) {
      const email = clerkUser.primaryEmailAddress?.emailAddress;
      const name = clerkUser.fullName || clerkUser.firstName || email?.split('@')[0];
      const googleId = clerkUser.id;

      if (email && (!user || user.email !== email || !token)) {
        fetch('http://localhost:5000/api/auth/google-gmail', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ email, name, googleId }),
        })
          .then((res) => res.json())
          .then((data) => {
            if (data.token) {
              setToken(data.token);
              setUser(data.user);
              localStorage.setItem('token', data.token);
              localStorage.setItem('user', JSON.stringify(data.user));
            }
          })
          .catch(console.error);
      }
    } else if (isClerkLoaded && !isClerkSignedIn) {
      if (token || user) {
        setToken(null);
        setUser(null);
        localStorage.removeItem('token');
        localStorage.removeItem('user');
      }
    }
  }, [isClerkLoaded, isClerkSignedIn, clerkUser, user, token]);

  useEffect(() => {
    if (token) {
      fetch('http://localhost:5000/api/auth/me', {
        headers: { Authorization: `Bearer ${token}` },
      })
        .then((res) => (res.ok ? res.json() : null))
        .then((data) => {
          if (data && data.user && typeof data.user.credits === 'number') {
            updateCredits(data.user.credits);
          }
        })
        .catch(() => {});
    }
  }, [token]);

  const handleLogout = async () => {
    setToken(null);
    setUser(null);
    setCollectionData(null);
    setCurrentView('list');
    localStorage.removeItem('token');
    localStorage.removeItem('user');
    try {
      await signOut();
    } catch {}
  };

  const isAuthenticated = Boolean(isClerkSignedIn && token && user);

  return (
    <div className="min-h-screen bg-gray-50 flex flex-col">
      <header className="bg-white border-b border-gray-200 sticky top-0 z-50">
        <div className="max-w-6xl mx-auto px-4 sm:px-6 h-16 flex items-center justify-between">
          <div
            onClick={() => isAuthenticated && setCurrentView('list')}
            className="flex items-center cursor-pointer"
          >
            <span className="font-semibold text-gray-900 text-base">
              pdf chat app
            </span>
          </div>

          {isAuthenticated ? (
            <div className="flex items-center gap-3">
              {currentView !== 'list' && (
                <button
                  onClick={() => setCurrentView('list')}
                  className="text-xs font-medium text-gray-700 hover:text-gray-900 hover:bg-gray-100 px-3 py-1.5 rounded border border-gray-300 transition cursor-pointer"
                >
                  ← All Documents
                </button>
              )}

              <button
                onClick={() => setCurrentView('payment')}
                title="Manage credits"
                className={`flex items-center gap-1.5 px-2.5 py-1 rounded text-xs font-medium transition cursor-pointer border ${
                  (user.credits ?? 5) === 0
                    ? 'bg-red-50 text-red-700 border-red-200 hover:bg-red-100'
                    : 'bg-gray-100 text-gray-700 border-gray-200 hover:bg-gray-200'
                }`}
              >
                <span>{user.credits ?? 5} Credits</span>
                {(user.credits ?? 5) === 0 && (
                  <span className="text-[10px] font-semibold underline ml-1">Buy</span>
                )}
              </button>

              <div className="flex items-center gap-2.5 pl-3 border-l border-gray-200">
                <div className="w-8 h-8 rounded-full bg-gray-800 text-white flex items-center justify-center font-medium text-xs uppercase">
                  {(user.username || user.email || 'U')[0]}
                </div>
                <div className="hidden md:flex flex-col text-left">
                  <span className="text-xs font-medium text-gray-800 leading-tight">
                    {user.username || user.email}
                  </span>
                  <span className="text-[10px] text-gray-500">
                    Google Gmail
                  </span>
                </div>
              </div>

              <button
                onClick={handleLogout}
                className="text-xs font-medium text-gray-600 hover:text-gray-900 hover:bg-gray-100 px-2.5 py-1.5 rounded border border-gray-200 transition cursor-pointer"
              >
                Sign out
              </button>
            </div>
          ) : (
            <div className="text-xs text-gray-500 font-normal bg-gray-100 px-2.5 py-1 rounded">
              Sign in to continue
            </div>
          )}
        </div>
      </header>

      <main className="flex-1 max-w-6xl w-full mx-auto px-4 py-8">
        {!isAuthenticated ? (
          <AuthScreen />
        ) : currentView === 'list' ? (
          <DocumentListScreen
            token={token}
            user={user}
            onGoToPayment={() => setCurrentView('payment')}
            onSelectDocument={(docData) => {
              setCollectionData(docData);
              setCurrentView('chat');
            }}
            onNewUpload={() => setCurrentView('upload')}
          />
        ) : currentView === 'upload' ? (
          <UploadScreen
            token={token}
            user={user}
            onOutOfCredits={() => setCurrentView('payment')}
            onCreditsUpdated={updateCredits}
            onUploadSuccess={(data) => {
              setCollectionData(data);
              setCurrentView('chat');
            }}
          />
        ) : currentView === 'payment' ? (
          <PaymentScreen
            token={token}
            user={user}
            onCreditsUpdated={updateCredits}
            onBack={() => setCurrentView('list')}
            onGoToUpload={() => setCurrentView('upload')}
          />
        ) : (
          <ChatScreen token={token} collectionData={collectionData} />
        )}
      </main>
    </div>
  );
}

export default App;