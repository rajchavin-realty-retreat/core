import { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import api from './api/axiosConfig';

export default function RecordView() {
  const { entityId, recordId } = useParams();
  const navigate = useNavigate();

  // --- STATE ---
  const [mainEntity, setMainEntity] = useState(null);
  const [mainRecord, setMainRecord] = useState(null);
  const [relatedActivity, setRelatedActivity] = useState([]);
  const [relationData, setRelationData] = useState({}); // <-- NEW: The Master Dictionary
  const [isLoading, setIsLoading] = useState(true);
  const [sortOrder, setSortOrder] = useState('desc'); 

  // --- DATA FETCHING ---
  useEffect(() => {
    const fetchFullProfile = async () => {
      try {
        // 1. Fetch Main Entity Schema & Record Data
        const entityRes = await api.get(`/entities/${entityId}`);
        setMainEntity(entityRes.data);

        const recordRes = await api.get(`/records/entity/${entityId}`);
        const exactRecord = recordRes.data.find(r => r._id === recordId);
        setMainRecord(exactRecord);

        const workspaceId = entityRes.data.workspace || entityRes.data.workspaceId;

        // --- THE MASTER DICTIONARY ENGINE ---
        // We load the target database into memory mapped by its ID
        const masterDict = {};
        const loadDictionary = async (targetId) => {
          if (!targetId || masterDict[targetId]) return; // Skip if already loaded
          try {
            const res = await api.get(`/records/entity/${targetId}`);
            masterDict[targetId] = res.data;
          } catch (e) { console.error("Dictionary load failed"); }
        };

        // Load dictionaries for the Main Entity's relations
        for (let field of entityRes.data.fields) {
          if (field.type === 'relation') await loadDictionary(field.targetEntity);
        }

        // 2. Fetch Reverse Linked Activity (What points to this record?)
        const allEntitiesRes = await api.get(`/entities/workspace/${workspaceId}`);
        
        const linkedEntities = allEntitiesRes.data.filter(e => 
          e.fields.some(f => f.type === 'relation' && f.targetEntity === entityId)
        );

        const activityData = [];
        for (let linkedEnt of linkedEntities) {
          const linkField = linkedEnt.fields.find(f => f.type === 'relation' && f.targetEntity === entityId).name;
          const linkedRecordsRes = await api.get(`/records/entity/${linkedEnt._id}`);
          
          const matches = linkedRecordsRes.data.filter(r => r.data && r.data[linkField] === recordId);
          if (matches.length > 0) {
            activityData.push({ entitySchema: linkedEnt, records: matches });
            
            // Crucial: Load dictionaries for the sub-record relations too!
            for (let field of linkedEnt.fields) {
               if (field.type === 'relation') await loadDictionary(field.targetEntity);
            }
          }
        }

        setRelationData(masterDict);
        setRelatedActivity(activityData);
      } catch (error) {
        console.error("Failed to load record profile", error);
      } finally {
        setIsLoading(false);
      }
    };
    fetchFullProfile();
  }, [entityId, recordId]);

  // --- SMART FIELD RENDERER ---
  // Notice it now accepts the entire 'field' object so it has access to the targetEntity ID
  const renderFieldValue = (value, field) => {
    if (value === null || value === undefined || value === '') return <span className="text-zinc-400 italic">Empty</span>;

    switch (field.type) {
      case 'media':
        return (
          <a href={value} target="_blank" rel="noreferrer" className="block w-fit mt-1">
            <img src={value} alt="Attachment" className="h-16 w-16 object-cover rounded-md border border-zinc-200 shadow-sm hover:opacity-80 transition-opacity" />
          </a>
        );
      case 'media-multiple':
        if (!Array.isArray(value)) return null;
        return (
          <div className="flex gap-2 flex-wrap mt-1">
            {value.map((url, i) => (
              <a key={i} href={url} target="_blank" rel="noreferrer">
                <img src={url} alt={`Gallery-${i}`} className="h-12 w-12 object-cover rounded-md border border-zinc-200 shadow-sm hover:opacity-80 transition-opacity" />
              </a>
            ))}
          </div>
        );
      case 'checkbox':
        return (
          <span className={`inline-block mt-1 px-2 py-0.5 text-[10px] font-bold rounded border ${value ? 'bg-emerald-50 text-emerald-700 border-emerald-200' : 'bg-zinc-100 text-zinc-500 border-zinc-200'}`}>
            {value ? 'TRUE' : 'FALSE'}
          </span>
        );
      case 'date':
        return <span className="text-zinc-800">{new Date(value).toLocaleDateString()}</span>;
      case 'datetime':
        return <span className="text-zinc-800">{new Date(value).toLocaleString([], { dateStyle: 'medium', timeStyle: 'short' })}</span>;
      
      case 'relation':
        let displayVal = `ID: ${String(value).slice(-4)}`;
        // We now safely pull the target dictionary using the field's targetEntity
        const targetRecords = relationData[field.targetEntity];
        if (targetRecords) {
          const match = targetRecords.find(r => r._id === value);
          if (match && match.data) {
            const keys = Object.keys(match.data);
            if (keys.length > 0) displayVal = match.data[keys[0]];
          }
        }
        return (
          <button 
            onClick={() => navigate(`/crm/${field.targetEntity}/record/${value}`)}
            className="inline-flex items-center gap-1.5 px-2.5 py-1 mt-1 rounded border border-indigo-100 bg-indigo-50 text-indigo-700 hover:bg-indigo-100 transition-colors text-xs font-semibold whitespace-nowrap cursor-pointer shadow-sm"
          >
            <svg xmlns="http://www.w3.org/2000/svg" className="h-3.5 w-3.5" viewBox="0 0 20 20" fill="currentColor"><path fillRule="evenodd" d="M12.586 4.586a2 2 0 112.828 2.828l-3 3a2 2 0 01-2.828 0 1 1 0 00-1.414 1.414 4 4 0 005.656 0l3-3a4 4 0 00-5.656-5.656l-1.5 1.5a1 1 0 101.414 1.414l1.5-1.5zm-5 5a2 2 0 012.828 0 1 1 0 101.414-1.414 4 4 0 00-5.656 0l-3 3a4 4 0 105.656 5.656l1.5-1.5a1 1 0 10-1.414-1.414l-1.5 1.5a2 2 0 11-2.828-2.828l3-3z" clipRule="evenodd" /></svg>
            {displayVal}
          </button>
        );

      default:
        return <span className="text-zinc-800 whitespace-pre-wrap">{String(value)}</span>;
    }
  };

  if (isLoading) return <div className="h-screen flex items-center justify-center bg-[#FBFBFC]"><div className="animate-spin rounded-full h-8 w-8 border-b-2 border-indigo-600"></div></div>;
  if (!mainRecord) return <div className="p-8 text-center text-red-500 font-medium">Record not found.</div>;

  const displayTitle = mainRecord.data[mainEntity.fields[0]?.name] || 'Unnamed Record';

  return (
    <div className="min-h-screen bg-[#FBFBFC] font-sans flex flex-col">
      <header className="h-14 border-b border-zinc-200 bg-white flex items-center px-6 shrink-0 sticky top-0 z-10">
        <div className="flex items-center gap-2 text-sm font-medium">
          <button onClick={() => navigate(-1)} className="text-zinc-400 hover:text-zinc-800 transition-colors">
             <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" viewBox="0 0 20 20" fill="currentColor"><path fillRule="evenodd" d="M9.707 16.707a1 1 0 01-1.414 0l-6-6a1 1 0 010-1.414l6-6a1 1 0 011.414 1.414L5.414 9H17a1 1 0 110 2H5.414l4.293 4.293a1 1 0 010 1.414z" clipRule="evenodd" /></svg>
          </button>
          <span className="text-zinc-400 mx-2">/</span>
          <button onClick={() => navigate(`/crm/${entityId}`)} className="text-indigo-600 hover:underline">{mainEntity.name}</button>
          <span className="text-zinc-400 mx-2">/</span>
          <span className="text-zinc-800 truncate max-w-[200px]">{displayTitle}</span>
        </div>
      </header>

      <main className="flex-1 max-w-7xl w-full mx-auto p-6 grid grid-cols-1 lg:grid-cols-3 gap-8 items-start">
        
        <div className="lg:col-span-1 space-y-6">
          <div className="bg-white rounded-xl border border-zinc-200 shadow-sm overflow-hidden">
            <div className="bg-zinc-50 border-b border-zinc-100 px-5 py-4">
              <h2 className="text-lg font-bold text-zinc-900 truncate">{displayTitle}</h2>
              <p className="text-xs text-zinc-500 mt-1">Record Profile • Added {new Date(mainRecord.createdAt).toLocaleDateString()}</p>
            </div>
            <div className="p-5 flex flex-col gap-4">
              {mainEntity.fields.map((field, idx) => (
                <div key={idx} className="flex flex-col gap-1">
                  <span className="text-[11px] font-bold text-zinc-400 uppercase tracking-wider">{field.name}</span>
                  <div className="text-sm">
                    {/* Notice we pass the entire field object here! */}
                    {renderFieldValue(mainRecord.data[field.name], field)}
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>

        <div className="lg:col-span-2 space-y-6">
          <div className="flex justify-between items-end border-b border-zinc-200 pb-4">
            <div>
              <h3 className="text-xl font-bold text-zinc-900">Related Activity</h3>
              <p className="text-sm text-zinc-500 mt-1">All database records linked to this profile.</p>
            </div>
            {relatedActivity.length > 0 && (
              <select value={sortOrder} onChange={(e) => setSortOrder(e.target.value)} className="bg-white border border-zinc-200 text-zinc-700 text-sm rounded-md px-3 py-1.5 outline-none focus:border-indigo-500 shadow-sm cursor-pointer">
                <option value="desc">Sort by: Newest First</option>
                <option value="asc">Sort by: Oldest First</option>
              </select>
            )}
          </div>

          {relatedActivity.length === 0 ? (
            <div className="bg-white rounded-xl border border-dashed border-zinc-300 p-12 text-center">
              <svg xmlns="http://www.w3.org/2000/svg" className="h-10 w-10 text-zinc-300 mx-auto mb-3" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13.828 10.172a4 4 0 00-5.656 0l-4 4a4 4 0 105.656 5.656l1.102-1.101m-.758-4.899a4 4 0 005.656 0l4-4a4 4 0 00-5.656-5.656l-1.1 1.1" /></svg>
              <h4 className="text-zinc-800 font-semibold">No linked activity yet</h4>
              <p className="text-sm text-zinc-500 mt-1">Records from other databases that point to this profile will appear here.</p>
            </div>
          ) : (
            <div className="space-y-8">
              {relatedActivity.map((activityGroup, idx) => {
                const sortedRecords = [...activityGroup.records].sort((a, b) => {
                  const dateA = new Date(a.createdAt);
                  const dateB = new Date(b.createdAt);
                  return sortOrder === 'desc' ? dateB - dateA : dateA - dateB;
                });

                return (
                  <div key={idx} className="relative">
                    <div className="absolute left-4 top-8 bottom-0 w-px bg-zinc-200 -z-10"></div>
                    <div className="flex items-center gap-3 mb-4">
                      <div className="h-8 w-8 rounded-full bg-indigo-100 border-2 border-white flex items-center justify-center text-indigo-600 shadow-sm z-10"><svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" viewBox="0 0 20 20" fill="currentColor"><path d="M7 3a1 1 0 000 2h6a1 1 0 100-2H7zM4 7a1 1 0 011-1h10a1 1 0 110 2H5a1 1 0 01-1-1zM2 11a2 2 0 012-2h12a2 2 0 012 2v4a2 2 0 01-2 2H4a2 2 0 01-2-2v-4z" /></svg></div>
                      <h4 className="text-sm font-bold text-zinc-800 uppercase tracking-widest">{activityGroup.entitySchema.name} Database</h4>
                      <span className="bg-zinc-100 text-zinc-500 text-xs font-bold px-2 py-0.5 rounded-full">{sortedRecords.length} entries</span>
                    </div>

                    <div className="space-y-4 pl-[34px]">
                      {sortedRecords.map(rec => (
                        <div key={rec._id} className="bg-white p-5 rounded-xl border border-zinc-200 shadow-sm transition-all hover:border-indigo-300">
                          <div className="flex justify-between items-start mb-4 pb-3 border-b border-zinc-100">
                            <span className="text-[10px] font-bold text-zinc-400 uppercase tracking-wider">Logged by {rec.createdBy?.name || 'User'}</span>
                            <span className="text-xs text-zinc-500 font-medium">{new Date(rec.createdAt).toLocaleString([], { dateStyle: 'medium', timeStyle: 'short' })}</span>
                          </div>

                          <div className="grid grid-cols-1 sm:grid-cols-2 gap-x-6 gap-y-4">
                            {activityGroup.entitySchema.fields.map((field, i) => {
                              if (field.type === 'relation' && rec.data[field.name] === recordId) return null;
                              return (
                                <div key={i} className="flex flex-col gap-1">
                                  <span className="text-[11px] font-bold text-zinc-400 uppercase tracking-wider">{field.name}</span>
                                  <div className="text-sm">
                                    {renderFieldValue(rec.data[field.name], field)}
                                  </div>
                                </div>
                              );
                            })}
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </main>
    </div>
  );
}