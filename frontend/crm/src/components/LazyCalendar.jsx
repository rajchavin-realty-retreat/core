import { useState, useEffect, useCallback } from 'react';
import { Calendar, momentLocalizer } from 'react-big-calendar';
import withDragAndDrop from 'react-big-calendar/lib/addons/dragAndDrop';
import moment from 'moment';
import api from '../api/axiosConfig';
import DynamicForm from './DynamicForm'; // --- NEW: In-context editing! ---

import 'react-big-calendar/lib/css/react-big-calendar.css';
import 'react-big-calendar/lib/addons/dragAndDrop/styles.css'; 

const localizer = momentLocalizer(moment);

const DnDCalendar = typeof withDragAndDrop === 'function' 
  ? withDragAndDrop(Calendar) 
  : withDragAndDrop.default(Calendar);

// --- PREMIUM CUSTOM TOOLBAR ---
const CustomToolbar = (toolbar) => {
  const goToBack = () => toolbar.onNavigate('PREV');
  const goToNext = () => toolbar.onNavigate('NEXT');
  const goToCurrent = () => toolbar.onNavigate('TODAY');

  return (
    <div className="flex flex-col sm:flex-row justify-between items-center mb-6 gap-4">
      <div className="flex items-center gap-2">
        <button onClick={goToBack} className="p-2 border border-zinc-200 hover:bg-zinc-50 rounded-lg text-zinc-500 transition-colors shadow-sm">
          <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" /></svg>
        </button>
        <button onClick={goToCurrent} className="px-4 py-2 border border-zinc-200 hover:bg-zinc-50 rounded-lg text-sm font-bold text-zinc-700 transition-colors shadow-sm">
          Today
        </button>
        <button onClick={goToNext} className="p-2 border border-zinc-200 hover:bg-zinc-50 rounded-lg text-zinc-500 transition-colors shadow-sm">
          <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" /></svg>
        </button>
      </div>

      <h2 className="text-xl font-black text-zinc-900 tracking-tight">{toolbar.label}</h2>

      <div className="flex bg-zinc-100/80 p-1 rounded-xl border border-zinc-200/60">
        {['month', 'week', 'day', 'agenda'].map(view => (
          <button 
            key={view} 
            onClick={() => toolbar.onView(view)} 
            className={`px-4 py-1.5 rounded-lg text-xs font-bold capitalize tracking-wider transition-all ${toolbar.view === view ? 'bg-white text-indigo-600 shadow-sm' : 'text-zinc-500 hover:text-zinc-700'}`}
          >
            {view}
          </button>
        ))}
      </div>
    </div>
  );
};

export default function LazyCalendar({ activeWorkspace, entities }) {
  const [events, setEvents] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  const [currentDate, setCurrentDate] = useState(new Date());
  const [currentView, setCurrentView] = useState('month');
  
  // --- IN-CONTEXT EDITING STATE ---
  const [selectedEventPayload, setSelectedEventPayload] = useState(null);

  const fetchCalendarData = useCallback(async () => {
    setIsLoading(true);
    try {
      let allEvents = [];
      const fetchPromises = entities.map(ent => api.get(`/records/entity/${ent._id}`).catch(() => ({ data: [] })));
      const responses = await Promise.all(fetchPromises);

      const universalRecordMap = {};
      responses.forEach((res, index) => {
        const entity = entities[index];
        res.data.forEach(record => {
          universalRecordMap[String(record._id)] = {
            data: record.data,
            schema: entity,
            fullRecord: record // Storing full record for the DynamicForm
          };
        });
      });

      const dateEntities = entities.filter(ent => ent.fields.some(f => f.type === 'date' || f.type === 'datetime'));

      dateEntities.forEach(entity => {
        const entityIndex = entities.findIndex(e => String(e._id) === String(entity._id));
        const records = responses[entityIndex]?.data || [];
        const dateFields = entity.fields.filter(f => f.type === 'date' || f.type === 'datetime');
        const firstField = entity.fields[0]; 

        records.forEach(record => {
          dateFields.forEach(dateField => {
            const dateValue = record.data?.[dateField.name];
            if (dateValue) {
              
              let recordTitle = 'Unnamed Record';
              if (firstField && record.data[firstField.name]) {
                const rawValue = record.data[firstField.name];

                if (firstField.type === 'relation') {
                  const targetRecordInfo = universalRecordMap[String(rawValue)];
                  if (targetRecordInfo) {
                    const targetFirstField = targetRecordInfo.schema.fields[0];
                    if (targetFirstField) {
                      recordTitle = targetRecordInfo.data[targetFirstField.name] || 'Unnamed Linked Record';
                    }
                  } else {
                    recordTitle = 'Unknown Linked Record';
                  }
                } else {
                  recordTitle = String(rawValue);
                }
              }

              allEvents.push({
                id: `${record._id}-${dateField.name}`,
                title: recordTitle,
                start: new Date(dateValue),
                end: new Date(dateValue), 
                allDay: dateField.type === 'date',
                resource: {
                  entity: entity,
                  fullRecord: record, // The exact object DynamicForm needs!
                  entityName: entity.name,
                  dateFieldName: dateField.name
                }
              });
            }
          });
        });
      });

      setEvents(allEvents);
    } catch (error) {
      console.error("Failed to load calendar data", error);
    } finally {
      setIsLoading(false);
    }
  }, [entities]);

  useEffect(() => {
    if (entities && entities.length > 0) {
      fetchCalendarData();
    } else {
      setIsLoading(false);
    }
  }, [entities, fetchCalendarData, activeWorkspace]);

  const onEventDrop = async ({ event, start, end, isAllDay }) => {
    const updatedEvents = events.map(evt => evt.id === event.id ? { ...evt, start, end, allDay: isAllDay } : evt);
    setEvents(updatedEvents);

    try {
      const isPureDate = event.allDay; 
      const formattedDate = isPureDate ? moment(start).format('YYYY-MM-DD') : start.toISOString();

      await api.put(`/records/${event.resource.fullRecord._id}`, {
        dynamicData: { [event.resource.dateFieldName]: formattedDate }
      });
      fetchCalendarData(); // Resync cleanly
    } catch (error) {
      alert("Failed to reschedule record. You may not have edit permissions.");
      fetchCalendarData(); 
    }
  };

  const handleEventClick = (event) => {
    // Instead of navigating away, we pop open the record!
    setSelectedEventPayload({
      entity: event.resource.entity,
      record: event.resource.fullRecord
    });
  };

  const eventPropGetter = (event) => {
    // Dynamic premium colors based on the database they belong to
    const colors = [
      { bg: '#eef2ff', border: '#c7d2fe', text: '#4f46e5' }, // Indigo
      { bg: '#ecfdf5', border: '#a7f3d0', text: '#059669' }, // Emerald
      { bg: '#fffbeb', border: '#fde68a', text: '#d97706' }, // Amber
      { bg: '#fef2f2', border: '#fecaca', text: '#dc2626' }, // Rose
      { bg: '#f5f3ff', border: '#ddd6fe', text: '#7c3aed' }, // Violet
    ];
    const charCodeSum = event.resource.entityName.split('').reduce((sum, char) => sum + char.charCodeAt(0), 0);
    const theme = colors[charCodeSum % colors.length];
    
    return {
      style: {
        backgroundColor: theme.bg,
        borderLeft: `3px solid ${theme.text}`,
        borderTop: `1px solid ${theme.border}`,
        borderRight: `1px solid ${theme.border}`,
        borderBottom: `1px solid ${theme.border}`,
        borderRadius: '6px', 
        color: theme.text,
        display: 'block',
        boxShadow: '0 1px 2px rgba(0,0,0,0.05)',
        padding: '2px 4px'
      }
    };
  };

  const CustomEvent = ({ event }) => {
    return (
      <div className="flex flex-col h-full justify-center overflow-hidden">
        <div className="text-[9px] uppercase tracking-widest opacity-80 font-black truncate leading-none mb-[2px]">
          {event.resource.entityName}
        </div>
        <div className="text-xs font-bold truncate leading-tight">
          {event.title}
        </div>
      </div>
    );
  };

  return (
    <div className="bg-white p-5 sm:p-8 rounded-2xl border border-zinc-200 shadow-sm h-[85vh] flex flex-col z-0 font-sans">
      
      {isLoading ? (
        <div className="flex-1 flex flex-col items-center justify-center text-zinc-400 gap-3">
          <svg className="animate-spin h-6 w-6 text-indigo-500" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24"><circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle><path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path></svg>
          <span className="text-sm font-bold tracking-widest uppercase">Syncing Timeline</span>
        </div>
      ) : (
        <div className="flex-1 min-h-0 calendar-container relative">
          
          {/* --- ENTERPRISE CSS OVERRIDES --- */}
          <style>{`
            .rbc-toolbar { display: none; } /* Hide default toolbar, we built a custom one! */
            
            .rbc-month-view, .rbc-time-view, .rbc-agenda-view { 
              border: 1px solid #e4e4e7 !important; 
              border-radius: 12px; 
              overflow: hidden; 
              box-shadow: 0 1px 3px rgba(0,0,0,0.02);
            }
            
            .rbc-header { 
              padding: 12px 0; 
              text-transform: uppercase; 
              font-size: 11px; 
              font-weight: 800; 
              color: #71717a; 
              border-bottom: 1px solid #e4e4e7 !important; 
              background: #fafafa;
            }
            
            .rbc-today { background-color: #f8fafc; }
            .rbc-day-bg + .rbc-day-bg { border-left: 1px solid #f4f4f5; }
            .rbc-month-row + .rbc-month-row { border-top: 1px solid #f4f4f5; }
            
            .rbc-event { 
              transition: all 0.15s ease; 
              min-height: 44px; 
              margin: 1px 4px;
            } 
            .rbc-event:hover { transform: translateY(-1px); z-index: 10; box-shadow: 0 4px 6px -1px rgba(0,0,0,0.1); }
            
            /* Clean up overlapping borders */
            .rbc-month-view { border-collapse: collapse; }
            .rbc-day-bg { border-left-color: #f4f4f5 !important; border-bottom-color: #f4f4f5 !important; }
            
            .rbc-show-more {
              color: #4f46e5;
              font-weight: 800;
              font-size: 11px;
              margin-top: 4px;
              margin-left: 4px;
              background: #eef2ff;
              border-radius: 6px;
              padding: 4px 8px;
              display: inline-block;
              transition: background 0.2s;
            }
            .rbc-show-more:hover { background: #e0e7ff; }

            /* Fix popups breaking UI */
            .rbc-overlay { 
              z-index: 9999 !important; 
              background: white; 
              border: 1px solid #e4e4e7; 
              border-radius: 12px; 
              box-shadow: 0 20px 25px -5px rgba(0, 0, 0, 0.1), 0 10px 10px -5px rgba(0, 0, 0, 0.04); 
              padding: 16px; 
              min-width: 280px;
            }
            .rbc-overlay-header { 
              font-weight: 800; 
              border-bottom: 2px solid #f4f4f5; 
              padding-bottom: 8px; 
              margin-bottom: 12px; 
              color: #18181b; 
              font-size: 14px;
            }
          `}</style>
          
          <DnDCalendar
            localizer={localizer}
            events={events}
            startAccessor="start"
            endAccessor="end"
            date={currentDate}
            onNavigate={(newDate) => setCurrentDate(newDate)}
            view={currentView}
            onView={(newView) => setCurrentView(newView)}
            style={{ height: '100%' }}
            onSelectEvent={handleEventClick}
            onEventDrop={onEventDrop}
            resizable={false}
            popup={true}
            eventPropGetter={eventPropGetter}
            components={{ 
              toolbar: CustomToolbar, // Use our sleek new toolbar
              event: CustomEvent 
            }}
            views={['month', 'week', 'day', 'agenda']}
          />
        </div>
      )}

      {/* --- ENTERPRISE FIX: IN-CONTEXT DYNAMIC FORM MODAL --- */}
      {selectedEventPayload && (
        <DynamicForm 
          entity={selectedEventPayload.entity}
          record={selectedEventPayload.record}
          onCancel={() => setSelectedEventPayload(null)}
          onSuccess={() => {
            setSelectedEventPayload(null);
            fetchCalendarData(); // Refresh the calendar data seamlessly!
          }}
        />
      )}
    </div>
  );
}