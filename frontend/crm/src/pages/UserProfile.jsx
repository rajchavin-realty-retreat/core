// frontend/src/pages/UserProfile.jsx
import { useState, useEffect } from 'react';
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

  // Security State
  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [isUpdatingPassword, setIsUpdatingPassword] = useState(false);

  const handleProfileUpdate = async (e) => {
    e.preventDefault();
    setIsUpdatingProfile(true);
    try {
      const res = await api.put('/users/profile', { name, email });
      
      // Update local storage so the rest of the app knows the new name
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

  const handlePasswordUpdate = async (e) => {
    e.preventDefault();
    if (newPassword !== confirmPassword) {
      return alert("New passwords do not match.");
    }
    if (newPassword.length < 6) {
      return alert("Password must be at least 6 characters long.");
    }

    setIsUpdatingPassword(true);
    try {
      await api.put('/users/password', { currentPassword, newPassword });
      alert('Password successfully updated!');
      setCurrentPassword('');
      setNewPassword('');
      setConfirmPassword('');
    } catch (error) {
      alert(error.response?.data?.message || 'Failed to update password');
    } finally {
      setIsUpdatingPassword(false);
    }
  };

  return (
    <div className="min-h-screen bg-[#FBFBFC] text-zinc-900 font-sans flex flex-col">
      {/* Header */}
      <header className="h-14 border-b border-zinc-200 bg-white flex items-center px-4 sm:px-6 shrink-0 sticky top-0 z-10 shadow-sm">
        <button onClick={() => navigate(-1)} className="flex items-center gap-1.5 text-xs font-semibold text-zinc-500 hover:text-zinc-900 transition-colors uppercase tracking-wider">
          <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 19l-7-7m0 0l7-7m-7 7h18" /></svg>
          Back
        </button>
        <div className="h-4 w-px bg-zinc-300 mx-4"></div>
        <h1 className="text-sm font-bold text-zinc-800">Your Profile Settings</h1>
      </header>

      <main className="flex-1 max-w-5xl w-full mx-auto p-4 sm:p-8 flex flex-col md:flex-row gap-8 items-start mt-4">
        
        {/* Left Navigation Sidebar */}
        <div className="w-full md:w-64 shrink-0 flex flex-col gap-1">
          <div className="px-3 pb-3 mb-2 border-b border-zinc-200 flex items-center gap-3">
            <div className="h-10 w-10 rounded-full bg-indigo-100 text-indigo-700 flex items-center justify-center font-bold text-lg border-2 border-white shadow-sm">
              {name ? name.charAt(0).toUpperCase() : 'U'}
            </div>
            <div>
              <h2 className="text-sm font-bold text-zinc-900 truncate max-w-[150px]">{name}</h2>
              <p className="text-xs text-zinc-500 truncate max-w-[150px]">{email}</p>
            </div>
          </div>
          
          <button onClick={() => setActiveTab('general')} className={`text-left px-3 py-2 text-sm font-medium rounded-md transition-colors ${activeTab === 'general' ? 'bg-indigo-50 text-indigo-700' : 'text-zinc-600 hover:bg-zinc-100'}`}>
            General Information
          </button>
          <button onClick={() => setActiveTab('security')} className={`text-left px-3 py-2 text-sm font-medium rounded-md transition-colors ${activeTab === 'security' ? 'bg-indigo-50 text-indigo-700' : 'text-zinc-600 hover:bg-zinc-100'}`}>
            Security & Password
          </button>
        </div>

        {/* Right Content Area */}
        <div className="flex-1 w-full bg-white rounded-xl border border-zinc-200 shadow-sm p-6 sm:p-8">
          
          {/* GENERAL INFO TAB */}
          {activeTab === 'general' && (
            <div className="animate-fade-in">
              <h2 className="text-base font-bold text-zinc-900 mb-1">General Information</h2>
              <p className="text-sm text-zinc-500 mb-6">Update your personal details and how we can reach you.</p>

              <form onSubmit={handleProfileUpdate} className="space-y-5 max-w-lg">
                <div>
                  <label className="block text-xs font-semibold text-zinc-500 uppercase tracking-wider mb-1.5">Full Name</label>
                  <input type="text" required value={name} onChange={(e) => setName(e.target.value)} className="w-full px-3 py-2.5 text-sm border border-zinc-200 rounded-md outline-none focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500 transition-all bg-zinc-50 focus:bg-white" />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-zinc-500 uppercase tracking-wider mb-1.5">Email Address</label>
                  <input type="email" required value={email} onChange={(e) => setEmail(e.target.value)} className="w-full px-3 py-2.5 text-sm border border-zinc-200 rounded-md outline-none focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500 transition-all bg-zinc-50 focus:bg-white" />
                </div>
                
                <div className="pt-4 border-t border-zinc-100">
                  <button type="submit" disabled={isUpdatingProfile} className="bg-indigo-600 text-white px-5 py-2.5 rounded-md text-sm font-bold shadow-sm hover:bg-indigo-700 disabled:opacity-50 transition-all">
                    {isUpdatingProfile ? 'Saving Changes...' : 'Save Profile Details'}
                  </button>
                </div>
              </form>
            </div>
          )}

          {/* SECURITY TAB */}
          {activeTab === 'security' && (
            <div className="animate-fade-in">
              <h2 className="text-base font-bold text-zinc-900 mb-1">Security & Password</h2>
              <p className="text-sm text-zinc-500 mb-6">Ensure your account is using a long, random password to stay secure.</p>

              <form onSubmit={handlePasswordUpdate} className="space-y-5 max-w-lg">
                <div>
                  <label className="block text-xs font-semibold text-zinc-500 uppercase tracking-wider mb-1.5">Current Password</label>
                  <input type="password" required placeholder="••••••••" value={currentPassword} onChange={(e) => setCurrentPassword(e.target.value)} className="w-full px-3 py-2.5 text-sm border border-zinc-200 rounded-md outline-none focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500 transition-all bg-zinc-50 focus:bg-white" />
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-xs font-semibold text-zinc-500 uppercase tracking-wider mb-1.5">New Password</label>
                    <input type="password" required placeholder="••••••••" value={newPassword} onChange={(e) => setNewPassword(e.target.value)} className="w-full px-3 py-2.5 text-sm border border-zinc-200 rounded-md outline-none focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500 transition-all bg-zinc-50 focus:bg-white" />
                  </div>
                  <div>
                    <label className="block text-xs font-semibold text-zinc-500 uppercase tracking-wider mb-1.5">Confirm Password</label>
                    <input type="password" required placeholder="••••••••" value={confirmPassword} onChange={(e) => setConfirmPassword(e.target.value)} className="w-full px-3 py-2.5 text-sm border border-zinc-200 rounded-md outline-none focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500 transition-all bg-zinc-50 focus:bg-white" />
                  </div>
                </div>

                {newPassword && newPassword === confirmPassword && (
                  <p className="text-xs text-emerald-600 font-semibold bg-emerald-50 p-2 rounded border border-emerald-100 inline-block">
                    ✓ Passwords match
                  </p>
                )}
                
                <div className="pt-4 border-t border-zinc-100">
                  <button type="submit" disabled={isUpdatingPassword} className="bg-zinc-900 text-white px-5 py-2.5 rounded-md text-sm font-bold shadow-sm hover:bg-black disabled:opacity-50 transition-all">
                    {isUpdatingPassword ? 'Updating Security...' : 'Update Password'}
                  </button>
                </div>
              </form>
            </div>
          )}

        </div>
      </main>
    </div>
  );
}