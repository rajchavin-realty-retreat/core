import { useState, useEffect, useMemo } from 'react';
import api from '../api/axiosConfig';

export default function MemberAnalytics({ workspace, member, onBack }) {
  const [stats, setStats] = useState(null);
  const [isLoading, setIsLoading] = useState(true);

  // --- AGGREGATION FILTER STATE ---
  const [availableFields, setAvailableFields] = useState([]);
  const [selectedFields, setSelectedFields] = useState([]);

  useEffect(() => {
    const fetchStats = async () => {
      if (!workspace || !member) return;
      try {
        const res = await api.get(`/workspaces/${workspace._id}/members/${member._id || member.id}/stats`);
        setStats(res.data);

        // 1. Extract all unique numeric/formula fields across all databases
        const uniqueFields = new Set();
        res.data.databaseStats.forEach(db => {
          Object.keys(db.sums).forEach(field => uniqueFields.add(field));
        });
        
        const fieldsArray = Array.from(uniqueFields).sort();
        setAvailableFields(fieldsArray);
        setSelectedFields(fieldsArray); // Default to all included
      } catch (error) {
        console.error("Failed to load member stats", error);
      } finally {
        setIsLoading(false);
      }
    };
    fetchStats();
  }, [workspace, member]);

  // Toggle field inclusion for the Master Sum
  const toggleField = (field) => {
    setSelectedFields(prev => 
      prev.includes(field) ? prev.filter(f => f !== field) : [...prev, field]
    );
  };

  // --- REAL-TIME CALCULATION ENGINE ---
  // Automatically recalculates the total value whenever you check/uncheck a field!
  const dynamicGlobalSum = useMemo(() => {
    if (!stats) return 0;
    return stats.databaseStats.reduce((total, db) => {
      const dbSum = Object.entries(db.sums).reduce((acc, [key, val]) => {
        // Only sum this field if it is currently toggled ON
        return selectedFields.includes(key) ? acc + val : acc;
      }, 0);
      return total + dbSum;
    }, 0);
  }, [stats, selectedFields]);

  if (isLoading) {
    return <div className="flex justify-center items-center h-64"><div className="animate-spin rounded-full h-8 w-8 border-b-2 border-indigo-600"></div></div>;
  }

  if (!stats) return <div className="text-center text-red-500 p-8">Failed to load analytics.</div>;

  return (
    <div className="max-w-6xl mx-auto space-y-6 animate-fade-in">
      {/* HEADER */}
      <div className="flex items-center gap-4 border-b border-zinc-200 pb-4">
        <button onClick={onBack} className="p-2 text-zinc-400 hover:text-zinc-800 hover:bg-zinc-100 rounded-full transition-colors">
          <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" viewBox="0 0 20 20" fill="currentColor"><path fillRule="evenodd" d="M9.707 16.707a1 1 0 01-1.414 0l-6-6a1 1 0 010-1.414l6-6a1 1 0 011.414 1.414L5.414 9H17a1 1 0 110 2H5.414l4.293 4.293a1 1 0 010 1.414z" clipRule="evenodd" /></svg>
        </button>
        <div>
          <h2 className="text-xl font-bold text-zinc-900">{member.name || member.email}'s Overview</h2>
          <p className="text-sm text-zinc-500 mt-1">Cross-database performance analytics.</p>
        </div>
      </div>

      {/* MASTER METRICS */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <div className="bg-white p-6 rounded-xl border border-zinc-200 shadow-sm flex items-center justify-between">
           <div>
             <span className="text-[11px] font-bold text-zinc-400 uppercase tracking-wider">Total Records Added</span>
             <h3 className="text-3xl font-black text-zinc-900 mt-1">{stats.globalRecordCount.toLocaleString()}</h3>
           </div>
           <div className="h-12 w-12 rounded-full bg-indigo-50 flex items-center justify-center text-indigo-600 border border-indigo-100"><svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" /></svg></div>
        </div>
        <div className="bg-white p-6 rounded-xl border border-zinc-200 shadow-sm flex items-center justify-between">
           <div>
             <span className="text-[11px] font-bold text-zinc-400 uppercase tracking-wider">Total Filtered Value</span>
             <h3 className="text-3xl font-black text-emerald-600 mt-1">
               {dynamicGlobalSum > 0 ? dynamicGlobalSum.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 }) : '0.00'}
             </h3>
           </div>
        </div>
      </div>

      {/* DYNAMIC FIELD FILTER ROW */}
      {availableFields.length > 0 && (
        <div className="bg-white p-5 rounded-xl border border-zinc-200 shadow-sm">
          <h3 className="text-sm font-bold text-zinc-900 mb-3">Included in Sum Calculations</h3>
          <div className="flex flex-wrap gap-2">
            {availableFields.map(field => {
              const isActive = selectedFields.includes(field);
              return (
                <button
                  key={field}
                  onClick={() => toggleField(field)}
                  className={`flex items-center gap-2 px-3 py-1.5 rounded-md text-xs font-semibold transition-colors border ${
                    isActive 
                      ? 'bg-emerald-50 border-emerald-200 text-emerald-700 hover:bg-emerald-100' 
                      : 'bg-zinc-50 border-zinc-200 text-zinc-500 hover:bg-zinc-100'
                  }`}
                >
                  <div className={`w-3.5 h-3.5 rounded-sm flex items-center justify-center border ${isActive ? 'bg-emerald-500 border-emerald-500' : 'border-zinc-300 bg-white'}`}>
                    {isActive && <svg className="w-2.5 h-2.5 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={3}><path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" /></svg>}
                  </div>
                  {field}
                </button>
              );
            })}
          </div>
        </div>
      )}

      {/* BREAKDOWN BY DATABASE */}
      <div className="pt-4 border-t border-zinc-200">
        <h3 className="text-sm font-bold text-zinc-900 mb-4">Breakdown by Database</h3>
        
        {stats.databaseStats.length === 0 ? (
          <div className="text-center py-12 border-2 border-dashed border-zinc-200 rounded-xl text-zinc-500 text-sm">
             This user has not added any records to this workspace yet.
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {stats.databaseStats.map((db, i) => {
              // Filter this specific database's sums to only show what is checked
              const activeSums = Object.entries(db.sums).filter(([key]) => selectedFields.includes(key));
              
              return (
                <div key={i} className="bg-white rounded-xl border border-zinc-200 shadow-sm overflow-hidden flex flex-col">
                  <div className="bg-zinc-50 px-5 py-3 border-b border-zinc-200 flex justify-between items-center">
                    <h4 className="font-semibold text-sm text-zinc-900">{db.name}</h4>
                    <span className="bg-white border border-zinc-200 text-[10px] font-bold px-2 py-0.5 rounded-full text-zinc-600">{db.recordCount} entries</span>
                  </div>
                  <div className="p-5 flex-1 flex flex-col gap-3">
                    {activeSums.length === 0 ? (
                      <span className="text-xs text-zinc-400 italic">No selected fields to calculate.</span>
                    ) : (
                      activeSums.map(([fieldName, totalVal], idx) => (
                        <div key={idx} className="flex justify-between items-end border-b border-zinc-100 pb-2 last:border-0 last:pb-0">
                          <span className="text-xs text-zinc-500 font-medium">{fieldName}</span>
                          <span className="text-sm font-bold text-zinc-800">
                            {totalVal.toLocaleString(undefined, { minimumFractionDigits: 0, maximumFractionDigits: 2 })}
                          </span>
                        </div>
                      ))
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}