// frontend/src/pages/EntityView.jsx
import { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import api from '../api/axiosConfig';
import DynamicForm from '../components/DynamicForm';
import DynamicTable from '../components/DynamicTable';

export default function EntityView() {
  const { entityId } = useParams();
  const navigate = useNavigate();
  const [entity, setEntity] = useState(null);
  const [records, setRecords] = useState([]);
  const [isLoading, setIsLoading] = useState(true);

  const fetchEntityData = async () => {
    try {
      // 1. Fetch the Schema (What columns exist?)
      const entityRes = await api.get(`/entities/${entityId}`);
      setEntity(entityRes.data);

      // 2. Fetch the Data (What rows exist?)
      const recordsRes = await api.get(`/records/entity/${entityId}`);
      setRecords(recordsRes.data);
    } catch (error) {
      console.error('Error fetching data:', error);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchEntityData();
  }, [entityId]);

  if (isLoading) return <div className="p-8 text-center text-gray-500">Loading your CRM...</div>;
  if (!entity) return <div className="p-8 text-center text-red-500">Entity not found.</div>;

  return (
    <div className="min-h-screen p-8 max-w-6xl mx-auto font-sans bg-gray-50">
      
      <button 
        onClick={() => navigate('/')} 
        className="mb-6 text-blue-600 hover:underline flex items-center gap-2 font-medium"
      >
        ← Back to Workspaces
      </button>

      <header className="mb-8">
        <h1 className="text-3xl font-bold text-gray-800">{entity.name} Database</h1>
        <p className="text-gray-500 mt-1">Manage your custom records and media below.</p>
      </header>

      <div className="grid grid-cols-1 lg:grid-cols-4 gap-8">
        
        {/* Left Column: The Form */}
        <div className="lg:col-span-1">
          {/* Passing the fetch function as onSuccess so the table updates immediately */}
          <DynamicForm entity={entity} onSuccess={fetchEntityData} />
        </div>

        {/* Right Column: The Data Table */}
        <div className="lg:col-span-3">
          <DynamicTable entity={entity} records={records} />
        </div>

      </div>
    </div>
  );
}