import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import api from './api/axiosConfig';

// --- CLEAN COMPONENTS ---
import Sidebar from './components/Sidebar';
import DashboardHeader from './components/DashboardHeader';
import DatabaseGrid from './components/DatabaseGrid';
import EmptyWorkspaceState from './components/EmptyWorkspaceState';
import AnalyticsView from './components/AnalyticsView';
import SchemaBuilder from './components/SchemaBuilder';
import SettingsModal from './components/SettingsModal';
import MemberAnalytics from './components/MemberAnalytics'; // Added from previous step!

export default function Dashboard() {
  const navigate = useNavigate();
  
  // --- STATE ---
  const [workspaces, setWorkspaces] = useState([]);
  const [activeWorkspace, setActiveWorkspace] = useState(null);
  const [entities, setEntities] = useState([]);
  const [activeTab, setActiveTab] = useState('overview'); 
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false); 
  const [newWorkspaceName, setNewWorkspaceName] = useState('');
  const [isCreatingEntity, setIsCreatingEntity] = useState(false);
  const [isSettingsOpen, setIsSettingsOpen] = useState(false);
  const [inviteEmail, setInviteEmail] = useState('');
  const [inviteRole, setInviteRole] = useState(''); 
  const [isInviting, setIsInviting] = useState(false);
  const [selectedMember, setSelectedMember] = useState(null);

  const userInfo = JSON.parse(localStorage.getItem('userInfo'));

  // --- DATA FETCHING ---
  const fetchWorkspaces = async () => {
    try {
      const res = await api.get('/workspaces');
      setWorkspaces(res.data);
      
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

  useEffect(() => { fetchWorkspaces(); }, []); // eslint-disable-line

  // --- FILTERING & ROLES ---
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

  const handleInviteResponse = async (workspaceId, status) => {
    try {
      await api.put(`/workspaces/${workspaceId}/invite/respond`, { status });
      fetchWorkspaces();
    } catch (error) { alert('Failed to respond to invite'); }
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

  const selectWorkspace = (ws) => {
    setActiveWorkspace(ws);
    fetchEntities(ws._id);
    setIsCreatingEntity(false);
    setIsMobileMenuOpen(false); 
    setActiveTab('overview');
  };

  const handleLogout = () => {
    localStorage.removeItem('userInfo');
    window.location.href = '/login';
  };

  return (
    <div className="flex h-screen w-full bg-[#FBFBFC] text-zinc-900 font-sans overflow-hidden">
      
      {isMobileMenuOpen && <div className="fixed inset-0 bg-zinc-900/40 backdrop-blur-sm z-40 lg:hidden" onClick={() => setIsMobileMenuOpen(false)}></div>}

      <Sidebar 
        isMobileMenuOpen={isMobileMenuOpen} setIsMobileMenuOpen={setIsMobileMenuOpen}
        handleLogout={handleLogout} pendingWorkspaces={pendingWorkspaces}
        handleInviteResponse={handleInviteResponse} activeOrAcceptedWorkspaces={activeOrAcceptedWorkspaces}
        activeWorkspace={activeWorkspace} selectWorkspace={selectWorkspace} isOwner={isOwner}
        setIsSettingsOpen={setIsSettingsOpen} handleCreateWorkspace={handleCreateWorkspace}
        newWorkspaceName={newWorkspaceName} setNewWorkspaceName={setNewWorkspaceName}
        canManageTeam={canManageTeam} handleInvite={handleInvite} inviteEmail={inviteEmail}
        setInviteEmail={setInviteEmail} inviteRole={inviteRole} setInviteRole={setInviteRole}
        isInviting={isInviting} setSelectedMember={setSelectedMember} setActiveTab={setActiveTab}
      />

      <main className="flex-1 flex flex-col min-w-0">
        <DashboardHeader 
          setIsMobileMenuOpen={setIsMobileMenuOpen} activeWorkspace={activeWorkspace}
          currentUserRoleDisplay={currentUserRoleDisplay} canManageDatabases={canManageDatabases}
          setActiveTab={setActiveTab} setIsCreatingEntity={setIsCreatingEntity}
          isCreatingEntity={isCreatingEntity} activeTab={activeTab}
        />

        <div className="flex-1 overflow-auto p-4 sm:p-6">
          {activeWorkspace ? (
            <div className="max-w-6xl mx-auto space-y-6">
              {activeTab === 'overview' && !isCreatingEntity && <AnalyticsView entities={entities} activeWorkspace={activeWorkspace} />}
              
              {activeTab === 'memberStats' && selectedMember && !isCreatingEntity && (
                <MemberAnalytics workspace={activeWorkspace} member={selectedMember} onBack={() => setActiveTab('overview')} />
              )}

              {activeTab === 'databases' && !isCreatingEntity && (
                <DatabaseGrid entities={entities} navigate={navigate} canManageDatabases={canManageDatabases} handleDeleteDatabase={handleDeleteDatabase} />
              )}

              {isCreatingEntity && canManageDatabases && (
                <SchemaBuilder activeWorkspace={activeWorkspace} entities={entities} fetchEntities={fetchEntities} setIsCreatingEntity={setIsCreatingEntity} setActiveTab={setActiveTab} />
              )}
            </div>
          ) : (
            <EmptyWorkspaceState setIsMobileMenuOpen={setIsMobileMenuOpen} />
          )}
        </div>
      </main>

      {isSettingsOpen && (
        <SettingsModal 
          activeWorkspace={activeWorkspace} isOwner={isOwner} setIsSettingsOpen={setIsSettingsOpen} 
          fetchWorkspaces={fetchWorkspaces} setActiveWorkspace={setActiveWorkspace} setWorkspaces={setWorkspaces} 
        />
      )}
    </div>
  );
}