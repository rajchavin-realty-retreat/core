import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import api from './api/axiosConfig';
import AnalyticsView from './components/AnalyticsView';

export default function Dashboard() {
  const navigate = useNavigate();
  
  // --- CORE STATE ---
  const [workspaces, setWorkspaces] = useState([]);
  const [activeWorkspace, setActiveWorkspace] = useState(null);
  const [entities, setEntities] = useState([]);

  // --- UI STATE ---
  const [activeTab, setActiveTab] = useState('overview'); 
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false); 

  // --- FORM STATES ---
  const [newWorkspaceName, setNewWorkspaceName] = useState('');
  const [isCreatingEntity, setIsCreatingEntity] = useState(false);
  const [entityName, setEntityName] = useState('');
  const [entityFields, setEntityFields] = useState([{ name: '', type: 'text', optionsArray: [], tempOption: '', targetEntity: '' }]);

  // --- TEAM INVITE STATE ---
  const [inviteEmail, setInviteEmail] = useState('');
  const [inviteRole, setInviteRole] = useState(''); 
  const [isInviting, setIsInviting] = useState(false);

  // --- WORKSPACE SETTINGS & ROLES STATE ---
  const [isSettingsOpen, setIsSettingsOpen] = useState(false);
  const [settingsTab, setSettingsTab] = useState('general'); 
  const [editWorkspaceName, setEditWorkspaceName] = useState('');
  const [isUpdatingWorkspace, setIsUpdatingWorkspace] = useState(false);

  const [isCreatingRole, setIsCreatingRole] = useState(false);
  const [newRole, setNewRole] = useState({
    name: '',
    permissions: {
      viewAllRecords: false, viewOwnRecords: true,
      createRecords: false,
      editAllRecords: false, editOwnRecords: false,
      deleteAllRecords: false, deleteOwnRecords: false,
      manageDatabases: false, manageTeam: false
    }
  });

  const userInfo = JSON.parse(localStorage.getItem('userInfo'));

  // --- DATA FETCHING ---
  const fetchWorkspaces = async () => {
    try {
      const res = await api.get('/workspaces');
      setWorkspaces(res.data);
      
      // Smart State Update: If we already have an active workspace, update it silently!
      if (activeWorkspace) {
        const updatedWs = res.data.find(w => w._id === activeWorkspace._id);
        if (updatedWs) setActiveWorkspace(updatedWs);
      } else if (res.data.length > 0) {
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
    } catch (error) { console.error('Error fetching workspaces', error); }
  };

  const fetchEntities = async (workspaceId) => {
    try {
      const res = await api.get(`/entities/workspace/${workspaceId}`);
      setEntities(res.data);
    } catch (error) { console.error('Error fetching entities', error); }
  };

  useEffect(() => {
    fetchWorkspaces();
  }, []); 

  // --- FILTER WORKSPACES ---
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

  // --- ROLE & PERMISSION CALCULATION ---
  let isOwner = false;
  let currentUserRoleDisplay = 'Member'; 
  let canManageDatabases = false;
  let canManageTeam = false;

  if (activeWorkspace && userInfo) {
    if (activeWorkspace.owner._id === userInfo?.id || activeWorkspace.owner._id === userInfo?._id) {
      isOwner = true;
      currentUserRoleDisplay = 'Owner';
      canManageDatabases = true;
      canManageTeam = true;
    } else {
      const me = activeWorkspace.members.find(m => m.user._id === userInfo?.id || m.user._id === userInfo?._id);
      if (me && activeWorkspace.customRoles) {
        const myRole = activeWorkspace.customRoles.find(r => r._id === me.roleId);
        if (myRole) {
          currentUserRoleDisplay = myRole.name;
          canManageDatabases = myRole.permissions.manageDatabases;
          canManageTeam = myRole.permissions.manageTeam;
        }
      }
    }
  }

  // --- HANDLERS ---
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
    if (!inviteRole) return alert("Please select a custom role for this user.");
    setIsInviting(true);
    try {
      await api.post(`/workspaces/${activeWorkspace._id}/invite`, { email: inviteEmail, roleId: inviteRole });
      setInviteEmail('');
      setInviteRole('');
      fetchWorkspaces(); 
    } catch (error) { alert(error.response?.data?.message || 'Invite failed'); } 
    finally { setIsInviting(false); }
  };

  // FIX: Immediate State Injection for creating roles
  const handleCreateRole = async (e) => {
    e.preventDefault();
    try {
      const res = await api.post(`/workspaces/${activeWorkspace._id}/roles`, newRole);
      
      // Inject the updated workspace directly into state (No refresh needed!)
      setActiveWorkspace(res.data.workspace);
      setWorkspaces(prev => prev.map(ws => ws._id === activeWorkspace._id ? res.data.workspace : ws));
      
      setIsCreatingRole(false);
      setNewRole({
        name: '',
        permissions: {
          viewAllRecords: false, viewOwnRecords: true, createRecords: false,
          editAllRecords: false, editOwnRecords: false, deleteAllRecords: false,
          deleteOwnRecords: false, manageDatabases: false, manageTeam: false
        }
      });
    } catch (error) {
      alert("Failed to create role: " + (error.response?.data?.message || error.message));
    }
  };

  // NEW: Handle Delete Role
  const handleDeleteRole = async (roleId, roleName) => {
    if (!window.confirm(`Are you sure you want to delete the "${roleName}" role? Any members currently assigned to it will lose their permissions.`)) return;

    try {
      const res = await api.delete(`/workspaces/${activeWorkspace._id}/roles/${roleId}`);
      
      // Inject the updated workspace directly into state (UI removes the role instantly!)
      setActiveWorkspace(res.data.workspace);
      setWorkspaces(prev => prev.map(ws => ws._id === activeWorkspace._id ? res.data.workspace : ws));
    } catch (error) {
      alert(error.response?.data?.message || 'Failed to delete role');
    }
  };

  const togglePermission = (key) => {
    setNewRole(prev => ({ ...prev, permissions: { ...prev.permissions, [key]: !prev.permissions[key] } }));
  };

  const handleInviteResponse = async (workspaceId, status) => {
    try {
      await api.put(`/workspaces/${workspaceId}/invite/respond`, { status });
      fetchWorkspaces();
    } catch (error) { alert('Failed to respond to invite'); }
  };

  const openSettings = () => {
    setEditWorkspaceName(activeWorkspace.name);
    setSettingsTab('general');
    setIsSettingsOpen(true);
  };

  const handleRenameWorkspace = async (e) => {
    e.preventDefault();
    setIsUpdatingWorkspace(true);
    try {
      await api.put(`/workspaces/${activeWorkspace._id}`, { name: editWorkspaceName });
      setIsSettingsOpen(false);
      setActiveWorkspace(prev => ({ ...prev, name: editWorkspaceName }));
      fetchWorkspaces(); 
    } catch (error) { alert('Failed to rename workspace'); } 
    finally { setIsUpdatingWorkspace(false); }
  };

  const handleDeleteWorkspace = async () => {
    const confirmName = window.prompt(`Type "${activeWorkspace.name}" to confirm workspace deletion:`);
    if (confirmName === activeWorkspace.name) {
      try {
        await api.delete(`/workspaces/${activeWorkspace._id}`);
        setIsSettingsOpen(false);
        setActiveWorkspace(null);
        fetchWorkspaces(); 
      } catch (error) { alert(error.response?.data?.message || 'Failed to delete workspace'); }
    }
  };

  const handleCreateEntity = async (e) => {
    e.preventDefault();
    try {
      const names = entityFields.map(f => f.name.trim());
      if (names.includes('')) throw new Error("All columns must have a name before deploying.");
      const uniqueNames = new Set(names);
      if (uniqueNames.size !== names.length) throw new Error("You have duplicate column names! Every column must be unique.");

      const formattedFields = entityFields.map(field => {
        if (field.type === 'dropdown') return { name: field.name, type: field.type, options: field.optionsArray || [] };
        if (field.type === 'relation') {
          if (!field.targetEntity) throw new Error(`You must select a Target Database for the "${field.name}" column.`);
          return { name: field.name, type: field.type, targetEntity: field.targetEntity };
        }
        return { name: field.name, type: field.type };
      });

      await api.post('/entities', { workspaceId: activeWorkspace._id, name: entityName, fields: formattedFields });
      
      setIsCreatingEntity(false);
      setEntityName('');
      setEntityFields([{ name: '', type: 'text', optionsArray: [], tempOption: '', targetEntity: '' }]);
      fetchEntities(activeWorkspace._id);
      setActiveTab('databases'); 
    } catch (error) { alert(error.message || error.response?.data?.message || 'Failed to create database'); }
  };

  const handleDeleteDatabase = async (e, entityId, entityName) => {
    e.stopPropagation(); 
    if (window.confirm(`Delete the database "${entityName}" and all its records?`)) {
      try {
        await api.delete(`/entities/${entityId}`);
        fetchEntities(activeWorkspace._id);
      } catch (error) { alert(error.response?.data?.message || 'Failed to delete database'); }
    }
  };

  const addFieldToSchema = () => setEntityFields([...entityFields, { name: '', type: 'text', optionsArray: [], tempOption: '', targetEntity: '' }]);
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

  const selectWorkspace = (ws) => {
    setActiveWorkspace(ws);
    fetchEntities(ws._id);
    setIsCreatingEntity(false);
    setIsMobileMenuOpen(false); 
  };

  return (
    <div className="flex h-screen w-full bg-[#FBFBFC] text-zinc-900 font-sans overflow-hidden">
      
      {isMobileMenuOpen && (
        <div className="fixed inset-0 bg-zinc-900/40 backdrop-blur-sm z-40 lg:hidden" onClick={() => setIsMobileMenuOpen(false)}></div>
      )}

      {/* LEFT SIDEBAR */}
      <aside className={`fixed inset-y-0 left-0 z-50 w-64 bg-zinc-50 border-r border-zinc-200 flex flex-col flex-shrink-0 transform transition-transform duration-300 ease-in-out lg:relative lg:translate-x-0 ${isMobileMenuOpen ? 'translate-x-0' : '-translate-x-full'}`}>
        <div className="h-14 flex items-center px-4 border-b border-zinc-200 justify-between">
          <div className="font-semibold text-sm text-zinc-800 tracking-tight">Rajchavin CRM</div>
          <div className="flex items-center gap-2">
            <button onClick={handleLogout} className="text-xs text-zinc-500 hover:text-zinc-800 font-medium transition-colors">Logout</button>
            <button onClick={() => setIsMobileMenuOpen(false)} className="lg:hidden text-zinc-400 hover:text-zinc-600">
              <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" viewBox="0 0 20 20" fill="currentColor"><path fillRule="evenodd" d="M4.293 4.293a1 1 0 011.414 0L10 8.586l4.293-4.293a1 1 0 111.414 1.414L11.414 10l4.293 4.293a1 1 0 01-1.414 1.414L10 11.414l-4.293 4.293a1 1 0 01-1.414-1.414L8.586 10 4.293 5.707a1 1 0 010-1.414z" clipRule="evenodd" /></svg>
            </button>
          </div>
        </div>

        <div className="flex-1 overflow-y-auto p-3 space-y-6">
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

          <div>
            <h3 className="text-[11px] font-semibold text-zinc-400 uppercase tracking-wider mb-2 px-2">Workspaces</h3>
            <ul className="space-y-0.5">
              {activeOrAcceptedWorkspaces.map(ws => (
                <li key={ws._id} onClick={() => selectWorkspace(ws)}
                  className={`px-2 py-1.5 rounded-md cursor-pointer text-sm transition-colors flex items-center justify-between ${activeWorkspace?._id === ws._id ? 'bg-zinc-200/50 text-zinc-900 font-medium' : 'text-zinc-600 hover:bg-zinc-100 hover:text-zinc-900'}`}>
                  <span className="truncate">{ws.name}</span>
                  {activeWorkspace?._id === ws._id && isOwner && (
                    <button onClick={(e) => { e.stopPropagation(); openSettings(); }} className="text-zinc-400 hover:text-zinc-800 p-1">
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
                      {activeWorkspace.customRoles.map(role => (
                         <option key={role._id} value={role._id}>{role.name}</option>
                      ))}
                    </select>
                    <button type="submit" disabled={isInviting} className="bg-zinc-100 text-zinc-700 border border-zinc-200 px-3 py-1 rounded text-xs font-medium hover:bg-zinc-200 transition-colors disabled:opacity-50">Invite</button>
                  </div>
                </form>
              )}

              <ul className="space-y-1 px-2 text-xs">
                {activeWorkspace.members.map((m, i) => {
                  // FIX: Force both sides to be strings so the equality check never fails
                  const assignedRole = activeWorkspace.customRoles?.find(
                    r => String(r._id) === String(m.roleId)
                  );
                  
                  return (
                    <li key={i} className="flex justify-between items-center py-1">
                      <div className="truncate flex-1">
                        <span className="text-zinc-700 font-medium">{m.user?.name || m.user?.email || 'Pending'}</span>
                        {m.status === 'pending' && <span className="ml-1 text-[9px] text-amber-600 bg-amber-50 px-1 rounded border border-amber-100">Pending</span>}
                      </div>
                      <span className="text-[9px] text-zinc-500 uppercase font-semibold border border-zinc-200 px-1.5 py-0.5 rounded bg-white">
                        {/* If they are the owner, they might not have a roleId, so we can gracefully handle that too */}
                        {assignedRole ? assignedRole.name : 'Unknown'}
                      </span>
                    </li>
                  );
                })}
              </ul>
            </div>
          )}
        </div>
      </aside>

      {/* MAIN PANEL */}
      <main className="flex-1 flex flex-col min-w-0">
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
              <button onClick={() => setActiveTab('databases')} className={`pb-3 text-sm font-semibold transition-colors border-b-2 whitespace-nowrap ${activeTab === 'databases' ? 'border-indigo-600 text-indigo-600' : 'border-transparent text-zinc-500 hover:text-zinc-800'}`}>Databases</button>
            </div>
          )}
        </header>

        <div className="flex-1 overflow-auto p-4 sm:p-6">
          {activeWorkspace ? (
            <div className="max-w-6xl mx-auto space-y-6">
              
              {activeTab === 'overview' && !isCreatingEntity && <AnalyticsView entities={entities} activeWorkspace={activeWorkspace} />}

              {activeTab === 'databases' && !isCreatingEntity && (
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
                  {entities.map(entity => (
                    <div key={entity._id} onClick={() => navigate(`/crm/${entity._id}`)} className="group bg-white border border-zinc-200 p-4 rounded-xl cursor-pointer hover:border-zinc-300 hover:shadow-sm transition-all relative">
                      <div className="w-8 h-8 rounded bg-indigo-50 border border-indigo-100 flex items-center justify-center mb-3">
                        <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4 text-indigo-600" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 7v10c0 2.21 3.582 4 8 4s8-1.79 8-4V7M4 7c0 2.21 3.582 4 8 4s8-1.79 8-4M4 7c0-2.21 3.582-4 8-4s8 1.79 8 4m0 5c0 2.21-3.582 4-8 4s-8-1.79-8-4" /></svg>
                      </div>
                      <h3 className="font-semibold text-sm text-zinc-900 truncate pr-6">{entity.name}</h3>
                      <p className="text-xs text-zinc-500 mt-1">{entity.fields.length} Columns</p>
                      {canManageDatabases && (
                        <button onClick={(e) => handleDeleteDatabase(e, entity._id, entity.name)} className="absolute top-3 right-3 text-zinc-400 hover:text-red-600 opacity-0 group-hover:opacity-100 transition-opacity p-1">
                          <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" /></svg>
                        </button>
                      )}
                    </div>
                  ))}
                  {entities.length === 0 && <div className="col-span-full py-12 border-2 border-dashed border-zinc-200 rounded-xl text-center text-sm text-zinc-500">No databases yet. Click "+ New Database" to start building.</div>}
                </div>
              )}

              {/* SCHEMA BUILDER UI */}
              {isCreatingEntity && canManageDatabases && (
                <div className="bg-white p-4 sm:p-6 rounded-xl border border-zinc-200 shadow-sm max-w-3xl">
                  <h2 className="text-base font-semibold text-zinc-900 mb-5">Schema Builder</h2>
                  <form onSubmit={handleCreateEntity} className="space-y-6">
                    <div>
                      <label className="block text-xs font-semibold text-zinc-500 uppercase tracking-wider mb-1.5">Database Name</label>
                      <input type="text" placeholder="e.g., HR Candidates, Inventory" required value={entityName} onChange={e => setEntityName(e.target.value)} className="w-full px-3 py-2 text-sm border border-zinc-200 rounded-md outline-none focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500" />
                    </div>
                    
                    <div className="space-y-3">
                      <label className="block text-xs font-semibold text-zinc-500 uppercase tracking-wider">Columns (Fields)</label>
                      {entityFields.map((field, index) => (
                        <div key={index} className="flex flex-col gap-2 p-3 bg-zinc-50 border border-zinc-100 rounded-lg">
                          <div className="flex flex-col sm:flex-row gap-2 items-start sm:items-center">
                            <input type="text" placeholder="Column Name" required value={field.name} onChange={(e) => updateField(index, 'name', e.target.value)} className="w-full sm:flex-1 px-3 py-1.5 text-sm border border-zinc-200 rounded-md outline-none focus:border-indigo-500" />
                            
                            <div className="flex gap-2 w-full sm:w-auto">
                              <select value={field.type} onChange={(e) => updateField(index, 'type', e.target.value)} className="flex-1 sm:w-48 px-3 py-1.5 text-sm border border-zinc-200 rounded-md bg-white outline-none focus:border-indigo-500">
                                <option value="text">Short Text</option>
                                <option value="textarea">Long Text</option>
                                <option value="number">Number</option>
                                <option value="date">Date</option>
                                <option value="datetime">Date & Time</option>
                                <option value="checkbox">Checkbox</option>
                                <option value="dropdown">Dropdown</option>
                                <option value="media">Single File</option>
                                <option value="media-multiple">Image Gallery</option>
                                <option value="relation">Linked Record (Relation)</option>
                              </select>
                              {entityFields.length > 1 && (
                                <button type="button" onClick={() => removeFieldFromSchema(index)} className="p-1.5 text-zinc-400 hover:text-red-500 transition-colors bg-white sm:bg-transparent border border-zinc-200 sm:border-transparent rounded-md">
                                  <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" /></svg>
                                </button>
                              )}
                            </div>
                          </div>

                          {field.type === 'relation' && (
                            <div className="pt-2">
                              <label className="block text-[10px] font-semibold text-zinc-500 uppercase tracking-wider mb-1">Target Database</label>
                              <select 
                                required 
                                value={field.targetEntity || ''} 
                                onChange={(e) => updateField(index, 'targetEntity', e.target.value)} 
                                className="w-full sm:w-1/2 px-3 py-1.5 text-sm border border-indigo-200 rounded-md bg-indigo-50/30 text-indigo-900 outline-none focus:border-indigo-500"
                              >
                                <option value="">Select Database to Link...</option>
                                {entities.map(ent => (
                                  <option key={ent._id} value={ent._id}>{ent.name}</option>
                                ))}
                              </select>
                            </div>
                          )}

                          {field.type === 'dropdown' && (
                            <div className="pt-2">
                              <div className="flex flex-wrap gap-1.5 mb-2">
                                {field.optionsArray?.map((opt, i) => (
                                  <span key={i} className="bg-white border border-zinc-200 text-zinc-700 text-[11px] font-medium px-2 py-0.5 rounded-full flex items-center gap-1 shadow-sm">
                                    {opt} <button type="button" onClick={() => removeDropdownOption(index, i)} className="text-zinc-400 hover:text-red-500">&times;</button>
                                  </span>
                                ))}
                              </div>
                              <div className="flex gap-2">
                                <input type="text" placeholder="Add dropdown option..." value={field.tempOption || ''} onChange={(e) => updateField(index, 'tempOption', e.target.value)} onKeyDown={(e) => { if(e.key === 'Enter') { e.preventDefault(); addDropdownOption(index); }}} className="flex-1 text-xs px-2 py-1.5 border border-zinc-200 rounded outline-none focus:border-indigo-500" />
                                <button type="button" onClick={() => addDropdownOption(index)} className="text-xs font-medium bg-zinc-200 text-zinc-800 px-3 rounded hover:bg-zinc-300">Add</button>
                              </div>
                            </div>
                          )}
                        </div>
                      ))}
                    </div>
                    <button type="button" onClick={addFieldToSchema} className="text-indigo-600 hover:text-indigo-800 text-xs font-semibold inline-block p-1">+ Add Column</button>
                    
                    <div className="pt-4 border-t border-zinc-100">
                      <button type="submit" className="w-full sm:w-auto bg-indigo-600 hover:bg-indigo-700 text-white px-6 py-2.5 rounded-md font-medium text-sm transition-colors shadow-sm">Deploy Database</button>
                    </div>
                  </form>
                </div>
              )}
            </div>
          ) : (
            <div className="flex flex-col items-center justify-center h-full text-center max-w-sm mx-auto px-4">
              <div className="w-12 h-12 bg-zinc-100 rounded-xl flex items-center justify-center mb-4 border border-zinc-200">
                <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6 text-zinc-400" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 11H5m14 0a2 2 0 012 2v6a2 2 0 01-2 2H5a2 2 0 01-2-2v-6a2 2 0 012-2m14 0V9a2 2 0 00-2-2M5 11V9a2 2 0 002-2m0 0V5a2 2 0 002-2m0 0V5a2 2 0 012-2h6a2 2 0 012 2v2M7 7h10" /></svg>
              </div>
              <h2 className="text-base font-semibold text-zinc-900 mb-1">Select a Workspace</h2>
              <p className="text-sm text-zinc-500">Choose a workspace from the sidebar to view your databases, or create a new one to get started.</p>
              <button onClick={() => setIsMobileMenuOpen(true)} className="mt-6 lg:hidden bg-white border border-zinc-200 text-zinc-700 px-4 py-2 rounded-md text-sm font-medium shadow-sm">Open Menu</button>
            </div>
          )}
        </div>
      </main>

      {/* --- ENTERPRISE SETTINGS MODAL --- */}
      {isSettingsOpen && (
        <div className="fixed inset-0 bg-zinc-900/40 backdrop-blur-sm flex items-center justify-center z-[60] p-4">
          <div className="bg-white rounded-xl shadow-xl w-full max-w-2xl max-h-[90vh] flex flex-col overflow-hidden border border-zinc-200">
            
            <div className="flex justify-between items-center px-6 py-4 border-b border-zinc-100 bg-zinc-50">
              <h3 className="text-sm font-bold text-zinc-900 tracking-tight">Workspace Settings</h3>
              <button onClick={() => setIsSettingsOpen(false)} className="text-zinc-400 hover:text-zinc-800 text-lg">&times;</button>
            </div>

            <div className="flex border-b border-zinc-200 px-6 pt-2 bg-zinc-50/50">
              <button onClick={() => setSettingsTab('general')} className={`pb-3 text-sm font-semibold transition-colors border-b-2 mr-6 ${settingsTab === 'general' ? 'border-indigo-600 text-indigo-600' : 'border-transparent text-zinc-500 hover:text-zinc-800'}`}>General</button>
              {isOwner && (
                 <button onClick={() => setSettingsTab('roles')} className={`pb-3 text-sm font-semibold transition-colors border-b-2 ${settingsTab === 'roles' ? 'border-indigo-600 text-indigo-600' : 'border-transparent text-zinc-500 hover:text-zinc-800'}`}>Roles & Permissions</button>
              )}
            </div>

            <div className="p-6 overflow-y-auto flex-1">
              
              {/* TAB 1: GENERAL */}
              {settingsTab === 'general' && (
                <div className="space-y-8 max-w-md">
                  <form onSubmit={handleRenameWorkspace}>
                    <label className="block text-xs font-semibold text-zinc-500 uppercase mb-2">Workspace Name</label>
                    <div className="flex flex-col sm:flex-row gap-2">
                      <input type="text" value={editWorkspaceName} onChange={(e) => setEditWorkspaceName(e.target.value)} required className="flex-1 px-3 py-2 sm:py-1.5 text-sm border border-zinc-200 rounded-md outline-none focus:border-indigo-500" />
                      {isOwner && (
                        <button type="submit" disabled={isUpdatingWorkspace || editWorkspaceName === activeWorkspace.name} className="bg-zinc-900 text-white px-4 py-2 sm:py-1.5 rounded-md text-sm font-medium hover:bg-zinc-800 disabled:opacity-50">Save</button>
                      )}
                    </div>
                  </form>
                  {isOwner && (
                    <div className="pt-4 border-t border-zinc-100">
                      <label className="block text-xs font-semibold text-red-500 uppercase mb-2">Danger Zone</label>
                      <div className="bg-red-50/50 border border-red-100 p-3 rounded-lg flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                        <p className="text-xs text-red-800 sm:max-w-[200px]">Permanently delete this workspace and all internal data.</p>
                        <button onClick={handleDeleteWorkspace} className="bg-white border border-red-200 text-red-600 px-3 py-2 sm:py-1.5 rounded-md text-sm sm:text-xs font-bold hover:bg-red-50 transition-colors w-full sm:w-auto text-center">Delete</button>
                      </div>
                    </div>
                  )}
                </div>
              )}

              {/* TAB 2: ROLES ENGINE */}
              {settingsTab === 'roles' && isOwner && (
                <div className="space-y-6">
                  
                  {!isCreatingRole ? (
                    <>
                      <div className="flex justify-between items-center">
                         <div>
                           <h4 className="text-sm font-bold text-zinc-900">Custom Roles</h4>
                           <p className="text-xs text-zinc-500 mt-0.5">Manage what team members can see and do.</p>
                         </div>
                         <button onClick={() => setIsCreatingRole(true)} className="bg-indigo-600 text-white px-3 py-1.5 rounded-md text-xs font-bold shadow-sm hover:bg-indigo-700">+ Create Role</button>
                      </div>

                      <div className="space-y-2">
                        {activeWorkspace.customRoles?.map((role, i) => (
                          <div key={i} className="flex items-center justify-between p-3 border border-zinc-200 rounded-lg bg-zinc-50 group transition-all hover:border-zinc-300">
                            <div>
                              <span className="text-sm font-bold text-zinc-800">{role.name}</span>
                              <div className="flex gap-2 mt-1">
                                {role.permissions.createRecords && <span className="text-[10px] text-emerald-600 bg-emerald-50 border border-emerald-100 px-1.5 rounded">Create</span>}
                                {role.permissions.viewAllRecords ? <span className="text-[10px] text-indigo-600 bg-indigo-50 border border-indigo-100 px-1.5 rounded">View All</span> : <span className="text-[10px] text-zinc-500 bg-zinc-100 border border-zinc-200 px-1.5 rounded">View Own</span>}
                              </div>
                            </div>
                            {/* THE NEW DELETE BUTTON */}
                            <button onClick={() => handleDeleteRole(role._id, role.name)} className="text-zinc-400 hover:text-red-600 opacity-0 group-hover:opacity-100 transition-opacity p-2">
                              <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" /></svg>
                            </button>
                          </div>
                        ))}
                        {(!activeWorkspace.customRoles || activeWorkspace.customRoles.length === 0) && (
                          <div className="text-center py-8 border border-dashed border-zinc-300 rounded-lg text-sm text-zinc-500">No custom roles built yet.</div>
                        )}
                      </div>
                    </>
                  ) : (
                    <form onSubmit={handleCreateRole} className="space-y-6">
                      <div className="flex items-center justify-between border-b border-zinc-100 pb-3">
                         <h4 className="text-sm font-bold text-zinc-900">Build New Role</h4>
                         <button type="button" onClick={() => setIsCreatingRole(false)} className="text-xs text-zinc-500 hover:text-zinc-800">Cancel</button>
                      </div>
                      
                      <div>
                        <label className="block text-xs font-semibold text-zinc-500 uppercase mb-1">Role Title</label>
                        <input type="text" required placeholder="e.g., Sales Manager, Intern" value={newRole.name} onChange={(e) => setNewRole({...newRole, name: e.target.value})} className="w-full max-w-sm px-3 py-2 text-sm border border-zinc-200 rounded-md outline-none focus:border-indigo-500" />
                      </div>

                      <div className="grid grid-cols-1 md:grid-cols-2 gap-4 border border-zinc-200 rounded-xl overflow-hidden bg-zinc-50/50">
                        <div className="p-4 space-y-4">
                           <h5 className="text-[11px] font-bold text-zinc-400 uppercase tracking-widest border-b border-zinc-200 pb-2">Records Access</h5>
                           <label className="flex items-center gap-2 cursor-pointer"><input type="checkbox" checked={newRole.permissions.viewAllRecords} onChange={() => togglePermission('viewAllRecords')} className="rounded text-indigo-600" /><span className="text-sm font-medium text-zinc-800">View ALL company records</span></label>
                           <label className="flex items-center gap-2 cursor-pointer"><input type="checkbox" checked={newRole.permissions.createRecords} onChange={() => togglePermission('createRecords')} className="rounded text-indigo-600" /><span className="text-sm font-medium text-zinc-800">Create new records</span></label>
                           <label className="flex items-center gap-2 cursor-pointer"><input type="checkbox" checked={newRole.permissions.editOwnRecords} onChange={() => togglePermission('editOwnRecords')} className="rounded text-indigo-600" /><span className="text-sm font-medium text-zinc-800">Edit their OWN records</span></label>
                           <label className="flex items-center gap-2 cursor-pointer"><input type="checkbox" checked={newRole.permissions.editAllRecords} onChange={() => togglePermission('editAllRecords')} className="rounded text-indigo-600" /><span className="text-sm font-medium text-red-600">Edit ANYONE'S records</span></label>
                        </div>
                        <div className="p-4 space-y-4 border-t md:border-t-0 md:border-l border-zinc-200">
                           <h5 className="text-[11px] font-bold text-zinc-400 uppercase tracking-widest border-b border-zinc-200 pb-2">Danger Zone</h5>
                           <label className="flex items-center gap-2 cursor-pointer"><input type="checkbox" checked={newRole.permissions.deleteOwnRecords} onChange={() => togglePermission('deleteOwnRecords')} className="rounded text-indigo-600" /><span className="text-sm font-medium text-zinc-800">Delete their OWN records</span></label>
                           <label className="flex items-center gap-2 cursor-pointer"><input type="checkbox" checked={newRole.permissions.deleteAllRecords} onChange={() => togglePermission('deleteAllRecords')} className="rounded text-indigo-600" /><span className="text-sm font-medium text-red-600">Delete ANYONE'S records</span></label>
                           
                           <h5 className="text-[11px] font-bold text-zinc-400 uppercase tracking-widest border-b border-zinc-200 pb-2 mt-4 pt-2">Admin Powers</h5>
                           <label className="flex items-center gap-2 cursor-pointer"><input type="checkbox" checked={newRole.permissions.manageDatabases} onChange={() => togglePermission('manageDatabases')} className="rounded text-indigo-600" /><span className="text-sm font-medium text-zinc-800">Manage Database Schemas</span></label>
                           <label className="flex items-center gap-2 cursor-pointer"><input type="checkbox" checked={newRole.permissions.manageTeam} onChange={() => togglePermission('manageTeam')} className="rounded text-indigo-600" /><span className="text-sm font-medium text-zinc-800">Invite / Manage Team</span></label>
                        </div>
                      </div>
                      <button type="submit" className="w-full bg-indigo-600 text-white py-2 rounded-md font-bold text-sm shadow-sm hover:bg-indigo-700">Deploy Role Configuration</button>
                    </form>
                  )}
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}