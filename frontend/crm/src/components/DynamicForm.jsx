import { useState, useRef } from 'react';
import api from '../api/axiosConfig';

export default function DynamicForm({ entity, onSuccess }) {
  const [formData, setFormData] = useState({});
  const [fileData, setFileData] = useState({}); // New state specifically for tracking files
  const [isSubmitting, setIsSubmitting] = useState(false);
  const formRef = useRef(null); // Ref to reset the whole form

  const handleInputChange = (e) => {
    const { name, value, type, checked } = e.target;
    // Checkboxes use 'checked' instead of 'value'
    setFormData({ ...formData, [name]: type === 'checkbox' ? checked : value });
  };

  const handleFileChange = (e, fieldName, isMultiple) => {
    if (isMultiple) {
      setFileData({ ...fileData, [fieldName]: Array.from(e.target.files) });
    } else {
      setFileData({ ...fileData, [fieldName]: e.target.files[0] });
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setIsSubmitting(true);

    try {
      const submitData = new FormData();
      submitData.append('entityId', entity._id);
      submitData.append('dynamicData', JSON.stringify(formData));
      
      // Append all our files exactly under their custom column names
      Object.keys(fileData).forEach(key => {
        const fileOrArray = fileData[key];
        if (Array.isArray(fileOrArray)) {
          fileOrArray.forEach(f => submitData.append(key, f)); // Append multiple to same key
        } else {
          submitData.append(key, fileOrArray); // Append single
        }
      });

      await api.post('/records', submitData);

      setFormData({});
      setFileData({});
      if (formRef.current) formRef.current.reset(); // Physically wipes the UI cleanly
      if (onSuccess) onSuccess(); 
    } catch (error) {
      alert('Failed to save record.');
      console.error(error);
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <form ref={formRef} onSubmit={handleSubmit} className="flex flex-col gap-4 bg-white p-6 rounded-xl shadow-sm border border-gray-100">
      <h2 className="text-xl font-bold text-gray-800 mb-4">Add New {entity.name}</h2>
      
      {entity.fields.map((field, index) => (
        <div key={index} className="flex flex-col">
          <label className="text-sm font-medium text-gray-700 mb-1 flex items-center gap-2">
            {field.name}
          </label>
          
          {field.type === 'text' && (
            <input type="text" name={field.name} onChange={handleInputChange} value={formData[field.name] || ''} required className="px-4 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500" />
          )}

          {field.type === 'textarea' && (
            <textarea name={field.name} onChange={handleInputChange} value={formData[field.name] || ''} required className="px-4 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500 min-h-[100px]" />
          )}

          {field.type === 'number' && (
            <input type="number" name={field.name} onChange={handleInputChange} value={formData[field.name] || ''} required className="px-4 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500" />
          )}

          {field.type === 'date' && (
            <input type="date" name={field.name} onChange={handleInputChange} value={formData[field.name] || ''} required className="px-4 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500" />
          )}

          {field.type === 'datetime' && (
            <input type="datetime-local" name={field.name} onChange={handleInputChange} value={formData[field.name] || ''} required className="px-4 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500" />
          )}

          {field.type === 'dropdown' && (
            <select name={field.name} onChange={handleInputChange} value={formData[field.name] || ''} required className="px-4 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500 bg-white">
              <option value="" disabled>Select an option...</option>
              {field.options?.map((opt, i) => <option key={i} value={opt}>{opt}</option>)}
            </select>
          )}

          {field.type === 'checkbox' && (
            <div className="flex items-center mt-2">
              <input type="checkbox" name={field.name} onChange={handleInputChange} checked={formData[field.name] || false} className="w-5 h-5 text-blue-600 rounded focus:ring-blue-500" />
              <span className="ml-2 text-sm text-gray-600">Yes</span>
            </div>
          )}

          {field.type === 'media' && (
            <input type="file" accept="image/*,.pdf" onChange={(e) => handleFileChange(e, field.name, false)} required className="px-4 py-2 border rounded-lg bg-gray-50 text-sm" />
          )}

          {field.type === 'media-multiple' && (
            <input type="file" multiple accept="image/*,.pdf" onChange={(e) => handleFileChange(e, field.name, true)} required className="px-4 py-2 border rounded-lg bg-blue-50 border-blue-200 text-sm text-blue-800" />
          )}
        </div>
      ))}

      <button type="submit" disabled={isSubmitting} className="mt-4 bg-blue-600 hover:bg-blue-700 disabled:bg-blue-400 text-white font-medium py-2 px-4 rounded-lg transition-colors">
        {isSubmitting ? 'Uploading Data...' : 'Save Record'}
      </button>
    </form>
  );
}