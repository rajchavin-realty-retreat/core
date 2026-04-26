import React from 'react';

export default function Sidebar({
  isMobileMenuOpen, setIsMobileMenuOpen, handleLogout,
  pendingWorkspaces, handleInviteResponse,
  activeOrAcceptedWorkspaces, activeWorkspace, selectWorkspace,
  isOwner, setIsSettingsOpen, handleCreateWorkspace,
  newWorkspaceName, setNewWorkspaceName, canManageTeam,
  handleInvite, inviteEmail, setInviteEmail, inviteRole, setInviteRole, isInviting,
  setSelectedMember, setActiveTab, activeTab,
  handleRemoveMember,
  entities, 
  handleOpenDatabaseTab, 
  activeDbId
}) {
  
  const userInfo = JSON.parse(localStorage.getItem('userInfo'));

  return (
    <aside className={`fixed inset-y-0 left-0 z-50 w-64 bg-zinc-50 border-r border-zinc-200 flex flex-col flex-shrink-0 transform transition-transform duration-300 ease-in-out lg:relative lg:translate-x-0 ${isMobileMenuOpen ? 'translate-x-0' : '-translate-x-full'}`}>
      
      {/* --- BRANDING HEADER WITH LOGO --- */}
      <div className="h-14 flex items-center px-4 border-b border-zinc-200 justify-between">
        <div className="flex items-center gap-2.5">
          <img 
            src="/logo1.png" 
            alt="Lazy Link Logo" 
            className="h-7 w-50 object-contain rounded-md"
            onError={(e) => { e.target.style.display = 'none'; }} 
          />
        </div>
        
        <div className="flex items-center gap-2">
          {/* PROPER CIRCULAR PROFILE SYMBOL AT THE TOP */}
          <button 
            onClick={() => window.location.href = '/profile'} // Or handle a dropdown menu if you build one
            className="h-7 w-7 rounded-full bg-indigo-100 flex items-center justify-center text-indigo-700 hover:bg-indigo-200 hover:text-indigo-900 transition-colors overflow-hidden border border-indigo-200 shadow-sm"
            title="Profile & Account"
          >
            {userInfo?.name ? (
               <span className="text-xs font-bold">{userInfo.name.charAt(0).toUpperCase()}</span>
            ) : (
              <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" viewBox="0 0 20 20" fill="currentColor">
                <path fillRule="evenodd" d="M10 9a3 3 0 100-6 3 3 0 000 6zm-7 9a7 7 0 1114 0H3z" clipRule="evenodd" />
              </svg>
            )}
          </button>
          
          <button onClick={() => setIsMobileMenuOpen(false)} className="lg:hidden text-zinc-400 hover:text-zinc-600">
            <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" viewBox="0 0 20 20" fill="currentColor"><path fillRule="evenodd" d="M4.293 4.293a1 1 0 011.414 0L10 8.586l4.293-4.293a1 1 0 111.414 1.414L11.414 10l4.293 4.293a1 1 0 01-1.414 1.414L10 11.414l-4.293 4.293a1 1 0 01-1.414-1.414L8.586 10 4.293 5.707a1 1 0 010-1.414z" clipRule="evenodd" /></svg>
          </button>
        </div>
      </div>

      <div className="flex-1 overflow-y-auto p-3 space-y-6">
        
        {/* PENDING INVITES */}
        {pendingWorkspaces.length > 0 && (
          <div>
            <h3 className="text-[11px] font-semibold text-zinc-400 uppercase tracking-wider mb-2 px-2">Invites</h3>
            <div className="space-y-1">
              {pendingWorkspaces.map(ws => (
                <div key={ws._id} className="bg-amber-50/50 border border-amber-200/50 p-2 rounded-md text-xs">
                  <p className="font-medium text-amber-900 truncate">{ws.name}</p>
                  <div className="flex gap-1 mt-2">
                    <button onClick={() => handleInviteResponse(ws._id, 'accepted')} className="flex-1 bg-amber-500 text-white py-1 rounded text-[10px] font-bold">Accept</button>
                    <button onClick={() => handleInviteResponse(ws._id, 'declined')} className="flex-1 bg-white border border-amber-200 text-amber-700 py-1 rounded text-[10px] font-bold">Decline</button>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* WORKSPACES LIST */}
        <div>
          <h3 className="text-[11px] font-semibold text-zinc-400 uppercase tracking-wider mb-2 px-2">Workspaces</h3>
          <ul className="space-y-0.5">
            {activeOrAcceptedWorkspaces.map(ws => (
              <li key={ws._id} onClick={() => selectWorkspace(ws)} className={`px-2 py-1.5 rounded-md cursor-pointer text-sm transition-colors flex items-center justify-between ${activeWorkspace?._id === ws._id ? 'bg-zinc-200/50 text-zinc-900 font-medium' : 'text-zinc-600 hover:bg-zinc-100 hover:text-zinc-900'}`}>
                <span className="truncate">{ws.name}</span>
                
                {/* --- RESTORED: WORKSPACE GEAR ICON --- */}
                {activeWorkspace?._id === ws._id && isOwner && (
                  <button onClick={(e) => { e.stopPropagation(); setIsSettingsOpen(true); }} className="text-zinc-400 hover:text-zinc-800 p-1">
                    <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" viewBox="0 0 20 20" fill="currentColor"><path fillRule="evenodd" d="M11.49 3.17c-.38-1.56-2.6-1.56-2.98 0a1.532 1.532 0 01-2.286.948c-1.372-.836-2.942.734-2.106 2.106.54.886.061 2.042-.947 2.287-1.561.379-1.561 2.6 0 2.978a1.532 1.532 0 01.947 2.287c-.836 1.372.734 2.942 2.106 2.106a1.532 1.532 0 012.287.947c.379 1.561 2.6 1.561 2.978 0a1.533 1.533 0 012.287-.947c1.372.836 2.942-.734 2.106-2.106a1.533 1.533 0 01.947-2.287c1.561-.379 1.561-2.6 0-2.978a1.532 1.532 0 01-.947-2.287c.836-1.372-.734-2.942-2.106-2.106a1.532 1.532 0 01-2.287-.947zM10 13a3 3 0 100-6 3 3 0 000 6z" clipRule="evenodd" /></svg>
                  </button>
                )}

              </li>
            ))}
          </ul>
          <form onSubmit={handleCreateWorkspace} className="mt-3 px-2 flex gap-1">
            <input type="text" placeholder="New workspace" required value={newWorkspaceName} onChange={e => setNewWorkspaceName(e.target.value)} className="w-full px-2 py-1 text-xs border border-zinc-200 rounded bg-white outline-none focus:border-zinc-400" />
            <button type="submit" className="bg-zinc-800 text-white px-2 rounded text-xs font-medium hover:bg-zinc-900">+</button>
          </form>
        </div>

        {/* --- PERSONAL STATS QUICK LINK --- */}
        {activeWorkspace && userInfo && (
          <div>
            <h3 className="text-[11px] font-semibold text-zinc-400 uppercase tracking-wider mb-2 px-2">Personal</h3>
            <button 
              onClick={() => { 
                setSelectedMember({ _id: userInfo.id || userInfo._id, name: userInfo.name || 'Me', email: userInfo.email }); 
                setActiveTab('memberStats'); 
                if (window.innerWidth < 1024) setIsMobileMenuOpen(false);
              }} 
              className="w-full flex items-center gap-2 px-2 py-1.5 rounded-md text-sm text-zinc-600 hover:bg-zinc-100 hover:text-zinc-900 transition-colors"
            >
              <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4 text-indigo-500" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" /></svg>
              My Workspace Stats
            </button>
          </div>
        )}

        {/* --- WORKSPACE APPS --- */}
        {activeWorkspace && (
          <div>
            <h3 className="text-[11px] font-semibold text-zinc-400 uppercase tracking-wider mb-2 px-2">Apps</h3>
            
            <button 
              onClick={() => { setActiveTab('calendar'); if (window.innerWidth < 1024) setIsMobileMenuOpen(false); }} 
              className={`w-full flex items-center gap-2 px-2 py-1.5 rounded-md text-sm transition-colors mb-1 ${activeTab === 'calendar' ? 'bg-indigo-50 text-indigo-700 font-bold' : 'text-zinc-600 hover:bg-zinc-100 hover:text-zinc-900'}`}
            >
              <svg xmlns="http://www.w3.org/2000/svg" className={`h-4 w-4 ${activeTab === 'calendar' ? 'text-indigo-600' : 'text-zinc-400'}`} fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" /></svg>
              Lazy Calendar
            </button>

            <button 
              onClick={() => { setActiveTab('tasks'); if (window.innerWidth < 1024) setIsMobileMenuOpen(false); }} 
              className={`w-full flex items-center gap-2 px-2 py-1.5 rounded-md text-sm transition-colors ${activeTab === 'tasks' ? 'bg-indigo-50 text-indigo-700 font-bold' : 'text-zinc-600 hover:bg-zinc-100 hover:text-zinc-900'}`}
            >
              <svg xmlns="http://www.w3.org/2000/svg" className={`h-4 w-4 ${activeTab === 'tasks' ? 'text-indigo-600' : 'text-zinc-400'}`} fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2" /></svg>
              Lazy Tasks
            </button>

            <button 
              onClick={() => { setActiveTab('templates'); if (window.innerWidth < 1024) setIsMobileMenuOpen(false); }} 
              className={`w-full flex items-center gap-2 px-2 py-1.5 rounded-md text-sm transition-colors mb-1 ${activeTab === 'templates' ? 'bg-indigo-50 text-indigo-700 font-bold' : 'text-zinc-600 hover:bg-zinc-100 hover:text-zinc-900'}`}
            >
              <svg xmlns="http://www.w3.org/2000/svg" className={`h-4 w-4 ${activeTab === 'templates' ? 'text-indigo-600' : 'text-zinc-400'}`} fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 11H5m14 0a2 2 0 012 2v6a2 2 0 01-2 2H5a2 2 0 01-2-2v-6a2 2 0 012-2m14 0V9a2 2 0 00-2-2M5 11V9a2 2 0 012-2m0 0V5a2 2 0 012-2h6a2 2 0 012 2v2M7 7h10" /></svg>
              Lazy Templates
            </button>

          </div>
        )}

        {/* --- DIRECT DATABASE ACCESS (THE NOTION TREE) --- */}
        {activeWorkspace && entities.length > 0 && (
          <div className="mt-8 mb-4">
            <div className="flex items-center justify-between px-3 mb-1.5 group cursor-pointer hover:opacity-80 transition-opacity">
              <h3 className="text-[11px] font-bold text-zinc-400 uppercase tracking-widest">Data Modules</h3>
              <svg xmlns="http://www.w3.org/2000/svg" className="h-3 w-3 text-zinc-400" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" /></svg>
            </div>
            
            <div className="space-y-0.5 px-2">
              {entities.map(ent => (
                <button
                  key={ent._id}
                  onClick={() => {
                    handleOpenDatabaseTab(ent);
                    if (window.innerWidth < 1024) setIsMobileMenuOpen(false);
                  }}
                  className={`w-full flex items-center gap-2.5 px-3 py-1.5 rounded-md text-[13px] transition-colors group ${
                    activeTab === 'database-viewer' && activeDbId === ent._id
                      ? 'bg-zinc-200/60 text-zinc-900 font-bold'
                      : 'text-zinc-600 hover:bg-zinc-200/40 font-medium'
                  }`}
                >
                  <svg xmlns="http://www.w3.org/2000/svg" className={`h-4 w-4 shrink-0 ${activeTab === 'database-viewer' && activeDbId === ent._id ? 'text-indigo-600' : 'text-zinc-400 group-hover:text-zinc-600 transition-colors'}`} fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 7v10c0 2.21 3.582 4 8 4s8-1.79 8-4V7M4 7c0 2.21 3.582 4 8 4s8-1.79 8-4M4 7c0-2.21 3.582-4 8-4s8 1.79 8 4m0 5c0 2.21-3.582 4-8 4s-8-1.79-8-4" /></svg>
                  <span className="truncate">{ent.name}</span>
                </button>
              ))}
            </div>
          </div>
        )}

        {/* TEAM DIRECTORY */}
        {activeWorkspace && canManageTeam && (
          <div>
            <h3 className="text-[11px] font-semibold text-zinc-400 uppercase tracking-wider mb-2 px-2">Team Directory</h3>
            {(!activeWorkspace.customRoles || activeWorkspace.customRoles.length === 0) ? (
              <div className="px-2 text-[10px] text-amber-600 mb-3 bg-amber-50 p-2 rounded border border-amber-200">
                You must create a Custom Role in Workspace Settings before inviting team members.
              </div>
            ) : (
              <form onSubmit={handleInvite} className="px-2 space-y-1 mb-3">
                <input type="email" placeholder="Email address" required value={inviteEmail} onChange={(e) => setInviteEmail(e.target.value)} className="w-full px-2 py-1.5 text-xs border border-zinc-200 rounded bg-white outline-none focus:border-zinc-400" />
                <div className="flex gap-1">
                  <select required value={inviteRole} onChange={(e) => setInviteRole(e.target.value)} className="flex-1 px-1 py-1 text-xs border border-zinc-200 rounded bg-white outline-none">
                    <option value="">Select Role...</option>
                    {activeWorkspace.customRoles.map(role => <option key={role._id} value={role._id}>{role.name}</option>)}
                  </select>
                  <button type="submit" disabled={isInviting} className="bg-zinc-100 text-zinc-700 border border-zinc-200 px-3 py-1 rounded text-xs font-medium hover:bg-zinc-200 transition-colors disabled:opacity-50">Invite</button>
                </div>
              </form>
            )}
            <ul className="space-y-1 px-2 text-xs">
              {activeWorkspace.members.map((m, i) => {
                const assignedRole = activeWorkspace.customRoles?.find(r => String(r._id) === String(m.roleId));
                const isCurrentUser = String(m.user?._id) === String(userInfo?.id || userInfo?._id);

                return (
                  <li key={i} className="flex justify-between items-center py-1.5 group">
                    <div className="truncate flex-1">
                      <span className="text-zinc-700 font-medium">{m.user?.name || m.user?.email || 'Pending'}</span>
                      {m.status === 'pending' && <span className="ml-1 text-[9px] text-amber-600 bg-amber-50 px-1 rounded border border-amber-100">Pending</span>}
                    </div>
                    <div className="flex items-center gap-1">
                      <span className="text-[9px] text-zinc-500 uppercase font-semibold border border-zinc-200 px-1.5 py-0.5 rounded bg-white">
                        {assignedRole ? assignedRole.name : 'Unknown'}
                      </span>
                      
                      {/* ADMIN STATS BUTTON */}
                      {m.status === 'accepted' && setSelectedMember && setActiveTab && (
                        <button 
                          onClick={() => { setSelectedMember(m.user); setActiveTab('memberStats'); }} 
                          className=" opacity-0 group-hover:opacity-100 p-1 bg-white border border-indigo-100 text-indigo-600 rounded hover:bg-indigo-50 transition-all shadow-sm"
                          title="View Analytics"
                        >
                          <svg xmlns="http://www.w3.org/2000/svg" className="h-3 w-3" viewBox="0 0 20 20" fill="currentColor"><path d="M2 11a1 1 0 011-1h2a1 1 0 011 1v5a1 1 0 01-1 1H3a1 1 0 01-1-1v-5zM8 7a1 1 0 011-1h2a1 1 0 011 1v9a1 1 0 01-1 1H9a1 1 0 01-1-1V7zM14 4a1 1 0 011-1h2a1 1 0 011 1v12a1 1 0 01-1 1h-2a1 1 0 01-1-1V4z" /></svg>
                        </button>
                      )}

                      {/* REMOVE MEMBER BUTTON */}
                      {!isCurrentUser && handleRemoveMember && (
                        <button 
                          onClick={() => handleRemoveMember(m.user?._id)} 
                          className=" opacity-0 group-hover:opacity-100 p-1 bg-white border border-red-100 text-red-500 rounded hover:bg-red-50 transition-all shadow-sm"
                          title="Remove Member"
                        >
                          <svg xmlns="http://www.w3.org/2000/svg" className="h-3 w-3" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" /></svg>
                        </button>
                      )}
                    </div>
                  </li>
                );
              })}
            </ul>
          </div>
        )}
      </div>
    </aside>
  );
}