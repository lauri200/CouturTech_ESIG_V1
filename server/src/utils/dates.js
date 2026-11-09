const pad = (n) => String(n).padStart(2, '0');

function todayISO(d = new Date()) {
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}

function addDays(iso, days) {
  const [y, m, d] = iso.split('-').map(Number);
  const dt = new Date(Date.UTC(y, m - 1, d + days));
  return dt.toISOString().slice(0, 10);
}

function frDate(iso) {
  if (!iso) return '';
  const s = typeof iso === 'string' ? iso.slice(0, 10) : todayISO(iso);
  const [y, m, d] = s.split('-');
  return `${d}/${m}/${y}`;
}

const fcfa = (n) => `${Math.round(Number(n) || 0).toLocaleString('fr-FR').replace(/\u202f|\u00a0/g, ' ')} FCFA`;

module.exports = { todayISO, addDays, frDate, fcfa };
