/**
 * Robust Multi-Provider Geocoding Service for WorkNest
 * Features:
 * - Ultra-fast Photon Komoot (Elasticsearch OSM) with India location bias
 * - Open-Meteo worldwide geocoding fallback
 * - Indian Postal PIN code resolution (6-digit PIN)
 * - Intelligent progressive query relaxation
 * - Nominatim lookup with safe abort timeout
 * - Resilient multi-source reverse geocoding (Nominatim + BigDataCloud)
 * - Rich deduplicated live autocomplete suggestions
 */

const STOPWORDS = new Set([
  'of', 'and', '&', 'the', 'in', 'at', 'near', 'behind', 
  'opposite', 'opp', 'to', 'for', 'beside', 'next', 'road', 'rd'
]);

// Default coordinates for India geographic center to bias searches when user location is unknown
const DEFAULT_INDIA_BIAS = { lat: 22.7196, lon: 75.8577 };

/**
 * Searches for a location using a multi-tier fallback pipeline.
 * Resolves complex, informal, or long queries (e.g., college names, apartment complexes).
 */
export async function smartSearchLocation(rawQuery, biasCoords = null) {
  const query = (rawQuery || '').trim();
  if (!query) return null;

  const bias = biasCoords || DEFAULT_INDIA_BIAS;

  // 1. Check if query is a 6-digit Indian Postal PIN Code
  if (/^\d{6}$/.test(query)) {
    try {
      const pinRes = await fetch(`https://api.postalpincode.in/pincode/${query}`, {
        signal: AbortSignal.timeout(3000)
      });
      if (pinRes.ok) {
        const pinData = await pinRes.json();
        if (pinData?.[0]?.Status === 'Success' && pinData[0]?.PostOffice?.length > 0) {
          const po = pinData[0].PostOffice[0];
          const pinLocationQuery = `${po.Name}, ${po.District}, ${po.State}, India`;
          // Geocode the resolved post office location
          const geocoded = await searchPhoton(pinLocationQuery, bias);
          if (geocoded) return geocoded;
        }
      }
    } catch (e) {
      console.warn('PIN code lookup error:', e);
    }
  }

  // 2. Try Photon Komoot API with India location bias (ultra-fast, fuzzy)
  try {
    const photonResult = await searchPhoton(query, bias);
    if (photonResult) return photonResult;
  } catch (err) {
    console.warn('Photon primary search error:', err);
  }

  // 3. Progressive query relaxation on Photon
  // Break down query, strip stopwords, and try distinctive keyword combinations
  const words = query
    .split(/[, -]+/)
    .map(w => w.trim())
    .filter(w => w && !STOPWORDS.has(w.toLowerCase()));

  if (words.length >= 3) {
    const candidates = [
      `${words[0]} ${words[1]} ${words[words.length - 1]}`,
      `${words[0]} ${words[words.length - 2]} ${words[words.length - 1]}`,
      `${words.slice(0, 3).join(' ')} ${words[words.length - 1]}`,
      `${words[0]} ${words[words.length - 1]}`
    ];

    for (const cand of candidates) {
      if (cand.toLowerCase() === query.toLowerCase()) continue;
      try {
        const candResult = await searchPhoton(cand, bias);
        if (candResult) return candResult;
      } catch (e) {
        // Continue to next candidate
      }
    }
  }

  // 4. Try Open-Meteo Geocoding API (Fast worldwide cities, towns & landmarks)
  try {
    const omRes = await fetch(
      `https://geocoding-api.open-meteo.com/v1/search?name=${encodeURIComponent(query)}&count=5&language=en&format=json`,
      { signal: AbortSignal.timeout(3000) }
    );
    if (omRes.ok) {
      const omData = await omRes.json();
      if (omData?.results && omData.results.length > 0) {
        // Prioritize India
        const inMatch = omData.results.find(r => r.country_code === 'IN') || omData.results[0];
        return formatOpenMeteoResult(inMatch);
      }
    }
  } catch (err) {
    console.warn('Open-Meteo search error:', err);
  }

  // 5. Try Nominatim with exact query and 3.5s timeout
  try {
    const res = await fetch(
      `https://nominatim.openstreetmap.org/search?format=json&q=${encodeURIComponent(query)}&countrycodes=in&limit=3`,
      { 
        headers: { 'Accept-Language': 'en' },
        signal: AbortSignal.timeout(3500)
      }
    );
    if (res.ok) {
      const data = await res.json();
      if (Array.isArray(data) && data.length > 0) {
        return formatNominatimResult(data[0]);
      }
    }
  } catch (err) {
    console.warn('Nominatim exact search error:', err);
  }

  return null;
}

/**
 * Helper to query Photon with India bias and result prioritization
 */
async function searchPhoton(query, bias) {
  const biasParams = bias ? `&lat=${bias.lat}&lon=${bias.lon}` : '';
  const pRes = await fetch(
    `https://photon.komoot.io/api/?q=${encodeURIComponent(query)}${biasParams}&limit=6`,
    { signal: AbortSignal.timeout(3500) }
  );
  if (!pRes.ok) return null;
  const pData = await pRes.json();
  if (pData?.features && pData.features.length > 0) {
    // Prioritize Indian results
    const inFeats = pData.features.filter(
      f => f.properties?.countrycode === 'IN' || f.properties?.country === 'India'
    );
    const chosen = inFeats.length > 0 ? inFeats[0] : pData.features[0];
    return formatPhotonResult(chosen);
  }
  return null;
}

/**
 * Fetches auto-complete suggestions from Photon & Open-Meteo with deduplication.
 * Safe for live keystroke typing (does not spam Nominatim).
 */
export async function getLiveSearchSuggestions(rawQuery, biasCoords = null) {
  const query = (rawQuery || '').trim();
  if (!query || query.length < 2) return [];

  const bias = biasCoords || DEFAULT_INDIA_BIAS;
  const results = [];
  const seenCoords = new Set();

  const addResult = (item) => {
    if (!item || !item.lat || !item.lon) return;
    const key = `${parseFloat(item.lat).toFixed(3)},${parseFloat(item.lon).toFixed(3)}`;
    if (!seenCoords.has(key)) {
      seenCoords.add(key);
      results.push(item);
    }
  };

  // 1. Fetch Photon autocomplete suggestions with bias
  try {
    const biasParams = bias ? `&lat=${bias.lat}&lon=${bias.lon}` : '';
    const pRes = await fetch(
      `https://photon.komoot.io/api/?q=${encodeURIComponent(query)}${biasParams}&limit=6`,
      { signal: AbortSignal.timeout(2800) }
    );
    if (pRes.ok) {
      const pData = await pRes.json();
      if (pData?.features) {
        // Prioritize India
        const inFeats = pData.features.filter(
          f => f.properties?.countrycode === 'IN' || f.properties?.country === 'India' || !f.properties?.countrycode
        );
        const listToUse = inFeats.length > 0 ? inFeats : pData.features;
        listToUse.forEach(f => addResult(formatPhotonResult(f)));
      }
    }
  } catch (err) {
    // Continue to next provider
  }

  // 2. Fetch Open-Meteo suggestions if fewer than 4 results
  if (results.length < 4) {
    try {
      const omRes = await fetch(
        `https://geocoding-api.open-meteo.com/v1/search?name=${encodeURIComponent(query)}&count=5&language=en&format=json`,
        { signal: AbortSignal.timeout(2500) }
      );
      if (omRes.ok) {
        const omData = await omRes.json();
        if (omData?.results) {
          omData.results.forEach(r => addResult(formatOpenMeteoResult(r)));
        }
      }
    } catch (err) {
      // Ignore
    }
  }

  return results.slice(0, 6);
}

/**
 * Resilient reverse geocoding to human-readable address.
 * Primary: Nominatim with timeout. Fallback: BigDataCloud.
 */
export async function reverseGeocodeLocation(lat, lng) {
  if (!lat || !lng) return 'Unknown Location';

  // 1. Try Nominatim reverse
  try {
    const res = await fetch(
      `https://nominatim.openstreetmap.org/reverse?format=json&lat=${lat}&lon=${lng}`,
      {
        headers: { 'Accept-Language': 'en' },
        signal: AbortSignal.timeout(2800)
      }
    );
    if (res.ok) {
      const data = await res.json();
      if (data && data.display_name) {
        const addr = data.address || {};
        const area = addr.suburb || addr.neighbourhood || addr.road || addr.quarter || '';
        const city = addr.city || addr.town || addr.county || '';
        const shortName = [area, city].filter(Boolean).join(', ');
        return {
          short_name: shortName || data.display_name.split(',').slice(0, 3).join(','),
          display_name: data.display_name
        };
      }
    }
  } catch (e) {
    // Continue to BigDataCloud
  }

  // 2. Fallback to BigDataCloud reverse geocode (high reliability, no auth needed)
  try {
    const bdcRes = await fetch(
      `https://api.bigdatacloud.net/data/reverse-geocode-client?latitude=${lat}&longitude=${lng}&localityLanguage=en`,
      { signal: AbortSignal.timeout(2500) }
    );
    if (bdcRes.ok) {
      const d = await bdcRes.json();
      const area = d.locality || d.city || '';
      const state = d.principalSubdivision || '';
      const country = d.countryName || 'India';
      const shortName = [area, state].filter(Boolean).join(', ');
      const fullName = [area, state, country].filter(Boolean).join(', ');
      if (shortName) {
        return {
          short_name: shortName,
          display_name: fullName
        };
      }
    }
  } catch (e) {
    // Ignore
  }

  return {
    short_name: `${lat.toFixed(4)}, ${lng.toFixed(4)}`,
    display_name: `Location at ${lat.toFixed(4)}, ${lng.toFixed(4)}`
  };
}

/**
 * Resilient Network/IP-based geolocation fallback.
 * Works instantly (150-250ms) across HTTP & HTTPS without requiring satellite GPS or browser permission.
 * Primary: ipwho.is (CORS enabled, city + coords)
 * Fallback: geojs.io (CORS enabled worldwide CDN)
 */
export async function getApproximateIpLocation() {
  // 1. Try ipwho.is via same-origin proxy (avoids CORS/cert issues on mobile)
  try {
    console.log('[IP-GEO] Fetching ipwho via proxy /_geo/ipwho ...');
    const res = await fetch('/_geo/ipwho', {
      signal: AbortSignal.timeout(4000)
    });
    console.log('[IP-GEO] ipwho proxy response status:', res.status);
    if (res.ok) {
      const d = await res.json();
      console.log('[IP-GEO] ipwho data:', d?.city, d?.latitude, d?.longitude, 'success:', d?.success);
      if (d && d.success !== false && d.latitude && d.longitude) {
        const lat = parseFloat(d.latitude);
        const lng = parseFloat(d.longitude);
        const city = d.city || d.region || 'Current Location';
        const region = d.region || '';
        const country = d.country || 'India';
        const shortName = [city, region].filter(Boolean).join(', ');
        const fullName = [city, region, country].filter(Boolean).join(', ');
        return {
          lat,
          lng,
          city: city,
          region: region,
          short_name: shortName || city,
          display_name: fullName || shortName,
          source: 'ip_network'
        };
      }
    }
  } catch (e) {
    console.warn('[IP-GEO] ipwho proxy FAILED:', e?.message || e);
  }

  // 2. Try geojs.io via same-origin proxy
  try {
    console.log('[IP-GEO] Fetching geojs via proxy /_geo/geojs ...');
    const res = await fetch('/_geo/geojs', {
      signal: AbortSignal.timeout(4000)
    });
    console.log('[IP-GEO] geojs proxy response status:', res.status);
    if (res.ok) {
      const d = await res.json();
      console.log('[IP-GEO] geojs data:', d?.city, d?.latitude, d?.longitude);
      if (d && d.latitude && d.longitude) {
        const lat = parseFloat(d.latitude);
        const lng = parseFloat(d.longitude);
        const city = d.city || d.region || 'Current Location';
        const region = d.region || '';
        const country = d.country || 'India';
        const shortName = [city, region].filter(Boolean).join(', ');
        const fullName = [city, region, country].filter(Boolean).join(', ');
        return {
          lat,
          lng,
          city: city,
          region: region,
          short_name: shortName || city,
          display_name: fullName || shortName,
          source: 'ip_network'
        };
      }
    }
  } catch (e) {
    console.warn('[IP-GEO] geojs proxy FAILED:', e?.message || e);
  }

  // 3. Try ip-api.com via same-origin proxy
  try {
    console.log('[IP-GEO] Fetching ip-api via proxy /_geo/ipapi ...');
    const res = await fetch('/_geo/ipapi', {
      signal: AbortSignal.timeout(4000)
    });
    console.log('[IP-GEO] ip-api proxy response status:', res.status);
    if (res.ok) {
      const d = await res.json();
      console.log('[IP-GEO] ip-api data:', d);
      if (d && d.status === 'success' && d.lat && d.lon) {
        return {
          lat: parseFloat(d.lat),
          lng: parseFloat(d.lon),
          city: d.city || 'Current Location',
          region: d.regionName || '',
          short_name: [d.city, d.regionName].filter(Boolean).join(', '),
          display_name: [d.city, d.regionName, d.country].filter(Boolean).join(', '),
          source: 'ip_network'
        };
      }
    }
  } catch (e) {
    console.warn('[IP-GEO] ip-api proxy FAILED:', e?.message || e);
  }

  // 4. Direct fetch fallback (in case proxies aren't configured, e.g. production)
  try {
    console.log('[IP-GEO] Trying direct fetch to ipwho.is...');
    const res = await fetch('https://ipwho.is/', {
      signal: AbortSignal.timeout(4000)
    });
    if (res.ok) {
      const d = await res.json();
      if (d && d.success !== false && d.latitude && d.longitude) {
        const lat = parseFloat(d.latitude);
        const lng = parseFloat(d.longitude);
        const city = d.city || d.region || 'Current Location';
        const region = d.region || '';
        const country = d.country || 'India';
        return {
          lat, lng, city, region,
          short_name: [city, region].filter(Boolean).join(', '),
          display_name: [city, region, country].filter(Boolean).join(', '),
          source: 'ip_network'
        };
      }
    }
  } catch (e) {
    console.warn('[IP-GEO] Direct ipwho.is FAILED:', e?.message || e);
  }

  console.error('[IP-GEO] All IP geolocation providers failed');
  return null;
}

function formatNominatimResult(item) {
  const parts = (item.display_name || '').split(',');
  const shortName = parts.slice(0, 3).join(',').trim();
  return {
    place_id: item.place_id ? `nom_${item.place_id}` : String(Math.random()),
    lat: parseFloat(item.lat),
    lon: parseFloat(item.lon),
    display_name: item.display_name,
    short_name: shortName || item.display_name,
    primary: parts[0]?.trim() || item.display_name,
    secondary: parts.slice(1, 4).join(',').trim() || ''
  };
}

function formatPhotonResult(f) {
  const [lon, lat] = f.geometry.coordinates;
  const p = f.properties || {};
  const nameParts = [
    p.name,
    p.street,
    p.locality || p.district,
    p.city,
    p.state,
    p.country
  ].filter(Boolean);

  const displayName = nameParts.join(', ');
  const shortName = [p.name, p.street, p.city || p.locality].filter(Boolean).join(', ');
  const secondary = [p.street, p.locality || p.district, p.city, p.state].filter(Boolean).join(', ');

  return {
    place_id: p.osm_id ? `osm_${p.osm_id}` : String(Math.random()),
    lat,
    lon,
    display_name: displayName || p.name || 'Found Location',
    short_name: shortName || displayName || 'Found Location',
    primary: p.name || displayName || 'Location',
    secondary: secondary || p.city || p.state || ''
  };
}

function formatOpenMeteoResult(r) {
  const nameParts = [r.name, r.admin1, r.country].filter(Boolean);
  const displayName = nameParts.join(', ');
  const secondary = [r.admin1, r.country].filter(Boolean).join(', ');
  return {
    place_id: r.id ? `om_${r.id}` : String(Math.random()),
    lat: r.latitude,
    lon: r.longitude,
    display_name: displayName,
    short_name: `${r.name}, ${r.admin1 || r.country || ''}`,
    primary: r.name,
    secondary: secondary
  };
}
