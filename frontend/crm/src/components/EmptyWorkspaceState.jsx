import React from 'react';

export default function EmptyWorkspaceState({ setIsMobileMenuOpen }) {
  return (
    <div className="flex flex-col items-center justify-center h-full text-center max-w-sm mx-auto px-4">
      <div className="w-12 h-12 bg-zinc-100 rounded-xl flex items-center justify-center mb-4 border border-zinc-200">
        <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6 text-zinc-400" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 11H5m14 0a2 2 0 012 2v6a2 2 0 01-2 2H5a2 2 0 01-2-2v-6a2 2 0 012-2m14 0V9a2 2 0 00-2-2M5 11V9a2 2 0 002-2m0 0V5a2 2 0 012-2m0 0V5a2 2 0 012-2h6a2 2 0 012 2v2M7 7h10" /></svg>
      </div>
      <h2 className="text-base font-semibold text-zinc-900 mb-1">Select a Workspace</h2>
      <p className="text-sm text-zinc-500">Choose a workspace from the sidebar to view your databases, or create a new one to get started.</p>
      <button onClick={() => setIsMobileMenuOpen(true)} className="mt-6 lg:hidden bg-white border border-zinc-200 text-zinc-700 px-4 py-2 rounded-md text-sm font-medium shadow-sm">Open Menu</button>
    </div>
  );
}