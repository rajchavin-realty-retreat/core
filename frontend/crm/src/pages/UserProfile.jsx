// frontend/src/pages/UserProfile.jsx
import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import api from '../api/axiosConfig';

export default function UserProfile() {
  const navigate = useNavigate();
  const [activeTab, setActiveTab] = useState('general');
  const [userInfo, setUserInfo] = useState(JSON.parse(localStorage.getItem('userInfo')) || {});
  
  // Profile State
  const [name, setName] = useState(userInfo.name || '');
  const [email, setEmail] = useState(userInfo.email || '');
  const [isUpdatingProfile, setIsUpdatingProfile] = useState(false);

  // Security & OTP State
  const [otpMode, setOtpMode] = useState(false); 
  const [otp, setOtp] = useState(['', '', '', '', '', '']);
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [isProcessingSecurity, setIsProcessingSecurity] = useState(false);
  const [securityMessage, setSecurityMessage] = useState({ type: '', text: '' }); 

  const handleProfileUpdate = async (e) => {
    e.preventDefault();
    setIsUpdatingProfile(true);
    try {
      const res = await api.put('/auth/profile', { name, email });
      
      const updatedUser = { ...userInfo, name: res.data.name, email: res.data.email };
      localStorage.setItem('userInfo', JSON.stringify(updatedUser));
      setUserInfo(updatedUser);
      
      alert('Profile updated successfully!');
    } catch (error) {
      alert(error.response?.data?.message || 'Failed to update profile');
    } finally {
      setIsUpdatingProfile(false);
    }
  };

  // --- STEP 1: Send OTP to User's Email ---
  const handleRequestPasswordChange = async () => {
    setIsProcessingSecurity(true);
    setSecurityMessage({ type: '', text: '' });
    try {
      await api.post('/auth/forgot-password', { email: userInfo.email });
      setOtpMode(true);
      setSecurityMessage({ type: 'success', text: `Verification code sent to ${userInfo.email}` });
    } catch (error) {
      setSecurityMessage({ type: 'error', text: error.response?.data?.message || 'Failed to send code.' });
    } finally {
      setIsProcessingSecurity(false);
    }
  };

  // --- STEP 2: Verify OTP and Set New Password ---
  const handlePasswordUpdate = async (e) => {
    e.preventDefault();
    const otpCode = otp.join('');
    
    if (otpCode.length !== 6) return setSecurityMessage({ type: 'error', text: 'Please enter the full 6-digit code.' });
    if (newPassword !== confirmPassword) return setSecurityMessage({ type: 'error', text: 'New passwords do not match.' });
    if (newPassword.length < 6) return setSecurityMessage({ type: 'error', text: 'Password must be at least 6 characters.' });

    setIsProcessingSecurity(true);
    setSecurityMessage({ type: '', text: '' });
    
    try {
      await api.post('/auth/reset-password', { 
        email: userInfo.email, 
        otp: otpCode, 
        newPassword 
      });
      
      setSecurityMessage({ type: 'success', text: 'Password successfully updated!' });
      setOtpMode(false);
      setOtp(['', '', '', '', '', '']);
      setNewPassword('');
      setConfirmPassword('');
    } catch (error) {
      setSecurityMessage({ type: 'error', text: error.response?.data?.message || 'Invalid or expired code.' });
    } finally {
      setIsProcessingSecurity(false);
    }
  };

  // --- OTP Input Handlers ---
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

  const handleLogout = () => {
    localStorage.removeItem('userInfo');
    localStorage.removeItem('token');
    window.location.href = '/login';
  };

  return (
    <div className="min-h-screen bg-[#FBFBFC] text-zinc-800 font-sans flex flex-col overflow-x-hidden">
      {/* Header */}
      <header className="h-14 border-b border-zinc-200 bg-white flex items-center px-4 sm:px-6 shrink-0 sticky top-0 z-10 shadow-sm">
        <button onClick={() => navigate(-1)} className="flex items-center gap-1.5 text-xs font-semibold text-zinc-500 hover:text-zinc-800 transition-colors uppercase tracking-wider">
          <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 19l-7-7m0 0l7-7m-7 7h18" /></svg>
          Back
        </button>
        <div className="h-4 w-px bg-zinc-300 mx-4"></div>
        <h1 className="text-sm font-semibold text-zinc-700 tracking-tight">Your Profile Settings</h1>
      </header>

      <main className="flex-1 max-w-5xl w-full mx-auto p-4 sm:p-8 flex flex-col md:flex-row gap-6 md:gap-8 items-start mt-2 sm:mt-4">
        
        {/* Left Navigation Sidebar */}
        <div className="w-full md:w-56 lg:w-64 shrink-0 flex flex-col gap-4 md:gap-1">
          
          <div className="px-1 md:px-3 pb-0 md:pb-3 md:mb-2 md:border-b border-zinc-200 flex items-center gap-3">
            <div className="h-12 w-12 rounded-full bg-indigo-50 text-indigo-600 flex items-center justify-center font-semibold text-lg border border-indigo-100 shadow-sm shrink-0">
              {name ? name.charAt(0).toUpperCase() : 'U'}
            </div>
            <div className="min-w-0">
              <h2 className="text-sm font-semibold text-zinc-800 tracking-tight truncate">{name}</h2>
              <p className="text-xs text-zinc-500 truncate">{email}</p>
            </div>
          </div>
          
          <div className="flex flex-row md:flex-col gap-1 overflow-x-auto no-scrollbar border-b md:border-none border-zinc-200 pb-3 md:pb-0">
            <button 
              onClick={() => setActiveTab('general')} 
              className={`shrink-0 text-left px-3 py-2 text-sm font-medium rounded-md transition-colors ${activeTab === 'general' ? 'bg-indigo-50 text-indigo-700' : 'text-zinc-500 hover:text-zinc-800 hover:bg-zinc-100'}`}
            >
              General Information
            </button>
            <button 
              onClick={() => { setActiveTab('security'); setSecurityMessage({type: '', text: ''}); }} 
              className={`shrink-0 text-left px-3 py-2 text-sm font-medium rounded-md transition-colors ${activeTab === 'security' ? 'bg-indigo-50 text-indigo-700' : 'text-zinc-500 hover:text-zinc-800 hover:bg-zinc-100'}`}
            >
              Security & Password
            </button>

            <div className="hidden md:block mt-3 pt-3 border-t border-zinc-200"></div>

            <button 
              onClick={handleLogout} 
              className="shrink-0 text-left flex items-center gap-2 px-3 py-2 text-sm font-medium text-red-500 rounded-md transition-colors hover:text-red-700 hover:bg-red-50"
            >
              <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1" />
              </svg>
              Sign Out
            </button>
          </div>
        </div>

        {/* Right Content Area */}
        <div className="flex-1 w-full bg-white rounded-xl border border-zinc-200 shadow-sm p-5 sm:p-8">
          
          {/* --- THE FIX: SECURE GENERAL INFO TAB --- */}
          {activeTab === 'general' && (
            <div className="animate-fade-in">
              <h2 className="text-lg font-semibold tracking-tight text-zinc-800 mb-1">General Information</h2>
              <p className="text-sm text-zinc-500 mb-6">Update your personal details and how we can reach you.</p>

              <form onSubmit={handleProfileUpdate} className="space-y-5 max-w-lg">
                <div>
                  <label className="block text-[11px] font-semibold text-zinc-400 uppercase tracking-widest mb-1.5">Full Name</label>
                  <input type="text" required value={name} onChange={(e) => setName(e.target.value)} className="w-full px-4 py-3 text-sm border border-zinc-200 rounded-xl outline-none focus:border-indigo-400 focus:ring-4 focus:ring-indigo-500/10 transition-all bg-transparent hover:bg-zinc-50 focus:bg-white text-zinc-800 font-medium" />
                </div>
                
                {/* LOCKED EMAIL FIELD */}
                <div>
                  <div className="flex justify-between items-center mb-1.5">
                    <label className="block text-[11px] font-semibold text-zinc-400 uppercase tracking-widest">Email Address</label>
                    <span className="text-[10px] font-bold text-emerald-600 uppercase tracking-widest bg-emerald-50 px-2 py-0.5 rounded border border-emerald-100 flex items-center gap-1">
                      <svg xmlns="http://www.w3.org/2000/svg" className="h-3 w-3" viewBox="0 0 20 20" fill="currentColor"><path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" /></svg>
                      Verified
                    </span>
                  </div>
                  <input 
                    type="email" 
                    disabled 
                    value={email} 
                    className="w-full px-4 py-3 text-sm border border-zinc-200 rounded-xl outline-none bg-zinc-50 text-zinc-500 font-medium cursor-not-allowed opacity-80" 
                  />
                  <p className="text-[10px] font-medium text-zinc-400 mt-2 leading-relaxed">
                    Your email is cryptographically tied to your workspace security identity. To change it, please contact your workspace administrator or support.
                  </p>
                </div>
                
                <div className="pt-4 border-t border-zinc-100">
                  <button 
                    type="submit" 
                    disabled={isUpdatingProfile || name === userInfo.name} 
                    className="bg-indigo-600 text-white px-6 py-2.5 rounded-xl text-sm font-semibold shadow-sm hover:bg-indigo-700 disabled:opacity-50 transition-colors w-full sm:w-auto"
                  >
                    {isUpdatingProfile ? 'Saving Changes...' : 'Save Profile Details'}
                  </button>
                </div>
              </form>
            </div>
          )}

          {/* SECURITY TAB */}
          {activeTab === 'security' && (
            <div className="animate-fade-in max-w-lg">
              <h2 className="text-lg font-semibold tracking-tight text-zinc-800 mb-1">Security & Password</h2>
              <p className="text-sm text-zinc-500 mb-6">Update your password using a secure verification code sent to your email.</p>

              {securityMessage.text && (
                <div className={`mb-6 p-3.5 text-sm rounded-xl font-medium flex items-start gap-2 ${securityMessage.type === 'error' ? 'bg-red-50 border border-red-100 text-red-600' : 'bg-emerald-50 border border-emerald-100 text-emerald-700'}`}>
                  <span>{securityMessage.text}</span>
                </div>
              )}

              {!otpMode ? (
                <div className="bg-zinc-50 border border-zinc-200 rounded-xl p-6">
                  <h3 className="text-sm font-bold text-zinc-800 mb-2">Change Password</h3>
                  <p className="text-xs text-zinc-500 mb-5 leading-relaxed">
                    For your security, we no longer ask for your current password. Instead, we will send a temporary code to <strong className="text-zinc-700">{userInfo.email}</strong>.
                  </p>
                  <button 
                    onClick={handleRequestPasswordChange} 
                    disabled={isProcessingSecurity} 
                    className="bg-zinc-900 text-white px-5 py-2.5 rounded-xl text-sm font-semibold shadow-sm hover:bg-zinc-800 disabled:opacity-50 transition-colors w-full sm:w-auto"
                  >
                    {isProcessingSecurity ? 'Sending Code...' : 'Send Verification Code'}
                  </button>
                </div>
              ) : (
                <form onSubmit={handlePasswordUpdate} className="space-y-6 bg-white border border-indigo-100 shadow-[0_0_15px_rgba(79,70,229,0.05)] rounded-xl p-6">
                  
                  <div>
                    <label className="block text-[11px] font-semibold text-zinc-400 uppercase tracking-widest mb-3">Verification Code</label>
                    <div className="flex gap-2">
                      {otp.map((data, index) => (
                        <input
                          key={index} type="text" maxLength="1" value={data}
                          onChange={e => handleOtpChange(e.target, index)} onKeyDown={e => handleOtpKeyDown(e, index)} onFocus={e => e.target.select()}
                          className="w-10 h-12 sm:w-12 sm:h-14 bg-zinc-50 border border-zinc-200 rounded-xl text-center text-xl font-bold text-zinc-900 outline-none focus:border-indigo-400 focus:bg-white focus:ring-4 focus:ring-indigo-500/10 transition-all"
                        />
                      ))}
                    </div>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-5">
                    <div>
                      <label className="block text-[11px] font-semibold text-zinc-400 uppercase tracking-widest mb-1.5">New Password</label>
                      <input type="password" required placeholder="••••••••" value={newPassword} onChange={(e) => setNewPassword(e.target.value)} className="w-full px-4 py-3 text-sm border border-zinc-200 rounded-xl outline-none focus:border-indigo-400 focus:ring-4 focus:ring-indigo-500/10 transition-all bg-transparent hover:bg-zinc-50 focus:bg-white text-zinc-800 font-medium" />
                    </div>
                    <div>
                      <label className="block text-[11px] font-semibold text-zinc-400 uppercase tracking-widest mb-1.5">Confirm Password</label>
                      <input type="password" required placeholder="••••••••" value={confirmPassword} onChange={(e) => setConfirmPassword(e.target.value)} className="w-full px-4 py-3 text-sm border border-zinc-200 rounded-xl outline-none focus:border-indigo-400 focus:ring-4 focus:ring-indigo-500/10 transition-all bg-transparent hover:bg-zinc-50 focus:bg-white text-zinc-800 font-medium" />
                    </div>
                  </div>

                  {newPassword && newPassword === confirmPassword && (
                    <p className="text-[11px] text-emerald-600 font-bold tracking-widest uppercase bg-emerald-50 py-1.5 px-3 rounded-lg border border-emerald-100 inline-block">
                      ✓ Passwords match
                    </p>
                  )}
                  
                  <div className="pt-2 flex flex-col sm:flex-row gap-3 border-t border-zinc-100">
                    <button type="button" onClick={() => { setOtpMode(false); setSecurityMessage({type:'', text:''}); setOtp(['','','','','','']); }} className="bg-white border border-zinc-200 text-zinc-600 px-5 py-2.5 rounded-xl text-sm font-semibold hover:bg-zinc-50 transition-colors w-full sm:w-auto text-center">
                      Cancel
                    </button>
                    <button type="submit" disabled={isProcessingSecurity} className="bg-indigo-600 text-white px-5 py-2.5 rounded-xl text-sm font-semibold shadow-sm hover:bg-indigo-700 disabled:opacity-50 transition-colors w-full sm:w-auto">
                      {isProcessingSecurity ? 'Verifying...' : 'Set New Password'}
                    </button>
                  </div>
                </form>
              )}
            </div>
          )}

        </div>
      </main>
    </div>
  );
}