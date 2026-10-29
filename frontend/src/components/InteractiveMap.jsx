import React, { useEffect, useState, useMemo, useCallback, useRef } from 'react';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';
import { smartSearchLocation, getLiveSearchSuggestions, reverseGeocodeLocation, getApproximateIpLocation } from '../utils/geoService';
import { apiUrl } from '../utils/api';

// Default center: Indore, Madhya Pradesh
const DEFAULT_CENTER = [22.7196, 75.8577];

// Official OpenStreetMap Tile Layer (100% Free & Open-Source, Zero API Keys)
const TILE_URL = 'https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png';
const TILE_SUBDOMAINS = 'abc';
const TILE_ATTR = '&copy; <a href="https://www.openstreetmap.org/copyright" target="_blank" rel="noreferrer">OpenStreetMap</a> contributors';

export default function InteractiveMap({
  workers = [],
  activeBooking = null,
  setActiveBooking = null,
  currentUser = null,
  bookingLocation = null,
  setBookingLocation = null,
  serviceAddress = '',
  setServiceAddress = null,
  broadcasts = [],
  selectedJob = null,
  onSelectJob = null,
  onAcceptJob = null,
  refreshData = null,
  onSwitchToForm = null,
  mobileTab = 'form'
}) {
  const mapContainerRef = useRef(null);
  const mapInstanceRef = useRef(null);
  const markersLayerRef = useRef(null);
  const routeLayerRef = useRef(null);

  const [customerPos, setCustomerPos] = useState(null);
  const [addressText, setAddressText] = useState(serviceAddress || 'Indore, Madhya Pradesh');
  const [searchInput, setSearchInput] = useState('');
  const [isSearching, setIsSearching] = useState(false);
  const [isDragging, setIsDragging] = useState(false);
  const [isConfirmed, setIsConfirmed] = useState(false);
  const [isLocating, setIsLocating] = useState(false);
  const [locateSuccessPill, setLocateSuccessPill] = useState(false);
  const [locateMessage, setLocateMessage] = useState('Location centered & pinned!');
  const [locationError, setLocationError] = useState(null);
  const [permissionNotice, setPermissionNotice] = useState(false);
  const [suggestions, setSuggestions] = useState([]);
  const [showSuggestions, setShowSuggestions] = useState(false);
  const [routeInfo, setRouteInfo] = useState(null); // { distance: '2.4 km', duration: '8 mins' }
  const [isAcceptingJob, setIsAcceptingJob] = useState(false);

  const suggestionsTimerRef = useRef(null);
  const hasInitialLocatedRef = useRef(false);
  const isUserInteractingRef = useRef(false);

  // Quick Indian City Chips
  const quickCities = useMemo(() => [
    { name: '📍 Indore', lat: 22.7196, lng: 75.8577, addr: 'Indore, Madhya Pradesh' },
    { name: '📍 Bhopal', lat: 23.2599, lng: 77.4126, addr: 'Bhopal, Madhya Pradesh' },
    { name: '📍 Delhi NCR', lat: 28.6139, lng: 77.2090, addr: 'New Delhi, Delhi' },
    { name: '📍 Mumbai', lat: 19.0760, lng: 72.8777, addr: 'Mumbai, Maharashtra' },
    { name: '📍 Bangalore', lat: 12.9716, lng: 77.5946, addr: 'Bangalore, Karnataka' },
  ], []);

  // ── 1. INITIALIZE LEAFLET MAP WITH OPENSTREETMAP TILES ──
  useEffect(() => {
    if (!mapContainerRef.current) return;
    if (mapInstanceRef.current) return; // Prevent double init

    const initialLat = bookingLocation ? bookingLocation[0] : DEFAULT_CENTER[0];
    const initialLng = bookingLocation ? bookingLocation[1] : DEFAULT_CENTER[1];

    const map = L.map(mapContainerRef.current, {
      center: [initialLat, initialLng],
      zoom: 15,
      zoomControl: false,
      attributionControl: false
    });

    // Add CartoDB Voyager tiles (OpenStreetMap raster)
    L.tileLayer(TILE_URL, {
      maxZoom: 19,
      subdomains: TILE_SUBDOMAINS,
      attribution: TILE_ATTR
    }).addTo(map);

    // Create marker & route layer groups
    markersLayerRef.current = L.layerGroup().addTo(map);
    routeLayerRef.current = L.layerGroup().addTo(map);

    mapInstanceRef.current = map;

    // Drag start listener
    map.on('dragstart', () => {
      isUserInteractingRef.current = true;
      setIsDragging(true);
    });

    // Idle / Move end listener for Customer Doorstep Pinning
    map.on('moveend', () => {
      setIsDragging(false);
      const center = map.getCenter();
      if (!center) return;

      // Only update if customer is picking doorstep location and interaction occurred
      if (currentUser?.role === 'CUSTOMER' && !activeBooking) {
        if (hasInitialLocatedRef.current || isUserInteractingRef.current) {
          const lat = center.lat;
          const lng = center.lng;
          if (setBookingLocation) setBookingLocation([lat, lng]);
          reverseGeocodeLocation(lat, lng).then(data => {
            setAddressText(data.short_name);
            if (setServiceAddress) setServiceAddress(data.display_name);
          }).catch(() => {
            setAddressText(`${lat.toFixed(4)}, ${lng.toFixed(4)}`);
          });
        }
      }
    });

    // Check if browser permission prompt is needed in a secure context
    const isSecure = window.isSecureContext || window.location.protocol === 'https:' || window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1';
    if (isSecure && navigator.permissions && navigator.permissions.query) {
      navigator.permissions.query({ name: 'geolocation' }).then(res => {
        if (res.state === 'prompt') {
          setPermissionNotice(true);
        }
      }).catch(() => {});
    }

    return () => {
      map.remove();
      mapInstanceRef.current = null;
    };
  }, []);

  // ── 1.1 RESPONSIVE RESIZE OBSERVER & MOBILE TAB INVALIDATION ──
  useEffect(() => {
    const handleResize = () => {
      mapInstanceRef.current?.invalidateSize();
    };
    window.addEventListener('resize', handleResize);
    window.addEventListener('orientationchange', handleResize);
    return () => {
      window.removeEventListener('resize', handleResize);
      window.removeEventListener('orientationchange', handleResize);
    };
  }, []);

  useEffect(() => {
    if (mobileTab === 'map' && mapInstanceRef.current) {
      const t1 = setTimeout(() => {
        mapInstanceRef.current?.invalidateSize();
      }, 50);
      const t2 = setTimeout(() => {
        mapInstanceRef.current?.invalidateSize();
      }, 250);
      return () => {
        clearTimeout(t1);
        clearTimeout(t2);
      };
    }
  }, [mobileTab]);

  useEffect(() => {
    if (!mapContainerRef.current) return;
    const observer = new ResizeObserver(() => {
      if (mapInstanceRef.current) {
        mapInstanceRef.current.invalidateSize();
      }
    });
    observer.observe(mapContainerRef.current);
    return () => observer.disconnect();
  }, []);

  // ── 2. REVERSE GEOCODING HELPER ──
  const reverseGeocode = useCallback(async (lat, lng, addressHint = null) => {
    setIsConfirmed(false);
    if (addressHint) {
      setAddressText(addressHint);
      if (setServiceAddress) setServiceAddress(addressHint);
      return;
    }
    try {
      const data = await reverseGeocodeLocation(lat, lng);
      setAddressText(data.short_name);
      if (setServiceAddress) setServiceAddress(data.display_name);
    } catch (e) {
      setAddressText(`${lat.toFixed(4)}, ${lng.toFixed(4)}`);
    }
  }, [setServiceAddress]);

  // ── 3. DETECT & PIN GPS / REAL LOCATION (MULTI-TIER: GPS -> LOW-ACC GPS -> IP FALLBACK) ──
  const pinToCurrentLocation = useCallback((forceFly = false) => {
    setIsLocating(true);
    setLocationError(null);
    setPermissionNotice(false);

    console.log('[LOCATE] pinToCurrentLocation called, forceFly=', forceFly);

    const applyPos = (lat, lng, hint = null, successMsg = 'Location centered & pinned!') => {
      console.log('[LOCATE] ✅ applyPos:', lat, lng, 'hint:', hint, 'msg:', successMsg);
      const pos = { lat, lng };
      setCustomerPos(pos);
      if (setBookingLocation) setBookingLocation([lat, lng]);

      const map = mapInstanceRef.current;
      if (map) {
        map.setView([lat, lng], 16, { animate: true });
        setTimeout(() => map?.invalidateSize(), 150);
      }

      if (hint) {
        setAddressText(hint);
        if (setServiceAddress) setServiceAddress(hint);
      } else {
        reverseGeocode(lat, lng);
      }

      hasInitialLocatedRef.current = true;
      setIsLocating(false);
      setLocateMessage(successMsg);
      setLocateSuccessPill(true);
      setTimeout(() => setLocateSuccessPill(false), 3500);
    };

    const tryIpFallback = async () => {
      console.log('[LOCATE] Attempting IP geolocation fallback...');
      try {
        const ipLoc = await getApproximateIpLocation();
        console.log('[LOCATE] IP geolocation result:', ipLoc);
        if (ipLoc && ipLoc.lat && ipLoc.lng) {
          const label = ipLoc.short_name || ipLoc.city || 'Your Area';
          applyPos(ipLoc.lat, ipLoc.lng, ipLoc.display_name || ipLoc.short_name, `📍 Pinned to ${label}`);
          return true;
        }
      } catch (err) {
        console.error('[LOCATE] IP geolocation error:', err);
      }
      console.warn('[LOCATE] IP geolocation returned null');
      return false;
    };

    const fallbackToDefault = (errorMsg = null) => {
      console.warn('[LOCATE] ⚠️ Falling back to default. Error:', errorMsg);
      setIsLocating(false);
      if (forceFly && errorMsg) {
        setLocationError(errorMsg);
        setTimeout(() => setLocationError(null), 5000);
      }
      if (bookingLocation && bookingLocation.length >= 2) {
        applyPos(bookingLocation[0], bookingLocation[1], serviceAddress || 'Indore, Madhya Pradesh', 'Centered to selected location');
      } else {
        applyPos(DEFAULT_CENTER[0], DEFAULT_CENTER[1], 'Indore, Madhya Pradesh', 'Centered to default city (Indore)');
      }
    };

    // Parallel strategy: fire GPS AND IP simultaneously, use whichever resolves first
    let resolved = false;

    const onResolved = (lat, lng, hint, msg) => {
      if (resolved) return; // first-one-wins
      resolved = true;
      applyPos(lat, lng, hint, msg);
    };

    // Track A: IP geolocation (instant, ~200ms, always works)
    getApproximateIpLocation().then(ipLoc => {
      console.log('[LOCATE] Track A (IP) resolved:', ipLoc);
      if (ipLoc && ipLoc.lat && ipLoc.lng) {
        // Wait 2.5 seconds to give GPS a chance. If GPS hasn't resolved by then, use IP.
        setTimeout(() => {
          if (!resolved) {
            console.log('[LOCATE] GPS still pending after 2.5s, using IP location');
            const label = ipLoc.short_name || ipLoc.city || 'Your Area';
            onResolved(ipLoc.lat, ipLoc.lng, ipLoc.display_name || label, `📍 Approx ISP area: ${label} (Search above for exact doorstep)`);
          }
        }, 2500);
      }
    }).catch(err => {
      console.warn('[LOCATE] Track A (IP) error:', err);
    });

    // Track B: Browser geolocation
    if (navigator.geolocation) {
      // Step 1: Try low-accuracy first (cell tower / Wi-Fi, resolves in ~500ms)
      navigator.geolocation.getCurrentPosition(
        pos => {
          console.log('[LOCATE] Track B Step 1 (low-acc GPS) success:', pos.coords.latitude, pos.coords.longitude);
          onResolved(pos.coords.latitude, pos.coords.longitude, null, '📍 Located via GPS');
          // Now try to refine with high accuracy in background
          navigator.geolocation.getCurrentPosition(
            pos2 => {
              if (pos2.coords.accuracy < (pos.coords.accuracy || 9999)) {
                console.log('[LOCATE] Refined to high-acc GPS:', pos2.coords.latitude, pos2.coords.longitude, 'accuracy:', pos2.coords.accuracy);
                applyPos(pos2.coords.latitude, pos2.coords.longitude, null, '📍 GPS refined to exact doorstep');
              }
            },
            () => {}, // ignore high-acc failure
            { enableHighAccuracy: true, timeout: 5000, maximumAge: 10000 }
          );
        },
        err => {
          console.warn('[LOCATE] Track B Step 1 (low-acc GPS) failed:', err?.code, err?.message);
          // Step 2: Try high accuracy (satellite GPS)
          navigator.geolocation.getCurrentPosition(
            pos2 => {
              console.log('[LOCATE] Track B Step 2 (high-acc GPS) success:', pos2.coords.latitude, pos2.coords.longitude);
              onResolved(pos2.coords.latitude, pos2.coords.longitude, null, '📍 Located via GPS');
            },
            err2 => {
              console.warn('[LOCATE] Track B Step 2 (high-acc GPS) also failed:', err2?.code, err2?.message);
              // At this point if IP hasn't resolved either, wait a bit then fallback
              setTimeout(() => {
                if (!resolved) {
                  console.error('[LOCATE] All location methods failed. Falling back to default.');
                  let msg = 'Could not detect GPS. Please search your street or area above.';
                  if (err2?.code === 1) {
                    msg = 'Location permission blocked. Click Safari settings or browser icon to allow location access.';
                  } else if (err2?.code === 2) {
                    msg = 'Mac location unavailable: Turn on Wi-Fi & enable Safari in System Settings → Privacy & Security → Location Services.';
                  } else if (err2?.code === 3) {
                    msg = 'GPS fix timed out. Please type your area or landmark in the search box above.';
                  }
                  fallbackToDefault(msg);
                }
              }, 800);
            },
            { enableHighAccuracy: true, timeout: 4000, maximumAge: 30000 }
          );
        },
        { enableHighAccuracy: false, timeout: 3000, maximumAge: 60000 }
      );
    } else {
      // No geolocation API - rely entirely on IP (Track A)
      console.warn('[LOCATE] navigator.geolocation not available');
      setTimeout(() => {
        if (!resolved) {
          fallbackToDefault('Geolocation not supported by this browser.');
        }
      }, 4000);
    }
  }, [setBookingLocation, reverseGeocode, bookingLocation, serviceAddress, setServiceAddress]);

  // Initial location detection on mount
  useEffect(() => {
    if (!activeBooking) {
      pinToCurrentLocation(false);
    }
  }, []);

  // ── 4. WATCH EXTERNAL BOOKING LOCATION (E.G. FROM SIDEBAR SEARCH) ──
  useEffect(() => {
    const map = mapInstanceRef.current;
    if (!map || !bookingLocation || activeBooking) return;
    const [lat, lng] = bookingLocation;
    const center = map.getCenter();
    if (center && Math.abs(center.lat - lat) < 0.0001 && Math.abs(center.lng - lng) < 0.0001) {
      return;
    }
    map.flyTo([lat, lng], 16, { duration: 1.0 });
    if (serviceAddress) {
      setAddressText(serviceAddress);
    } else {
      reverseGeocode(lat, lng);
    }
  }, [bookingLocation, activeBooking, reverseGeocode, serviceAddress]);

  // ── 5. OSRM TURN-BY-TURN DRIVING ROUTE CALCULATOR (UBER PATH) ──
  const calculateAndDrawRoute = useCallback(async (startLat, startLng, endLat, endLng) => {
    if (!routeLayerRef.current || !mapInstanceRef.current) return;
    routeLayerRef.current.clearLayers();

    try {
      const osrmUrl = `https://router.project-osrm.org/route/v1/driving/${startLng},${startLat};${endLng},${endLat}?overview=full&geometries=geojson`;
      const res = await fetch(osrmUrl, { signal: AbortSignal.timeout(4000) });
      if (!res.ok) throw new Error('OSRM route failed');
      const data = await res.json();

      if (data.routes && data.routes.length > 0) {
        const route = data.routes[0];
        const coordinates = route.geometry.coordinates.map(c => [c[1], c[0]]); // Leaflet [lat, lon]

        // 1. Route Shadow / Casing line (Uber style)
        const casing = L.polyline(coordinates, {
          color: '#1e1b4b',
          weight: 7,
          opacity: 0.45,
          lineCap: 'round',
          lineJoin: 'round'
        });
        routeLayerRef.current.addLayer(casing);

        // 2. Main Vibrant Path Polyline
        const mainLine = L.polyline(coordinates, {
          color: '#4f46e5',
          weight: 4.5,
          opacity: 0.95,
          lineCap: 'round',
          lineJoin: 'round'
        });
        routeLayerRef.current.addLayer(mainLine);

        // Fit map bounds to view entire route
        mapInstanceRef.current.fitBounds(mainLine.getBounds(), { padding: [60, 60] });

        // Update ETA & Distance
        const distKm = (route.distance / 1000).toFixed(1);
        const mins = Math.max(1, Math.ceil(route.duration / 60));
        setRouteInfo({
          distance: `${distKm} km`,
          duration: `${mins} mins`
        });
      }
    } catch (e) {
      console.warn('OSRM routing fallback to straight line:', e);
      // Fallback straight line polyline if OSRM is unreachable
      const coords = [[startLat, startLng], [endLat, endLng]];
      const straightLine = L.polyline(coords, {
        color: '#4f46e5',
        weight: 4,
        dashArray: '8, 8',
        opacity: 0.8
      });
      routeLayerRef.current.addLayer(straightLine);
      mapInstanceRef.current.fitBounds(straightLine.getBounds(), { padding: [60, 60] });
    }
  }, []);

  // ── 6. RENDER DYNAMIC MARKERS ON LEAFLET MAP ──
  useEffect(() => {
    const map = mapInstanceRef.current;
    if (!map || !markersLayerRef.current) return;

    markersLayerRef.current.clearLayers();

    // A. Available Workers (Green Pulse Pins)
    if (!activeBooking) {
      workers.filter(w => w.available && w.latitude && w.longitude).forEach(w => {
        const workerHtml = `
          <div class="custom-leaflet-worker-pin" title="${w.name} (${w.profession})">
            <div class="worker-pulse-dot"></div>
            <div class="worker-label-pill">⚡ ${w.name.split(' ')[0]}</div>
          </div>
        `;
        const workerIcon = L.divIcon({
          className: 'custom-div-icon',
          html: workerHtml,
          iconSize: [32, 32],
          iconAnchor: [16, 16]
        });

        const marker = L.marker([w.latitude, w.longitude], { icon: workerIcon });
        marker.bindPopup(`
          <div style="font-family: inherit; padding: 4px;">
            <div style="font-weight: 800; font-size: 0.95rem; color: #1e293b;">${w.name}</div>
            <div style="font-size: 0.8rem; color: #64748b; font-weight: 600;">${w.profession} • ⭐ ${w.rating || 5.0}</div>
            <div style="font-size: 0.85rem; color: #16a34a; font-weight: 700; margin-top: 4px;">Online & Available</div>
          </div>
        `);
        markersLayerRef.current.addLayer(marker);
      });
    }

    // B. Open Broadcast Jobs for Workers / Global View (Uber Marketplace Work Pins)
    if (currentUser?.role === 'WORKER' && !activeBooking) {
      broadcasts.forEach(job => {
        if (!job.startLat || !job.startLng) return;
        const isSelected = selectedJob?.id === job.id;
        const emoji = getProfessionEmoji(job.professionCategory);
        const price = Math.round(job.totalCost || job.serviceCost || 250);

        const jobHtml = `
          <div class="custom-leaflet-job-pin ${isSelected ? 'selected' : ''}">
            <div class="job-pin-head">
              <span class="job-pin-emoji">${emoji}</span>
              <span class="job-pin-price">₹${price}</span>
            </div>
            <div class="job-pin-badge">${job.professionCategory || 'Job'}</div>
            <div class="job-pin-arrow"></div>
          </div>
        `;

        const jobIcon = L.divIcon({
          className: 'custom-div-icon',
          html: jobHtml,
          iconSize: [60, 48],
          iconAnchor: [30, 48]
        });

        const marker = L.marker([job.startLat, job.startLng], { icon: jobIcon });
        marker.on('click', () => {
          if (onSelectJob) onSelectJob(job);
        });

        marker.bindPopup(`
          <div style="font-family: inherit; padding: 4px; min-width: 180px;">
            <div style="font-size: 0.72rem; font-weight: 800; color: #6366f1; text-transform: uppercase;">Doorstep Work Request</div>
            <div style="font-weight: 800; font-size: 0.95rem; color: #0f172a; margin-top: 2px;">${emoji} ${job.professionCategory}</div>
            <div style="font-size: 0.8rem; color: #475569; margin-top: 2px;">Customer: <strong>${job.customerName}</strong></div>
            <div style="font-size: 0.78rem; color: #64748b; margin-top: 2px; line-height: 1.3;">${job.serviceAddress || 'Doorstep location'}</div>
            <div style="font-size: 0.92rem; font-weight: 800; color: #16a34a; margin-top: 6px;">Total Payout: ₹${price}</div>
          </div>
        `);

        markersLayerRef.current.addLayer(marker);
      });
    }

    // C. Active Booking Markers & Polyline (Customer & Worker)
    if (activeBooking && activeBooking.status !== 'COMPLETED' && activeBooking.status !== 'CANCELLED') {
      const cLat = activeBooking.startLat;
      const cLng = activeBooking.startLng;
      const wLat = activeBooking.workerCurrentLat;
      const wLng = activeBooking.workerCurrentLng;

      // Customer Doorstep Destination Pin
      if (cLat && cLng) {
        const isBroadcasting = activeBooking.status === 'BROADCAST';
        const destHtml = `
          <div class="custom-leaflet-dest-pin">
            ${isBroadcasting ? '<div class="broadcast-radar-ring"></div>' : ''}
            <div class="dest-pin-core" style="${isBroadcasting ? 'background: #4f46e5; border-color: #a5b4fc;' : ''}">
              ${isBroadcasting ? '📡' : '📍'}
            </div>
            <div class="dest-pin-label">
              ${isBroadcasting ? 'Broadcasting...' : 'Customer Doorstep'}
            </div>
          </div>
        `;
        const destIcon = L.divIcon({
          className: 'custom-div-icon',
          html: destHtml,
          iconSize: [40, 40],
          iconAnchor: [20, 36]
        });
        markersLayerRef.current.addLayer(L.marker([cLat, cLng], { icon: destIcon }));
      }

      // Worker Live En-Route Pin
      if (wLat && wLng) {
        const workerLiveHtml = `
          <div class="custom-leaflet-live-worker">
            <div class="live-worker-core">🚗</div>
            <div class="live-worker-label">${activeBooking.workerName || 'Pro'}</div>
          </div>
        `;
        const workerLiveIcon = L.divIcon({
          className: 'custom-div-icon',
          html: workerLiveHtml,
          iconSize: [40, 40],
          iconAnchor: [20, 20]
        });
        markersLayerRef.current.addLayer(L.marker([wLat, wLng], { icon: workerLiveIcon }));

        // Draw Driving Route between Worker and Customer
        if (cLat && cLng) {
          calculateAndDrawRoute(wLat, wLng, cLat, cLng);
        }
      }
    }

    // D. Live User GPS Position Beacon (Google Maps / Uber Pulsating Dot)
    if (customerPos && customerPos.lat && customerPos.lng) {
      const userGpsHtml = `
        <div class="custom-leaflet-user-gps" title="Your Current Location">
          <div class="user-gps-pulse-ring"></div>
          <div class="user-gps-dot"></div>
        </div>
      `;
      const userGpsIcon = L.divIcon({
        className: 'custom-div-icon',
        html: userGpsHtml,
        iconSize: [32, 32],
        iconAnchor: [16, 16]
      });

      const userMarker = L.marker([customerPos.lat, customerPos.lng], {
        icon: userGpsIcon,
        zIndexOffset: 1000
      });
      userMarker.bindPopup(`
        <div style="font-family: inherit; padding: 4px; text-align: center;">
          <div style="font-weight: 800; font-size: 0.92rem; color: #1e1b4b;">📍 Your Location</div>
          <div style="font-size: 0.8rem; color: #475569; margin-top: 2px;">${addressText || 'Current Position'}</div>
          <div style="font-size: 0.72rem; color: #64748b; margin-top: 4px;">Lat: ${customerPos.lat.toFixed(4)}, Lng: ${customerPos.lng.toFixed(4)}</div>
        </div>
      `);
      markersLayerRef.current.addLayer(userMarker);
    }
  }, [workers, activeBooking, broadcasts, selectedJob, currentUser, calculateAndDrawRoute, onSelectJob, customerPos, addressText]);

  // Derive activeWorker safely from workers array
  const activeWorker = useMemo(() => {
    if (!currentUser) return null;
    return workers.find(w => w.userId == currentUser.id) || 
           workers.find(w => w.name?.toLowerCase() === currentUser.name?.toLowerCase()) ||
           null;
  }, [workers, currentUser]);

  // ── 7. DRAW ROUTE WHEN WORKER CLICKS ON A WORK PLACE ──
  useEffect(() => {
    if (!selectedJob || !selectedJob.startLat || !selectedJob.startLng) {
      if (!activeBooking && routeLayerRef.current) {
        routeLayerRef.current.clearLayers();
        setRouteInfo(null);
      }
      return;
    }

    // Determine Worker's origin: current GPS or worker's saved profile coords or Indore center
    const workerLat = customerPos?.lat || activeWorker?.latitude || currentUser?.latitude || DEFAULT_CENTER[0];
    const workerLng = customerPos?.lng || activeWorker?.longitude || currentUser?.longitude || DEFAULT_CENTER[1];

    calculateAndDrawRoute(workerLat, workerLng, selectedJob.startLat, selectedJob.startLng);
  }, [selectedJob, customerPos, activeWorker, currentUser, calculateAndDrawRoute, activeBooking]);

  // ── 8. SEARCH & AUTOCOMPLETE LOGIC ──
  const searchViaSmartGeocode = useCallback(async (q) => {
    setIsSearching(true);
    try {
      const map = mapInstanceRef.current;
      const center = map?.getCenter();
      const biasCoords = center ? { lat: center.lat, lon: center.lng } : null;
      const result = await smartSearchLocation(q, biasCoords);
      setIsSearching(false);
      if (result) {
        const lat = result.lat;
        const lng = result.lon;
        if (map) {
          map.flyTo([lat, lng], 17, { duration: 1.2 });
        }
        setAddressText(result.short_name || result.display_name);
        if (setBookingLocation) setBookingLocation([lat, lng]);
        if (setServiceAddress) setServiceAddress(result.display_name);
        setSearchInput('');
        setShowSuggestions(false);
        setLocateSuccessPill(true);
        setTimeout(() => setLocateSuccessPill(false), 3000);
      } else {
        alert(`No results found for "${q}". Please try a nearby landmark or drag the map pin.`);
      }
    } catch (err) {
      setIsSearching(false);
      alert('Search error. Please move the map pin directly.');
    }
  }, [setBookingLocation, setServiceAddress]);

  const handleManualSearch = useCallback((query) => {
    const q = (query || searchInput || '').trim();
    if (!q) return;
    setShowSuggestions(false);
    searchViaSmartGeocode(q);
  }, [searchInput, searchViaSmartGeocode]);

  const handleSearchInputChange = (e) => {
    const val = e.target.value;
    setSearchInput(val);
    if (suggestionsTimerRef.current) clearTimeout(suggestionsTimerRef.current);
    if (!val || val.trim().length < 2) {
      setSuggestions([]);
      setShowSuggestions(false);
      return;
    }
    suggestionsTimerRef.current = setTimeout(async () => {
      try {
        const map = mapInstanceRef.current;
        const center = map?.getCenter();
        const biasCoords = center ? { lat: center.lat, lon: center.lng } : null;
        const list = await getLiveSearchSuggestions(val, biasCoords);
        if (Array.isArray(list) && list.length > 0) {
          setSuggestions(list);
          setShowSuggestions(true);
        } else {
          setSuggestions([]);
          setShowSuggestions(false);
        }
      } catch (err) {
        setSuggestions([]);
        setShowSuggestions(false);
      }
    }, 220);
  };

  const handleSelectSuggestion = (place) => {
    const lat = parseFloat(place.lat);
    const lng = parseFloat(place.lon);
    const map = mapInstanceRef.current;
    if (map) {
      map.flyTo([lat, lng], 17, { duration: 1.2 });
    }
    setAddressText(place.short_name || place.display_name);
    if (setBookingLocation) setBookingLocation([lat, lng]);
    if (setServiceAddress) setServiceAddress(place.display_name);
    setSearchInput('');
    setSuggestions([]);
    setShowSuggestions(false);
    setLocateSuccessPill(true);
    setTimeout(() => setLocateSuccessPill(false), 3000);
  };

  const handleSelectCity = (c) => {
    const map = mapInstanceRef.current;
    if (map) {
      map.flyTo([c.lat, c.lng], 16, { duration: 1.2 });
    }
    setCustomerPos({ lat: c.lat, lng: c.lng });
    setAddressText(c.addr);
    if (setBookingLocation) setBookingLocation([c.lat, c.lng]);
    if (setServiceAddress) setServiceAddress(c.addr);
    setLocateSuccessPill(true);
    setTimeout(() => setLocateSuccessPill(false), 3000);
  };

  // ── 9. WORKER ACCEPTS JOB FROM MAP ──
  const handleAcceptSelectedJob = async () => {
    if (!selectedJob) return;
    setIsAcceptingJob(true);
    try {
      if (onAcceptJob) {
        await onAcceptJob(selectedJob.id);
        if (onSelectJob) onSelectJob(null);
        return;
      }
      const workerId = activeWorker ? activeWorker.id : (currentUser?.id || currentUser?.userId);
      const res = await fetch(apiUrl(`/api/bookings/${selectedJob.id}/accept?workerId=${workerId}`), {
        method: 'PUT'
      });
      if (res.ok) {
        const updated = await res.json();
        if (setActiveBooking) setActiveBooking(updated);
        if (refreshData) refreshData();
        if (onSelectJob) onSelectJob(null);
      } else {
        const msg = await res.text();
        alert(msg || 'Failed to accept job. It may have already been accepted.');
      }
    } catch (e) {
      alert('Network error accepting job.');
    } finally {
      setIsAcceptingJob(false);
    }
  };

  const isCustomerPicking = currentUser?.role === 'CUSTOMER' && !activeBooking;

  return (
    <div style={{ height: '100%', width: '100%', position: 'relative', overflow: 'hidden' }}>

      {/* ══════════ LEAFLET MAP CONTAINER ══════════ */}
      <div 
        ref={mapContainerRef} 
        style={{ width: '100%', height: '100%', background: '#e2e8f0', zIndex: 1 }} 
      />

      {/* ══════════ LOCATION PERMISSION PROMPT BANNER ══════════ */}
      {permissionNotice && (
        <div style={{
          position: 'absolute', top: '16px', left: '16px', right: '16px', zIndex: 1000,
          background: 'linear-gradient(135deg, #1e1b4b 0%, #312e81 100%)',
          color: 'white', borderRadius: '16px', padding: '14px 18px',
          boxShadow: '0 10px 30px rgba(0,0,0,0.25)', display: 'flex',
          alignItems: 'center', justifyContent: 'space-between', gap: '12px'
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
            <span style={{ fontSize: '1.4rem' }}>📍</span>
            <div>
              <div style={{ fontWeight: 800, fontSize: '0.9rem' }}>Enable Live Location Access</div>
              <div style={{ fontSize: '0.78rem', color: '#c7d2fe', marginTop: '2px' }}>
                Auto-pin your doorstep and show real-time routes to nearby service professionals.
              </div>
            </div>
          </div>
          <div style={{ display: 'flex', gap: '8px' }}>
            <button
              onClick={() => pinToCurrentLocation(true)}
              style={{
                background: '#4f46e5', color: 'white', border: 'none', padding: '8px 16px',
                borderRadius: '10px', fontWeight: 800, fontSize: '0.85rem', cursor: 'pointer',
                boxShadow: '0 2px 8px rgba(79,70,229,0.4)', whiteSpace: 'nowrap'
              }}
            >
              ✓ Allow Location
            </button>
            <button
              onClick={() => setPermissionNotice(false)}
              style={{
                background: 'rgba(255,255,255,0.15)', color: 'white', border: 'none',
                padding: '8px 12px', borderRadius: '10px', fontWeight: 700, fontSize: '0.82rem',
                cursor: 'pointer'
              }}
            >
              Dismiss
            </button>
          </div>
        </div>
      )}

      {/* ══════════ SEARCH BAR & QUICK CITIES ══════════ */}
      {isCustomerPicking && (
        <div style={{ position: 'absolute', top: '16px', left: '16px', right: '16px', zIndex: 999 }}>
          <div style={{
            display: 'flex', alignItems: 'center', gap: '10px',
            background: 'white', borderRadius: '14px',
            padding: '4px 6px 4px 16px',
            boxShadow: '0 2px 16px rgba(0,0,0,0.12), 0 0 0 1px rgba(0,0,0,0.04)',
          }}>
            <div style={{
              width: '10px', height: '10px', borderRadius: '50%', flexShrink: 0,
              background: '#22c55e', boxShadow: '0 0 0 3px rgba(34,197,94,0.2)',
            }} />
            <input
              type="text"
              placeholder="Search area, landmark or street (e.g. Prestige Indore)..."
              value={searchInput}
              onChange={handleSearchInputChange}
              onFocus={() => { if (suggestions.length > 0) setShowSuggestions(true); }}
              onKeyDown={(e) => {
                if (e.key === 'Enter') {
                  e.preventDefault();
                  if (suggestions.length > 0) {
                    handleSelectSuggestion(suggestions[0]);
                  } else {
                    handleManualSearch(searchInput);
                  }
                }
              }}
              style={{
                flex: 1, padding: '14px 0', border: 'none', outline: 'none',
                fontSize: '0.95rem', fontWeight: 600, color: '#1a1a1a',
                background: 'transparent', fontFamily: 'inherit',
              }}
            />
            {searchInput && (
              <button
                type="button"
                onClick={() => { setSearchInput(''); setSuggestions([]); setShowSuggestions(false); }}
                style={{ background: 'transparent', border: 'none', color: '#94a3b8', cursor: 'pointer', padding: '6px', fontSize: '1rem' }}
              >
                ✕
              </button>
            )}
            <button
              type="button"
              onClick={() => {
                if (suggestions.length > 0) handleSelectSuggestion(suggestions[0]);
                else handleManualSearch(searchInput);
              }}
              disabled={isSearching}
              style={{
                width: '40px', height: '40px', borderRadius: '12px',
                background: isSearching ? '#22c55e' : '#f1f5f9',
                border: 'none', cursor: 'pointer',
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                flexShrink: 0, transition: 'all 0.2s ease',
              }}
              title="Search location"
            >
              {isSearching ? (
                <div style={{ width: '18px', height: '18px', border: '2px solid white', borderTopColor: 'transparent', borderRadius: '50%', animation: 'leaflet-spin 0.6s linear infinite' }} />
              ) : (
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#64748b" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                  <circle cx="11" cy="11" r="8" />
                  <line x1="21" y1="21" x2="16.65" y2="16.65" />
                </svg>
              )}
            </button>
          </div>

          {/* Live Autocomplete Suggestions */}
          {showSuggestions && suggestions.length > 0 && (
            <div style={{
              marginTop: '6px', background: 'white', borderRadius: '14px',
              overflow: 'hidden', boxShadow: '0 10px 30px rgba(0,0,0,0.18)',
              zIndex: 1001, maxHeight: '260px', overflowY: 'auto'
            }}>
              {suggestions.map((item, idx) => (
                <div
                  key={item.place_id || idx}
                  onClick={() => handleSelectSuggestion(item)}
                  style={{
                    padding: '12px 16px', display: 'flex', alignItems: 'center', gap: '12px',
                    cursor: 'pointer', borderBottom: idx < suggestions.length - 1 ? '1px solid #f1f5f9' : 'none',
                    transition: 'background 0.15s ease'
                  }}
                  onMouseOver={(e) => e.currentTarget.style.background = '#f8fafc'}
                  onMouseOut={(e) => e.currentTarget.style.background = 'white'}
                >
                  <div style={{ width: '32px', height: '32px', borderRadius: '50%', background: '#eff6ff', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                    <span style={{ fontSize: '0.9rem' }}>📍</span>
                  </div>
                  <div style={{ minWidth: 0, flex: 1 }}>
                    <div style={{ fontWeight: 700, fontSize: '0.9rem', color: '#1e293b', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                      {item.primary || item.short_name}
                    </div>
                    <div style={{ fontSize: '0.74rem', color: '#64748b', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                      {item.secondary || item.display_name}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}

          {/* Quick Indian City Chips */}
          <div style={{
            display: 'flex', gap: '6px', alignItems: 'center', marginTop: '8px',
            overflowX: 'auto', paddingBottom: '2px', scrollbarWidth: 'none'
          }}>
            <span style={{ fontSize: '0.72rem', fontWeight: 800, color: 'white', background: 'rgba(0,0,0,0.65)', padding: '3px 8px', borderRadius: '10px', backdropFilter: 'blur(4px)', whiteSpace: 'nowrap' }}>
              Quick City:
            </span>
            {quickCities.map((c, i) => (
              <button
                key={i}
                type="button"
                onClick={() => handleSelectCity(c)}
                style={{
                  background: 'white', border: 'none', borderRadius: '14px',
                  padding: '4px 10px', fontSize: '0.75rem', fontWeight: 700, cursor: 'pointer',
                  color: '#1e293b', whiteSpace: 'nowrap',
                  boxShadow: '0 2px 8px rgba(0,0,0,0.12)', transition: 'transform 0.15s ease'
                }}
                onMouseOver={(e) => e.currentTarget.style.transform = 'scale(1.05)'}
                onMouseOut={(e) => e.currentTarget.style.transform = 'scale(1)'}
              >
                {c.name}
              </button>
            ))}
          </div>
        </div>
      )}

      {/* ══════════ FLOATING CENTER PIN (Uber Doorstep Picker) ══════════ */}
      {isCustomerPicking && (
        <>
          <div style={{
            position: 'absolute', top: '50%', left: '50%',
            transform: `translate(-50%, -100%) ${isDragging ? 'translateY(-14px)' : ''}`,
            transition: isDragging ? 'transform 0.15s ease-out' : 'transform 0.3s cubic-bezier(0.34,1.56,0.64,1)',
            zIndex: 990, pointerEvents: 'none',
          }}>
            {/* Uber-style dark indigo pin */}
            <svg width="40" height="52" viewBox="0 0 40 52" fill="none">
              <ellipse cx="20" cy="49" rx="6" ry="2" fill="rgba(0,0,0,0.2)" />
              <path d="M20 0C8.954 0 0 8.954 0 20C0 35 20 50 20 50C20 50 40 35 40 20C40 8.954 31.046 0 20 0Z" fill="#1e1b4b"/>
              <circle cx="20" cy="18" r="8" fill="white"/>
              <circle cx="20" cy="18" r="3.5" fill="#4f46e5"/>
            </svg>
          </div>
          <div style={{
            position: 'absolute', top: '50%', left: '50%',
            transform: 'translate(-50%, 1px)',
            width: isDragging ? '4px' : '8px',
            height: isDragging ? '2px' : '4px',
            borderRadius: '50%', background: 'rgba(0,0,0,0.25)',
            transition: 'all 0.2s ease',
            zIndex: 989, pointerEvents: 'none',
          }} />
        </>
      )}

      {/* ══════════ BOTTOM ADDRESS CARD (Customer View) ══════════ */}
      {isCustomerPicking && addressText && !isDragging && (
        <div style={{ position: 'absolute', bottom: '24px', left: '16px', right: '16px', zIndex: 995 }}>
          <div style={{
            background: 'white', borderRadius: '18px', padding: '18px 20px',
            boxShadow: '0 8px 30px rgba(0,0,0,0.12), 0 0 0 1px rgba(0,0,0,0.04)',
          }}>
            <div style={{ display: 'flex', alignItems: 'flex-start', gap: '14px' }}>
              <div style={{
                width: '38px', height: '38px', borderRadius: '12px',
                background: '#eff6ff', display: 'flex', alignItems: 'center', justifyContent: 'center',
                flexShrink: 0, marginTop: '2px', color: '#4f46e5'
              }}>
                <svg width="20" height="20" viewBox="0 0 24 24" fill="currentColor">
                  <path d="M12 2C8.13 2 5 5.13 5 9c0 5.25 7 13 7 13s7-7.75 7-13c0-3.87-3.13-7-7-7zm0 9.5c-1.38 0-2.5-1.12-2.5-2.5s1.12-2.5 2.5-2.5 2.5 1.12 2.5 2.5-1.12 2.5-2.5 2.5z"/>
                </svg>
              </div>
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ fontSize: '0.72rem', fontWeight: 800, color: '#6366f1', textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: '2px' }}>
                  Doorstep Service Location
                </div>
                <div style={{ fontSize: '0.92rem', fontWeight: 700, color: '#0f172a', lineHeight: 1.4 }}>
                  {addressText}
                </div>
              </div>
            </div>

            <button
              onClick={() => {
                const map = mapInstanceRef.current;
                if (map) {
                  const center = map.getCenter();
                  if (setBookingLocation) setBookingLocation([center.lat, center.lng]);
                }
                if (setServiceAddress && addressText) setServiceAddress(addressText);
                setIsConfirmed(true);
                setLocateSuccessPill(true);
                setTimeout(() => setLocateSuccessPill(false), 3000);
                if (onSwitchToForm) {
                  setTimeout(() => {
                    onSwitchToForm();
                  }, 650);
                }
              }}
              style={{
                width: '100%', marginTop: '14px', padding: '14px',
                background: isConfirmed ? '#10b981' : '#4f46e5',
                color: 'white', border: 'none', borderRadius: '14px',
                fontSize: '0.94rem', fontWeight: 800, cursor: 'pointer',
                transition: 'all 0.2s ease', display: 'flex', alignItems: 'center',
                justifyContent: 'center', gap: '8px',
                boxShadow: isConfirmed ? '0 4px 14px rgba(16,185,129,0.35)' : '0 4px 14px rgba(79,70,229,0.35)'
              }}
            >
              {isConfirmed ? (
                <>✓ Location Pinned & Confirmed</>
              ) : (
                'Confirm This Doorstep Location'
              )}
            </button>
          </div>
        </div>
      )}

      {/* ══════════ FLOATING RETURN TO FORM/COCKPIT PILL (Mobile only) ══════════ */}
      {onSwitchToForm && (
        <button
          type="button"
          onClick={onSwitchToForm}
          className="mobile-switch-pill"
          style={{
            position: 'absolute',
            bottom: isCustomerPicking ? (addressText ? '220px' : '90px') : '24px',
            left: '16px',
            zIndex: 996,
            background: 'var(--bg-card, #ffffff)',
            color: 'var(--text-primary, #0f172a)',
            border: '1px solid var(--border-color, #e2e8f0)',
            borderRadius: '9999px',
            padding: '8px 16px',
            fontSize: '0.82rem',
            fontWeight: 800,
            cursor: 'pointer',
            boxShadow: '0 4px 16px rgba(0,0,0,0.18)',
            alignItems: 'center',
            gap: '6px'
          }}
        >
          <span>←</span>
          <span>{currentUser?.role === 'WORKER' ? 'Jobs Cockpit' : 'Booking Form'}</span>
        </button>
      )}

      {/* ══════════ WORKER CLICK ON WORK PLACE: ROUTE & ACCEPT HUD (UBER PATH) ══════════ */}
      {currentUser?.role === 'WORKER' && selectedJob && (
        <div style={{ position: 'absolute', bottom: '24px', left: '16px', right: '16px', zIndex: 998 }}>
          <div style={{
            background: '#0f172a', borderRadius: '20px', padding: '20px 22px',
            color: 'white', boxShadow: '0 12px 40px rgba(0,0,0,0.35)',
            border: '1px solid #334155'
          }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '12px' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                <span style={{ fontSize: '1.2rem' }}>{getProfessionEmoji(selectedJob.professionCategory)}</span>
                <span style={{ fontWeight: 800, fontSize: '1rem', color: '#f8fafc' }}>
                  {selectedJob.professionCategory} Request
                </span>
                <span style={{
                  background: 'rgba(34, 197, 94, 0.2)', color: '#4ade80', padding: '2px 8px',
                  borderRadius: '6px', fontSize: '0.74rem', fontWeight: 800
                }}>
                  ₹{Math.round(selectedJob.totalCost || selectedJob.serviceCost || 250)}
                </span>
              </div>
              <button
                onClick={() => onSelectJob && onSelectJob(null)}
                style={{ background: 'transparent', border: 'none', color: '#94a3b8', cursor: 'pointer', fontSize: '1.1rem', fontWeight: 'bold' }}
              >
                ✕
              </button>
            </div>

            <div style={{ fontSize: '0.86rem', color: '#cbd5e1', marginBottom: '8px', lineHeight: 1.4 }}>
              <strong>Customer:</strong> {selectedJob.customerName} • {selectedJob.serviceAddress || 'Doorstep location'}
            </div>
            {selectedJob.taskDescription && (
              <div style={{ fontSize: '0.8rem', color: '#94a3b8', fontStyle: 'italic', marginBottom: '14px' }}>
                "{selectedJob.taskDescription}"
              </div>
            )}

            {/* Turn-by-Turn Route Metrics (OSRM Distance & ETA) */}
            {routeInfo && (
              <div style={{
                display: 'flex', gap: '24px', background: 'rgba(255,255,255,0.06)',
                borderRadius: '12px', padding: '12px 16px', marginBottom: '16px'
              }}>
                <div>
                  <div style={{ fontSize: '1.4rem', fontWeight: 900, color: '#60a5fa' }}>{routeInfo.duration}</div>
                  <div style={{ fontSize: '0.72rem', color: '#94a3b8', textTransform: 'uppercase', fontWeight: 700 }}>Driving Arrival ETA</div>
                </div>
                <div>
                  <div style={{ fontSize: '1.4rem', fontWeight: 900, color: '#f8fafc' }}>{routeInfo.distance}</div>
                  <div style={{ fontSize: '0.72rem', color: '#94a3b8', textTransform: 'uppercase', fontWeight: 700 }}>Route Distance</div>
                </div>
              </div>
            )}

            <button
              onClick={handleAcceptSelectedJob}
              disabled={isAcceptingJob}
              style={{
                width: '100%', padding: '15px', background: '#22c55e', color: '#0f172a',
                border: 'none', borderRadius: '14px', fontSize: '1rem', fontWeight: 900,
                cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px',
                boxShadow: '0 4px 18px rgba(34,197,94,0.4)', transition: 'all 0.15s ease'
              }}
              onMouseOver={(e) => e.currentTarget.style.filter = 'brightness(1.1)'}
              onMouseOut={(e) => e.currentTarget.style.filter = 'none'}
            >
              {isAcceptingJob ? (
                <>Accepting Request...</>
              ) : (
                <>🚗 Accept Job & Start Route Navigation</>
              )}
            </button>

            {/* Google Maps Location Button for Selected Job */}
            {selectedJob.startLat && selectedJob.startLng && (
              <button
                type="button"
                onClick={() => {
                  const url = `https://www.google.com/maps/dir/?api=1&destination=${selectedJob.startLat},${selectedJob.startLng}&travelmode=driving`;
                  window.open(url, '_blank', 'noopener,noreferrer');
                }}
                style={{
                  width: '100%',
                  marginTop: '10px',
                  padding: '11px',
                  background: 'rgba(66, 133, 244, 0.15)',
                  border: '1px solid #4285f4',
                  color: '#93c5fd',
                  borderRadius: '12px',
                  fontSize: '0.88rem',
                  fontWeight: 800,
                  cursor: 'pointer',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  gap: '6px'
                }}
              >
                <span>📍 Open Destination in Google Maps ({parseFloat(selectedJob.startLat).toFixed(4)}, {parseFloat(selectedJob.startLng).toFixed(4)})</span>
              </button>
            )}
          </div>
        </div>
      )}

      {/* ══════════ ACTIVE BOOKING HUD (EN-ROUTE / ONGOING WORK) ══════════ */}
      {activeBooking && activeBooking.status !== 'COMPLETED' && activeBooking.status !== 'CANCELLED' && (
        <div style={{ position: 'absolute', bottom: '24px', left: '16px', right: '16px', zIndex: 998 }}>
          <div style={{
            background: '#0f172a', borderRadius: '20px', padding: '18px 22px',
            color: 'white', boxShadow: '0 12px 40px rgba(0,0,0,0.35)', border: '1px solid #334155'
          }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '8px' }}>
              <div style={{
                width: '8px', height: '8px', borderRadius: '50%',
                background: activeBooking.status === 'BROADCAST' ? '#6366f1' :
                            activeBooking.status === 'EN_ROUTE' ? '#f59e0b' : '#22c55e',
                boxShadow: '0 0 10px rgba(99,102,241,0.6)'
              }} />
              <span style={{ fontSize: '0.74rem', fontWeight: 800, textTransform: 'uppercase', letterSpacing: '0.08em', color: '#94a3b8' }}>
                {activeBooking.status === 'BROADCAST' ? '📡 Dispatching to Verified Technicians' :
                 activeBooking.status === 'EN_ROUTE' ? '🚗 Technician En Route' :
                 activeBooking.status === 'ACTIVE' ? '⚡ Repair Session In Progress' :
                 activeBooking.status === 'ACCEPTED' ? '✓ Job Assigned' : activeBooking.status}
              </span>
            </div>

            {activeBooking.status === 'BROADCAST' ? (
              <div style={{ marginTop: '8px', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                <div>
                  <div style={{ fontSize: '1.05rem', fontWeight: 800, color: '#f8fafc' }}>
                    Finding Nearby {activeBooking.professionCategory || 'Professional'}
                  </div>
                  <div style={{ fontSize: '0.78rem', color: '#94a3b8', marginTop: '2px' }}>
                    Pinned to global marketplace. Waiting for nearest certified technician to accept.
                  </div>
                </div>
                <div style={{ width: '22px', height: '22px', border: '3px solid #6366f1', borderTopColor: 'transparent', borderRadius: '50%', animation: 'leaflet-spin 0.8s linear infinite', flexShrink: 0 }} />
              </div>
            ) : routeInfo ? (
              <div style={{ display: 'flex', gap: '32px', marginTop: '6px' }}>
                <div>
                  <div style={{ fontSize: '1.6rem', fontWeight: 900, color: '#f8fafc' }}>{routeInfo.duration}</div>
                  <div style={{ fontSize: '0.7rem', color: '#64748b' }}>Estimated time</div>
                </div>
                <div>
                  <div style={{ fontSize: '1.6rem', fontWeight: 900, color: '#f8fafc' }}>{routeInfo.distance}</div>
                  <div style={{ fontSize: '0.7rem', color: '#64748b' }}>Away</div>
                </div>
              </div>
            ) : (
              <div style={{ fontSize: '0.9rem', color: '#cbd5e1', marginTop: '6px' }}>
                Assigned Pro: <strong>{activeBooking.workerName || 'Certified Technician'}</strong>
              </div>
            )}

            {/* Google Maps Location Button for Worker */}
            {currentUser?.role === 'WORKER' && activeBooking.startLat && activeBooking.startLng && (
              <button
                type="button"
                onClick={() => {
                  const url = `https://www.google.com/maps/dir/?api=1&destination=${activeBooking.startLat},${activeBooking.startLng}&travelmode=driving`;
                  window.open(url, '_blank', 'noopener,noreferrer');
                }}
                style={{
                  marginTop: '14px',
                  width: '100%',
                  padding: '13px',
                  background: 'linear-gradient(135deg, #1a73e8 0%, #4285f4 100%)',
                  color: 'white',
                  border: 'none',
                  borderRadius: '12px',
                  fontSize: '0.94rem',
                  fontWeight: 800,
                  cursor: 'pointer',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  gap: '8px',
                  boxShadow: '0 4px 14px rgba(66, 133, 244, 0.4)'
                }}
              >
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                  <polygon points="3 11 22 2 13 21 11 13 3 11"/>
                </svg>
                <span>Navigate in Google Maps ({parseFloat(activeBooking.startLat).toFixed(4)}, {parseFloat(activeBooking.startLng).toFixed(4)})</span>
              </button>
            )}
          </div>
        </div>
      )}

      {/* ══════════ LOCATE ME (GPS CROSSHAIR BUTTON) ══════════ */}
      {!activeBooking && (
        <button
          type="button"
          onClick={() => pinToCurrentLocation(true)}
          disabled={isLocating}
          style={{
            position: 'absolute',
            bottom: isCustomerPicking ? (addressText ? '215px' : '30px') : (selectedJob ? '290px' : '30px'),
            right: '16px',
            zIndex: 995,
            width: '48px',
            height: '48px',
            borderRadius: '50%',
            background: 'white',
            border: 'none',
            cursor: isLocating ? 'wait' : 'pointer',
            boxShadow: '0 4px 16px rgba(0,0,0,0.18), 0 0 0 1px rgba(0,0,0,0.06)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            transition: 'transform 0.15s, box-shadow 0.15s',
          }}
          onMouseDown={(e) => e.currentTarget.style.transform = 'scale(0.92)'}
          onMouseUp={(e) => e.currentTarget.style.transform = 'scale(1)'}
          title={isLocating ? 'Pinning your current location...' : 'Locate my position'}
        >
          {isLocating ? (
            <div style={{ width: '22px', height: '22px', border: '3px solid #e2e8f0', borderTopColor: '#4f46e5', borderRadius: '50%', animation: 'leaflet-spin 0.6s linear infinite' }} />
          ) : (
            <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="#1e1b4b" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
              <circle cx="12" cy="12" r="4" fill="#4f46e5" stroke="none" />
              <path d="M12 2v2M12 20v2M2 12h2M20 12h2" />
              <circle cx="12" cy="12" r="8" fill="none" />
            </svg>
          )}
        </button>
      )}

      {/* ══════════ ZOOM BUTTONS (+ / -) ══════════ */}
      <div style={{
        position: 'absolute', right: '16px',
        top: isCustomerPicking ? '130px' : '16px',
        zIndex: 995, display: 'flex', flexDirection: 'column', gap: '1px'
      }}>
        <button
          onClick={() => mapInstanceRef.current?.zoomIn()}
          style={{
            width: '40px', height: '40px', border: 'none', cursor: 'pointer',
            background: 'white', fontSize: '1.2rem', fontWeight: 800, color: '#334155',
            borderRadius: '12px 12px 0 0', boxShadow: '0 2px 8px rgba(0,0,0,0.12)',
            display: 'flex', alignItems: 'center', justifyContent: 'center'
          }}
        >
          +
        </button>
        <button
          onClick={() => mapInstanceRef.current?.zoomOut()}
          style={{
            width: '40px', height: '40px', border: 'none', cursor: 'pointer',
            background: 'white', fontSize: '1.2rem', fontWeight: 800, color: '#334155',
            borderRadius: '0 0 12px 12px', boxShadow: '0 2px 8px rgba(0,0,0,0.12)',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            borderTop: '1px solid #f1f5f9'
          }}
        >
          −
        </button>
      </div>

      {/* ══════════ NOTIFICATION PILLS ══════════ */}
      {locateSuccessPill && (
        <div style={{
          position: 'absolute', top: '80px', left: '50%', transform: 'translateX(-50%)',
          background: '#16a34a', color: 'white', padding: '8px 20px',
          borderRadius: '24px', fontSize: '0.85rem', fontWeight: 800,
          zIndex: 1002, boxShadow: '0 6px 20px rgba(22,163,74,0.35)',
          display: 'flex', alignItems: 'center', gap: '8px', whiteSpace: 'nowrap'
        }}>
          <span>📍</span> {locateMessage}
        </div>
      )}

      {locationError && (
        <div style={{
          position: 'absolute', top: '110px', left: '50%', transform: 'translateX(-50%)',
          background: '#dc2626', color: 'white', padding: '8px 20px',
          borderRadius: '24px', fontSize: '0.82rem', fontWeight: 700,
          zIndex: 1002, boxShadow: '0 6px 20px rgba(220,38,38,0.35)',
          display: 'flex', alignItems: 'center', gap: '8px', maxWidth: '90%'
        }}>
          <span>⚠️</span> {locationError}
        </div>
      )}

      {/* ══════════ LEAFLET CUSTOM MARKER CSS ══════════ */}
      <style>{`
        @keyframes leaflet-spin { to { transform: rotate(360deg); } }
        @keyframes leaflet-pulse {
          0% { transform: scale(0.95); box-shadow: 0 0 0 0 rgba(79, 70, 229, 0.7); }
          70% { transform: scale(1); box-shadow: 0 0 0 14px rgba(79, 70, 229, 0); }
          100% { transform: scale(0.95); box-shadow: 0 0 0 0 rgba(79, 70, 229, 0); }
        }

        .custom-div-icon {
          background: transparent !important;
          border: none !important;
        }

        /* Live User GPS Location Beacon (Google Maps / Uber Pulsating Dot) */
        .custom-leaflet-user-gps {
          position: relative;
          width: 32px;
          height: 32px;
          display: flex;
          align-items: center;
          justify-content: center;
        }
        .user-gps-dot {
          width: 14px;
          height: 14px;
          background: #2563eb;
          border: 2.5px solid #ffffff;
          border-radius: 50%;
          box-shadow: 0 2px 10px rgba(37, 99, 235, 0.75);
          z-index: 2;
          position: relative;
        }
        .user-gps-pulse-ring {
          position: absolute;
          top: 0;
          left: 0;
          width: 32px;
          height: 32px;
          border-radius: 50%;
          background: rgba(37, 99, 235, 0.28);
          animation: user-gps-radar 2.2s infinite ease-out;
          z-index: 1;
        }
        @keyframes user-gps-radar {
          0% { transform: scale(0.5); opacity: 1; }
          70% { transform: scale(2.2); opacity: 0; }
          100% { transform: scale(2.2); opacity: 0; }
        }

        /* Worker Pulse Pin */
        .custom-leaflet-worker-pin {
          position: relative;
          display: flex;
          flex-direction: column;
          align-items: center;
        }
        .worker-pulse-dot {
          width: 14px;
          height: 14px;
          background: #22c55e;
          border: 2.5px solid white;
          border-radius: 50%;
          box-shadow: 0 0 10px rgba(34,197,94,0.8);
        }
        .worker-label-pill {
          position: absolute;
          top: 16px;
          background: white;
          color: #0f172a;
          font-size: 10px;
          font-weight: 800;
          padding: 2px 6px;
          border-radius: 6px;
          white-space: nowrap;
          box-shadow: 0 2px 8px rgba(0,0,0,0.15);
          pointer-events: none;
        }

        /* Open Job Work Request Pin (Uber Marketplace Style) */
        .custom-leaflet-job-pin {
          display: flex;
          flex-direction: column;
          align-items: center;
          cursor: pointer;
          transition: transform 0.2s cubic-bezier(0.34, 1.56, 0.64, 1);
        }
        .custom-leaflet-job-pin:hover,
        .custom-leaflet-job-pin.selected {
          transform: scale(1.15) translateY(-4px);
        }
        .job-pin-head {
          background: #4f46e5;
          color: white;
          padding: 4px 8px;
          border-radius: 12px;
          font-weight: 800;
          font-size: 11px;
          display: flex;
          align-items: center;
          gap: 4px;
          box-shadow: 0 4px 14px rgba(79, 70, 229, 0.45);
          border: 2px solid white;
        }
        .custom-leaflet-job-pin.selected .job-pin-head {
          background: #22c55e;
          box-shadow: 0 4px 18px rgba(34, 197, 94, 0.6);
        }
        .job-pin-badge {
          background: white;
          color: #1e1b4b;
          font-size: 9px;
          font-weight: 800;
          padding: 1px 6px;
          border-radius: 4px;
          margin-top: 2px;
          box-shadow: 0 2px 6px rgba(0,0,0,0.1);
          white-space: nowrap;
        }
        .job-pin-arrow {
          width: 0;
          height: 0;
          border-left: 5px solid transparent;
          border-right: 5px solid transparent;
          border-top: 6px solid #4f46e5;
          margin-top: -1px;
        }
        .custom-leaflet-job-pin.selected .job-pin-arrow {
          border-top-color: #22c55e;
        }

        /* Destination & Live Worker Pins */
        .custom-leaflet-dest-pin, .custom-leaflet-live-worker {
          position: relative;
          display: flex;
          flex-direction: column;
          align-items: center;
        }
        .broadcast-radar-ring {
          position: absolute;
          top: 16px;
          left: 50%;
          transform: translate(-50%, -50%);
          width: 56px;
          height: 56px;
          border-radius: 50%;
          border: 2px solid #6366f1;
          background: rgba(99, 102, 241, 0.22);
          animation: radar-pulse 2s cubic-bezier(0, 0.2, 0.8, 1) infinite;
          pointer-events: none;
        }
        @keyframes radar-pulse {
          0% { transform: translate(-50%, -50%) scale(0.2); opacity: 1; }
          100% { transform: translate(-50%, -50%) scale(1.6); opacity: 0; }
        }
        .dest-pin-core, .live-worker-core {
          width: 32px;
          height: 32px;
          border-radius: 50%;
          background: #ef4444;
          color: white;
          display: flex;
          align-items: center;
          justify-content: center;
          font-size: 16px;
          border: 2.5px solid white;
          box-shadow: 0 4px 12px rgba(239, 68, 68, 0.4);
        }
        .live-worker-core {
          background: #1e1b4b;
          box-shadow: 0 4px 12px rgba(0,0,0,0.3);
        }
        .dest-pin-label, .live-worker-label {
          background: white;
          color: #0f172a;
          font-size: 10px;
          font-weight: 800;
          padding: 2px 6px;
          border-radius: 6px;
          margin-top: 2px;
          box-shadow: 0 2px 6px rgba(0,0,0,0.15);
          white-space: nowrap;
        }
      `}</style>
    </div>
  );
}

function getProfessionEmoji(prof = '') {
  const p = (prof || '').toLowerCase();
  if (p.includes('elect')) return '⚡';
  if (p.includes('plumb')) return '🔧';
  if (p.includes('carp')) return '🪚';
  if (p.includes('ro') || p.includes('water')) return '💧';
  return '🛠️';
}
