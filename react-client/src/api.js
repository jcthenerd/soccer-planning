async function apiRequest(method, url, body) {
  const res = await fetch(url, {
    method,
    headers: body !== undefined ? { 'Content-Type': 'application/json' } : undefined,
    body: body !== undefined ? JSON.stringify(body) : undefined,
  });
  if (res.status === 204) return null;
  const data = await res.json().catch(() => null);
  if (!res.ok) {
    throw new Error((data && data.error) || `Request failed: ${res.status}`);
  }
  return data;
}

export const api = {
  get: (url) => apiRequest('GET', url),
  post: (url, body) => apiRequest('POST', url, body),
  put: (url, body) => apiRequest('PUT', url, body),
  patch: (url, body) => apiRequest('PATCH', url, body),
  del: (url) => apiRequest('DELETE', url),
};

// Reads a Soccer Planner export file chosen by the user and replaces all local
// data with it. Throws an Error with a user-presentable message on failure.
export async function importDataFile(file) {
  let payload;
  try {
    payload = JSON.parse(await file.text());
  } catch {
    throw new Error('That file is not valid JSON. Choose a Soccer Planner export file.');
  }
  return api.post('/api/data/import', payload);
}

// Reads an AYSO "Team Directory" report (.rtf) chosen by the user and adds
// any roster players it lists that aren't already in the roster.
export async function importRosterRtf(file) {
  const rtf = await file.text();
  return api.post('/api/players/import-rtf', { rtf });
}
