import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, AreaChart, Area } from 'recharts';

export default function AnalyticsView({ entities }) {
  // 1. Prepare data for the Bar Chart (How many columns does each database have?)
  const databaseStats = entities.map(entity => ({
    name: entity.name,
    columns: entity.fields.length,
  }));

  // 2. Dummy Data for the Area Chart (Simulating "Records Created over the last 7 days")
  // In a production app, we would fetch this from the backend!
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
    <div className="space-y-6 max-w-6xl mx-auto">
      
      {/* --- TOP STATS ROW --- */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <div className="bg-white p-5 rounded-xl border border-zinc-200 shadow-sm">
          <p className="text-xs font-semibold text-zinc-500 uppercase tracking-wider mb-1">Total Databases</p>
          <p className="text-3xl font-bold text-zinc-900">{entities.length}</p>
        </div>
        <div className="bg-white p-5 rounded-xl border border-zinc-200 shadow-sm">
          <p className="text-xs font-semibold text-zinc-500 uppercase tracking-wider mb-1">System Health</p>
          <div className="flex items-center gap-2 mt-1">
            <span className="relative flex h-3 w-3">
              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
              <span className="relative inline-flex rounded-full h-3 w-3 bg-emerald-500"></span>
            </span>
            <span className="text-sm font-semibold text-emerald-600 tracking-tight">All Systems Operational</span>
          </div>
        </div>
        <div className="bg-white p-5 rounded-xl border border-zinc-200 shadow-sm">
          <p className="text-xs font-semibold text-zinc-500 uppercase tracking-wider mb-1">Storage Used</p>
          <p className="text-3xl font-bold text-zinc-900">14<span className="text-lg text-zinc-400 font-medium">.2 MB</span></p>
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