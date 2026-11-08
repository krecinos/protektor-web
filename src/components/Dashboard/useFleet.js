import { useEffect, useState } from 'react';
import { api } from '../../api';
export default function useFleet() {
  const [retry, setRetry] = useState(0);
  const [state, setState] = useState({ data: null, loading: true, refreshing: false, error: null, now: Date.now() });
  useEffect(() => {
    let disposed = false, timer, controller;
    const refresh = async () => {
      clearTimeout(timer);
      if (document.hidden || disposed) return;
      controller = new AbortController();
      const current = controller;
      const timeout = setTimeout(() => current.abort(), 30000);
      setState(s => ({ ...s, refreshing: true }));
      try {
        const [me, devices, positions, maintenance] = await Promise.allSettled([api.whoami(current.signal), api.allActiveDevices(current.signal), api.positions(current.signal), api.maintenanceStatus(current.signal)]);
        if (disposed || current !== controller || document.hidden) return;
        const results = [me, devices, positions, maintenance];
        const session = results.find(r => r.status === 'rejected' && r.reason.status === 401);
        if (session) throw session.reason;
        for (const result of [me, devices, positions]) if (result.status === 'rejected') throw result.reason;
        setState({ data: { me: me.value, devices: devices.value, positions: positions.value, maintenance: maintenance.status === 'fulfilled' ? maintenance.value : null }, loading: false, refreshing: false, error: null, now: Date.now(), updated: Date.now() });
      } catch (error) {
        if (!disposed && current === controller && !document.hidden) setState(s => ({ ...s, data: error.status === 401 ? null : s.data, loading: false, refreshing: false, error, now: Date.now() }));
        if (error.status === 401) return;
      } finally { clearTimeout(timeout); }
      if (!disposed && !document.hidden) timer = setTimeout(refresh, 60000);
    };
    const visibility = () => { clearTimeout(timer); controller?.abort(); controller = null; if (!document.hidden) refresh(); };
    refresh();
    document.addEventListener('visibilitychange', visibility);
    return () => { disposed = true; clearTimeout(timer); controller?.abort(); document.removeEventListener('visibilitychange', visibility); };
  }, [retry]);
  return { ...state, refresh: () => setRetry(v => v + 1) };
}
