import { useState } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import { MessageSquare, Mail, Lock, Eye, EyeOff, ArrowRight, User, Check, AlertTriangle, AlertCircle } from 'lucide-react';
import { useAuth } from '../store/AppStore';
import { authApi } from '../api/auth';
import type { AxiosError } from 'axios';

function getApiError(err: unknown): string {
  const e = err as AxiosError<{ message: string }>;
  return e.response?.data?.message ?? (err instanceof Error ? err.message : 'Something went wrong');
}

// ── Validators ─────────────────────────────────────────────────────────────────
function validateEmail(email: string): string {
  if (!email.trim()) return 'Email is required';
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) return 'Invalid email address';
  return '';
}

interface PasswordResult { errors: string[]; strength: number }
function validatePassword(pw: string): PasswordResult {
  const errors: string[] = [];
  if (pw.length < 8) errors.push('At least 8 characters');
  if (!/[A-Z]/.test(pw)) errors.push('At least one uppercase letter');
  if (!/[a-z]/.test(pw)) errors.push('At least one lowercase letter');
  if (!/[0-9]/.test(pw)) errors.push('At least one number');
  const strength = 4 - errors.length;
  return { errors, strength };
}

function PasswordStrength({ password }: { password: string }) {
  if (!password) return null;
  const { errors, strength } = validatePassword(password);
  const colors = ['bg-red-500', 'bg-orange-500', 'bg-yellow-500', 'bg-emerald-500'];
  return (
    <div className="mt-2 space-y-1.5">
      <div className="flex gap-1">
        {[0, 1, 2, 3].map(i => (
          <div key={i} className={`h-1 flex-1 rounded-full ${i < strength ? colors[strength - 1] : 'bg-zinc-800'} transition-all`} />
        ))}
      </div>
      {strength < 4 && (
        <ul className="space-y-0.5">
          {errors.map(e => (
            <li key={e} className="text-xs text-zinc-500 flex items-center gap-1.5">
              <span className="w-1 h-1 rounded-full bg-zinc-600 inline-block" />{e}
            </li>
          ))}
        </ul>
      )}
      {strength === 4 && <p className="text-xs text-emerald-400 flex items-center gap-1"><Check className="w-3 h-3" />Strong password</p>}
    </div>
  );
}

function FieldErr({ msg }: { msg: string }) {
  if (!msg) return null;
  return <p className="text-xs text-red-400 mt-1 flex items-center gap-1"><AlertCircle className="w-3 h-3 shrink-0" />{msg}</p>;
}

// ── Login ──────────────────────────────────────────────────────────────────────
export function LoginPage() {
  const navigate = useNavigate();
  const { login } = useAuth();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState('');
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const errs: Record<string, string> = {};
    const emailErr = validateEmail(email); if (emailErr) errs.email = emailErr;
    if (!password) errs.password = 'Password is required';
    if (Object.keys(errs).length > 0) { setFieldErrors(errs); return; }
    setIsLoading(true); setError('');
    try { await login(email, password); navigate('/dashboard'); }
    catch (err) { setError(getApiError(err)); }
    finally { setIsLoading(false); }
  };

  return (
    <div className="min-h-screen bg-zinc-950 flex items-center justify-center p-4">
      <div className="max-w-sm w-full">
        <div className="text-center mb-8">
          <Link to="/" className="inline-flex items-center gap-2 mb-6">
            <div className="w-10 h-10 rounded-lg bg-white flex items-center justify-center">
              <MessageSquare className="w-5 h-5 text-zinc-950" />
            </div>
            <span className="font-semibold text-xl">Engageo</span>
          </Link>
          <h1 className="text-xl font-semibold mb-1">Welcome back</h1>
          <p className="text-sm text-zinc-500">Sign in to your account</p>
        </div>
        <div className="p-6 rounded-xl border border-zinc-800 bg-zinc-900/30">
          <form onSubmit={handleSubmit} className="space-y-4">
            {error && <div className="p-3 rounded-lg bg-red-950/50 border border-red-900/50 text-sm text-red-400">{error}</div>}
            <div>
              <label htmlFor="email" className="text-xs text-zinc-400">Email</label>
              <div className="relative mt-1">
                <Mail className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-zinc-600" />
                <input id="email" type="email" value={email}
                  onChange={(e) => { setEmail(e.target.value); setFieldErrors(p => ({ ...p, email: '' })); }}
                  placeholder="you@company.com"
                  className={`input pl-10 ${fieldErrors.email ? 'border-red-500/50' : ''}`} />
              </div>
              <FieldErr msg={fieldErrors.email} />
            </div>
            <div>
              <div className="flex items-center justify-between">
                <label htmlFor="password" className="text-xs text-zinc-400">Password</label>
                <Link to="/forgot-password" className="text-xs text-zinc-500 hover:text-zinc-300 transition-colors">Forgot password?</Link>
              </div>
              <div className="relative mt-1">
                <Lock className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-zinc-600" />
                <input id="password" type={showPassword ? 'text' : 'password'} value={password}
                  onChange={(e) => { setPassword(e.target.value); setFieldErrors(p => ({ ...p, password: '' })); }}
                  placeholder="Enter password"
                  className={`input pl-10 pr-10 ${fieldErrors.password ? 'border-red-500/50' : ''}`} />
                <button type="button" onClick={() => setShowPassword(!showPassword)} className="absolute right-3 top-1/2 -translate-y-1/2 text-zinc-600 hover:text-zinc-400">
                  {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                </button>
              </div>
              <FieldErr msg={fieldErrors.password} />
            </div>
            <button type="submit" disabled={isLoading} className="btn btn-primary w-full">
              {isLoading ? <div className="w-4 h-4 border-2 border-zinc-950/30 border-t-zinc-950 rounded-full animate-spin" /> : <><span>Sign In</span><ArrowRight className="w-4 h-4" /></>}
            </button>
          </form>
          <div className="mt-6 text-center text-sm text-zinc-500">
            Don&apos;t have an account? <Link to="/register" className="text-zinc-300 hover:text-white transition-colors">Sign up</Link>
          </div>
        </div>
      </div>
    </div>
  );
}

// ── Register ───────────────────────────────────────────────────────────────────
export function RegisterPage() {
  const navigate = useNavigate();
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState('');
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});
  const [showStrength, setShowStrength] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const errs: Record<string, string> = {};
    if (!name.trim()) errs.name = 'Full name is required';
    else if (name.trim().length < 2) errs.name = 'Name must be at least 2 characters';
    const emailErr = validateEmail(email); if (emailErr) errs.email = emailErr;
    const { errors: pwErrors } = validatePassword(password);
    if (pwErrors.length > 0) errs.password = pwErrors[0];
    if (Object.keys(errs).length > 0) { setFieldErrors(errs); return; }
    setIsLoading(true); setError('');
    try {
      await authApi.register({ name: name.trim(), email, password });
      navigate('/verify-email-sent', { state: { email } });
    } catch (err) { setError(getApiError(err)); }
    finally { setIsLoading(false); }
  };

  return (
    <div className="min-h-screen bg-zinc-950 flex items-center justify-center p-4">
      <div className="max-w-sm w-full">
        <div className="text-center mb-8">
          <Link to="/" className="inline-flex items-center gap-2 mb-6">
            <div className="w-10 h-10 rounded-lg bg-white flex items-center justify-center">
              <MessageSquare className="w-5 h-5 text-zinc-950" />
            </div>
            <span className="font-semibold text-xl">Engageo</span>
          </Link>
          <h1 className="text-xl font-semibold mb-1">Create an account</h1>
          <p className="text-sm text-zinc-500">Start your free trial today</p>
        </div>
        <div className="p-6 rounded-xl border border-zinc-800 bg-zinc-900/30">
          <form onSubmit={handleSubmit} className="space-y-4">
            {error && <div className="p-3 rounded-lg bg-red-950/50 border border-red-900/50 text-sm text-red-400">{error}</div>}
            <div>
              <label htmlFor="name" className="text-xs text-zinc-400">Full Name</label>
              <div className="relative mt-1">
                <User className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-zinc-600" />
                <input id="name" type="text" value={name}
                  onChange={(e) => { setName(e.target.value); setFieldErrors(p => ({ ...p, name: '' })); }}
                  placeholder="John Doe" className={`input pl-10 ${fieldErrors.name ? 'border-red-500/50' : ''}`} />
              </div>
              <FieldErr msg={fieldErrors.name} />
            </div>
            <div>
              <label htmlFor="email" className="text-xs text-zinc-400">Email</label>
              <div className="relative mt-1">
                <Mail className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-zinc-600" />
                <input id="email" type="email" value={email}
                  onChange={(e) => { setEmail(e.target.value); setFieldErrors(p => ({ ...p, email: '' })); }}
                  placeholder="you@company.com" className={`input pl-10 ${fieldErrors.email ? 'border-red-500/50' : ''}`} />
              </div>
              <FieldErr msg={fieldErrors.email} />
            </div>
            <div>
              <label htmlFor="password" className="text-xs text-zinc-400">Password</label>
              <div className="relative mt-1">
                <Lock className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-zinc-600" />
                <input id="password" type={showPassword ? 'text' : 'password'} value={password}
                  onChange={(e) => { setPassword(e.target.value); setFieldErrors(p => ({ ...p, password: '' })); setShowStrength(true); }}
                  placeholder="Create a strong password"
                  className={`input pl-10 pr-10 ${fieldErrors.password ? 'border-red-500/50' : ''}`} />
                <button type="button" onClick={() => setShowPassword(!showPassword)} className="absolute right-3 top-1/2 -translate-y-1/2 text-zinc-600 hover:text-zinc-400">
                  {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                </button>
              </div>
              <FieldErr msg={fieldErrors.password} />
              {showStrength && <PasswordStrength password={password} />}
            </div>
            <button type="submit" disabled={isLoading} className="btn btn-primary w-full">
              {isLoading ? <div className="w-4 h-4 border-2 border-zinc-950/30 border-t-zinc-950 rounded-full animate-spin" /> : <><span>Create Account</span><ArrowRight className="w-4 h-4" /></>}
            </button>
          </form>
          <div className="mt-6 text-center text-sm text-zinc-500">
            Already have an account? <Link to="/login" className="text-zinc-300 hover:text-white transition-colors">Sign in</Link>
          </div>
        </div>
      </div>
    </div>
  );
}

// ── Forgot Password ────────────────────────────────────────────────────────────
export function ForgotPasswordPage() {
  const [email, setEmail] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState('');
  const [emailError, setEmailError] = useState('');
  const [success, setSuccess] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const err = validateEmail(email); if (err) { setEmailError(err); return; }
    setIsLoading(true); setError('');
    try { await authApi.forgotPassword({ email }); setSuccess(true); }
    catch (err) { setError(getApiError(err)); }
    finally { setIsLoading(false); }
  };

  return (
    <div className="min-h-screen bg-zinc-950 flex items-center justify-center p-4">
      <div className="max-w-sm w-full">
        <div className="text-center mb-8">
          <Link to="/" className="inline-flex items-center gap-2 mb-6">
            <div className="w-10 h-10 rounded-lg bg-white flex items-center justify-center">
              <MessageSquare className="w-5 h-5 text-zinc-950" />
            </div>
            <span className="font-semibold text-xl">Engageo</span>
          </Link>
          <h1 className="text-xl font-semibold mb-1">Reset password</h1>
          <p className="text-sm text-zinc-500">Enter your email to receive a reset link</p>
        </div>
        <div className="p-6 rounded-xl border border-zinc-800 bg-zinc-900/30">
          {success ? (
            <div className="text-center py-4 space-y-3">
              <div className="w-10 h-10 rounded-full bg-emerald-950 border border-emerald-900 flex items-center justify-center mx-auto">
                <Mail className="w-5 h-5 text-emerald-400" />
              </div>
              <p className="text-sm text-zinc-300">Check your email for a reset link.</p>
              <Link to="/login" className="text-sm text-zinc-500 hover:text-zinc-300 transition-colors block mt-4">Back to sign in</Link>
            </div>
          ) : (
            <form onSubmit={handleSubmit} className="space-y-4">
              {error && <div className="p-3 rounded-lg bg-red-950/50 border border-red-900/50 text-sm text-red-400">{error}</div>}
              <div>
                <label htmlFor="email" className="text-xs text-zinc-400">Email</label>
                <div className="relative mt-1">
                  <Mail className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-zinc-600" />
                  <input id="email" type="email" value={email}
                    onChange={(e) => { setEmail(e.target.value); setEmailError(''); }}
                    placeholder="you@company.com"
                    className={`input pl-10 ${emailError ? 'border-red-500/50' : ''}`} />
                </div>
                <FieldErr msg={emailError} />
              </div>
              <button type="submit" disabled={isLoading} className="btn btn-primary w-full">
                {isLoading ? <div className="w-4 h-4 border-2 border-zinc-950/30 border-t-zinc-950 rounded-full animate-spin" /> : <><span>Send Reset Link</span><ArrowRight className="w-4 h-4" /></>}
              </button>
              <div className="text-center">
                <Link to="/login" className="text-sm text-zinc-500 hover:text-zinc-300 transition-colors">Back to sign in</Link>
              </div>
            </form>
          )}
        </div>
      </div>
    </div>
  );
}

// ── Reset Password ─────────────────────────────────────────────────────────────
export function ResetPasswordPage() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const token = searchParams.get('token') ?? '';
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState('');
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});
  const [success, setSuccess] = useState(false);
  const [showStrength, setShowStrength] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const errs: Record<string, string> = {};
    const { errors: pwErrors } = validatePassword(password);
    if (pwErrors.length > 0) errs.password = pwErrors[0];
    if (password !== confirmPassword) errs.confirm = 'Passwords do not match';
    if (Object.keys(errs).length > 0) { setFieldErrors(errs); return; }
    setIsLoading(true); setError('');
    try { await authApi.resetPassword({ token, password, confirmPassword }); setSuccess(true); }
    catch (err) { setError(getApiError(err)); }
    finally { setIsLoading(false); }
  };

  if (!token) {
    return (
      <div className="min-h-screen bg-zinc-950 flex items-center justify-center p-4">
        <div className="max-w-sm w-full">
          <div className="text-center mb-8">
            <Link to="/" className="inline-flex items-center gap-2 mb-6">
              <div className="w-10 h-10 rounded-lg bg-white flex items-center justify-center">
                <MessageSquare className="w-5 h-5 text-zinc-950" />
              </div>
              <span className="font-semibold text-xl">Engageo</span>
            </Link>
          </div>
          <div className="p-6 rounded-xl border border-zinc-800 bg-zinc-900/30">
            <div className="text-center py-4 space-y-3">
              <div className="w-10 h-10 rounded-full bg-red-950 border border-red-900 flex items-center justify-center mx-auto">
                <AlertTriangle className="w-5 h-5 text-red-400" />
              </div>
              <p className="text-sm text-zinc-300">This reset link is invalid or missing a token.</p>
              <Link to="/forgot-password" className="text-sm text-zinc-500 hover:text-zinc-300 transition-colors block mt-4">Request a new link</Link>
            </div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-zinc-950 flex items-center justify-center p-4">
      <div className="max-w-sm w-full">
        <div className="text-center mb-8">
          <Link to="/" className="inline-flex items-center gap-2 mb-6">
            <div className="w-10 h-10 rounded-lg bg-white flex items-center justify-center">
              <MessageSquare className="w-5 h-5 text-zinc-950" />
            </div>
            <span className="font-semibold text-xl">Engageo</span>
          </Link>
          <h1 className="text-xl font-semibold mb-1">Set a new password</h1>
          <p className="text-sm text-zinc-500">Choose a strong password for your account</p>
        </div>
        <div className="p-6 rounded-xl border border-zinc-800 bg-zinc-900/30">
          {success ? (
            <div className="text-center py-4 space-y-3">
              <div className="w-10 h-10 rounded-full bg-emerald-950 border border-emerald-900 flex items-center justify-center mx-auto">
                <Check className="w-5 h-5 text-emerald-400" />
              </div>
              <p className="text-sm text-zinc-300">Password reset successfully.</p>
              <button onClick={() => navigate('/login')} className="btn btn-primary w-full mt-2">
                <span>Sign in</span><ArrowRight className="w-4 h-4" />
              </button>
            </div>
          ) : (
            <form onSubmit={handleSubmit} className="space-y-4">
              {error && <div className="p-3 rounded-lg bg-red-950/50 border border-red-900/50 text-sm text-red-400">{error}</div>}
              <div>
                <label htmlFor="password" className="text-xs text-zinc-400">New password</label>
                <div className="relative mt-1">
                  <Lock className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-zinc-600" />
                  <input id="password" type={showPassword ? 'text' : 'password'} value={password}
                    onChange={(e) => { setPassword(e.target.value); setFieldErrors(p => ({ ...p, password: '' })); setShowStrength(true); }}
                    placeholder="Create a new password"
                    className={`input pl-10 pr-10 ${fieldErrors.password ? 'border-red-500/50' : ''}`} />
                  <button type="button" onClick={() => setShowPassword(!showPassword)} className="absolute right-3 top-1/2 -translate-y-1/2 text-zinc-600 hover:text-zinc-400">
                    {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                  </button>
                </div>
                <FieldErr msg={fieldErrors.password} />
                {showStrength && <PasswordStrength password={password} />}
              </div>
              <div>
                <label htmlFor="confirmPassword" className="text-xs text-zinc-400">Confirm password</label>
                <div className="relative mt-1">
                  <Lock className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-zinc-600" />
                  <input id="confirmPassword" type={showConfirmPassword ? 'text' : 'password'} value={confirmPassword}
                    onChange={(e) => { setConfirmPassword(e.target.value); setFieldErrors(p => ({ ...p, confirm: '' })); }}
                    placeholder="Re-enter your new password"
                    className={`input pl-10 pr-10 ${fieldErrors.confirm ? 'border-red-500/50' : ''}`} />
                  <button type="button" onClick={() => setShowConfirmPassword(!showConfirmPassword)} className="absolute right-3 top-1/2 -translate-y-1/2 text-zinc-600 hover:text-zinc-400">
                    {showConfirmPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                  </button>
                </div>
                <FieldErr msg={fieldErrors.confirm} />
              </div>
              <button type="submit" disabled={isLoading} className="btn btn-primary w-full">
                {isLoading ? <div className="w-4 h-4 border-2 border-zinc-950/30 border-t-zinc-950 rounded-full animate-spin" /> : <><span>Reset Password</span><ArrowRight className="w-4 h-4" /></>}
              </button>
              <div className="text-center">
                <Link to="/login" className="text-sm text-zinc-500 hover:text-zinc-300 transition-colors">Back to sign in</Link>
              </div>
            </form>
          )}
        </div>
      </div>
    </div>
  );
}
