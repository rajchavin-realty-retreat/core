import { useState, useEffect } from 'react';
import api from '../api/axiosConfig';

const ADMIN_EMAILS = ['your.email@gmail.com', 'admin@rajchavin.com'];

export default function Templates({ workspaces, refreshWorkspaces, setActiveTab, setSelectedWorkspace, onEditTemplate }) {
  const [templateLibrary, setTemplateLibrary] = useState([]);
  const [isLoading, setIsLoading] = useState(true);

  const [selectedTemplate, setSelectedTemplate] = useState(null);
  const [isImportModalOpen, setIsImportModalOpen] = useState(false);
  
  const [importTarget, setImportTarget] = useState('existing'); 
  const [selectedWorkspaceId, setSelectedWorkspaceId] = useState('');
  const [newWorkspaceName, setNewWorkspaceName] = useState('');
  const [isImporting, setIsImporting] = useState(false);

  const currentUser = JSON.parse(localStorage.getItem('userInfo'));
  const isGlobalAdmin = ADMIN_EMAILS.includes(currentUser?.email);

  const fetchTemplates = async () => {
    setIsLoading(true);
    try {
      const res = await api.get('/templates');
      setTemplateLibrary(res.data);
    } catch (error) {
      console.error("Failed to load templates");
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchTemplates();
  }, []);

  const handleDeleteTemplate = async (templateId) => {
    if (!window.confirm("Are you sure you want to permanently delete this global template? This cannot be undone.")) return;
    
    try {
      await api.delete(`/templates/${templateId}`);
      setSelectedTemplate(null);
      fetchTemplates(); 
    } catch (error) {
      alert("Failed to delete template. Check permissions.");
    }
  };

  const handleImport = async (e) => {
    e.preventDefault();
    setIsImporting(true);

    try {
      let targetWsId = selectedWorkspaceId;

      if (importTarget === 'new') {
        const wsRes = await api.post('/workspaces', { name: newWorkspaceName });
        targetWsId = wsRes.data._id;
        await refreshWorkspaces();
      }
      if (!targetWsId) throw new Error("No workspace selected");

      const tempToRealIdMap = {};

      for (const db of selectedTemplate.databases) {
        const safeFields = db.fields.map(f => {
          if (f.type === 'relation') return { ...f, type: 'text' }; 
          return f;
        });

        const res = await api.post('/entities', {
          workspaceId: targetWsId,
          name: db.name,
          fields: safeFields,
          showCreatedAt: db.showCreatedAt || false
        });
        tempToRealIdMap[db.tempId] = res.data._id;
      }

      for (const db of selectedTemplate.databases) {
        const realEntityId = tempToRealIdMap[db.tempId];
        const hasRelations = db.fields.some(f => f.type === 'relation');
        
        if (hasRelations) {
          const finalFields = db.fields.map(f => {
            if (f.type === 'relation') {
              return { ...f, targetTempId: undefined, targetEntity: tempToRealIdMap[f.targetTempId] };
            }
            return f;
          });

          await api.put(`/entities/${realEntityId}`, {
            name: db.name,
            fields: finalFields
          });
        }
      }

      const updatedWorkspacesRes = await api.get('/workspaces');
      const targetWorkspace = updatedWorkspacesRes.data.find(w => w._id === targetWsId);
      
      setSelectedWorkspace(targetWorkspace);
      setActiveTab('databases'); 
      setIsImportModalOpen(false);
      setSelectedTemplate(null);
      
    } catch (error) {
      alert("Failed to import template. Check permissions.");
    } finally {
      setIsImporting(false);
    }
  };

  if (isLoading) {
    return (
      <div className="flex flex-col items-center justify-center h-[60vh] text-zinc-400 gap-3">
        <svg className="animate-spin h-6 w-6 text-indigo-500" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24"><circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle><path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path></svg>
        <span className="text-sm font-medium">Syncing Global Library...</span>
      </div>
    );
  }

  return (
    <div className="flex flex-col h-[85vh] gap-4 sm:gap-6">
      
      {/* HEADER - Responsive Flex */}
      <div className="bg-white p-5 sm:p-6 rounded-2xl border border-zinc-200 shadow-sm shrink-0 flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 relative overflow-hidden">
        <div className="relative z-10">
          <h2 className="text-xl sm:text-2xl font-semibold tracking-tight text-zinc-800">Template Library</h2>
          <p className="text-sm text-zinc-500 mt-1 font-medium">Instantly clone architectures into your workspace.</p>
        </div>
        
        {isGlobalAdmin && (
          <button onClick={() => { if(onEditTemplate) onEditTemplate(null); setActiveTab('template-builder'); }} className="relative z-10 flex items-center gap-2 text-xs font-semibold text-indigo-600 bg-indigo-50 hover:bg-indigo-100 px-4 py-2.5 rounded-lg transition-colors border border-indigo-100 shadow-sm w-full sm:w-auto justify-center">
            <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" /><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" /></svg>
            Builder Access
          </button>
        )}
      </div>

      {/* MAIN SPLIT VIEW - Stacks on mobile (lg:flex-row) */}
      <div className="flex-1 flex flex-col lg:flex-row gap-6 overflow-hidden">
        
        {/* Left Panel: List */}
        <div className="w-full lg:w-1/3 overflow-y-auto pr-0 lg:pr-2 space-y-3 pb-4 lg:pb-10 shrink-0 lg:shrink max-h-[30vh] lg:max-h-full border-b lg:border-none border-zinc-200">
          {templateLibrary.length === 0 ? (
            <div className="text-center p-6 border-2 border-dashed border-zinc-200 rounded-xl text-zinc-400 text-sm font-medium bg-zinc-50/50">
              The Global Library is empty.
            </div>
          ) : (
            templateLibrary.map(template => (
              <div 
                key={template._id} 
                onClick={() => setSelectedTemplate(template)}
                className={`p-5 rounded-xl border transition-all cursor-pointer group ${selectedTemplate?._id === template._id ? 'border-indigo-400 bg-white shadow-sm ring-1 ring-indigo-400/20' : 'border-zinc-200 bg-white hover:border-zinc-300 hover:shadow-sm'}`}
              >
                <div className="flex items-center gap-4 mb-3">
                  <div className={`w-10 h-10 rounded-lg flex items-center justify-center shrink-0 ${selectedTemplate?._id === template._id ? 'bg-indigo-50 text-indigo-600' : 'bg-zinc-50 text-zinc-500 group-hover:bg-zinc-100 group-hover:text-zinc-700'} transition-colors`}>
                     <div className="w-5 h-5" dangerouslySetInnerHTML={{ __html: template.icon || '<svg fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M13 10V3L4 14h7v7l9-11h-7z"></path></svg>' }} />
                  </div>
                  <h3 className="font-semibold text-zinc-800 tracking-tight text-base leading-tight truncate">{template.name}</h3>
                </div>
                <p className="text-xs text-zinc-500 leading-relaxed line-clamp-2">{template.description}</p>
                <p className="text-[10px] font-medium text-zinc-400 mt-3 tracking-wide">By: {template.createdBy}</p>
              </div>
            ))
          )}
        </div>

        {/* Right Panel: Previewer */}
        <div className="flex-1 bg-white rounded-2xl border border-zinc-200 shadow-sm flex flex-col min-h-[50vh] overflow-hidden">
          {selectedTemplate ? (
            <>
              {/* Previewer Header - Responsive */}
              <div className="px-5 sm:px-8 py-5 sm:py-8 border-b border-zinc-100 bg-zinc-50/50 flex flex-col sm:flex-row justify-between items-start sm:items-center gap-5 shrink-0">
                <div className="flex items-center gap-4">
                  <div className="w-12 h-12 bg-indigo-50 text-indigo-600 rounded-xl flex items-center justify-center shrink-0 border border-indigo-100 shadow-sm">
                    <div className="w-6 h-6" dangerouslySetInnerHTML={{ __html: selectedTemplate.icon || '<svg fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M13 10V3L4 14h7v7l9-11h-7z"></path></svg>' }} />
                  </div>
                  <div>
                    <h2 className="text-xl sm:text-2xl font-semibold tracking-tight text-zinc-800">{selectedTemplate.name}</h2>
                    <p className="text-xs sm:text-sm text-zinc-500 mt-1 font-medium flex items-center gap-2">
                      <span className="w-1.5 h-1.5 rounded-full bg-indigo-400"></span>
                      {selectedTemplate.databases.length} Data Modules
                    </p>
                  </div>
                </div>
                
                <div className="flex items-center gap-3 w-full sm:w-auto">
                  {(currentUser?.email === selectedTemplate.createdBy || isGlobalAdmin) && (
                    <div className="flex items-center gap-1 mr-0 sm:mr-2 border-r border-zinc-200 pr-3">
                      {onEditTemplate && (
                        <button onClick={() => { onEditTemplate(selectedTemplate); setActiveTab('template-builder'); }} className="p-2 text-zinc-400 hover:text-indigo-600 hover:bg-indigo-50 rounded-lg transition-colors" title="Edit Template">
                          <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" /></svg>
                        </button>
                      )}
                      <button onClick={() => handleDeleteTemplate(selectedTemplate._id)} className="p-2 text-zinc-400 hover:text-red-500 hover:bg-red-50 rounded-lg transition-colors" title="Delete Template">
                        <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" /></svg>
                      </button>
                    </div>
                  )}

                  <button 
                    onClick={() => setIsImportModalOpen(true)}
                    className="bg-zinc-800 hover:bg-zinc-900 text-white px-5 sm:px-6 py-2.5 sm:py-3 rounded-lg text-sm font-semibold shadow-sm transition-all flex items-center justify-center gap-2 flex-1 sm:flex-none"
                  >
                    <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-8l-4-4m0 0L8 8m4-4v12" /></svg>
                    Install
                  </button>
                </div>
              </div>

              {/* Data Modules List */}
              <div className="flex-1 overflow-y-auto p-4 sm:p-8 bg-zinc-50/30">
                <div className="space-y-6">
                  {selectedTemplate.databases.map((db, idx) => (
                    <div key={idx} className="bg-white border border-zinc-200 rounded-xl overflow-hidden shadow-sm">
                      <div className="bg-white px-4 sm:px-5 py-3.5 font-semibold flex items-center gap-2.5 border-b border-zinc-100 text-zinc-800 text-sm tracking-tight">
                        <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4 text-indigo-500" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 7v10c0 2.21 3.582 4 8 4s8-1.79 8-4V7M4 7c0 2.21 3.582 4 8 4s8-1.79 8-4M4 7c0-2.21 3.582-4 8-4s8 1.79 8 4m0 5c0 2.21-3.582 4-8 4s-8-1.79-8-4" /></svg>
                        {db.name}
                      </div>
                      
                      {/* Responsive Table Wrapper */}
                      <div className="overflow-x-auto">
                        <table className="w-full text-left text-sm min-w-[400px]">
                          <thead className="bg-zinc-50/80 border-b border-zinc-100">
                            <tr>
                              <th className="px-4 sm:px-5 py-2.5 font-medium text-zinc-500 text-[10px] uppercase tracking-wider">Field Attribute</th>
                              <th className="px-4 sm:px-5 py-2.5 font-medium text-zinc-500 text-[10px] uppercase tracking-wider w-1/2 sm:w-2/3">Data Protocol</th>
                            </tr>
                          </thead>
                          <tbody className="divide-y divide-zinc-50">
                            {db.fields.map((f, i) => (
                              <tr key={i} className="hover:bg-zinc-50/50">
                                <td className="px-4 sm:px-5 py-3 font-medium text-zinc-700 text-xs">
                                  {f.name} {f.isRequired && <span className="text-red-400 ml-0.5">*</span>}
                                </td>
                                <td className="px-4 sm:px-5 py-3">
                                  <span className="bg-zinc-100 text-zinc-600 px-2 py-0.5 rounded text-[10px] font-medium tracking-wide">
                                    {f.type}
                                  </span>
                                  {f.type === 'dropdown' && <span className="ml-2 text-[11px] text-zinc-400">{f.options.join(', ')}</span>}
                                  {f.type === 'relation' && (
                                    <span className="ml-2 text-[11px] font-medium text-indigo-500 inline-flex items-center gap-1">
                                      <svg xmlns="http://www.w3.org/2000/svg" className="h-3 w-3" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13.828 10.172a4 4 0 00-5.656 0l-4 4a4 4 0 105.656 5.656l1.102-1.101m-.758-4.899a4 4 0 005.656 0l4-4a4 4 0 00-5.656-5.656l-1.1 1.1" /></svg>
                                      Links to {selectedTemplate.databases.find(d => d.tempId === f.targetTempId)?.name || 'DB'}
                                    </span>
                                  )}
                                </td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </>
          ) : (
             <div className="flex-1 flex flex-col items-center justify-center text-zinc-400 bg-zinc-50/30 p-8 text-center">
              <div className="w-16 h-16 bg-zinc-100 rounded-full flex items-center justify-center mb-4">
                <svg xmlns="http://www.w3.org/2000/svg" className="h-8 w-8 text-zinc-300" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M4 5a1 1 0 011-1h14a1 1 0 011 1v2a1 1 0 01-1 1H5a1 1 0 01-1-1V5zM4 13a1 1 0 011-1h6a1 1 0 011 1v6a1 1 0 01-1 1H5a1 1 0 01-1-1v-6zM16 13a1 1 0 011-1h2a1 1 0 011 1v6a1 1 0 01-1 1h-2a1 1 0 01-1-1v-6z" /></svg>
              </div>
              <p className="font-medium text-zinc-500 text-sm">Select a template from the library to preview its architecture.</p>
            </div>
          )}
        </div>
      </div>

      {/* --- IMPORT MODAL --- */}
      {isImportModalOpen && selectedTemplate && (
        <div className="fixed inset-0 bg-zinc-900/40 backdrop-blur-sm flex items-center justify-center z-[60] p-4">
          <div className="bg-white rounded-2xl shadow-xl w-full max-w-md overflow-hidden flex flex-col border border-zinc-200">
            <div className="px-5 sm:px-6 py-4 sm:py-5 border-b border-zinc-100 bg-zinc-50 flex justify-between items-center">
              <h3 className="font-semibold tracking-tight text-zinc-800 text-base sm:text-lg">Install Architecture</h3>
              <button onClick={() => setIsImportModalOpen(false)} className="text-zinc-400 hover:text-zinc-700 bg-white p-1 rounded border border-zinc-200 shadow-sm transition-colors">
                <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" /></svg>
              </button>
            </div>
            
            <form onSubmit={handleImport} className="p-5 sm:p-6 space-y-5 sm:space-y-6">
              <div className="bg-indigo-50/50 border border-indigo-100 p-3 sm:p-4 rounded-xl flex items-center gap-3 sm:gap-4">
                <div className="w-10 h-10 bg-indigo-100 text-indigo-600 rounded-lg flex items-center justify-center shrink-0">
                  <div className="w-5 h-5" dangerouslySetInnerHTML={{ __html: selectedTemplate.icon || '<svg fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M13 10V3L4 14h7v7l9-11h-7z"></path></svg>' }} />
                </div>
                <div>
                  <p className="text-sm font-semibold tracking-tight text-indigo-900">{selectedTemplate.name}</p>
                  <p className="text-[10px] text-indigo-500 uppercase tracking-widest font-medium mt-0.5">{selectedTemplate.databases.length} Data Modules</p>
                </div>
              </div>

              <div className="flex gap-2 p-1 bg-zinc-100 rounded-lg">
                <button type="button" onClick={() => setImportTarget('existing')} className={`flex-1 py-1.5 sm:py-2 text-xs font-medium rounded transition-all ${importTarget === 'existing' ? 'bg-white shadow-sm border border-zinc-200/50 text-zinc-800' : 'text-zinc-500 hover:text-zinc-700'}`}>Existing Workspace</button>
                <button type="button" onClick={() => setImportTarget('new')} className={`flex-1 py-1.5 sm:py-2 text-xs font-medium rounded transition-all ${importTarget === 'new' ? 'bg-white shadow-sm border border-zinc-200/50 text-zinc-800' : 'text-zinc-500 hover:text-zinc-700'}`}>Create New</button>
              </div>

              {importTarget === 'existing' ? (
                <div>
                  <label className="block text-[10px] font-medium text-zinc-500 uppercase tracking-wider mb-1.5">Destination Workspace</label>
                  <select required value={selectedWorkspaceId} onChange={e => setSelectedWorkspaceId(e.target.value)} className="w-full border border-zinc-200 bg-zinc-50 focus:bg-white rounded-lg px-3 sm:px-4 py-2.5 sm:py-3 text-sm outline-none focus:border-indigo-400 transition-colors">
                    <option value="">Choose a workspace...</option>
                    {workspaces.map(w => <option key={w._id} value={w._id}>{w.name}</option>)}
                  </select>
                </div>
              ) : (
                <div>
                  <label className="block text-[10px] font-medium text-zinc-500 uppercase tracking-wider mb-1.5">New Workspace Name</label>
                  <input required type="text" value={newWorkspaceName} onChange={e => setNewWorkspaceName(e.target.value)} className="w-full border border-zinc-200 bg-zinc-50 focus:bg-white rounded-lg px-3 sm:px-4 py-2.5 sm:py-3 text-sm outline-none focus:border-indigo-400 transition-colors" placeholder="e.g. Acme Corp Account" />
                </div>
              )}

              <button type="submit" disabled={isImporting || (importTarget === 'existing' && !selectedWorkspaceId)} className="w-full bg-zinc-800 text-white font-medium py-3 rounded-lg hover:bg-zinc-900 disabled:opacity-50 mt-2 flex justify-center items-center gap-2 transition-all">
                {isImporting ? (
                   <>
                     <svg className="animate-spin h-4 w-4 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24"><circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle><path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path></svg>
                     Compiling Architecture...
                   </>
                ) : 'Confirm Installation'}
              </button>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}