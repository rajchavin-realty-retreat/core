import { useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import api from './api/axiosConfig';

export default function Login({ setAuth }) {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const navigate = useNavigate();

  const handleLogin = async (e) => {
    e.preventDefault();
    setIsLoading(true);
    setError('');
    try {
      const res = await api.post('/users/login', { email, password });
      localStorage.setItem('userInfo', JSON.stringify(res.data));
      
      setAuth(true); 
      
      navigate('/');
    } catch (err) {
      setError(err.response?.data?.message || 'Invalid credentials');
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="flex min-h-screen bg-white font-sans text-zinc-900 selection:bg-zinc-200">
      
      {/* --- LEFT PANE (Premium Visual Branding) --- */}
      <div className="hidden lg:flex lg:w-1/2 bg-zinc-950 flex-col justify-between p-14 relative overflow-hidden">
        
        {/* Abstract Ambient Background */}
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

      {/* --- RIGHT PANE (The Form) --- */}
      <div className="flex-1 flex flex-col justify-center px-8 sm:px-16 lg:px-24 bg-white relative">
        <div className="w-full max-w-sm mx-auto">
          
          {/* Logo & Header */}
          <div className="mb-10">
            <img 
              src="/logo1.png" 
              alt="OAAS Logo" 
              className="h-10 object-contain mb-8"
              onError={(e) => { e.target.style.display = 'none'; }} 
            />
            <h2 className="text-3xl font-bold text-zinc-900 tracking-tight">Welcome back</h2>
            <p className="text-sm text-zinc-500 mt-2 font-medium">Enter your credentials to access your workspace.</p>
          </div>

          {error && (
            <div className="mb-6 p-3.5 bg-red-50 border border-red-100 text-red-600 text-sm rounded-xl font-medium flex items-center gap-2">
              <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4 shrink-0" viewBox="0 0 20 20" fill="currentColor"><path fillRule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7 4a1 1 0 11-2 0 1 1 0 012 0zm-1-9a1 1 0 00-1 1v4a1 1 0 102 0V6a1 1 0 00-1-1z" clipRule="evenodd" /></svg>
              {error}
            </div>
          )}

          <form onSubmit={handleLogin} className="space-y-5">
            <div>
              <label className="block text-[11px] font-bold text-zinc-400 uppercase tracking-widest mb-2">Email Address</label>
              <input 
                type="email" 
                required 
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className="w-full px-4 py-3.5 text-sm border border-zinc-200 rounded-xl outline-none focus:border-zinc-400 focus:ring-4 focus:ring-zinc-500/10 transition-all bg-zinc-50 hover:bg-zinc-100 focus:bg-white text-zinc-900 font-medium placeholder-zinc-400"
                placeholder="name@company.com"
              />
            </div>
            
            <div>
              <div className="flex justify-between items-center mb-2">
                <label className="block text-[11px] font-bold text-zinc-400 uppercase tracking-widest">Password</label>
                <a href="#" className="text-[11px] font-bold text-zinc-500 hover:text-zinc-900 transition-colors uppercase tracking-wider">Forgot?</a>
              </div>
              <input 
                type="password" 
                required 
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="w-full px-4 py-3.5 text-sm border border-zinc-200 rounded-xl outline-none focus:border-zinc-400 focus:ring-4 focus:ring-zinc-500/10 transition-all bg-zinc-50 hover:bg-zinc-100 focus:bg-white text-zinc-900 font-medium placeholder-zinc-400"
                placeholder="••••••••"
              />
            </div>

            <button 
              type="submit" 
              disabled={isLoading}
              className="w-full bg-zinc-900 text-white py-3.5 rounded-xl text-sm font-semibold hover:bg-zinc-800 transition-all disabled:opacity-50 mt-4 shadow-md hover:shadow-lg flex justify-center items-center gap-2"
            >
              {isLoading ? (
                <>
                  <svg className="animate-spin h-4 w-4 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24"><circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle><path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path></svg>
                  Authenticating...
                </>
              ) : 'Sign In'}
            </button>
          </form>

          <p className="mt-10 text-center text-sm text-zinc-500 font-medium">
            Don't have an account?{' '}
            <Link to="/signup" className="font-bold text-zinc-900 hover:text-zinc-600 transition-colors">
              Create an account
            </Link>
          </p>
          
        </div>
      </div>
    </div>
  );
}