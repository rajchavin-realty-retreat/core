import { useState, useEffect } from 'react';
import api from '../api/axiosConfig';
import PhoneInput from 'react-phone-number-input';
import 'react-phone-number-input/style.css';

export default function DynamicForm({ entity, onSuccess, onCancel }) {
  const [formData, setFormData] = useState({});
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isUploadingFile, setIsUploadingFile] = useState(false);
  const [relationData, setRelationData] = useState({});
  
  // --- NEW: ROLE-BASED ASSIGNMENT STATE ---
  const [workspaceUsers, setWorkspaceUsers] = useState([]); // Used to translate IDs to Names
  const [assignableUsers, setAssignableUsers] = useState([]); // Used for the Dropdown options

  const [memberActivityUserId, setMemberActivityUserId] = useState(null);
  const [memberActivityRecords, setMemberActivityRecords] = useState([]);
  const [isLoadingActivity, setIsLoadingActivity] = useState(false);

  useEffect(() => {
    const fetchUsersAndRelations = async () => {
      try {
        const currentUser = JSON.parse(localStorage.getItem('userInfo'));
        const userIdStr = String(currentUser?.id || currentUser?._id);

        const res = await api.get('/workspaces');
        const wsId = entity.workspace || entity.workspaceId;
        const currentWs = res.data.find(w => w._id === wsId);
        
        if (currentWs) {
          // 1. Build the full list of users for display purposes
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

          // 2. Check if the current user is an Admin
          const isOwner = String(currentWs.owner?._id || currentWs.owner) === userIdStr;
          let isAdmin = isOwner;
          
          if (!isAdmin) {
            const myMember = currentWs.members.find(m => String(m.user?._id || m.user) === userIdStr);
            if (myMember && currentWs.customRoles) {
              const role = currentWs.customRoles.find(r => String(r._id) === String(myMember.roleId));
              if (role && (role.permissions?.manageTeam || role.permissions?.editAllRecords)) {
                isAdmin = true;
              }
            }
          }

          // 3. Filter the dropdown options based on role
          if (!isAdmin) {
            setAssignableUsers(usersList.filter(u => String(u._id) === userIdStr));
          } else {
            setAssignableUsers(usersList);
          }
        }
      } catch (error) { 
        console.error("Failed to load workspace users"); 
      }

      if (!entity || !entity.fields) return;
      const relationFields = entity.fields.filter(f => f.type === 'relation' && f.targetEntity);
      
      const newRelationData = {};
      for (let field of relationFields) {
        try {
          const res = await api.get(`/records/entity/${field.targetEntity}`);
          newRelationData[field.name] = res.data;
        } catch (error) { 
          newRelationData[field.name] = []; 
        }
      }
      setRelationData(newRelationData);
    };

    fetchUsersAndRelations();
  }, [entity]);

  const fetchMemberActivity = async (userId) => {
    setMemberActivityUserId(userId);
    setIsLoadingActivity(true);
    try {
      const res = await api.get(`/records/entity/${entity._id}`);
      const myRecords = res.data.filter(rec => {
        if (String(rec.createdBy?._id || rec.createdBy) === String(userId)) return true;
        const userFields = entity.fields.filter(f => f.type === 'user');
        return userFields.some(f => String(rec.data?.[f.name]) === String(userId));
      });
      setMemberActivityRecords(myRecords);
    } catch (error) {
      console.error("Failed to load user activity");
    } finally {
      setIsLoadingActivity(false);
    }
  };

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
        if (val === undefined || val === null || val === '') val = 0;
        else if (typeof val === 'string') {
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
    if (match && match.data) {
      return match.data[field.targetLookupField] || '';
    }
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
        } else {
           val = Number(val) || 0;
        }
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

  const getDisplayValue = (recordId, field) => {
    if (!recordId) return '-';
    const fieldName = typeof field === 'string' ? field : field.name; 
    const targetRecords = relationData[fieldName] || [];
    const match = targetRecords.find(r => r._id === recordId);
    if (!match || !match.data) return `ID: ${String(recordId).slice(-4)}`;
    
    const fieldObj = typeof field === 'object' ? field : entity.fields.find(f => f.name === fieldName);

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

  const getFilteredRelations = (field) => {
    let allOptions = relationData[field.name] || [];
    if (field.cascadingParentField && field.cascadingTargetField) {
      const selectedParentId = formData[field.cascadingParentField];
      if (!selectedParentId) return [];
      allOptions = allOptions.filter(record => record.data && record.data[field.cascadingTargetField] === selectedParentId);
    }
    return allOptions;
  };

  const handleChange = (fieldName, value) => {
    setFormData(prev => {
      const newData = { ...prev, [fieldName]: value };
      entity.fields.forEach(f => {
        if (f.cascadingParentField === fieldName) {
          newData[f.name] = ''; 
        }
      });
      return newData;
    });
  };

  const handleFileUpload = async (e, fieldName) => {
    const file = e.target.files[0];
    if (!file) return;
    setIsUploadingFile(true);
    const uploadData = new FormData();
    uploadData.append('file', file);
    uploadData.append('workspaceId', entity.workspace || entity.workspaceId);
    try {
      const res = await api.post('/upload', uploadData, { headers: { 'Content-Type': 'multipart/form-data' }});
      handleChange(fieldName, res.data.url || res.data.secure_url || res.data);
    } catch (error) { alert("Upload failed"); } 
    finally { setIsUploadingFile(false); }
  };

  const handleMultiUpload = async (e, fieldName) => {
    const files = Array.from(e.target.files);
    if (!files.length) return;
    setIsUploadingFile(true);
    try {
      const uploadPromises = files.map(file => {
        const uploadData = new FormData();
        uploadData.append('file', file);
        uploadData.append('workspaceId', entity.workspace || entity.workspaceId);
        return api.post('/upload', uploadData, { headers: { 'Content-Type': 'multipart/form-data' } });
      });
      const responses = await Promise.all(uploadPromises);
      const newUrls = responses.map(res => res.data.url || res.data.secure_url || res.data);
      setFormData(prev => ({ ...prev, [fieldName]: [...(prev[fieldName] || []), ...newUrls] }));
    } catch (error) { alert("Upload failed"); } 
    finally { setIsUploadingFile(false); }
  };

  const removeFileFromArray = (fieldName, indexToRemove) => {
    setFormData(prev => ({ ...prev, [fieldName]: (prev[fieldName] || []).filter((_, idx) => idx !== indexToRemove) }));
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setIsSubmitting(true);
    try {
      const payloadData = { ...formData };
      
      for (let field of entity.fields) {
        if (field.type === 'formula' || field.type === 'conditional-formula') {
          payloadData[field.name] = computeFormula(payloadData, getActiveFormula(field, payloadData));
        }
        if (field.type === 'lookup') payloadData[field.name] = computeLookup(field, payloadData);
        if (field.type === 'rollup') payloadData[field.name] = computeRollup(field, payloadData);
        
        if (field.type === 'json' && payloadData[field.name]) {
          try {
            payloadData[field.name] = JSON.parse(payloadData[field.name]);
          } catch (err) {
            throw new Error(`Syntax Error in "${field.name}": Invalid JSON format. Please check your brackets and commas.`);
          }
        }
      }

      await api.post('/records', { entityId: entity._id, dynamicData: payloadData });
      if (onSuccess) onSuccess();
    } catch (error) { 
      alert(error.message || error.response?.data?.message || "Failed to create record"); 
    } finally { setIsSubmitting(false); }
  };

  if (!entity) return null;

  return (
    <div onClick={onCancel} className="fixed inset-0 bg-zinc-900/40 backdrop-blur-sm flex items-center justify-center z-[60] p-4 cursor-pointer">
      <div onClick={(e) => e.stopPropagation()} className="bg-white cursor-default rounded-xl shadow-xl w-full max-w-2xl max-h-[90vh] overflow-hidden flex flex-col border border-zinc-200">
        
        <div className="flex justify-between items-center px-6 py-4 border-b border-zinc-100 bg-zinc-50/50">
          <h3 className="text-sm font-semibold text-zinc-900">New {entity.name} Record</h3>
          <button onClick={onCancel} className="text-zinc-400 hover:text-zinc-600 transition-colors">✕</button>
        </div>

        <form onSubmit={handleSubmit} className="flex-1 overflow-y-auto p-6 flex flex-col gap-5">
          {entity.fields.map((field, idx) => (
            <div key={idx} className="flex flex-col gap-1.5">
              
              <label className="flex items-center text-xs font-semibold text-zinc-500 uppercase tracking-wider">
                {field.name}
              </label>
              
              {/* --- ROLE-AWARE TEAM MEMBER DROPDOWN WITH QUICK VIEW --- */}
              {field.type === 'user' && (
                <div className="flex gap-2 items-center">
                  <select value={formData[field.name] || ''} onChange={(e) => handleChange(field.name, e.target.value)} required={field.isRequired} className="flex-1 px-3 py-2 text-sm border border-zinc-200 rounded-md bg-white outline-none focus:ring-1 focus:ring-indigo-500">
                    <option value="">Select Team Member...</option>
                    {/* Maps over the restricted assignableUsers array */}
                    {assignableUsers.map(user => (
                      <option key={user._id} value={user._id}>{user.name || user.email}</option>
                    ))}
                  </select>
                  {formData[field.name] && (
                    <button 
                      type="button" 
                      onClick={() => fetchMemberActivity(formData[field.name])}
                      className="bg-amber-50 text-amber-700 border border-amber-200 hover:bg-amber-100 text-xs font-bold px-3 py-2 rounded-md transition-colors"
                    >
                      👤 View Activity
                    </button>
                  )}
                </div>
              )}

              {(field.type === 'lookup' || field.type === 'rollup') && (
                <input type="text" disabled value={field.type === 'lookup' ? computeLookup(field, formData) : computeRollup(field, formData)} className="px-3 py-2 text-sm border border-indigo-200 rounded-md bg-indigo-50/40 text-indigo-800 font-medium outline-none cursor-not-allowed transition-all" />
              )}
              {(field.type === 'formula' || field.type === 'conditional-formula') && (
                <input type="text" disabled value={computeFormula(formData, getActiveFormula(field, formData))} className="px-3 py-2 text-sm border border-emerald-200 rounded-md bg-emerald-50/50 text-emerald-700 font-mono outline-none cursor-not-allowed" />
              )}

              {field.type === 'json' && (
                <textarea value={formData[field.name] || ''} onChange={(e) => handleChange(field.name, e.target.value)} placeholder="{\n  &quot;key&quot;: &quot;value&quot;\n}" className="px-3 py-3 text-xs font-mono border border-zinc-200 rounded-md focus:ring-1 focus:ring-indigo-500 outline-none bg-zinc-900 text-emerald-400 min-h-[150px] shadow-inner leading-relaxed" required={field.isRequired} />
              )}

              {field.type === 'email' && <input type="email" placeholder="name@company.com" value={formData[field.name] || ''} onChange={(e) => handleChange(field.name, e.target.value)} required={field.isRequired} className="px-3 py-2 text-sm border border-zinc-200 rounded-md focus:ring-1 focus:ring-indigo-500 outline-none" />}
              
              {field.type === 'phone' && (
                <div className="border border-zinc-200 rounded-md focus-within:ring-1 focus-within:ring-indigo-500 focus-within:border-indigo-500 bg-white px-3 py-1.5">
                  <PhoneInput international defaultCountry="IN" value={formData[field.name] || ''} onChange={(val) => handleChange(field.name, val)} required={field.isRequired} className="text-sm outline-none w-full" />
                </div>
              )}

              {field.type === 'text' && <input type="text" value={formData[field.name] || ''} onChange={(e) => handleChange(field.name, e.target.value)} required={field.isRequired} className="px-3 py-2 text-sm border border-zinc-200 rounded-md focus:ring-1 focus:ring-indigo-500 outline-none" />}
              {field.type === 'number' && <input type="number" value={formData[field.name] || ''} onChange={(e) => handleChange(field.name, e.target.value)} required={field.isRequired} className="px-3 py-2 text-sm border border-zinc-200 rounded-md focus:ring-1 focus:ring-indigo-500 outline-none" />}
              {field.type === 'textarea' && <textarea value={formData[field.name] || ''} onChange={(e) => handleChange(field.name, e.target.value)} required={field.isRequired} className="px-3 py-2 text-sm border border-zinc-200 rounded-md focus:ring-1 focus:ring-indigo-500 outline-none min-h-[80px]" />}
              {field.type === 'date' && <input type="date" value={formData[field.name] || ''} onChange={(e) => handleChange(field.name, e.target.value)} required={field.isRequired} className="px-3 py-2 text-sm border border-zinc-200 rounded-md outline-none focus:ring-1 focus:ring-indigo-500" />}
              {field.type === 'datetime' && <input type="datetime-local" value={formData[field.name] || ''} onChange={(e) => handleChange(field.name, e.target.value)} required={field.isRequired} className="px-3 py-2 text-sm border border-zinc-200 rounded-md outline-none focus:ring-1 focus:ring-indigo-500" />}
              
              {field.type === 'dropdown' && (
                <select value={formData[field.name] || ''} onChange={(e) => handleChange(field.name, e.target.value)} required={field.isRequired} className="px-3 py-2 text-sm border border-zinc-200 rounded-md bg-white outline-none focus:ring-1 focus:ring-indigo-500">
                  <option value="">Select option...</option>
                  {(field.options || []).map((opt, i) => <option key={i} value={opt}>{opt}</option>)}
                </select>
              )}

              {field.type === 'relation' && (
                <select 
                  value={formData[field.name] || ''} 
                  onChange={(e) => handleChange(field.name, e.target.value)} 
                  required={field.isRequired} 
                  className={`px-3 py-2 text-sm border border-zinc-200 rounded-md bg-white outline-none focus:ring-1 focus:ring-indigo-500 ${field.cascadingParentField && !formData[field.cascadingParentField] ? 'bg-zinc-100 cursor-not-allowed opacity-70' : ''}`}
                  disabled={field.cascadingParentField && !formData[field.cascadingParentField]}
                >
                  <option value="">
                    {field.cascadingParentField && !formData[field.cascadingParentField] 
                      ? `Select ${field.cascadingParentField} first...` 
                      : 'Select record...'}
                  </option>
                  {getFilteredRelations(field).map(r => (
                    <option key={r._id} value={r._id}>
                      {getDisplayValue(r._id, field)}
                    </option>
                  ))}
                </select>
              )}

              {field.type === 'checkbox' && (
                <label className="flex items-center gap-2 mt-1 w-fit cursor-pointer">
                  <input type="checkbox" checked={formData[field.name] || false} onChange={(e) => handleChange(field.name, e.target.checked)} className="w-4 h-4 text-indigo-600 rounded border-zinc-300" />
                  <span className="text-sm text-zinc-600">Enabled</span>
                </label>
              )}
              
              {field.type === 'media' && (
                <div className="flex flex-col gap-2">
                  {formData[field.name] ? (
                    <div className="relative w-20 h-20 border rounded-md overflow-hidden group"><img src={formData[field.name]} alt="preview" className="w-full h-full object-cover" /><button type="button" onClick={() => handleChange(field.name, '')} className="absolute inset-0 bg-black/60 text-white opacity-0 group-hover:opacity-100 flex items-center justify-center text-xs">Clear</button></div>
                  ) : (<input type="file" onChange={(e) => handleFileUpload(e, field.name)} required={field.isRequired} className="text-xs" />)}
                </div>
              )}
              
              {field.type === 'media-multiple' && (
                <div className="flex flex-col gap-3 p-3 border rounded-md">
                   <div className="flex flex-wrap gap-2">{formData[field.name]?.map((url, i) => <div key={i} className="relative w-16 h-16 border rounded overflow-hidden group"><img src={url} alt="file" className="w-full h-full object-cover" /><button type="button" onClick={() => removeFileFromArray(field.name, i)} className="absolute top-0 right-0 bg-red-500 text-white w-5 h-5 flex items-center justify-center text-xs opacity-0 group-hover:opacity-100">×</button></div>)}</div>
                   <input type="file" multiple onChange={(e) => handleMultiUpload(e, field.name)} required={field.isRequired && (!formData[field.name] || formData[field.name].length === 0)} className="text-xs" />
                </div>
              )}
            </div>
          ))}

          <div className="flex gap-2 mt-4 pt-5 border-t border-zinc-100 pb-2">
            <button type="button" onClick={onCancel} className="flex-1 bg-white border border-zinc-200 text-zinc-700 py-2.5 rounded-md font-bold text-sm hover:bg-zinc-50 transition-colors">Cancel</button>
            <button type="submit" disabled={isSubmitting || isUploadingFile} className="flex-1 bg-indigo-600 text-white py-2.5 rounded-md font-bold text-sm hover:bg-indigo-700 disabled:opacity-50 transition-all shadow-sm">{isUploadingFile ? 'Uploading Files...' : isSubmitting ? 'Creating Record...' : 'Create Record'}</button>
          </div>
        </form>
      </div>

      {/* --- THE MEMBER ACTIVITY SLIDE-OVER --- */}
      {memberActivityUserId && (
        <div className="absolute inset-y-0 right-0 w-full md:w-[350px] bg-white shadow-2xl border-l border-zinc-200 z-[80] flex flex-col">
          <div className="px-4 py-3 border-b border-zinc-100 flex justify-between items-center bg-zinc-50">
            <h3 className="font-bold text-zinc-900 text-sm">👤 {getUserDisplayName(memberActivityUserId)}'s Workload</h3>
            <button onClick={() => setMemberActivityUserId(null)} className="text-zinc-400 hover:text-zinc-600">✕</button>
          </div>

          <div className="flex-1 overflow-y-auto p-4">
            {isLoadingActivity ? (
              <p className="text-xs text-zinc-400 text-center py-5">Loading activity...</p>
            ) : memberActivityRecords.length === 0 ? (
              <div className="text-center py-8 border-2 border-dashed border-zinc-200 rounded-lg bg-zinc-50">
                <p className="text-xs font-medium text-zinc-500">This user is completely free!</p>
              </div>
            ) : (
              <div className="space-y-3">
                {memberActivityRecords.map(rec => {
                  const titleF = entity.fields.find(f => f.type === 'text') || entity.fields[0];
                  return (
                    <div key={rec._id} className="bg-white p-3 rounded-md border border-zinc-200 shadow-sm">
                      <div className="text-sm font-bold text-zinc-800 truncate mb-1">{rec.data?.[titleF?.name] || 'Unnamed'}</div>
                      {entity.fields.find(f => f.type === 'dropdown') && (
                         <span className="text-[10px] font-bold bg-indigo-50 text-indigo-700 px-1.5 py-0.5 rounded border border-indigo-100">
                           {rec.data[entity.fields.find(f => f.type === 'dropdown').name] || 'No Status'}
                         </span>
                      )}
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