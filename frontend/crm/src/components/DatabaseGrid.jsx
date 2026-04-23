import React from 'react';

export default function DatabaseGrid({ entities, navigate, canManageDatabases, handleDeleteDatabase, onEditDatabase }) {
  if (entities.length === 0) {
    return (
      <div className="col-span-full py-12 border-2 border-dashed border-zinc-200 rounded-xl text-center text-sm text-zinc-500">
        No databases yet. Click "+ New Database" to start building.
      </div>
    );
  }

  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
      {entities.map(entity => (
        <div key={entity._id} onClick={() => navigate(`/crm/${entity._id}`)} className="group bg-white border border-zinc-200 p-4 rounded-xl cursor-pointer hover:border-zinc-300 hover:shadow-sm transition-all relative">
          <div className="w-8 h-8 rounded bg-indigo-50 border border-indigo-100 flex items-center justify-center mb-3">
            <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4 text-indigo-600" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 7v10c0 2.21 3.582 4 8 4s8-1.79 8-4V7M4 7c0 2.21 3.582 4 8 4s8-1.79 8-4M4 7c0-2.21 3.582-4 8-4s8 1.79 8 4m0 5c0 2.21-3.582 4-8 4s-8-1.79-8-4" /></svg>
          </div>
          <h3 className="font-semibold text-sm text-zinc-900 truncate pr-16">{entity.name}</h3>
          <p className="text-xs text-zinc-500 mt-1">{entity.fields.length} Columns</p>
          
          {canManageDatabases && (
            <div className="absolute top-3 right-3 flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
              <button 
                onClick={(e) => { e.stopPropagation(); onEditDatabase(entity); }} 
                className="text-zinc-400 hover:text-indigo-600 p-1.5 bg-white border border-zinc-200 rounded shadow-sm hover:bg-zinc-50 transition-colors"
                title="Edit Schema"
              >
                <svg xmlns="http://www.w3.org/2000/svg" className="h-3 w-3" viewBox="0 0 20 20" fill="currentColor"><path d="M13.586 3.586a2 2 0 112.828 2.828l-.793.793-2.828-2.828.793-.793zM11.379 5.793L3 14.172V17h2.828l8.38-8.379-2.83-2.828z" /></svg>
              </button>
              <button 
                onClick={(e) => handleDeleteDatabase(e, entity._id, entity.name)} 
                className="text-zinc-400 hover:text-red-600 p-1.5 bg-white border border-zinc-200 rounded shadow-sm hover:bg-zinc-50 transition-colors"
                title="Delete Database"
              >
                <svg xmlns="http://www.w3.org/2000/svg" className="h-3 w-3" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" /></svg>
              </button>
            </div>
          )}
        </div>
      ))}
    </div>
  );
}