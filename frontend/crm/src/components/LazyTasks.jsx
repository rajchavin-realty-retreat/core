import { useState, useEffect, useCallback } from 'react';
import api from '../api/axiosConfig';
import DynamicForm from './DynamicForm'; 

export default function LazyTasks({ activeWorkspace, entities }) {
  const [selectedEntityId, setSelectedEntityId] = useState('');
  const [allRecords, setAllRecords] = useState({}); 
  const [universalMap, setUniversalMap] = useState({}); 
  const [userDictionary, setUserDictionary] = useState({}); 
  const [isLoading, setIsLoading] = useState(true);
  
  const [isCreatingTask, setIsCreatingTask] = useState(false);
  const [showMyTasks, setShowMyTasks] = useState(false);
  const currentUser = JSON.parse(localStorage.getItem('userInfo'));

  // --- TASK CANVAS & COMMENTS STATE ---
  const [selectedTask, setSelectedTask] = useState(null);
  const [newComment, setNewComment] = useState('');
  const [isSubmittingComment, setIsSubmittingComment] = useState(false);

  const taskCapableEntities = entities.filter(ent => 
    ent.fields.some(f => f.type === 'dropdown')
  );

  const selectedEntity = entities.find(e => e._id === selectedEntityId);
  const statusField = selectedEntity?.fields.find(f => f.type === 'dropdown');
  const titleField = selectedEntity?.fields.find(f => f.type === 'text' || f.type === 'email') || selectedEntity?.fields[0];

  useEffect(() => {
    if (taskCapableEntities.length > 0 && !selectedEntityId) {
      setSelectedEntityId(taskCapableEntities[0]._id);
    }
  }, [taskCapableEntities, selectedEntityId]);

  // --- THE INFINITE LOOP FIX IS HERE ---
  // Notice we removed selectedTask and selectedEntityId from the dependency array at the bottom!
  const fetchEverything = useCallback(async () => {
    setIsLoading(true);
    try {
      const wsRes = await api.get('/workspaces');
      const wsId = activeWorkspace?._id;
      const currentWs = wsRes.data.find(w => w._id === wsId);
      
      const uDict = {};
      if (currentWs) {
        if (currentWs.owner) uDict[currentWs.owner._id] = currentWs.owner.name || currentWs.owner.email;
        currentWs.members.forEach(m => {
          if (m.status === 'accepted' && m.user) uDict[m.user._id] = m.user.name || m.user.email;
        });
      }
      setUserDictionary(uDict);

      const fetchPromises = entities.map(ent => api.get(`/records/entity/${ent._id}`).catch(() => ({ data: [] })));
      const responses = await Promise.all(fetchPromises);
      
      const uMap = {};
      const recordsByEntity = {};

      responses.forEach((res, index) => {
        const entity = entities[index];
        recordsByEntity[entity._id] = res.data; 
        res.data.forEach(record => {
          uMap[record._id] = { data: record.data, schema: entity }; 
        });
      });

      setUniversalMap(uMap);
      setAllRecords(recordsByEntity);
      
      // THE FIX: Functional Update. This finds the fresh data for the open canvas without triggering a loop!
      setSelectedTask(prevTask => {
        if (!prevTask) return null;
        for (const entityId in recordsByEntity) {
          const freshTaskData = recordsByEntity[entityId].find(r => r._id === prevTask._id);
          if (freshTaskData) return freshTaskData;
        }
        return prevTask;
      });

    } catch (error) { 
      console.error("Failed to load tasks", error); 
    } finally { 
      setIsLoading(false); 
    }
  }, [entities, activeWorkspace]); // <-- Loop broken.

  useEffect(() => {
    if (entities.length > 0) fetchEverything();
  }, [entities, fetchEverything]);

  const getDisplayValue = (field, rawValue) => {
    if (!rawValue) return '-';
    if (field.type === 'relation') {
      const targetRecord = universalMap[rawValue];
      if (targetRecord) {
        if (field.displayFields && field.displayFields.length > 0) {
          return field.displayFields.map(fn => targetRecord.data[fn]).filter(Boolean).join(' - '); 
        }
        const firstTextField = targetRecord.schema.fields.find(f => f.type === 'text') || targetRecord.schema.fields[0];
        return targetRecord.data[firstTextField.name] || 'Unnamed Link';
      }
      return 'Unknown Link';
    }
    if (field.type === 'user') {
      return userDictionary[rawValue] || 'Unknown User';
    }
    return String(rawValue);
  };

  const handleDragStart = (e, recordId) => { e.dataTransfer.setData('recordId', recordId); e.target.style.opacity = '0.5'; };
  const handleDragEnd = (e) => { e.target.style.opacity = '1'; };
  const handleDragOver = (e) => e.preventDefault(); 

  const handleDrop = async (e, newStatus) => {
    e.preventDefault();
    const recordId = e.dataTransfer.getData('recordId');
    if (!recordId) return;

    setAllRecords(prev => ({
      ...prev,
      [selectedEntityId]: prev[selectedEntityId].map(rec => 
        rec._id === recordId ? { ...rec, data: { ...rec.data, [statusField.name]: newStatus } } : rec
      )
    }));

    try {
      await api.put(`/records/${recordId}`, { dynamicData: { [statusField.name]: newStatus } });
      // Refresh the open canvas if they drag the currently viewed task
      if (selectedTask && selectedTask._id === recordId) {
        setSelectedTask(prev => ({ ...prev, data: { ...prev.data, [statusField.name]: newStatus } }));
      }
    } catch (error) {
      alert("Failed to move task.");
      fetchEverything(); 
    }
  };

  const handleAddComment = async (e) => {
    e.preventDefault();
    if (!newComment.trim()) return;
    setIsSubmittingComment(true);
    try {
      await api.post(`/records/${selectedTask._id}/comments`, { 
        text: newComment,
        userName: currentUser.name || currentUser.email 
      });
      setNewComment('');
      fetchEverything(); // This will now safely fetch and slide the new comment into the canvas!
    } catch (error) {
      alert("Failed to post comment.");
    } finally {
      setIsSubmittingComment(false);
    }
  };

  if (taskCapableEntities.length === 0) {
    return (
      <div className="bg-white p-6 rounded-xl border border-zinc-200 flex flex-col items-center justify-center h-[60vh] text-center">
        <h3 className="text-lg font-bold text-zinc-900">No Task Databases Found</h3>
        <p className="text-sm text-zinc-500 mt-2">Create a database in Schema Builder and add a <b>Dropdown</b> field to activate Kanban.</p>
      </div>
    );
  }

  let currentBoardRecords = allRecords[selectedEntityId] || [];

  if (showMyTasks && currentUser) {
    const userId = String(currentUser.id || currentUser._id);
    currentBoardRecords = currentBoardRecords.filter(rec => {
      if (String(rec.createdBy?._id || rec.createdBy) === userId) return true;
      const userFields = selectedEntity.fields.filter(f => f.type === 'user');
      return userFields.some(f => {
        const val = rec.data?.[f.name];
        return String(val) === userId || String(val?._id) === userId; 
      });
    });
  }

  const boardColumns = statusField ? [
    { label: '📥 Inbox', value: '', isInbox: true },
    ...statusField.options.map(opt => ({ label: opt, value: opt, isInbox: false }))
  ] : [];

  const relationFields = selectedEntity?.fields.filter(f => f.type === 'relation') || [];
  const userFields = selectedEntity?.fields.filter(f => f.type === 'user') || [];

  return (
    <div className="flex flex-col h-[85vh] gap-4 relative overflow-hidden">
      
      <div className="bg-white p-4 rounded-xl border border-zinc-200 shadow-sm flex justify-between items-center shrink-0">
        <div className="flex items-center gap-4">
          <h2 className="text-lg font-bold text-zinc-900">Lazy Tasks</h2>
          <label className="flex items-center gap-2 cursor-pointer bg-zinc-50 border border-zinc-200 px-3 py-1 rounded-full">
            <input type="checkbox" checked={showMyTasks} onChange={(e) => setShowMyTasks(e.target.checked)} className="w-3.5 h-3.5 text-indigo-600 rounded" />
            <span className="text-[11px] font-bold text-zinc-600 uppercase">My Tasks</span>
          </label>
        </div>
        
        <div className="flex items-center gap-3">
          <select value={selectedEntityId} onChange={(e) => setSelectedEntityId(e.target.value)} className="px-3 py-2 text-sm border border-zinc-200 rounded-md bg-zinc-50 font-semibold outline-none">
            {taskCapableEntities.map(ent => <option key={ent._id} value={ent._id}>{ent.name}</option>)}
          </select>
          <button onClick={() => setIsCreatingTask(true)} className="bg-indigo-600 hover:bg-indigo-700 text-white px-4 py-2 rounded-md text-sm font-bold shadow-sm">+ New Task</button>
        </div>
      </div>

      {isLoading ? (
        <div className="flex-1 flex items-center justify-center text-zinc-400">Loading tasks...</div>
      ) : statusField ? (
        <div className="flex-1 overflow-x-auto pb-4">
          <div className="flex gap-4 h-full min-w-max px-1">
            {boardColumns.map((col, index) => {
              const columnRecords = currentBoardRecords.filter(rec => {
                const status = rec.data?.[statusField.name];
                return col.isInbox ? (!status || !statusField.options.includes(status)) : (status === col.value);
              });
              
              return (
                <div key={index} onDragOver={handleDragOver} onDrop={(e) => handleDrop(e, col.value)} className={`w-80 flex flex-col rounded-lg overflow-hidden h-full flex-shrink-0 border ${col.isInbox ? 'bg-zinc-100/50 border-dashed border-zinc-300' : 'bg-zinc-50/80 border-zinc-200'}`}>
                  <div className={`px-4 py-3 border-b flex justify-between items-center shrink-0 ${col.isInbox ? 'bg-zinc-100' : 'bg-white/50'}`}>
                    <h3 className={`text-sm font-bold ${col.isInbox ? 'text-indigo-900' : 'text-zinc-700'}`}>{col.label}</h3>
                    <span className="text-[10px] font-bold bg-white border border-zinc-200 text-zinc-600 px-2 py-0.5 rounded-full">{columnRecords.length}</span>
                  </div>
                  
                  <div className="flex-1 overflow-y-auto p-3 space-y-3">
                    {columnRecords.map(record => (
                      <div 
                        key={record._id} 
                        draggable 
                        onDragStart={(e) => handleDragStart(e, record._id)} 
                        onDragEnd={handleDragEnd} 
                        onClick={() => setSelectedTask(record)} 
                        className="bg-white p-3.5 rounded-lg border border-zinc-200 shadow-sm cursor-pointer hover:border-indigo-400 transition-all group relative"
                      >
                        {col.isInbox && <div className="absolute top-0 left-0 w-1 h-full bg-indigo-400"></div>}

                        <div className="text-sm font-bold text-zinc-800 mb-2">{getDisplayValue(titleField, record.data?.[titleField.name])}</div>
                        
                        {relationFields.map(f => record.data?.[f.name] && (
                          <div key={f.name} className="text-[10px] bg-indigo-50 text-indigo-700 px-1.5 py-0.5 rounded border border-indigo-100 mb-1 font-semibold w-fit">
                            🔗 {f.name}: {getDisplayValue(f, record.data[f.name])}
                          </div>
                        ))}

                        {userFields.map(f => record.data?.[f.name] && (
                           <div key={f.name} className="mt-2 pt-2 border-t border-zinc-100 flex justify-between items-center">
                             <div className="flex items-center gap-1 text-[10px] text-zinc-400 font-medium">
                               <svg xmlns="http://www.w3.org/2000/svg" className="h-3 w-3" viewBox="0 0 20 20" fill="currentColor"><path fillRule="evenodd" d="M18 10c0 3.866-3.582 7-8 7a8.841 8.841 0 01-4.083-.98L2 17l1.338-3.123C2.493 12.767 2 11.434 2 10c0-3.866 3.582-7 8-7s8 3.134 8 7zM7 9H5v2h2V9zm8 0h-2v2h2V9zM9 9h2v2H9V9z" clipRule="evenodd" /></svg>
                               {record.comments?.length || 0}
                             </div>
                             <div className="bg-amber-50 text-amber-700 border border-amber-200 text-[9px] font-bold px-1.5 py-0.5 rounded">
                               👤 {getDisplayValue(f, record.data[f.name])}
                             </div>
                           </div>
                        ))}
                      </div>
                    ))}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      ) : null}

      {/* --- THE FIXED SLIDE-OVER TASK CANVAS --- */}
      {selectedTask && (
        <div className="absolute inset-y-0 right-0 w-full md:w-[450px] bg-white shadow-2xl border-l border-zinc-200 z-50 flex flex-col transform transition-transform duration-300">
          
          <div className="px-5 py-4 border-b border-zinc-100 flex justify-between items-start bg-zinc-50">
            <div>
              <span className="text-[10px] font-bold text-indigo-600 uppercase tracking-widest">{selectedEntity?.name}</span>
              <h2 className="text-xl font-bold text-zinc-900 leading-tight mt-1">
                {getDisplayValue(titleField, selectedTask.data?.[titleField.name])}
              </h2>
            </div>
            <button onClick={() => setSelectedTask(null)} className="p-1.5 bg-zinc-200/50 hover:bg-zinc-200 text-zinc-500 rounded-md transition-colors">✕</button>
          </div>

          <div className="flex-1 overflow-y-auto">
            <div className="p-5 space-y-4 border-b border-zinc-200">
              <h3 className="text-xs font-bold text-zinc-400 uppercase tracking-wider mb-2">Details</h3>
              {selectedEntity?.fields.map(f => {
                if (!selectedTask.data?.[f.name] || f.name === titleField.name) return null;
                return (
                  <div key={f.name} className="flex flex-col gap-1">
                    <span className="text-xs font-semibold text-zinc-500">{f.name}</span>
                    <div className="text-sm text-zinc-800 bg-zinc-50 px-3 py-2 rounded border border-zinc-100 break-words">
                      {/* THE FIX: Added Optional Chaining here so empty fields don't crash the canvas! */}
                      {f.type === 'relation' || f.type === 'user' 
                        ? getDisplayValue(f, selectedTask.data?.[f.name]) 
                        : String(selectedTask.data?.[f.name] || '-')}
                    </div>
                  </div>
                );
              })}
            </div>

            <div className="p-5">
              <h3 className="text-xs font-bold text-zinc-400 uppercase tracking-wider mb-4">Comments Activity</h3>
              <div className="space-y-4 mb-4">
                {(!selectedTask.comments || selectedTask.comments.length === 0) ? (
                  <p className="text-sm text-zinc-400 italic text-center py-4">No comments yet. Start the conversation!</p>
                ) : (
                  selectedTask.comments.map((comment, i) => (
                    <div key={i} className="bg-zinc-50 rounded-lg p-3 border border-zinc-100">
                      <div className="flex justify-between items-center mb-1">
                        <span className="text-xs font-bold text-zinc-800">{comment.userName}</span>
                        <span className="text-[10px] text-zinc-400">{new Date(comment.createdAt).toLocaleDateString()}</span>
                      </div>
                      <p className="text-sm text-zinc-600 whitespace-pre-wrap">{comment.text}</p>
                    </div>
                  ))
                )}
              </div>
            </div>
          </div>

          <div className="p-4 bg-white border-t border-zinc-200">
            <form onSubmit={handleAddComment} className="flex gap-2">
              <input 
                type="text" 
                placeholder="Type a comment..." 
                value={newComment} 
                onChange={(e) => setNewComment(e.target.value)} 
                className="flex-1 border border-zinc-200 rounded-md px-3 py-2 text-sm outline-none focus:border-indigo-500 bg-zinc-50"
              />
              <button 
                type="submit" 
                disabled={isSubmittingComment || !newComment.trim()} 
                className="bg-indigo-600 text-white px-4 py-2 rounded-md text-sm font-bold hover:bg-indigo-700 disabled:opacity-50 transition-colors"
              >
                Post
              </button>
            </form>
          </div>
        </div>
      )}

      {isCreatingTask && selectedEntity && (
        <DynamicForm 
          entity={selectedEntity} 
          onCancel={() => setIsCreatingTask(false)}
          onSuccess={() => { setIsCreatingTask(false); fetchEverything(); }} 
        />
      )}
    </div>
  );
}