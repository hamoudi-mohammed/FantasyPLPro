// Simple API client to talk to our Express backend using JWT from localStorage
export const API_BASE = import.meta.env.VITE_API_URL || `http://${window.location.hostname}:3001`;

// Small utility to avoid hanging requests in dev when API restarts or is unreachable
async function fetchWithTimeout(input: RequestInfo | URL, init: RequestInit = {}, ms = 7000) {
  const controller = new AbortController();
  const t = setTimeout(() => controller.abort(), ms);
  try {
    const res = await fetch(input, { ...init, signal: controller.signal });
    return res;
  } finally {
    clearTimeout(t);
  }
}

function authHeaders() {
  const token = localStorage.getItem('app_token');
  const h: Record<string, string> = { 'Content-Type': 'application/json' };
  if (token) h['Authorization'] = `Bearer ${token}`;
  return h;
}

export async function createGroup(name: string): Promise<{ id: number; code: string }> {
  const res = await fetchWithTimeout(`${API_BASE}/api/groups`, {
    method: 'POST',
    headers: authHeaders(),
    body: JSON.stringify({ name }),
  });
  if (!res.ok) {
    const data = await res.json().catch(() => ({}));
    const msg = data?.error || `failed_create_group (${res.status})`;
    throw new Error(msg);
  }
  return res.json();
}

export async function joinGroup(code: string): Promise<{ success: boolean; group: { id: number; name: string } }> {
  const res = await fetchWithTimeout(`${API_BASE}/api/groups/join`, {
    method: 'POST',
    headers: authHeaders(),
    body: JSON.stringify({ code }),
  });
  if (!res.ok) {
    const data = await res.json().catch(() => ({}));
    throw new Error(data?.error || 'failed_join');
  }
  return res.json();
}

export async function listMyGroups(): Promise<{ groups: Array<{ id: number; name: string; code: string; created_at: string; member_count: number }> }> {
  const res = await fetchWithTimeout(`${API_BASE}/api/groups/mine`, { headers: authHeaders() });
  if (!res.ok) {
    const data = await res.json().catch(() => ({}));
    const msg = data?.error || `failed_list_groups (${res.status})`;
    throw new Error(msg);
  }
  return res.json();
}

export async function getLatestScore(groupId: number): Promise<{ latest: { round_number: number; total_points: number } | null }> {
  const res = await fetchWithTimeout(`${API_BASE}/api/groups/${groupId}/scores/latest`, { headers: authHeaders() });
  if (!res.ok) throw new Error('failed_latest_score');
  return res.json();
}

export async function saveScore(groupId: number, payload: {
  round_number: number;
  round_points: number;
  total_points: number;
  expensive_player_name?: string | null;
  expensive_player_points?: number | null;
}) {
  const res = await fetchWithTimeout(`${API_BASE}/api/groups/${groupId}/scores`, {
    method: 'POST',
    headers: authHeaders(),
    body: JSON.stringify(payload),
  });
  if (!res.ok) throw new Error('failed_save_score');
  return res.json();
}

export async function listMessages(groupId: number): Promise<{ messages: Array<{ id: number; user_id: number; content: string; created_at: string }> }> {
  const res = await fetchWithTimeout(`${API_BASE}/api/groups/${groupId}/messages`, { headers: authHeaders() });
  if (!res.ok) throw new Error('failed_list_messages');
  return res.json();
}

export async function sendMessage(groupId: number, content: string) {
  const res = await fetchWithTimeout(`${API_BASE}/api/groups/${groupId}/messages`, {
    method: 'POST',
    headers: authHeaders(),
    body: JSON.stringify({ content }),
  });
  if (!res.ok) throw new Error('failed_send_message');
  return res.json();
}

export async function getRankings(groupId: number, round?: number): Promise<{ rankings: Array<{ user_id: number; username?: string; total_points: number; rounds_played: number; average_points: number; latest_round_points?: number }>; summary: { members: number; currentRound: number } }> {
  const qs = typeof round === 'number' ? `?round=${encodeURIComponent(String(round))}` : '';
  const res = await fetchWithTimeout(`${API_BASE}/api/groups/${groupId}/rankings${qs}`, { headers: authHeaders() });
  if (!res.ok) throw new Error('failed_rankings');
  return res.json();
}

export async function getUserRounds(groupId: number, userId: number): Promise<{ rounds: Array<{ round: number; round_points: number; total_points: number; expensive_player_name?: string | null; expensive_player_points?: number | null; created_at: string }> }> {
  const res = await fetchWithTimeout(`${API_BASE}/api/groups/${groupId}/rankings/${userId}/rounds`, { headers: authHeaders() });
  if (!res.ok) throw new Error('failed_user_rounds');
  return res.json();
}

// Upload a voice message
export async function sendVoiceMessage(groupId: number, blob: Blob, ext: string = 'webm'): Promise<{ url: string }> {
  const token = localStorage.getItem('app_token');
  if (!token) throw new Error('no_token');
  // Try raw binary upload first
  try {
    const res = await fetchWithTimeout(`${API_BASE}/api/groups/${groupId}/messages/audio?ext=${encodeURIComponent(ext)}`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${token}`,
        'Content-Type': blob.type || 'application/octet-stream',
      },
      body: blob,
    });
    if (res.ok) {
      const js = await res.json();
      return { url: js?.url };
    }
  } catch (_e) {
    // fallthrough to base64
  }

  // Fallback: base64 JSON upload
  const b64 = await new Promise<string>((resolve, reject) => {
    const fr = new FileReader();
    fr.onerror = () => reject(new Error('b64_read_error'));
    fr.onload = () => resolve(String(fr.result || '').toString());
    fr.readAsDataURL(blob);
  });
  const res2 = await fetchWithTimeout(`${API_BASE}/api/groups/${groupId}/messages/audio-b64`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${token}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ data: b64, ext }),
  });
  if (!res2.ok) {
    const data = await res2.json().catch(() => ({}));
    throw new Error(data?.error || 'failed_voice_upload');
  }
  const js = await res2.json();
  return { url: js?.url };
}
