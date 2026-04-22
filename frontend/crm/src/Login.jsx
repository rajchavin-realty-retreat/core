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
      
      setAuth(true); // <-- FLIP THE MASTER SWITCH!
      
      navigate('/');
    } catch (err) {
      setError(err.response?.data?.message || 'Invalid credentials');
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="flex min-h-screen bg-white font-sans text-zinc-900">
      
      {/* --- LEFT PANE (Visual Branding) --- */}
      {/* Hidden on mobile, takes up half the screen on desktop */}
      <div className="hidden lg:flex lg:w-1/2 bg-zinc-900 flex-col justify-between p-12 relative overflow-hidden">
        
        {/* Subtle dot pattern background */}
        <div className="absolute inset-0 opacity-20 bg-[url('data:image/svg+xml;base64,PHN2ZyB3aWR0aD0iMjAiIGhlaWdodD0iMjAiIHhtbG5zPSJodHRwOi8vd3d3LnczLm9yZy8yMDAwL3N2ZyI+PGNpcmNsZSBjeD0iMiIgY3k9IjIiIHI9IjEiIGZpbGw9InJnYmEoMjU1LDI1NSwyNTUsMSkiLz48L3N2Zz4=')]"></div>
        
        <div className="relative z-10">
          <div className="flex items-center gap-3 mb-8">
            <div className="w-8 h-8 bg-indigo-500 rounded-md flex items-center justify-center shadow-lg">
              <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 7v10c0 2.21 3.582 4 8 4s8-1.79 8-4V7M4 7c0 2.21 3.582 4 8 4s8-1.79 8-4M4 7c0-2.21 3.582-4 8-4s8 1.79 8 4m0 5c0 2.21-3.582 4-8 4s-8-1.79-8-4" /></svg>
            </div>
            <span className="text-white font-bold text-xl tracking-tight">Rajchavin CRM</span>
          </div>
        </div>

        <div className="relative z-10 max-w-md">
          <h2 className="text-3xl font-bold text-white mb-4">Build your architecture.</h2>
          <p className="text-zinc-400 text-sm leading-relaxed">
            The enterprise-grade platform for managing dynamic databases, team workflows, and custom data schemas at scale.
          </p>
        </div>
      </div>

      {/* --- RIGHT PANE (The Form) --- */}
      <div className="flex-1 flex flex-col justify-center px-8 sm:px-16 lg:px-24">
        <div className="w-full max-w-sm mx-auto">
          
          <div className="mb-8">
            <h2 className="text-2xl font-bold text-zinc-900 tracking-tight">Welcome back</h2>
            <p className="text-sm text-zinc-500 mt-2">Enter your credentials to access your workspace.</p>
          </div>

          {error && (
            <div className="mb-6 p-3 bg-red-50 border border-red-200 text-red-600 text-xs rounded-md font-semibold">
              {error}
            </div>
          )}

          <form onSubmit={handleLogin} className="space-y-5">
            <div>
              <label className="block text-xs font-semibold text-zinc-600 uppercase tracking-wider mb-1.5">Email Address</label>
              <input 
                type="email" 
                required 
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className="w-full px-3 py-2 text-sm border border-zinc-300 rounded-md outline-none focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500 transition-shadow"
                placeholder="name@company.com"
              />
            </div>
            
            <div>
              <div className="flex justify-between items-center mb-1.5">
                <label className="block text-xs font-semibold text-zinc-600 uppercase tracking-wider">Password</label>
                <a href="#" className="text-xs font-semibold text-indigo-600 hover:text-indigo-800">Forgot password?</a>
              </div>
              <input 
                type="password" 
                required 
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="w-full px-3 py-2 text-sm border border-zinc-300 rounded-md outline-none focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500 transition-shadow"
                placeholder="••••••••"
              />
            </div>

            <button 
              type="submit" 
              disabled={isLoading}
              className="w-full bg-zinc-900 text-white py-2.5 rounded-md text-sm font-semibold hover:bg-zinc-800 transition-colors disabled:opacity-50 mt-2 shadow-sm"
            >
              {isLoading ? 'Signing in...' : 'Sign In'}
            </button>
          </form>

          <p className="mt-8 text-center text-sm text-zinc-500">
            Don't have an account?{' '}
            <Link to="/signup" className="font-semibold text-indigo-600 hover:text-indigo-800">
              Create an account
            </Link>
          </p>
          
        </div>
      </div>
    </div>
  );
}