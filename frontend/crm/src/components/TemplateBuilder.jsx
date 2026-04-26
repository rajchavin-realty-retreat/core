import { useState, useEffect } from 'react';
import api from '../api/axiosConfig';

const ADMIN_EMAILS = ['your.email@gmail.com', 'admin@rajchavin.com']; 

// --- NEW: Added Props for Editing ---
export default function TemplateBuilder({ editingTemplate, setEditingTemplate, setActiveTab }) {
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [databases, setDatabases] = useState([]);
  const [isSaving, setIsSaving] = useState(false);

  const currentUser = JSON.parse(localStorage.getItem('userInfo'));
  const isGlobalAdmin = ADMIN_EMAILS.includes(currentUser?.email);

  // --- NEW: AUTO-FILL THE FORM WHEN EDITING ---
  useEffect(() => {
    if (editingTemplate) {
      setName(editingTemplate.name || '');
      setDescription(editingTemplate.description || '');
      
      const mappedDatabases = editingTemplate.databases.map(db => {
        return {
          ...db,
          tempId: db.tempId || `db_${Date.now()}_${Math.random()}`,
          showCreatedAt: db.showCreatedAt || false,
          fields: db.fields.map(f => {
            let conditionMap = {};
            if (f.type === 'conditional-formula' && f.conditions) {
              f.conditions.forEach(c => { conditionMap[c.value] = c.formula; });
            }
            return {
              ...f,
              optionsArray: f.options || [],
              tempOption: '',
              conditionMap,
              displayFieldsStr: f.displayFields?.join(', ') || '',
              cascadingParentField: f.cascadingParentField || '',
              cascadingTargetField: f.cascadingTargetField || '',
              sourceRelationField: f.sourceRelationField || '',
              targetLookupField: f.targetLookupField || '',
              rollupFunction: f.rollupFunction || 'SUM',
              targetTempId: f.targetTempId || ''
            };
          })
        };
      });
      setDatabases(mappedDatabases.length > 0 ? mappedDatabases : []);
    } else {
      // Reset if not editing
      setName('');
      setDescription('');
      setDatabases([]);
    }
  }, [editingTemplate]);

  if (!isGlobalAdmin) {
    return (
      <div className="flex flex-col items-center justify-center h-[80vh] text-center">
        <div className="bg-red-50 text-red-500 p-4 rounded-full mb-4">
          <svg xmlns="http://www.w3.org/2000/svg" className="h-8 w-8" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" /></svg>
        </div>
        <h2 className="text-2xl font-bold text-zinc-900 mb-2">Access Denied</h2>
        <p className="text-zinc-500 max-w-md">You do not have the required Global Administrator privileges to access the Master Template Builder.</p>
      </div>
    );
  }

  const handleAddDatabase = () => {
    setDatabases([...databases, { 
      tempId: `db_${Date.now()}`, 
      name: '', 
      showCreatedAt: false,
      fields: [] 
    }]);
  };

  const handleAddField = (dbIndex) => {
    const updated = [...databases];
    updated[dbIndex].fields.push({ 
      name: '', type: 'text', optionsArray: [], tempOption: '', targetTempId: '', formula: '', dependentField: '', conditionMap: {}, isRequired: false, isUnique: false, displayFieldsStr: '', cascadingParentField: '', cascadingTargetField: '', sourceRelationField: '', targetLookupField: '', rollupFunction: 'SUM' 
    });
    setDatabases(updated);
  };

  const handleUpdateDatabase = (dbIndex, key, value) => {
    const updated = [...databases];
    updated[dbIndex][key] = value;
    setDatabases(updated);
  };

  const handleUpdateField = (dbIndex, fieldIndex, key, value) => {
    const updated = [...databases];
    updated[dbIndex].fields[fieldIndex][key] = value;
    setDatabases(updated);
  };

  const addDropdownOption = (dbIndex, fieldIndex) => {
    const updated = [...databases];
    const field = updated[dbIndex].fields[fieldIndex];
    const val = (field.tempOption || '').trim();
    if (val) {
      if (!field.optionsArray) field.optionsArray = [];
      if (!field.optionsArray.includes(val)) field.optionsArray.push(val);
      field.tempOption = '';
      setDatabases(updated);
    }
  };

  const removeDropdownOption = (dbIndex, fieldIndex, optionIndex) => {
    const updated = [...databases];
    updated[dbIndex].fields[fieldIndex].optionsArray.splice(optionIndex, 1);
    setDatabases(updated);
  };

  const handleSaveTemplate = async (e) => {
    e.preventDefault();
    if (databases.length === 0) return alert("Add at least one database!");
    
    setIsSaving(true);
    try {
      const premiumIcon = `<svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="1.5" d="M19 11H5m14 0a2 2 0 012 2v6a2 2 0 01-2 2H5a2 2 0 01-2-2v-6a2 2 0 012-2m14 0V9a2 2 0 00-2-2M5 11V9a2 2 0 012-2m0 0V5a2 2 0 012-2h6a2 2 0 012 2v2M7 7h10" /></svg>`;
      
      const cleanedDatabases = databases.map(db => ({
        tempId: db.tempId,
        name: db.name,
        showCreatedAt: db.showCreatedAt,
        fields: db.fields.map(f => {
          let baseField = { name: f.name, type: f.type, isRequired: f.isRequired, isUnique: f.isUnique };
          if (f.type === 'dropdown') return { ...baseField, options: f.optionsArray || [] };
          if (f.type === 'formula') return { ...baseField, formula: f.formula };
          if (f.type === 'conditional-formula') {
            const dependentFieldSchema = db.fields.find(df => df.name === f.dependentField);
            const compiledConditions = (dependentFieldSchema?.optionsArray || []).map(opt => ({ value: opt, formula: f.conditionMap?.[opt] || '' }));
            return { ...baseField, dependentField: f.dependentField, conditions: compiledConditions };
          }
          if (f.type === 'relation') {
            return { 
              ...baseField, 
              targetTempId: f.targetTempId,
              displayFields: f.displayFieldsStr ? f.displayFieldsStr.split(',').map(s => s.trim()).filter(s => s) : [],
              cascadingParentField: f.cascadingParentField,
              cascadingTargetField: f.cascadingTargetField
            };
          }
          if (f.type === 'lookup') {
            return { ...baseField, sourceRelationField: f.sourceRelationField, targetLookupField: f.targetLookupField };
          }
          if (f.type === 'rollup') {
            return { ...baseField, sourceRelationField: f.sourceRelationField, targetLookupField: f.targetLookupField, rollupFunction: f.rollupFunction };
          }
          return baseField;
        })
      }));

      // --- NEW: PUT VS POST LOGIC ---
      if (editingTemplate) {
        await api.put(`/templates/${editingTemplate._id}`, { name, description, icon: premiumIcon, databases: cleanedDatabases });
        alert("Enterprise Template successfully updated!");
        if (setEditingTemplate) setEditingTemplate(null);
        if (setActiveTab) setActiveTab('templates');
      } else {
        await api.post('/templates', { name, description, icon: premiumIcon, databases: cleanedDatabases });
        alert("Enterprise Template published globally!");
        setName(''); setDescription(''); setDatabases([]);
      }

    } catch (error) {
      alert(error.response?.data?.message || "Failed to publish template.");
    } finally {
      setIsSaving(false);
    }
  };

  const handleCancelEdit = () => {
    if (setEditingTemplate) setEditingTemplate(null);
    if (setActiveTab) setActiveTab('templates');
  };

  const getTargetDatabaseFields = (targetTempId) => {
    if (!targetTempId) return [];
    const targetDb = databases.find(d => d.tempId === targetTempId);
    return targetDb ? targetDb.fields : [];
  };

  return (
    <div className="flex flex-col h-[85vh] gap-6 max-w-6xl mx-auto">
      <div className="bg-zinc-900 border border-zinc-800 p-8 rounded-2xl shadow-xl shrink-0 text-white relative overflow-hidden">
        <div className="absolute top-0 right-0 -mt-10 -mr-10 w-40 h-40 bg-indigo-500 rounded-full blur-3xl opacity-20"></div>
        <div className="relative z-10 flex justify-between items-start sm:items-center flex-col sm:flex-row gap-4">
          <div>
            <h2 className="text-2xl font-black flex items-center gap-3 tracking-tight">
              <svg xmlns="http://www.w3.org/2000/svg" className="h-7 w-7 text-indigo-400" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 20l4-16m4 4l4 4-4 4M6 16l-4-4 4-4" /></svg>
              {editingTemplate ? `Editing: ${editingTemplate.name}` : 'Master Template Builder'}
            </h2>
            <p className="text-zinc-400 mt-2 text-sm font-medium">Design and publish enterprise-grade architectural templates with formulas and rollups.</p>
          </div>
          
          <div className="flex items-center gap-4">
            {editingTemplate && (
              <button onClick={handleCancelEdit} type="button" className="text-sm font-bold bg-white/10 hover:bg-white/20 text-white px-4 py-2.5 rounded-lg transition-colors border border-white/10">
                Cancel Edit
              </button>
            )}
            <div className="text-right bg-zinc-800/50 p-3 rounded-lg border border-zinc-700/50 backdrop-blur-sm">
              <p className="text-[10px] text-zinc-500 uppercase tracking-widest font-bold mb-0.5">Authorized As</p>
              <p className="text-sm font-bold text-indigo-300">{currentUser?.email}</p>
            </div>
          </div>
        </div>
      </div>

      <form onSubmit={handleSaveTemplate} className="flex-1 overflow-y-auto space-y-6 pb-10 px-1">
        {/* ... The rest of the form UI remains EXACTLY the same ... */}
        <div className="bg-white p-6 rounded-xl border border-zinc-200 shadow-sm flex flex-col md:flex-row gap-5">
          <div className="flex-1">
            <label className="block text-[10px] font-bold text-zinc-400 uppercase tracking-widest mb-1.5">Template Name</label>
            <input required type="text" value={name} onChange={e => setName(e.target.value)} placeholder="e.g., Advanced Sales CRM" className="w-full bg-zinc-50 border border-zinc-200 rounded-lg px-4 py-2.5 text-sm font-semibold outline-none focus:border-indigo-500 focus:bg-white transition-colors" />
          </div>
          <div className="flex-[2]">
            <label className="block text-[10px] font-bold text-zinc-400 uppercase tracking-widest mb-1.5">Description</label>
            <input required type="text" value={description} onChange={e => setDescription(e.target.value)} placeholder="A complete system with cascading lookups and automated math..." className="w-full bg-zinc-50 border border-zinc-200 rounded-lg px-4 py-2.5 text-sm font-medium outline-none focus:border-indigo-500 focus:bg-white transition-colors" />
          </div>
        </div>

        <div className="space-y-6">
          {databases.map((db, dbIndex) => {
            const relationFieldsInThisDB = db.fields.filter(f => f.type === 'relation' && f.name);

            return (
              <div key={db.tempId} className="bg-white border border-zinc-200 rounded-xl shadow-sm transition-all hover:shadow-md hover:border-indigo-200 overflow-hidden">
                
                <div className="bg-zinc-50/80 px-6 py-5 border-b border-zinc-100 flex flex-col gap-4">
                  <div className="flex justify-between items-center">
                    <div className="flex items-center gap-3 w-1/2">
                      <div className="p-1.5 bg-indigo-100 text-indigo-600 rounded-md">
                        <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 7v10c0 2.21 3.582 4 8 4s8-1.79 8-4V7M4 7c0 2.21 3.582 4 8 4s8-1.79 8-4M4 7c0-2.21 3.582-4 8-4s8 1.79 8 4m0 5c0 2.21-3.582 4-8 4s-8-1.79-8-4" /></svg>
                      </div>
                      <input required type="text" value={db.name} onChange={e => handleUpdateDatabase(dbIndex, 'name', e.target.value)} placeholder="Database Name (e.g. Invoices)" className="bg-transparent font-bold text-lg outline-none w-full text-zinc-900 placeholder-zinc-300" />
                    </div>
                    <button type="button" onClick={() => setDatabases(databases.filter((_, i) => i !== dbIndex))} className="text-zinc-400 hover:text-red-500 p-2 rounded-md hover:bg-red-50 transition-colors">
                      <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" /></svg>
                    </button>
                  </div>
                  
                  <label className="flex items-center gap-2 cursor-pointer w-fit">
                    <input type="checkbox" checked={db.showCreatedAt} onChange={(e) => handleUpdateDatabase(dbIndex, 'showCreatedAt', e.target.checked)} className="rounded text-indigo-600 w-4 h-4 cursor-pointer" />
                    <span className="text-sm font-bold text-zinc-700">Display "Created Date" in Table</span>
                  </label>
                </div>
                
                <div className="p-6 space-y-4 bg-white">
                  <h4 className="text-xs font-semibold text-zinc-500 uppercase tracking-wider mb-2">Columns (Fields)</h4>
                  {db.fields.map((field, fieldIndex) => (
                    <div key={fieldIndex} className="flex flex-col gap-3 p-4 border border-zinc-200 rounded-xl bg-white hover:border-indigo-300 transition-colors shadow-sm">
                      
                      <div className="flex flex-col sm:flex-row gap-2 items-start sm:items-center">
                        <input required type="text" placeholder="Column Name" value={field.name} onChange={e => handleUpdateField(dbIndex, fieldIndex, 'name', e.target.value)} className="w-full sm:flex-[2] text-sm px-3 py-2 border border-zinc-200 rounded-md outline-none focus:border-indigo-500 font-medium text-zinc-800" />
                        
                        <div className="flex gap-2 w-full sm:flex-[3]">
                          <select value={field.type} onChange={e => handleUpdateField(dbIndex, fieldIndex, 'type', e.target.value)} className="flex-1 text-sm px-3 py-2 border border-zinc-200 rounded-md bg-white outline-none focus:border-indigo-500 font-medium text-zinc-700">
                            <optgroup label="Standard Types">
                              <option value="text">Short Text</option><option value="textarea">Long Text</option><option value="number">Number</option><option value="email">Email</option><option value="phone">Phone</option><option value="date">Date</option><option value="datetime">Date & Time</option><option value="checkbox">Checkbox</option><option value="media">Single File</option><option value="media-multiple">Image Gallery</option><option value="json">JSON / Object</option>
                            </optgroup>
                            <optgroup label="Advanced Workflow">
                              <option value="dropdown">Dropdown Options</option><option value="user">Team Member</option><option value="relation">Linked Database</option>
                            </optgroup>
                            <optgroup label="Smart Math & Logic">
                              <option value="formula">Formula / Math</option><option value="lookup">Lookup Field</option><option value="rollup">Rollup (Count/Sum)</option>
                            </optgroup>
                          </select>
                          <button type="button" onClick={() => { const u = [...databases]; u[dbIndex].fields.splice(fieldIndex, 1); setDatabases(u); }} className="p-2 text-zinc-400 hover:text-red-500 hover:bg-red-50 bg-white border border-zinc-200 rounded-md transition-colors">✕</button>
                        </div>
                      </div>

                      {!['formula', 'conditional-formula', 'checkbox', 'lookup', 'rollup'].includes(field.type) && (
                        <div className="flex flex-wrap gap-4 pt-1">
                          <label className="flex items-center gap-1.5 cursor-pointer"><input type="checkbox" checked={field.isRequired} onChange={e => handleUpdateField(dbIndex, fieldIndex, 'isRequired', e.target.checked)} className="w-3.5 h-3.5 text-indigo-600 rounded border-zinc-300" /><span className="text-xs font-semibold text-zinc-600">Require value</span></label>
                          <label className="flex items-center gap-1.5 cursor-pointer"><input type="checkbox" checked={field.isUnique} onChange={e => handleUpdateField(dbIndex, fieldIndex, 'isUnique', e.target.checked)} className="w-3.5 h-3.5 text-indigo-600 rounded border-zinc-300" /><span className="text-xs font-semibold text-zinc-600">Enforce unique</span></label>
                        </div>
                      )}

                      {(field.type === 'lookup' || field.type === 'rollup') && (
                        <div className="pt-3 border-t border-zinc-100 space-y-3">
                          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                            <div>
                              <label className="block text-[10px] font-bold text-indigo-600 uppercase tracking-wider mb-1">1. Select Local Linked Record</label>
                              <select required value={field.sourceRelationField} onChange={e => handleUpdateField(dbIndex, fieldIndex, 'sourceRelationField', e.target.value)} className="w-full px-3 py-1.5 text-sm border border-indigo-200 rounded-md bg-indigo-50/30 text-indigo-900 outline-none">
                                <option value="">Choose relation...</option>
                                {relationFieldsInThisDB.map((f, i) => <option key={i} value={f.name}>{f.name}</option>)}
                              </select>
                            </div>
                            {field.sourceRelationField && (() => {
                              const relField = relationFieldsInThisDB.find(f => f.name === field.sourceRelationField);
                              const targetFields = getTargetDatabaseFields(relField?.targetTempId);
                              return (
                                <div>
                                  <label className="block text-[10px] font-bold text-emerald-600 uppercase tracking-wider mb-1">2. Target Column to Pull</label>
                                  <select required value={field.targetLookupField} onChange={e => handleUpdateField(dbIndex, fieldIndex, 'targetLookupField', e.target.value)} className="w-full px-3 py-1.5 text-sm border border-emerald-200 rounded-md bg-emerald-50/30 text-emerald-900 outline-none">
                                    <option value="">Choose target field...</option>
                                    {targetFields.map((f, i) => <option key={i} value={f.name}>{f.name}</option>)}
                                  </select>
                                </div>
                              );
                            })()}
                          </div>
                          {field.type === 'rollup' && field.targetLookupField && (
                            <div className="w-full sm:w-1/2">
                              <label className="block text-[10px] font-bold text-amber-600 uppercase tracking-wider mb-1">3. Rollup Function</label>
                              <select required value={field.rollupFunction} onChange={e => handleUpdateField(dbIndex, fieldIndex, 'rollupFunction', e.target.value)} className="w-full px-3 py-1.5 text-sm border border-amber-200 rounded-md bg-amber-50/30 text-amber-900 outline-none">
                                <option value="SUM">Sum (Total)</option><option value="AVERAGE">Average</option><option value="COUNT">Count Items</option><option value="MIN">Minimum Value</option><option value="MAX">Maximum Value</option>
                              </select>
                            </div>
                          )}
                        </div>
                      )}

                      {field.type === 'relation' && (
                        <div className="pt-3 border-t border-zinc-100 space-y-4">
                          <div>
                            <label className="block text-[10px] font-bold text-zinc-500 uppercase tracking-wider mb-1">Target Database</label>
                            <select required value={field.targetTempId} onChange={e => handleUpdateField(dbIndex, fieldIndex, 'targetTempId', e.target.value)} className="w-full sm:w-1/2 px-3 py-1.5 text-sm border border-indigo-200 rounded-md bg-indigo-50 text-indigo-900 font-bold outline-none focus:border-indigo-500">
                              <option value="">Select Database...</option>{databases.map(d => <option key={d.tempId} value={d.tempId}>{d.name || 'Unnamed DB'}</option>)}
                            </select>
                          </div>
                          
                          {field.targetTempId && (
                            <div className="bg-zinc-50 p-4 border border-zinc-200 rounded-lg shadow-sm space-y-3">
                              <div>
                                <label className="block text-[10px] font-bold text-zinc-500 uppercase tracking-wider mb-1">Multi-Column Display (Optional)</label>
                                <input type="text" placeholder="e.g. First Name, Last Name" value={field.displayFieldsStr} onChange={e => handleUpdateField(dbIndex, fieldIndex, 'displayFieldsStr', e.target.value)} className="w-full px-3 py-2 text-xs border border-zinc-200 rounded outline-none" />
                                <p className="text-[9px] text-zinc-400 mt-1">Separate column names with commas to display multiple columns when searching.</p>
                              </div>
                              <div className="border-t border-zinc-200 pt-3">
                                <label className="block text-[10px] font-bold text-indigo-500 uppercase tracking-wider mb-1">Cascading Filter (Optional)</label>
                                <div className="flex gap-2 items-center">
                                  <input type="text" placeholder="Local Field (e.g., Service)" value={field.cascadingParentField} onChange={e => handleUpdateField(dbIndex, fieldIndex, 'cascadingParentField', e.target.value)} className="flex-1 px-3 py-2 text-xs border border-zinc-200 rounded outline-none bg-white" />
                                  <span className="text-xs font-bold text-zinc-400">must match</span>
                                  <input type="text" placeholder="Target Field (e.g., Parent Service)" value={field.cascadingTargetField} onChange={e => handleUpdateField(dbIndex, fieldIndex, 'cascadingTargetField', e.target.value)} className="flex-1 px-3 py-2 text-xs border border-zinc-200 rounded outline-none bg-white" />
                                </div>
                              </div>
                            </div>
                          )}
                        </div>
                      )}

                      {field.type === 'formula' && (
                        <div className="pt-3 border-t border-zinc-100">
                          <input type="text" required placeholder="e.g., {Price} * {Qty}" value={field.formula} onChange={e => handleUpdateField(dbIndex, fieldIndex, 'formula', e.target.value)} className="w-full font-mono text-sm px-3 py-2 border border-emerald-200 rounded-md bg-emerald-50 text-emerald-900 outline-none focus:border-emerald-500" />
                        </div>
                      )}

                      {field.type === 'dropdown' && (
                        <div className="pt-3 border-t border-zinc-100">
                          <div className="flex flex-wrap gap-2 mb-3">
                            {field.optionsArray?.map((opt, i) => (
                              <span key={i} className="bg-white border border-zinc-200 shadow-sm text-[11px] font-bold px-2 py-1 rounded-md flex items-center gap-1.5">
                                {opt} <button type="button" onClick={() => removeDropdownOption(dbIndex, fieldIndex, i)} className="text-zinc-400 hover:text-red-500">&times;</button>
                              </span>
                            ))}
                          </div>
                          <div className="flex gap-2">
                            <input type="text" placeholder="Add new option..." value={field.tempOption} onChange={e => handleUpdateField(dbIndex, fieldIndex, 'tempOption', e.target.value)} onKeyDown={(e) => { if(e.key === 'Enter') { e.preventDefault(); addDropdownOption(dbIndex, fieldIndex); }}} className="flex-1 text-sm px-3 py-2 border border-zinc-200 rounded outline-none focus:border-indigo-500" />
                            <button type="button" onClick={() => addDropdownOption(dbIndex, fieldIndex)} className="text-sm font-bold bg-zinc-800 text-white px-5 py-2 rounded hover:bg-zinc-700">Add</button>
                          </div>
                        </div>
                      )}
                    </div>
                  ))}
                  
                  <button type="button" onClick={() => handleAddField(dbIndex)} className="text-[11px] font-bold uppercase tracking-widest text-indigo-600 hover:bg-indigo-50 px-4 py-2.5 rounded-lg transition-colors flex items-center justify-center gap-1.5 mt-2 border border-dashed border-indigo-200 w-full sm:w-auto">
                    <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" /></svg>
                    Add New Column
                  </button>
                </div>
              </div>
            );
          })}
        </div>

        <button type="button" onClick={handleAddDatabase} className="w-full py-6 border-2 border-dashed border-zinc-300 rounded-xl text-zinc-500 font-bold hover:border-indigo-400 hover:text-indigo-600 hover:bg-indigo-50/30 transition-all flex items-center justify-center gap-2">
          <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 6v6m0 0v6m0-6h6m-6 0H6" /></svg>
          Add New Database Module
        </button>

        <button type="submit" disabled={isSaving} className="w-full bg-indigo-600 text-white text-lg font-bold py-4 rounded-xl shadow-lg hover:bg-indigo-700 disabled:opacity-50 transition-all flex items-center justify-center gap-2 mt-8">
          {isSaving ? (
            <span className="animate-pulse">{editingTemplate ? 'Updating Architecture...' : 'Publishing Architecture...'}</span>
          ) : (
            <>
              <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M15 13l-3-3m0 0l-3 3m3-3v12" /></svg>
              {editingTemplate ? 'Save Template Updates' : 'Publish Global Template'}
            </>
          )}
        </button>
      </form>
    </div>
  );
}