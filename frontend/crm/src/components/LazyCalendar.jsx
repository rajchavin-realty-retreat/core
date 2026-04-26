import { useState, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { Calendar, momentLocalizer } from 'react-big-calendar';
import withDragAndDrop from 'react-big-calendar/lib/addons/dragAndDrop';
import moment from 'moment';
import api from '../api/axiosConfig';

import 'react-big-calendar/lib/css/react-big-calendar.css';
import 'react-big-calendar/lib/addons/dragAndDrop/styles.css'; 

const localizer = momentLocalizer(moment);

const DnDCalendar = typeof withDragAndDrop === 'function' 
  ? withDragAndDrop(Calendar) 
  : withDragAndDrop.default(Calendar);

export default function LazyCalendar({ activeWorkspace, entities }) {
  const [events, setEvents] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  
  // --- THE FIX: CONTROLLED NAVIGATION STATE ---
  const [currentDate, setCurrentDate] = useState(new Date());
  const [currentView, setCurrentView] = useState('month');
  
  const navigate = useNavigate();

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
          universalRecordMap[record._id] = {
            data: record.data,
            schema: entity
          };
        });
      });

      const dateEntities = entities.filter(ent => 
        ent.fields.some(f => f.type === 'date' || f.type === 'datetime')
      );

      dateEntities.forEach(entity => {
        const entityIndex = entities.findIndex(e => e._id === entity._id);
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
                  const targetRecordInfo = universalRecordMap[rawValue];
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

              const displayTitle = `[${entity.name}] ${recordTitle}`;

              allEvents.push({
                id: `${record._id}-${dateField.name}`,
                title: displayTitle,
                start: new Date(dateValue),
                end: new Date(dateValue), 
                allDay: dateField.type === 'date',
                resource: {
                  entityId: entity._id,
                  recordId: record._id,
                  entityName: entity.name,
                  recordTitle: recordTitle,
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
    const updatedEvents = events.map(evt => 
      evt.id === event.id ? { ...evt, start, end, allDay: isAllDay } : evt
    );
    setEvents(updatedEvents);

    try {
      const isPureDate = event.allDay; 
      const formattedDate = isPureDate ? moment(start).format('YYYY-MM-DD') : start.toISOString();

      await api.put(`/records/${event.resource.recordId}`, {
        dynamicData: {
          [event.resource.dateFieldName]: formattedDate
        }
      });
    } catch (error) {
      alert("Failed to reschedule record. You may not have edit permissions for this database.");
      fetchCalendarData(); 
    }
  };

  const handleEventClick = (event) => {
    navigate(`/crm/${event.resource.entityId}?openRecord=${event.resource.recordId}`);
  };

  const eventPropGetter = (event) => {
    const colors = ['#4f46e5', '#059669', '#d97706', '#dc2626', '#7c3aed', '#2563eb'];
    const charCodeSum = event.resource.entityName.split('').reduce((sum, char) => sum + char.charCodeAt(0), 0);
    const colorIndex = charCodeSum % colors.length;
    
    return {
      style: {
        backgroundColor: colors[colorIndex],
        borderRadius: '4px', 
        opacity: 0.95,
        color: 'white',
        border: 'none',
        display: 'block',
        boxShadow: '0 1px 2px rgba(0,0,0,0.1)'
      }
    };
  };

  const CustomEvent = ({ event }) => {
    return (
      <div className="flex flex-col py-0.5 px-1 h-full justify-center overflow-hidden">
        <div className="text-[8px] uppercase tracking-widest opacity-80 font-black truncate leading-none mb-[2px]">
          {event.resource.entityName}
        </div>
        <div className="text-[11px] font-bold truncate leading-tight">
          {event.resource.recordTitle}
        </div>
      </div>
    );
  };

  return (
    <div className="bg-white p-4 sm:p-6 rounded-xl border border-zinc-200 shadow-sm h-[80vh] flex flex-col z-0">
      <div className="mb-4">
        <h2 className="text-lg font-bold text-zinc-900">Lazy Calendar</h2>
        <p className="text-xs text-zinc-500">Drag and drop events to automatically reschedule them in the database.</p>
      </div>
      
      {isLoading ? (
        <div className="flex-1 flex items-center justify-center text-zinc-500 text-sm font-medium animate-pulse">
          Scanning databases for schedules...
        </div>
      ) : (
        <div className="flex-1 min-h-0 calendar-container relative">
          <style>{`
            .rbc-toolbar button { font-size: 12px; font-weight: 600; color: #52525b; border-radius: 6px; }
            .rbc-toolbar button.rbc-active { background-color: #e0e7ff; color: #4f46e5; box-shadow: none; }
            .rbc-today { background-color: #f8fafc; }
            .rbc-event { transition: transform 0.1s ease; min-height: 38px; } 
            .rbc-event:hover { transform: scale(1.02); z-index: 10; }
            .rbc-event-content { height: 100%; }
            
            .rbc-overlay { 
              z-index: 9999 !important; 
              background: white; 
              border: 1px solid #e4e4e7; 
              border-radius: 12px; 
              box-shadow: 0 20px 25px -5px rgba(0, 0, 0, 0.1), 0 10px 10px -5px rgba(0, 0, 0, 0.04); 
              padding: 12px; 
              min-width: 250px;
            }
            .rbc-overlay-header { 
              font-weight: 800; 
              border-bottom: 2px solid #f4f4f5; 
              padding-bottom: 8px; 
              margin-bottom: 8px; 
              color: #18181b; 
              font-size: 14px;
            }
            .rbc-show-more {
              color: #4f46e5;
              font-weight: 700;
              font-size: 11px;
              margin-top: 2px;
              background: #eef2ff;
              border-radius: 4px;
              padding: 2px 6px;
              display: inline-block;
            }
            .rbc-show-more:hover {
              background: #e0e7ff;
            }
          `}</style>
          
          <DnDCalendar
            localizer={localizer}
            events={events}
            startAccessor="start"
            endAccessor="end"
            
            // --- THE FIX: WIRED UP THE CONTROLLED STATE ---
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
            components={{ event: CustomEvent }}
            views={['month', 'week', 'day', 'agenda']}
            tooltipAccessor={(event) => `${event.resource.entityName} - Click to view/edit record`}
            className="font-sans text-sm text-zinc-700"
          />
        </div>
      )}
    </div>
  );
}