import { useState, useEffect } from 'react';
import { useNavigate, useLocation } from 'react-router-dom'; 
import api from '../api/axiosConfig';

export default function DynamicTable({ entity, records, userPermissions, currentUser }) {
  const navigate = useNavigate();
  const location = useLocation();

  // --- CORE STATE ---
  const [editingRecord, setEditingRecord] = useState(null);
  const [editFormData, setEditFormData] = useState({});
  const [isUpdating, setIsUpdating] = useState(false);
  const [isUploadingFile, setIsUploadingFile] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');

  // --- RELATIONAL ENGINE STATE ---
  const [relationData, setRelationData] = useState({}); 
  const [subRecords, setSubRecords] = useState([]);     
  const [modalTab, setModalTab] = useState('details');  
  const [isLoadingRelations, setIsLoadingRelations] = useState(false);

  // --- SMART PERMISSIONS STATE ---
  const [localPerms, setLocalPerms] = useState(null);
  const [localUser, setLocalUser] = useState(null);

  // 1. SMART PERMISSION RESOLVER
  useEffect(() => {
    const resolvePermissions = async () => {
      try {
        const userInfo = currentUser || JSON.parse(localStorage.getItem('userInfo'));
        setLocalUser(userInfo);

        if (userPermissions) {
          setLocalPerms(userPermissions);
          return;
        }

        if (!entity) return;
        const workspaceId = entity.workspace || entity.workspaceId;
        const res = await api.get('/workspaces');
        const workspace = res.data.find(w => w._id === workspaceId);
        
        if (!workspace) return;

        // FIX: Force user ID into a string for bulletproof comparisons
        const userIdStr = String(userInfo?.id || userInfo?._id);
        const ownerIdStr = String(workspace.owner._id || workspace.owner);

        // Owner Check
        if (ownerIdStr === userIdStr) {
          setLocalPerms({ editAllRecords: true, editOwnRecords: true, deleteAllRecords: true, deleteOwnRecords: true });
          return;
        }

        // Custom Role Check (FIXED string comparisons)
        const member = workspace.members.find(m => String(m.user._id || m.user) === userIdStr);
        if (member && workspace.customRoles) {
          const role = workspace.customRoles.find(r => String(r._id) === String(member.roleId));
          if (role) {
            setLocalPerms(role.permissions);
            return;
          }
        }

        // Fallback for Viewers
        setLocalPerms({ editAllRecords: false, editOwnRecords: false, deleteAllRecords: false, deleteOwnRecords: false });

      } catch (error) {
        console.error("Failed to resolve table permissions", error);
        setLocalPerms({ editAllRecords: true, editOwnRecords: true, deleteAllRecords: true, deleteOwnRecords: true });
      }
    };
    resolvePermissions();
  }, [entity, userPermissions, currentUser]);


  // 2. FETCH FORWARD LINKS
  useEffect(() => {
    const fetchForwardRelations = async () => {
      if (!entity || !entity.fields) return;
      const relationFields = entity.fields.filter(f => f.type === 'relation' && f.targetEntity);
      if (relationFields.length === 0) return;

      const newRelationData = {};
      for (let field of relationFields) {
        try {
          const res = await api.get(`/records/entity/${field.targetEntity}`);
          newRelationData[field.name] = res.data;
        } catch (error) { console.error('Failed to fetch relation data'); }
      }
      setRelationData(newRelationData);
    };
    fetchForwardRelations();
  }, [entity]);

  // Helper to translate an ID into the first column's text
  const getDisplayValue = (recordId, fieldName) => {
    if (!recordId) return '-';
    const targetRecords = relationData[fieldName] || [];
    const match = targetRecords.find(r => r._id === recordId);
    if (!match || !match.data) return `ID: ${String(recordId).slice(-4)}`;
    const keys = Object.keys(match.data);
    return keys.length > 0 ? match.data[keys[0]] : 'Unnamed';
  };

  // --- EDIT / SUB-RECORD LOGIC ---
  const handleEditClick = async (record) => {
    setEditingRecord(record);
    setEditFormData(record.data || {});
    setModalTab('details');
    setSubRecords([]); 

    setIsLoadingRelations(true);
    try {
      const workspaceId = entity.workspace || entity.workspaceId;
      const resEntities = await api.get(`/entities/workspace/${workspaceId}`);
      
      const linkedEntities = resEntities.data.filter(e => 
        e.fields.some(f => f.type === 'relation' && f.targetEntity === entity._id)
      );

      const relatedData = [];
      for (let linkedEnt of linkedEntities) {
        const linkField = linkedEnt.fields.find(f => f.type === 'relation' && f.targetEntity === entity._id).name;
        const resRecords = await api.get(`/records/entity/${linkedEnt._id}`);
        
        const matches = resRecords.data.filter(r => r.data && r.data[linkField] === record._id);
        
        if (matches.length > 0) {
          const otherRelationFields = linkedEnt.fields.filter(f => f.type === 'relation' && f.name !== linkField);
          
          const lookupDict = {};
          for (let orf of otherRelationFields) {
            try {
              const targetRes = await api.get(`/records/entity/${orf.targetEntity}`);
              lookupDict[orf.name] = targetRes.data;
            } catch (e) { console.error("Lookup failed for", orf.name); }
          }

          const resolvedMatches = matches.map(m => {
            const resolvedData = { ...m.data };
            for (let orf of otherRelationFields) {
              const rawId = resolvedData[orf.name];
              if (rawId && lookupDict[orf.name]) {
                const targetRec = lookupDict[orf.name].find(tr => tr._id === rawId);
                if (targetRec && targetRec.data) {
                  const keys = Object.keys(targetRec.data);
                  if (keys.length > 0) {
                    resolvedData[orf.name] = targetRec.data[keys[0]]; 
                  }
                }
              }
            }
            return { ...m, data: resolvedData };
          });

          relatedData.push({ entityName: linkedEnt.name, records: resolvedMatches });
        }
      }
      setSubRecords(relatedData);
    } catch (error) {
      console.error("Failed to load sub-records", error);
    } finally {
      setIsLoadingRelations(false);
    }
  };

  // --- NEW: THE DEEP-LINK AUTO OPENER ---
  useEffect(() => {
    const params = new URLSearchParams(location.search);
    const openRecordId = params.get('openRecord');

    if (openRecordId && records && records.length > 0) {
      const recordToOpen = records.find(r => r._id === openRecordId);
      if (recordToOpen) {
        handleEditClick(recordToOpen);
        navigate(location.pathname, { replace: true });
      }
    }
  }, [location.search, records, navigate]); 

  if (!entity || !records) return null;

  // --- STANDARD CRUD LOGIC ---
  const handleDelete = async (id) => {
    if (!window.confirm("Permanently delete this record?")) return;
    try {
      await api.delete(`/records/${id}`);
      window.location.reload(); 
    } catch (error) { alert(error.response?.data?.message || "Delete failed"); }
  };

  const handleEditChange = (fieldName, value) => {
    setEditFormData(prev => ({ ...prev, [fieldName]: value }));
  };

  const handleFileUpload = async (e, fieldName) => {
    const file = e.target.files[0];
    if (!file) return;
    setIsUploadingFile(true);
    const formData = new FormData();
    formData.append('file', file);
    formData.append('workspaceId', entity.workspace || entity.workspaceId);
    try {
      const res = await api.post('/upload', formData, { headers: { 'Content-Type': 'multipart/form-data' }});
      handleEditChange(fieldName, res.data.url || res.data.secure_url || res.data);
    } catch (error) { alert("Upload failed"); } 
    finally { setIsUploadingFile(false); }
  };

  const handleMultiUpload = async (e, fieldName) => {
    const files = Array.from(e.target.files);
    if (!files.length) return;
    setIsUploadingFile(true);
    try {
      const uploadPromises = files.map(file => {
        const formData = new FormData();
        formData.append('file', file);
        formData.append('workspaceId', entity.workspace || entity.workspaceId);
        return api.post('/upload', formData, { headers: { 'Content-Type': 'multipart/form-data' } });
      });
      const responses = await Promise.all(uploadPromises);
      const newUrls = responses.map(res => res.data.url || res.data.secure_url || res.data);
      setEditFormData(prev => ({ ...prev, [fieldName]: [...(prev[fieldName] || []), ...newUrls] }));
    } catch (error) { alert("Upload failed"); } 
    finally { setIsUploadingFile(false); }
  };

  const removeFileFromArray = (fieldName, indexToRemove) => {
    setEditFormData(prev => ({ ...prev, [fieldName]: (prev[fieldName] || []).filter((_, idx) => idx !== indexToRemove) }));
  };

  const submitUpdate = async (e) => {
    e.preventDefault();
    setIsUpdating(true);
    try {
      await api.put(`/records/${editingRecord._id}`, { dynamicData: editFormData });
      window.location.reload(); 
    } catch (error) { alert(error.response?.data?.message || "Update failed"); } 
    finally { setIsUpdating(false); }
  };

  const filteredRecords = records.filter(record => {
    if (!searchTerm) return true; 
    const lowerSearch = searchTerm.toLowerCase();
    const recordValues = Object.values(record.data || {});
    return recordValues.some(val => String(val).toLowerCase().includes(lowerSearch));
  });

  const exportToCSV = () => {
    if (filteredRecords.length === 0) return alert("No records to export.");
    const headers = entity.fields.map(f => f.name);
    headers.push('Added By'); 
    
    const csvRows = filteredRecords.map(record => {
      const rowData = entity.fields.map(field => {
        let val = record.data?.[field.name];
        if (field.type === 'relation') val = getDisplayValue(val, field.name); 
        if (Array.isArray(val)) val = val.join(' | ');
        if (val === true) val = 'Yes';
        if (val === false) val = 'No';
        if (val === null || val === undefined) val = '';
        return `"${String(val).replace(/"/g, '""')}"`;
      });
      rowData.push(`"${record.createdBy?.name || 'Unknown'}"`);
      return rowData.join(',');
    });

    const csvContent = [headers.join(','), ...csvRows].join('\n');
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement('a');
    link.setAttribute('href', URL.createObjectURL(blob));
    link.setAttribute('download', `${entity.name.replace(/\s+/g, '_')}_Export.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  return (
    <div className="flex flex-col gap-3">
      {/* TOOLBAR */}
      <div className="flex justify-between items-center bg-white p-2.5 rounded-lg border border-zinc-200 shadow-sm">
        <div className="relative flex items-center w-full max-w-sm">
          <svg xmlns="http://www.w3.org/2000/svg" className="absolute left-2.5 h-4 w-4 text-zinc-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
          </svg>
          <input type="text" placeholder="Filter records..." value={searchTerm} onChange={(e) => setSearchTerm(e.target.value)} className="w-full pl-8 pr-3 py-1.5 text-sm border border-zinc-200 rounded-md outline-none focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500 transition-all bg-zinc-50 focus:bg-white" />
        </div>
        <button onClick={exportToCSV} className="flex items-center gap-1.5 bg-white text-zinc-600 hover:text-zinc-900 hover:bg-zinc-50 border border-zinc-200 py-1.5 px-3 rounded-md text-xs font-semibold transition-colors shadow-sm ml-2">
          <svg xmlns="http://www.w3.org/2000/svg" className="h-3.5 w-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" /></svg>
          <span className="hidden sm:inline">Export</span>
        </button>
      </div>

      {/* DATA GRID */}
      <div className="bg-white rounded-lg border border-zinc-200 overflow-hidden shadow-sm">
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="bg-zinc-50/80 border-b border-zinc-200">
                {entity.fields.map((field, index) => <th key={index} className="px-4 py-2 text-[11px] font-semibold text-zinc-500 uppercase tracking-wider whitespace-nowrap">{field.name}</th>)}
                <th className="px-4 py-2 text-[11px] font-semibold text-zinc-500 uppercase tracking-wider whitespace-nowrap">Creator</th>
                <th className="px-4 py-2 text-[11px] font-semibold text-zinc-500 uppercase tracking-wider whitespace-nowrap text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-zinc-100">
              {filteredRecords.map((record) => {

                // --- PHASE 3: FIXED SMART ROW PERMISSIONS ---
                // We also strictly parse the record creator ID to strings here to ensure it matches exactly
                const myIdStr = String(localUser?.id || localUser?._id);
                const creatorIdStr = String(record.createdBy?._id || record.createdBy);
                const isMyRecord = myIdStr === creatorIdStr;
                
                const canEdit = localPerms ? (localPerms.editAllRecords || (localPerms.editOwnRecords && isMyRecord)) : true;
                const canDelete = localPerms ? (localPerms.deleteAllRecords || (localPerms.deleteOwnRecords && isMyRecord)) : true;
                // --------------------------------------

                return (
                  <tr key={record._id} className="hover:bg-zinc-50/50 transition-colors group">
                    {entity.fields.map((field, index) => (
                      <td key={index} className="px-4 py-2.5 text-sm text-zinc-700">
                        
                        {/* --- THE DEEP LINK BUTTON --- */}
                        {field.type === 'relation' && record.data?.[field.name] && (
                          <button 
                            onClick={(e) => {
                              e.stopPropagation();
                              navigate(`/crm/${field.targetEntity}/record/${record.data[field.name]}`); 
                            }}
                            className="inline-flex items-center gap-1 px-2 py-0.5 rounded border border-indigo-100 bg-indigo-50 text-indigo-700 hover:bg-indigo-100 transition-colors text-[11px] font-semibold whitespace-nowrap cursor-pointer"
                          >
                            <svg xmlns="http://www.w3.org/2000/svg" className="h-3 w-3" viewBox="0 0 20 20" fill="currentColor"><path fillRule="evenodd" d="M12.586 4.586a2 2 0 112.828 2.828l-3 3a2 2 0 01-2.828 0 1 1 0 00-1.414 1.414 4 4 0 005.656 0l3-3a4 4 0 00-5.656-5.656l-1.5 1.5a1 1 0 101.414 1.414l1.5-1.5zm-5 5a2 2 0 012.828 0 1 1 0 101.414-1.414 4 4 0 00-5.656 0l-3 3a4 4 0 105.656 5.656l1.5-1.5a1 1 0 10-1.414-1.414l-1.5 1.5a2 2 0 11-2.828-2.828l3-3z" clipRule="evenodd" /></svg>
                            {getDisplayValue(record.data[field.name], field.name)}
                          </button>
                        )}

                        {field.type === 'checkbox' && <span className={`px-2 py-0.5 text-[10px] font-bold rounded border ${record.data?.[field.name] ? 'bg-emerald-50 text-emerald-700 border-emerald-200' : 'bg-zinc-100 text-zinc-500 border-zinc-200'}`}>{record.data?.[field.name] ? 'TRUE' : 'FALSE'}</span>}
                        {(field.type === 'text' || field.type === 'textarea' || field.type === 'dropdown' || field.type === 'number') && <span className="whitespace-pre-wrap truncate max-w-xs block">{record.data?.[field.name] || '-'}</span>}
                        {field.type === 'date' && <span className="text-zinc-500 whitespace-nowrap">{record.data?.[field.name] ? new Date(record.data[field.name]).toLocaleDateString() : '-'}</span>}
                        {field.type === 'datetime' && <span className="text-zinc-500 whitespace-nowrap">{record.data?.[field.name] ? new Date(record.data[field.name]).toLocaleString([], { dateStyle: 'medium', timeStyle: 'short' }) : '-'}</span>}
                        
                        {field.type === 'media' && record.data?.[field.name] && <a href={record.data[field.name]} target="_blank" rel="noreferrer"><img src={record.data[field.name]} alt="file" className="h-8 w-8 object-cover rounded border border-zinc-200 opacity-90 hover:opacity-100 transition-opacity" /></a>}
                        {field.type === 'media-multiple' && Array.isArray(record.data?.[field.name]) && (
                          <div className="flex gap-1 flex-wrap max-w-[120px]">{record.data[field.name].map((url, i) => <a key={i} href={url} target="_blank" rel="noreferrer"><img src={url} alt={`file-${i}`} className="h-6 w-6 object-cover rounded border border-zinc-200 opacity-80 hover:opacity-100" /></a>)}</div>
                        )}
                      </td>
                    ))}
                    <td className="px-4 py-2.5 text-xs text-zinc-400 whitespace-nowrap">{record.createdBy?.name || 'Unknown'}</td>
                    
                    {/* --- CONDITIONALLY RENDER ACTIONS --- */}
                    <td className="px-4 py-2.5 text-right flex justify-end gap-2 opacity-100 sm:group-hover:opacity-100 transition-opacity">
                      {canEdit && (
                        <button onClick={() => handleEditClick(record)} className="text-zinc-400 hover:text-indigo-600 p-1"><svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" /></svg></button>
                      )}
                      {canDelete && (
                        <button onClick={() => handleDelete(record._id)} className="text-zinc-400 hover:text-red-600 p-1"><svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" /></svg></button>
                      )}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>

      {/* --- EDIT / SUB-RECORDS MODAL --- */}
      {editingRecord && (
        <div className="fixed inset-0 bg-zinc-900/40 backdrop-blur-sm flex items-center justify-center z-[60] p-4">
          <div className="bg-white rounded-xl shadow-xl w-full max-w-2xl max-h-[90vh] overflow-hidden flex flex-col border border-zinc-200">
            
            <div className="flex justify-between items-center px-6 py-4 border-b border-zinc-100 bg-zinc-50/50">
              <h3 className="text-sm font-semibold text-zinc-900">Edit {entity.name} Record</h3>
              <button onClick={() => setEditingRecord(null)} className="text-zinc-400 hover:text-zinc-600"><svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" viewBox="0 0 20 20" fill="currentColor"><path fillRule="evenodd" d="M4.293 4.293a1 1 0 011.414 0L10 8.586l4.293-4.293a1 1 0 111.414 1.414L11.414 10l4.293 4.293a1 1 0 01-1.414 1.414L10 11.414l-4.293 4.293a1 1 0 01-1.414-1.414L8.586 10 4.293 5.707a1 1 0 010-1.414z" clipRule="evenodd" /></svg></button>
            </div>

            {/* TAB NAVIGATION */}
            <div className="flex border-b border-zinc-200 px-6 pt-2 bg-zinc-50/30">
              <button onClick={() => setModalTab('details')} className={`pb-3 text-sm font-semibold transition-colors border-b-2 ${modalTab === 'details' ? 'border-indigo-600 text-indigo-600' : 'border-transparent text-zinc-500 hover:text-zinc-800'}`}>Record Details</button>
              <button onClick={() => setModalTab('related')} className={`pb-3 ml-6 text-sm font-semibold transition-colors border-b-2 flex items-center gap-1.5 ${modalTab === 'related' ? 'border-indigo-600 text-indigo-600' : 'border-transparent text-zinc-500 hover:text-zinc-800'}`}>
                Related Activity
                {subRecords.length > 0 && <span className="bg-indigo-100 text-indigo-700 py-0.5 px-2 rounded-full text-[10px]">{subRecords.reduce((acc, sr) => acc + sr.records.length, 0)}</span>}
              </button>
            </div>

            {/* TAB 1: FORM DETAILS */}
            {modalTab === 'details' && (
              <form onSubmit={submitUpdate} className="flex-1 overflow-y-auto p-6 flex flex-col gap-5">
                {entity.fields.map((field, idx) => (
                  <div key={idx} className="flex flex-col gap-1.5">
                    <label className="text-xs font-semibold text-zinc-500 uppercase tracking-wider">{field.name}</label>
                    {field.type === 'text' && <input type="text" value={editFormData[field.name] || ''} onChange={(e) => handleEditChange(field.name, e.target.value)} className="px-3 py-2 text-sm border border-zinc-200 rounded-md focus:ring-1 focus:ring-indigo-500 outline-none" />}
                    {field.type === 'number' && <input type="number" value={editFormData[field.name] || ''} onChange={(e) => handleEditChange(field.name, e.target.value)} className="px-3 py-2 text-sm border border-zinc-200 rounded-md focus:ring-1 focus:ring-indigo-500 outline-none" />}
                    {field.type === 'textarea' && <textarea value={editFormData[field.name] || ''} onChange={(e) => handleEditChange(field.name, e.target.value)} className="px-3 py-2 text-sm border border-zinc-200 rounded-md focus:ring-1 focus:ring-indigo-500 outline-none min-h-[80px]" />}
                    {field.type === 'date' && <input type="date" value={editFormData[field.name] ? editFormData[field.name].split('T')[0] : ''} onChange={(e) => handleEditChange(field.name, e.target.value)} className="px-3 py-2 text-sm border border-zinc-200 rounded-md outline-none focus:ring-1 focus:ring-indigo-500" />}
                    {field.type === 'datetime' && <input type="datetime-local" value={editFormData[field.name] ? new Date(editFormData[field.name]).toISOString().slice(0, 16) : ''} onChange={(e) => handleEditChange(field.name, e.target.value)} className="px-3 py-2 text-sm border border-zinc-200 rounded-md outline-none focus:ring-1 focus:ring-indigo-500" />}
                    
                    {(field.type === 'dropdown' || field.type === 'relation') && (
                      <select value={editFormData[field.name] || ''} onChange={(e) => handleEditChange(field.name, e.target.value)} className="px-3 py-2 text-sm border border-zinc-200 rounded-md bg-white outline-none focus:ring-1 focus:ring-indigo-500">
                        <option value="">Select option...</option>
                        {field.type === 'dropdown' && (field.options || []).map((opt, i) => <option key={i} value={opt}>{opt}</option>)}
                        {field.type === 'relation' && (relationData[field.name] || []).map(r => <option key={r._id} value={r._id}>{getDisplayValue(r._id, field.name)}</option>)}
                      </select>
                    )}

                    {field.type === 'checkbox' && <label className="flex items-center gap-2 mt-1 w-fit"><input type="checkbox" checked={editFormData[field.name] || false} onChange={(e) => handleEditChange(field.name, e.target.checked)} className="w-4 h-4 text-indigo-600 rounded" /><span className="text-sm text-zinc-600">Enabled</span></label>}
                    
                    {field.type === 'media' && (
                      <div className="flex flex-col gap-2">
                        {editFormData[field.name] ? (
                          <div className="relative w-20 h-20 border rounded-md overflow-hidden group"><img src={editFormData[field.name]} alt="preview" className="w-full h-full object-cover" /><button type="button" onClick={() => handleEditChange(field.name, '')} className="absolute inset-0 bg-black/60 text-white opacity-0 group-hover:opacity-100 flex items-center justify-center text-xs">Clear</button></div>
                        ) : (<input type="file" onChange={(e) => handleFileUpload(e, field.name)} className="text-xs" />)}
                      </div>
                    )}
                    
                    {field.type === 'media-multiple' && (
                      <div className="flex flex-col gap-3 p-3 border rounded-md">
                         <div className="flex flex-wrap gap-2">{editFormData[field.name]?.map((url, i) => <div key={i} className="relative w-16 h-16 border rounded overflow-hidden group"><img src={url} alt="file" className="w-full h-full object-cover" /><button type="button" onClick={() => removeFileFromArray(field.name, i)} className="absolute top-0 right-0 bg-red-500 text-white w-5 h-5 flex items-center justify-center text-xs opacity-0 group-hover:opacity-100">×</button></div>)}</div>
                         <input type="file" multiple onChange={(e) => handleMultiUpload(e, field.name)} className="text-xs" />
                      </div>
                    )}
                  </div>
                ))}

                <div className="flex gap-2 mt-4 pt-5 border-t border-zinc-100">
                  <button type="button" onClick={() => setEditingRecord(null)} className="flex-1 bg-white border border-zinc-200 text-zinc-700 py-2 rounded-md font-medium text-sm hover:bg-zinc-50">Cancel</button>
                  <button type="submit" disabled={isUpdating || isUploadingFile} className="flex-1 bg-indigo-600 text-white py-2 rounded-md font-medium text-sm hover:bg-indigo-700 disabled:opacity-50">
                    {isUploadingFile ? 'Uploading...' : isUpdating ? 'Saving...' : 'Save Changes'}
                  </button>
                </div>
              </form>
            )}

            {/* TAB 2: RELATED RECORDS TIMELINE */}
            {modalTab === 'related' && (
              <div className="flex-1 overflow-y-auto p-6 bg-zinc-50/50">
                {isLoadingRelations ? (
                  <div className="text-center py-10 text-sm text-zinc-500">Scanning workspace for related records...</div>
                ) : subRecords.length === 0 ? (
                  <div className="text-center py-12 border-2 border-dashed border-zinc-200 rounded-xl bg-white">
                    <svg xmlns="http://www.w3.org/2000/svg" className="h-8 w-8 text-zinc-300 mx-auto mb-2" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13.828 10.172a4 4 0 00-5.656 0l-4 4a4 4 0 105.656 5.656l1.102-1.101m-.758-4.899a4 4 0 005.656 0l4-4a4 4 0 00-5.656-5.656l-1.1 1.1" /></svg>
                    <p className="text-sm font-medium text-zinc-600">No linked records found.</p>
                    <p className="text-xs text-zinc-400 mt-1">When other databases link to this record, they will appear here.</p>
                  </div>
                ) : (
                  <div className="space-y-6">
                    {subRecords.map((subSet, index) => (
                      <div key={index} className="space-y-3">
                        <h4 className="text-xs font-bold text-zinc-400 uppercase tracking-widest">{subSet.entityName}</h4>
                        <div className="grid gap-3">
                          {subSet.records.map(rec => (
                            <div key={rec._id} className="bg-white p-3.5 rounded-lg border border-zinc-200 shadow-sm flex flex-col gap-1.5">
                              {Object.entries(rec.data).map(([key, val], i) => {
                                if (val === editingRecord._id) return null;
                                return (
                                  <div key={i} className="flex flex-col sm:flex-row sm:justify-between sm:items-baseline gap-1">
                                    <span className="text-[11px] font-semibold text-zinc-400 uppercase">{key}</span>
                                    <span className="text-sm text-zinc-800 font-medium truncate max-w-[250px]">{String(val)}</span>
                                  </div>
                                );
                              })}
                              <div className="mt-2 pt-2 border-t border-zinc-50 flex justify-between text-[10px] text-zinc-400">
                                <span>Logged by {rec.createdBy?.name || 'User'}</span>
                                <span>{new Date(rec.createdAt).toLocaleDateString()}</span>
                              </div>
                            </div>
                          ))}
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )}

          </div>
        </div>
      )}
    </div>
  );
}