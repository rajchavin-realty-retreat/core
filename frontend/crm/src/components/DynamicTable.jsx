import { useState } from 'react';
import api from '../api/axiosConfig';

export default function DynamicTable({ entity, records }) {
  // --- STATE ---
  const [editingRecord, setEditingRecord] = useState(null);
  const [editFormData, setEditFormData] = useState({});
  const [isUpdating, setIsUpdating] = useState(false);
  const [isUploadingFile, setIsUploadingFile] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');

  if (!entity || !records) return null;

  // --- DELETE LOGIC ---
  const handleDelete = async (id) => {
    if (!window.confirm("Permanently delete this record and all associated files?")) return;
    try {
      await api.delete(`/records/${id}`);
      window.location.reload(); 
    } catch (error) {
      alert(`Delete failed: ${error.response?.data?.message || "Error"}`);
    }
  };

  // --- EDIT LOGIC ---
  const handleEditClick = (record) => {
    setEditingRecord(record);
    setEditFormData(record.data || {}); 
  };

  const handleEditChange = (fieldName, value) => {
    setEditFormData(prev => ({ ...prev, [fieldName]: value }));
  };

  // --- SINGLE FILE UPLOAD ---
  const handleFileUpload = async (e, fieldName) => {
    const file = e.target.files[0];
    if (!file) return;

    setIsUploadingFile(true);
    const formData = new FormData();
    formData.append('file', file);


    try {
      const res = await api.post('/upload', formData, {
        headers: { 'Content-Type': 'multipart/form-data' },
      });
      const fileUrl = res.data.url || res.data.secure_url || res.data;
      handleEditChange(fieldName, fileUrl);
    } catch (error) {
      alert("Failed to upload file.");
    } finally {
      setIsUploadingFile(false);
    }
  };

  // --- MULTIPLE FILE UPLOAD ---
  const handleMultiUpload = async (e, fieldName) => {
    const files = Array.from(e.target.files);
    if (!files.length) return;
    setIsUploadingFile(true);
    try {
      const uploadPromises = files.map(file => {
        const formData = new FormData();
        formData.append('file', file);

        return api.post('/upload', formData, { headers: { 'Content-Type': 'multipart/form-data' } });
      });
      const responses = await Promise.all(uploadPromises);
      const newUrls = responses.map(res => res.data.url || res.data.secure_url || res.data);
      setEditFormData(prev => ({
        ...prev,
        [fieldName]: [...(prev[fieldName] || []), ...newUrls]
      }));
    } catch (error) { alert("Upload failed"); } 
    finally { setIsUploadingFile(false); }
  };

  const removeFileFromArray = (fieldName, indexToRemove) => {
    setEditFormData(prev => ({
      ...prev,
      [fieldName]: (prev[fieldName] || []).filter((_, idx) => idx !== indexToRemove)
    }));
  };

  const submitUpdate = async (e) => {
    e.preventDefault();
    setIsUpdating(true);
    try {
      await api.put(`/records/${editingRecord._id}`, { dynamicData: editFormData });
      window.location.reload(); 
    } catch (error) {
      alert(`Update failed: ${error.response?.data?.message || "Error"}`);
    } finally {
      setIsUpdating(false);
    }
  };

  // --- SMART FILTERING ---
  const filteredRecords = records.filter(record => {
    if (!searchTerm) return true; 
    const lowerSearch = searchTerm.toLowerCase();
    const recordValues = Object.values(record.data || {});
    return recordValues.some(val => String(val).toLowerCase().includes(lowerSearch));
  });

  // --- CSV EXPORT LOGIC ---
  const exportToCSV = () => {
    if (filteredRecords.length === 0) return alert("No records to export.");
    const headers = entity.fields.map(f => f.name);
    headers.push('Added By'); 
    
    const csvRows = filteredRecords.map(record => {
      const rowData = entity.fields.map(field => {
        let val = record.data?.[field.name];
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
      
      {/* --- ENTERPRISE DATA TOOLBAR --- */}
      <div className="flex justify-between items-center bg-white p-2.5 rounded-lg border border-zinc-200 shadow-sm">
        <div className="relative flex items-center w-full max-w-sm">
          <svg xmlns="http://www.w3.org/2000/svg" className="absolute left-2.5 h-4 w-4 text-zinc-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
          </svg>
          <input 
            type="text" 
            placeholder="Filter records..." 
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="w-full pl-8 pr-3 py-1.5 text-sm border border-zinc-200 rounded-md outline-none focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500 transition-all bg-zinc-50 focus:bg-white"
          />
          {searchTerm && (
            <span className="ml-3 text-[10px] font-bold text-indigo-600 bg-indigo-50 border border-indigo-100 px-2 py-0.5 rounded-full uppercase tracking-wide whitespace-nowrap hidden sm:inline-block">
              {filteredRecords.length} Found
            </span>
          )}
        </div>

        <button 
          onClick={exportToCSV}
          className="flex items-center gap-1.5 bg-white text-zinc-600 hover:text-zinc-900 hover:bg-zinc-50 border border-zinc-200 py-1.5 px-3 rounded-md text-xs font-semibold transition-colors shadow-sm ml-2 flex-shrink-0"
          title="Download as CSV"
        >
          <svg xmlns="http://www.w3.org/2000/svg" className="h-3.5 w-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
          </svg>
          <span className="hidden sm:inline">Export CSV</span>
        </button>
      </div>

      {/* --- DENSE DATA GRID --- */}
      <div className="bg-white rounded-lg border border-zinc-200 overflow-hidden shadow-sm">
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="bg-zinc-50/80 border-b border-zinc-200">
                {entity.fields.map((field, index) => (
                  <th key={index} className="px-4 py-2 text-[11px] font-semibold text-zinc-500 uppercase tracking-wider whitespace-nowrap">
                    {field.name}
                  </th>
                ))}
                <th className="px-4 py-2 text-[11px] font-semibold text-zinc-500 uppercase tracking-wider whitespace-nowrap">Creator</th>
                <th className="px-4 py-2 text-[11px] font-semibold text-zinc-500 uppercase tracking-wider whitespace-nowrap text-right">Actions</th>
              </tr>
            </thead>
            
            <tbody className="divide-y divide-zinc-100">
              {filteredRecords.length === 0 ? (
                <tr>
                  <td colSpan={entity.fields.length + 2} className="px-4 py-8 text-center text-sm text-zinc-400 italic">
                    {searchTerm ? "No records matched your filter." : "No records found in this database."}
                  </td>
                </tr>
              ) : (
                filteredRecords.map((record) => (
                  <tr key={record._id} className="hover:bg-zinc-50/50 transition-colors group">
                    {entity.fields.map((field, index) => (
                      <td key={index} className="px-4 py-2.5 text-sm text-zinc-700">
                        {/* Checkbox Badge */}
                        {field.type === 'checkbox' && (
                          <span className={`px-2 py-0.5 text-[10px] font-bold rounded border ${record.data?.[field.name] ? 'bg-emerald-50 text-emerald-700 border-emerald-200' : 'bg-zinc-100 text-zinc-500 border-zinc-200'}`}>
                            {record.data?.[field.name] ? 'TRUE' : 'FALSE'}
                          </span>
                        )}

                        {/* Standard Text */}
                        {(field.type === 'text' || field.type === 'textarea' || field.type === 'dropdown' || field.type === 'number') && (
                          <span className="whitespace-pre-wrap truncate max-w-xs block">{record.data?.[field.name] || '-'}</span>
                        )}

                        {/* Date & DateTime */}
                        {field.type === 'date' && <span className="text-zinc-500 whitespace-nowrap">{record.data?.[field.name] ? new Date(record.data[field.name]).toLocaleDateString() : '-'}</span>}
                        {field.type === 'datetime' && <span className="text-zinc-500 whitespace-nowrap">{record.data?.[field.name] ? new Date(record.data[field.name]).toLocaleString([], { dateStyle: 'medium', timeStyle: 'short' }) : '-'}</span>}

                        {/* Media Thumbnail */}
                        {field.type === 'media' && record.data?.[field.name] && (
                          <a href={record.data[field.name]} target="_blank" rel="noreferrer" className="block w-fit">
                             <img src={record.data[field.name]} alt="file" className="h-8 w-8 object-cover rounded border border-zinc-200 shadow-sm opacity-90 hover:opacity-100 transition-opacity" />
                          </a>
                        )}

                        {/* Multi-Media Thumbnail Grid */}
                        {field.type === 'media-multiple' && Array.isArray(record.data?.[field.name]) && (
                          <div className="flex gap-1 flex-wrap max-w-[120px]">
                            {record.data[field.name].map((url, i) => (
                              <a key={i} href={url} target="_blank" rel="noreferrer">
                                <img src={url} alt={`file-${i}`} className="h-6 w-6 object-cover rounded border border-zinc-200 opacity-80 hover:opacity-100" />
                              </a>
                            ))}
                          </div>
                        )}
                      </td>
                    ))}
                    <td className="px-4 py-2.5 text-xs text-zinc-400 whitespace-nowrap">{record.createdBy?.name || 'Unknown'}</td>
                    
                    {/* --- ACTIONS --- */}
                    <td className="px-4 py-2.5 text-right flex justify-end gap-2 opacity-100 sm:group-hover:opacity-100 transition-opacity">
                      <button onClick={() => handleEditClick(record)} className="text-zinc-400 hover:text-indigo-600 transition-colors p-1" title="Edit">
                        <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" /></svg>
                      </button>
                      <button onClick={() => handleDelete(record._id)} className="text-zinc-400 hover:text-red-600 transition-colors p-1" title="Delete">
                        <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" /></svg>
                      </button>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* --- ENTERPRISE EDIT MODAL --- */}
      {editingRecord && (
        <div className="fixed inset-0 bg-zinc-900/40 backdrop-blur-sm flex items-center justify-center z-[60] p-4">
          <div className="bg-white rounded-xl shadow-xl w-full max-w-xl max-h-[90vh] overflow-hidden flex flex-col border border-zinc-200">
            
            <div className="flex justify-between items-center px-6 py-4 border-b border-zinc-100 bg-zinc-50/50">
              <h3 className="text-sm font-semibold text-zinc-900">Edit Record</h3>
              <button onClick={() => setEditingRecord(null)} className="text-zinc-400 hover:text-zinc-600 transition-colors">
                <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" viewBox="0 0 20 20" fill="currentColor"><path fillRule="evenodd" d="M4.293 4.293a1 1 0 011.414 0L10 8.586l4.293-4.293a1 1 0 111.414 1.414L11.414 10l4.293 4.293a1 1 0 01-1.414 1.414L10 11.414l-4.293 4.293a1 1 0 01-1.414-1.414L8.586 10 4.293 5.707a1 1 0 010-1.414z" clipRule="evenodd" /></svg>
              </button>
            </div>

            <form onSubmit={submitUpdate} className="flex-1 overflow-y-auto p-6 flex flex-col gap-5">
              {entity.fields.map((field, idx) => (
                <div key={idx} className="flex flex-col gap-1.5">
                  <label className="text-xs font-semibold text-zinc-500 uppercase tracking-wider">{field.name}</label>
                  
                  {field.type === 'text' && <input type="text" value={editFormData[field.name] || ''} onChange={(e) => handleEditChange(field.name, e.target.value)} className="px-3 py-2 text-sm border border-zinc-200 rounded-md focus:ring-1 focus:ring-indigo-500 outline-none" />}
                  {field.type === 'number' && <input type="number" value={editFormData[field.name] || ''} onChange={(e) => handleEditChange(field.name, e.target.value)} className="px-3 py-2 text-sm border border-zinc-200 rounded-md focus:ring-1 focus:ring-indigo-500 outline-none" />}
                  {field.type === 'textarea' && <textarea value={editFormData[field.name] || ''} onChange={(e) => handleEditChange(field.name, e.target.value)} className="px-3 py-2 text-sm border border-zinc-200 rounded-md focus:ring-1 focus:ring-indigo-500 outline-none min-h-[80px]" />}
                  
                  {/* DATE & DATETIME */}
                  {field.type === 'date' && <input type="date" value={editFormData[field.name] ? editFormData[field.name].split('T')[0] : ''} onChange={(e) => handleEditChange(field.name, e.target.value)} className="px-3 py-2 text-sm border border-zinc-200 rounded-md outline-none focus:ring-1 focus:ring-indigo-500" />}
                  {field.type === 'datetime' && <input type="datetime-local" value={editFormData[field.name] ? new Date(editFormData[field.name]).toISOString().slice(0, 16) : ''} onChange={(e) => handleEditChange(field.name, e.target.value)} className="px-3 py-2 text-sm border border-zinc-200 rounded-md outline-none focus:ring-1 focus:ring-indigo-500" />}
                  
                  {field.type === 'dropdown' && (
                    <select value={editFormData[field.name] || ''} onChange={(e) => handleEditChange(field.name, e.target.value)} className="px-3 py-2 text-sm border border-zinc-200 rounded-md bg-white outline-none focus:ring-1 focus:ring-indigo-500">
                      <option value="">Select option...</option>
                      {(field.options || []).map((opt, i) => <option key={i} value={opt}>{opt}</option>)}
                    </select>
                  )}

                  {field.type === 'checkbox' && (
                    <label className="flex items-center gap-2 cursor-pointer mt-1 w-fit group">
                      <input type="checkbox" checked={editFormData[field.name] || false} onChange={(e) => handleEditChange(field.name, e.target.checked)} className="w-4 h-4 text-indigo-600 border-zinc-300 rounded focus:ring-indigo-500 cursor-pointer" />
                      <span className="text-sm text-zinc-600 group-hover:text-zinc-900 transition-colors">Enabled</span>
                    </label>
                  )}

                  {field.type === 'media' && (
                    <div className="flex flex-col gap-2">
                      {editFormData[field.name] ? (
                        <div className="relative w-20 h-20 border border-zinc-200 rounded-md overflow-hidden group shadow-sm">
                          <img src={editFormData[field.name]} alt="preview" className="w-full h-full object-cover" />
                          <button type="button" onClick={() => handleEditChange(field.name, '')} className="absolute inset-0 bg-zinc-900/60 text-white opacity-0 group-hover:opacity-100 flex items-center justify-center transition-opacity text-xs font-bold backdrop-blur-sm">Clear</button>
                        </div>
                      ) : (
                        <div className="border border-dashed border-zinc-300 rounded-md p-3 hover:bg-zinc-50 hover:border-zinc-400 transition-colors">
                          <input type="file" accept="image/*,application/pdf" onChange={(e) => handleFileUpload(e, field.name)} className="text-xs file:mr-3 file:py-1.5 file:px-3 file:rounded-md file:border-0 file:font-semibold file:bg-indigo-50 file:text-indigo-700 hover:file:bg-indigo-100 cursor-pointer w-full text-zinc-500" />
                        </div>
                      )}
                    </div>
                  )}

                  {/* MULTI-MEDIA UPLOAD */}
                  {field.type === 'media-multiple' && (
                    <div className="flex flex-col gap-3 p-3 border border-zinc-200 rounded-md bg-zinc-50/50">
                      {editFormData[field.name] && editFormData[field.name].length > 0 && (
                        <div className="flex flex-wrap gap-2">
                          {editFormData[field.name].map((url, i) => (
                            <div key={i} className="relative w-16 h-16 border border-zinc-200 rounded overflow-hidden group shadow-sm">
                              <img src={url} alt={`file-${i}`} className="w-full h-full object-cover" />
                              <button type="button" onClick={() => removeFileFromArray(field.name, i)} className="absolute top-0 right-0 bg-red-500 text-white w-5 h-5 flex items-center justify-center text-xs font-bold opacity-0 group-hover:opacity-100 transition-opacity rounded-bl-md">×</button>
                            </div>
                          ))}
                        </div>
                      )}
                      <input type="file" multiple accept="image/*,application/pdf" onChange={(e) => handleMultiUpload(e, field.name)} className="text-xs file:mr-3 file:py-1.5 file:px-3 file:rounded-md file:border-0 file:font-semibold file:bg-indigo-50 file:text-indigo-700 hover:file:bg-indigo-100 cursor-pointer w-full text-zinc-500" />
                    </div>
                  )}
                </div>
              ))}

              <div className="flex gap-2 mt-4 pt-5 border-t border-zinc-100">
                <button type="button" onClick={() => setEditingRecord(null)} className="flex-1 bg-white border border-zinc-200 text-zinc-700 py-2 rounded-md font-medium text-sm hover:bg-zinc-50 transition-colors">Cancel</button>
                <button type="submit" disabled={isUpdating || isUploadingFile} className="flex-1 bg-indigo-600 text-white py-2 rounded-md font-medium text-sm hover:bg-indigo-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed">
                  {isUploadingFile ? 'Uploading...' : isUpdating ? 'Saving...' : 'Save Changes'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}