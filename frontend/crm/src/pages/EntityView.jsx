// frontend/src/EntityView.jsx
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
  const [isModalOpen, setIsModalOpen] = useState(false);

  const fetchEntityData = async () => {
    try {
      const entityRes = await api.get(`/entities/${entityId}`);
      setEntity(entityRes.data);
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

  const handleSuccess = () => {
    setIsModalOpen(false); 
    fetchEntityData();      
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-screen bg-[#FBFBFC]">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-indigo-600"></div>
      </div>
    );
  }

  if (!entity) return <div className="p-8 text-center text-red-500 font-medium">Database not found.</div>;

  return (
    <div className="flex flex-col h-screen bg-[#FBFBFC] text-zinc-900 font-sans overflow-hidden">
      
      <header className="h-14 border-b border-zinc-200 bg-white flex items-center justify-between px-4 sm:px-6 flex-shrink-0 z-10 w-full">
        <div className="flex items-center gap-2 sm:gap-4 min-w-0">
          <button onClick={() => navigate('/')} className="flex items-center gap-1 sm:gap-1.5 text-xs font-semibold text-zinc-500 hover:text-zinc-900 transition-colors uppercase tracking-wider flex-shrink-0">
            <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 19l-7-7m0 0l7-7m-7 7h18" /></svg>
            <span className="hidden sm:inline">Dashboard</span>
          </button>
          <div className="h-4 w-px bg-zinc-300 flex-shrink-0 mx-1 sm:mx-0"></div>
          <h1 className="text-sm font-bold text-zinc-800 flex items-center gap-1.5 sm:gap-2 truncate min-w-0">
            <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4 text-indigo-500 flex-shrink-0 hidden sm:block" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 7v10c0 2.21 3.582 4 8 4s8-1.79 8-4V7M4 7c0 2.21 3.582 4 8 4s8-1.79 8-4M4 7c0-2.21 3.582-4 8-4s8 1.79 8 4m0 5c0 2.21-3.582 4-8 4s-8-1.79-8-4" /></svg>
            <span className="truncate">{entity.name}</span>
          </h1>
        </div>
        
        <button onClick={() => setIsModalOpen(true)} className="bg-indigo-600 text-white text-xs font-medium px-3 sm:px-4 py-1.5 rounded-md hover:bg-indigo-700 transition-colors shadow-sm flex items-center gap-1.5 flex-shrink-0 ml-2">
          <svg xmlns="http://www.w3.org/2000/svg" className="h-3.5 w-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" /></svg>
          <span className="hidden xs:inline sm:inline">New Record</span>
          <span className="inline xs:hidden">Add</span>
        </button>
      </header>

      <main className="flex-1 overflow-auto p-4 sm:p-6 relative">
        <div className="max-w-7xl mx-auto">
          <DynamicTable entity={entity} records={records} />
        </div>
      </main>

      {/* --- CENTERED MODAL TRIGGER --- */}
      {isModalOpen && (
        <DynamicForm 
          entity={entity} 
          onSuccess={handleSuccess}
          onCancel={() => setIsModalOpen(false)}
        />
      )}
    </div>
  );
}