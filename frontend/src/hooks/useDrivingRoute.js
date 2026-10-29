import { useEffect, useRef, useState } from 'react';
export default function useDrivingRoute(origin, destination) {
  const [result, setResult] = useState({
    status: 'idle',
    route: null
  });
  const lastFetch = useRef({
    time: 0,
    destination: ''
  });
  const lat = origin?.lat,
    lng = origin?.lng;
  const endLat = destination?.lat,
    endLng = destination?.lng;
  const enabled = [lat, lng, endLat, endLng].every(Number.isFinite);
  useEffect(() => {
    if (!enabled) return;
    const controller = new AbortController();
    const key = `${endLat},${endLng}`;
    const delay = lastFetch.current.destination === key ? Math.max(0, 10000 - (Date.now() - lastFetch.current.time)) : 0;
    const timer = setTimeout(async () => {
      lastFetch.current = {
        time: Date.now(),
        destination: key
      };
      setResult(previous => ({
        ...previous,
        status: 'loading'
      }));
      try {
        const base = import.meta.env.DEV ? '/_geo/route' : 'https://router.project-osrm.org';
        const response = await fetch(`${base}/route/v1/driving/${lng},${lat};${endLng},${endLat}?overview=full&geometries=geojson&steps=true`, {
          signal: AbortSignal.any([controller.signal, AbortSignal.timeout(10000)])
        });
        if (!response.ok) throw new Error('Route unavailable');
        const data = await response.json();
        if (!data.routes?.length) throw new Error('No road route');
        if (!controller.signal.aborted) setResult({
          status: 'ready',
          route: {
            ...data.routes[0],
            destinationKey: key
          }
        });
      } catch {
        if (!controller.signal.aborted) setResult({
          status: 'error',
          route: null
        });
      }
    }, delay);
    return () => {
      clearTimeout(timer);
      controller.abort();
    };
  }, [lat, lng, endLat, endLng, enabled]);
  return enabled ? result : {
    status: 'idle',
    route: null
  };
}
