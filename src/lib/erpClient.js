/**
 * src/lib/erpClient.js
 * Frontend Client Layer for DSU ERP Attendance Service.
 * Provides caching, sanitization, and standardized error handling.
 */

const DEFAULT_TTL_MS = 15 * 60 * 1000; // 15 minutes
export const CACHE_KEY = 'dsu_attendance_cache';

export function sanitizeUsn(usn) {
  if (!usn || typeof usn !== 'string') return '';
  return usn.trim().toUpperCase();
}

export function isCacheValid(cachedEntry, ttlMs = DEFAULT_TTL_MS) {
  if (!cachedEntry || typeof cachedEntry !== 'object') return false;
  if (!cachedEntry.timestamp || !cachedEntry.data) return false;
  return (Date.now() - cachedEntry.timestamp) <= ttlMs;
}

export function clearAttendanceCache(storage = (typeof localStorage !== 'undefined' ? localStorage : null)) {
  if (!storage) return;
  try {
    storage.removeItem(CACHE_KEY);
  } catch (err) {
    console.error('Failed to clear attendance cache:', err);
  }
}

export async function fetchAttendance(credentials, options = {}) {
  const { username, password } = credentials || {};
  const cleanUsn = sanitizeUsn(username);
  const rawPassword = password || '';
  const storage = options.storage || (typeof localStorage !== 'undefined' ? localStorage : null);
  const ttlMs = options.ttlMs || DEFAULT_TTL_MS;
  const baseUrl = options.baseUrl || '';
  const apiUrl = `${baseUrl}/api/erp/attendance`;

  if (!cleanUsn || !rawPassword) {
    return {
      success: false,
      error: 'Username and password are required'
    };
  }

  // 1. Check client-side storage cache
  if (!options.bypassCache && storage) {
    try {
      const rawCached = storage.getItem(CACHE_KEY);
      if (rawCached) {
        const cached = JSON.parse(rawCached);
        if (isCacheValid(cached, ttlMs) && cached.data?.usn === cleanUsn) {
          return { ...cached.data, fromCache: true };
        }
      }
    } catch {
      try { storage.removeItem(CACHE_KEY); } catch {}
    }
  }

  // 2. Dispatch API request
  let res;
  try {
    res = await fetch(apiUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Accept': 'application/json'
      },
      body: JSON.stringify({ username: cleanUsn, password: rawPassword }),
      signal: options.signal || (options.timeoutMs ? AbortSignal.timeout(options.timeoutMs) : undefined)
    });
  } catch (err) {
    return {
      success: false,
      error: `Network error. Unable to reach DSU ERP server: ${err.message}`
    };
  }

  let data;
  try {
    data = await res.json();
  } catch {
    return {
      success: false,
      error: `Unexpected server response (HTTP ${res.status})`
    };
  }

  // 3. Cache successful response in client storage
  if (res.ok && data?.success && storage) {
    try {
      storage.setItem(CACHE_KEY, JSON.stringify({
        timestamp: Date.now(),
        data
      }));
    } catch (e) {
      console.warn('Storage quota exceeded; attendance not cached:', e.message);
    }
  }

  return data;
}

export default {
  CACHE_KEY,
  sanitizeUsn,
  isCacheValid,
  clearAttendanceCache,
  fetchAttendance
};
