import { useState, useEffect } from 'react';
import api from '../api/axiosConfig';

export default function AnalyticsView({ entities, activeWorkspace }) {
  const [isLoading, setIsLoading] = useState(true);
  
  // Real Data States
  const [totalRecords, setTotalRecords] = useState(0);
  const [recentActivity, setRecentActivity] = useState([]);
  const [dbStats, setDbStats] = useState([]);
  
  const currentUser = JSON.parse(localStorage.getItem('userInfo'));

  useEffect(() => {
    const fetchRealWorkspaceData = async () => {
      if (!entities || entities.length === 0) {
        setIsLoading(false);
        return;
      }

      setIsLoading(true);
      try {
        // 1. Fetch all records for every database in this workspace
        const fetchPromises = entities.map(ent => 
          api.get(`/records/entity/${ent._id}`)
            .then(res => ({ entity: ent, records: res.data }))
            .catch(() => ({ entity: ent, records: [] })) 
        );
        
        const results = await Promise.all(fetchPromises);
        
        // --- NEW: BUILD UNIVERSAL DICTIONARIES FOR ID RESOLUTION ---
        
        // A. Map every record in the workspace so we can resolve Relations instantly
        const universalRecordMap = {};
        results.forEach(({ entity, records }) => {
          records.forEach(r => {
            universalRecordMap[r._id] = { data: r.data, schema: entity };
          });
        });

        // B. Map all Workspace Members so we can resolve User IDs
        const userDict = {};
        if (activeWorkspace) {
          const ownerId = activeWorkspace.owner?._id || activeWorkspace.owner;
          if (ownerId) userDict[ownerId] = activeWorkspace.owner.name || activeWorkspace.owner.email;
          
          activeWorkspace.members?.forEach(m => {
            const uid = m.user?._id || m.user;
            if (uid) userDict[uid] = m.user.name || m.user.email;
          });
        }

        // C. The Smart Display Resolver
        const resolveDisplayValue = (schema, recordData) => {
          if (!recordData) return 'Empty Record';
          
          // Try to find a text field, otherwise fall back to the very first field
          const primaryField = schema.fields.find(f => f.type === 'text' || f.type === 'email') || schema.fields[0];
          if (!primaryField) return 'Unnamed Record';
          
          const rawValue = recordData[primaryField.name];
          if (!rawValue) return 'Unnamed Record';

          // If the field is a Team Member, translate the ID to their Name
          if (primaryField.type === 'user') {
            return userDict[rawValue] || `User ${String(rawValue).slice(-4)}`;
          }

          // If the field is a Relation, jump into the map and grab the target's text!
          if (primaryField.type === 'relation') {
            const target = universalRecordMap[rawValue];
            if (target) {
              const targetPrimary = target.schema.fields.find(f => f.type === 'text' || f.type === 'email') || target.schema.fields[0];
              return target.data[targetPrimary?.name] || `Record ${String(rawValue).slice(-4)}`;
            }
            return `Linked Record`;
          }

          // Standard return for text, numbers, dropdowns, etc.
          return String(rawValue);
        };

        // --- END RESOLVER ---

        let allRecords = [];
        let stats = [];
        let count = 0;

        // 2. Process the data
        results.forEach(({ entity, records }) => {
          count += records.length;
          
          stats.push({
            name: entity.name,
            count: records.length,
            id: entity._id
          });

          // Tag records and intelligently resolve their display names!
          const taggedRecords = records.map(r => ({
            ...r,
            databaseName: entity.name,
            displayTitle: resolveDisplayValue(entity, r.data) 
          }));
          
          allRecords = [...allRecords, ...taggedRecords];
        });

        // 3. Sort all records globally to get the "Recent Activity" feed
        const sortedActivity = allRecords
          .filter(r => r.createdAt) 
          .sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt))
          .slice(0, 8); 

        // 4. Update State
        setTotalRecords(count);
        setDbStats(stats.sort((a, b) => b.count - a.count)); 
        setRecentActivity(sortedActivity);

      } catch (error) {
        console.error("Failed to aggregate workspace analytics", error);
      } finally {
        setIsLoading(false);
      }
    };

    fetchRealWorkspaceData();
  }, [entities, activeWorkspace]);

  if (isLoading) {
    return (
      <div className="flex flex-col items-center justify-center h-64 text-zinc-400 gap-3">
        <svg className="animate-spin h-6 w-6 text-indigo-500" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24"><circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle><path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path></svg>
        <span className="text-sm font-medium">Aggregating Workspace Data...</span>
      </div>
    );
  }

  const maxRecords = dbStats.length > 0 ? dbStats[0].count : 1;

  return (
    <div className="flex flex-col gap-8 max-w-[1200px] mx-auto w-full">
      
      {/* HEADER */}
      <div className="pb-4 border-b border-zinc-100">
        <h1 className="text-2xl font-bold text-zinc-900 tracking-tight">
          Welcome back, {currentUser?.name?.split(' ')[0] || currentUser?.email?.split('@')[0] || 'User'}
        </h1>
        <p className="text-sm text-zinc-500 mt-1">Here is the real-time overview for <span className="font-bold text-zinc-700">{activeWorkspace?.name}</span>.</p>
      </div>

      {/* TOP METRICS CARDS */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <div className="bg-white p-6 rounded-2xl border border-zinc-200 shadow-sm hover:border-indigo-200 transition-colors">
          <div className="flex items-center gap-3 mb-2">
            <div className="w-8 h-8 rounded-lg bg-indigo-50 text-indigo-600 flex items-center justify-center">
              <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 7v10c0 2.21 3.582 4 8 4s8-1.79 8-4V7M4 7c0 2.21 3.582 4 8 4s8-1.79 8-4M4 7c0-2.21 3.582-4 8-4s8 1.79 8 4m0 5c0 2.21-3.582 4-8 4s-8-1.79-8-4" /></svg>
            </div>
            <h3 className="text-xs font-bold text-zinc-400 uppercase tracking-widest">Active Modules</h3>
          </div>
          <p className="text-4xl font-black text-zinc-900">{entities.length}</p>
        </div>

        <div className="bg-white p-6 rounded-2xl border border-zinc-200 shadow-sm hover:border-emerald-200 transition-colors">
          <div className="flex items-center gap-3 mb-2">
            <div className="w-8 h-8 rounded-lg bg-emerald-50 text-emerald-600 flex items-center justify-center">
              <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" /></svg>
            </div>
            <h3 className="text-xs font-bold text-zinc-400 uppercase tracking-widest">Total Records</h3>
          </div>
          <p className="text-4xl font-black text-zinc-900">{totalRecords}</p>
        </div>

        <div className="bg-white p-6 rounded-2xl border border-zinc-200 shadow-sm hover:border-amber-200 transition-colors">
          <div className="flex items-center gap-3 mb-2">
            <div className="w-8 h-8 rounded-lg bg-amber-50 text-amber-600 flex items-center justify-center">
              <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4.354a4 4 0 110 5.292M15 21H3v-1a6 6 0 0112 0v1zm0 0h6v-1a6 6 0 00-9-5.197M13 7a4 4 0 11-8 0 4 4 0 018 0z" /></svg>
            </div>
            <h3 className="text-xs font-bold text-zinc-400 uppercase tracking-widest">Team Members</h3>
          </div>
          <p className="text-4xl font-black text-zinc-900">{activeWorkspace?.members?.length || 1}</p>
        </div>
      </div>

      {/* LOWER SECTION: SPLIT VIEW */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
        
        {/* LEFT: Data Distribution */}
        <div className="bg-white p-8 rounded-2xl border border-zinc-200 shadow-sm">
          <h3 className="text-sm font-bold text-zinc-900 mb-6 flex items-center gap-2">
            <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4 text-zinc-400" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 8v8m-4-5v5m-4-2v2m-2 4h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" /></svg>
            Record Distribution
          </h3>
          
          {dbStats.length === 0 ? (
            <p className="text-sm text-zinc-500 italic">No records found in this workspace.</p>
          ) : (
            <div className="space-y-5">
              {dbStats.map((stat) => (
                <div key={stat.id}>
                  <div className="flex justify-between items-end mb-1.5">
                    <span className="text-sm font-medium text-zinc-700">{stat.name}</span>
                    <span className="text-xs font-bold text-zinc-400">{stat.count} records</span>
                  </div>
                  <div className="h-2 w-full bg-zinc-100 rounded-full overflow-hidden">
                    <div 
                      className="h-full bg-indigo-500 rounded-full transition-all duration-1000 ease-out"
                      style={{ width: `${(stat.count / maxRecords) * 100}%` }}
                    ></div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* RIGHT: Recent Activity Feed */}
        <div className="bg-white p-8 rounded-2xl border border-zinc-200 shadow-sm">
          <h3 className="text-sm font-bold text-zinc-900 mb-6 flex items-center gap-2">
            <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4 text-zinc-400" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>
            Workspace Activity
          </h3>

          {recentActivity.length === 0 ? (
            <p className="text-sm text-zinc-500 italic">No recent activity. Start adding records!</p>
          ) : (
            <div className="space-y-0 relative before:absolute before:inset-y-0 before:left-4 before:w-[2px] before:bg-zinc-100">
              {recentActivity.map((record, idx) => (
                <div key={record._id} className="relative flex gap-4 items-start pb-6 last:pb-0 group">
                  {/* Timeline Node */}
                  <div className={`w-8 h-8 rounded-full flex items-center justify-center shrink-0 border-4 border-white relative z-10 ${idx === 0 ? 'bg-indigo-500 text-white' : 'bg-zinc-200 text-zinc-500 group-hover:bg-indigo-400 group-hover:text-white transition-colors'}`}>
                    <svg xmlns="http://www.w3.org/2000/svg" className="h-3 w-3" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" /></svg>
                  </div>
                  
                  {/* Activity Details */}
                  <div className="pt-1 flex-1 min-w-0">
                    <p className="text-sm text-zinc-800 font-medium truncate">
                      New record added: <span className="font-bold text-zinc-900">{record.displayTitle}</span>
                    </p>
                    <div className="flex items-center gap-2 mt-1 text-xs font-medium text-zinc-400">
                      <span className="bg-zinc-100 text-zinc-600 px-1.5 py-0.5 rounded-sm">{record.databaseName}</span>
                      <span>•</span>
                      <span>{new Date(record.createdAt).toLocaleDateString()} at {new Date(record.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</span>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

      </div>
    </div>
  );
}