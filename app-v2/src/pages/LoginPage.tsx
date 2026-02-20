import { useState, useRef, type FormEvent } from 'react';
import { Navigate } from 'react-router-dom';
import { Mail } from 'lucide-react';
import { Button } from '@/components/ui';
import { useAuth } from '@/hooks/useAuth';
import { GoogleLogin, GoogleOAuthProvider } from '@react-oauth/google';
import toast from 'react-hot-toast';

const GOOGLE_CLIENT_ID = import.meta.env.VITE_GOOGLE_CLIENT_ID;
const BACKEND_URL = import.meta.env.VITE_BACKEND_URL;

type LoginMode = 'choose' | 'pin-login' | 'pin-setup';

export default function LoginPage() {
  const { signInWithSession, isAuthenticated, isLoading: authLoading } = useAuth();
  const [mode, setMode] = useState<LoginMode>('choose');
  const [email, setEmail] = useState('');
  const [pin, setPin] = useState(['', '', '', '']);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState('');
  const [tempToken, setTempToken] = useState('');
  const [userName, setUserName] = useState('');
  const pinRefs = useRef<(HTMLInputElement | null)[]>([]);

  if (!authLoading && isAuthenticated) {
    return <Navigate to="/" replace />;
  }

  const resetPin = () => {
    setPin(['', '', '', '']);
    setTimeout(() => pinRefs.current[0]?.focus(), 50);
  };

  const handlePinChange = (index: number, value: string) => {
    if (!/^\d*$/.test(value)) return;

    const newPin = [...pin];
    newPin[index] = value.slice(-1);
    setPin(newPin);

    if (value && index < 3) {
      pinRefs.current[index + 1]?.focus();
    }
  };

  const handlePinKeyDown = (index: number, e: React.KeyboardEvent) => {
    if (e.key === 'Backspace' && !pin[index] && index > 0) {
      pinRefs.current[index - 1]?.focus();
    }
  };

  const handlePinPaste = (e: React.ClipboardEvent) => {
    e.preventDefault();
    const pasted = e.clipboardData.getData('text').replace(/\D/g, '').slice(0, 4);
    if (pasted.length === 4) {
      setPin(pasted.split(''));
      pinRefs.current[3]?.focus();
    }
  };

  const handleGoogleSuccess = async (credentialResponse: { credential?: string }) => {
    if (!credentialResponse.credential) {
      toast.error('Google sign-in failed');
      return;
    }

    setIsLoading(true);
    setError('');

    try {
      const res = await fetch(`${BACKEND_URL}/api/auth/google`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ credential: credentialResponse.credential }),
      });

      const body = await res.json();

      if (!res.ok) {
        setError(body.error || 'Google sign-in failed');
        toast.error(body.error || 'Google sign-in failed');
        return;
      }

      if (body.needsPin) {
        setTempToken(body.tempToken);
        setUserName(body.user.full_name || body.user.email);
        setEmail(body.user.email);
        setMode('pin-setup');
        resetPin();
        return;
      }

      if (body.session) {
        signInWithSession(body.session);
        toast.success('Welcome back!');
        // No navigate() here — the isAuthenticated guard at the top handles redirect
        // to avoid a race condition where ProtectedRoute fires before state updates
      }
    } catch {
      toast.error('Failed to connect to server');
    } finally {
      setIsLoading(false);
    }
  };

  const handleSetPin = async (e: FormEvent) => {
    e.preventDefault();
    const pinValue = pin.join('');
    if (pinValue.length !== 4) {
      setError('Please enter a 4-digit PIN');
      return;
    }

    setIsLoading(true);
    setError('');

    try {
      const res = await fetch(`${BACKEND_URL}/api/auth/set-pin`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ pin: pinValue, tempToken }),
      });

      const body = await res.json();

      if (!res.ok) {
        setError(body.error || 'Failed to set PIN');
        toast.error(body.error || 'Failed to set PIN');
        return;
      }

      if (body.session) {
        signInWithSession(body.session);
        toast.success('PIN set! Welcome!');
      }
    } catch {
      toast.error('Failed to connect to server');
    } finally {
      setIsLoading(false);
    }
  };

  const handlePinLogin = async (e: FormEvent) => {
    e.preventDefault();
    const pinValue = pin.join('');
    if (pinValue.length !== 4 || !email) {
      setError('Please enter your email and 4-digit PIN');
      return;
    }

    setIsLoading(true);
    setError('');

    try {
      const res = await fetch(`${BACKEND_URL}/api/auth/pin-login`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, pin: pinValue }),
      });

      const body = await res.json();

      if (!res.ok) {
        setError(body.error || 'Invalid email or PIN');
        toast.error(body.error || 'Invalid email or PIN');
        resetPin();
        return;
      }

      if (body.session) {
        signInWithSession(body.session);
        toast.success('Welcome back!');
      }
    } catch {
      toast.error('Failed to connect to server');
    } finally {
      setIsLoading(false);
    }
  };

  const pinInputs = (
    <div className="flex gap-3 justify-center" onPaste={handlePinPaste}>
      {pin.map((digit, i) => (
        <input
          key={i}
          ref={el => { pinRefs.current[i] = el; }}
          type="tel"
          inputMode="numeric"
          maxLength={1}
          value={digit}
          onChange={(e) => handlePinChange(i, e.target.value)}
          onKeyDown={(e) => handlePinKeyDown(i, e)}
          className="w-14 h-14 text-center text-2xl font-bold border-2 border-gray-200 rounded-xl focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20 outline-none transition-all"
          autoComplete="off"
        />
      ))}
    </div>
  );

  return (
    <GoogleOAuthProvider clientId={GOOGLE_CLIENT_ID}>
      <div className="app-container">
        {/* Header */}
        <div className="bg-gradient-primary px-6 pt-16 pb-12 text-white text-center">
          <div className="w-20 h-20 mx-auto mb-4 bg-white/20 rounded-2xl flex items-center justify-center backdrop-blur-sm">
            <span className="text-4xl font-bold">V</span>
          </div>
          <h1 className="text-2xl font-bold mb-1">VCA</h1>
          <p className="text-white/80 text-sm">Viral Content Analyzer</p>
        </div>

        {/* Content */}
        <div className="flex-1 px-6 py-8 -mt-6 bg-white rounded-t-3xl">
          {mode === 'choose' && (
            <>
              <h2 className="text-xl font-bold text-gray-900 mb-1">Welcome</h2>
              <p className="text-gray-500 text-sm mb-8">Sign in to continue</p>

              {/* Google Sign-In */}
              <div className="flex justify-center mb-6">
                <GoogleLogin
                  onSuccess={handleGoogleSuccess}
                  onError={() => toast.error('Google sign-in failed')}
                  size="large"
                  width="320"
                  text="signin_with"
                  shape="rectangular"
                  theme="outline"
                />
              </div>

              {/* Divider */}
              <div className="flex items-center gap-4 my-6">
                <div className="flex-1 h-px bg-gray-200" />
                <span className="text-sm text-gray-400">or</span>
                <div className="flex-1 h-px bg-gray-200" />
              </div>

              {/* PIN Login Button */}
              <Button
                fullWidth
                variant="outline"
                size="lg"
                onClick={() => { setMode('pin-login'); resetPin(); }}
              >
                <Mail className="w-5 h-5 mr-2" />
                Sign in with Email & PIN
              </Button>

              {error && (
                <div className="mt-4 p-3 bg-danger/10 border border-danger/20 rounded-xl text-sm text-danger">
                  {error}
                </div>
              )}

              <p className="text-center text-gray-400 text-xs mt-8">
                Contact admin if you need access
              </p>
            </>
          )}

          {mode === 'pin-login' && (
            <>
              <button
                onClick={() => { setMode('choose'); setError(''); }}
                className="text-sm text-primary font-medium mb-4"
              >
                &larr; Back
              </button>
              <h2 className="text-xl font-bold text-gray-900 mb-1">Sign in with PIN</h2>
              <p className="text-gray-500 text-sm mb-6">Enter your email and 4-digit PIN</p>

              <form onSubmit={handlePinLogin} className="space-y-5">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1.5">Email</label>
                  <input
                    type="email"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    placeholder="Enter your email"
                    className="w-full px-4 py-3 border border-gray-200 rounded-xl text-sm focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20 outline-none"
                    autoComplete="email"
                    required
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-3">PIN</label>
                  {pinInputs}
                </div>

                {error && (
                  <div className="p-3 bg-danger/10 border border-danger/20 rounded-xl text-sm text-danger">
                    {error}
                  </div>
                )}

                <Button type="submit" fullWidth size="lg" isLoading={isLoading}>
                  Sign In
                </Button>
              </form>
            </>
          )}

          {mode === 'pin-setup' && (
            <>
              <h2 className="text-xl font-bold text-gray-900 mb-1">Set Your PIN</h2>
              <p className="text-gray-500 text-sm mb-2">
                Hi {userName}! Create a 4-digit PIN for quick login.
              </p>
              <p className="text-gray-400 text-xs mb-6">
                Use this PIN to sign in from any device with just your email.
              </p>

              <form onSubmit={handleSetPin} className="space-y-5">
                {pinInputs}

                {error && (
                  <div className="p-3 bg-danger/10 border border-danger/20 rounded-xl text-sm text-danger">
                    {error}
                  </div>
                )}

                <Button type="submit" fullWidth size="lg" isLoading={isLoading}>
                  Set PIN & Continue
                </Button>
              </form>
            </>
          )}
        </div>

        <div className="h-safe-bottom bg-white" />
      </div>
    </GoogleOAuthProvider>
  );
}
