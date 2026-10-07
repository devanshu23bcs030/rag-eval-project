import { useState } from 'react';

export default function PaymentScreen({ token, user, onCreditsUpdated, onBack, onGoToUpload }) {
  const [selectedPlan, setSelectedPlan] = useState('pro');
  const [loading, setLoading] = useState(false);
  const [successMessage, setSuccessMessage] = useState('');

  const plans = [
    {
      id: 'starter',
      name: 'Starter',
      price: '$5',
      credits: 10,
      description: 'Good for quick research and small projects.',
      features: ['10 PDF uploads', 'Semantic & Hybrid search', 'Standard processing queue'],
    },
    {
      id: 'pro',
      name: 'Professional',
      price: '$19',
      credits: 50,
      popular: true,
      description: 'Best for regular students, researchers, and engineers.',
      features: ['50 PDF uploads', 'Priority BullMQ queue', 'Unlimited chat queries', 'Export evaluation logs'],
    },
    {
      id: 'unlimited',
      name: 'Unlimited',
      price: '$49',
      credits: 200,
      description: 'For teams and heavy PDF document workloads.',
      features: ['200 PDF uploads', 'Instant vector storage', 'Priority Gemini Flash API', 'Dedicated support'],
    },
  ];

  const handleSimulatePayment = async () => {
    setLoading(true);
    setSuccessMessage('');

    const plan = plans.find(p => p.id === selectedPlan) || plans[1];

    try {
      const response = await fetch('http://localhost:5000/api/auth/add-dummy-credits', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ amount: plan.credits }),
      });

      const data = await response.json();
      if (!response.ok) throw new Error(data.error || 'Payment simulation failed');

      if (data.user && onCreditsUpdated) {
        onCreditsUpdated(data.user.credits);
      }

      setSuccessMessage(`Payment successful! ${plan.credits} credits added to your account.`);
      setTimeout(() => {
        if (onGoToUpload) onGoToUpload();
        else if (onBack) onBack();
      }, 1500);
    } catch (err) {
      setSuccessMessage('Demo checkout simulated. Returning you to upload...');
      setTimeout(() => {
        if (onCreditsUpdated) onCreditsUpdated(5);
        if (onGoToUpload) onGoToUpload();
        else if (onBack) onBack();
      }, 1500);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="max-w-4xl mx-auto py-6">
      <div className="flex items-center justify-between mb-8 pb-4 border-b border-gray-200">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 tracking-tight">Purchase Upload Credits</h1>
          <p className="text-sm text-gray-600 mt-1">
            You have <span className="font-semibold text-gray-900">{user?.credits ?? 0} credits</span> remaining. Select a package below to continue uploading PDFs.
          </p>
        </div>
        <button
          onClick={onBack}
          className="text-xs font-medium text-gray-700 hover:text-gray-900 hover:bg-gray-100 px-3 py-1.5 rounded border border-gray-300 transition cursor-pointer"
        >
          ← Back to Documents
        </button>
      </div>

      {successMessage && (
        <div className="mb-6 p-4 bg-gray-900 text-white rounded-lg text-sm text-center">
          {successMessage}
        </div>
      )}

      <div className="grid md:grid-cols-3 gap-6 mb-8">
        {plans.map((plan) => {
          const isSelected = selectedPlan === plan.id;
          return (
            <div
              key={plan.id}
              onClick={() => setSelectedPlan(plan.id)}
              className={`p-6 rounded-xl border transition cursor-pointer flex flex-col justify-between ${
                isSelected
                  ? 'border-gray-900 bg-white ring-2 ring-gray-900 shadow-sm'
                  : 'border-gray-200 bg-white hover:border-gray-400'
              }`}
            >
              <div>
                <div className="flex items-center justify-between mb-2">
                  <h3 className="font-semibold text-gray-900 text-base">{plan.name}</h3>
                  {plan.popular && (
                    <span className="text-[10px] font-semibold tracking-wide uppercase bg-gray-100 text-gray-800 px-2 py-0.5 rounded border border-gray-200">
                      Popular
                    </span>
                  )}
                </div>
                <div className="flex items-baseline gap-1 my-3">
                  <span className="text-3xl font-bold text-gray-900">{plan.price}</span>
                  <span className="text-xs text-gray-500">/ {plan.credits} credits</span>
                </div>
                <p className="text-xs text-gray-600 mb-4">{plan.description}</p>
                <div className="border-t border-gray-100 pt-3 space-y-2">
                  {plan.features.map((feature, idx) => (
                    <div key={idx} className="flex items-center gap-2 text-xs text-gray-700">
                      <span className="text-gray-900 font-bold">✓</span>
                      <span>{feature}</span>
                    </div>
                  ))}
                </div>
              </div>

              <div className="mt-6 pt-4 border-t border-gray-100">
                <div
                  className={`w-full text-center py-2 rounded-lg text-xs font-medium transition ${
                    isSelected
                      ? 'bg-gray-900 text-white'
                      : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                  }`}
                >
                  {isSelected ? 'Selected' : 'Select Plan'}
                </div>
              </div>
            </div>
          );
        })}
      </div>

      <div className="bg-white border border-gray-200 rounded-xl p-6 max-w-xl mx-auto shadow-sm">
        <div className="flex items-center justify-between mb-4 pb-3 border-b border-gray-100">
          <div>
            <h2 className="text-sm font-semibold text-gray-900">Dummy Payment Gateway</h2>
            <p className="text-xs text-gray-500">Test simulation only — no real charge will occur.</p>
          </div>
          <span className="text-xs font-mono bg-gray-100 px-2 py-1 rounded text-gray-700 border border-gray-200">
            TEST MODE
          </span>
        </div>

        <div className="space-y-3 mb-6">
          <div>
            <label className="block text-[11px] font-medium uppercase tracking-wider text-gray-600 mb-1">
              Account Email
            </label>
            <input
              type="text"
              readOnly
              value={user?.email || 'user@gmail.com'}
              className="w-full border border-gray-200 bg-gray-50 px-3 py-2 rounded-lg text-xs text-gray-700 cursor-not-allowed"
            />
          </div>

          <div>
            <label className="block text-[11px] font-medium uppercase tracking-wider text-gray-600 mb-1">
              Card Number (Demo)
            </label>
            <input
              type="text"
              readOnly
              value="4242 •••• •••• 4242"
              className="w-full border border-gray-200 bg-gray-50 px-3 py-2 rounded-lg text-xs font-mono text-gray-700 cursor-not-allowed"
            />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-[11px] font-medium uppercase tracking-wider text-gray-600 mb-1">
                Expires
              </label>
              <input
                type="text"
                readOnly
                value="12 / 28"
                className="w-full border border-gray-200 bg-gray-50 px-3 py-2 rounded-lg text-xs font-mono text-gray-700 cursor-not-allowed"
              />
            </div>
            <div>
              <label className="block text-[11px] font-medium uppercase tracking-wider text-gray-600 mb-1">
                CVC
              </label>
              <input
                type="text"
                readOnly
                value="•••"
                className="w-full border border-gray-200 bg-gray-50 px-3 py-2 rounded-lg text-xs font-mono text-gray-700 cursor-not-allowed"
              />
            </div>
          </div>
        </div>

        <button
          onClick={handleSimulatePayment}
          disabled={loading}
          className="w-full bg-gray-900 hover:bg-black text-white font-medium py-2.5 rounded-lg text-sm transition disabled:bg-gray-400 cursor-pointer shadow-sm"
        >
          {loading ? 'Processing Demo Transaction...' : `Simulate Purchase (${plans.find(p => p.id === selectedPlan)?.price})`}
        </button>

        <p className="text-[11px] text-gray-500 text-center mt-3">
          Clicking above simulates a successful checkout and tops up your account credits immediately.
        </p>
      </div>
    </div>
  );
}
