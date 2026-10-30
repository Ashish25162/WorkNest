import { useEffect, useRef, useState } from 'react';
import { getLiveSearchSuggestions, getNearbyLocations } from '../utils/geoService';

export default function useLocationSearch(coords) {
  const [query, setQuery] = useState('');
  const [suggestions, setSuggestions] = useState([]);
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [nearby, setNearby] = useState(false);
  const [revision, setRevision] = useState(0);
  const request = useRef(0);
  const lat = coords?.[0];
  const lng = coords?.[1];
  useEffect(() => {
    const version = ++request.current;
    let cancelled = false;
    if (!open) return;
    const timer = setTimeout(async () => {
      setLoading(true);
      setError(null);
      try {
        const results = !nearby && query.trim().length >= 2
          ? await getLiveSearchSuggestions(query, { lat, lon: lng })
          : await getNearbyLocations(lat, lng);
        if (!cancelled && request.current === version) setSuggestions(results);
      } catch {
        if (!cancelled && request.current === version) { setSuggestions([]); setError('Place search could not connect. Please try again.'); }
      } finally {
        if (!cancelled && request.current === version) setLoading(false);
      }
    }, query.trim() ? 250 : 0);
    return () => { clearTimeout(timer); cancelled = true; };
  }, [query, open, lat, lng, nearby, revision]);
  const change = value => {
    request.current++;
    setQuery(value);
    setNearby(!value.trim());
    setSuggestions([]);
    setLoading(true);
    setRevision(value => value + 1);
    setOpen(true);
  };
  const close = () => { request.current++; setOpen(false); setSuggestions([]); setLoading(false); };
  return { query, setQuery, suggestions, open, loading, error, nearby, change, close, focus: () => { request.current++; setNearby(true); setOpen(true); setLoading(true); setRevision(value => value + 1); } };
}
