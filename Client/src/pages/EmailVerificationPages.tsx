import { useEffect, useState, useRef } from 'react';
import { Link, useLocation, useSearchParams, useNavigate } from 'react-router-dom';
import { MessageSquare, Mail, CheckCircle, XCircle, Loader2, RefreshCw, ArrowRight } from 'lucide-react';
import { authApi } from '../api/auth';
import type { AxiosError } from 'axios';

function getApiError(err: unknown): string {
  const e = err as AxiosError<{ message: string }>;
  return e.response?.data?.message ?? (err instanceof Error ? err.message : 'Something went wrong');
}

function AuthShell({ children }: { children: React.ReactNode }) {
  return (
    <div className="min-h-screen bg-zinc-950 flex items-center justify-center p-4">
      <div className="fixed inset-0 overflow-hidden pointer-events-none">
        <div className="absolute top-1/3 left-1/2 -translate-x-1/2 w-[500px] h-[300px] bg-indigo-500/5 rounded-full blur-3xl" />
      </div>
      <div className="relative max-w-md w-full">
        <div className="text-center mb-8">
          <Link to="/" className="inline-flex items-center gap-2.5">
            <div className="w-9 h-9 rounded-lg bg-white flex items-center justify-center shadow-lg">
              <MessageSquare className="w-4 h-4 text-zinc-950" />
            </div>
            <span className="font-semibold text-lg tracking-tight text-white">Engageo</span>
          </Link>
        </div>
        <div className="bg-zinc-900 border border-zinc-800 rounded-2xl p-8 shadow-2xl shadow-black/50">
          {children}
        </div>
      </div>
    </div>
  );
}

// ── Resend form (shown on error) ──────────────────────────────────────────────
function ResendForm({ errorMessage }: { errorMessage: string }) {
  const [email, setEmail] = useState('');
  const [resending, setResending] = useState(false);
  const [resendSuccess, setResendSuccess] = useState(false);
  const [resendError, setResendError] = useState('');
  const [cooldown, setCooldown] = useState(0);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);

  useEffect(() => {
    return () => { if (timerRef.current) clearInterval(timerRef.current); };
  }, []);

  const startCooldown = () => {
    setCooldown(60);
    timerRef.current = setInterval(() => {
      setCooldown(c => {
        if (c <= 1) { clearInterval(timerRef.current!); return 0; }
        return c - 1;
      });
    }, 1000);
  };

  const handleResend = async () => {
    if (!email.trim() || cooldown > 0 || resending) return;
    setResending(true);
    setResendError('');
    try {
      await authApi.resendVerification(email.trim());
      setResendSuccess(true);
      startCooldown();
    } catch (err) {
      setResendError(getApiError(err));
    } finally {
      setResending(false);
    }
  };

  if (resendSuccess) {
    return (
      <div className="text-center space-y-6">
        <div className="w-16 h-16 rounded-2xl bg-emerald-500/10 border border-emerald-500/20 flex items-center justify-center mx-auto">
          <Mail className="w-7 h-7 text-emerald-400" />
        </div>
        <div className="space-y-2">
          <h1 className="text-xl font-semibold text-white">Check your inbox</h1>
          <p className="text-sm text-zinc-400">A new verification link has been sent to <span className="text-zinc-200 font-medium">{email}</span>.</p>
        </div>
        {cooldown > 0 && (
          <p className="text-xs text-zinc-600">Didn't get it? Resend available in {cooldown}s</p>
        )}
        <Link to="/login" className="block text-sm text-zinc-500 hover:text-zinc-300 transition-colors">
          Back to sign in
        </Link>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="text-center space-y-3">
        <div className="w-16 h-16 rounded-2xl bg-red-500/10 border border-red-500/20 flex items-center justify-center mx-auto">
          <XCircle className="w-7 h-7 text-red-400" />
        </div>
        <h1 className="text-xl font-semibold text-white tracking-tight">Link expired</h1>
        <p className="text-sm text-zinc-400">
          {errorMessage || 'This verification link has expired or already been used.'}
        </p>
      </div>

      <div className="space-y-3">
        <label className="block text-xs text-zinc-500 mb-1">Enter your email to get a new link</label>
        <input
          type="email"
          value={email}
          onChange={e => setEmail(e.target.value)}
          onKeyDown={e => e.key === 'Enter' && handleResend()}
          placeholder="you@company.com"
          className="w-full px-3 py-2.5 rounded-lg bg-zinc-800 border border-zinc-700 focus:border-indigo-500 text-sm text-white placeholder-zinc-500 outline-none transition-colors"
        />

        {resendError && (
          <div className="flex items-center gap-2 p-3 rounded-lg bg-red-500/10 border border-red-500/20 text-red-400 text-sm">
            <XCircle className="w-4 h-4 shrink-0" />{resendError}
          </div>
        )}

        <button
          onClick={handleResend}
          disabled={!email.trim() || resending || cooldown > 0}
          className="w-full flex items-center justify-center gap-2 px-4 py-2.5 rounded-lg bg-indigo-600 hover:bg-indigo-500 disabled:opacity-40 disabled:cursor-not-allowed text-sm font-semibold text-white transition-all"
        >
          {resending ? <Loader2 className="w-4 h-4 animate-spin" /> : <RefreshCw className="w-4 h-4" />}
          {cooldown > 0 ? `Resend in ${cooldown}s` : 'Send new verification link'}
        </button>

        <Link to="/login" className="block text-center text-sm text-zinc-500 hover:text-zinc-300 transition-colors pt-1">
          Back to sign in
        </Link>
      </div>
    </div>
  );
}

// ── Page 1: After registration ────────────────────────────────────────────────
export function VerifyEmailSentPage() {
  const location = useLocation();
  const email = (location.state as { email?: string })?.email ?? '';
  const [resending, setResending] = useState(false);
  const [resendSuccess, setResendSuccess] = useState(false);
  const [resendError, setResendError] = useState('');
  const [cooldown, setCooldown] = useState(0);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);

  useEffect(() => {
    return () => { if (timerRef.current) clearInterval(timerRef.current!); };
  }, []);

  const startCooldown = () => {
    setCooldown(60);
    timerRef.current = setInterval(() => {
      setCooldown(c => {
        if (c <= 1) { clearInterval(timerRef.current!); return 0; }
        return c - 1;
      });
    }, 1000);
  };

  const handleResend = async () => {
    if (!email || cooldown > 0 || resending) return;
    setResending(true);
    setResendError('');
    setResendSuccess(false);
    try {
      await authApi.resendVerification(email);
      setResendSuccess(true);
      startCooldown();
    } catch (err) {
      setResendError(getApiError(err));
    } finally {
      setResending(false);
    }
  };

  return (
    <AuthShell>
      <div className="text-center space-y-6">
        <div className="flex justify-center">
          <div className="relative">
            <div className="w-16 h-16 rounded-2xl bg-indigo-500/10 border border-indigo-500/20 flex items-center justify-center">
              <Mail className="w-7 h-7 text-indigo-400" />
            </div>
            <div className="absolute -top-1 -right-1 w-4 h-4 bg-emerald-500 rounded-full border-2 border-zinc-900" />
          </div>
        </div>

        <div className="space-y-2">
          <h1 className="text-xl font-semibold text-white tracking-tight">Check your inbox</h1>
          <p className="text-sm text-zinc-400 leading-relaxed">
            We sent a verification link to{' '}
            {email
              ? <span className="text-zinc-200 font-medium">{email}</span>
              : 'your email address'
            }
          </p>
        </div>

        <div className="bg-zinc-800/50 border border-zinc-700/50 rounded-xl p-4 text-left space-y-3">
          {['Open your email inbox', 'Click the "Verify Email" button', 'Come back here and sign in'].map((step, i) => (
            <div key={i} className="flex items-center gap-3">
              <div className="w-5 h-5 rounded-full bg-zinc-700 flex items-center justify-center shrink-0">
                <span className="text-xs text-zinc-300 font-medium">{i + 1}</span>
              </div>
              <span className="text-sm text-zinc-300">{step}</span>
            </div>
          ))}
        </div>

        {resendSuccess && (
          <div className="flex items-center gap-2 p-3 rounded-lg bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 text-sm">
            <CheckCircle className="w-4 h-4 shrink-0" />
            Verification email resent!
          </div>
        )}
        {resendError && (
          <div className="flex items-center gap-2 p-3 rounded-lg bg-red-500/10 border border-red-500/20 text-red-400 text-sm">
            <XCircle className="w-4 h-4 shrink-0" />{resendError}
          </div>
        )}

        <div className="space-y-3">
          {email && (
            <button
              onClick={handleResend}
              disabled={resending || cooldown > 0}
              className="w-full flex items-center justify-center gap-2 px-4 py-2.5 rounded-lg border border-zinc-700 bg-zinc-800 hover:bg-zinc-700 text-sm font-medium text-zinc-300 hover:text-white transition-all disabled:opacity-40 disabled:cursor-not-allowed"
            >
              {resending ? <Loader2 className="w-4 h-4 animate-spin" /> : <RefreshCw className="w-4 h-4" />}
              {cooldown > 0 ? `Resend in ${cooldown}s` : 'Resend verification email'}
            </button>
          )}
          <Link to="/login" className="block text-sm text-zinc-500 hover:text-zinc-300 transition-colors">
            Back to sign in
          </Link>
        </div>
      </div>
    </AuthShell>
  );
}

// ── Page 2: Email link landing page ──────────────────────────────────────────
export function EmailVerifiedPage() {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const token = searchParams.get('token');
  const [status, setStatus] = useState<'loading' | 'success' | 'error'>('loading');
  const [message, setMessage] = useState('');
  const calledRef = useRef(false);

  useEffect(() => {
    // Prevent double-call in React StrictMode
    if (calledRef.current) return;
    calledRef.current = true;

    if (!token) {
      setStatus('error');
      setMessage('No verification token found in the link.');
      return;
    }

    authApi.verifyEmail(token)
      .then(() => {
        setStatus('success');
        // Auto-redirect to login after 3 seconds
        setTimeout(() => navigate('/login', { replace: true }), 3000);
      })
      .catch((err) => {
        setStatus('error');
        setMessage(getApiError(err));
      });
  }, [token, navigate]);

  if (status === 'loading') {
    return (
      <AuthShell>
        <div className="text-center py-4 space-y-5">
          <div className="w-16 h-16 rounded-2xl bg-zinc-800 border border-zinc-700 flex items-center justify-center mx-auto">
            <Loader2 className="w-7 h-7 animate-spin text-indigo-400" />
          </div>
          <div>
            <h1 className="text-lg font-semibold text-white mb-1">Verifying your email</h1>
            <p className="text-sm text-zinc-500">Just a moment...</p>
          </div>
        </div>
      </AuthShell>
    );
  }

  if (status === 'error') {
    return (
      <AuthShell>
        <ResendForm errorMessage={message} />
      </AuthShell>
    );
  }

  // Success
  return (
    <AuthShell>
      <div className="text-center space-y-6">
        <div className="flex justify-center">
          <div className="relative">
            <div className="w-16 h-16 rounded-2xl bg-emerald-500/10 border border-emerald-500/20 flex items-center justify-center">
              <CheckCircle className="w-7 h-7 text-emerald-400" />
            </div>
            <div className="absolute inset-0 rounded-2xl border border-emerald-400/20 animate-ping" />
          </div>
        </div>

        <div className="space-y-2">
          <h1 className="text-xl font-semibold text-white tracking-tight">Email verified!</h1>
          <p className="text-sm text-zinc-400">
            Your account is ready. Redirecting to sign in...
          </p>
        </div>

        {/* Progress bar auto-redirect */}
        <div className="w-full bg-zinc-800 rounded-full h-1 overflow-hidden">
          <div className="h-full bg-indigo-500 rounded-full animate-[shrink_3s_linear_forwards]" 
               style={{ animation: 'width 3s linear forwards', width: '100%' }} />
        </div>

        <Link
          to="/login"
          replace
          className="w-full flex items-center justify-center gap-2 px-4 py-2.5 rounded-lg bg-indigo-600 hover:bg-indigo-500 text-sm font-semibold text-white transition-all shadow-lg shadow-indigo-500/20"
        >
          Sign in now
          <ArrowRight className="w-4 h-4" />
        </Link>
      </div>
    </AuthShell>
  );
}