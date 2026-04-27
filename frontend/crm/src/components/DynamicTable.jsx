import { useState, useEffect } from 'react';
import { useNavigate, useLocation } from 'react-router-dom'; 
import api from '../api/axiosConfig';
import DynamicForm from './DynamicForm'; // --- NEW: Connected the standalone form component ---

export default function DynamicTable({ entity, records, userPermissions, currentUser }) {
  const navigate = useNavigate();
  const location = useLocation();

  const [editingRecord, setEditingRecord] = useState(null);
  const [searchTerm, setSearchTerm] = useState('');

  const [relationData, setRelationData] = useState({}); 
  const [workspaceUsers, setWorkspaceUsers] = useState([]); 
  const [memberActivityUserId, setMemberActivityUserId] = useState(null);
  const [localPerms, setLocalPerms] = useState(null);
  const [localUser, setLocalUser] = useState(null);

  useEffect(() => {
    const fetchUsers = async () => {
      try {
        const userInfo = currentUser || JSON.parse(localStorage.getItem('userInfo'));
        const res = await api.get('/workspaces');
        const wsId = entity.workspace || entity.workspaceId;
        const currentWs = res.data.find(w => w._id === wsId);
        
        if (currentWs) {
          let usersList = [];
          if (currentWs.owner) usersList.push(currentWs.owner);
          currentWs.members.forEach(m => {
            if (m.status === 'accepted' && m.user) {
              if (!usersList.find(u => String(u._id) === String(m.user._id))) {
                 usersList.push(m.user);
              }
            }
          });
          setWorkspaceUsers(usersList);
        }
      } catch (error) {
        console.error("Failed to load workspace users for table");
      }
    };
    if (entity) fetchUsers();
  }, [entity, currentUser]);

  const getUserDisplayName = (userId) => {
    if (!userId) return '-';
    const user = workspaceUsers.find(u => String(u._id) === String(userId));
    return user ? (user.name || user.email) : 'Unknown User';
  };

  const computeFormula = (currentData, formulaString) => {
    if (!formulaString) return '';
    let equation = formulaString;
    const variables = formulaString.match(/\{([^}]+)\}/g);
    
    if (variables) {
      variables.forEach(variable => {
        const colName = variable.replace(/[{}]/g, '');
        let val = currentData[colName];
        if (val === undefined || val === null || val === '') {
          val = 0;
        } else if (typeof val === 'string') {
          const stripped = val.replace(/[^0-9.-]+/g, ""); 
          val = stripped !== '' ? Number(stripped) : 0;
        } else {
          val = Number(val);
          if (isNaN(val)) val = 0;
        }
        equation = equation.split(variable).join(val);
      });
    }

    try {
      const sanitizedEquation = equation.replace(/[^-()\d/*+.]/g, '');
      if (!sanitizedEquation) return '';
      const result = new Function(`'use strict'; return (${sanitizedEquation})`)();
      if (!Number.isFinite(result) || Number.isNaN(result)) return '';
      return Number(result.toFixed(2));
    } catch (e) { return '#ERROR'; }
  };

  const getActiveFormula = (field, currentFormData) => {
    if (field.type === 'formula') return field.formula || '';
    if (field.type === 'conditional-formula') {
      const dependentValue = String(currentFormData[field.dependentField] || '').trim();
      const matchedCondition = field.conditions?.find(c => String(c.value).trim() === dependentValue);
      return matchedCondition ? (matchedCondition.formula || '') : '';
    }
    return '';
  };

  const computeLookup = (field, currentData) => {
    if (!field.sourceRelationField || !field.targetLookupField) return '';
    const sourceId = currentData[field.sourceRelationField];
    if (!sourceId) return '';
    const sourceRecords = relationData[field.sourceRelationField] || [];
    const match = sourceRecords.find(r => r._id === sourceId);
    if (match && match.data) return match.data[field.targetLookupField] || '';
    return '';
  };

  const computeRollup = (field, currentData) => {
    if (!field.sourceRelationField || !field.targetLookupField) return '';
    const sourceValues = currentData[field.sourceRelationField];
    if (!sourceValues) return '';
    const ids = Array.isArray(sourceValues) ? sourceValues : [sourceValues];
    const sourceRecords = relationData[field.sourceRelationField] || [];
    let values = [];
    ids.forEach(id => {
      const match = sourceRecords.find(r => r._id === id);
      if (match && match.data && match.data[field.targetLookupField] !== undefined && match.data[field.targetLookupField] !== '') {
        let val = match.data[field.targetLookupField];
        if (typeof val === 'string') {
          const stripped = val.replace(/[^0-9.-]+/g, "");
          val = stripped !== '' ? Number(stripped) : 0;
        } else val = Number(val) || 0;
        values.push(val);
      }
    });

    if (values.length === 0) return field.rollupFunction === 'COUNT' ? 0 : '';
    switch(field.rollupFunction) {
      case 'SUM': return values.reduce((a, b) => a + b, 0);
      case 'AVERAGE': return parseFloat((values.reduce((a, b) => a + b, 0) / values.length).toFixed(2));
      case 'MAX': return Math.max(...values);
      case 'MIN': return Math.min(...values);
      case 'COUNT': return values.length;
      default: return '';
    }
  };

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

        const userIdStr = String(userInfo?.id || userInfo?._id);
        const ownerIdStr = String(workspace.owner._id || workspace.owner);

        if (ownerIdStr === userIdStr) {
          setLocalPerms({ editAllRecords: true, editOwnRecords: true, deleteAllRecords: true, deleteOwnRecords: true });
          return;
        }

        const member = workspace.members.find(m => String(m.user._id || m.user) === userIdStr);
        if (member && workspace.customRoles) {
          const role = workspace.customRoles.find(r => String(r._id) === String(member.roleId));
          if (role) {
            let finalPerms = { ...role.permissions };
            if (role.entityOverrides && role.entityOverrides.length > 0) {
              const override = role.entityOverrides.find(eo => String(eo.entityId) === String(entity._id));
              if (override) finalPerms = { ...finalPerms, ...override.permissions };
            }
            setLocalPerms(finalPerms);
            return;
          }
        }
        setLocalPerms({ editAllRecords: false, editOwnRecords: false, deleteAllRecords: false, deleteOwnRecords: false });
      } catch (error) {
        console.error("Failed to resolve table permissions", error);
        setLocalPerms({ editAllRecords: true, editOwnRecords: true, deleteAllRecords: true, deleteOwnRecords: true });
      }
    };
    resolvePermissions();
  }, [entity, userPermissions, currentUser]);

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

  const getDisplayValue = (recordId, fieldName) => {
    if (!recordId) return '-';
    const targetRecords = relationData[fieldName] || [];
    const match = targetRecords.find(r => r._id === recordId);
    if (!match || !match.data) return `ID: ${String(recordId).slice(-4)}`;
    
    const fieldObj = entity.fields.find(f => f.name === fieldName);
    if (fieldObj && fieldObj.displayFields && fieldObj.displayFields.length > 0) {
      return fieldObj.displayFields.map(fn => {
        if (match.data[fn] !== undefined) return match.data[fn];
        const flexKey = Object.keys(match.data).find(k => k.toLowerCase().trim() === fn.toLowerCase().trim());
        return flexKey ? match.data[flexKey] : null;
      }).filter(val => val !== undefined && val !== null && val !== '').join(' - '); 
    }
    const keys = Object.keys(match.data);
    return keys.length > 0 ? match.data[keys[0]] : 'Unnamed';
  };

  const handleEditClick = (record) => {
    setEditingRecord(record);
  };

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

  const handleDelete = async (id) => {
    if (!window.confirm("Permanently delete this record?")) return;
    try {
      await api.delete(`/records/${id}`);
      window.location.reload(); 
    } catch (error) { alert(error.response?.data?.message || "Delete failed"); }
  };

  const filteredRecords = records.filter(record => {
    if (!searchTerm) return true; 
    const lowerSearch = searchTerm.toLowerCase();

    return entity.fields.some(field => {
      let displayString = "";
      if (field.type === 'relation' && record.data?.[field.name]) displayString = String(getDisplayValue(record.data[field.name], field.name));
      else if (field.type === 'formula' || field.type === 'conditional-formula') displayString = String(computeFormula(record.data, getActiveFormula(field, record.data)));
      else if (field.type === 'lookup') displayString = String(computeLookup(field, record.data));
      else if (field.type === 'rollup') displayString = String(computeRollup(field, record.data));
      else if (field.type === 'user') displayString = String(getUserDisplayName(record.data?.[field.name]));
      else displayString = String(record.data?.[field.name] || "");
      return displayString.toLowerCase().includes(lowerSearch);
    });
  });

  const getRecordsForMember = (userId) => {
    if (!userId) return [];
    return records.filter(rec => {
      if (String(rec.createdBy?._id || rec.createdBy) === String(userId)) return true;
      const userFields = entity.fields.filter(f => f.type === 'user');
      return userFields.some(f => String(rec.data?.[f.name]) === String(userId));
    });
  };
  
  return (
    <div className="flex flex-col gap-3 relative">
      <div className="flex justify-between items-center bg-white p-2.5 rounded-lg border border-zinc-200 shadow-sm">
        <div className="relative flex items-center w-full max-w-sm">
          <svg xmlns="http://www.w3.org/2000/svg" className="absolute left-2.5 h-4 w-4 text-zinc-400" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" /></svg>
          <input type="text" placeholder="Filter records..." value={searchTerm} onChange={(e) => setSearchTerm(e.target.value)} className="w-full pl-8 pr-3 py-1.5 text-sm border border-zinc-200 rounded-md outline-none focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500 transition-all bg-zinc-50 focus:bg-white" />
        </div>

        {/* --- DELEGATE TO DYNAMIC FORM --- */}
        <button 
          onClick={() => setEditingRecord({ _id: 'new', data: {} })} 
          className="flex items-center gap-1.5 bg-zinc-900 hover:bg-zinc-800 text-white px-4 py-2 rounded-lg text-sm font-semibold transition-all shadow-sm shrink-0"
        >
          <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" /></svg>
          New
        </button>
      </div>

      <div className="bg-white rounded-lg border border-zinc-200 overflow-hidden shadow-sm">
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="bg-zinc-50/80 border-b border-zinc-200">
                {entity.fields.map((field, index) => (
                  <th key={index} className="px-4 py-2 text-[11px] font-semibold text-zinc-500 uppercase tracking-wider whitespace-nowrap">
                    {field.name}
                    {(field.type === 'formula' || field.type === 'conditional-formula' || field.type === 'rollup') && <span className="ml-1.5 text-emerald-500 text-[9px]">ƒx</span>}
                    {field.type === 'lookup' && <span className="ml-1.5 text-indigo-500 text-[9px]">↓</span>}
                  </th>
                ))}
                <th className="px-4 py-2 text-[11px] font-semibold text-zinc-500 uppercase tracking-wider whitespace-nowrap">Creator</th>
                {entity.showCreatedAt && (
                  <th className="px-4 py-2 text-[11px] font-semibold text-zinc-500 uppercase tracking-wider whitespace-nowrap">Created On</th>
                )}
                <th className="px-4 py-2 text-[11px] font-semibold text-zinc-500 uppercase tracking-wider whitespace-nowrap text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-zinc-100">
              {filteredRecords.map((record) => {
                const myIdStr = String(localUser?.id || localUser?._id);
                const creatorIdStr = String(record.createdBy?._id || record.createdBy);
                const isMyRecord = myIdStr === creatorIdStr;
                
                const canEdit = localPerms ? (localPerms.editAllRecords || (localPerms.editOwnRecords && isMyRecord)) : true;
                const canDelete = localPerms ? (localPerms.deleteAllRecords || (localPerms.deleteOwnRecords && isMyRecord)) : true;

                return (
                  <tr key={record._id} className="hover:bg-zinc-50/50 transition-colors group">
                    {entity.fields.map((field, index) => (
                      <td key={index} className="px-4 py-2.5 text-sm text-zinc-700">
                        
                        {/* THE CLICKABLE MEMBER BADGE */}
                        {field.type === 'user' && record.data?.[field.name] && (
                          <button 
                            onClick={(e) => { e.stopPropagation(); setMemberActivityUserId(record.data[field.name]); }}
                            className="bg-amber-50 text-amber-700 border border-amber-200 hover:bg-amber-100 text-[10px] font-bold px-2 py-0.5 rounded-full whitespace-nowrap transition-colors cursor-pointer"
                          >
                            👤 {getUserDisplayName(record.data?.[field.name])}
                          </button>
                        )}
                        
                        {field.type === 'relation' && record.data?.[field.name] && (
                          <button onClick={(e) => { e.stopPropagation(); navigate(`/crm/${field.targetEntity}/record/${record.data[field.name]}`); }} className="inline-flex items-center gap-1 px-2 py-0.5 rounded border border-indigo-100 bg-indigo-50 text-indigo-700 hover:bg-indigo-100 transition-colors text-[11px] font-semibold whitespace-nowrap cursor-pointer">
                            <svg xmlns="http://www.w3.org/2000/svg" className="h-3 w-3" viewBox="0 0 20 20" fill="currentColor"><path fillRule="evenodd" d="M12.586 4.586a2 2 0 112.828 2.828l-3 3a2 2 0 01-2.828 0 1 1 0 00-1.414 1.414 4 4 0 005.656 0l3-3a4 4 0 00-5.656-5.656l-1.5 1.5a1 1 0 101.414 1.414l1.5-1.5zm-5 5a2 2 0 012.828 0 1 1 0 101.414-1.414 4 4 0 00-5.656 0l-3 3a4 4 0 105.656 5.656l1.5-1.5a1 1 0 10-1.414-1.414l-1.5 1.5a2 2 0 11-2.828-2.828l3-3z" clipRule="evenodd" /></svg>
                            {getDisplayValue(record.data[field.name], field.name)}
                          </button>
                        )}
                        {(field.type === 'formula' || field.type === 'conditional-formula') && <span className="font-mono font-medium text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded border border-emerald-100 whitespace-nowrap">{computeFormula(record.data, getActiveFormula(field, record.data))}</span>}
                        {field.type === 'lookup' && <span className="font-medium text-indigo-700 bg-indigo-50 px-2 py-0.5 rounded border border-indigo-100 whitespace-nowrap">{computeLookup(field, record.data)}</span>}
                        {field.type === 'rollup' && <span className="font-mono font-bold text-amber-700 bg-amber-50 px-2 py-0.5 rounded border border-amber-100 whitespace-nowrap">{computeRollup(field, record.data)}</span>}

                        {field.type === 'json' && <span className="font-mono text-[10px] bg-zinc-100 text-zinc-600 px-1.5 py-0.5 rounded truncate max-w-[150px] block border border-zinc-200">{record.data?.[field.name] ? JSON.stringify(record.data[field.name]).substring(0, 30) + '...' : '{}'}</span>}
                        {field.type === 'email' && record.data?.[field.name] && <a href={`mailto:${record.data[field.name]}`} onClick={(e) => e.stopPropagation()} className="text-indigo-600 hover:underline truncate max-w-xs block font-medium">{record.data[field.name]}</a>}
                        {field.type === 'phone' && record.data?.[field.name] && <a href={`tel:${record.data[field.name]}`} onClick={(e) => e.stopPropagation()} className="text-indigo-600 hover:underline truncate max-w-xs block font-medium">{record.data[field.name]}</a>}
                        {field.type === 'checkbox' && <span className={`px-2 py-0.5 text-[10px] font-bold rounded border ${record.data?.[field.name] ? 'bg-emerald-50 text-emerald-700 border-emerald-200' : 'bg-zinc-100 text-zinc-500 border-zinc-200'}`}>{record.data?.[field.name] ? 'TRUE' : 'FALSE'}</span>}
                        
                        {(field.type === 'text' || field.type === 'textarea' || field.type === 'dropdown' || field.type === 'number') && <span className="whitespace-pre-wrap truncate max-w-xs block">{record.data?.[field.name] || '-'}</span>}
                        {field.type === 'date' && <span className="text-zinc-500 whitespace-nowrap">{record.data?.[field.name] ? new Date(record.data[field.name]).toLocaleDateString() : '-'}</span>}
                        {field.type === 'datetime' && <span className="text-zinc-500 whitespace-nowrap">{record.data?.[field.name] ? new Date(record.data[field.name]).toLocaleString([], { dateStyle: 'medium', timeStyle: 'short' }) : '-'}</span>}
                        {field.type === 'media' && record.data?.[field.name] && <a href={record.data[field.name]} target="_blank" rel="noreferrer"><img src={record.data[field.name]} alt="file" className="h-8 w-8 object-cover rounded border border-zinc-200 opacity-90 hover:opacity-100" /></a>}
                        {field.type === 'media-multiple' && Array.isArray(record.data?.[field.name]) && <div className="flex gap-1 flex-wrap max-w-[120px]">{record.data[field.name].map((url, i) => <a key={i} href={url} target="_blank" rel="noreferrer"><img src={url} alt={`file-${i}`} className="h-6 w-6 object-cover rounded border border-zinc-200 opacity-80 hover:opacity-100" /></a>)}</div>}
                      </td>
                    ))}
                    <td className="px-4 py-2.5 text-xs text-zinc-400 whitespace-nowrap">{record.createdBy?.name || 'Unknown'}</td>
                    {entity.showCreatedAt && (
                      <td className="px-4 py-2.5 text-xs text-zinc-500 font-medium whitespace-nowrap">
                        {new Date(record.createdAt).toLocaleString([], { dateStyle: 'medium', timeStyle: 'short' })}
                      </td>
                    )}
                    <td className="px-4 py-2.5 text-right flex justify-end gap-2 opacity-100 sm:opacity-0 sm:group-hover:opacity-100 transition-opacity">
                      {canEdit && <button onClick={() => handleEditClick(record)} className="text-zinc-400 hover:text-indigo-600 p-1"><svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" /></svg></button>}
                      {canDelete && <button onClick={() => handleDelete(record._id)} className="text-zinc-400 hover:text-red-600 p-1"><svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" /></svg></button>}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>

      {/* --- THE FIX: DELEGATED RECORD MODAL TO STANDALONE COMPONENT --- */}
      {editingRecord && (
        <DynamicForm 
          entity={entity} 
          record={editingRecord} 
          onCancel={() => setEditingRecord(null)}
          onSuccess={() => {
            setEditingRecord(null);
            window.location.reload(); 
          }}
        />
      )}

      {/* --- THE MEMBER ACTIVITY SLIDE-OVER --- */}
      {memberActivityUserId && (
        <div className="fixed inset-y-0 right-0 w-full md:w-[400px] bg-white shadow-2xl border-l border-zinc-200 z-[70] flex flex-col transform transition-transform duration-300">
          <div className="px-5 py-4 border-b border-zinc-100 flex justify-between items-start bg-zinc-50">
            <div>
              <span className="text-[10px] font-bold text-amber-600 uppercase tracking-widest">Team Member</span>
              <h2 className="text-xl font-bold text-zinc-900 leading-tight mt-1 flex items-center gap-2">
                👤 {getUserDisplayName(memberActivityUserId)}
              </h2>
            </div>
            <button onClick={() => setMemberActivityUserId(null)} className="p-1.5 bg-zinc-200/50 hover:bg-zinc-200 text-zinc-500 rounded-md transition-colors">✕</button>
          </div>

          <div className="flex-1 overflow-y-auto p-5">
            <h3 className="text-xs font-bold text-zinc-400 uppercase tracking-wider mb-4">Assigned Records in {entity.name}</h3>
            
            {getRecordsForMember(memberActivityUserId).length === 0 ? (
              <div className="text-center py-10 border-2 border-dashed border-zinc-200 rounded-xl bg-zinc-50">
                <p className="text-sm font-medium text-zinc-500">No active records for this user.</p>
              </div>
            ) : (
              <div className="space-y-3">
                {getRecordsForMember(memberActivityUserId).map(rec => {
                  const titleF = entity.fields.find(f => f.type === 'text' || f.type === 'email') || entity.fields[0];
                  return (
                    <div key={rec._id} onClick={() => { setMemberActivityUserId(null); handleEditClick(rec); }} className="bg-white p-3.5 rounded-lg border border-zinc-200 shadow-sm cursor-pointer hover:border-indigo-400 transition-all group">
                      <div className="text-sm font-bold text-zinc-800 mb-2 truncate">
                        {rec.data?.[titleF?.name] || 'Unnamed Record'}
                      </div>
                      <div className="space-y-1">
                        {entity.fields.slice(1, 4).map(f => {
                          if (f.type === 'user' || !rec.data?.[f.name]) return null;
                          return (
                            <div key={f.name} className="flex justify-between items-baseline gap-2">
                              <span className="text-[10px] font-semibold text-zinc-400 uppercase">{f.name}</span>
                              <span className="text-xs text-zinc-600 truncate max-w-[150px]">{String(rec.data[f.name])}</span>
                            </div>
                          );
                        })}
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </div>
      )}

    </div>
  );
}