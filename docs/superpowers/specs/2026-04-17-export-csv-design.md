# Design : Export CSV des stats mensuelles

Date : 2026-04-17

## Contexte

L'AdminTab affiche les stats d'usage par voisin (heures ce mois, mois dernier). L'objectif est d'ajouter un bouton pour télécharger ces données en CSV pour le mois affiché.

## Périmètre

Bouton "⬇ CSV" dans la section stats de l'AdminTab. Génération entièrement client-side, pas de backend.

## Données exportées

Colonnes : `Mois`, `Voisin`, `Ce mois (h)`, `Mois dernier (h)`

Exemple :
```
Mois,Voisin,Ce mois (h),Mois dernier (h)
Avril 2026,Sofiane,4.5,3
Avril 2026,Marie,2,6.5
```

- `Mois` : mois affiché dans AdminTab au moment du clic (ex : "Avril 2026")
- `Voisin` : `member.name` ou uid tronqué si absent
- `Ce mois (h)` : `stat.monthPastHours` (heures passées du mois courant)
- `Mois dernier (h)` : `stat.lastMonthHours`
- Valeur `0` si aucune heure

## Architecture

### `src/tabs/AdminTab.jsx` (seul fichier modifié)

Nouvelle fonction `exportCsv()` dans le composant :

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

Bouton ajouté dans l'en-tête de la section stats, à droite du titre du mois :

```jsx
<button onClick={exportCsv} style={{ ... }}>⬇ CSV</button>
```

## Ce qui ne change pas

- `useUsageStats` — inchangé, données déjà disponibles
- Aucun autre fichier touché
- Aucune dépendance ajoutée

## Hors périmètre

- Export multi-mois
- Format Excel
- Colonne "à venir" (`next7Hours`)
