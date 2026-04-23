import { useState, useEffect } from 'react';
import api from '../api/axiosConfig';

export default function SchemaBuilder({ activeWorkspace, entities, fetchEntities, setIsCreatingEntity, setActiveTab, editingEntity, setEditingEntity }) {
  const [entityName, setEntityName] = useState('');
  const [entityFields, setEntityFields] = useState([
    { name: '', type: 'text', optionsArray: [], tempOption: '', targetEntity: '', formula: '', dependentField: '', conditionMap: {} }
  ]);

  // --- SMART PRE-FILL FOR EDITING ---
  useEffect(() => {
    if (editingEntity) {
      setEntityName(editingEntity.name);
      const mappedFields = editingEntity.fields.map(f => {
        let conditionMap = {};
        if (f.type === 'conditional-formula' && f.conditions) {
          f.conditions.forEach(c => { conditionMap[c.value] = c.formula; });
        }
        return { ...f, optionsArray: f.options || [], tempOption: '', conditionMap };
      });
      setEntityFields(mappedFields.length > 0 ? mappedFields : [{ name: '', type: 'text', optionsArray: [], tempOption: '', targetEntity: '', formula: '', dependentField: '', conditionMap: {} }]);
    }
  }, [editingEntity]);

  const handleCreateOrUpdate = async (e) => {
    e.preventDefault();
    try {
      const names = entityFields.map(f => f.name.trim());
      if (names.includes('')) throw new Error("All columns must have a name.");
      const uniqueNames = new Set(names);
      if (uniqueNames.size !== names.length) throw new Error("Duplicate column names are not allowed.");

      const formattedFields = entityFields.map(field => {
        if (field.type === 'dropdown') return { name: field.name, type: field.type, options: field.optionsArray || [] };
        if (field.type === 'relation') return { name: field.name, type: field.type, targetEntity: field.targetEntity };
        if (field.type === 'formula') return { name: field.name, type: field.type, formula: field.formula };
        
        if (field.type === 'conditional-formula') {
          const dependentFieldSchema = entityFields.find(f => f.name === field.dependentField);
          const compiledConditions = (dependentFieldSchema?.optionsArray || []).map(opt => ({
             value: opt, formula: field.conditionMap[opt] || ''
          }));
          return { name: field.name, type: field.type, dependentField: field.dependentField, conditions: compiledConditions };
        }
        return { name: field.name, type: field.type };
      });

      if (editingEntity) {
        await api.put(`/entities/${editingEntity._id}`, { name: entityName, fields: formattedFields });
      } else {
        await api.post('/entities', { workspaceId: activeWorkspace._id, name: entityName, fields: formattedFields });
      }
      
      setIsCreatingEntity(false);
      if (setEditingEntity) setEditingEntity(null);
      fetchEntities(activeWorkspace._id);
      setActiveTab('databases'); 
    } catch (error) { alert(error.message || error.response?.data?.message || 'Failed to save database'); }
  };

  const addFieldToSchema = () => setEntityFields([...entityFields, { name: '', type: 'text', optionsArray: [], tempOption: '', targetEntity: '', formula: '', dependentField: '', conditionMap: {} }]);
  const removeFieldFromSchema = (indexToRemove) => setEntityFields(entityFields.filter((_, index) => index !== indexToRemove));
  const updateField = (index, key, value) => { const updatedFields = [...entityFields]; updatedFields[index][key] = value; setEntityFields(updatedFields); };
  const updateConditionMap = (fieldIndex, optionName, formulaValue) => { const updatedFields = [...entityFields]; if (!updatedFields[fieldIndex].conditionMap) updatedFields[fieldIndex].conditionMap = {}; updatedFields[fieldIndex].conditionMap[optionName] = formulaValue; setEntityFields(updatedFields); };
  
  const addDropdownOption = (index) => {
    const val = (entityFields[index].tempOption || '').trim();
    if (val) {
      const updatedFields = [...entityFields];
      if (!updatedFields[index].optionsArray) updatedFields[index].optionsArray = [];
      if (!updatedFields[index].optionsArray.includes(val)) updatedFields[index].optionsArray.push(val);
      updatedFields[index].tempOption = ''; setEntityFields(updatedFields);
    }
  };
  const removeDropdownOption = (fieldIndex, optionIndex) => { const updatedFields = [...entityFields]; updatedFields[fieldIndex].optionsArray.splice(optionIndex, 1); setEntityFields(updatedFields); };

  return (
    <div className="bg-white p-4 sm:p-6 rounded-xl border border-zinc-200 shadow-sm max-w-3xl">
      <div className="flex justify-between items-center mb-5">
        <h2 className="text-base font-semibold text-zinc-900">{editingEntity ? 'Edit Database Schema' : 'Schema Builder'}</h2>
        {editingEntity && <button onClick={() => { setIsCreatingEntity(false); setEditingEntity(null); }} className="text-xs font-semibold text-zinc-400 hover:text-zinc-800">Cancel Edit</button>}
      </div>
      <form onSubmit={handleCreateOrUpdate} className="space-y-6">
        <div>
          <label className="block text-xs font-semibold text-zinc-500 uppercase tracking-wider mb-1.5">Database Name</label>
          <input type="text" required value={entityName} onChange={e => setEntityName(e.target.value)} className="w-full px-3 py-2 text-sm border border-zinc-200 rounded-md outline-none focus:border-indigo-500" />
        </div>
        <div className="space-y-3">
          <label className="block text-xs font-semibold text-zinc-500 uppercase tracking-wider">Columns (Fields)</label>
          {entityFields.map((field, index) => (
            <div key={index} className="flex flex-col gap-2 p-3 bg-zinc-50 border border-zinc-100 rounded-lg">
              <div className="flex flex-col sm:flex-row gap-2 items-start sm:items-center">
                <input type="text" placeholder="Column Name" required value={field.name} onChange={(e) => updateField(index, 'name', e.target.value)} className="w-full sm:flex-1 px-3 py-1.5 text-sm border border-zinc-200 rounded-md outline-none focus:border-indigo-500" />
                <div className="flex gap-2 w-full sm:w-auto">
                  <select value={field.type} onChange={(e) => updateField(index, 'type', e.target.value)} className="flex-1 sm:w-48 px-3 py-1.5 text-sm border border-zinc-200 rounded-md bg-white outline-none focus:border-indigo-500">
                    <option value="text">Short Text</option><option value="textarea">Long Text</option><option value="number">Number</option><option value="date">Date</option><option value="datetime">Date & Time</option><option value="checkbox">Checkbox</option><option value="dropdown">Dropdown</option><option value="media">Single File</option><option value="media-multiple">Image Gallery</option><option value="relation">Linked Record</option><option value="formula">Standard Formula</option><option value="conditional-formula">Conditional Logic (Switch)</option> 
                  </select>
                  {entityFields.length > 1 && <button type="button" onClick={() => removeFieldFromSchema(index)} className="p-1.5 text-zinc-400 hover:text-red-500 bg-white border border-zinc-200 rounded-md">✕</button>}
                </div>
              </div>

              {field.type === 'conditional-formula' && (
                <div className="pt-3 border-t border-zinc-200 mt-2 space-y-3">
                  <div>
                    <label className="block text-[10px] font-bold text-indigo-600 uppercase tracking-wider mb-1">1. Select Dependent Dropdown</label>
                    <select required value={field.dependentField || ''} onChange={(e) => updateField(index, 'dependentField', e.target.value)} className="w-full sm:w-1/2 px-3 py-1.5 text-sm border border-indigo-200 rounded-md bg-indigo-50/30 text-indigo-900 outline-none focus:border-indigo-500">
                      <option value="">Choose a dropdown column...</option>
                      {entityFields.filter(f => f.type === 'dropdown' && f.name !== field.name).map((f, i) => <option key={i} value={f.name}>{f.name}</option>)}
                    </select>
                  </div>
                  {field.dependentField && (
                    <div className="space-y-2 bg-white p-3 border border-indigo-100 rounded-md">
                      <label className="block text-[10px] font-bold text-emerald-600 uppercase tracking-wider">2. Define Formulas for each Option</label>
                      {entityFields.find(f => f.name === field.dependentField)?.optionsArray.map((opt, optIdx) => (
                        <div key={optIdx} className="flex flex-col sm:flex-row sm:items-center gap-2">
                          <span className="text-xs font-semibold text-zinc-700 w-24 truncate" title={opt}>If "{opt}":</span>
                          <input type="text" placeholder="e.g., {Salary} * 0.10" value={field.conditionMap?.[opt] || ''} onChange={(e) => updateConditionMap(index, opt, e.target.value)} className="flex-1 font-mono text-xs px-2 py-1.5 border border-emerald-200 rounded bg-emerald-50/30 outline-none focus:border-emerald-500" />
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              )}
              {field.type === 'formula' && (
                <div className="pt-2 border-t border-zinc-200 mt-1">
                  <label className="block text-[10px] font-semibold text-emerald-600 uppercase tracking-wider mb-1">Equation (Use brackets for columns)</label>
                  <input type="text" required placeholder="e.g., {Price} * {Quantity}" value={field.formula || ''} onChange={(e) => updateField(index, 'formula', e.target.value)} className="w-full font-mono text-xs px-3 py-2 border border-emerald-200 rounded-md bg-emerald-50/30 text-emerald-900 outline-none focus:border-emerald-500" />
                </div>
              )}
              {field.type === 'relation' && (
                <div className="pt-2 border-t border-zinc-200 mt-1">
                  <label className="block text-[10px] font-semibold text-zinc-500 uppercase tracking-wider mb-1">Target Database</label>
                  <select required value={field.targetEntity || ''} onChange={(e) => updateField(index, 'targetEntity', e.target.value)} className="w-full sm:w-1/2 px-3 py-1.5 text-sm border border-indigo-200 rounded-md bg-indigo-50/30 text-indigo-900 outline-none focus:border-indigo-500">
                    <option value="">Select Database to Link...</option>{entities.map(ent => <option key={ent._id} value={ent._id}>{ent.name}</option>)}
                  </select>
                </div>
              )}
              {field.type === 'dropdown' && (
                <div className="pt-2 border-t border-zinc-200 mt-1">
                  <div className="flex flex-wrap gap-1.5 mb-2">{field.optionsArray?.map((opt, i) => (<span key={i} className="bg-white border border-zinc-200 text-zinc-700 text-[11px] font-medium px-2 py-0.5 rounded-full flex items-center gap-1 shadow-sm">{opt} <button type="button" onClick={() => removeDropdownOption(index, i)} className="text-zinc-400 hover:text-red-500">&times;</button></span>))}</div>
                  <div className="flex gap-2">
                    <input type="text" placeholder="Add dropdown option..." value={field.tempOption || ''} onChange={(e) => updateField(index, 'tempOption', e.target.value)} onKeyDown={(e) => { if(e.key === 'Enter') { e.preventDefault(); addDropdownOption(index); }}} className="flex-1 text-xs px-2 py-1.5 border border-zinc-200 rounded outline-none focus:border-indigo-500" />
                    <button type="button" onClick={() => addDropdownOption(index)} className="text-xs font-medium bg-zinc-200 text-zinc-800 px-3 rounded hover:bg-zinc-300">Add</button>
                  </div>
                </div>
              )}
            </div>
          ))}
        </div>
        <button type="button" onClick={addFieldToSchema} className="text-indigo-600 hover:text-indigo-800 text-xs font-semibold inline-block p-1">+ Add Column</button>
        <div className="pt-4 border-t border-zinc-100">
          <button type="submit" className="w-full sm:w-auto bg-indigo-600 hover:bg-indigo-700 text-white px-6 py-2.5 rounded-md font-medium text-sm transition-colors shadow-sm">{editingEntity ? 'Save Changes' : 'Deploy Database'}</button>
        </div>
      </form>
    </div>
  );
}