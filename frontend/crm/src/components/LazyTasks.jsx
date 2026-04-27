import { useState, useEffect, useCallback } from 'react';
import api from '../api/axiosConfig';

export default function LazyTasks({ activeWorkspace, entities }) {
  const [selectedBoardId, setSelectedBoardId] = useState('');
  const [allRecords, setAllRecords] = useState({}); 
  const [universalMap, setUniversalMap] = useState({}); 
  const [userDictionary, setUserDictionary] = useState({}); 
  const [workspaceUsers, setWorkspaceUsers] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  
  const [isUserAdmin, setIsUserAdmin] = useState(false);
  const currentUser = JSON.parse(localStorage.getItem('userInfo'));
  const userIdStr = String(currentUser?.id || currentUser?._id);

  const [showMyTasks, setShowMyTasks] = useState(false);
  const [isCreatingBoard, setIsCreatingBoard] = useState(false);
  const [isCreatingTask, setIsCreatingTask] = useState(false);
  const [isEditingTask, setIsEditingTask] = useState(false);
  const [selectedTask, setSelectedTask] = useState(null);

  // --- THE FIX: NEW SUBMISSION LOCK STATES ---
  const [isSubmittingBoard, setIsSubmittingBoard] = useState(false);
  const [isSavingTask, setIsSavingTask] = useState(false);

  const [newBoardData, setNewBoardData] = useState({ name: '', statuses: 'To Do, In Progress, Done', linkedDatabases: [] });
  const [taskFormData, setTaskFormData] = useState({}); 
  const [newComment, setNewComment] = useState('');
  const [isSubmittingComment, setIsSubmittingComment] = useState(false);

  const taskBoards = entities.filter(ent => ent.isTaskBoard);
  const standardDatabases = entities.filter(ent => !ent.isTaskBoard);
  
  const selectedBoard = taskBoards.find(e => String(e._id) === String(selectedBoardId));
  const titleField = selectedBoard?.fields.find(f => f.type === 'text') || selectedBoard?.fields[0];
  const descField = selectedBoard?.fields.find(f => f.type === 'textarea');
  const statusField = selectedBoard?.fields.find(f => f.type === 'dropdown');
  const assigneeField = selectedBoard?.fields.find(f => f.type === 'user');
  const dateField = selectedBoard?.fields.find(f => f.type === 'date');
  const relationFields = selectedBoard?.fields.filter(f => f.type === 'relation') || [];

  useEffect(() => {
    if (taskBoards.length > 0 && !selectedBoardId) {
      setSelectedBoardId(taskBoards[0]._id);
    }
  }, [taskBoards, selectedBoardId]);

  const fetchEverything = useCallback(async () => {
    setIsLoading(true);
    try {
      const wsRes = await api.get('/workspaces');
      const currentWs = wsRes.data.find(w => String(w._id) === String(activeWorkspace?._id));
      
      const uDict = {};
      let usersList = [];
      let adminFlag = false;

      if (currentWs) {
        if (currentWs.owner) {
          uDict[String(currentWs.owner._id)] = currentWs.owner.name || currentWs.owner.email;
          usersList.push(currentWs.owner);
        }
        currentWs.members.forEach(m => {
          if (m.status === 'accepted' && m.user) {
            uDict[String(m.user._id)] = m.user.name || m.user.email;
            if (!usersList.find(u => String(u._id) === String(m.user._id))) usersList.push(m.user);
          }
        });
        
        if (String(currentWs.owner?._id || currentWs.owner) === userIdStr) {
          adminFlag = true;
        } else {
          const myMember = currentWs.members.find(m => String(m.user?._id || m.user) === userIdStr);
          if (myMember && currentWs.customRoles) {
            const role = currentWs.customRoles.find(r => String(r._id) === String(myMember.roleId));
            if (role && (role.permissions?.manageTeam || role.permissions?.editAllRecords)) adminFlag = true;
          }
        }
      }
      setUserDictionary(uDict);
      setWorkspaceUsers(usersList);
      setIsUserAdmin(adminFlag);

      const fetchPromises = entities.map(ent => api.get(`/records/entity/${ent._id}`).catch(() => ({ data: [] })));
      const responses = await Promise.all(fetchPromises);
      
      const uMap = {};
      const recordsByEntity = {};

      responses.forEach((res, index) => {
        const entity = entities[index];
        recordsByEntity[String(entity._id)] = res.data; 
        res.data.forEach(record => { uMap[String(record._id)] = { data: record.data, schema: entity }; });
      });

      setUniversalMap(uMap);
      setAllRecords(recordsByEntity);
      
      setSelectedTask(prevTask => {
        if (!prevTask) return null;
        for (const entityId in recordsByEntity) {
          const freshTaskData = recordsByEntity[entityId].find(r => String(r._id) === String(prevTask._id));
          if (freshTaskData) return freshTaskData;
        }
        return prevTask;
      });

    } catch (error) { console.error("Failed to load tasks", error); } 
    finally { setIsLoading(false); }
  }, [entities, activeWorkspace, userIdStr]); 

  useEffect(() => {
    if (entities.length > 0) fetchEverything();
  }, [entities, fetchEverything]);

  const getDisplayValue = (field, rawValue) => {
    if (!rawValue) return '-';
    if (field.type === 'relation') {
      const targetRecord = universalMap[String(rawValue)];
      if (targetRecord) {
        if (field.displayFields && field.displayFields.length > 0) {
          return field.displayFields.map(fn => targetRecord.data[fn]).filter(Boolean).join(' - '); 
        }
        const firstTextField = targetRecord.schema.fields.find(f => f.type === 'text') || targetRecord.schema.fields[0];
        return targetRecord.data[firstTextField.name] || 'Unnamed Link';
      }
      return 'Unknown Link';
    }
    if (field.type === 'user') return userDictionary[String(rawValue)] || 'Unassigned';
    return String(rawValue);
  };

  // --- THE FIX: BOARD CREATION LOCK ---
  const handleCreateBoard = async (e) => {
    e.preventDefault();
    if (!newBoardData.name.trim()) return alert("Board name is required.");
    
    setIsSubmittingBoard(true); // Lock the button instantly
    try {
      const customRelations = newBoardData.linkedDatabases.map(dbId => {
         const db = standardDatabases.find(d => String(d._id) === String(dbId));
         return { name: `Linked ${db.name}`, type: 'relation', targetEntity: dbId };
      });

      const payload = {
        name: newBoardData.name,
        isTaskBoard: true, 
        workspaceId: activeWorkspace._id,
        fields: [
          { name: 'Task Title', type: 'text', isRequired: true },
          { name: 'Status', type: 'dropdown', options: newBoardData.statuses.split(',').map(s => s.trim()) },
          { name: 'Assignee', type: 'user' },
          { name: 'Due Date', type: 'date' },
          { name: 'Description', type: 'textarea' },
          ...customRelations
        ]
      };

      await api.post('/entities', payload);
      setIsCreatingBoard(false);
      setNewBoardData({ name: '', statuses: 'To Do, In Progress, Done', linkedDatabases: [] });
      window.location.reload(); 
    } catch (err) { 
      alert("Failed to create project board."); 
    } finally {
      setIsSubmittingBoard(false); // Release the lock
    }
  };

  const toggleDatabaseLink = (dbId) => {
    setNewBoardData(prev => {
      const exists = prev.linkedDatabases.includes(dbId);
      return { ...prev, linkedDatabases: exists ? prev.linkedDatabases.filter(id => id !== dbId) : [...prev.linkedDatabases, dbId] };
    });
  };

  const openNewTaskForm = () => {
    const initial = {};
    selectedBoard.fields.forEach(f => {
       if (f.type === 'user') initial[f.name] = userIdStr; 
       else if (f.type === 'dropdown' && f.options.length > 0) initial[f.name] = f.options[0];
       else initial[f.name] = '';
    });
    setTaskFormData(initial);
    setIsCreatingTask(true);
  };

  const openEditTaskForm = () => {
    setTaskFormData({ ...selectedTask.data });
    setIsEditingTask(true);
  };

  // --- THE FIX: TASK CREATION LOCK ---
  const handleTaskSubmit = async (e) => {
    e.preventDefault();
    setIsSavingTask(true); // Lock the button instantly
    try {
      if (isCreatingTask) {
        await api.post('/records', {
          entityId: selectedBoard._id,
          workspaceId: activeWorkspace._id,
          data: taskFormData,
          dynamicData: taskFormData
        });
        setIsCreatingTask(false);
      } else if (isEditingTask) {
        await api.put(`/records/${selectedTask._id}`, {
          data: taskFormData,
          dynamicData: taskFormData
        });
        setIsEditingTask(false);
      }
      fetchEverything();
    } catch (err) {
      alert("Failed to save task.");
    } finally {
      setIsSavingTask(false); // Release the lock
    }
  };

  const handleDrop = async (e, newStatus) => {
    e.preventDefault();
    const recordId = e.dataTransfer.getData('recordId');
    if (!recordId) return;

    const draggedTask = allRecords[String(selectedBoardId)].find(r => String(r._id) === String(recordId));
    if (!draggedTask) return;

    const updatedData = { ...draggedTask.data, [statusField.name]: newStatus };

    setAllRecords(prev => ({
      ...prev, [String(selectedBoardId)]: prev[String(selectedBoardId)].map(rec => String(rec._id) === String(recordId) ? { ...rec, data: updatedData } : rec)
    }));

    try { await api.put(`/records/${recordId}`, { data: updatedData, dynamicData: updatedData }); } 
    catch (error) { fetchEverything(); }
  };

  const handleDeleteTask = async () => {
    if (!window.confirm("Permanently delete this task?")) return;
    try {
      await api.delete(`/records/${selectedTask._id}`);
      setSelectedTask(null);
      fetchEverything();
    } catch (err) { alert("Failed to delete task"); }
  };

  const handleAddComment = async (e) => {
    e.preventDefault();
    if (!newComment.trim()) return;
    setIsSubmittingComment(true);
    try {
      await api.post(`/records/${selectedTask._id}/comments`, { text: newComment, userName: currentUser.name || currentUser.email });
      setNewComment('');
      fetchEverything(); 
    } catch (error) { alert("Failed to post comment."); } 
    finally { setIsSubmittingComment(false); }
  };

  const handleInlineUpdate = async (fieldName, value) => {
    if (!selectedTask) return;
    const updatedData = { ...selectedTask.data, [fieldName]: value };
    
    setAllRecords(prev => ({
      ...prev, [String(selectedBoardId)]: prev[String(selectedBoardId)].map(rec => String(rec._id) === String(selectedTask._id) ? { ...rec, data: updatedData } : rec)
    }));
    setSelectedTask(prev => ({ ...prev, data: updatedData }));

    try { await api.put(`/records/${selectedTask._id}`, { data: updatedData, dynamicData: updatedData }); } 
    catch (error) { fetchEverything(); }
  };

  const handleDragStart = (e, recordId) => { e.dataTransfer.setData('recordId', recordId); e.target.style.opacity = '0.5'; };
  const handleDragEnd = (e) => { e.target.style.opacity = '1'; };
  const handleDragOver = (e) => e.preventDefault(); 

  let currentBoardRecords = allRecords[String(selectedBoardId)] || [];
  if (showMyTasks && assigneeField) {
    currentBoardRecords = currentBoardRecords.filter(rec => 
      String(rec.createdBy?._id || rec.createdBy) === userIdStr || 
      String(rec.data?.[assigneeField.name]) === userIdStr
    );
  }

  const boardColumns = statusField ? statusField.options.map(opt => ({ label: opt, value: opt })) : [];

  return (
    <div className="flex flex-col h-[85vh] gap-4 relative overflow-hidden font-sans text-zinc-800">
      
      <div className="bg-white p-4 sm:p-5 rounded-xl border border-zinc-200 shadow-sm flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 shrink-0">
        <div className="flex items-center gap-4">
          <h2 className="text-xl font-semibold tracking-tight text-zinc-800">Projects & Tasks</h2>
          {taskBoards.length > 0 && (
            <label className="flex items-center gap-2 cursor-pointer bg-zinc-50 border border-zinc-200 px-3 py-1.5 rounded-lg transition-colors hover:bg-zinc-100">
              <input type="checkbox" checked={showMyTasks} onChange={(e) => setShowMyTasks(e.target.checked)} className="w-4 h-4 text-indigo-600 rounded border-zinc-300" />
              <span className="text-[11px] font-semibold text-zinc-600 uppercase tracking-widest">My Tasks</span>
            </label>
          )}
        </div>
        
        <div className="flex items-center gap-2 sm:gap-3 w-full sm:w-auto">
          {taskBoards.length > 0 && (
            <select value={selectedBoardId} onChange={(e) => setSelectedBoardId(e.target.value)} className="flex-1 sm:w-auto px-4 py-2.5 text-sm border border-zinc-200 rounded-xl bg-transparent hover:bg-zinc-50 focus:bg-white font-medium outline-none focus:border-indigo-400 focus:ring-4 focus:ring-indigo-500/10 transition-all">
              {taskBoards.map(ent => <option key={ent._id} value={ent._id}>{ent.name}</option>)}
            </select>
          )}
          
          <button onClick={() => setIsCreatingBoard(true)} className="bg-white border border-zinc-200 hover:bg-zinc-50 text-zinc-700 px-4 py-2.5 rounded-xl text-sm font-medium shadow-sm transition-colors flex items-center gap-1.5 shrink-0">
            <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4 text-zinc-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 17V7m0 10a2 2 0 01-2 2H5a2 2 0 01-2-2V7a2 2 0 012-2h2a2 2 0 012 2m0 10a2 2 0 002 2h2a2 2 0 002-2M9 7a2 2 0 012-2h2a2 2 0 012 2m0 10a2 2 0 002 2h2a2 2 0 002-2V7a2 2 0 00-2-2h-2a2 2 0 00-2 2" />
            </svg>
            <span className="hidden sm:inline">New Board</span>
          </button>
          
          {taskBoards.length > 0 && (
            <button onClick={openNewTaskForm} className="bg-zinc-900 hover:bg-zinc-800 text-white px-5 py-2.5 rounded-xl text-sm font-medium shadow-sm transition-colors shrink-0">
              + New Task
            </button>
          )}
        </div>
      </div>

      {taskBoards.length === 0 ? (
        <div className="bg-white p-8 rounded-xl border border-zinc-200 shadow-sm flex flex-col items-center justify-center flex-1 text-center max-w-2xl mx-auto mt-6 sm:mt-10">
          <div className="w-14 h-14 bg-indigo-50 text-indigo-600 rounded-xl flex items-center justify-center mb-4 border border-indigo-100">
            <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2" /></svg>
          </div>
          <h3 className="text-lg font-semibold text-zinc-800 tracking-tight">No Task Boards Found</h3>
          <p className="text-sm text-zinc-500 mt-2 mb-6 font-medium max-w-md leading-relaxed">
            Click <b>"New Board"</b> to define a task structure, set up your Kanban stages, and optionally link your existing databases.
          </p>
          <button onClick={() => setIsCreatingBoard(true)} className="bg-indigo-600 text-white px-6 py-2.5 rounded-xl font-medium shadow-sm hover:bg-indigo-700 transition-colors">
            Create First Board
          </button>
        </div>
      ) : isLoading ? (
        <div className="flex-1 flex items-center justify-center text-zinc-500 font-medium text-sm">Syncing Tasks...</div>
      ) : statusField && (
        
        <div className="flex-1 overflow-x-auto pb-4">
          <div className="flex gap-4 h-full min-w-max px-1">
            {boardColumns.map((col, index) => {
              const columnRecords = currentBoardRecords.filter(rec => rec.data?.[statusField.name] === col.value);
              return (
                <div key={index} onDragOver={handleDragOver} onDrop={(e) => handleDrop(e, col.value)} className="w-[300px] sm:w-[320px] flex flex-col rounded-2xl overflow-hidden h-full flex-shrink-0 border bg-zinc-50/50 border-zinc-200/80">
                  <div className="px-4 py-3.5 border-b border-zinc-200/80 flex justify-between items-center shrink-0 bg-zinc-50/80">
                    <h3 className="text-[11px] font-semibold uppercase tracking-widest text-zinc-500">{col.label}</h3>
                    <span className="text-[10px] font-medium bg-white border border-zinc-200 text-zinc-600 px-2 py-0.5 rounded-md shadow-sm">{columnRecords.length}</span>
                  </div>
                  
                  <div className="flex-1 overflow-y-auto p-3 space-y-3">
                    {columnRecords.map(record => (
                      <div 
                        key={record._id} draggable onDragStart={(e) => handleDragStart(e, record._id)} onDragEnd={handleDragEnd} onClick={() => setSelectedTask(record)} 
                        className="bg-white p-4 rounded-xl border border-zinc-200 shadow-sm cursor-pointer hover:border-indigo-300 hover:shadow-md transition-all group relative"
                      >
                        <div className="text-sm font-semibold text-zinc-800 mb-3 leading-snug tracking-tight group-hover:text-indigo-600 transition-colors">
                          {getDisplayValue(titleField, record.data?.[titleField.name])}
                        </div>
                        
                        <div className="flex flex-wrap gap-1.5 mb-3">
                          {relationFields.map(f => {
                            const val = record.data?.[f.name];
                            if (!val) return null;
                            return (
                              <span key={f.name} className="text-[10px] font-medium bg-indigo-50/80 text-indigo-700 px-2 py-1 rounded-md border border-indigo-100 flex items-center gap-1 max-w-full truncate">
                                <svg xmlns="http://www.w3.org/2000/svg" className="h-3 w-3 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13.828 10.172a4 4 0 00-5.656 0l-4 4a4 4 0 105.656 5.656l1.102-1.101m-.758-4.899a4 4 0 005.656 0l4-4a4 4 0 00-5.656-5.656l-1.1 1.1" /></svg>
                                {getDisplayValue(f, val)}
                              </span>
                            );
                          })}
                        </div>

                        <div className="mt-3 pt-3 border-t border-zinc-100 flex justify-between items-center">
                           <div className="flex items-center gap-1 text-[11px] text-zinc-400 font-medium">
                             <svg xmlns="http://www.w3.org/2000/svg" className="h-3.5 w-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z" /></svg>
                             {record.comments?.length || 0}
                           </div>
                           {assigneeField && record.data?.[assigneeField.name] && (
                             <div className="bg-zinc-100/80 text-zinc-700 border border-zinc-200 text-[10px] font-medium px-2 py-1 rounded-md">
                               👤 {getDisplayValue(assigneeField, record.data[assigneeField.name])}
                             </div>
                           )}
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* --- DEDICATED BOARD BUILDER MODAL --- */}
      {isCreatingBoard && (
        <div className="fixed inset-0 bg-zinc-900/40 backdrop-blur-sm flex items-center justify-center z-[70] p-4">
          <div className="bg-white rounded-2xl shadow-xl w-full max-w-md overflow-hidden border border-zinc-200">
            <div className="px-6 py-5 border-b border-zinc-100 bg-zinc-50 flex justify-between items-center">
              <h3 className="font-semibold tracking-tight text-zinc-800 text-lg">Create Task Board</h3>
              <button onClick={() => setIsCreatingBoard(false)} className="text-zinc-400 hover:text-zinc-600 transition-colors p-1">
                <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" viewBox="0 0 20 20" fill="currentColor"><path fillRule="evenodd" d="M4.293 4.293a1 1 0 011.414 0L10 8.586l4.293-4.293a1 1 0 111.414 1.414L11.414 10l4.293 4.293a1 1 0 01-1.414 1.414L10 11.414l-4.293 4.293a1 1 0 01-1.414-1.414L8.586 10 4.293 5.707a1 1 0 010-1.414z" clipRule="evenodd" /></svg>
              </button>
            </div>
            <form onSubmit={handleCreateBoard} className="p-6 space-y-5">
              <div>
                <label className="block text-[11px] font-semibold text-zinc-500 uppercase tracking-widest mb-1.5">Board Name</label>
                <input type="text" required value={newBoardData.name} onChange={e => setNewBoardData({...newBoardData, name: e.target.value})} className="w-full px-4 py-3 text-sm border border-zinc-200 rounded-xl outline-none focus:border-indigo-400 focus:ring-4 focus:ring-indigo-500/10 transition-all bg-transparent hover:bg-zinc-50 focus:bg-white text-zinc-800 font-medium" placeholder="e.g. Engineering Sprints" />
              </div>
              <div>
                <label className="block text-[11px] font-semibold text-zinc-500 uppercase tracking-widest mb-1.5">Kanban Stages (Comma Separated)</label>
                <input type="text" required value={newBoardData.statuses} onChange={e => setNewBoardData({...newBoardData, statuses: e.target.value})} className="w-full px-4 py-3 text-sm border border-zinc-200 rounded-xl outline-none focus:border-indigo-400 focus:ring-4 focus:ring-indigo-500/10 transition-all bg-transparent hover:bg-zinc-50 focus:bg-white text-zinc-800 font-medium" placeholder="To Do, In Progress, Done" />
              </div>
              <div className="p-5 bg-zinc-50/80 border border-zinc-200 rounded-xl">
                <label className="block text-[11px] font-semibold text-indigo-600 uppercase tracking-widest mb-3">Link Databases (Optional)</label>
                <div className="max-h-40 overflow-y-auto space-y-2 pr-2">
                  {standardDatabases.length === 0 ? <p className="text-xs text-zinc-400 font-medium">No databases available to link.</p> : standardDatabases.map(db => (
                    <label key={db._id} className="flex items-center gap-2.5 cursor-pointer bg-white p-3 rounded-xl border border-zinc-200 hover:border-indigo-300 transition-colors shadow-sm">
                      <input type="checkbox" checked={newBoardData.linkedDatabases.includes(db._id)} onChange={() => toggleDatabaseLink(db._id)} className="w-4 h-4 text-indigo-600 rounded border-zinc-300" />
                      <span className="text-sm font-medium text-zinc-700">{db.name}</span>
                    </label>
                  ))}
                </div>
              </div>
              <div className="pt-3 flex justify-end gap-3 border-t border-zinc-100">
                <button type="button" onClick={() => setIsCreatingBoard(false)} className="px-5 py-2.5 text-sm font-medium text-zinc-600 hover:bg-zinc-100 rounded-xl transition-colors">Cancel</button>
                <button type="submit" disabled={isSubmittingBoard} className="px-6 py-2.5 bg-zinc-900 text-white rounded-xl text-sm font-medium hover:bg-zinc-800 shadow-sm transition-colors disabled:opacity-50">
                  {isSubmittingBoard ? 'Creating...' : 'Create Board'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* --- DEDICATED CREATE TASK MODAL --- */}
      {(isCreatingTask || isEditingTask) && (
        <div className="fixed inset-0 bg-zinc-900/40 backdrop-blur-sm flex items-center justify-center z-[70] p-4">
          <div className="bg-white rounded-2xl shadow-xl w-full max-w-xl overflow-hidden border border-zinc-200">
            <div className="px-6 py-5 border-b border-zinc-100 bg-zinc-50 flex justify-between items-center">
              <div>
                <span className="text-[10px] font-semibold text-indigo-600 uppercase tracking-widest bg-indigo-100/50 px-2 py-1 rounded border border-indigo-100">
                  {isEditingTask ? 'Edit Issue' : 'Create Issue'}
                </span>
                <h3 className="font-semibold tracking-tight text-zinc-800 mt-2">{selectedBoard?.name}</h3>
              </div>
              <button onClick={() => { setIsCreatingTask(false); setIsEditingTask(false); }} className="text-zinc-400 hover:text-zinc-600 bg-white p-1.5 rounded-lg border border-zinc-200 transition-colors shadow-sm">
                <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" viewBox="0 0 20 20" fill="currentColor"><path fillRule="evenodd" d="M4.293 4.293a1 1 0 011.414 0L10 8.586l4.293-4.293a1 1 0 111.414 1.414L11.414 10l4.293 4.293a1 1 0 01-1.414 1.414L10 11.414l-4.293 4.293a1 1 0 01-1.414-1.414L8.586 10 4.293 5.707a1 1 0 010-1.414z" clipRule="evenodd" /></svg>
              </button>
            </div>
            <form onSubmit={handleTaskSubmit} className="p-6 space-y-5 max-h-[75vh] overflow-y-auto">
              {titleField && (
                <div>
                  <label className="block text-[11px] font-semibold text-zinc-500 uppercase tracking-widest mb-1.5">{titleField.name}</label>
                  <input type="text" required value={taskFormData[titleField.name] || ''} onChange={e => setTaskFormData({...taskFormData, [titleField.name]: e.target.value})} className="w-full px-4 py-3 text-sm border border-zinc-200 rounded-xl outline-none focus:border-indigo-400 focus:ring-4 focus:ring-indigo-500/10 transition-all bg-transparent hover:bg-zinc-50 focus:bg-white text-zinc-800 font-medium" placeholder="What needs to be done?" />
                </div>
              )}
              {descField && (
                <div>
                  <label className="block text-[11px] font-semibold text-zinc-500 uppercase tracking-widest mb-1.5">{descField.name}</label>
                  <textarea value={taskFormData[descField.name] || ''} onChange={e => setTaskFormData({...taskFormData, [descField.name]: e.target.value})} className="w-full px-4 py-3 text-sm border border-zinc-200 rounded-xl outline-none focus:border-indigo-400 focus:ring-4 focus:ring-indigo-500/10 transition-all bg-transparent hover:bg-zinc-50 focus:bg-white text-zinc-800 font-medium min-h-[100px] resize-y" placeholder="Add details..." />
                </div>
              )}
              
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-5">
                {statusField && (
                  <div>
                    <label className="block text-[11px] font-semibold text-zinc-500 uppercase tracking-widest mb-1.5">Status</label>
                    <select value={taskFormData[statusField.name] || ''} onChange={e => setTaskFormData({...taskFormData, [statusField.name]: e.target.value})} className="w-full px-4 py-3 text-sm border border-zinc-200 rounded-xl bg-transparent hover:bg-zinc-50 focus:bg-white font-medium outline-none focus:border-indigo-400 transition-all">
                      {statusField.options.map(opt => <option key={opt} value={opt}>{opt}</option>)}
                    </select>
                  </div>
                )}
                {assigneeField && (
                  <div>
                    <label className="block text-[11px] font-semibold text-zinc-500 uppercase tracking-widest mb-1.5">Assignee</label>
                    <select 
                      value={taskFormData[assigneeField.name] || ''} 
                      onChange={e => setTaskFormData({...taskFormData, [assigneeField.name]: e.target.value})} 
                      disabled={!isUserAdmin}
                      className="w-full px-4 py-3 text-sm border border-zinc-200 rounded-xl bg-transparent hover:bg-zinc-50 focus:bg-white font-medium outline-none focus:border-indigo-400 disabled:opacity-60 disabled:cursor-not-allowed transition-all"
                    >
                      {!isUserAdmin && <option value={userIdStr}>Assign to Me</option>}
                      {isUserAdmin && <option value="">Unassigned</option>}
                      {isUserAdmin && workspaceUsers.map(u => <option key={u._id} value={u._id}>{u.name || u.email}</option>)}
                    </select>
                    {!isUserAdmin && <p className="text-[10px] text-amber-600 mt-1.5 font-medium">Only admins can assign tasks to others.</p>}
                  </div>
                )}
                {dateField && (
                  <div className="sm:col-span-2">
                    <label className="block text-[11px] font-semibold text-zinc-500 uppercase tracking-widest mb-1.5">Due Date</label>
                    <input type="date" value={taskFormData[dateField.name] ? taskFormData[dateField.name].split('T')[0] : ''} onChange={e => setTaskFormData({...taskFormData, [dateField.name]: e.target.value})} className="w-full px-4 py-3 text-sm border border-zinc-200 rounded-xl bg-transparent hover:bg-zinc-50 focus:bg-white font-medium outline-none focus:border-indigo-400 transition-all" />
                  </div>
                )}
              </div>

              {relationFields.length > 0 && (
                <div className="pt-5 border-t border-zinc-100">
                  <h4 className="text-[11px] font-semibold text-indigo-600 uppercase tracking-widest mb-3">Link Databases</h4>
                  <div className="space-y-4">
                    {relationFields.map(f => (
                      <div key={f.name}>
                        <label className="block text-[11px] font-semibold text-zinc-600 mb-1.5">{f.name}</label>
                        <select value={taskFormData[f.name] || ''} onChange={e => setTaskFormData({...taskFormData, [f.name]: e.target.value})} className="w-full px-4 py-3 text-sm border border-indigo-100 rounded-xl bg-indigo-50/50 font-medium outline-none focus:border-indigo-400 transition-all">
                          <option value="">Search {f.name}...</option>
                          {(allRecords[String(f.targetEntity)] || []).map(rec => {
                             const targetSchema = standardDatabases.find(d => String(d._id) === String(f.targetEntity));
                             const recTitle = targetSchema?.fields.find(tf => tf.type === 'text') || targetSchema?.fields[0];
                             return <option key={rec._id} value={rec._id}>{rec.data?.[recTitle?.name] || rec._id.slice(-6)}</option>;
                          })}
                        </select>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              <div className="pt-4 flex justify-end gap-3 border-t border-zinc-100 mt-2">
                <button type="button" onClick={() => { setIsCreatingTask(false); setIsEditingTask(false); }} className="px-5 py-2.5 text-sm font-medium text-zinc-600 hover:bg-zinc-100 rounded-xl transition-colors">Cancel</button>
                <button type="submit" disabled={isSavingTask} className="px-6 py-2.5 bg-zinc-900 text-white rounded-xl text-sm font-medium hover:bg-zinc-800 shadow-sm transition-colors disabled:opacity-50">
                  {isSavingTask ? 'Saving...' : (isEditingTask ? 'Save Changes' : 'Create Task')}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* --- INLINE VIEW / EDIT SLIDE-OVER --- */}
      {selectedTask && (
        <div className="absolute inset-y-0 right-0 w-full md:w-[450px] bg-white shadow-2xl border-l border-zinc-200 z-50 flex flex-col transform transition-transform duration-300">
          
          <div className="px-6 py-5 border-b border-zinc-100 flex justify-between items-center bg-zinc-50">
            <span className="text-[10px] font-semibold text-indigo-600 uppercase tracking-widest bg-indigo-100/50 px-2 py-1 rounded border border-indigo-100">Task Details</span>
            <div className="flex gap-2">
              <button onClick={openEditTaskForm} className="p-1.5 text-zinc-500 hover:text-indigo-600 bg-white border border-zinc-200 hover:border-indigo-200 shadow-sm rounded-lg transition-colors flex items-center gap-1.5 px-3">
                <svg xmlns="http://www.w3.org/2000/svg" className="h-3.5 w-3.5" viewBox="0 0 20 20" fill="currentColor"><path d="M13.586 3.586a2 2 0 112.828 2.828l-.793.793-2.828-2.828.793-.793zM11.379 5.793L3 14.172V17h2.828l8.38-8.379-2.83-2.828z" /></svg>
                <span className="text-xs font-semibold">Full Edit</span>
              </button>
              <button onClick={handleDeleteTask} className="p-1.5 text-zinc-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition-colors" title="Delete Task">
                <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" /></svg>
              </button>
              <button onClick={() => setSelectedTask(null)} className="p-1.5 text-zinc-400 hover:text-zinc-700 bg-white border border-zinc-200 shadow-sm rounded-lg transition-colors ml-1">
                <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" viewBox="0 0 20 20" fill="currentColor"><path fillRule="evenodd" d="M4.293 4.293a1 1 0 011.414 0L10 8.586l4.293-4.293a1 1 0 111.414 1.414L11.414 10l4.293 4.293a1 1 0 01-1.414 1.414L10 11.414l-4.293 4.293a1 1 0 01-1.414-1.414L8.586 10 4.293 5.707a1 1 0 010-1.414z" clipRule="evenodd" /></svg>
              </button>
            </div>
          </div>

          <div className="flex-1 overflow-y-auto">
            <div className="p-6 space-y-5 border-b border-zinc-200">
              
              {titleField && (
                <input 
                  type="text" 
                  value={selectedTask.data?.[titleField.name] || ''} 
                  onChange={(e) => handleInlineUpdate(titleField.name, e.target.value)}
                  className="w-full text-xl font-semibold tracking-tight text-zinc-900 border border-transparent hover:border-zinc-200 focus:border-indigo-400 rounded-xl outline-none transition-colors px-3 py-2 -ml-3 bg-transparent hover:bg-zinc-50 focus:bg-white"
                />
              )}

              <div className="grid grid-cols-2 gap-5 mt-2">
                {statusField && (
                  <div className="flex flex-col gap-1.5">
                    <span className="text-[11px] font-semibold text-zinc-400 uppercase tracking-wider pl-1">Status</span>
                    <select value={selectedTask.data?.[statusField.name] || ''} onChange={(e) => handleInlineUpdate(statusField.name, e.target.value)} className="px-3 py-2 text-sm font-medium border border-transparent hover:border-zinc-200 focus:border-indigo-400 rounded-xl bg-transparent hover:bg-zinc-50 outline-none transition-colors -ml-1">
                      {statusField.options.map(opt => <option key={opt} value={opt}>{opt}</option>)}
                    </select>
                  </div>
                )}
                {assigneeField && (
                  <div className="flex flex-col gap-1.5">
                    <span className="text-[11px] font-semibold text-zinc-400 uppercase tracking-wider pl-1">Assignee</span>
                    <select 
                      value={selectedTask.data?.[assigneeField.name] || ''} 
                      onChange={(e) => handleInlineUpdate(assigneeField.name, e.target.value)} 
                      disabled={!isUserAdmin && selectedTask.data?.[assigneeField.name] !== userIdStr}
                      className="px-3 py-2 text-sm font-medium border border-transparent hover:border-zinc-200 focus:border-indigo-400 rounded-xl bg-transparent hover:bg-zinc-50 outline-none disabled:opacity-60 transition-colors -ml-1"
                    >
                      <option value="">Unassigned</option>
                      {workspaceUsers.map(u => <option key={u._id} value={u._id}>{u.name || u.email}</option>)}
                    </select>
                  </div>
                )}
                {dateField && (
                  <div className="flex flex-col gap-1.5 col-span-2">
                    <span className="text-[11px] font-semibold text-zinc-400 uppercase tracking-wider pl-1">Due Date</span>
                    <input type="date" value={selectedTask.data?.[dateField.name] ? selectedTask.data[dateField.name].split('T')[0] : ''} onChange={(e) => handleInlineUpdate(dateField.name, e.target.value)} className="px-3 py-2 text-sm font-medium border border-transparent hover:border-zinc-200 focus:border-indigo-400 rounded-xl bg-transparent hover:bg-zinc-50 outline-none transition-colors -ml-1 w-full" />
                  </div>
                )}
              </div>

              {descField && (
                <div className="flex flex-col gap-1.5 pt-3">
                  <span className="text-[11px] font-semibold text-zinc-400 uppercase tracking-wider pl-1">Description</span>
                  <textarea 
                    value={selectedTask.data?.[descField.name] || ''} 
                    onChange={(e) => handleInlineUpdate(descField.name, e.target.value)}
                    className="w-full text-sm text-zinc-700 border border-transparent hover:border-zinc-200 focus:border-indigo-400 rounded-xl outline-none bg-transparent hover:bg-zinc-50 focus:bg-white transition-colors p-3 -ml-3 min-h-[120px] resize-y leading-relaxed"
                    placeholder="Add a more detailed description..."
                  />
                </div>
              )}

              {relationFields.length > 0 && (
                <div className="pt-4 border-t border-zinc-100">
                  <h4 className="text-[11px] font-semibold text-indigo-600 uppercase tracking-widest mb-3 pl-1">Linked Databases</h4>
                  <div className="space-y-4">
                    {relationFields.map(f => (
                      <div key={f.name} className="flex flex-col gap-1.5">
                        <span className="text-[11px] font-semibold text-zinc-500 uppercase pl-1">{f.name}</span>
                        <select 
                          value={selectedTask.data?.[f.name] || ''} 
                          onChange={e => handleInlineUpdate(f.name, e.target.value)} 
                          className="w-full px-3 py-2 text-sm font-medium border border-indigo-100 rounded-xl bg-indigo-50/50 outline-none focus:border-indigo-400 transition-colors"
                        >
                          <option value="">No Link</option>
                          {(allRecords[String(f.targetEntity)] || []).map(rec => {
                             const targetSchema = standardDatabases.find(d => String(d._id) === String(f.targetEntity));
                             const recTitle = targetSchema?.fields.find(tf => tf.type === 'text') || targetSchema?.fields[0];
                             return <option key={rec._id} value={rec._id}>{rec.data?.[recTitle?.name] || rec._id.slice(-6)}</option>;
                          })}
                        </select>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>

            <div className="p-6 bg-zinc-50/50 min-h-full">
              <h3 className="text-[11px] font-semibold text-zinc-400 uppercase tracking-widest mb-4">Activity & Comments</h3>
              <div className="space-y-4 mb-4">
                {(!selectedTask.comments || selectedTask.comments.length === 0) ? (
                  <div className="text-center py-8 border-2 border-dashed border-zinc-200 rounded-2xl bg-white">
                    <p className="text-xs font-semibold text-zinc-400">No activity yet.</p>
                  </div>
                ) : (
                  selectedTask.comments.map((comment, i) => (
                    <div key={i} className="bg-white rounded-xl p-4 border border-zinc-200 shadow-sm">
                      <div className="flex justify-between items-center mb-2">
                        <span className="text-xs font-semibold text-zinc-900">{comment.userName}</span>
                        <span className="text-[9px] font-semibold text-zinc-400 uppercase tracking-wider">{new Date(comment.createdAt).toLocaleDateString()}</span>
                      </div>
                      <p className="text-sm text-zinc-600 whitespace-pre-wrap leading-relaxed">{comment.text}</p>
                    </div>
                  ))
                )}
              </div>
            </div>
          </div>

          <div className="p-5 bg-white border-t border-zinc-200 shrink-0">
            <form onSubmit={handleAddComment} className="flex gap-2">
              <input 
                type="text" 
                placeholder="Write a comment..." 
                value={newComment} 
                onChange={(e) => setNewComment(e.target.value)} 
                className="flex-1 border border-zinc-200 rounded-xl px-4 py-3 text-sm outline-none focus:border-indigo-400 focus:ring-4 focus:ring-indigo-500/10 bg-zinc-50 focus:bg-white font-medium transition-all"
              />
              <button 
                type="submit" 
                disabled={isSubmittingComment || !newComment.trim()} 
                className="bg-indigo-600 text-white px-5 py-3 rounded-xl text-sm font-medium hover:bg-indigo-700 disabled:opacity-50 transition-colors shadow-sm"
              >
                Send
              </button>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}