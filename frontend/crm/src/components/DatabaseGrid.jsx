import { useState, useEffect } from 'react';

export default function DatabaseGrid({ 
  entities, 
  onOpenDatabase, 
  canManageDatabases, 
  handleDeleteDatabase, 
  onEditDatabase 
}) {
  const [localEntities, setLocalEntities] = useState([]);
  const [draggedIndex, setDraggedIndex] = useState(null);

  const workspaceId = entities.length > 0 ? (entities[0].workspace || entities[0].workspaceId || 'global') : 'global';

  // --- PERSISTENT SORTING ENGINE ---
  useEffect(() => {
    const savedOrder = JSON.parse(localStorage.getItem(`db_order_${workspaceId}`)) || [];

    if (savedOrder.length > 0 && entities.length > 0) {
      const sortedEntities = [...entities].sort((a, b) => {
        let indexA = savedOrder.indexOf(a._id);
        let indexB = savedOrder.indexOf(b._id);
        
        if (indexA === -1) indexA = 99999;
        if (indexB === -1) indexB = 99999;
        
        return indexA - indexB;
      });
      setLocalEntities(sortedEntities);
    } else {
      setLocalEntities(entities);
    }
  }, [entities, workspaceId]);

  // --- DRAG HANDLERS ---
  const handleDragStart = (e, index) => {
    setDraggedIndex(index);
    e.dataTransfer.effectAllowed = 'move';
    e.target.style.opacity = '0.4';
  };

  const handleDragEnter = (e, index) => {
    e.preventDefault();
    if (draggedIndex === null || draggedIndex === index) return;
    
    const newEntities = [...localEntities];
    const draggedItem = newEntities[draggedIndex];
    
    newEntities.splice(draggedIndex, 1);
    newEntities.splice(index, 0, draggedItem);
    
    setDraggedIndex(index);
    setLocalEntities(newEntities);
  };

  const handleDragEnd = (e) => {
    e.target.style.opacity = '1';
    setDraggedIndex(null);
    
    const newOrderIds = localEntities.map(ent => ent._id);
    localStorage.setItem(`db_order_${workspaceId}`, JSON.stringify(newOrderIds));
  };

  if (localEntities.length === 0 && entities.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-20 text-zinc-400">
        <svg xmlns="http://www.w3.org/2000/svg" className="h-12 w-12 mb-3 text-zinc-300" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M4 7v10c0 2.21 3.582 4 8 4s8-1.79 8-4V7M4 7c0 2.21 3.582 4 8 4s8-1.79 8-4M4 7c0-2.21 3.582-4 8-4s8 1.79 8 4m0 5c0 2.21-3.582 4-8 4s-8-1.79-8-4" />
        </svg>
        <p className="text-sm font-medium">No data modules created yet.</p>
      </div>
    );
  }

  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
      {localEntities.map((ent, index) => (
        <div 
          key={ent._id}
          draggable={canManageDatabases}
          onDragStart={(e) => handleDragStart(e, index)}
          onDragEnter={(e) => handleDragEnter(e, index)}
          onDragOver={(e) => e.preventDefault()}
          onDragEnd={handleDragEnd}
          onClick={() => onOpenDatabase(ent)}
          className={`bg-white border border-zinc-200 rounded-xl p-5 hover:border-indigo-300 hover:shadow-md transition-all cursor-pointer group flex flex-col justify-between min-h-[140px]
            ${draggedIndex === index ? 'opacity-50 border-indigo-400 scale-95 shadow-inner' : ''}`}
        >
          <div>
            <div className="flex items-start justify-between">
              
              {/* THE FIX: Added 'relative' to this container so the absolute grip icon stays locked inside it */}
              <div className={`relative p-2 bg-zinc-50 border border-zinc-100 group-hover:bg-indigo-50 text-zinc-400 group-hover:text-indigo-600 rounded-lg transition-colors flex items-center justify-center shrink-0 ${canManageDatabases ? 'cursor-grab active:cursor-grabbing' : ''}`}>
                {canManageDatabases ? (
                  // Show grip icon on hover for admins
                  <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5 opacity-0 group-hover:opacity-100 transition-opacity absolute" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 8h16M4 16h16" />
                  </svg>
                ) : null}
                {/* Standard database icon */}
                <svg xmlns="http://www.w3.org/2000/svg" className={`h-5 w-5 transition-opacity ${canManageDatabases ? 'group-hover:opacity-0' : ''}`} fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M4 7v10c0 2.21 3.582 4 8 4s8-1.79 8-4V7M4 7c0 2.21 3.582 4 8 4s8-1.79 8-4M4 7c0-2.21 3.582-4 8-4s8 1.79 8 4m0 5c0 2.21-3.582 4-8 4s-8-1.79-8-4" />
                </svg>
              </div>
              
              {/* Admin Actions */}
              {canManageDatabases && (
                <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                  <button 
                    onClick={(e) => { e.stopPropagation(); onEditDatabase(ent); }}
                    className="p-1.5 text-zinc-400 hover:text-indigo-600 hover:bg-indigo-50 rounded transition-colors"
                    title="Edit Architecture"
                  >
                    <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
                    </svg>
                  </button>
                  <button 
                    onClick={(e) => handleDeleteDatabase(e, ent._id, ent.name)}
                    className="p-1.5 text-zinc-400 hover:text-red-600 hover:bg-red-50 rounded transition-colors"
                    title="Delete Database"
                  >
                    <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                    </svg>
                  </button>
                </div>
              )}
            </div>
            
            <h3 className="mt-4 text-base font-semibold text-zinc-800 group-hover:text-indigo-600 transition-colors tracking-tight">
              {ent.name}
            </h3>
          </div>
          
          {/* Bottom Meta Bar */}
          <div className="mt-4 pt-3 border-t border-zinc-100 flex items-center justify-between text-[11px] font-bold text-zinc-400 uppercase tracking-widest">
            <span>{ent.fields?.length || 0} Fields</span>
            <span className="flex items-center gap-1 group-hover:text-indigo-500 transition-colors">
              Open 
              <svg xmlns="http://www.w3.org/2000/svg" className="h-3.5 w-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M14 5l7 7m0 0l-7 7m7-7H3" />
              </svg>
            </span>
          </div>
        </div>
      ))}
    </div>
  );
}