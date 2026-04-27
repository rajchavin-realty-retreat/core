import { useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import api from './api/axiosConfig';

export default function Login({ setAuth }) {
  const [mode, setMode] = useState('login'); // 'login' | 'forgot' | 'reset'
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [otp, setOtp] = useState(['', '', '', '', '', '']);
  
  // Toggle States
  const [showPassword, setShowPassword] = useState(false);
  const [showNewPassword, setShowNewPassword] = useState(false);

  const [error, setError] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const navigate = useNavigate();

  const handleLogin = async (e) => {
    e.preventDefault();
    setIsLoading(true);
    setError('');
    try {
      const res = await api.post('/auth/login', { email, password });
      localStorage.setItem('userInfo', JSON.stringify(res.data));
      setAuth(true); 
      navigate('/');
    } catch (err) {
      setError(err.response?.data?.message || 'Invalid credentials');
    } finally {
      setIsLoading(false);
    }
  };

  const handleForgotPassword = async (e) => {
    e.preventDefault();
    setIsLoading(true);
    setError('');
    try {
      await api.post('/auth/forgot-password', { email });
      setMode('reset');
    } catch (err) {
      setError(err.response?.data?.message || 'Failed to send recovery code.');
    } finally {
      setIsLoading(false);
    }
  };

  const handleResetPassword = async (e) => {
    e.preventDefault();
    const otpCode = otp.join('');
    if (otpCode.length !== 6) return setError("Please enter the full 6-digit code.");

    setIsLoading(true);
    setError('');
    try {
      const res = await api.post('/auth/reset-password', { email, otp: otpCode, newPassword });
      localStorage.setItem('userInfo', JSON.stringify(res.data));
      setAuth(true);
      navigate('/');
    } catch (err) {
      setError(err.response?.data?.message || 'Invalid or expired code.');
    } finally {
      setIsLoading(false);
    }
  };

  const handleOtpChange = (element, index) => {
    if (isNaN(element.value)) return;
    setOtp([...otp.map((d, idx) => (idx === index ? element.value : d))]);
    if (element.nextSibling && element.value) element.nextSibling.focus();
  };

  const handleOtpKeyDown = (e, index) => {
    if (e.key === 'Backspace' && !otp[index] && e.target.previousSibling) {
      e.target.previousSibling.focus();
    }
  };

  return (
    <div className="flex min-h-screen bg-white font-sans text-zinc-900 selection:bg-zinc-200">
      
      <div className="hidden lg:flex lg:w-1/2 bg-zinc-950 flex-col justify-between p-14 relative overflow-hidden">
        <div className="absolute inset-0 opacity-20 bg-[url('data:image/svg+xml;base64,PHN2ZyB3aWR0aD0iMjAiIGhlaWdodD0iMjAiIHhtbG5zPSJodHRwOi8vd3d3LnczLm9yZy8yMDAwL3N2ZyI+PGNpcmNsZSBjeD0iMiIgY3k9IjIiIHI9IjEiIGZpbGw9InJnYmEoMjU1LDI1NSwyNTUsMSkiLz48L3N2Zz4=')]"></div>
        <div className="absolute -top-40 -right-40 w-96 h-96 bg-zinc-800 rounded-full blur-3xl opacity-30"></div>
        <div className="absolute -bottom-40 -left-40 w-96 h-96 bg-zinc-800 rounded-full blur-3xl opacity-30"></div>

        <div className="relative z-10">
          <div className="flex items-center gap-3 mb-8">
            <span className="text-white font-black text-2xl tracking-tighter">OAAS.</span>
          </div>
        </div>

        <div className="relative z-10 max-w-md">
          <h2 className="text-4xl font-medium text-white mb-5 tracking-tight leading-tight">
            Organization as a Service.
          </h2>
          <p className="text-zinc-400 text-base leading-relaxed font-medium">
            The enterprise-grade architecture for managing dynamic databases, team workflows, and custom data structures at scale.
          </p>
        </div>
      </div>

      <div className="flex-1 flex flex-col justify-center px-8 sm:px-16 lg:px-24 bg-white relative">
        <div className="w-full max-w-sm mx-auto">
          
          <div className="mb-10">
            <img src="/logo1.png" alt="OAAS Logo" className="h-10 object-contain mb-8" onError={(e) => { e.target.style.display = 'none'; }} />
            <h2 className="text-3xl font-bold text-zinc-900 tracking-tight">
              {mode === 'login' ? 'Welcome back' : mode === 'forgot' ? 'Recover Account' : 'Secure Account'}
            </h2>
            <p className="text-sm text-zinc-500 mt-2 font-medium">
              {mode === 'login' ? 'Enter your credentials to access your workspace.' : 
               mode === 'forgot' ? 'Enter your email to receive a recovery code.' : 
               `Enter the code sent to ${email}`}
            </p>
          </div>

          {error && (
            <div className="mb-6 p-3.5 bg-red-50 border border-red-100 text-red-600 text-sm rounded-xl font-medium flex items-center gap-2">
              <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4 shrink-0" viewBox="0 0 20 20" fill="currentColor"><path fillRule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7 4a1 1 0 11-2 0 1 1 0 012 0zm-1-9a1 1 0 00-1 1v4a1 1 0 102 0V6a1 1 0 00-1-1z" clipRule="evenodd" /></svg>
              {error}
            </div>
          )}

          {/* STANDARD LOGIN */}
          {mode === 'login' && (
            <form onSubmit={handleLogin} className="space-y-5">
              <div>
                <label className="block text-[11px] font-bold text-zinc-400 uppercase tracking-widest mb-2">Email Address</label>
                <input type="email" required value={email} onChange={(e) => setEmail(e.target.value)} className="w-full px-4 py-3.5 text-sm border border-zinc-200 rounded-xl outline-none focus:border-zinc-400 focus:ring-4 focus:ring-zinc-500/10 transition-all bg-zinc-50 hover:bg-zinc-100 focus:bg-white text-zinc-900 font-medium placeholder-zinc-400" placeholder="name@company.com" />
              </div>
              
              <div>
                <label className="block text-[11px] font-bold text-zinc-400 uppercase tracking-widest mb-2">Password</label>
                <div className="relative">
                  <input 
                    type={showPassword ? "text" : "password"} 
                    required 
                    value={password} 
                    onChange={(e) => setPassword(e.target.value)} 
                    className="w-full px-4 py-3.5 pr-12 text-sm border border-zinc-200 rounded-xl outline-none focus:border-zinc-400 focus:ring-4 focus:ring-zinc-500/10 transition-all bg-zinc-50 hover:bg-zinc-100 focus:bg-white text-zinc-900 font-medium placeholder-zinc-400" 
                    placeholder="••••••••" 
                  />
                  <button 
                    type="button" 
                    onClick={() => setShowPassword(!showPassword)} 
                    className="absolute right-4 top-1/2 -translate-y-1/2 text-zinc-400 hover:text-zinc-600 transition-colors"
                  >
                    {showPassword ? (
                      <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13.875 18.825A10.05 10.05 0 0112 19c-4.478 0-8.268-2.943-9.543-7a9.97 9.97 0 011.563-3.029m5.858.908a3 3 0 114.243 4.243M9.878 9.878l4.242 4.242M9.88 9.88l-3.29-3.29m7.532 7.532l3.29 3.29M3 3l3.59 3.59m0 0A9.953 9.953 0 0112 5c4.478 0 8.268 2.943 9.543 7a10.025 10.025 0 01-4.132 5.411m0 0L21 21" /></svg>
                    ) : (
                      <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" /><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" /></svg>
                    )}
                  </button>
                </div>
                
                {/* Forgot Password Link moved BELOW the input */}
                <div className="flex justify-end mt-2">
                  <button type="button" onClick={() => { setMode('forgot'); setError(''); }} className="text-[11px] font-bold text-zinc-500 hover:text-zinc-900 transition-colors uppercase tracking-wider">
                    Forgot Password?
                  </button>
                </div>
              </div>

              <button type="submit" disabled={isLoading} className="w-full bg-zinc-900 text-white py-3.5 rounded-xl text-sm font-semibold hover:bg-zinc-800 transition-all disabled:opacity-50 mt-4 shadow-md flex justify-center items-center gap-2">
                {isLoading ? <svg className="animate-spin h-4 w-4 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24"><circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle><path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path></svg> : 'Sign In'}
              </button>
            </form>
          )}

          {/* FORGOT PASSWORD REQUEST */}
          {mode === 'forgot' && (
            <form onSubmit={handleForgotPassword} className="space-y-5">
              <div>
                <label className="block text-[11px] font-bold text-zinc-400 uppercase tracking-widest mb-2">Work Email</label>
                <input type="email" required value={email} onChange={(e) => setEmail(e.target.value)} className="w-full px-4 py-3.5 text-sm border border-zinc-200 rounded-xl outline-none focus:border-zinc-400 transition-all bg-zinc-50 focus:bg-white" placeholder="name@company.com" />
              </div>
              <button type="submit" disabled={isLoading} className="w-full bg-zinc-900 text-white py-3.5 rounded-xl text-sm font-semibold hover:bg-zinc-800 transition-all disabled:opacity-50 mt-4 shadow-md">
                {isLoading ? 'Sending...' : 'Send Recovery Code'}
              </button>
              <button type="button" onClick={() => setMode('login')} className="w-full text-sm font-semibold text-zinc-500 hover:text-zinc-900 mt-4">
                ← Back to Login
              </button>
            </form>
          )}

          {/* RESET PASSWORD OTP */}
          {mode === 'reset' && (
            <form onSubmit={handleResetPassword} className="space-y-6">
              <div className="flex justify-between gap-2">
                {otp.map((data, index) => (
                  <input
                    key={index} type="text" maxLength="1" value={data}
                    onChange={e => handleOtpChange(e.target, index)} onKeyDown={e => handleOtpKeyDown(e, index)} onFocus={e => e.target.select()}
                    className="w-12 h-14 bg-zinc-50 border border-zinc-200 rounded-xl text-center text-xl font-bold text-zinc-900 outline-none focus:border-zinc-400 focus:bg-white transition-all"
                  />
                ))}
              </div>
              <div>
                <label className="block text-[11px] font-bold text-zinc-400 uppercase tracking-widest mb-2">New Password</label>
                <div className="relative">
                  <input 
                    type={showNewPassword ? "text" : "password"} 
                    required minLength={6} 
                    value={newPassword} 
                    onChange={(e) => setNewPassword(e.target.value)} 
                    className="w-full px-4 py-3.5 pr-12 text-sm border border-zinc-200 rounded-xl outline-none focus:border-zinc-400 transition-all bg-zinc-50 focus:bg-white" 
                    placeholder="Enter new secure password" 
                  />
                  <button 
                    type="button" 
                    onClick={() => setShowNewPassword(!showNewPassword)} 
                    className="absolute right-4 top-1/2 -translate-y-1/2 text-zinc-400 hover:text-zinc-600 transition-colors"
                  >
                    {showNewPassword ? (
                      <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13.875 18.825A10.05 10.05 0 0112 19c-4.478 0-8.268-2.943-9.543-7a9.97 9.97 0 011.563-3.029m5.858.908a3 3 0 114.243 4.243M9.878 9.878l4.242 4.242M9.88 9.88l-3.29-3.29m7.532 7.532l3.29 3.29M3 3l3.59 3.59m0 0A9.953 9.953 0 0112 5c4.478 0 8.268 2.943 9.543 7a10.025 10.025 0 01-4.132 5.411m0 0L21 21" /></svg>
                    ) : (
                      <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" /><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" /></svg>
                    )}
                  </button>
                </div>
              </div>
              <button type="submit" disabled={isLoading || otp.join('').length !== 6} className="w-full bg-zinc-900 text-white py-3.5 rounded-xl text-sm font-semibold hover:bg-zinc-800 transition-all disabled:opacity-50 mt-4 shadow-md">
                {isLoading ? 'Resetting...' : 'Reset & Login'}
              </button>
            </form>
          )}

          {mode === 'login' && (
            <p className="mt-10 text-center text-sm text-zinc-500 font-medium">
              Don't have an account?{' '}
              <Link to="/signup" className="font-bold text-zinc-900 hover:text-zinc-600 transition-colors">
                Create an account
              </Link>
            </p>
          )}
          
        </div>
      </div>
    </div>
  );
}