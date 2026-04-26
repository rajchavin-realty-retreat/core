import { useState, useEffect } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import api from './api/axiosConfig';

import Sidebar from './components/Sidebar';
import DashboardHeader from './components/DashboardHeader';
import DatabaseGrid from './components/DatabaseGrid';
import EmptyWorkspaceState from './components/EmptyWorkspaceState';
import AnalyticsView from './components/AnalyticsView';
import SchemaBuilder from './components/SchemaBuilder';
import SettingsModal from './components/SettingsModal';
import MemberAnalytics from './components/MemberAnalytics';
import LazyCalendar from './components/LazyCalendar';
import LazyTasks from './components/LazyTasks';
import Templates from './components/Templates';
import TemplateBuilder from './components/TemplateBuilder';
import DynamicTable from './components/DynamicTable'; // <-- NEW: Imported directly into Dashboard!

export default function Dashboard() {
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();
  
  const activeTab = searchParams.get('tab') || 'overview';
  const urlWorkspaceId = searchParams.get('ws');
  const urlDbId = searchParams.get('db'); // <-- Reads active database tab from URL

  // --- CORE STATE ---
  const [workspaces, setWorkspaces] = useState([]);
  const [activeWorkspace, setActiveWorkspace] = useState(null);
  const [entities, setEntities] = useState([]);
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false); 
  const [newWorkspaceName, setNewWorkspaceName] = useState('');
  const [isSettingsOpen, setIsSettingsOpen] = useState(false);
  
  // --- IN-APP TAB SYSTEM STATE ---
  const [openDbTabs, setOpenDbTabs] = useState([]); 
  const [activeDbId, setActiveDbId] = useState(null);
  const [dbRecords, setDbRecords] = useState([]);
  const [isLoadingRecords, setIsLoadingRecords] = useState(false);

  // --- EDITING STATE ---
  const [isCreatingEntity, setIsCreatingEntity] = useState(false);
  const [editingEntity, setEditingEntity] = useState(null); 
  const [editingTemplate, setEditingTemplate] = useState(null); 

  // --- TEAM MANAGEMENT STATE ---
  const [inviteEmail, setInviteEmail] = useState('');
  const [inviteRole, setInviteRole] = useState(''); 
  const [isInviting, setIsInviting] = useState(false);
  const [selectedMember, setSelectedMember] = useState(null);
  
  const userInfo = JSON.parse(localStorage.getItem('userInfo'));

  // --- TAB ROUTING ENGINE ---
  const handleSetActiveTab = (newTab) => {
    searchParams.set('tab', newTab);
    if (newTab !== 'database-viewer') searchParams.delete('db');
    setSearchParams(searchParams);
  };

  const handleOpenDatabaseTab = (entity) => {
    // 1. Add to open tabs if it isn't already there
    if (!openDbTabs.find(t => t._id === entity._id)) {
      setOpenDbTabs(prev => [...prev, entity]);
    }
    // 2. Set as active
    setActiveDbId(entity._id);
    
    // 3. Sync to URL
    searchParams.set('tab', 'database-viewer');
    searchParams.set('db', entity._id);
    setSearchParams(searchParams);
  };

  const handleCloseDatabaseTab = (e, dbId) => {
    e.stopPropagation();
    const newTabs = openDbTabs.filter(t => t._id !== dbId);
    setOpenDbTabs(newTabs);

    if (newTabs.length === 0) {
      handleSetActiveTab('overview');
      setActiveDbId(null);
    } else if (activeDbId === dbId) {
      // If we closed the active tab, fall back to the right-most tab
      const nextActive = newTabs[newTabs.length - 1];
      setActiveDbId(nextActive._id);
      searchParams.set('db', nextActive._id);
      setSearchParams(searchParams);
    }
  };

  // --- DATA FETCHERS ---
  const fetchWorkspaces = async () => {
    try {
      const res = await api.get('/workspaces');
      setWorkspaces(res.data);
      
      if (urlWorkspaceId) {
        const targetWs = res.data.find(w => w._id === urlWorkspaceId);
        if (targetWs) {
          setActiveWorkspace(targetWs);
          fetchEntities(targetWs._id);
          return;
        }
      }

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
          searchParams.set('ws', validWs._id);
          setSearchParams(searchParams);
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

  useEffect(() => { fetchWorkspaces(); }, []);

  // Sync URL Database Tab with React State on Load
  useEffect(() => {
    if (activeTab === 'database-viewer' && urlDbId && entities.length > 0) {
      const targetEntity = entities.find(e => e._id === urlDbId);
      if (targetEntity) {
        if (!openDbTabs.find(t => t._id === urlDbId)) setOpenDbTabs(prev => [...prev, targetEntity]);
        setActiveDbId(urlDbId);
      }
    }
  }, [urlDbId, activeTab, entities]);

  // Fetch actual records whenever the active database tab changes
  useEffect(() => {
    if (activeTab === 'database-viewer' && activeDbId) {
      setIsLoadingRecords(true);
      api.get(`/records/entity/${activeDbId}`)
        .then(res => setDbRecords(res.data))
        .catch(err => console.error(err))
        .finally(() => setIsLoadingRecords(false));
    }
  }, [activeDbId, activeTab]);

  // --- WORKSPACE & PERMISSIONS ... (Keep existing filtering logic) ---
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

  let isOwner = false, currentUserRoleDisplay = 'Member', canManageDatabases = false, canManageTeam = false;
  if (activeWorkspace && userInfo) {
    if (activeWorkspace.owner._id === userInfo?.id || activeWorkspace.owner._id === userInfo?._id) {
      isOwner = true; currentUserRoleDisplay = 'Owner'; canManageDatabases = true; canManageTeam = true;
    } else {
      const me = activeWorkspace.members.find(m => m.user._id === userInfo?.id || m.user._id === userInfo?._id);
      if (me && activeWorkspace.customRoles) {
        const myRole = activeWorkspace.customRoles.find(r => r._id === me.roleId);
        if (myRole) { currentUserRoleDisplay = myRole.name; canManageDatabases = myRole.permissions.manageDatabases; canManageTeam = myRole.permissions.manageTeam; }
      }
    }
  }

  // --- STANDARD HANDLERS ---
  const selectWorkspace = (ws) => { 
    setActiveWorkspace(ws); 
    fetchEntities(ws._id); 
    setOpenDbTabs([]); // Clear tabs on workspace switch
    setIsCreatingEntity(false); 
    setIsMobileMenuOpen(false); 
    searchParams.set('ws', ws._id);
    searchParams.set('tab', 'overview');
    setSearchParams(searchParams);
  };

  const handleCreateWorkspace = async (e) => { e.preventDefault(); try { await api.post('/workspaces', { name: newWorkspaceName }); setNewWorkspaceName(''); fetchWorkspaces(); } catch (error) { alert('Failed to create workspace'); } };
  const handleInvite = async (e) => { e.preventDefault(); if (!inviteRole) return alert("Select a role."); setIsInviting(true); try { await api.post(`/workspaces/${activeWorkspace._id}/invite`, { email: inviteEmail, roleId: inviteRole }); setInviteEmail(''); setInviteRole(''); fetchWorkspaces(); } catch (error) { alert(error.response?.data?.message || 'Invite failed'); } finally { setIsInviting(false); } };
  const handleInviteResponse = async (workspaceId, status) => { try { await api.put(`/workspaces/${workspaceId}/invite/respond`, { status }); fetchWorkspaces(); } catch (error) { alert('Failed to respond'); } };
  const handleDeleteDatabase = async (e, entityId, entityName) => { e.stopPropagation(); if (window.confirm(`Delete "${entityName}" and all records?`)) { try { await api.delete(`/entities/${entityId}`); fetchEntities(activeWorkspace._id); handleCloseDatabaseTab(e, entityId); } catch (error) { alert(error.response?.data?.message || 'Failed to delete'); } } };
  const handleRemoveMember = async (memberId) => { if (!window.confirm("Are you sure you want to remove this member from the workspace?")) return; try { await api.delete(`/workspaces/${activeWorkspace._id}/members/${memberId}`); fetchWorkspaces(); } catch (error) { alert(error.response?.data?.message || 'Failed to remove member'); } };
  const handleLogout = () => { localStorage.removeItem('userInfo'); window.location.href = '/login'; };
  const handleEditDatabase = (entity) => { setEditingEntity(entity); setIsCreatingEntity(true); handleSetActiveTab('databases'); };

  return (
    <div className="flex h-screen w-full bg-white text-zinc-900 font-sans overflow-hidden">
      {isMobileMenuOpen && <div className="fixed inset-0 bg-zinc-900/40 backdrop-blur-sm z-40 lg:hidden" onClick={() => setIsMobileMenuOpen(false)}></div>}
      
      <Sidebar 
        isMobileMenuOpen={isMobileMenuOpen} setIsMobileMenuOpen={setIsMobileMenuOpen} handleLogout={handleLogout} pendingWorkspaces={pendingWorkspaces}
        handleInviteResponse={handleInviteResponse} activeOrAcceptedWorkspaces={activeOrAcceptedWorkspaces} activeWorkspace={activeWorkspace} selectWorkspace={selectWorkspace} 
        isOwner={isOwner} setIsSettingsOpen={setIsSettingsOpen} handleCreateWorkspace={handleCreateWorkspace} newWorkspaceName={newWorkspaceName} setNewWorkspaceName={setNewWorkspaceName}
        canManageTeam={canManageTeam} handleInvite={handleInvite} inviteEmail={inviteEmail} setInviteEmail={setInviteEmail} inviteRole={inviteRole} setInviteRole={setInviteRole}
        isInviting={isInviting} setSelectedMember={setSelectedMember} setActiveTab={handleSetActiveTab} activeTab={activeTab} handleRemoveMember={handleRemoveMember} 
        
        // --- NEW PROPS FOR SIDEBAR DATABASES ---
        entities={entities}
        handleOpenDatabaseTab={handleOpenDatabaseTab}
        activeDbId={activeDbId}
      />

      <main className="flex-1 flex flex-col min-w-0 bg-[#FBFBFC]">
        <DashboardHeader 
          setIsMobileMenuOpen={setIsMobileMenuOpen} activeWorkspace={activeWorkspace} currentUserRoleDisplay={currentUserRoleDisplay} canManageDatabases={canManageDatabases}
          setActiveTab={handleSetActiveTab} setIsCreatingEntity={setIsCreatingEntity} isCreatingEntity={isCreatingEntity} activeTab={activeTab}
        />

        {/* --- VIEW ROUTER --- */}
        {activeWorkspace ? (
          <>
            {/* SCENARIO A: Standard Dashboard Views (Padded) */}
            {activeTab !== 'database-viewer' && (
              <div className="flex-1 overflow-auto p-4 sm:p-8">
                <div className="max-w-[1200px] mx-auto space-y-8">
                  {activeTab === 'overview' && !isCreatingEntity && <AnalyticsView entities={entities} activeWorkspace={activeWorkspace} />}
                  {activeTab === 'memberStats' && selectedMember && !isCreatingEntity && <MemberAnalytics workspace={activeWorkspace} member={selectedMember} onBack={() => handleSetActiveTab('overview')} />}
                  {activeTab === 'calendar' && !isCreatingEntity && <LazyCalendar activeWorkspace={activeWorkspace} entities={entities} />}
                  {activeTab === 'tasks' && !isCreatingEntity && <LazyTasks activeWorkspace={activeWorkspace} entities={entities} />}
                  
                  {/* Database Grid now acts as a secondary launcher */}
                  {activeTab === 'databases' && !isCreatingEntity && <DatabaseGrid entities={entities} onOpenDatabase={handleOpenDatabaseTab} canManageDatabases={canManageDatabases} handleDeleteDatabase={handleDeleteDatabase} onEditDatabase={handleEditDatabase} />}
                  
                  {activeTab === 'templates' && <Templates workspaces={activeOrAcceptedWorkspaces} refreshWorkspaces={fetchWorkspaces} setActiveTab={handleSetActiveTab} setSelectedWorkspace={selectWorkspace} onEditTemplate={setEditingTemplate} />}
                  {activeTab === 'template-builder' && <TemplateBuilder editingTemplate={editingTemplate} setEditingTemplate={setEditingTemplate} setActiveTab={handleSetActiveTab} />}
                  {isCreatingEntity && canManageDatabases && <SchemaBuilder activeWorkspace={activeWorkspace} entities={entities} fetchEntities={fetchEntities} setIsCreatingEntity={setIsCreatingEntity} setActiveTab={handleSetActiveTab} editingEntity={editingEntity} setEditingEntity={setEditingEntity} />}
                </div>
              </div>
            )}

            {/* SCENARIO B: The In-App Tabbed Database Viewer (Edgeless) */}
            {activeTab === 'database-viewer' && openDbTabs.length > 0 && (
              <div className="flex-1 flex flex-col min-h-0 bg-white">
                
                {/* NOTION-STYLE TAB BAR */}
                <div className="flex px-4 pt-3 bg-[#f7f7f5] border-b border-zinc-200 overflow-x-auto no-scrollbar shrink-0">
                  {openDbTabs.map(db => (
                    <div
                      key={db._id}
                      onClick={() => handleOpenDatabaseTab(db)}
                      className={`group flex items-center gap-2 px-4 py-2 min-w-[140px] max-w-[200px] rounded-t-lg border border-b-0 cursor-pointer text-[13px] font-medium transition-all select-none ${
                        activeDbId === db._id
                          ? 'bg-white border-zinc-200 text-zinc-900 z-10 shadow-[0_4px_0_0_white] translate-y-[1px]'
                          : 'bg-transparent border-transparent text-zinc-500 hover:bg-zinc-200/50'
                      }`}
                    >
                      <svg xmlns="http://www.w3.org/2000/svg" className={`h-4 w-4 shrink-0 ${activeDbId === db._id ? 'text-indigo-600' : 'text-zinc-400'}`} fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 7v10c0 2.21 3.582 4 8 4s8-1.79 8-4V7M4 7c0 2.21 3.582 4 8 4s8-1.79 8-4M4 7c0-2.21 3.582-4 8-4s8 1.79 8 4m0 5c0 2.21-3.582 4-8 4s-8-1.79-8-4" /></svg>
                      <span className="truncate flex-1">{db.name}</span>
                      <button onClick={(e) => handleCloseDatabaseTab(e, db._id)} className={`shrink-0 p-0.5 rounded transition-colors ${activeDbId === db._id ? 'text-zinc-400 hover:bg-zinc-100 hover:text-zinc-900' : 'opacity-0 group-hover:opacity-100 text-zinc-400 hover:text-zinc-700 hover:bg-zinc-200'}`}>
                        <svg xmlns="http://www.w3.org/2000/svg" className="h-3 w-3" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" /></svg>
                      </button>
                    </div>
                  ))}
                </div>

                {/* THE EDGELESS DYNAMIC TABLE */}
                <div className="flex-1 overflow-auto p-4 sm:p-8 relative">
                  {isLoadingRecords ? (
                    <div className="flex items-center gap-3 text-zinc-400 text-sm font-medium animate-pulse">
                      <svg className="animate-spin h-5 w-5 text-indigo-500" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24"><circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle><path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path></svg>
                      Syncing {openDbTabs.find(d => d._id === activeDbId)?.name}...
                    </div>
                  ) : (
                    <DynamicTable 
                      entity={openDbTabs.find(d => d._id === activeDbId)} 
                      records={dbRecords} 
                      currentUser={userInfo} 
                    />
                  )}
                </div>
              </div>
            )}
          </>
        ) : (
          <EmptyWorkspaceState setIsMobileMenuOpen={setIsMobileMenuOpen} />
        )}
      </main>

      {isSettingsOpen && <SettingsModal activeWorkspace={activeWorkspace} isOwner={isOwner} setIsSettingsOpen={setIsSettingsOpen} fetchWorkspaces={fetchWorkspaces} setActiveWorkspace={selectWorkspace} setWorkspaces={setWorkspaces} />}
    </div>
  );
}