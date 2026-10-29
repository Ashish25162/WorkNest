import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import L from 'leaflet';
import { Search, X, MapPin, Navigation, LocateFixed, Plus, Minus, ArrowRight, ArrowLeft, Route, Clock, Maximize2, Minimize2, BriefcaseBusiness, Check, LoaderCircle, GraduationCap, Building2 } from 'lucide-react';
import 'leaflet/dist/leaflet.css';
import './MapWorkspace.css';
import useLocationSearch from '../hooks/useLocationSearch';
import useDrivingRoute from '../hooks/useDrivingRoute';
import { smartSearchLocation, reverseGeocodeLocation } from '../utils/geoService';
import { findWorker, navigationUrl, distanceKm, turnInstruction } from '../utils/navigation';
import { apiUrl } from '../utils/api';
const DEFAULT = [22.7196, 75.8577];
const PIN = '<svg width="36" height="48" viewBox="0 0 36 48"><path d="M18 0C8 0 0 8 0 18c0 13 18 29 18 29s18-16 18-29C36 8 28 0 18 0Z" fill="#3730a3"/><circle cx="18" cy="17" r="7" fill="white"/><circle cx="18" cy="17" r="3" fill="#6366f1"/></svg>';
const icon = (html, size = [36, 48], anchor = [18, 47]) => L.divIcon({
  html,
  className: 'map-marker',
  iconSize: size,
  iconAnchor: anchor
});
const point = (lat, lng) => lat != null && lng != null && Number.isFinite(Number(lat)) && Number.isFinite(Number(lng)) ? {
  lat: Number(lat),
  lng: Number(lng)
} : null;
const terminal = booking => !booking || ['COMPLETED', 'CANCELLED', 'REJECTED'].includes(booking.status);
function PlaceSearch({
  coords,
  onSelect,
  onInteract,
  worker
}) {
  const search = useLocationSearch(coords);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState('');
  const sequence = useRef(0);
  useEffect(() => {
    sequence.current++;
    search.close();
    search.setQuery('');
  }, [coords[0], coords[1]]);
  const choose = place => {
    sequence.current++;
    onSelect(place);
    search.setQuery(place.short_name || place.primary);
    search.close();
    setMessage('');
  };
  const submit = async event => {
    event.preventDefault();
    if (!search.query.trim()) {
      search.focus();
      return;
    }
    const version = ++sequence.current;
    setBusy(true);
    setMessage('');
    search.close();
    try {
      const place = await smartSearchLocation(search.query, {
        lat: coords[0],
        lon: coords[1]
      });
      if (version !== sequence.current) return;
      if (place) choose(place);else {
        setMessage('Place not found. Try its shorter name and area, or choose a spot on the map.');
        search.focus();
      }
    } catch {
      if (version === sequence.current) setMessage('Place search could not connect. Please try again.');
    } finally {
      setBusy(false);
    }
  };
  return <div className="map-search-wrap">
    <form className="map-search" onSubmit={submit}>
      <Search size={19} />
      <div className="map-search-field"><label htmlFor="map-place-search">{worker ? 'EXPLORE YOUR AREA' : 'WHERE DO YOU NEED A SERVICE?'}</label>
        <input id="map-place-search" autoComplete="off" aria-label="Search places on map" placeholder="Search a college, building or area" value={search.query} onFocus={() => {
          onInteract?.();
          search.focus();
        }} onChange={e => {
          sequence.current++;
          onInteract?.();
          search.change(e.target.value);
          setMessage('');
        }} />
      </div>
      {search.query && <button type="button" className="map-icon-button" aria-label="Clear place search" onClick={() => search.change('')}><X size={17} /></button>}
      <button type="submit" className="map-search-submit" aria-label="Find place" disabled={busy}>{busy ? <LoaderCircle className="map-spin" size={18} /> : <ArrowRight size={18} />}</button>
    </form>
    {search.open && <div className="map-search-results">
      <div className="map-results-caption"><span>{search.loading ? 'Finding places…' : search.nearby ? 'NEARBY PLACES' : 'MATCHING PLACES'}</span><button type="button" aria-label="Close suggestions" className="map-icon-button" onClick={search.close}><X size={15} /></button></div>
      {search.suggestions.map(place => <button className="map-place-result" key={place.place_id} type="button" onClick={() => choose(place)}>
        <span className="map-place-icon">{/college|institute|university|school/i.test(place.primary) ? <GraduationCap size={19} /> : <Building2 size={18} />}</span>
        <span className="map-place-copy"><strong>{place.primary || place.short_name}</strong><small>{place.secondary || place.display_name}</small></span>
        <span className="map-place-distance">{distanceKm(coords[0], coords[1], place.lat, place.lon).toFixed(1)} km</span>
      </button>)}
      {!search.loading && !search.suggestions.length && <p className="map-search-empty">{search.error || message || 'No matching places here. Try a shorter name with the city, or place the pin manually.'}</p>}
      <div className="map-results-footer">Choose the correct campus or building, then adjust the pin to its entrance.</div>
    </div>}
    {message && !search.open && <p className="map-inline-message" role="status">{message}</p>}
  </div>;
}
export default function ServiceMap({
  deviceLocation = null,
  gpsStatus = 'idle',
  gpsError = null,
  onLocate = null,
  onLocationInteraction = null,
  workers = [],
  activeBooking = null,
  setActiveBooking,
  currentUser = null,
  bookingLocation = DEFAULT,
  setBookingLocation,
  setServiceAddress,
  serviceAddress = '',
  broadcasts = [],
  selectedJob = null,
  onSelectJob,
  onAcceptJob,
  refreshData,
  onSwitchToForm,
  mobileTab = 'map',
  expanded = false,
  onToggleExpand
}) {
  const container = useRef(null),
    mapRef = useRef(null),
    pinRef = useRef(null),
    markers = useRef(null),
    routeLayer = useRef(null),
    tileRef = useRef(null);
  const live = useRef(null),
    revision = useRef(0),
    userPanning = useRef(false),
    routeFit = useRef(''),
    confirmTimer = useRef(null);
  const selectedCoordinates = useRef(null);
  const [tilesStatus, setTilesStatus] = useState('loading');
  const [resolving, setResolving] = useState(false),
    [confirmed, setConfirmed] = useState(false),
    [accepting, setAccepting] = useState(false),
    [starting, setStarting] = useState(false);
  const [selectionError, setSelectionError] = useState('');
  const [explore, setExplore] = useState(null);
  const worker = currentUser?.role === 'WORKER';
  const picking = currentUser?.role === 'CUSTOMER' && terminal(activeBooking);
  const trip = !terminal(activeBooking) ? activeBooking : null;
  const activeWorker = useMemo(() => findWorker(workers, currentUser), [workers, currentUser]);
  const destinationBooking = trip || (worker ? selectedJob : null);
  const destination = point(destinationBooking?.startLat, destinationBooking?.startLng);
  const assignedWorker = workers.find(w => String(w.id) === String(trip?.workerId));
  const workerSaved = point(activeWorker?.latitude, activeWorker?.longitude);
  const origin = worker ? deviceLocation || point(trip?.workerCurrentLat, trip?.workerCurrentLng) || workerSaved : point(trip?.workerCurrentLat, trip?.workerCurrentLng) || point(assignedWorker?.latitude, assignedWorker?.longitude);
  const routing = useDrivingRoute(destinationBooking?.workerId || selectedJob ? origin : null, destination);
  const route = routing.route?.destinationKey === `${destination?.lat},${destination?.lng}` ? routing.route : null;
  const searchCoords = explore ? [explore.lat, explore.lng] : worker ? [deviceLocation?.lat ?? workerSaved?.lat ?? DEFAULT[0], deviceLocation?.lng ?? workerSaved?.lng ?? DEFAULT[1]] : bookingLocation;
  const commit = useCallback(async (lat, lng) => {
    const version = ++revision.current;
    const props = live.current;
    if (!props?.picking) return;
    selectedCoordinates.current = [lat, lng];
    mapRef.current?.setView([lat, lng], mapRef.current.getZoom(), {
      animate: false
    });
    props.onLocationInteraction?.();
    props.setBookingLocation?.([lat, lng]);
    props.setServiceAddress?.(lat.toFixed(5) + ', ' + lng.toFixed(5));
    setConfirmed(false);
    setResolving(true);
    const result = await reverseGeocodeLocation(lat, lng);
    if (revision.current === version) {
      props.setServiceAddress?.(result.display_name);
      setResolving(false);
    }
  }, []);
  useEffect(() => {
    live.current = {
      picking,
      worker,
      bookingLocation,
      setBookingLocation,
      setServiceAddress,
      onLocationInteraction
    };
  }, [picking, worker, bookingLocation, setBookingLocation, setServiceAddress, onLocationInteraction]);
  useEffect(() => {
    const map = L.map(container.current, {
      center: bookingLocation || DEFAULT,
      zoom: 16,
      zoomControl: false,
      attributionControl: true,
      inertia: false
    });
    mapRef.current = map;
    markers.current = L.layerGroup().addTo(map);
    routeLayer.current = L.layerGroup().addTo(map);
    const pin = L.marker(bookingLocation || DEFAULT, {
      draggable: true,
      autoPan: true,
      title: 'Drag to set your doorstep',
      icon: icon(PIN)
    });
    pinRef.current = pin;
    map.on('dragstart', () => {
      userPanning.current = true;
      routeFit.current = 'manual';
      if (live.current.picking) {
        revision.current++;
        live.current.onLocationInteraction?.();
        setConfirmed(false);
      }
    });
    map.on('move', () => {
      if (userPanning.current && live.current.picking) pin.setLatLng(map.getCenter());
    });
    map.on('dragend', () => {
      userPanning.current = false;
      if (live.current.picking) {
        const p = map.getCenter();
        commit(p.lat, p.lng);
      }
    });
    map.on('click', e => {
      if (live.current.picking) {
        map.panTo(e.latlng, {
          animate: false
        });
        pin.setLatLng(e.latlng);
        commit(e.latlng.lat, e.latlng.lng);
      }
    });
    pin.on('dragstart', () => {
      revision.current++;
      live.current.onLocationInteraction?.();
      setConfirmed(false);
    });
    pin.on('dragend', () => {
      const p = pin.getLatLng();
      commit(p.lat, p.lng);
    });
    let disposed = false,
      loaded = 0,
      fallback = false;
    const timers = [];
    const loadTiles = useFallback => {
      if (disposed) return;
      tileRef.current?.off();
      tileRef.current?.remove();
      loaded = 0;
      const primary = import.meta.env.DEV ? '/_map/tiles/{z}/{x}/{y}.png' : 'https://tile.openstreetmap.org/{z}/{x}/{y}.png';
      const secondary = import.meta.env.DEV ? '/_map/style/{z}/{x}/{y}.png' : 'https://tile.openstreetmap.de/{z}/{x}/{y}.png';
      const tiles = L.tileLayer(useFallback ? secondary : primary, {
        maxZoom: 19,
        attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap contributors</a>'
      });
      tileRef.current = tiles;
      tiles.on('tileload', () => {
        if (!disposed && tileRef.current === tiles) {
          loaded++;
          setTilesStatus('ready');
        }
      });
      tiles.on('tileerror', () => {
        if (!disposed && !loaded && !fallback) {
          fallback = true;
          loadTiles(true);
        }
      });
      tiles.addTo(map);
      timers.push(setTimeout(() => {
        if (disposed || loaded || tileRef.current !== tiles) return;
        if (!fallback) {
          fallback = true;
          loadTiles(true);
        } else setTilesStatus('error');
      }, 9000));
    };
    loadTiles(false);
    const observer = new ResizeObserver(() => {
      if (container.current?.clientWidth && container.current?.clientHeight) {
        const center = live.current.picking ? pin.getLatLng() : map.getCenter();
        map.invalidateSize({
          pan: false
        });
        map.setView(center, map.getZoom(), {
          animate: false
        });
      }
    });
    observer.observe(container.current);
    return () => {
      disposed = true;
      revision.current++;
      clearTimeout(confirmTimer.current);
      timers.forEach(clearTimeout);
      observer.disconnect();
      tileRef.current?.off();
      map.remove();
      mapRef.current = null;
    };
  }, [commit]);
  useEffect(() => {
    const map = mapRef.current,
      pin = pinRef.current;
    if (!map || !pin) return;
    if (picking) {
      pin.addTo(map);
      const previous = selectedCoordinates.current;
      const changed = !previous || previous[0] !== bookingLocation[0] || previous[1] !== bookingLocation[1];
      if (changed) {
        revision.current++;
        setConfirmed(false);
        setResolving(false);
        selectedCoordinates.current = [...bookingLocation];
      }
      pin.setLatLng(bookingLocation);
      if (changed) map.setView(bookingLocation, Math.max(map.getZoom(), 16), {
        animate: false
      });
    } else pin.remove();
  }, [picking, bookingLocation]);
  useEffect(() => {
    const map = mapRef.current;
    if (!map) return;
    markers.current.clearLayers();
    const add = (p, html, label, size = [34, 34]) => {
      if (!p) return;
      const marker = L.marker([p.lat, p.lng], {
        icon: icon(html, size, [size[0] / 2, size[1] === 48 ? 47 : size[1] / 2]),
        title: label
      });
      const popup = document.createElement('div');
      popup.textContent = label;
      marker.bindPopup(popup);
      markers.current.addLayer(marker);
    };
    if (!trip) {
      if (worker) broadcasts.forEach(job => add(point(job.startLat, job.startLng), '<span class="map-job-dot">₹' + Math.round(job.totalCost || 250) + '</span>', job.professionCategory + ' · ' + job.serviceAddress, [58, 34]));else workers.filter(w => w.available).forEach(w => add(point(w.latitude, w.longitude), '<span class="map-pro-dot">✓</span>', w.name + ' · ' + w.profession));
      if (worker) markers.current.eachLayer(layer => {
        const p = layer.getLatLng();
        const job = broadcasts.find(j => Number(j.startLat) === p.lat && Number(j.startLng) === p.lng);
        if (job) layer.on('click', () => onSelectJob?.(job));
      });
    }
    if (destination) add(destination, PIN, 'Customer destination', [36, 48]);
    if (!worker && origin) add(origin, '<span class="map-car-dot">➤</span>', trip?.workerName || 'Your professional');
    if (deviceLocation) {
      add(deviceLocation, '<span class="map-gps-dot"></span>', 'Your live GPS location');
      if (Number.isFinite(deviceLocation.accuracy)) markers.current.addLayer(L.circle([deviceLocation.lat, deviceLocation.lng], {
        radius: deviceLocation.accuracy,
        color: '#3b82f6',
        weight: 1,
        fillOpacity: 0.07,
        interactive: false
      }));
    }
    if (worker && explore && !trip && !selectedJob) add(explore, PIN, explore.name, [36, 48]);
  }, [workers, worker, trip, broadcasts, selectedJob, destination?.lat, destination?.lng, origin?.lat, origin?.lng, deviceLocation, explore, onSelectJob]);
  useEffect(() => {
    if (!routeLayer.current) return;
    routeLayer.current.clearLayers();
    if (route) {
      L.geoJSON(route.geometry, {
        style: {
          color: '#fff',
          weight: 9,
          opacity: .9
        }
      }).addTo(routeLayer.current);
      L.geoJSON(route.geometry, {
        style: {
          color: '#4f46e5',
          weight: 5,
          opacity: 1
        }
      }).addTo(routeLayer.current);
    }
  }, [route]);
  const frameRoute = useCallback(() => {
    const map = mapRef.current;
    if (!map || !container.current?.clientWidth) return;
    if (destination && origin) map.fitBounds([[origin.lat, origin.lng], [destination.lat, destination.lng]], {
      paddingTopLeft: [34, 100],
      paddingBottomRight: [34, container.current.clientHeight > 600 ? 270 : 180],
      maxZoom: 17,
      animate: false
    });else if (destination) map.setView([destination.lat, destination.lng], 16);else if (deviceLocation) map.setView([deviceLocation.lat, deviceLocation.lng], 17);
  }, [destination?.lat, destination?.lng, origin?.lat, origin?.lng, deviceLocation]);
  useEffect(() => {
    const key = destinationBooking?.id;
    if (key && routeFit.current !== String(key) && routeFit.current !== 'manual') {
      frameRoute();
      routeFit.current = String(key);
    }
    if (!key) routeFit.current = '';
  }, [destinationBooking?.id, route, frameRoute, mobileTab]);
  useEffect(() => {
    const frame = requestAnimationFrame(() => {
      mapRef.current?.invalidateSize({
        pan: false
      });
      if (destinationBooking && routeFit.current !== 'manual') frameRoute();
    });
    return () => cancelAnimationFrame(frame);
  }, [mobileTab, expanded, frameRoute, destinationBooking?.id]);
  useEffect(() => {
    if (worker && !destinationBooking && workerSaved && !explore) mapRef.current?.setView([workerSaved.lat, workerSaved.lng], 15, {
      animate: false
    });
  }, [worker, activeWorker?.id]);
  useEffect(() => {
    if (worker && !destinationBooking && deviceLocation && !explore && routeFit.current !== 'manual') mapRef.current?.setView([deviceLocation.lat, deviceLocation.lng], 16, {
      animate: false
    });
  }, [worker, destinationBooking?.id, deviceLocation, explore]);
  const choosePlace = place => {
    revision.current++;
    setResolving(false);
    setConfirmed(false);
    onLocationInteraction?.();
    const p = {
      lat: Number(place.lat),
      lng: Number(place.lon),
      name: place.display_name
    };
    setExplore(p);
    if (picking) {
      setBookingLocation?.([p.lat, p.lng]);
      setServiceAddress?.(place.display_name);
    }
    mapRef.current?.setView([p.lat, p.lng], 17, {
      animate: false
    });
  };
  const accept = async () => {
    if (accepting || !selectedJob) return;
    setAccepting(true);
    setSelectionError('');
    try {
      const updated = await onAcceptJob?.(selectedJob.id);
      if (updated) onSelectJob?.(null);
    } catch {
      setSelectionError('Could not accept this request. Please try again.');
    } finally {
      setAccepting(false);
    }
  };
  const startTravel = async () => {
    if (starting || !trip) return;
    setStarting(true);
    try {
      const response = await fetch(apiUrl('/api/bookings/' + trip.id + '/start-travel'), {
        method: 'PUT'
      });
      if (!response.ok) throw Error();
      setActiveBooking?.(await response.json());
      onLocate?.();
      refreshData?.();
    } catch {
      setSelectionError('Could not start travel. Please try again.');
    } finally {
      setStarting(false);
    }
  };
  const navigation = destination ? navigationUrl(destination.lat, destination.lng) : null;
  const minutes = route ? Math.max(1, Math.ceil(route.duration / 60)) : null;
  const steps = route?.legs?.flatMap(leg => leg.steps) || [];
  return <div className={'map-shell ' + (worker ? 'map-shell-worker' : '')}>
    <div ref={container} className="map-canvas" aria-label="Interactive service map" />
    {!trip && <PlaceSearch coords={searchCoords} worker={worker} onSelect={choosePlace} onInteract={onLocationInteraction} />}
    {trip && <div className="map-trip-heading"><span className="map-trip-icon"><Navigation size={20} /></span><div><small>{worker ? 'YOUR NEXT STOP' : 'LIVE BOOKING'}</small><strong>{worker ? 'Customer doorstep' : trip.workerName || 'Finding your professional'}</strong></div>{onSwitchToForm && <button className="map-icon-button" onClick={onSwitchToForm} title="Open job details"><ArrowLeft size={19} /></button>}</div>}
    <div className="map-controls">
      {onToggleExpand && <button title={expanded ? 'Exit full map' : 'Expand map'} aria-label={expanded ? 'Exit full map' : 'Expand map'} onClick={onToggleExpand}>{expanded ? <Minimize2 size={18} /> : <Maximize2 size={18} />}</button>}
      <button aria-label="Zoom in" onClick={() => mapRef.current?.zoomIn()}><Plus size={19} /></button><button aria-label="Zoom out" onClick={() => mapRef.current?.zoomOut()}><Minus size={19} /></button>
      <button aria-label="Use my GPS location" title="Use my GPS location" onClick={() => {
        routeFit.current = '';
        onLocate?.();
        frameRoute();
      }} disabled={gpsStatus === 'locating'}>{gpsStatus === 'locating' ? <LoaderCircle size={19} className="map-spin" /> : <LocateFixed size={20} />}</button>
      {destination && <button title="Show complete route" aria-label="Show complete route" onClick={() => {
        routeFit.current = '';
        frameRoute();
      }}><Route size={19} /></button>}
    </div>
    {tilesStatus !== 'ready' && <div className="map-connection" role="status">{tilesStatus === 'loading' ? 'Loading map…' : <><span>Map connection interrupted</span><button onClick={() => {
          setTilesStatus('loading');
          tileRef.current?.redraw();
        }}>Retry</button></>}</div>}
    {gpsError && <div className="map-gps-error" role="alert">{gpsError}</div>}
    {picking && <section className="map-bottom-card map-location-card">
      <div className="map-card-kicker"><span className="map-small-pin"><MapPin size={15} /></span> SERVICE LOCATION <span className="map-card-tag">{resolving ? 'Finding address…' : 'Pin on map'}</span></div>
      <h3>{serviceAddress || 'Choose your doorstep'}</h3><p>Drag the pin or tap the map to choose the entrance.</p>
      <button className="map-primary" onClick={() => {
        setBookingLocation?.([...bookingLocation]);
        setConfirmed(true);
        confirmTimer.current = setTimeout(() => onSwitchToForm?.(), 400);
      }}>{confirmed ? <><Check size={18} />Location confirmed</> : <>Confirm location<ArrowRight size={18} /></>}</button>
    </section>}
    {worker && selectedJob && !trip && <section className="map-bottom-card map-job-card"><div className="map-card-kicker">NEW SERVICE REQUEST<button aria-label="Close selected job" className="map-icon-button" onClick={() => onSelectJob?.(null)}><X size={17} /></button></div><div className="map-card-title"><h3>{selectedJob.professionCategory}</h3><strong>₹{Math.round(selectedJob.totalCost || 250)}</strong></div><p className="map-destination"><MapPin size={16} />{selectedJob.serviceAddress || 'Pinned customer doorstep'}</p><RouteSummary status={routing.status} minutes={minutes} route={route} live={!!deviceLocation} /><button className="map-primary map-worker-primary" disabled={accepting} onClick={accept}>{accepting ? <LoaderCircle className="map-spin" size={18} /> : <Check size={18} />}Accept & view route</button></section>}
    {trip && <section className="map-bottom-card map-navigation-card">
      <div className="map-card-kicker">{worker ? 'CUSTOMER DESTINATION' : 'BOOKING STATUS'}<span className="map-card-tag">{trip.status.replaceAll('_', ' ')}</span></div>
      <h3>{trip.serviceAddress || 'Pinned customer doorstep'}</h3>
      {trip.status === 'BROADCAST' ? <p>Looking for an available professional near your location.</p> : <RouteSummary status={routing.status} minutes={minutes} route={route} live={worker ? !!deviceLocation : !!trip.workerCurrentLat} />}
      {worker && navigation && <div className="map-navigation-actions">{trip.status === 'ACCEPTED' && <button className="map-secondary" disabled={starting} onClick={startTravel}>{starting ? <LoaderCircle className="map-spin" size={17} /> : <Navigation size={17} />}Start travel</button>}<a className="map-primary" href={navigation} target="_blank" rel="noopener noreferrer"><Navigation size={18} />Navigate in Google Maps</a></div>}
      {worker && steps.length > 0 && <details className="map-directions"><summary>Route directions <span>{steps.length} steps</span></summary><ol>{steps.map((step, index) => <li key={index}><ArrowRight size={14} /><span>{turnInstruction(step)}<small>{step.distance >= 1000 ? (step.distance / 1000).toFixed(1) + ' km' : Math.round(step.distance) + ' m'}</small></span></li>)}</ol></details>}
      {worker && onSwitchToForm && <button className="map-details-link" onClick={onSwitchToForm}>Open job details & chat<ArrowRight size={14} /></button>}
    </section>}
    {worker && !trip && !selectedJob && <div className="map-worker-status"><span className="map-online-dot" /><div><strong>{explore?.name || 'Find your next service request'}</strong><small>{broadcasts.length} open requests on the map · tap a price to see the route</small></div><BriefcaseBusiness size={20} /></div>}
    {selectionError && <div className="map-gps-error" role="alert">{selectionError}</div>}
  </div>;
}
function RouteSummary({
  status,
  minutes,
  route,
  live
}) {
  return <div className="map-route-summary">{route ? <><strong><Clock size={16} />{minutes}<small>min</small></strong><span className="map-metric-divider" /><strong>{(route.distance / 1000).toFixed(1)}<small>km</small></strong><span className="map-route-caption">{live ? 'Live location' : 'Saved worker location'}<small>Estimated drive</small></span></> : <p>{status === 'loading' ? 'Calculating driving route…' : status === 'error' ? 'Road route unavailable. Open Google Maps for directions.' : 'Enable GPS to calculate the route from your location.'}</p>}</div>;
}
