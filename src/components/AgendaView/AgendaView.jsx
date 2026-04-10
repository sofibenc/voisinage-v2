import { useState } from 'react';
import DayView from './DayView.jsx';

const VIEWS = ['Jour', 'Semaine', 'Mois'];

export default function AgendaView({
  year, month,
  getSlotState,
  onSlotPointerDown, onSlotPointerEnter, onSlotPointerUp, onSlotClick,
}) {
  const [view, setView]       = useState('Semaine');
  const [selectedDay, setDay] = useState(new Date().getDate());
  const daysInMonth = new Date(year, month + 1, 0).getDate();

  return (
    <div>
      {/* View toggle */}
      <div style={{ display: 'flex', gap: 4, marginBottom: 10 }}>
        {VIEWS.map(v => (
          <button key={v} onClick={() => setView(v)}
            style={{ flex: 1, padding: '6px 0', fontSize: 12, fontWeight: 600,
                     border: 'none', borderRadius: 8,
                     background: view === v ? '#1E293B' : '#F1F5F9',
                     color: view === v ? 'white' : '#64748B' }}>
            {v}
          </button>
        ))}
      </div>

      {/* Day picker (Jour view only) */}
      {view === 'Jour' && (
        <div style={{ display: 'flex', gap: 4, overflowX: 'auto',
                      marginBottom: 8, paddingBottom: 4 }}>
          {Array.from({ length: daysInMonth }, (_, i) => i + 1).map(d => (
            <button key={d} onClick={() => setDay(d)}
              style={{ flexShrink: 0, width: 32, height: 32, borderRadius: 8,
                       border: 'none', fontSize: 12, fontWeight: 600,
                       background: d === selectedDay ? '#1E293B' : '#F1F5F9',
                       color: d === selectedDay ? 'white' : '#64748B' }}>
              {d}
            </button>
          ))}
        </div>
      )}

      {view === 'Jour' && (
        <DayView
          year={year} month={month} day={selectedDay}
          getSlotState={getSlotState}
          onSlotPointerDown={onSlotPointerDown}
          onSlotPointerEnter={onSlotPointerEnter}
          onSlotPointerUp={onSlotPointerUp}
          onSlotClick={onSlotClick}
        />
      )}

      {view === 'Semaine' && (
        <div style={{ padding: 20, textAlign: 'center', color: '#94A3B8', fontSize: 13 }}>
          Vue Semaine — à implémenter (Task 9)
        </div>
      )}

      {view === 'Mois' && (
        <div style={{ padding: 20, textAlign: 'center', color: '#94A3B8', fontSize: 13 }}>
          Vue Mois — à implémenter (Task 9)
        </div>
      )}
    </div>
  );
}
