import { useState, useEffect } from 'react';
import { API_BASE } from '../lib/api';

type MeUser = { id: number; email: string; username: string } | null;

export const useAuth = () => {
  const [user, setUser] = useState<MeUser>(null);
  const [loading, setLoading] = useState(true);

  const loadMe = async () => {
    try {
      const token = localStorage.getItem('app_token');
      if (!token) {
        setUser(null);
        setLoading(false);
        return;
      }
      // Add a timeout so the UI doesn't hang forever if API is unreachable
      const controller = new AbortController();
      const timer = setTimeout(() => controller.abort(), 6000);
      const res = await fetch(`${API_BASE}/api/auth/me`, {
        headers: { Authorization: `Bearer ${token}` },
        signal: controller.signal,
      });
      clearTimeout(timer);
      if (!res.ok) {
        setUser(null);
        setLoading(false);
        return;
      }
      const js = await res.json();
      setUser(js.user || null);
    } catch {
      setUser(null);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadMe();
    // listen to storage changes in case another tab logs in/out
    const onStorage = (e: StorageEvent) => {
      if (e.key === 'app_token') loadMe();
    };
    // also listen to a custom event within the same tab (storage does not fire on same document)
    const onAuthChanged = () => loadMe();
    window.addEventListener('storage', onStorage);
    window.addEventListener('auth-changed', onAuthChanged as EventListener);
    return () => {
      window.removeEventListener('storage', onStorage);
      window.removeEventListener('auth-changed', onAuthChanged as EventListener);
    };
  }, []);

  const signOut = async () => {
    localStorage.removeItem('app_token');
    localStorage.removeItem('app_user_id');
    localStorage.removeItem('app_user_email');
    setUser(null);
    // notify all useAuth instances in this tab
    try { window.dispatchEvent(new Event('auth-changed')); } catch (_e) { /* ignore */ }
  };

  return { user, loading, signOut };
};
