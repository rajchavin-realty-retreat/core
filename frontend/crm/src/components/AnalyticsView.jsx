import React from 'react';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, AreaChart, Area } from 'recharts';

export default function AnalyticsView({ entities, activeWorkspace }) {
  if (!activeWorkspace) return null;

  // --- STORAGE CALCULATIONS ---
  const storageInMB = activeWorkspace.storageUsed ? (activeWorkspace.storageUsed / (1024 * 1024)).toFixed(2) : "0.00";
  const limitInMB = 1024; // 1 GB Free Tier limit
  const storagePercentage = Math.min((storageInMB / limitInMB) * 100, 100);

  // 1. Prepare data for the Bar Chart (How many columns does each database have?)
  const databaseStats = entities.map(entity => ({
    name: entity.name,
    columns: entity.fields.length,
  }));

  // 2. Dummy Data for the Area Chart (Simulating "Records Created over the last 7 days")
  const activityData = [
    { day: 'Mon', records: 12 },
    { day: 'Tue', records: 19 },
    { day: 'Wed', records: 15 },
    { day: 'Thu', records: 28 },
    { day: 'Fri', records: 22 },
    { day: 'Sat', records: 5 },
    { day: 'Sun', records: 8 },
  ];

  return (
    <div className="space-y-6 max-w-6xl mx-auto animate-fade-in">
      
      {/* --- HEADER --- */}
      <div>
        <h2 className="text-2xl font-bold text-zinc-900">Workspace Overview</h2>
      </div>

      {/* --- THE MASTER STORAGE TRACKER --- */}
      <div className="bg-white p-6 rounded-xl border border-zinc-200 shadow-sm">
        <div className="flex justify-between items-end mb-4">
          <div>
            <h3 className="text-sm font-bold text-zinc-900">Cloudinary Storage Capacity</h3>
            <p className="text-xs text-zinc-500 mt-0.5">Total file size of all media uploaded across all databases.</p>
          </div>
          <div className="text-right">
            <span className="text-2xl font-black text-zinc-900">{storageInMB} <span className="text-sm text-zinc-500 font-medium">MB</span></span>
            <span className="text-sm text-zinc-400 mx-2">/</span>
            <span className="text-sm font-bold text-zinc-600">1GB</span>
          </div>
        </div>
        
        <div className="w-full bg-zinc-100 rounded-full h-4 overflow-hidden border border-zinc-200">
          <div 
            className={`h-full rounded-full transition-all duration-1000 ease-out ${storagePercentage > 90 ? 'bg-red-500' : storagePercentage > 75 ? 'bg-amber-400' : 'bg-indigo-600'}`} 
            style={{ width: `${storagePercentage}%` }}
          ></div>
        </div>
        {storagePercentage > 90 && (
          <p className="text-xs text-red-600 font-bold mt-3 text-right">⚠️ Approaching storage limit. Please delete old files.</p>
        )}
      </div>

      {/* --- TOP STATS ROW --- */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <div className="bg-white p-5 rounded-xl border border-zinc-200 shadow-sm flex flex-col justify-center">
          <p className="text-[11px] font-bold text-zinc-400 uppercase tracking-wider mb-1">Total Databases</p>
          <p className="text-3xl font-black text-zinc-900">{entities.length}</p>
        </div>
        <div className="bg-white p-5 rounded-xl border border-zinc-200 shadow-sm flex flex-col justify-center">
          <p className="text-[11px] font-bold text-zinc-400 uppercase tracking-wider mb-1">Total Schema Columns</p>
          <p className="text-3xl font-black text-zinc-900">{entities.reduce((acc, ent) => acc + ent.fields.length, 0)}</p>
        </div>
        <div className="bg-white p-5 rounded-xl border border-zinc-200 shadow-sm flex flex-col justify-center">
          <p className="text-[11px] font-bold text-zinc-400 uppercase tracking-wider mb-1">System Health</p>
          <div className="flex items-center gap-2 mt-2">
            <span className="relative flex h-3 w-3">
              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
              <span className="relative inline-flex rounded-full h-3 w-3 bg-emerald-500"></span>
            </span>
            <span className="text-sm font-semibold text-emerald-600 tracking-tight">All Systems Operational</span>
          </div>
        </div>
      </div>

      {/* --- CHARTS ROW --- */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        
        {/* Chart 1: Database Complexity */}
        <div className="bg-white p-6 rounded-xl border border-zinc-200 shadow-sm">
          <h3 className="text-sm font-semibold text-zinc-800 mb-6">Database Complexity (Columns)</h3>
          <div className="h-64">
            {entities.length > 0 ? (
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={databaseStats} margin={{ top: 0, right: 0, left: -20, bottom: 0 }}>
                  <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#e4e4e7" />
                  <XAxis dataKey="name" axisLine={false} tickLine={false} tick={{ fontSize: 12, fill: '#71717a' }} />
                  <YAxis axisLine={false} tickLine={false} tick={{ fontSize: 12, fill: '#71717a' }} />
                  <Tooltip 
                    cursor={{ fill: '#f4f4f5' }} 
                    contentStyle={{ borderRadius: '8px', border: '1px solid #e4e4e7', boxShadow: '0 1px 2px 0 rgb(0 0 0 / 0.05)' }}
                  />
                  <Bar dataKey="columns" fill="#4f46e5" radius={[4, 4, 0, 0]} barSize={32} />
                </BarChart>
              </ResponsiveContainer>
            ) : (
              <div className="flex items-center justify-center h-full text-sm text-zinc-400 italic">
                No databases to analyze.
              </div>
            )}
          </div>
        </div>

        {/* Chart 2: Workspace Activity */}
        <div className="bg-white p-6 rounded-xl border border-zinc-200 shadow-sm">
          <h3 className="text-sm font-semibold text-zinc-800 mb-6">Workspace Activity (Last 7 Days)</h3>
          <div className="h-64">
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={activityData} margin={{ top: 0, right: 0, left: -20, bottom: 0 }}>
                <defs>
                  <linearGradient id="colorRecords" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#10b981" stopOpacity={0.3}/>
                    <stop offset="95%" stopColor="#10b981" stopOpacity={0}/>
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#e4e4e7" />
                <XAxis dataKey="day" axisLine={false} tickLine={false} tick={{ fontSize: 12, fill: '#71717a' }} />
                <YAxis axisLine={false} tickLine={false} tick={{ fontSize: 12, fill: '#71717a' }} />
                <Tooltip 
                  contentStyle={{ borderRadius: '8px', border: '1px solid #e4e4e7', boxShadow: '0 1px 2px 0 rgb(0 0 0 / 0.05)' }}
                />
                <Area type="monotone" dataKey="records" stroke="#10b981" strokeWidth={3} fillOpacity={1} fill="url(#colorRecords)" />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        </div>

      </div>
    </div>
  );
}