import { useState, useEffect } from 'react';
import api from '../api/axiosConfig';

export default function SchemaBuilder({ activeWorkspace, entities, fetchEntities, setIsCreatingEntity, setActiveTab, editingEntity, setEditingEntity }) {
  const [entityName, setEntityName] = useState('');
  
  // --- NEW: STATE FOR THE TOGGLE ---
  const [showCreatedAt, setShowCreatedAt] = useState(false);

  const [entityFields, setEntityFields] = useState([
    { name: '', type: 'text', optionsArray: [], tempOption: '', targetEntity: '', formula: '', dependentField: '', conditionMap: {}, isRequired: false, isUnique: false, displayFieldsStr: '', cascadingParentField: '', cascadingTargetField: '', sourceRelationField: '', targetLookupField: '', rollupFunction: 'SUM' }
  ]);
  const [draggedItemIndex, setDraggedItemIndex] = useState(null);

  useEffect(() => {
    if (editingEntity) {
      setEntityName(editingEntity.name);
      
      // Load the saved setting
      setShowCreatedAt(editingEntity.showCreatedAt || false);

      const mappedFields = editingEntity.fields.map(f => {
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
          rollupFunction: f.rollupFunction || 'SUM'
        };
      });
      setEntityFields(mappedFields.length > 0 ? mappedFields : [{ name: '', type: 'text', optionsArray: [], tempOption: '', targetEntity: '', formula: '', dependentField: '', conditionMap: {}, isRequired: false, isUnique: false, displayFieldsStr: '', cascadingParentField: '', cascadingTargetField: '', sourceRelationField: '', targetLookupField: '', rollupFunction: 'SUM' }]);
    }
  }, [editingEntity]);

  const handleDragStart = (index) => setDraggedItemIndex(index);
  const handleDragEnter = (e, index) => {
    e.preventDefault();
    if (draggedItemIndex === null || draggedItemIndex === index) return;
    const newFields = [...entityFields];
    const draggedItem = newFields[draggedItemIndex];
    newFields.splice(draggedItemIndex, 1);
    newFields.splice(index, 0, draggedItem);
    setDraggedItemIndex(index);
    setEntityFields(newFields);
  };
  const handleDragEnd = () => setDraggedItemIndex(null);

  const handleCreateOrUpdate = async (e) => {
    e.preventDefault();
    try {
      const names = entityFields.map(f => f.name.trim());
      if (names.includes('')) throw new Error("All columns must have a name.");
      const uniqueNames = new Set(names);
      if (uniqueNames.size !== names.length) throw new Error("Duplicate column names are not allowed.");

      const formattedFields = entityFields.map(field => {
        let baseField = { name: field.name, type: field.type, isRequired: field.isRequired, isUnique: field.isUnique };
        if (field.type === 'dropdown') return { ...baseField, options: field.optionsArray || [] };
        if (field.type === 'formula') return { ...baseField, formula: field.formula };
        if (field.type === 'conditional-formula') {
          const dependentFieldSchema = entityFields.find(f => f.name === field.dependentField);
          const compiledConditions = (dependentFieldSchema?.optionsArray || []).map(opt => ({ value: opt, formula: field.conditionMap[opt] || '' }));
          return { ...baseField, dependentField: field.dependentField, conditions: compiledConditions };
        }
        
        // --- PHASE B PAYLOAD COMPILERS ---
        if (field.type === 'relation') {
          return { 
            ...baseField, 
            targetEntity: field.targetEntity,
            displayFields: field.displayFieldsStr ? field.displayFieldsStr.split(',').map(s => s.trim()).filter(s => s) : [],
            cascadingParentField: field.cascadingParentField,
            cascadingTargetField: field.cascadingTargetField
          };
        }
        if (field.type === 'lookup') {
          return { ...baseField, sourceRelationField: field.sourceRelationField, targetLookupField: field.targetLookupField };
        }
        if (field.type === 'rollup') {
          return { ...baseField, sourceRelationField: field.sourceRelationField, targetLookupField: field.targetLookupField, rollupFunction: field.rollupFunction };
        }

        return baseField;
      });

      // --- SEND THE showCreatedAt TOGGLE IN THE PAYLOAD ---
      const payload = { 
        name: entityName, 
        fields: formattedFields,
        showCreatedAt: showCreatedAt 
      };

      if (editingEntity) {
        await api.put(`/entities/${editingEntity._id}`, payload);
      } else {
        await api.post('/entities', { workspaceId: activeWorkspace._id, ...payload });
      }
      
      setIsCreatingEntity(false);
      if (setEditingEntity) setEditingEntity(null);
      fetchEntities(activeWorkspace._id);
      setActiveTab('databases'); 
    } catch (error) { alert(error.message || error.response?.data?.message || 'Failed to save database'); }
  };

  const addFieldToSchema = () => setEntityFields([...entityFields, { name: '', type: 'text', optionsArray: [], tempOption: '', targetEntity: '', formula: '', dependentField: '', conditionMap: {}, isRequired: false, isUnique: false, displayFieldsStr: '', cascadingParentField: '', cascadingTargetField: '', sourceRelationField: '', targetLookupField: '', rollupFunction: 'SUM' }]);
  const removeFieldFromSchema = (indexToRemove) => setEntityFields(entityFields.filter((_, index) => index !== indexToRemove));
  const updateField = (index, key, value) => { const updatedFields = [...entityFields]; updatedFields[index][key] = value; setEntityFields(updatedFields); };
  const updateConditionMap = (fieldIndex, optionName, formulaValue) => { const updatedFields = [...entityFields]; if (!updatedFields[fieldIndex].conditionMap) updatedFields[fieldIndex].conditionMap = {}; updatedFields[fieldIndex].conditionMap[optionName] = formulaValue; setEntityFields(updatedFields); };
  const addDropdownOption = (index) => { const val = (entityFields[index].tempOption || '').trim(); if (val) { const updatedFields = [...entityFields]; if (!updatedFields[index].optionsArray) updatedFields[index].optionsArray = []; if (!updatedFields[index].optionsArray.includes(val)) updatedFields[index].optionsArray.push(val); updatedFields[index].tempOption = ''; setEntityFields(updatedFields); } };
  const removeDropdownOption = (fieldIndex, optionIndex) => { const updatedFields = [...entityFields]; updatedFields[fieldIndex].optionsArray.splice(optionIndex, 1); setEntityFields(updatedFields); };

  const getTargetDatabaseFields = (sourceRelationFieldName) => {
    const relationField = entityFields.find(f => f.name === sourceRelationFieldName && f.type === 'relation');
    if (!relationField || !relationField.targetEntity) return [];
    const targetDb = entities.find(e => e._id === relationField.targetEntity);
    return targetDb ? targetDb.fields : [];
  };

  const relationFieldsInSchema = entityFields.filter(f => f.type === 'relation' && f.name);

  return (
    <div className="bg-white p-4 sm:p-6 rounded-xl border border-zinc-200 shadow-sm max-w-4xl">
      <div className="flex justify-between items-center mb-5">
        <h2 className="text-base font-semibold text-zinc-900">{editingEntity ? 'Edit Database Schema' : 'Schema Builder'}</h2>
        {editingEntity && <button onClick={() => { setIsCreatingEntity(false); setEditingEntity(null); }} className="text-xs font-semibold text-zinc-400 hover:text-zinc-800">Cancel Edit</button>}
      </div>
      <form onSubmit={handleCreateOrUpdate} className="space-y-6">
        
        <div className="p-4 border border-zinc-200 rounded-lg bg-zinc-50 space-y-4">
          <div>
            <label className="block text-xs font-semibold text-zinc-500 uppercase tracking-wider mb-1.5">Database Name</label>
            <input type="text" required value={entityName} onChange={e => setEntityName(e.target.value)} className="w-full px-3 py-2 text-sm border border-zinc-200 rounded-md outline-none focus:border-indigo-500" />
          </div>
          
          {/* --- THE NEW TOGGLE SWITCH --- */}
          <label className="flex items-center gap-2 cursor-pointer mt-3 w-fit">
            <input 
              type="checkbox" 
              checked={showCreatedAt} 
              onChange={(e) => setShowCreatedAt(e.target.checked)} 
              className="rounded text-indigo-600 w-4 h-4 cursor-pointer" 
            />
            <span className="text-sm font-bold text-zinc-700">Display "Created Date" in Table</span>
          </label>
        </div>

        <div className="space-y-4">
          <label className="block text-xs font-semibold text-zinc-500 uppercase tracking-wider mb-2">Columns (Fields)</label>
          
          {entityFields.map((field, index) => (
            <div 
              key={index} draggable onDragStart={() => handleDragStart(index)} onDragEnter={(e) => handleDragEnter(e, index)} onDragOver={(e) => e.preventDefault()} onDragEnd={handleDragEnd}
              className={`flex flex-col gap-3 p-4 border rounded-xl shadow-sm transition-all ${draggedItemIndex === index ? 'opacity-50 border-indigo-400 bg-indigo-50/30' : 'bg-white border-zinc-200'}`}
            >
              <div className="flex flex-col sm:flex-row gap-2 items-start sm:items-center">
                <div className="cursor-move p-1.5 text-zinc-400 hover:text-zinc-600 active:cursor-grabbing"><svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 8h16M4 16h16" /></svg></div>
                <input type="text" placeholder="Column Name" required value={field.name} onChange={(e) => updateField(index, 'name', e.target.value)} className="w-full sm:flex-1 px-3 py-2 text-sm font-medium border border-zinc-200 rounded-md outline-none focus:border-indigo-500" />
                <div className="flex gap-2 w-full sm:w-auto">
                  <select value={field.type} onChange={(e) => updateField(index, 'type', e.target.value)} className="flex-1 sm:w-56 px-3 py-2 text-sm border border-zinc-200 rounded-md bg-white outline-none focus:border-indigo-500 font-medium">
                    <optgroup label="Standard Types">
                      <option value="text">Short Text</option><option value="textarea">Long Text</option><option value="email">Email</option><option value="phone">Phone</option><option value="number">Number</option><option value="date">Date</option><option value="datetime">Date & Time</option><option value="checkbox">Checkbox</option><option value="dropdown">Dropdown</option><option value="user">Team Member (Assignee)</option><option value="media">Single File</option><option value="media-multiple">Image Gallery</option><option value="json">Raw JSON / Object</option>
                    </optgroup>
                    <optgroup label="Relational & Advanced">
                      <option value="relation">Linked Record</option>
                      <option value="lookup">Lookup (Pull Linked Data)</option>
                      <option value="rollup">Rollup (Math on Linked Data)</option>
                      <option value="formula">Standard Formula</option>
                      <option value="conditional-formula">Conditional Logic</option> 
                    </optgroup>
                  </select>
                  {entityFields.length > 1 && <button type="button" onClick={() => removeFieldFromSchema(index)} className="p-2 text-zinc-400 hover:text-red-500 hover:bg-red-50 bg-white border border-zinc-200 rounded-md">✕</button>}
                </div>
              </div>

              {/* Validation Rules */}
              {!['formula', 'conditional-formula', 'checkbox', 'lookup', 'rollup'].includes(field.type) && (
                <div className="flex flex-wrap gap-4 pt-2 pb-1 pl-8">
                  <label className="flex items-center gap-1.5 cursor-pointer"><input type="checkbox" checked={field.isRequired || false} onChange={(e) => updateField(index, 'isRequired', e.target.checked)} className="w-3.5 h-3.5 text-indigo-600 rounded" /><span className="text-xs font-semibold text-zinc-600">Require value</span></label>
                  <label className="flex items-center gap-1.5 cursor-pointer"><input type="checkbox" checked={field.isUnique || false} onChange={(e) => updateField(index, 'isUnique', e.target.checked)} className="w-3.5 h-3.5 text-indigo-600 rounded" /><span className="text-xs font-semibold text-zinc-600">Enforce unique</span></label>
                </div>
              )}

              {/* --- PHASE B: LOOKUPS & ROLLUPS --- */}
              {(field.type === 'lookup' || field.type === 'rollup') && (
                <div className="pt-3 border-t border-zinc-200 pl-8 space-y-3">
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    <div>
                      <label className="block text-[10px] font-bold text-indigo-600 uppercase tracking-wider mb-1">1. Select Local Linked Record Field</label>
                      <select required value={field.sourceRelationField || ''} onChange={(e) => updateField(index, 'sourceRelationField', e.target.value)} className="w-full px-3 py-1.5 text-sm border border-indigo-200 rounded-md bg-indigo-50/30 text-indigo-900 outline-none">
                        <option value="">Choose relation...</option>
                        {relationFieldsInSchema.map((f, i) => <option key={i} value={f.name}>{f.name}</option>)}
                      </select>
                    </div>
                    {field.sourceRelationField && (
                      <div>
                        <label className="block text-[10px] font-bold text-emerald-600 uppercase tracking-wider mb-1">2. Select Target Column to Pull</label>
                        <select required value={field.targetLookupField || ''} onChange={(e) => updateField(index, 'targetLookupField', e.target.value)} className="w-full px-3 py-1.5 text-sm border border-emerald-200 rounded-md bg-emerald-50/30 text-emerald-900 outline-none">
                          <option value="">Choose target field...</option>
                          {getTargetDatabaseFields(field.sourceRelationField).map((f, i) => <option key={i} value={f.name}>{f.name}</option>)}
                        </select>
                      </div>
                    )}
                  </div>
                  {field.type === 'rollup' && field.targetLookupField && (
                    <div className="w-full sm:w-1/2">
                      <label className="block text-[10px] font-bold text-amber-600 uppercase tracking-wider mb-1">3. Rollup Function</label>
                      <select required value={field.rollupFunction || 'SUM'} onChange={(e) => updateField(index, 'rollupFunction', e.target.value)} className="w-full px-3 py-1.5 text-sm border border-amber-200 rounded-md bg-amber-50/30 text-amber-900 outline-none">
                        <option value="SUM">Sum (Total)</option><option value="AVERAGE">Average</option><option value="COUNT">Count Items</option><option value="MIN">Minimum Value</option><option value="MAX">Maximum Value</option>
                      </select>
                    </div>
                  )}
                </div>
              )}

              {/* --- PHASE B: ENHANCED RELATIONS --- */}
              {field.type === 'relation' && (
                <div className="pt-3 border-t border-zinc-200 pl-8 space-y-4">
                  <div>
                    <label className="block text-[10px] font-bold text-zinc-500 uppercase tracking-wider mb-1">Target Database</label>
                    <select required value={field.targetEntity || ''} onChange={(e) => updateField(index, 'targetEntity', e.target.value)} className="w-full sm:w-1/2 px-3 py-1.5 text-sm border border-indigo-200 rounded-md bg-indigo-50/30 text-indigo-900 outline-none focus:border-indigo-500">
                      <option value="">Select Database...</option>{entities.map(ent => <option key={ent._id} value={ent._id}>{ent.name}</option>)}
                    </select>
                  </div>
                  
                  {field.targetEntity && (
                    <div className="bg-zinc-50 p-3 border border-zinc-200 rounded-md shadow-sm space-y-3">
                      <div>
                        <label className="block text-[10px] font-bold text-zinc-500 uppercase tracking-wider mb-1">Multi-Column Display (Optional)</label>
                        <input type="text" placeholder="e.g. First Name, Last Name, Company" value={field.displayFieldsStr || ''} onChange={(e) => updateField(index, 'displayFieldsStr', e.target.value)} className="w-full px-3 py-1.5 text-xs border border-zinc-200 rounded outline-none" />
                        <p className="text-[9px] text-zinc-400 mt-0.5">Separate column names with commas to display multiple columns when searching.</p>
                      </div>
                      <div className="border-t border-zinc-200 pt-3">
                        <label className="block text-[10px] font-bold text-indigo-500 uppercase tracking-wider mb-1">Cascading Filter (Optional Sub-menus)</label>
                        <div className="flex gap-2 items-center">
                          <input type="text" placeholder="Local Field (e.g., Service)" value={field.cascadingParentField || ''} onChange={(e) => updateField(index, 'cascadingParentField', e.target.value)} className="flex-1 px-2 py-1.5 text-xs border border-zinc-200 rounded outline-none bg-white" />
                          <span className="text-xs font-bold text-zinc-400">must match</span>
                          <input type="text" placeholder="Target Field (e.g., Parent Service)" value={field.cascadingTargetField || ''} onChange={(e) => updateField(index, 'cascadingTargetField', e.target.value)} className="flex-1 px-2 py-1.5 text-xs border border-zinc-200 rounded outline-none bg-white" />
                        </div>
                      </div>
                    </div>
                  )}
                </div>
              )}

              {/* Formulas & Dropdowns */}
              {field.type === 'formula' && (<div className="pt-3 border-t border-zinc-200 pl-8"><input type="text" required placeholder="e.g., {Price} * {Qty}" value={field.formula || ''} onChange={(e) => updateField(index, 'formula', e.target.value)} className="w-full font-mono text-xs px-3 py-2 border border-emerald-200 rounded-md bg-emerald-50/30 text-emerald-900 outline-none" /></div>)}
              {field.type === 'dropdown' && (
                <div className="pt-3 border-t border-zinc-200 pl-8">
                  <div className="flex flex-wrap gap-1.5 mb-2">{field.optionsArray?.map((opt, i) => (<span key={i} className="bg-white border border-zinc-200 text-[11px] font-medium px-2 py-1 rounded flex items-center gap-1.5">{opt} <button type="button" onClick={() => removeDropdownOption(index, i)} className="text-zinc-400 hover:text-red-500">&times;</button></span>))}</div>
                  <div className="flex gap-2"><input type="text" placeholder="Add option..." value={field.tempOption || ''} onChange={(e) => updateField(index, 'tempOption', e.target.value)} onKeyDown={(e) => { if(e.key === 'Enter') { e.preventDefault(); addDropdownOption(index); }}} className="flex-1 text-sm px-3 py-1.5 border border-zinc-200 rounded outline-none" /><button type="button" onClick={() => addDropdownOption(index)} className="text-sm font-semibold bg-zinc-800 text-white px-4 py-1.5 rounded hover:bg-zinc-700">Add</button></div>
                </div>
              )}
            </div>
          ))}
        </div>
        
        <button type="button" onClick={addFieldToSchema} className="text-indigo-600 hover:text-indigo-800 text-sm font-bold inline-flex items-center gap-1 p-1"><svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" viewBox="0 0 20 20" fill="currentColor"><path fillRule="evenodd" d="M10 5a1 1 0 011 1v3h3a1 1 0 110 2h-3v3a1 1 0 11-2 0v-3H6a1 1 0 110-2h3V6a1 1 0 011-1z" clipRule="evenodd" /></svg> Add Column</button>
        <div className="pt-6 border-t border-zinc-200"><button type="submit" className="w-full sm:w-auto bg-indigo-600 hover:bg-indigo-700 text-white px-8 py-3 rounded-md font-bold text-sm shadow-md">Deploy Engine Updates</button></div>
      </form>
    </div>
  );
}