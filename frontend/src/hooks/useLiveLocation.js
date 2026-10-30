import { useCallback, useEffect, useRef, useState } from 'react';

export default function useLiveLocation() {
  const watch = useRef(null);
  const version = useRef(0);
  const [position, setPosition] = useState(null);
  const [status, setStatus] = useState('idle');
  const [error, setError] = useState(null);
  const start = useCallback(() => {
    const currentVersion = ++version.current;
    if (!navigator.geolocation) {
      setError('Location is unavailable. Search for your area or place the pin on the map.');
      setStatus('error');
      return;
    }
    if (watch.current !== null) navigator.geolocation.clearWatch(watch.current);
    setStatus('locating');
    setError(null);
    watch.current = navigator.geolocation.watchPosition(({ coords }) => {
      if (version.current !== currentVersion) return;
      setPosition({ lat: coords.latitude, lng: coords.longitude, accuracy: coords.accuracy });
      setStatus('tracking');
      setError(null);
    }, failure => {
      if (version.current !== currentVersion) return;
      setStatus('error');
      setError(failure.code === 1
        ? 'Location permission is blocked. Allow location in your browser, or search and place the pin manually.'
        : 'Could not get a GPS fix. Search for your area or place the pin manually.');
    }, { enableHighAccuracy: true, maximumAge: 5000, timeout: 12000 });
  }, []);
  useEffect(() => () => {
    version.current++;
    if (watch.current !== null) navigator.geolocation.clearWatch(watch.current);
  }, []);
  const stop = useCallback(() => {
    version.current++;
    if (watch.current !== null) navigator.geolocation.clearWatch(watch.current);
    watch.current = null;
    setStatus('idle');
    setPosition(null);
    setError(null);
  }, []);
  return { position, status, error, start, stop };
}
