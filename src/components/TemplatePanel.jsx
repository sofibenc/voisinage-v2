import { useState } from 'react';
import { upsertMember } from '../firebase.js';
import { resolveTemplate } from '../utils/template.js';
import { setWishlist } from '../firebase.js';
import { monthKey } from '../constants.js';

const PRESET_PATTERNS = [
  { id: 'weekends', label: 'Week-ends', desc: 'Sam + Dim' },
  { id: 'mondays',  label: 'Lundis',    desc: 'Tous les lundis' },
  { id: 'fridays',  label: 'Vendredis', desc: 'Tous les vendredis' },
  { id: 'midweek',  label: 'Milieu de semaine', desc: 'Mar + Mer + Jeu' },
];

export default function TemplatePanel({ member, year, month, myColor, onClose }) {
  const existing = member?.template ?? { patterns: [], customRanges: [] };
  const [patterns,      setPatterns]      = useState(existing.patterns ?? []);
  const [customRanges,  setCustomRanges]  = useState(existing.customRanges ?? []);
  const [newRange,      setNewRange]      = useState({ dayOfWeek: 0, startSlot: 36, endSlot: 39 });

  function togglePattern(id) {
    setPatterns(p => p.includes(id) ? p.filter(x => x !== id) : [...p, id]);
  }

  function addRange() {
    if (newRange.startSlot > newRange.endSlot) return;
    setCustomRanges(r => [...r, { ...newRange }]);
  }

  function removeRange(i) {
    setCustomRanges(r => r.filter((_, j) => j !== i));
  }

  async function saveAndApply() {
    const template = { patterns, customRanges };
    await upsertMember(member.uid, { template });
    const slots = resolveTemplate(template, year, month);
    await setWishlist(member.uid, monthKey(year, month), slots);
    onClose();
  }

  const DOW_LABELS = ['Lun','Mar','Mer','Jeu','Ven','Sam','Dim'];

  return (
    <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.5)',
                  display: 'flex', flexDirection: 'column', justifyContent: 'flex-end',
                  zIndex: 50 }}>
      <div style={{ background: 'white', borderRadius: '16px 16px 0 0',
                    padding: 20, maxHeight: '80vh', overflowY: 'auto' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between',
                      alignItems: 'center', marginBottom: 16 }}>
          <h2 style={{ fontSize: 16, fontWeight: 700 }}>Template de souhaits</h2>
          <button onClick={onClose} style={{ background: 'none', border: 'none', fontSize: 22 }}>×</button>
        </div>

        {/* Preset patterns */}
        <div style={{ marginBottom: 16 }}>
          <div style={{ fontSize: 12, fontWeight: 700, color: '#94A3B8', marginBottom: 8 }}>
            PATTERNS PRÉDÉFINIS
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
            {PRESET_PATTERNS.map(p => (
              <button key={p.id} onClick={() => togglePattern(p.id)}
                style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                         padding: '10px 12px', borderRadius: 10,
                         border: `2px solid ${patterns.includes(p.id) ? myColor.bg : '#E2E8F0'}`,
                         background: patterns.includes(p.id) ? myColor.light : 'white' }}>
                <div style={{ textAlign: 'left' }}>
                  <div style={{ fontSize: 13, fontWeight: 600 }}>{p.label}</div>
                  <div style={{ fontSize: 11, color: '#94A3B8' }}>{p.desc}</div>
                </div>
                {patterns.includes(p.id) && <span style={{ color: myColor.bg }}>✓</span>}
              </button>
            ))}
          </div>
        </div>

        {/* Custom ranges */}
        <div style={{ marginBottom: 16 }}>
          <div style={{ fontSize: 12, fontWeight: 700, color: '#94A3B8', marginBottom: 8 }}>
            PLAGES PERSONNALISÉES
          </div>
          {customRanges.map((r, i) => (
            <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 8,
                                   marginBottom: 6, fontSize: 13 }}>
              <span>{DOW_LABELS[r.dayOfWeek]} {String(Math.floor(r.startSlot/2)).padStart(2,'0')}h{r.startSlot%2?'30':'00'}
                –{String(Math.floor(r.endSlot/2)).padStart(2,'0')}h{r.endSlot%2?'30':'00'}</span>
              <button onClick={() => removeRange(i)}
                style={{ marginLeft: 'auto', background: 'none', border: 'none',
                         color: '#EF4444', fontSize: 16 }}>×</button>
            </div>
          ))}

          {/* Add new range */}
          <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', marginTop: 8 }}>
            <select value={newRange.dayOfWeek}
              onChange={e => setNewRange(r => ({ ...r, dayOfWeek: Number(e.target.value) }))}
              style={{ padding: '6px 8px', borderRadius: 8, border: '1px solid #E2E8F0',
                       fontSize: 12 }}>
              {DOW_LABELS.map((d, i) => <option key={i} value={i}>{d}</option>)}
            </select>
            <select value={newRange.startSlot}
              onChange={e => setNewRange(r => ({ ...r, startSlot: Number(e.target.value) }))}
              style={{ padding: '6px 8px', borderRadius: 8, border: '1px solid #E2E8F0',
                       fontSize: 12 }}>
              {Array.from({ length: 48 }, (_, s) => (
                <option key={s} value={s}>
                  {String(Math.floor(s/2)).padStart(2,'0')}h{s%2?'30':'00'}
                </option>
              ))}
            </select>
            <span style={{ alignSelf: 'center', fontSize: 12 }}>→</span>
            <select value={newRange.endSlot}
              onChange={e => setNewRange(r => ({ ...r, endSlot: Number(e.target.value) }))}
              style={{ padding: '6px 8px', borderRadius: 8, border: '1px solid #E2E8F0',
                       fontSize: 12 }}>
              {Array.from({ length: 48 }, (_, s) => (
                <option key={s} value={s}>
                  {String(Math.floor(s/2)).padStart(2,'0')}h{s%2?'30':'00'}
                </option>
              ))}
            </select>
            <button onClick={addRange}
              style={{ background: myColor.bg, color: 'white', border: 'none',
                       borderRadius: 8, padding: '6px 12px', fontSize: 12, fontWeight: 600 }}>
              +
            </button>
          </div>
        </div>

        <button onClick={saveAndApply}
          style={{ width: '100%', background: myColor.bg, color: 'white', border: 'none',
                   borderRadius: 12, padding: '14px 0', fontSize: 15, fontWeight: 700 }}>
          Sauvegarder et appliquer ce mois
        </button>
      </div>
    </div>
  );
}
