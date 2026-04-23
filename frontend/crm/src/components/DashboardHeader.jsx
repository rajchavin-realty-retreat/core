import React from 'react';

export default function DashboardHeader({
  setIsMobileMenuOpen, activeWorkspace, currentUserRoleDisplay,
  canManageDatabases, setActiveTab, setIsCreatingEntity,
  isCreatingEntity, activeTab
}) {
  return (
    <header className="border-b border-zinc-200 bg-white flex flex-col flex-shrink-0">
      <div className="h-14 flex items-center justify-between px-4 sm:px-6">
        <div className="flex items-center gap-3">
          <button onClick={() => setIsMobileMenuOpen(true)} className="lg:hidden text-zinc-500 hover:text-zinc-900 transition-colors">
            <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h16M4 18h16" /></svg>
          </button>
          <div className="flex items-center gap-2">
            <span className="text-sm font-semibold text-zinc-800 truncate max-w-[150px] sm:max-w-xs">{activeWorkspace?.name || 'No Workspace Selected'}</span>
            {activeWorkspace && <span className="hidden sm:inline-block px-2 py-0.5 rounded-full bg-zinc-100 border border-zinc-200 text-[10px] uppercase font-bold text-zinc-500 tracking-wider">{currentUserRoleDisplay}</span>}
          </div>
        </div>
        {canManageDatabases && activeWorkspace && (
          <button onClick={() => { setActiveTab('databases'); setIsCreatingEntity(!isCreatingEntity); }} className="bg-zinc-900 text-white text-xs font-medium px-3 py-1.5 rounded-md hover:bg-zinc-800 transition-colors shadow-sm whitespace-nowrap">
            {isCreatingEntity ? 'Cancel' : '+ New Database'}
          </button>
        )}
      </div>
      
      {activeWorkspace && (
        <div className="flex gap-6 px-4 sm:px-6 mt-auto overflow-x-auto hide-scrollbar">
          <button onClick={() => { setActiveTab('overview'); setIsCreatingEntity(false); }} className={`pb-3 text-sm font-semibold transition-colors border-b-2 whitespace-nowrap ${activeTab === 'overview' ? 'border-indigo-600 text-indigo-600' : 'border-transparent text-zinc-500 hover:text-zinc-800'}`}>Overview</button>
          <button onClick={() => { setActiveTab('databases'); setIsCreatingEntity(false); }} className={`pb-3 text-sm font-semibold transition-colors border-b-2 whitespace-nowrap ${activeTab === 'databases' ? 'border-indigo-600 text-indigo-600' : 'border-transparent text-zinc-500 hover:text-zinc-800'}`}>Databases</button>
          {activeTab === 'memberStats' && (
            <button className="pb-3 text-sm font-semibold transition-colors border-b-2 border-indigo-600 text-indigo-600 whitespace-nowrap">Member Analytics</button>
          )}
        </div>
      )}
    </header>
  );
}