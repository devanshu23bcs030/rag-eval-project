import { useState, useEffect, useRef } from "react";

export default function UploadScreen({ token, user, onUploadSuccess, onOutOfCredits, onCreditsUpdated }) {
  const [file, setFile] = useState(null);
  const [strategy, setStrategy] = useState("semantic");
  const [loading, setLoading] = useState(false);
  const [polling, setPolling] = useState(false);
  const [error, setError] = useState("");
  const pollIntervalRef = useRef(null);

  useEffect(() => {
    return () => {
      if (pollIntervalRef.current) {
        clearInterval(pollIntervalRef.current);
      }
    };
  }, []);

  const handleUpload = async (e) => {
    e.preventDefault();

    if (user && typeof user.credits === 'number' && user.credits <= 0) {
      if (onOutOfCredits) onOutOfCredits();
      return;
    }

    if (!file) return setError("Please select a PDF file.");

    setLoading(true);
    setError("");

    if (pollIntervalRef.current) {
      clearInterval(pollIntervalRef.current);
      pollIntervalRef.current = null;
    }

    const formData = new FormData();
    formData.append("pdf", file);
    formData.append("strategy", strategy);

    try {
      const response = await fetch(
        "http://localhost:5000/api/documents/upload",
        {
          method: "POST",
          headers: {
            Authorization: `Bearer ${token}`,
          },
          body: formData,
        },
      );
      const data = await response.json();

      if (!response.ok) {
        if (response.status === 403 && data.outOfCredits) {
          if (onOutOfCredits) {
            onOutOfCredits();
            return;
          }
        }
        throw new Error(data.error || "Upload failed");
      }

      if (typeof data.credits === 'number' && onCreditsUpdated) {
        onCreditsUpdated(data.credits);
      }

      if (response.status === 202) {
        setPolling(true);
        const docId = data.document?._id || data.document?.id || data._id;

        pollIntervalRef.current = setInterval(async () => {
          try {
            const pollRes = await fetch("http://localhost:5000/api/documents", {
              headers: {
                Authorization: `Bearer ${token}`,
              },
            });
            const pollData = await pollRes.json();
            if (!pollRes.ok) throw new Error(pollData.error || "Failed to check document status");

            const foundDoc = (pollData.documents || []).find(
              (d) => String(d._id) === String(docId)
            );

            if (foundDoc) {
              if (foundDoc.status === "ready") {
                clearInterval(pollIntervalRef.current);
                pollIntervalRef.current = null;
                setPolling(false);
                onUploadSuccess({
                  collectionName: foundDoc.collectionName,
                  fileUrl: foundDoc.fileUrl,
                  stats: {
                    totalChunksGenerated: foundDoc.chunkCount,
                    strategyUsed: foundDoc.chunkingStrategy,
                  },
                  ...foundDoc,
                });
              } else if (foundDoc.status === "failed") {
                clearInterval(pollIntervalRef.current);
                pollIntervalRef.current = null;
                setPolling(false);
                setError("Upload failed. Please try again.");
              }
            }
          } catch (pollErr) {
            console.error("Polling error:", pollErr);
          }
        }, 1500);
      } else {
        onUploadSuccess({
          collectionName: data.collectionName,
          fileUrl: data.fileUrl,
          stats: data.stats,
        });
      }
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  const isZeroCredits = user && typeof user.credits === 'number' && user.credits <= 0;

  return (
    <div className="max-w-md mx-auto mt-20 p-8 bg-white rounded-xl shadow-sm border border-gray-200">
      <div className="mb-6 flex items-start justify-between">
        <div>
          <h2 className="text-xl font-semibold text-gray-900">
            Upload PDF
          </h2>
          <p className="text-sm text-gray-500 mt-1">
            Select a PDF document from your computer.
          </p>
        </div>
        <div className="text-xs bg-gray-100 border border-gray-200 px-2.5 py-1 rounded text-gray-700 font-medium">
          {user?.credits ?? 0} Credits
        </div>
      </div>

      {isZeroCredits && (
        <div className="mb-5 p-3.5 bg-gray-50 border border-gray-300 rounded-lg text-xs text-gray-800 flex items-center justify-between">
          <div>
            <span className="font-semibold block">0 credits remaining</span>
            <span className="text-gray-600">Buy credits to continue uploading documents.</span>
          </div>
          <button
            type="button"
            onClick={onOutOfCredits}
            className="ml-3 bg-gray-900 hover:bg-black text-white px-3 py-1.5 rounded font-medium cursor-pointer transition whitespace-nowrap"
          >
            Buy Credits
          </button>
        </div>
      )}

      <form onSubmit={handleUpload} className="space-y-4">
        <div>
          <label className="block text-xs font-medium text-gray-700 mb-1">
            File
          </label>
          <input
            type="file"
            accept="application/pdf"
            disabled={loading || polling || isZeroCredits}
            onChange={(e) => setFile(e.target.files[0])}
            className="w-full border border-gray-300 p-2 rounded-lg text-sm disabled:opacity-50 file:mr-3 file:py-1 file:px-3 file:rounded file:border-0 file:text-xs file:font-medium file:bg-gray-100 file:text-gray-700 hover:file:bg-gray-200 cursor-pointer"
          />
        </div>

        <div>
          <label className="block text-xs font-medium text-gray-700 mb-1">
            Strategy
          </label>
          <select
            value={strategy}
            disabled={loading || polling || isZeroCredits}
            onChange={(e) => setStrategy(e.target.value)}
            className="w-full border border-gray-300 p-2.5 rounded-lg text-sm bg-white disabled:opacity-50 focus:border-gray-900 focus:ring-1 focus:ring-gray-900 outline-none"
          >
            <option value="hybrid">Hybrid (Dense vector + BM25)</option>
            <option value="semantic">Semantic (Paragraph breaks)</option>
            <option value="fixed">Fixed size (1000 characters)</option>
          </select>
        </div>

        {error && <p className="text-red-600 text-xs bg-red-50 p-2.5 rounded border border-red-200">{error}</p>}

        <button
          type="submit"
          disabled={loading || polling}
          className="w-full bg-gray-900 hover:bg-black text-white font-medium py-2.5 rounded-lg transition disabled:bg-gray-400 cursor-pointer text-sm shadow-sm"
        >
          {loading || polling ? "Uploading..." : isZeroCredits ? "Purchase Credits to Upload" : "Upload"}
        </button>
      </form>
    </div>
  );
}
