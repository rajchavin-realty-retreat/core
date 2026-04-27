import { useState, useEffect } from 'react';
import api from '../api/axiosConfig';
import PhoneInput from 'react-phone-number-input';
import 'react-phone-number-input/style.css';

export default function DynamicForm({ entity, record, onSuccess, onCancel }) {
  const [formData, setFormData] = useState({});
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isUploadingFile, setIsUploadingFile] = useState(false);
  const [error, setError] = useState('');
  const [activeTab, setActiveTab] = useState('details');

  // Relational & Role States
  const [relationData, setRelationData] = useState({});
  const [subRecords, setSubRecords] = useState([]);
  const [isLoadingRelations, setIsLoadingRelations] = useState(false);
  
  // Team Member Assignment States
  const [workspaceUsers, setWorkspaceUsers] = useState([]); 
  const [assignableUsers, setAssignableUsers] = useState([]); 
  const [memberActivityUserId, setMemberActivityUserId] = useState(null);
  const [memberActivityRecords, setMemberActivityRecords] = useState([]);
  const [isLoadingActivity, setIsLoadingActivity] = useState(false);

  // --- INITIALIZATION ---
  useEffect(() => {
    // 1. Safe Form Initialization
    if (record && record._id !== 'new') {
      const formattedData = { ...record.data };
      entity.fields.forEach(f => {
        if (f.type === 'json' && formattedData[f.name]) {
          formattedData[f.name] = JSON.stringify(formattedData[f.name], null, 2);
        }
        // FIX: Ensure existing media-multiple fields are treated as arrays
        if (f.type === 'media-multiple' && !Array.isArray(formattedData[f.name])) {
          formattedData[f.name] = formattedData[f.name] ? [formattedData[f.name]] : [];
        }
      });
      setFormData(formattedData);
    } else {
      const initialData = {};
      entity.fields.forEach(f => { 
        // FIX: Initialize media-multiple as an array, everything else as empty string
        if (f.type === 'media-multiple') {
          initialData[f.name] = [];
        } else {
          initialData[f.name] = ''; 
        }
      });
      setFormData(initialData);
    }

    // 2. Fetch Users, Permissions, and Relations
    const fetchContext = async () => {
      try {
        const currentUser = JSON.parse(localStorage.getItem('userInfo'));
        const userIdStr = String(currentUser?.id || currentUser?._id);
        const wsId = entity.workspace || entity.workspaceId;
        const res = await api.get('/workspaces');
        const currentWs = res.data.find(w => w._id === wsId);
        
        if (currentWs) {
          let usersList = [];
          if (currentWs.owner) usersList.push(currentWs.owner);
          currentWs.members.forEach(m => {
            if (m.status === 'accepted' && m.user && !usersList.find(u => String(u._id) === String(m.user._id))) {
              usersList.push(m.user);
            }
          });
          setWorkspaceUsers(usersList);

          const isOwner = String(currentWs.owner?._id || currentWs.owner) === userIdStr;
          let isAdmin = isOwner;
          if (!isAdmin) {
            const myMember = currentWs.members.find(m => String(m.user?._id || m.user) === userIdStr);
            if (myMember && currentWs.customRoles) {
              const role = currentWs.customRoles.find(r => String(r._id) === String(myMember.roleId));
              if (role && (role.permissions?.manageTeam || role.permissions?.editAllRecords)) isAdmin = true;
            }
          }
          setAssignableUsers(isAdmin ? usersList : usersList.filter(u => String(u._id) === userIdStr));
        }

        // Fetch Dropdown Relations
        const relationFields = entity.fields.filter(f => f.type === 'relation' && f.targetEntity);
        const newRelationData = {};
        for (let field of relationFields) {
          try {
            const relRes = await api.get(`/records/entity/${field.targetEntity}`);
            newRelationData[field.name] = relRes.data;
          } catch (e) { newRelationData[field.name] = []; }
        }
        setRelationData(newRelationData);

        // Fetch Related Activity (Back-links) if Editing
        if (record && record._id !== 'new') {
          setIsLoadingRelations(true);
          const resEntities = await api.get(`/entities/workspace/${wsId}`);
          const linkedEntities = resEntities.data.filter(e => e.fields.some(f => f.type === 'relation' && f.targetEntity === entity._id));

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
                } catch (e) { }
              }
              const resolvedMatches = matches.map(m => {
                const resolvedData = { ...m.data };
                for (let orf of otherRelationFields) {
                  const rawId = resolvedData[orf.name];
                  if (rawId && lookupDict[orf.name]) {
                    const targetRec = lookupDict[orf.name].find(tr => tr._id === rawId);
                    if (targetRec && targetRec.data) {
                      const keys = Object.keys(targetRec.data);
                      if (keys.length > 0) resolvedData[orf.name] = targetRec.data[keys[0]]; 
                    }
                  }
                }
                return { ...m, data: resolvedData };
              });
              relatedData.push({ entityName: linkedEnt.name, records: resolvedMatches });
            }
          }
          setSubRecords(relatedData);
          setIsLoadingRelations(false);
        }

      } catch (error) { console.error("Failed to load form context", error); }
    };

    fetchContext();
  }, [record, entity]);

  // --- HELPERS ---
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
        if (!val) val = 0;
        else if (typeof val === 'string') val = Number(val.replace(/[^0-9.-]+/g, "")) || 0;
        else val = Number(val) || 0;
        equation = equation.split(variable).join(val);
      });
    }
    try {
      const sanitized = equation.replace(/[^-()\d/*+.]/g, '');
      if (!sanitized) return '';
      const result = new Function(`'use strict'; return (${sanitized})`)();
      return (!Number.isFinite(result) || Number.isNaN(result)) ? '' : Number(result.toFixed(2));
    } catch (e) { return '#ERROR'; }
  };

  const getActiveFormula = (field, currentData) => {
    if (field.type === 'formula') return field.formula || '';
    if (field.type === 'conditional-formula') {
      const match = field.conditions?.find(c => String(c.value).trim() === String(currentData[field.dependentField] || '').trim());
      return match ? (match.formula || '') : '';
    }
    return '';
  };

  const computeLookup = (field, currentData) => {
    if (!field.sourceRelationField || !field.targetLookupField) return '';
    const match = (relationData[field.sourceRelationField] || []).find(r => r._id === currentData[field.sourceRelationField]);
    return match?.data?.[field.targetLookupField] || '';
  };

  const computeRollup = (field, currentData) => {
    if (!field.sourceRelationField || !field.targetLookupField) return '';
    const sourceValues = currentData[field.sourceRelationField];
    if (!sourceValues) return '';
    const ids = Array.isArray(sourceValues) ? sourceValues : [sourceValues];
    let values = [];
    ids.forEach(id => {
      const match = (relationData[field.sourceRelationField] || []).find(r => r._id === id);
      if (match?.data?.[field.targetLookupField] !== undefined && match.data[field.targetLookupField] !== '') {
        let val = match.data[field.targetLookupField];
        values.push(typeof val === 'string' ? Number(val.replace(/[^0-9.-]+/g, "")) || 0 : Number(val) || 0);
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

  const getFilteredRelations = (field) => {
    let allOptions = relationData[field.name] || [];
    if (field.cascadingParentField && field.cascadingTargetField) {
      const parentId = formData[field.cascadingParentField];
      if (!parentId) return [];
      allOptions = allOptions.filter(r => r.data && r.data[field.cascadingTargetField] === parentId);
    }
    return allOptions;
  };

  const getDisplayValue = (rId, field) => {
    if (!rId) return '-';
    const fieldName = typeof field === 'string' ? field : field.name;
    const match = (relationData[fieldName] || []).find(r => r._id === rId);
    if (!match?.data) return `ID: ${String(rId).slice(-4)}`;
    
    const fObj = typeof field === 'object' ? field : entity.fields.find(f => f.name === fieldName);
    if (fObj?.displayFields?.length > 0) {
      return fObj.displayFields.map(fn => {
        if (match.data[fn] !== undefined) return match.data[fn];
        const flexKey = Object.keys(match.data).find(k => k.toLowerCase().trim() === fn.toLowerCase().trim());
        return flexKey ? match.data[flexKey] : null;
      }).filter(Boolean).join(' - '); 
    }
    const keys = Object.keys(match.data);
    return keys.length > 0 ? match.data[keys[0]] : 'Unnamed';
  };

  // --- HANDLERS ---
  const handleChange = (fieldName, value) => {
    setFormData(prev => {
      const newData = { ...prev, [fieldName]: value };
      entity.fields.forEach(f => { if (f.cascadingParentField === fieldName) newData[f.name] = ''; });
      return newData;
    });
  };

  const handleFileUpload = async (e, fieldName) => {
    const file = e.target.files[0];
    if (!file) return;
    setIsUploadingFile(true);
    const fd = new FormData();
    fd.append('file', file);
    fd.append('workspaceId', entity.workspace || entity.workspaceId);
    try {
      const res = await api.post('/upload', fd, { headers: { 'Content-Type': 'multipart/form-data' }});
      handleChange(fieldName, res.data.url || res.data.secure_url || res.data);
    } catch (err) { alert("Upload failed"); } 
    finally { setIsUploadingFile(false); }
  };

  const handleMultiUpload = async (e, fieldName) => {
    const files = Array.from(e.target.files);
    if (!files.length) return;
    setIsUploadingFile(true);
    try {
      const promises = files.map(file => {
        const fd = new FormData();
        fd.append('file', file);
        fd.append('workspaceId', entity.workspace || entity.workspaceId);
        return api.post('/upload', fd, { headers: { 'Content-Type': 'multipart/form-data' } });
      });
      const responses = await Promise.all(promises);
      const newUrls = responses.map(r => r.data.url || r.data.secure_url || r.data);
      // Ensure we treat the previous state as an array safely
      setFormData(prev => ({ 
        ...prev, 
        [fieldName]: [...(Array.isArray(prev[fieldName]) ? prev[fieldName] : []), ...newUrls] 
      }));
    } catch (err) { alert("Upload failed"); } 
    finally { setIsUploadingFile(false); }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    
    if (isUploadingFile) {
      setError("Please wait for files to finish uploading before saving.");
      return;
    }

    setIsSubmitting(true);
    setError('');

    try {
      const payload = { ...formData };
      
      for (let field of entity.fields) {
        if (field.type === 'formula' || field.type === 'conditional-formula') {
          payload[field.name] = computeFormula(payload, getActiveFormula(field, payload));
        }
        if (field.type === 'lookup') payload[field.name] = computeLookup(field, payload);
        if (field.type === 'rollup') payload[field.name] = computeRollup(field, payload);
        
        if (field.type === 'json' && payload[field.name]) {
          try {
            payload[field.name] = JSON.parse(payload[field.name]);
          } catch (err) {
            throw new Error(`Invalid JSON format in "${field.name}".`);
          }
        }
      }

      const finalPayload = {
        entityId: entity._id, 
        workspaceId: entity.workspace || entity.workspaceId,
        data: payload,
        dynamicData: payload 
      };

      if (record._id === 'new') {
        await api.post('/records', finalPayload);
      } else {
        await api.put(`/records/${record._id}`, finalPayload);
      }
      
      onSuccess();
    } catch (err) {
      setError(err.response?.data?.message || err.response?.data?.error || "Failed to save record");
    } finally {
      setIsSubmitting(false);
    }
  };

  if (!entity) return null;

  return (
    <div onClick={onCancel} className="fixed inset-0 bg-zinc-900/40 backdrop-blur-sm flex items-center justify-center z-[70] p-4 cursor-pointer">
      <div onClick={(e) => e.stopPropagation()} className="bg-white cursor-default rounded-2xl shadow-xl w-full max-w-2xl max-h-[90vh] overflow-hidden flex flex-col border border-zinc-200">
        
        {/* Header */}
        <div className="flex justify-between items-center px-6 py-5 border-b border-zinc-100 bg-zinc-50 shrink-0">
          <div>
            <h3 className="font-bold tracking-tight text-zinc-900 text-lg">
              {record._id === 'new' ? `Create ${entity.name}` : `Edit ${entity.name}`}
            </h3>
            <p className="text-[11px] text-zinc-500 uppercase tracking-widest font-bold mt-1">
              {entity.fields.length} Attributes
            </p>
          </div>
          <button onClick={onCancel} className="text-zinc-400 hover:text-zinc-700 bg-white p-1.5 rounded-lg border border-zinc-200 shadow-sm transition-colors">
            <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" /></svg>
          </button>
        </div>

        {/* Tabs */}
        {record._id !== 'new' && (
          <div className="flex border-b border-zinc-200 px-6 pt-2 bg-zinc-50/50 shrink-0">
            <button onClick={() => setActiveTab('details')} className={`pb-3 text-sm font-semibold transition-colors border-b-2 ${activeTab === 'details' ? 'border-zinc-900 text-zinc-900' : 'border-transparent text-zinc-500 hover:text-zinc-800'}`}>Record Details</button>
            <button onClick={() => setActiveTab('related')} className={`pb-3 ml-6 text-sm font-semibold transition-colors border-b-2 flex items-center gap-1.5 ${activeTab === 'related' ? 'border-zinc-900 text-zinc-900' : 'border-transparent text-zinc-500 hover:text-zinc-800'}`}>
              Related Activity {subRecords.length > 0 && <span className="bg-zinc-200 text-zinc-700 py-0.5 px-2 rounded-full text-[10px]">{subRecords.reduce((acc, sr) => acc + sr.records.length, 0)}</span>}
            </button>
          </div>
        )}

        {/* Form Body */}
        {activeTab === 'details' && (
          <form onSubmit={handleSubmit} className="flex-1 overflow-y-auto p-6 sm:p-8 flex flex-col gap-6">
            
            {error && (
              <div className="bg-red-50 border border-red-100 text-red-600 px-4 py-3 rounded-xl text-sm font-medium flex items-start gap-2">
                <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5 shrink-0 mt-0.5" viewBox="0 0 20 20" fill="currentColor"><path fillRule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7 4a1 1 0 11-2 0 1 1 0 012 0zm-1-9a1 1 0 00-1 1v4a1 1 0 102 0V6a1 1 0 00-1-1z" clipRule="evenodd" /></svg>
                <span><strong className="block">{error}</strong></span>
              </div>
            )}

            <div className="space-y-5">
              {entity.fields.map((field, idx) => (
                <div key={idx} className="flex flex-col gap-1.5">
                  <label className="text-[11px] font-bold text-zinc-500 uppercase tracking-widest flex items-center gap-1.5">
                    {field.name}
                    {field.isRequired && <span className="text-red-400">*</span>}
                    {(field.type === 'formula' || field.type === 'conditional-formula') && <span className="text-emerald-500 text-[9px]">(Auto-Calc)</span>}
                  </label>

                  {/* Role-Aware Team Member Dropdown */}
                  {field.type === 'user' && (
                    <div className="flex gap-2 items-center">
                      <select value={formData[field.name] || ''} onChange={(e) => handleChange(field.name, e.target.value)} required={field.isRequired} className="flex-1 px-4 py-3 text-sm border border-zinc-200 rounded-xl outline-none focus:border-zinc-400 focus:ring-4 focus:ring-zinc-500/10 bg-zinc-50 hover:bg-zinc-100 focus:bg-white text-zinc-900 font-medium appearance-none">
                        <option value="">Select Team Member...</option>
                        {assignableUsers.map(user => <option key={user._id} value={user._id}>{user.name || user.email}</option>)}
                      </select>
                      {formData[field.name] && (
                        <button type="button" onClick={() => fetchMemberActivity(formData[field.name])} className="bg-zinc-100 text-zinc-700 border border-zinc-200 hover:bg-zinc-200 text-xs font-bold px-4 py-3 rounded-xl transition-colors shrink-0">
                          👤 View Workload
                        </button>
                      )}
                    </div>
                  )}

                  {/* Computed */}
                  {(field.type === 'lookup' || field.type === 'rollup') && <input type="text" disabled value={field.type === 'lookup' ? computeLookup(field, formData) : computeRollup(field, formData)} className="px-4 py-3 text-sm border border-indigo-100 rounded-xl bg-indigo-50/50 text-indigo-800 font-medium outline-none cursor-not-allowed" />}
                  {(field.type === 'formula' || field.type === 'conditional-formula') && <input type="text" disabled value={computeFormula(formData, getActiveFormula(field, formData))} className="px-4 py-3 text-sm border border-emerald-100 rounded-xl bg-emerald-50/50 text-emerald-800 font-mono outline-none cursor-not-allowed" />}

                  {/* Standard Text/Number/Email */}
                  {(field.type === 'text' || field.type === 'email' || field.type === 'number') && (
                    <input type={field.type} required={field.isRequired} value={formData[field.name] || ''} onChange={(e) => handleChange(field.name, e.target.value)} className="w-full px-4 py-3 text-sm border border-zinc-200 rounded-xl outline-none focus:border-zinc-400 focus:ring-4 focus:ring-zinc-500/10 transition-all bg-zinc-50 hover:bg-zinc-100 focus:bg-white text-zinc-900 font-medium" />
                  )}
                  
                  {/* Textarea & JSON */}
                  {field.type === 'textarea' && <textarea required={field.isRequired} value={formData[field.name] || ''} onChange={(e) => handleChange(field.name, e.target.value)} className="w-full px-4 py-3 text-sm border border-zinc-200 rounded-xl outline-none focus:border-zinc-400 focus:ring-4 focus:ring-zinc-500/10 transition-all bg-zinc-50 hover:bg-zinc-100 focus:bg-white text-zinc-900 font-medium min-h-[100px]" />}
                  {field.type === 'json' && <textarea required={field.isRequired} value={formData[field.name] || ''} onChange={(e) => handleChange(field.name, e.target.value)} placeholder="{\n  &quot;key&quot;: &quot;value&quot;\n}" className="w-full px-4 py-3 text-xs font-mono border border-zinc-200 rounded-xl outline-none focus:border-zinc-400 bg-zinc-900 text-emerald-400 min-h-[150px] shadow-inner" />}

                  {/* Dates */}
                  {field.type === 'date' && <input type="date" required={field.isRequired} value={formData[field.name] ? formData[field.name].split('T')[0] : ''} onChange={(e) => handleChange(field.name, e.target.value)} className="w-full px-4 py-3 text-sm border border-zinc-200 rounded-xl outline-none focus:border-zinc-400 focus:ring-4 focus:ring-zinc-500/10 bg-zinc-50 hover:bg-zinc-100 focus:bg-white text-zinc-900 font-medium" />}
                  {field.type === 'datetime' && <input type="datetime-local" required={field.isRequired} value={formData[field.name] ? new Date(formData[field.name]).toISOString().slice(0, 16) : ''} onChange={(e) => handleChange(field.name, e.target.value)} className="w-full px-4 py-3 text-sm border border-zinc-200 rounded-xl outline-none focus:border-zinc-400 focus:ring-4 focus:ring-zinc-500/10 bg-zinc-50 hover:bg-zinc-100 focus:bg-white text-zinc-900 font-medium" />}

                  {/* Phone */}
                  {field.type === 'phone' && (
                    <div className="border border-zinc-200 rounded-xl focus-within:border-zinc-400 focus-within:ring-4 focus-within:ring-zinc-500/10 bg-zinc-50 hover:bg-zinc-100 focus-within:bg-white px-4 py-2 transition-all">
                      <PhoneInput international defaultCountry="IN" value={formData[field.name] || ''} onChange={(val) => handleChange(field.name, val)} required={field.isRequired} className="text-sm font-medium text-zinc-900 outline-none w-full bg-transparent" />
                    </div>
                  )}

                  {/* Dropdowns */}
                  {(field.type === 'dropdown' || field.type === 'relation') && (
                    <select required={field.isRequired} value={formData[field.name] || ''} onChange={(e) => handleChange(field.name, e.target.value)} disabled={field.cascadingParentField && !formData[field.cascadingParentField]} className="w-full px-4 py-3 text-sm border border-zinc-200 rounded-xl outline-none focus:border-zinc-400 focus:ring-4 focus:ring-zinc-500/10 bg-zinc-50 hover:bg-zinc-100 focus:bg-white text-zinc-900 font-medium appearance-none disabled:opacity-50 disabled:cursor-not-allowed">
                      <option value="">{field.cascadingParentField && !formData[field.cascadingParentField] ? `Select ${field.cascadingParentField} first...` : 'Select option...'}</option>
                      {field.type === 'dropdown' && (field.options || []).map((opt, i) => <option key={i} value={opt}>{opt}</option>)}
                      {field.type === 'relation' && getFilteredRelations(field).map(r => <option key={r._id} value={r._id}>{getDisplayValue(r._id, field)}</option>)}
                    </select>
                  )}

                  {/* Checkbox */}
                  {field.type === 'checkbox' && (
                    <label className="flex items-center gap-2 mt-2 cursor-pointer w-fit">
                      <input type="checkbox" checked={formData[field.name] || false} onChange={(e) => handleChange(field.name, e.target.checked)} className="w-4 h-4 text-zinc-900 rounded border-zinc-300 focus:ring-zinc-900" />
                      <span className="text-sm font-medium text-zinc-700">Enabled</span>
                    </label>
                  )}

                  {/* Media */}
                  {field.type === 'media' && (
                    <div className="flex flex-col gap-2 mt-1">
                      {formData[field.name] ? (
                        <div className="relative w-24 h-24 border border-zinc-200 rounded-xl overflow-hidden group shadow-sm"><img src={formData[field.name]} alt="preview" className="w-full h-full object-cover" /><button type="button" onClick={() => handleChange(field.name, '')} className="absolute inset-0 bg-zinc-900/60 text-white opacity-0 group-hover:opacity-100 flex items-center justify-center text-xs font-bold transition-opacity">Clear</button></div>
                      ) : (<input type="file" required={field.isRequired} onChange={(e) => handleFileUpload(e, field.name)} className="text-xs text-zinc-500 file:mr-4 file:py-2 file:px-4 file:rounded-full file:border-0 file:text-xs file:font-semibold file:bg-zinc-100 file:text-zinc-700 hover:file:bg-zinc-200 transition-colors cursor-pointer" />)}
                    </div>
                  )}
                  
                  {/* THE FIX: Defensively verify Array before mapping */}
                  {field.type === 'media-multiple' && (
                    <div className="flex flex-col gap-3 p-4 border border-zinc-200 rounded-xl bg-zinc-50/50 mt-1">
                       <div className="flex flex-wrap gap-3">
                         {Array.isArray(formData[field.name]) && formData[field.name].map((url, i) => (
                           <div key={i} className="relative w-16 h-16 border border-zinc-200 rounded-lg overflow-hidden group shadow-sm">
                             <img src={url} alt="file" className="w-full h-full object-cover" />
                             <button type="button" onClick={() => setFormData(prev => ({ ...prev, [field.name]: prev[field.name].filter((_, idx) => idx !== i) }))} className="absolute top-1 right-1 bg-red-500 text-white w-5 h-5 rounded-full flex items-center justify-center text-xs opacity-0 group-hover:opacity-100 transition-opacity shadow-sm">✕</button>
                           </div>
                         ))}
                       </div>
                       <input type="file" multiple required={field.isRequired && (!Array.isArray(formData[field.name]) || formData[field.name].length === 0)} onChange={(e) => handleMultiUpload(e, field.name)} className="text-xs text-zinc-500 file:mr-4 file:py-2 file:px-4 file:rounded-full file:border-0 file:text-xs file:font-semibold file:bg-zinc-100 file:text-zinc-700 hover:file:bg-zinc-200 transition-colors cursor-pointer" />
                    </div>
                  )}

                </div>
              ))}
            </div>

            <div className="pt-6 mt-2 border-t border-zinc-100 flex justify-end gap-3 shrink-0">
              <button type="button" onClick={onCancel} className="px-5 py-2.5 text-sm font-semibold text-zinc-600 hover:text-zinc-900 hover:bg-zinc-100 rounded-xl transition-colors">Cancel</button>
              
              <button 
                type="submit" 
                disabled={isSubmitting || isUploadingFile} 
                className="bg-zinc-900 text-white px-6 py-2.5 rounded-xl text-sm font-semibold hover:bg-zinc-800 disabled:opacity-50 disabled:cursor-not-allowed transition-all shadow-md flex items-center gap-2"
              >
                {isUploadingFile ? 'Uploading Files...' : isSubmitting ? 'Saving...' : 'Save Record'}
              </button>
            </div>
          </form>
        )}

        {/* Related Activity Tab */}
        {activeTab === 'related' && (
          <div className="flex-1 overflow-y-auto p-6 bg-zinc-50/50">
            {isLoadingRelations ? (
              <div className="text-center py-10 text-sm font-medium text-zinc-500">Scanning architecture for related records...</div>
            ) : subRecords.length === 0 ? (
              <div className="text-center py-12 border-2 border-dashed border-zinc-200 rounded-2xl bg-white">
                <p className="text-sm font-medium text-zinc-500">No linked records found in this workspace.</p>
              </div>
            ) : (
              <div className="space-y-8">
                {subRecords.map((subSet, index) => (
                  <div key={index} className="space-y-4">
                    <h4 className="text-[11px] font-bold text-zinc-400 uppercase tracking-widest">{subSet.entityName}</h4>
                    <div className="grid gap-3">
                      {subSet.records.map(rec => (
                        <div key={rec._id} className="bg-white p-4 rounded-xl border border-zinc-200 shadow-sm flex flex-col gap-2 transition-shadow hover:shadow-md">
                          {Object.entries(rec.data).map(([key, val], i) => {
                            if (val === record._id) return null;
                            return (
                              <div key={i} className="flex flex-col sm:flex-row sm:justify-between sm:items-baseline gap-1">
                                <span className="text-[10px] font-bold text-zinc-400 uppercase tracking-wider">{key}</span>
                                <span className="text-sm text-zinc-900 font-medium truncate max-w-[300px]">{String(val)}</span>
                              </div>
                            );
                          })}
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

      {/* Inner Member Slide-Over */}
      {memberActivityUserId && (
        <div onClick={(e) => e.stopPropagation()} className="absolute inset-y-0 right-0 w-full md:w-[380px] bg-white shadow-2xl border-l border-zinc-200 z-[80] flex flex-col transform transition-transform duration-300">
          <div className="px-5 py-4 border-b border-zinc-100 flex justify-between items-start bg-zinc-50">
            <div>
              <span className="text-[10px] font-bold text-zinc-500 uppercase tracking-widest">Team Workload</span>
              <h2 className="text-xl font-bold text-zinc-900 leading-tight mt-1 flex items-center gap-2">
                👤 {getUserDisplayName(memberActivityUserId)}
              </h2>
            </div>
            <button onClick={() => setMemberActivityUserId(null)} className="p-2 bg-white border border-zinc-200 hover:bg-zinc-100 text-zinc-500 rounded-lg shadow-sm transition-colors">✕</button>
          </div>

          <div className="flex-1 overflow-y-auto p-5">
            {isLoadingActivity ? (
              <p className="text-xs font-medium text-zinc-400 text-center py-5">Loading activity...</p>
            ) : memberActivityRecords.length === 0 ? (
              <div className="text-center py-8 border-2 border-dashed border-zinc-200 rounded-xl bg-zinc-50">
                <p className="text-sm font-medium text-zinc-500">This user is completely free!</p>
              </div>
            ) : (
              <div className="space-y-3">
                {memberActivityRecords.map(rec => {
                  const titleF = entity.fields.find(f => f.type === 'text') || entity.fields[0];
                  return (
                    <div key={rec._id} className="bg-white p-3.5 rounded-xl border border-zinc-200 shadow-sm group">
                      <div className="text-sm font-bold text-zinc-800 truncate mb-1">{rec.data?.[titleF?.name] || 'Unnamed Record'}</div>
                      {entity.fields.find(f => f.type === 'dropdown') && (
                         <span className="text-[10px] font-bold bg-zinc-100 text-zinc-700 px-2 py-0.5 rounded uppercase tracking-wider">
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