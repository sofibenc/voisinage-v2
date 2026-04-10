export const PALETTE = [
  { bg: '#E8533A', light: '#FEF0ED', text: '#7A1A0A' },
  { bg: '#2A9D8F', light: '#E6F6F4', text: '#0D4D47' },
  { bg: '#E9C46A', light: '#FDF8E7', text: '#7A5C00' },
  { bg: '#457B9D', light: '#EAF2F8', text: '#1A3A50' },
  { bg: '#9B5DE5', light: '#F4EDFD', text: '#3D0070' },
  { bg: '#F77F00', light: '#FFF2E5', text: '#7A3300' },
  { bg: '#06D6A0', light: '#E5FBF5', text: '#00503C' },
  { bg: '#EF476F', light: '#FEE9EF', text: '#7A0028' },
];

export const MONTHS = ['Janvier','Février','Mars','Avril','Mai','Juin',
                       'Juillet','Août','Septembre','Octobre','Novembre','Décembre'];
export const DAYS_FR = ['L','M','M','J','V','S','D'];

export function monthKey(year, month) {
  return `${year}-${String(month + 1).padStart(2, '0')}`;
}

export function parseMonthKey(mk) {
  const [y, m] = mk.split('-').map(Number);
  return { year: y, month: m - 1 };
}
