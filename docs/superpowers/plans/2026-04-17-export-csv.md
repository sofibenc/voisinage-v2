# Export CSV Stats Mensuelles Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Ajouter un bouton "⬇ CSV" dans la section stats de l'AdminTab pour télécharger les heures d'usage de chaque voisin pour le mois affiché.

**Architecture:** Génération client-side pure — la fonction `exportCsv()` construit une chaîne CSV depuis le tableau `stats` déjà en mémoire, crée un Blob, déclenche un téléchargement via un `<a>` temporaire. Aucune dépendance externe, aucun backend.

**Tech Stack:** React 19, API Web (Blob, URL.createObjectURL), `src/tabs/AdminTab.jsx` uniquement.

---

## Fichiers touchés

| Action | Fichier |
|--------|---------|
| Modifier | `src/tabs/AdminTab.jsx` |

---

### Task 1 : Ajouter exportCsv et le bouton dans AdminTab

**Files:**
- Modify: `src/tabs/AdminTab.jsx`

Le composant `AdminTab` dispose déjà de :
- `stats` — tableau `[{ uid, name, monthPastHours, lastMonthHours }]` (depuis `useUsageStats`)
- `month` — index 0-11 du mois affiché
- `year` — année affichée
- `MONTHS` — tableau de noms de mois (`['Janvier', 'Février', ...]`) importé depuis `../constants.js`

La section stats actuelle (vers ligne 239) ressemble à :
```jsx
<div style={{ background: 'white', borderRadius: 14, padding: 16,
              boxShadow: '0 2px 10px rgba(0,0,0,0.06)' }}>
  <div style={{ display: 'flex', alignItems: 'center', marginBottom: 12 }}>
    <button onClick={prevMonth} disabled={!canGoPrev}
      style={{ border: 'none', background: 'none', fontSize: 20, color: canGoPrev ? '#1E293B' : '#CBD5E1' }}>‹</button>
    <span style={{ flex: 1, textAlign: 'center', fontWeight: 700, fontSize: 15 }}>
      {MONTHS[month]} {year}
    </span>
    <button onClick={nextMonth} disabled={!canGoNext}
      style={{ border: 'none', background: 'none', fontSize: 20, color: canGoNext ? '#1E293B' : '#CBD5E1' }}>›</button>
  </div>
  ...
```

- [ ] **Step 1 : Ajouter la fonction `exportCsv` dans le corps du composant `AdminTab`**

Ajouter cette fonction juste avant le `return (` dans `AdminTab` :

```js
function exportCsv() {
  const monthLabel = `${MONTHS[month]} ${year}`;
  const header = 'Mois,Voisin,Ce mois (h),Mois dernier (h)';
  const rows = stats.map(s => {
    const name = (s.name || s.uid.slice(0, 6)).replace(/,/g, ' ');
    return `${monthLabel},${name},${s.monthPastHours || 0},${s.lastMonthHours || 0}`;
  });
  const csv = [header, ...rows].join('\n');
  const url = URL.createObjectURL(new Blob([csv], { type: 'text/csv' }));
  const a = document.createElement('a');
  a.href = url;
  a.download = `voisinage-stats-${year}-${String(month + 1).padStart(2, '0')}.csv`;
  a.click();
  URL.revokeObjectURL(url);
}
```

- [ ] **Step 2 : Ajouter le bouton "⬇ CSV" dans la ligne de navigation des stats**

Dans la section stats, remplacer :
```jsx
    <button onClick={nextMonth} disabled={!canGoNext}
        style={{ border: 'none', background: 'none', fontSize: 20, color: canGoNext ? '#1E293B' : '#CBD5E1' }}>›</button>
  </div>
```

Par :
```jsx
    <button onClick={nextMonth} disabled={!canGoNext}
        style={{ border: 'none', background: 'none', fontSize: 20, color: canGoNext ? '#1E293B' : '#CBD5E1' }}>›</button>
    <button onClick={exportCsv}
      style={{ border: 'none', background: '#F1F5F9', borderRadius: 6,
               padding: '4px 8px', fontSize: 11, fontWeight: 700,
               color: '#475569', cursor: 'pointer', marginLeft: 4 }}>
      ⬇ CSV
    </button>
  </div>
```

- [ ] **Step 3 : Vérifier le build**

```bash
npm run build 2>&1 | grep -E "built in|error"
```
Résultat attendu : `✓ built in`

- [ ] **Step 4 : Commit**

```bash
git add src/tabs/AdminTab.jsx
git commit -m "feat: exporter les stats mensuelles en CSV depuis l'admin"
```

---

## Test manuel

1. Ouvrir l'app en tant qu'admin
2. Aller dans ⚙️ Admin → section stats en bas
3. Naviguer vers un mois avec des données
4. Cliquer sur "⬇ CSV"
5. Vérifier que le fichier `voisinage-stats-YYYY-MM.csv` est téléchargé
6. Ouvrir le fichier — vérifier les colonnes `Mois,Voisin,Ce mois (h),Mois dernier (h)` et les valeurs
