import { useState } from 'react';
import api from '../api/axiosConfig';

export default function DynamicTable({ entity, records }) {
  // --- STATE ---
  const [editingRecord, setEditingRecord] = useState(null);
  const [editFormData, setEditFormData] = useState({});
  const [isUpdating, setIsUpdating] = useState(false);
  const [isUploadingFile, setIsUploadingFile] = useState(false);
  
  // --- NEW: SEARCH STATE ---
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

  // --- FILE UPLOAD LOGIC ---
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
      alert("Failed to upload file. Check your backend upload route.");
    } finally {
      setIsUploadingFile(false);
    }
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

  // --- NEW: SMART FILTERING LOGIC ---
  // This scans every single custom field for the search term
  const filteredRecords = records.filter(record => {
    if (!searchTerm) return true; // If search is empty, show everything
    
    const lowerSearch = searchTerm.toLowerCase();
    
    // Grab all the actual values from this specific record (e.g., ["John", "john@email.com", "Active"])
    const recordValues = Object.values(record.data || {});
    
    // Check if ANY of those values contain the search term
    return recordValues.some(val => 
      String(val).toLowerCase().includes(lowerSearch)
    );
  });

  // --- CSV EXPORT LOGIC ---
  const exportToCSV = () => {
    if (filteredRecords.length === 0) {
      alert("No records to export.");
      return;
    }

    // 1. Generate Headers
    const headers = entity.fields.map(f => f.name);
    headers.push('Added By'); // Add the creator column
    
    // 2. Generate Rows
    const csvRows = filteredRecords.map(record => {
      const rowData = entity.fields.map(field => {
        let val = record.data?.[field.name];
        
        // Handle arrays (like multi-media) by joining them
        if (Array.isArray(val)) val = val.join(' | ');
        // Handle booleans (checkboxes)
        if (val === true) val = 'Yes';
        if (val === false) val = 'No';
        // Handle null/undefined
        if (val === null || val === undefined) val = '';
        
        // Escape quotes and wrap in quotes to prevent comma breaks in CSV
        const safeString = String(val).replace(/"/g, '""');
        return `"${safeString}"`;
      });
      
      rowData.push(`"${record.createdBy?.name || 'Unknown'}"`);
      return rowData.join(',');
    });

    // 3. Combine into a single CSV string
    const csvContent = [headers.join(','), ...csvRows].join('\n');

    // 4. Trigger the download
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement('a');
    const url = URL.createObjectURL(blob);
    
    link.setAttribute('href', url);
    link.setAttribute('download', `${entity.name.replace(/\s+/g, '_')}_Export.csv`);
    link.style.visibility = 'hidden';
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  return (
    <div className="relative flex flex-col gap-4">
      
      {/* --- TOP BAR: SEARCH & EXPORT --- */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 bg-white p-4 rounded-xl shadow-sm border border-gray-100">
        
        {/* Search Input */}
        <div className="relative w-full max-w-md flex items-center gap-3">
          <div className="relative w-full">
            <svg xmlns="http://www.w3.org/2000/svg" className="absolute left-3 top-1/2 -translate-y-1/2 h-5 w-5 text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
            </svg>
            <input 
              type="text" 
              placeholder={`Search ${records.length} records...`} 
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full pl-10 pr-4 py-2.5 border border-gray-200 rounded-lg outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500 transition-all text-sm bg-gray-50 focus:bg-white"
            />
          </div>
          {searchTerm && (
            <span className="text-xs font-bold text-blue-600 bg-blue-50 px-3 py-1 rounded-full whitespace-nowrap border border-blue-100">
              Found {filteredRecords.length}
            </span>
          )}
        </div>

        {/* Export Button */}
        <button 
          onClick={exportToCSV}
          className="flex items-center gap-2 bg-emerald-50 text-emerald-700 hover:bg-emerald-100 border border-emerald-200 py-2 px-4 rounded-lg text-sm font-bold transition-colors w-full sm:w-auto justify-center shadow-sm"
          title="Download as Spreadsheet"
        >
          <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 10v6m0 0l-3-3m3 3l3-3m2 8H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
          </svg>
          Export CSV
        </button>
      </div>

      <div className="bg-white rounded-xl shadow-sm border border-gray-100 overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="bg-gray-50 border-b border-gray-100">
                {entity.fields.map((field, index) => (
                  <th key={index} className="px-6 py-4 text-sm font-semibold text-gray-700 whitespace-nowrap">
                    {field.name}
                  </th>
                ))}
                <th className="px-6 py-4 text-sm font-semibold text-gray-700 whitespace-nowrap">Added By</th>
                <th className="px-6 py-4 text-sm font-semibold text-gray-700 whitespace-nowrap text-right">Actions</th>
              </tr>
            </thead>
            
            <tbody className="divide-y divide-gray-100">
              {/* Notice we map over filteredRecords instead of records! */}
              {filteredRecords.length === 0 ? (
                <tr>
                  <td colSpan={entity.fields.length + 2} className="px-6 py-8 text-center text-gray-500 italic">
                    {searchTerm ? `No records found matching "${searchTerm}"` : "No records found."}
                  </td>
                </tr>
              ) : (
                filteredRecords.map((record) => (
                  <tr key={record._id} className="hover:bg-gray-50 transition-colors">
                    {entity.fields.map((field, index) => (
                      <td key={index} className="px-6 py-4 text-sm text-gray-800">
                        {field.type === 'checkbox' && (
                          <span className={`px-3 py-1 text-xs font-bold rounded-full ${record.data?.[field.name] ? 'bg-green-100 text-green-700' : 'bg-gray-100 text-gray-500'}`}>
                            {record.data?.[field.name] ? 'Yes' : 'No'}
                          </span>
                        )}
                        {(field.type === 'text' || field.type === 'textarea' || field.type === 'dropdown' || field.type === 'number') && (
                          <span className="whitespace-pre-wrap">{record.data?.[field.name] || '-'}</span>
                        )}
                        {(field.type === 'date' || field.type === 'datetime') && <span>{record.data?.[field.name] ? new Date(record.data[field.name]).toLocaleDateString() : '-'}</span>}
                        {field.type === 'media' && record.data?.[field.name] && (
                          <a href={record.data[field.name]} target="_blank" rel="noreferrer">
                             <img src={record.data[field.name]} alt="media" className="h-10 w-10 object-cover rounded border shadow-sm" />
                          </a>
                        )}
                        {field.type === 'media-multiple' && Array.isArray(record.data?.[field.name]) && (
                          <div className="flex gap-1 flex-wrap max-w-[120px]">
                            {record.data[field.name].map((url, i) => (
                              <a key={i} href={url} target="_blank" rel="noreferrer">
                                <img src={url} alt={`file-${i}`} className="h-8 w-8 object-cover rounded border shadow-sm" />
                              </a>
                            ))}
                          </div>
                        )}
                      </td>
                    ))}
                    <td className="px-6 py-4 text-xs text-gray-500">{record.createdBy?.name || 'Unknown'}</td>
                    <td className="px-6 py-4 text-right flex justify-end gap-3">
                      <button onClick={() => handleEditClick(record)} className="text-blue-400 hover:text-blue-600 transition-colors" title="Edit Record">
                        <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" /></svg>
                      </button>
                      <button onClick={() => handleDelete(record._id)} className="text-red-400 hover:text-red-600 transition-colors" title="Delete Record">
                        <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" /></svg>
                      </button>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* --- THE EDIT MODAL --- */}
      {editingRecord && (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-xl shadow-2xl w-full max-w-2xl max-h-[90vh] overflow-y-auto">
            <div className="flex justify-between items-center p-6 border-b border-gray-100">
              <h3 className="text-xl font-bold text-gray-800">Edit Record</h3>
              <button onClick={() => setEditingRecord(null)} className="text-gray-400 hover:text-gray-600">
                <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" /></svg>
              </button>
            </div>

            <form onSubmit={submitUpdate} className="p-6 flex flex-col gap-5">
              {entity.fields.map((field, idx) => (
                <div key={idx} className="flex flex-col gap-1">
                  <label className="text-sm font-medium text-gray-700">{field.name}</label>
                  {field.type === 'text' && <input type="text" value={editFormData[field.name] || ''} onChange={(e) => handleEditChange(field.name, e.target.value)} className="px-4 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500 outline-none" />}
                  {field.type === 'number' && <input type="number" value={editFormData[field.name] || ''} onChange={(e) => handleEditChange(field.name, e.target.value)} className="px-4 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500 outline-none" />}
                  {field.type === 'textarea' && <textarea value={editFormData[field.name] || ''} onChange={(e) => handleEditChange(field.name, e.target.value)} className="px-4 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500 outline-none min-h-[100px]" />}
                  {field.type === 'date' && <input type="date" value={editFormData[field.name] ? editFormData[field.name].split('T')[0] : ''} onChange={(e) => handleEditChange(field.name, e.target.value)} className="px-4 py-2 border rounded-lg outline-none" />}
                  {field.type === 'dropdown' && (
                    <select value={editFormData[field.name] || ''} onChange={(e) => handleEditChange(field.name, e.target.value)} className="px-4 py-2 border rounded-lg bg-white outline-none">
                      <option value="">Select an option...</option>
                      {(field.options || []).map((opt, i) => <option key={i} value={opt}>{opt}</option>)}
                    </select>
                  )}
                  {field.type === 'checkbox' && (
                    <label className="flex items-center gap-2 cursor-pointer mt-1">
                      <input type="checkbox" checked={editFormData[field.name] || false} onChange={(e) => handleEditChange(field.name, e.target.checked)} className="w-5 h-5 text-blue-600 rounded" />
                      <span className="text-sm text-gray-600">Yes</span>
                    </label>
                  )}
                  {field.type === 'media' && (
                    <div className="flex flex-col gap-2 mt-1">
                      {editFormData[field.name] ? (
                        <div className="relative w-24 h-24 border rounded-lg overflow-hidden group shadow-sm">
                          <img src={editFormData[field.name]} alt="preview" className="w-full h-full object-cover" />
                          <button type="button" onClick={() => handleEditChange(field.name, '')} className="absolute inset-0 bg-red-500/80 text-white opacity-0 group-hover:opacity-100 flex items-center justify-center transition-opacity text-xs font-bold">Remove</button>
                        </div>
                      ) : (
                        <input type="file" accept="image/*,application/pdf" onChange={(e) => handleFileUpload(e, field.name)} className="text-sm file:mr-4 file:py-2 file:px-4 file:rounded-lg file:border-0 file:text-sm file:font-semibold file:bg-blue-50 file:text-blue-700 hover:file:bg-blue-100 cursor-pointer" />
                      )}
                    </div>
                  )}
                  {field.type === 'media-multiple' && <span className="text-xs text-gray-400 italic">Multi-file updates are disabled in this modal.</span>}
                </div>
              ))}

              <div className="flex gap-3 mt-6 pt-6 border-t border-gray-100">
                <button type="button" onClick={() => setEditingRecord(null)} className="flex-1 bg-gray-100 text-gray-700 py-3 rounded-lg font-bold hover:bg-gray-200 transition-colors">Cancel</button>
                <button type="submit" disabled={isUpdating || isUploadingFile} className="flex-1 bg-blue-600 text-white py-3 rounded-lg font-bold hover:bg-blue-700 transition-colors disabled:bg-blue-400">
                  {isUploadingFile ? 'Uploading File...' : isUpdating ? 'Saving...' : 'Save Changes'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}