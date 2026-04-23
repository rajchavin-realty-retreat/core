import { useState, useEffect } from 'react';
import api from '../api/axiosConfig';

export default function SettingsModal({ activeWorkspace, isOwner, setIsSettingsOpen, fetchWorkspaces, setActiveWorkspace, setWorkspaces }) {
  const [settingsTab, setSettingsTab] = useState('general'); 
  const [editWorkspaceName, setEditWorkspaceName] = useState('');
  const [isUpdatingWorkspace, setIsUpdatingWorkspace] = useState(false);
  const [isCreatingRole, setIsCreatingRole] = useState(false);
  const [newRole, setNewRole] = useState({
    name: '',
    permissions: {
      viewAllRecords: false, viewOwnRecords: true, createRecords: false,
      editAllRecords: false, editOwnRecords: false, deleteAllRecords: false,
      deleteOwnRecords: false, manageDatabases: false, manageTeam: false
    }
  });

  useEffect(() => {
    if (activeWorkspace) setEditWorkspaceName(activeWorkspace.name);
  }, [activeWorkspace]);

  const handleRenameWorkspace = async (e) => {
    e.preventDefault();
    setIsUpdatingWorkspace(true);
    try {
      await api.put(`/workspaces/${activeWorkspace._id}`, { name: editWorkspaceName });
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

  const handleCreateRole = async (e) => {
    e.preventDefault();
    try {
      const res = await api.post(`/workspaces/${activeWorkspace._id}/roles`, newRole);
      setActiveWorkspace(res.data.workspace);
      setWorkspaces(prev => prev.map(ws => ws._id === activeWorkspace._id ? res.data.workspace : ws));
      setIsCreatingRole(false);
      setNewRole({ name: '', permissions: { viewAllRecords: false, viewOwnRecords: true, createRecords: false, editAllRecords: false, editOwnRecords: false, deleteAllRecords: false, deleteOwnRecords: false, manageDatabases: false, manageTeam: false }});
    } catch (error) { alert("Failed to create role: " + (error.response?.data?.message || error.message)); }
  };

  const handleDeleteRole = async (roleId, roleName) => {
    if (!window.confirm(`Are you sure you want to delete the "${roleName}" role?`)) return;
    try {
      const res = await api.delete(`/workspaces/${activeWorkspace._id}/roles/${roleId}`);
      setActiveWorkspace(res.data.workspace);
      setWorkspaces(prev => prev.map(ws => ws._id === activeWorkspace._id ? res.data.workspace : ws));
    } catch (error) { alert(error.response?.data?.message || 'Failed to delete role'); }
  };

  const togglePermission = (key) => setNewRole(prev => ({ ...prev, permissions: { ...prev.permissions, [key]: !prev.permissions[key] } }));

  return (
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
          {/* GENERAL TAB */}
          {settingsTab === 'general' && (
            <div className="space-y-8 max-w-md">
              <form onSubmit={handleRenameWorkspace}>
                <label className="block text-xs font-semibold text-zinc-500 uppercase mb-2">Workspace Name</label>
                <div className="flex flex-col sm:flex-row gap-2">
                  <input type="text" value={editWorkspaceName} onChange={(e) => setEditWorkspaceName(e.target.value)} required className="flex-1 px-3 py-2 sm:py-1.5 text-sm border border-zinc-200 rounded-md outline-none focus:border-indigo-500" />
                  {isOwner && <button type="submit" disabled={isUpdatingWorkspace || editWorkspaceName === activeWorkspace.name} className="bg-zinc-900 text-white px-4 py-2 sm:py-1.5 rounded-md text-sm font-medium hover:bg-zinc-800 disabled:opacity-50">Save</button>}
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

          {/* ROLES TAB */}
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
                        <button onClick={() => handleDeleteRole(role._id, role.name)} className="text-zinc-400 hover:text-red-600 opacity-0 group-hover:opacity-100 transition-opacity p-2">
                          <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" /></svg>
                        </button>
                      </div>
                    ))}
                    {(!activeWorkspace.customRoles || activeWorkspace.customRoles.length === 0) && <div className="text-center py-8 border border-dashed border-zinc-300 rounded-lg text-sm text-zinc-500">No custom roles built yet.</div>}
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
  );
}