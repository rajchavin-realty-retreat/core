import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import api from './api/axiosConfig';

export default function Dashboard() {
  const navigate = useNavigate();
  
  // --- CORE STATE ---
  const [workspaces, setWorkspaces] = useState([]);
  const [activeWorkspace, setActiveWorkspace] = useState(null);
  const [entities, setEntities] = useState([]);

  // --- FORM STATES ---
  const [newWorkspaceName, setNewWorkspaceName] = useState('');
  const [isCreatingEntity, setIsCreatingEntity] = useState(false);
  const [entityName, setEntityName] = useState('');
  const [entityFields, setEntityFields] = useState([{ name: '', type: 'text', optionsArray: [], tempOption: '' }]);

  // --- TEAM INVITE STATE ---
  const [inviteEmail, setInviteEmail] = useState('');
  const [inviteRole, setInviteRole] = useState('editor');
  const [isInviting, setIsInviting] = useState(false);

  // --- NEW: WORKSPACE SETTINGS STATE ---
  const [isSettingsOpen, setIsSettingsOpen] = useState(false);
  const [editWorkspaceName, setEditWorkspaceName] = useState('');
  const [isUpdatingWorkspace, setIsUpdatingWorkspace] = useState(false);

  const userInfo = JSON.parse(localStorage.getItem('userInfo'));

  // --- DATA FETCHING & AUTO-SELECT LOGIC ---
  const fetchWorkspaces = async () => {
    try {
      const res = await api.get('/workspaces');
      setWorkspaces(res.data);
      
      if (res.data.length > 0 && !activeWorkspace) {
        const validWs = res.data.find(ws => {
          if (ws.owner._id === userInfo?.id || ws.owner._id === userInfo?._id) return true;
          const me = ws.members.find(m => m.user._id === userInfo?.id || m.user._id === userInfo?._id);
          return me && me.status === 'accepted';
        });
        
        if (validWs) {
          setActiveWorkspace(validWs);
          fetchEntities(validWs._id);
        }
      }
    } catch (error) {
      console.error('Error fetching workspaces', error);
    }
  };

  const fetchEntities = async (workspaceId) => {
    try {
      const res = await api.get(`/entities/workspace/${workspaceId}`);
      setEntities(res.data);
    } catch (error) {
      console.error('Error fetching entities', error);
    }
  };

  useEffect(() => {
    fetchWorkspaces();
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  // --- FILTER WORKSPACES FOR SIDEBAR ---
  const pendingWorkspaces = workspaces.filter(ws => {
    if (ws.owner._id === userInfo?.id || ws.owner._id === userInfo?._id) return false;
    const me = ws.members.find(m => m.user._id === userInfo?.id || m.user._id === userInfo?._id);
    return me && me.status === 'pending';
  });

  const activeOrAcceptedWorkspaces = workspaces.filter(ws => {
    if (ws.owner._id === userInfo?.id || ws.owner._id === userInfo?._id) return true;
    const me = ws.members.find(m => m.user._id === userInfo?.id || m.user._id === userInfo?._id);
    return me && me.status === 'accepted';
  });

  // --- ROLE CALCULATION (THE BOUNCER) ---
  let currentUserRole = 'viewer'; 
  if (activeWorkspace && userInfo) {
    if (activeWorkspace.owner._id === userInfo?.id || activeWorkspace.owner._id === userInfo?._id) {
      currentUserRole = 'owner';
    } else {
      const memberMatch = activeWorkspace.members.find(m => m.user._id === userInfo?.id || m.user._id === userInfo?._id);
      if (memberMatch) currentUserRole = memberMatch.role;
    }
  }

  // --- HANDLERS: WORKSPACES & TEAM ---
  const handleCreateWorkspace = async (e) => {
    e.preventDefault();
    try {
      await api.post('/workspaces', { name: newWorkspaceName });
      setNewWorkspaceName('');
      fetchWorkspaces();
    } catch (error) { alert('Failed to create workspace'); }
  };

  const handleInvite = async (e) => {
    e.preventDefault();
    setIsInviting(true);
    try {
      await api.post(`/workspaces/${activeWorkspace._id}/invite`, { email: inviteEmail, role: inviteRole });
      alert('Invite sent!');
      setInviteEmail('');
      fetchWorkspaces(); 
    } catch (error) { alert(error.response?.data?.message || 'Invite failed'); } 
    finally { setIsInviting(false); }
  };

  const handleInviteResponse = async (workspaceId, status) => {
    try {
      await api.put(`/workspaces/${workspaceId}/invite/respond`, { status });
      fetchWorkspaces();
    } catch (error) {
      alert('Failed to respond to invite');
    }
  };

  // --- NEW: WORKSPACE SETTINGS HANDLERS (RENAME & NUKE) ---
  const openSettings = () => {
    setEditWorkspaceName(activeWorkspace.name);
    setIsSettingsOpen(true);
  };

  const handleRenameWorkspace = async (e) => {
    e.preventDefault();
    setIsUpdatingWorkspace(true);
    try {
      await api.put(`/workspaces/${activeWorkspace._id}`, { name: editWorkspaceName });
      setIsSettingsOpen(false);
      
      // Update local state instantly for snappy UI
      setActiveWorkspace(prev => ({ ...prev, name: editWorkspaceName }));
      fetchWorkspaces(); 
    } catch (error) {
      alert('Failed to rename workspace');
    } finally {
      setIsUpdatingWorkspace(false);
    }
  };

  const handleDeleteWorkspace = async () => {
    const confirmName = window.prompt(`NUKE INITIATED: This will permanently delete "${activeWorkspace.name}", ALL its databases, and ALL files. Type the workspace name exactly to confirm:`);
    
    if (confirmName === activeWorkspace.name) {
      try {
        await api.delete(`/workspaces/${activeWorkspace._id}`);
        alert('Workspace and all data permanently destroyed.');
        setIsSettingsOpen(false);
        setActiveWorkspace(null); // Clear the screen
        fetchWorkspaces(); 
      } catch (error) {
        alert(error.response?.data?.message || 'Failed to delete workspace');
      }
    } else if (confirmName !== null) {
      alert('Name did not match. Self-destruct cancelled.');
    }
  };

  // --- HANDLERS: DATABASES (ENTITIES) ---
  const handleCreateEntity = async (e) => {
    e.preventDefault();
    const formattedFields = entityFields.map(field => {
      if (field.type === 'dropdown') return { name: field.name, type: field.type, options: field.optionsArray || [] };
      return { name: field.name, type: field.type };
    });

    try {
      await api.post('/entities', { workspaceId: activeWorkspace._id, name: entityName, fields: formattedFields });
      setIsCreatingEntity(false);
      setEntityName('');
      setEntityFields([{ name: '', type: 'text', optionsArray: [], tempOption: '' }]);
      fetchEntities(activeWorkspace._id);
    } catch (error) { alert('Failed to create database'); }
  };

  const handleDeleteDatabase = async (e, entityId, entityName) => {
    e.stopPropagation(); 
    const confirmName = window.prompt(`DANGER ZONE: This will permanently delete the "${entityName}" database and ALL its records and files. Type the database name exactly to confirm:`);
    
    if (confirmName === entityName) {
      try {
        await api.delete(`/entities/${entityId}`);
        alert('Database completely wiped.');
        fetchEntities(activeWorkspace._id);
      } catch (error) {
        alert(error.response?.data?.message || 'Failed to delete database');
      }
    }
  };

  // --- SCHEMA BUILDER LOGIC ---
  const addFieldToSchema = () => setEntityFields([...entityFields, { name: '', type: 'text', optionsArray: [], tempOption: '' }]);
  const removeFieldFromSchema = (indexToRemove) => setEntityFields(entityFields.filter((_, index) => index !== indexToRemove));
  const updateField = (index, key, value) => {
    const updatedFields = [...entityFields];
    updatedFields[index][key] = value;
    setEntityFields(updatedFields);
  };
  const addDropdownOption = (index) => {
    const val = (entityFields[index].tempOption || '').trim();
    if (val) {
      const updatedFields = [...entityFields];
      if (!updatedFields[index].optionsArray) updatedFields[index].optionsArray = [];
      if (!updatedFields[index].optionsArray.includes(val)) updatedFields[index].optionsArray.push(val);
      updatedFields[index].tempOption = ''; 
      setEntityFields(updatedFields);
    }
  };
  const removeDropdownOption = (fieldIndex, optionIndex) => {
    const updatedFields = [...entityFields];
    updatedFields[fieldIndex].optionsArray.splice(optionIndex, 1);
    setEntityFields(updatedFields);
  };

  const handleLogout = () => {
    localStorage.removeItem('userInfo');
    window.location.href = '/login';
  };

  return (
    <div className="min-h-screen p-8 max-w-6xl mx-auto font-sans bg-gray-50">
      
      {/* HEADER */}
      <header className="mb-8 flex justify-between items-center">
        <div>
          <h1 className="text-3xl font-bold text-gray-800">Rajchavin CRM</h1>
          <div className="flex items-center gap-3 mt-1">
            <p className="text-gray-500 font-medium">Workspace: {activeWorkspace?.name || 'Select one'}</p>
            
            {/* NEW: SETTINGS GEAR ICON (Owners Only) */}
            {activeWorkspace && currentUserRole === 'owner' && (
              <button 
                onClick={openSettings} 
                className="text-gray-400 hover:text-gray-700 transition-colors bg-white border border-gray-200 rounded p-1 shadow-sm"
                title="Workspace Settings"
              >
                <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" />
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                </svg>
              </button>
            )}
          </div>
        </div>
        <div className="flex gap-4 items-center">
          <span className="text-sm font-medium text-gray-500 uppercase tracking-wider bg-gray-200 px-3 py-1 rounded-full">
            Role: {currentUserRole}
          </span>
          <button onClick={handleLogout} className="bg-red-50 text-red-600 py-2 px-4 rounded-lg font-medium hover:bg-red-100 transition-colors">
            Sign Out
          </button>
        </div>
      </header>

      {/* --- SIDEBAR & MAIN PANEL --- */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-8">
        
        <div className="md:col-span-1">
          {/* PENDING INVITES INBOX */}
          {pendingWorkspaces.length > 0 && (
            <div className="bg-yellow-50 p-4 rounded-xl shadow-sm border border-yellow-200 mb-6 relative overflow-hidden">
              <div className="absolute top-0 left-0 w-full h-1 bg-yellow-400"></div>
              <h2 className="text-xs font-bold text-yellow-800 uppercase tracking-wider mb-3 flex items-center gap-2">
                <span className="bg-yellow-500 w-2 h-2 rounded-full animate-pulse"></span>
                Action Required ({pendingWorkspaces.length})
              </h2>
              <ul className="flex flex-col gap-3">
                {pendingWorkspaces.map(ws => (
                  <li key={ws._id} className="bg-white p-3 rounded-lg border border-yellow-200 text-sm shadow-sm">
                    <p className="font-bold text-gray-800 truncate">{ws.name}</p>
                    <p className="text-xs text-gray-500 mb-3 truncate">Invited by: {ws.owner.name}</p>
                    <div className="flex gap-2">
                      <button onClick={() => handleInviteResponse(ws._id, 'accepted')} className="flex-1 bg-green-600 text-white py-1.5 rounded text-xs font-bold hover:bg-green-700 transition-colors">Accept</button>
                      <button onClick={() => handleInviteResponse(ws._id, 'declined')} className="flex-1 bg-red-50 text-red-600 py-1.5 rounded text-xs font-bold hover:bg-red-100 transition-colors">Decline</button>
                    </div>
                  </li>
                ))}
              </ul>
            </div>
          )}

          {/* MY WORKSPACES */}
          <div className="bg-white p-6 rounded-xl shadow-sm border border-gray-100 mb-6">
            <h2 className="text-sm font-bold text-gray-400 uppercase tracking-wider mb-4">My Workspaces</h2>
            <ul className="flex flex-col gap-2 mb-6">
              {activeOrAcceptedWorkspaces.map(ws => (
                <li key={ws._id} onClick={() => { setActiveWorkspace(ws); fetchEntities(ws._id); setIsCreatingEntity(false); }}
                  className={`p-3 rounded-lg cursor-pointer border transition-all ${activeWorkspace?._id === ws._id ? 'border-blue-500 bg-blue-50 text-blue-700 font-bold' : 'border-transparent hover:bg-gray-50'}`}>
                  {ws.name}
                </li>
              ))}
              {activeOrAcceptedWorkspaces.length === 0 && (
                 <p className="text-xs text-gray-400 italic">No active workspaces.</p>
              )}
            </ul>
            <form onSubmit={handleCreateWorkspace} className="flex flex-col gap-2 border-t pt-4">
              <input type="text" placeholder="New Workspace" required value={newWorkspaceName} 
                onChange={e => setNewWorkspaceName(e.target.value)} className="px-3 py-2 border rounded-lg text-sm bg-gray-50" />
              <button type="submit" className="bg-gray-800 hover:bg-gray-900 text-white py-2 rounded-lg text-sm font-medium transition-colors">
                Create
              </button>
            </form>
          </div>

          {/* MANAGE TEAM SECTION */}
          {activeWorkspace && currentUserRole === 'owner' && (
            <div className="bg-white p-6 rounded-xl shadow-sm border border-gray-100">
              <h2 className="text-sm font-bold text-gray-400 uppercase tracking-wider mb-4">Invite Team</h2>
              <form onSubmit={handleInvite} className="flex flex-col gap-2">
                <input type="email" placeholder="Colleague's Email" required value={inviteEmail} onChange={(e) => setInviteEmail(e.target.value)} className="px-3 py-2 border rounded-lg text-sm bg-gray-50" />
                <select value={inviteRole} onChange={(e) => setInviteRole(e.target.value)} className="px-3 py-2 border rounded-lg text-sm bg-gray-50">
                  <option value="editor">Editor</option>
                  <option value="viewer">Viewer</option>
                  <option value="admin">Admin</option>
                </select>
                <button type="submit" disabled={isInviting} className="bg-blue-600 hover:bg-blue-700 text-white py-2 rounded-lg text-sm font-medium transition-colors disabled:bg-blue-400">
                  {isInviting ? 'Sending...' : 'Send Invite'}
                </button>
              </form>

              {activeWorkspace.members.length > 0 && (
                <div className="mt-4 pt-4 border-t border-gray-100">
                  <p className="text-[10px] text-gray-400 font-bold mb-2 uppercase tracking-wider">Current Roster:</p>
                  <ul className="text-sm text-gray-700 space-y-2">
                    {activeWorkspace.members.map((m, i) => (
                      <li key={i} className="flex justify-between items-center bg-gray-50 p-2 rounded">
                        <div className="flex flex-col truncate pr-2">
                          <span className="font-medium text-xs">{m.user?.name || 'Pending User'}</span>
                          <span className={`text-[10px] ${m.status === 'pending' ? 'text-yellow-600' : 'text-green-600'}`}>
                            {m.status === 'pending' ? '⏳ Pending' : '✓ Accepted'}
                          </span>
                        </div>
                        <span className="text-blue-600 font-bold text-[10px] uppercase bg-blue-50 px-2 py-1 rounded">{m.role}</span>
                      </li>
                    ))}
                  </ul>
                </div>
              )}
            </div>
          )}
        </div>

        <div className="md:col-span-3">
          {activeWorkspace ? (
            <div className="flex flex-col gap-6">
              
              <div className="bg-white p-6 rounded-xl shadow-sm border border-gray-100">
                <div className="flex justify-between items-center mb-6">
                  <h2 className="text-xl font-bold text-gray-800">Databases</h2>
                  {(currentUserRole === 'owner' || currentUserRole === 'admin') && (
                    <button onClick={() => setIsCreatingEntity(!isCreatingEntity)} className="bg-blue-600 hover:bg-blue-700 transition-colors text-white py-2 px-4 rounded-lg text-sm font-bold shadow-sm">
                      {isCreatingEntity ? 'Cancel' : '+ Create New'}
                    </button>
                  )}
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  {entities.map(entity => (
                    <div key={entity._id} onClick={() => navigate(`/crm/${entity._id}`)} className="p-6 border border-gray-100 rounded-xl hover:shadow-md hover:border-blue-200 cursor-pointer bg-gray-50 hover:bg-blue-50/30 transition-all relative group">
                      <h3 className="font-bold text-gray-800 text-lg pr-8">{entity.name}</h3>
                      <p className="text-xs text-gray-500 mt-2 font-medium">{entity.fields.length} Custom Fields</p>
                      
                      {(currentUserRole === 'owner' || currentUserRole === 'admin') && (
                        <button onClick={(e) => handleDeleteDatabase(e, entity._id, entity.name)} className="absolute top-4 right-4 text-gray-300 hover:text-red-600 opacity-0 group-hover:opacity-100 transition-all bg-white rounded p-1" title="Delete Database">
                          <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" /></svg>
                        </button>
                      )}
                    </div>
                  ))}
                  {entities.length === 0 && !isCreatingEntity && (
                    <div className="col-span-2 text-center py-8 text-gray-400 italic">No databases created in this workspace yet.</div>
                  )}
                </div>
              </div>

              {/* SCHEMA BUILDER UI */}
              {isCreatingEntity && (currentUserRole === 'owner' || currentUserRole === 'admin') && (
                <div className="bg-white p-6 rounded-xl shadow-sm border-2 border-blue-100 relative overflow-hidden">
                  <div className="absolute top-0 left-0 w-full h-1 bg-blue-500"></div>
                  <h2 className="text-lg font-bold text-gray-800 mb-4">Schema Builder</h2>
                  <form onSubmit={handleCreateEntity} className="flex flex-col gap-6">
                    <input type="text" placeholder="Database Name (e.g. HR Candidates)" required value={entityName} onChange={e => setEntityName(e.target.value)} className="w-full px-4 py-3 border rounded-lg text-lg shadow-sm focus:ring-2 focus:ring-blue-500 outline-none" />
                    
                    <div className="space-y-4">
                      {entityFields.map((field, index) => (
                        <div key={index} className="p-4 bg-gray-50 rounded-lg border border-gray-200 relative group">
                          <div className="flex gap-3 mb-3">
                            <input type="text" placeholder="Field Name (e.g. Status)" required value={field.name} onChange={(e) => updateField(index, 'name', e.target.value)} className="flex-1 px-3 py-2 border rounded-lg outline-none focus:border-blue-500" />
                            <select value={field.type} onChange={(e) => updateField(index, 'type', e.target.value)} className="px-3 py-2 border rounded-lg bg-white outline-none focus:border-blue-500">
                              <option value="text">Short Text</option>
                              <option value="textarea">Long Text</option>
                              <option value="number">Number</option>
                              <option value="date">Date</option>
                              <option value="datetime">Date & Time</option>
                              <option value="checkbox">Checkbox (Yes/No)</option>
                              <option value="dropdown">Dropdown</option>
                              <option value="media">Single File</option>
                              <option value="media-multiple">Gallery (Multi-file)</option>
                            </select>
                            {entityFields.length > 1 && (
                              <button type="button" onClick={() => removeFieldFromSchema(index)} className="text-gray-400 hover:text-red-500 font-bold px-2 transition-colors">×</button>
                            )}
                          </div>

                          {field.type === 'dropdown' && (
                            <div className="bg-white p-3 rounded border border-blue-100 shadow-sm mt-2">
                              <label className="text-[10px] font-bold text-blue-800 uppercase mb-2 block">Configure Dropdown Options</label>
                              <div className="flex flex-wrap gap-2 mb-2">
                                {field.optionsArray?.map((opt, i) => (
                                  <span key={i} className="bg-blue-600 text-white text-xs px-2 py-1 rounded shadow-sm flex items-center gap-1">
                                    {opt} <button type="button" onClick={() => removeDropdownOption(index, i)} className="text-blue-200 hover:text-white ml-1">×</button>
                                  </span>
                                ))}
                              </div>
                              <div className="flex gap-2">
                                <input type="text" placeholder="Type an option and hit Enter..." value={field.tempOption || ''} onChange={(e) => updateField(index, 'tempOption', e.target.value)} onKeyDown={(e) => { if(e.key === 'Enter') { e.preventDefault(); addDropdownOption(index); }}} className="flex-1 text-sm px-3 py-2 border rounded-lg outline-none focus:border-blue-500" />
                                <button type="button" onClick={() => addDropdownOption(index)} className="text-sm font-medium bg-gray-100 hover:bg-gray-200 text-gray-800 px-4 py-2 rounded-lg transition-colors">Add</button>
                              </div>
                            </div>
                          )}
                        </div>
                      ))}
                    </div>
                    <button type="button" onClick={addFieldToSchema} className="text-blue-600 hover:text-blue-800 font-bold text-sm w-fit transition-colors">+ Add Another Field</button>
                    <button type="submit" className="bg-green-600 hover:bg-green-700 text-white py-3 rounded-lg font-bold text-lg shadow-sm transition-colors mt-2">Deploy Database</button>
                  </form>
                </div>
              )}
            </div>
          ) : (
            <div className="bg-white p-12 text-center rounded-xl border border-gray-100 shadow-sm flex flex-col items-center justify-center h-full min-h-[400px]">
              <div className="bg-gray-50 p-4 rounded-full mb-4">
                <svg xmlns="http://www.w3.org/2000/svg" className="h-8 w-8 text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 11H5m14 0a2 2 0 012 2v6a2 2 0 01-2 2H5a2 2 0 01-2-2v-6a2 2 0 012-2m14 0V9a2 2 0 00-2-2M5 11V9a2 2 0 002-2m0 0V5a2 2 0 012-2h6a2 2 0 012 2v2M7 7h10" /></svg>
              </div>
              <h2 className="text-xl font-bold text-gray-800 mb-2">Ready to Build</h2>
              <p className="text-gray-500 max-w-sm text-sm">Select an active workspace from the sidebar, accept a pending invite, or create a brand new space to get started.</p>
            </div>
          )}
        </div>
      </div>

      {/* --- NEW: WORKSPACE SETTINGS MODAL --- */}
      {isSettingsOpen && (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-xl shadow-2xl w-full max-w-lg overflow-hidden">
            
            <div className="flex justify-between items-center p-6 border-b border-gray-100 bg-gray-50">
              <h3 className="text-xl font-bold text-gray-800 flex items-center gap-2">
                <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5 text-gray-500" viewBox="0 0 20 20" fill="currentColor"><path fillRule="evenodd" d="M11.49 3.17c-.38-1.56-2.6-1.56-2.98 0a1.532 1.532 0 01-2.286.948c-1.372-.836-2.942.734-2.106 2.106.54.886.061 2.042-.947 2.287-1.561.379-1.561 2.6 0 2.978a1.532 1.532 0 01.947 2.287c-.836 1.372.734 2.942 2.106 2.106a1.532 1.532 0 012.287.947c.379 1.561 2.6 1.561 2.978 0a1.533 1.533 0 012.287-.947c1.372.836 2.942-.734 2.106-2.106a1.533 1.533 0 01.947-2.287c1.561-.379 1.561-2.6 0-2.978a1.532 1.532 0 01-.947-2.287c.836-1.372-.734-2.942-2.106-2.106a1.532 1.532 0 01-2.287-.947zM10 13a3 3 0 100-6 3 3 0 000 6z" clipRule="evenodd" /></svg>
                Workspace Settings
              </h3>
              <button onClick={() => setIsSettingsOpen(false)} className="text-gray-400 hover:text-gray-600">
                <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" /></svg>
              </button>
            </div>

            <div className="p-6">
              {/* RENAME SECTION */}
              <form onSubmit={handleRenameWorkspace} className="mb-8">
                <label className="block text-sm font-bold text-gray-700 mb-2">Rename Workspace</label>
                <div className="flex gap-3">
                  <input 
                    type="text" 
                    value={editWorkspaceName} 
                    onChange={(e) => setEditWorkspaceName(e.target.value)} 
                    required
                    className="flex-1 px-4 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500 outline-none" 
                  />
                  <button 
                    type="submit" 
                    disabled={isUpdatingWorkspace || editWorkspaceName === activeWorkspace.name}
                    className="bg-blue-600 text-white px-6 py-2 rounded-lg font-bold hover:bg-blue-700 transition-colors disabled:bg-blue-400"
                  >
                    {isUpdatingWorkspace ? 'Saving...' : 'Save'}
                  </button>
                </div>
              </form>

              {/* DANGER ZONE SECTION */}
              <div className="border border-red-200 bg-red-50 rounded-xl p-5 relative overflow-hidden">
                <div className="absolute top-0 left-0 w-1 h-full bg-red-500"></div>
                <h4 className="text-red-800 font-bold mb-1">Danger Zone</h4>
                <p className="text-xs text-red-600/80 mb-4">
                  Permanently delete this workspace, all its databases, and all records. This action cannot be undone.
                </p>
                <button 
                  onClick={handleDeleteWorkspace}
                  className="bg-red-600 text-white px-4 py-2 rounded font-bold text-sm hover:bg-red-700 transition-colors shadow-sm w-full"
                >
                  Delete Workspace
                </button>
              </div>
            </div>
            
          </div>
        </div>
      )}
    </div>
  );
}