// frontend/src/EntityView.jsx
import { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import api from '../api/axiosConfig';
import DynamicForm from '../components/DynamicForm';
import DynamicTable from '../components/DynamicTable';

export default function EntityView() {
  const { entityId } = useParams();
  const navigate = useNavigate();
  
  // --- STATE ---
  const [entity, setEntity] = useState(null);
  const [records, setRecords] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  
  // --- ENTERPRISE UI STATE ---
  const [isDrawerOpen, setIsDrawerOpen] = useState(false);

  const fetchEntityData = async () => {
    try {
      // 1. Fetch the Schema (Look up the specific Database directly)
      const entityRes = await api.get(`/entities/${entityId}`);
      setEntity(entityRes.data);

      // 2. Fetch the Data (Get all records belonging to this Database)
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

  // Wrapper function to handle successful form submissions
  const handleSuccess = () => {
    setIsDrawerOpen(false); // Close the drawer
    fetchEntityData();      // Refresh the table data
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
      
      {/* --- RESPONSIVE ENTERPRISE HEADER --- */}
      <header className="h-14 border-b border-zinc-200 bg-white flex items-center justify-between px-4 sm:px-6 flex-shrink-0 z-10 w-full">
        
        <div className="flex items-center gap-2 sm:gap-4 min-w-0">
          <button 
            onClick={() => navigate('/')} 
            className="flex items-center gap-1 sm:gap-1.5 text-xs font-semibold text-zinc-500 hover:text-zinc-900 transition-colors uppercase tracking-wider flex-shrink-0"
            title="Back to Dashboard"
          >
            <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 19l-7-7m0 0l7-7m-7 7h18" /></svg>
            <span className="hidden sm:inline">Dashboard</span>
          </button>
          
          <div className="h-4 w-px bg-zinc-300 flex-shrink-0 mx-1 sm:mx-0"></div>
          
          <h1 className="text-sm font-bold text-zinc-800 flex items-center gap-1.5 sm:gap-2 truncate min-w-0">
            <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4 text-indigo-500 flex-shrink-0 hidden sm:block" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 7v10c0 2.21 3.582 4 8 4s8-1.79 8-4V7M4 7c0 2.21 3.582 4 8 4s8-1.79 8-4M4 7c0-2.21 3.582-4 8-4s8 1.79 8 4m0 5c0 2.21-3.582 4-8 4s-8-1.79-8-4" /></svg>
            <span className="truncate">{entity.name}</span>
          </h1>
        </div>
        
        <button 
          onClick={() => setIsDrawerOpen(true)}
          className="bg-indigo-600 text-white text-xs font-medium px-3 sm:px-4 py-1.5 rounded-md hover:bg-indigo-700 transition-colors shadow-sm flex items-center gap-1.5 flex-shrink-0 ml-2"
        >
          <svg xmlns="http://www.w3.org/2000/svg" className="h-3.5 w-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" /></svg>
          <span className="hidden xs:inline sm:inline">New Record</span>
          <span className="inline xs:hidden">Add</span>
        </button>
      </header>

      {/* --- MAIN DATA AREA --- */}
      <main className="flex-1 overflow-auto p-4 sm:p-6 relative">
        <div className="max-w-7xl mx-auto">
          <DynamicTable entity={entity} records={records} />
        </div>
      </main>

      {/* --- RESPONSIVE SLIDE-OUT DRAWER --- */}
      {isDrawerOpen && (
        <>
          {/* Backdrop */}
          <div 
            className="fixed inset-0 bg-zinc-900/40 backdrop-blur-sm z-40 transition-opacity"
            onClick={() => setIsDrawerOpen(false)}
          ></div>
          
          {/* Drawer Panel: 100% width on mobile, max-w-md on desktop */}
          <div className="fixed inset-y-0 right-0 w-full max-w-md bg-white shadow-2xl border-l border-zinc-200 z-50 flex flex-col transform transition-transform duration-300 ease-in-out">
            
            {/* Drawer Header */}
            <div className="flex justify-between items-center px-4 sm:px-6 py-4 border-b border-zinc-100 bg-zinc-50/50 flex-shrink-0">
              <h2 className="text-sm font-semibold text-zinc-900 truncate pr-4">New {entity.name}</h2>
              <button onClick={() => setIsDrawerOpen(false)} className="text-zinc-400 hover:text-zinc-600 transition-colors p-1 bg-white rounded-md border border-zinc-200 shadow-sm sm:border-none sm:bg-transparent sm:shadow-none">
                <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" viewBox="0 0 20 20" fill="currentColor"><path fillRule="evenodd" d="M4.293 4.293a1 1 0 011.414 0L10 8.586l4.293-4.293a1 1 0 111.414 1.414L11.414 10l4.293 4.293a1 1 0 01-1.414 1.414L10 11.414l-4.293 4.293a1 1 0 01-1.414-1.414L8.586 10 4.293 5.707a1 1 0 010-1.414z" clipRule="evenodd" /></svg>
              </button>
            </div>

            {/* Drawer Body (Form Container) */}
            <div className="flex-1 overflow-y-auto p-4 sm:p-6 bg-white">
              <DynamicForm 
                entity={entity} 
                onSuccess={handleSuccess} 
              />
            </div>
            
          </div>
        </>
      )}
    </div>
  );
}