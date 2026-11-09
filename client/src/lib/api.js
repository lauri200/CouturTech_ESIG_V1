const TOKEN_KEY = 'couturtech_token';

export const getToken = () => localStorage.getItem(TOKEN_KEY);
export const setToken = (t) => (t ? localStorage.setItem(TOKEN_KEY, t) : localStorage.removeItem(TOKEN_KEY));

export class ApiError extends Error {
  constructor(status, message, details) {
    super(message);
    this.status = status;
    this.details = details;
  }
}

let onUnauthorized = () => {};
export const setUnauthorizedHandler = (fn) => { onUnauthorized = fn; };

export async function api(path, { method = 'GET', body, headers = {}, raw = false, retries } = {}) {
  const token = getToken();
  const opts = {
    method,
    headers: { ...(body !== undefined ? { 'Content-Type': 'application/json' } : {}), ...(token ? { Authorization: `Bearer ${token}` } : {}), ...headers },
    body: body !== undefined ? JSON.stringify(body) : undefined,
  };
  // Connexion instable : on relance automatiquement les lectures (GET) en cas d'échec réseau.
  const essais = retries ?? (method === 'GET' ? 2 : 0);
  let res;
  for (let i = 0; ; i += 1) {
    try {
      res = await fetch(`/api${path}`, opts);
      break;
    } catch {
      if (i >= essais) throw new ApiError(0, 'Connexion impossible. Vérifiez votre réseau puis réessayez.');
      await new Promise((r) => setTimeout(r, 800 * (i + 1)));
    }
  }
  if (res.status === 401 && token) onUnauthorized();
  if (raw) {
    if (!res.ok) {
      const j = await res.json().catch(() => ({}));
      throw new ApiError(res.status, j.message || 'Erreur.');
    }
    return res;
  }
  const data = res.status === 204 ? null : await res.json().catch(() => null);
  if (!res.ok) throw new ApiError(res.status, data?.message || 'Une erreur est survenue.', data?.details);
  return data;
}

export async function ouvrirPdf(path) {
  const res = await api(path, { raw: true });
  const blob = await res.blob();
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.target = '_blank';
  a.rel = 'noopener';
  const nom = /filename="([^"]+)"/.exec(res.headers.get('Content-Disposition') || '');
  a.download = nom ? nom[1] : 'document.pdf';
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 30000);
}

export function lireFichier(file) {
  return new Promise((resolve, reject) => {
    const r = new FileReader();
    r.onload = () => resolve(r.result);
    r.onerror = reject;
    r.readAsDataURL(file);
  });
}

export async function televerserImage(file) {
  if (!['image/jpeg', 'image/png', 'image/webp'].includes(file.type)) throw new ApiError(422, 'Format accepté : JPG, PNG ou WEBP.');
  if (file.size > 2 * 1024 * 1024) throw new ApiError(422, 'Image trop lourde (2 Mo maximum).');
  const donnees = await lireFichier(file);
  return api('/fichiers', { method: 'POST', body: { nom: file.name, type_mime: file.type, donnees } });
}
