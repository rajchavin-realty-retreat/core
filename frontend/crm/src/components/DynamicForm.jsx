import { useState, useEffect } from 'react';
import api from '../api/axiosConfig';

export default function DynamicForm({ entity, onSuccess }) {
  const [formData, setFormData] = useState({});
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isUploadingFile, setIsUploadingFile] = useState(false);
  
  // NEW: State to hold the records of linked databases
  const [relationData, setRelationData] = useState({});

  // --- FETCH RELATIONAL DATA ---
  // When the form opens, scan the schema for 'relation' fields and fetch their target data
  useEffect(() => {
    const fetchRelations = async () => {
      const relationFields = entity.fields.filter(f => f.type === 'relation' && f.targetEntity);
      if (relationFields.length === 0) return;

      const newRelationData = {};
      for (let field of relationFields) {
        try {
          const res = await api.get(`/records/entity/${field.targetEntity}`);
          newRelationData[field.name] = res.data;
        } catch (error) {
          console.error(`Failed to fetch records for relation: ${field.name}`);
        }
      }
      setRelationData(newRelationData);
    };

    if (entity && entity.fields) {
      fetchRelations();
    }
  }, [entity]);

  // Helper function to figure out what to display for a dynamic record
  // (Since we don't know if the user named their column "Full Name", "Title", or "Company")
  const getDisplayValue = (record) => {
    if (!record || !record.data) return 'Unknown Record';
    const keys = Object.keys(record.data);
    if (keys.length === 0) return 'Empty Record';
    // Return the value of the first column in their database
    return record.data[keys[0]] || 'Unnamed Record'; 
  };

  // --- STANDARD INPUT HANDLER ---
  const handleInputChange = (fieldName, value) => {
    setFormData(prev => ({ ...prev, [fieldName]: value }));
  };

  // --- SINGLE FILE UPLOAD ---
  const handleSingleUpload = async (e, fieldName) => {
    const file = e.target.files[0];
    if (!file) return;

    setIsUploadingFile(true);
    const uploadData = new FormData();
    uploadData.append('file', file);
    uploadData.append('workspaceId', entity.workspace || entity.workspaceId);

    try {
      const res = await api.post('/upload', uploadData, {
        headers: { 'Content-Type': 'multipart/form-data' },
      });
      const fileUrl = res.data.url || res.data.secure_url || res.data;
      handleInputChange(fieldName, fileUrl);
    } catch (error) {
      alert("Failed to upload file.");
    } finally {
      setIsUploadingFile(false);
    }
  };

  // --- MULTIPLE FILE UPLOAD (PROMISE.ALL) ---
  const handleMultiUpload = async (e, fieldName) => {
    const files = Array.from(e.target.files);
    if (files.length === 0) return;

    setIsUploadingFile(true);
    
    try {
      const uploadPromises = files.map(file => {
        const uploadData = new FormData();
        uploadData.append('file', file);
        uploadData.append('workspaceId', entity.workspace || entity.workspaceId);
        return api.post('/upload', uploadData, {
          headers: { 'Content-Type': 'multipart/form-data' },
        });
      });

      const responses = await Promise.all(uploadPromises);
      const newUrls = responses.map(res => res.data.url || res.data.secure_url || res.data);
      
      setFormData(prev => {
        const existingArray = prev[fieldName] || [];
        return { ...prev, [fieldName]: [...existingArray, ...newUrls] };
      });
    } catch (error) {
      alert("Failed to upload one or more files.");
    } finally {
      setIsUploadingFile(false);
    }
  };

  const removeFileFromArray = (fieldName, indexToRemove) => {
    setFormData(prev => {
      const currentArray = prev[fieldName] || [];
      return {
        ...prev,
        [fieldName]: currentArray.filter((_, idx) => idx !== indexToRemove)
      };
    });
  };

  // --- SUBMIT RECORD ---
  const handleCreateRecord = async (e) => {
    e.preventDefault();
    setIsSubmitting(true);
    try {
      await api.post('/records', {
        entityId: entity._id,
        dynamicData: formData
      });
      setFormData({});
      if (onSuccess) onSuccess(); // Closes drawer & refreshes table
    } catch (error) {
      alert(error.response?.data?.message || 'Failed to create record');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <form onSubmit={handleCreateRecord} className="flex flex-col gap-5 h-full">
      {entity.fields.map((field, idx) => (
        <div key={idx} className="flex flex-col gap-1.5">
          <label className="text-xs font-semibold text-zinc-500 uppercase tracking-wider">{field.name}</label>
          
          {field.type === 'text' && <input type="text" value={formData[field.name] || ''} onChange={(e) => handleInputChange(field.name, e.target.value)} required className="px-3 py-2 text-sm border border-zinc-200 rounded-md focus:ring-1 focus:ring-indigo-500 outline-none" />}
          {field.type === 'number' && <input type="number" value={formData[field.name] || ''} onChange={(e) => handleInputChange(field.name, e.target.value)} required className="px-3 py-2 text-sm border border-zinc-200 rounded-md focus:ring-1 focus:ring-indigo-500 outline-none" />}
          {field.type === 'textarea' && <textarea value={formData[field.name] || ''} onChange={(e) => handleInputChange(field.name, e.target.value)} className="px-3 py-2 text-sm border border-zinc-200 rounded-md focus:ring-1 focus:ring-indigo-500 outline-none min-h-[100px]" />}
          {field.type === 'date' && <input type="date" value={formData[field.name] || ''} onChange={(e) => handleInputChange(field.name, e.target.value)} className="px-3 py-2 text-sm border border-zinc-200 rounded-md outline-none focus:ring-1 focus:ring-indigo-500" />}
          {field.type === 'datetime' && <input type="datetime-local" value={formData[field.name] || ''} onChange={(e) => handleInputChange(field.name, e.target.value)} className="px-3 py-2 text-sm border border-zinc-200 rounded-md outline-none focus:ring-1 focus:ring-indigo-500" />}
          
          {field.type === 'dropdown' && (
            <select value={formData[field.name] || ''} onChange={(e) => handleInputChange(field.name, e.target.value)} className="px-3 py-2 text-sm border border-zinc-200 rounded-md bg-white outline-none focus:ring-1 focus:ring-indigo-500">
              <option value="">Select option...</option>
              {(field.options || []).map((opt, i) => <option key={i} value={opt}>{opt}</option>)}
            </select>
          )}

          {/* THE NEW RELATION DROPDOWN */}
          {field.type === 'relation' && (
            <select 
              value={formData[field.name] || ''} 
              onChange={(e) => handleInputChange(field.name, e.target.value)} 
              className="px-3 py-2 text-sm border border-indigo-200 rounded-md bg-indigo-50/30 outline-none focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500 font-medium text-indigo-900"
            >
              <option value="">Link to {field.name}...</option>
              {(relationData[field.name] || []).map(record => (
                <option key={record._id} value={record._id}>
                  {getDisplayValue(record)}
                </option>
              ))}
            </select>
          )}

          {field.type === 'checkbox' && (
            <label className="flex items-center gap-2 cursor-pointer mt-1 w-fit group">
              <input type="checkbox" checked={formData[field.name] || false} onChange={(e) => handleInputChange(field.name, e.target.checked)} className="w-4 h-4 text-indigo-600 border-zinc-300 rounded focus:ring-indigo-500 cursor-pointer" />
              <span className="text-sm text-zinc-600 group-hover:text-zinc-900 transition-colors">Enabled</span>
            </label>
          )}

          {field.type === 'media' && (
            <div className="flex flex-col gap-2">
              {formData[field.name] ? (
                <div className="relative w-20 h-20 border border-zinc-200 rounded-md overflow-hidden group shadow-sm">
                  <img src={formData[field.name]} alt="preview" className="w-full h-full object-cover" />
                  <button type="button" onClick={() => handleInputChange(field.name, '')} className="absolute inset-0 bg-zinc-900/60 text-white opacity-0 group-hover:opacity-100 flex items-center justify-center transition-opacity text-xs font-bold backdrop-blur-sm">Clear</button>
                </div>
              ) : (
                <div className="border border-dashed border-zinc-300 rounded-md p-3 hover:bg-zinc-50 transition-colors">
                  <input type="file" accept="image/*,application/pdf" onChange={(e) => handleSingleUpload(e, field.name)} className="text-xs file:mr-3 file:py-1.5 file:px-3 file:rounded-md file:border-0 file:font-semibold file:bg-indigo-50 file:text-indigo-700 hover:file:bg-indigo-100 cursor-pointer w-full text-zinc-500" />
                </div>
              )}
            </div>
          )}

          {field.type === 'media-multiple' && (
            <div className="flex flex-col gap-3 p-3 border border-zinc-200 rounded-md bg-zinc-50/50">
              {formData[field.name] && formData[field.name].length > 0 && (
                <div className="flex flex-wrap gap-2">
                  {formData[field.name].map((url, i) => (
                    <div key={i} className="relative w-16 h-16 border border-zinc-200 rounded overflow-hidden group shadow-sm">
                      <img src={url} alt={`file-${i}`} className="w-full h-full object-cover" />
                      <button type="button" onClick={() => removeFileFromArray(field.name, i)} className="absolute top-0 right-0 bg-red-500 text-white w-5 h-5 flex items-center justify-center text-xs font-bold opacity-0 group-hover:opacity-100 transition-opacity rounded-bl-md">×</button>
                    </div>
                  ))}
                </div>
              )}
              <input 
                type="file" 
                multiple 
                accept="image/*,application/pdf" 
                onChange={(e) => handleMultiUpload(e, field.name)} 
                className="text-xs file:mr-3 file:py-1.5 file:px-3 file:rounded-md file:border-0 file:font-semibold file:bg-indigo-50 file:text-indigo-700 hover:file:bg-indigo-100 cursor-pointer w-full text-zinc-500" 
              />
            </div>
          )}
        </div>
      ))}

      <div className="mt-auto pt-6 border-t border-zinc-100 flex flex-col">
        <button type="submit" disabled={isSubmitting || isUploadingFile} className="w-full bg-indigo-600 text-white py-2.5 rounded-md font-medium text-sm hover:bg-indigo-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed shadow-sm">
          {isUploadingFile ? 'Uploading files...' : isSubmitting ? 'Saving...' : 'Create Record'}
        </button>
      </div>
    </form>
  );
}