import { useState, useEffect } from 'react';
import api from '../api/axiosConfig';
import PhoneInput from 'react-phone-number-input';
import 'react-phone-number-input/style.css';

export default function DynamicForm({ entity, onSuccess, onCancel }) {
  const [formData, setFormData] = useState({});
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isUploadingFile, setIsUploadingFile] = useState(false);
  const [relationData, setRelationData] = useState({});

  // --- THE BULLETPROOF FORMULA ENGINE ---
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

  // --- PHASE B: LOOKUP ENGINE ---
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

  // --- PHASE B: ROLLUP MATH ENGINE ---
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

  // --- FETCH LINKED DATABASE RECORDS ---
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

  // --- UPGRADED: FLEXIBLE MULTI-COLUMN FORMATTER ---
  const getDisplayValue = (recordId, field) => {
    if (!recordId) return '-';
    const targetRecords = relationData[field.name] || [];
    const match = targetRecords.find(r => r._id === recordId);
    if (!match || !match.data) return `ID: ${String(recordId).slice(-4)}`;
    
    // Check if the Admin defined multiple columns to show
    if (field.displayFields && field.displayFields.length > 0) {
      return field.displayFields.map(fieldName => {
        // 1. Try an exact match first
        if (match.data[fieldName] !== undefined) return match.data[fieldName];
        
        // 2. Try a flexible case-insensitive match (forgiving typos like 'first name' vs 'First Name')
        const flexKey = Object.keys(match.data).find(k => k.toLowerCase().trim() === fieldName.toLowerCase().trim());
        return flexKey ? match.data[flexKey] : null;
        
      }).filter(val => val !== undefined && val !== null && val !== '').join(' - '); 
    }
    
    // Default fallback
    const keys = Object.keys(match.data);
    return keys.length > 0 ? match.data[keys[0]] : 'Unnamed';
  };

  // --- PHASE B: CASCADING FILTERS ---
  const getFilteredRelations = (field) => {
    let allOptions = relationData[field.name] || [];
    if (field.cascadingParentField && field.cascadingTargetField) {
      const selectedParentId = formData[field.cascadingParentField];
      if (!selectedParentId) return [];
      allOptions = allOptions.filter(record => record.data && record.data[field.cascadingTargetField] === selectedParentId);
    }
    return allOptions;
  };

  // --- INPUT HANDLERS ---
  const handleChange = (fieldName, value) => {
    setFormData(prev => {
      const newData = { ...prev, [fieldName]: value };
      
      // Auto-clear dependent dropdowns if parent changes
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

  // --- SUBMIT AND VALIDATE ---
  const handleSubmit = async (e) => {
    e.preventDefault();
    setIsSubmitting(true);
    try {
      const payloadData = { ...formData };
      
      for (let field of entity.fields) {
        if (field.type === 'formula' || field.type === 'conditional-formula') {
          payloadData[field.name] = computeFormula(payloadData, getActiveFormula(field, payloadData));
        }
        if (field.type === 'lookup') {
          payloadData[field.name] = computeLookup(field, payloadData);
        }
        if (field.type === 'rollup') {
          payloadData[field.name] = computeRollup(field, payloadData);
        }
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
      <div onClick={(e) => e.stopPropagation()} className="bg-white cursor-default rounded-xl shadow-2xl w-full max-w-2xl max-h-[90vh] overflow-hidden flex flex-col border border-zinc-200">
        
        {/* MODAL HEADER */}
        <div className="flex justify-between items-center px-6 py-4 border-b border-zinc-100 bg-zinc-50/50">
          <h3 className="text-sm font-semibold text-zinc-900">New {entity.name} Record</h3>
          <button onClick={onCancel} className="text-zinc-400 hover:text-zinc-600 transition-colors p-1 rounded-md hover:bg-zinc-100">
            <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" viewBox="0 0 20 20" fill="currentColor">
              <path fillRule="evenodd" d="M4.293 4.293a1 1 0 011.414 0L10 8.586l4.293-4.293a1 1 0 111.414 1.414L11.414 10l4.293 4.293a1 1 0 01-1.414 1.414L10 11.414l-4.293 4.293a1 1 0 01-1.414-1.414L8.586 10 4.293 5.707a1 1 0 010-1.414z" clipRule="evenodd" />
            </svg>
          </button>
        </div>

        {/* DYNAMIC FORM BODY */}
        <form onSubmit={handleSubmit} className="flex-1 overflow-y-auto p-6 flex flex-col gap-5">
          {entity.fields.map((field, idx) => (
            <div key={idx} className="flex flex-col gap-1.5">
              
              <label className="flex items-center text-xs font-semibold text-zinc-500 uppercase tracking-wider">
                {field.name}
                {field.isRequired && <span className="text-red-500 ml-0.5 text-sm leading-none">*</span>}
                {field.isUnique && <span className="text-indigo-400 ml-1.5 text-[9px] px-1.5 py-0.5 bg-indigo-50 border border-indigo-100 rounded-full font-bold">Unique</span>}
                {(field.type === 'formula' || field.type === 'conditional-formula' || field.type === 'lookup' || field.type === 'rollup') && <span className="text-emerald-500 ml-1.5 text-[10px] font-bold px-1.5 py-0.5 bg-emerald-50 border border-emerald-100 rounded-full">Auto-Calculated</span>}
              </label>
              
              {/* Auto-Calculated Read-Only Fields */}
              {(field.type === 'lookup' || field.type === 'rollup') && (
                <input type="text" disabled value={field.type === 'lookup' ? computeLookup(field, formData) : computeRollup(field, formData)} className="px-3 py-2 text-sm border border-indigo-200 rounded-md bg-indigo-50/40 text-indigo-800 font-medium outline-none cursor-not-allowed transition-all" />
              )}
              {(field.type === 'formula' || field.type === 'conditional-formula') && (
                <input type="text" disabled value={computeFormula(formData, getActiveFormula(field, formData))} className="px-3 py-2 text-sm border border-emerald-200 rounded-md bg-emerald-50/50 text-emerald-700 font-mono outline-none cursor-not-allowed" />
              )}

              {/* Data Input Fields */}
              {field.type === 'json' && (<textarea value={formData[field.name] || ''} onChange={(e) => handleChange(field.name, e.target.value)} placeholder="{\n  &quot;key&quot;: &quot;value&quot;\n}" className="px-3 py-3 text-xs font-mono border border-zinc-200 rounded-md focus:ring-1 focus:ring-indigo-500 outline-none bg-zinc-900 text-emerald-400 min-h-[150px] shadow-inner leading-relaxed" required={field.isRequired} />)}
              {field.type === 'email' && <input type="email" placeholder="name@company.com" value={formData[field.name] || ''} onChange={(e) => handleChange(field.name, e.target.value)} required={field.isRequired} className="px-3 py-2 text-sm border border-zinc-200 rounded-md focus:ring-1 focus:ring-indigo-500 outline-none" />}
              {field.type === 'phone' && (<div className="border border-zinc-200 rounded-md focus-within:ring-1 focus-within:ring-indigo-500 focus-within:border-indigo-500 bg-white px-3 py-1.5"><PhoneInput international defaultCountry="IN" value={formData[field.name] || ''} onChange={(val) => handleChange(field.name, val)} required={field.isRequired} className="text-sm outline-none w-full" /></div>)}
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

              {/* Linked Record with Cascading Support */}
              {field.type === 'relation' && (
                <select 
                  value={formData[field.name] || ''} 
                  onChange={(e) => handleChange(field.name, e.target.value)} 
                  required={field.isRequired} 
                  className={`px-3 py-2 text-sm border border-zinc-200 rounded-md bg-white outline-none focus:ring-1 focus:ring-indigo-500 ${field.cascadingParentField && !formData[field.cascadingParentField] ? 'bg-zinc-100 cursor-not-allowed opacity-70' : ''}`}
                  disabled={field.cascadingParentField && !formData[field.cascadingParentField]}
                >
                  <option value="">{field.cascadingParentField && !formData[field.cascadingParentField] ? `Select ${field.cascadingParentField} first...` : 'Select record...'}</option>
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
              
              {/* Media Uploaders */}
              {field.type === 'media' && (
                <div className="flex flex-col gap-2">
                  {formData[field.name] ? (<div className="relative w-20 h-20 border rounded-md overflow-hidden group"><img src={formData[field.name]} alt="preview" className="w-full h-full object-cover" /><button type="button" onClick={() => handleChange(field.name, '')} className="absolute inset-0 bg-black/60 text-white opacity-0 group-hover:opacity-100 flex items-center justify-center text-xs">Clear</button></div>) : (<input type="file" onChange={(e) => handleFileUpload(e, field.name)} required={field.isRequired} className="text-xs" />)}
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

          {/* FOOTER ACTIONS */}
          <div className="flex gap-2 mt-4 pt-5 border-t border-zinc-100 pb-2">
            <button type="button" onClick={onCancel} className="flex-1 bg-white border border-zinc-200 text-zinc-700 py-2.5 rounded-md font-bold text-sm hover:bg-zinc-50 transition-colors">Cancel</button>
            <button type="submit" disabled={isSubmitting || isUploadingFile} className="flex-1 bg-indigo-600 text-white py-2.5 rounded-md font-bold text-sm hover:bg-indigo-700 disabled:opacity-50 transition-all shadow-sm">{isUploadingFile ? 'Uploading Files...' : isSubmitting ? 'Creating Record...' : 'Create Record'}</button>
          </div>
        </form>
      </div>
    </div>
  );
}