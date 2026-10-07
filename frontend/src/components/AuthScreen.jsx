import { SignIn } from '@clerk/react';

export default function AuthScreen() {
  return (
    <div className="flex flex-col items-center justify-center pt-6 pb-12">
      <div className="mb-4 text-center">
        <h1 className="text-xl font-bold text-gray-900">Sign in with Google</h1>
        <p className="text-xs text-gray-500 mt-1">
          Continue with your active Gmail account (5 upload credits included).
        </p>
      </div>
      <SignIn
        routing="hash"
        appearance={{
          elements: {
            rootBox: 'mx-auto',
            card: 'shadow-sm border border-gray-200 rounded-xl bg-white',
            formButtonPrimary: 'bg-gray-900 hover:bg-black text-white text-xs',
            footerActionLink: 'text-gray-900 hover:underline',
          },
        }}
      />
    </div>
  );
}