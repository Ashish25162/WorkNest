import React, { useState, useEffect, useRef } from 'react';
import { 
  Search, Star, Clock, MapPin, DollarSign, ShieldCheck, Play, 
  MessageCircle, Truck, IndianRupee, Wifi, Zap, Droplet, Hammer, 
  Settings, Wrench, CheckCircle2, ChevronRight, User, AlertCircle, Sparkles, Navigation
} from 'lucide-react';
import ChatSystem from './ChatSystem';
import { smartSearchLocation, getLiveSearchSuggestions, reverseGeocodeLocation, getApproximateIpLocation } from '../utils/geoService';
import { apiUrl } from '../utils/api';

export default function CustomerView({
  workers = [],
  activeBooking,
  setActiveBooking,
  refreshData,
  currentUser,
  onUpdateUser,
  bookingLocation,
  setBookingLocation,
  serviceAddress,
  setServiceAddress
}) {
  const [customerName, setCustomerName] = useState(currentUser?.name || 'Customer');
  const [taskDescription, setTaskDescription] = useState('');
  const [initialHours, setInitialHours] = useState(0.5); // Default 30 mins
  const [selectedProfession, setSelectedProfession] = useState('Electrician');
  const [showChat, setShowChat] = useState(false);
  const [hasUnread, setHasUnread] = useState(false);
  const [searchLocationQuery, setSearchLocationQuery] = useState('');
  const [isSearchingLocation, setIsSearchingLocation] = useState(false);
  const [searchSuggestions, setSearchSuggestions] = useState([]);
  const [showSearchSuggestions, setShowSearchSuggestions] = useState(false);
  const [isGpsLocating, setIsGpsLocating] = useState(false);
  const searchSuggestionsTimerRef = useRef(null);

  const availableProsCount = workers.filter(w => w.available).length;

  const placeholders = {
    'Electrician': 'e.g. Fan regulator replacement, short circuit, switchboard fix...',
    'RO Fitter': 'e.g. RO water purifier servicing, TDS adjustment, filter leak...',
    'Plumber': 'e.g. Leaking washroom tap, pipe connection, sink blockage...',
    'Carpenter': 'e.g. Door latch repair, bed frame assembly, wooden cabinet hinge...'
  };

  useEffect(() => {
    if (customerName && !activeBooking) {
      fetch(apiUrl(`/api/bookings/active/customer/${encodeURIComponent(customerName)}`))
        .then(async res => {
          if (res.ok) {
            const text = await res.text();
            if (text) {
              setActiveBooking(JSON.parse(text));
            }
          }
        })
        .catch(e => console.error(e));
    }
  }, [customerName, activeBooking]);

  // Synchronize input text with serviceAddress when address is discovered by map/GPS
  useEffect(() => {
    if (serviceAddress && !searchLocationQuery) {
      setSearchLocationQuery(serviceAddress);
    }
  }, [serviceAddress]);

  // Search location manually and auto-pin map using smart multi-tier geocoder
  const handleSearchLocation = async (overrideQuery = null) => {
    const q = (overrideQuery || searchLocationQuery || '').trim();
    if (!q) return;
    setIsSearchingLocation(true);
    setShowSearchSuggestions(false);
    try {
      const biasCoords = bookingLocation ? { lat: bookingLocation[0], lon: bookingLocation[1] } : null;
      const result = await smartSearchLocation(q, biasCoords);
      setIsSearchingLocation(false);
      if (result) {
        const lat = result.lat;
        const lng = result.lon;
        if (setBookingLocation) {
          setBookingLocation([lat, lng]);
        }
        if (setServiceAddress) {
          setServiceAddress(result.display_name);
        }
        setSearchLocationQuery(result.short_name || result.display_name);
      } else {
        alert(`Location "${q}" not found. Please try entering a well-known area, landmark, or city name.`);
      }
    } catch (err) {
      setIsSearchingLocation(false);
      alert('Error searching location. Please try again.');
    }
  };

  const handleSelectSuggestion = (place) => {
    const lat = parseFloat(place.lat);
    const lng = parseFloat(place.lon);
    if (setBookingLocation) setBookingLocation([lat, lng]);
    if (setServiceAddress) setServiceAddress(place.display_name);
    setSearchLocationQuery(place.short_name || place.display_name);
    setSearchSuggestions([]);
    setShowSearchSuggestions(false);
  };

  const handleSearchInputChange = (e) => {
    const val = e.target.value;
    setSearchLocationQuery(val);
    if (searchSuggestionsTimerRef.current) clearTimeout(searchSuggestionsTimerRef.current);
    if (!val || val.trim().length < 2) {
      setSearchSuggestions([]);
      setShowSearchSuggestions(false);
      return;
    }
    searchSuggestionsTimerRef.current = setTimeout(async () => {
      try {
        const biasCoords = bookingLocation ? { lat: bookingLocation[0], lon: bookingLocation[1] } : null;
        const list = await getLiveSearchSuggestions(val, biasCoords);
        if (Array.isArray(list) && list.length > 0) {
          setSearchSuggestions(list);
          setShowSearchSuggestions(true);
        } else {
          setSearchSuggestions([]);
          setShowSearchSuggestions(false);
        }
      } catch (err) {
        setSearchSuggestions([]);
        setShowSearchSuggestions(false);
      }
    }, 220);
  };

  const quickCities = [
    { name: '📍 Indore', lat: 22.7196, lng: 75.8577, addr: 'Indore, Madhya Pradesh' },
    { name: '📍 Bhopal', lat: 23.2599, lng: 77.4126, addr: 'Bhopal, Madhya Pradesh' },
    { name: '📍 Delhi NCR', lat: 28.6139, lng: 77.2090, addr: 'New Delhi, Delhi' },
    { name: '📍 Mumbai', lat: 19.0760, lng: 72.8777, addr: 'Mumbai, Maharashtra' },
    { name: '📍 Bangalore', lat: 12.9716, lng: 77.5946, addr: 'Bangalore, Karnataka' },
  ];

  const handleSelectCity = (c) => {
    if (setBookingLocation) setBookingLocation([c.lat, c.lng]);
    if (setServiceAddress) setServiceAddress(c.addr);
    setSearchLocationQuery(c.addr);
    setSearchSuggestions([]);
    setShowSearchSuggestions(false);
  };

  const handleUseCurrentGpsLocation = async () => {
    setIsGpsLocating(true);

    const applyCoords = async (lat, lng, addressHint = null) => {
      if (setBookingLocation) setBookingLocation([lat, lng]);
      if (addressHint) {
        if (setServiceAddress) setServiceAddress(addressHint);
        setSearchLocationQuery(addressHint);
      } else {
        try {
          const rev = await reverseGeocodeLocation(lat, lng);
          const fullAddr = rev.display_name || `${lat.toFixed(4)}, ${lng.toFixed(4)}`;
          if (setServiceAddress) setServiceAddress(fullAddr);
          setSearchLocationQuery(rev.short_name || fullAddr);
        } catch (e) {
          setSearchLocationQuery(`${lat.toFixed(4)}, ${lng.toFixed(4)}`);
        }
      }
      setIsGpsLocating(false);
    };

    if (navigator.geolocation) {
      navigator.geolocation.getCurrentPosition(
        async (pos) => {
          await applyCoords(pos.coords.latitude, pos.coords.longitude);
        },
        async (err) => {
          console.warn('GPS position failed, falling back to IP location:', err?.message);
          try {
            const ipLoc = await getApproximateIpLocation();
            if (ipLoc && ipLoc.lat && ipLoc.lng) {
              await applyCoords(ipLoc.lat, ipLoc.lng, ipLoc.display_name || ipLoc.short_name);
              return;
            }
          } catch (e) {}
          setIsGpsLocating(false);
          alert('Could not detect location. Please search your area or pick a city chip.');
        },
        { enableHighAccuracy: true, timeout: 4000, maximumAge: 30000 }
      );
    } else {
      try {
        const ipLoc = await getApproximateIpLocation();
        if (ipLoc && ipLoc.lat && ipLoc.lng) {
          await applyCoords(ipLoc.lat, ipLoc.lng, ipLoc.display_name || ipLoc.short_name);
          return;
        }
      } catch (e) {}
      setIsGpsLocating(false);
      alert('Geolocation not supported. Please search your area or pick a city chip.');
    }
  };

  // Duration options to price mapping
  const durationOptions = [
    { label: '30 Mins', value: 0.5, price: 250, badge: 'Quick Fix' },
    { label: '50 Mins', value: 0.833, price: 350, badge: 'Popular' },
    { label: '1 Hour', value: 1.0, price: 400, badge: 'Standard' },
    { label: '80 Mins', value: 1.333, price: 500, badge: 'Extended' },
    { label: '2 Hours', value: 2.0, price: 650, badge: 'Deep Repair' },
  ];

  const handleBook = async (e) => {
    e.preventDefault();
    if (!bookingLocation) {
      alert('Please select or pin your service location on the map before requesting.');
      return;
    }

    try {
      const response = await fetch(apiUrl('/api/bookings'), {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          customerName,
          taskDescription: taskDescription || `Urgent ${selectedProfession} required`,
          professionCategory: selectedProfession,
          initialHours: parseFloat(initialHours),
          startLat: bookingLocation[0],
          startLng: bookingLocation[1],
          serviceAddress: serviceAddress || 'Pinned Location'
        })
      });

      if (response.ok) {
        const booking = await response.json();
        setActiveBooking(booking);
        setTaskDescription('');
        refreshData();
      } else {
        const errorText = await response.text();
        alert(errorText || 'Failed to request service technician');
      }
    } catch (err) {
      console.error(err);
      alert('Error creating booking request');
    }
  };

  const handleCancelBooking = async () => {
    if (!activeBooking) return;
    if (!window.confirm('Are you sure you want to cancel this service request?')) return;
    try {
      const res = await fetch(apiUrl(`/api/bookings/${activeBooking.id}/cancel`), { method: 'PUT' });
      if (res.ok) {
        setActiveBooking(null);
        refreshData();
      } else {
        const data = await res.json();
        alert(data.error || 'Failed to cancel');
      }
    } catch (e) {
      console.error(e);
      alert('Network Error');
    }
  };

  const handleCloseInvoice = () => {
    setActiveBooking(null);
    refreshData();
  };

  // ─────────────────────────────────────────────────────────────────────────────
  // ACTIVE BOOKING FLOW
  // ─────────────────────────────────────────────────────────────────────────────
  if (activeBooking) {
    const { status, workerName, initialHours, actualHours, totalCost, startOtp } = activeBooking;
    
    return (
      <div className="glass-panel" style={{
        padding: '24px',
        display: 'flex',
        flexDirection: 'column',
        gap: '20px',
        height: '100%',
        overflowY: 'auto',
        background: 'var(--bg-card)'
      }}>
        {/* Status Header */}
        <div style={{
          paddingBottom: '16px',
          borderBottom: '1px solid var(--border-color)',
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center'
        }}>
          <div>
            <span className={`badge ${
              status === 'BROADCAST' ? 'badge-primary' :
              status === 'EN_ROUTE' || status === 'ACCEPTED' ? 'badge-info' :
              status === 'ACTIVE' ? 'badge-success' : 'badge-warning'
            }`} style={{ textTransform: 'uppercase', marginBottom: '6px' }}>
              ● {status.replace('_', ' ')}
            </span>
            <h2 style={{ fontSize: '1.35rem', fontWeight: '800', color: 'var(--text-primary)', margin: 0 }}>
              Active Service Order
            </h2>
          </div>
          <span style={{ fontSize: '0.78rem', color: 'var(--text-muted)', fontWeight: '700' }}>
            ID #{activeBooking.id}
          </span>
        </div>

        {/* BROADCAST STATE (Searching) */}
        {status === 'BROADCAST' && (
          <div style={{
            textAlign: 'center',
            padding: '28px 16px',
            display: 'flex',
            flexDirection: 'column',
            gap: '18px',
            alignItems: 'center',
            background: 'var(--bg-subtle)',
            borderRadius: '20px',
            border: '1px solid var(--border-color)'
          }}>
            <div style={{
              width: '72px',
              height: '72px',
              borderRadius: '50%',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              background: 'var(--accent-primary-light)',
              color: 'var(--accent-primary)',
              position: 'relative'
            }}>
              <Wifi size={34} style={{ animation: 'pulse 1.5s infinite' }} />
              <div style={{
                position: 'absolute',
                width: '100%',
                height: '100%',
                borderRadius: '50%',
                border: '2px solid var(--accent-primary)',
                animation: 'ping 2s cubic-bezier(0, 0, 0.2, 1) infinite'
              }} />
            </div>

            <div>
              <h3 style={{ fontSize: '1.15rem', fontWeight: '800', color: 'var(--text-primary)', marginBottom: '6px' }}>
                Broadcasting to Nearby {activeBooking.professionCategory}s...
              </h3>
              <p style={{ fontSize: '0.86rem', color: 'var(--text-secondary)', maxWidth: '320px', margin: '0 auto', lineHeight: 1.5 }}>
                Our dispatch engine is matching you with the highest-rated professional in your area. They will accept within seconds.
              </p>
            </div>

            <div style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: '6px',
              fontSize: '0.78rem',
              color: 'var(--accent-primary)',
              fontWeight: '700',
              background: 'var(--accent-primary-light)',
              padding: '6px 14px',
              borderRadius: '9999px'
            }}>
              <Sparkles size={14} /> Estimated Arrival: 15-20 Mins
            </div>

            <button
              onClick={handleCancelBooking}
              className="btn btn-secondary"
              style={{
                color: 'var(--danger)',
                borderColor: 'rgba(239,68,68,0.2)',
                background: 'var(--danger-light)',
                padding: '10px 20px',
                fontSize: '0.85rem'
              }}
            >
              Cancel Request
            </button>
          </div>
        )}

        {/* ONGOING STATE (ACCEPTED, EN_ROUTE, ACTIVE) */}
        {(status === 'ACCEPTED' || status === 'EN_ROUTE' || status === 'ACTIVE') && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
            
            {/* Technician Profile Card */}
            <div style={{
              padding: '18px',
              borderRadius: '16px',
              background: 'var(--bg-subtle)',
              border: '1px solid var(--border-color)',
              display: 'flex',
              alignItems: 'center',
              gap: '14px'
            }}>
              <div style={{
                width: '52px',
                height: '52px',
                borderRadius: '50%',
                background: 'var(--accent-worker-gradient)',
                color: '#fff',
                fontSize: '1.2rem',
                fontWeight: '900',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                boxShadow: '0 4px 12px rgba(16, 185, 129, 0.3)'
              }}>
                {workerName ? workerName.charAt(0).toUpperCase() : 'W'}
              </div>
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                  <span style={{ fontSize: '1.05rem', fontWeight: '800', color: 'var(--text-primary)' }}>
                    {workerName}
                  </span>
                  <ShieldCheck size={16} color="var(--success)" />
                </div>
                <div style={{ fontSize: '0.78rem', color: 'var(--text-muted)', display: 'flex', alignItems: 'center', gap: '6px', marginTop: '2px' }}>
                  <span>Verified {activeBooking.professionCategory}</span>
                  <span>•</span>
                  <span style={{ display: 'flex', alignItems: 'center', color: 'var(--warning)', fontWeight: '700' }}>
                    <Star size={12} fill="var(--warning)" style={{ marginRight: '2px' }} /> 4.9
                  </span>
                </div>
              </div>
            </div>

            {/* High-Security Start OTP Card */}
            <div style={{
              padding: '18px 20px',
              borderRadius: '18px',
              background: 'var(--warning-light)',
              border: '1px solid rgba(245, 158, 11, 0.3)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between'
            }}>
              <div>
                <div style={{ fontSize: '0.75rem', fontWeight: '800', color: 'var(--warning)', textTransform: 'uppercase', letterSpacing: '0.06em' }}>
                  🔐 Security Start OTP
                </div>
                <div style={{ fontSize: '0.82rem', color: 'var(--text-secondary)', marginTop: '3px' }}>
                  Share with technician only at your doorstep
                </div>
              </div>
              <div style={{
                background: 'var(--warning)',
                color: '#000000',
                padding: '10px 18px',
                borderRadius: '12px',
                fontSize: '1.6rem',
                fontWeight: '900',
                letterSpacing: '3px',
                boxShadow: '0 4px 12px rgba(245, 158, 11, 0.35)'
              }}>
                {startOtp}
              </div>
            </div>

            {/* In-Progress Live Meter */}
            {status === 'ACTIVE' && (
              <div style={{
                padding: '18px',
                borderRadius: '16px',
                background: 'var(--success-light)',
                border: '1px solid rgba(16, 185, 129, 0.3)',
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'center'
              }}>
                <div>
                  <div style={{ fontSize: '0.75rem', fontWeight: '800', color: 'var(--success)', textTransform: 'uppercase' }}>
                    Work Session in Progress
                  </div>
                  <div style={{ fontSize: '0.82rem', color: 'var(--text-secondary)', marginTop: '2px' }}>
                    Standard transparent hourly tracking
                  </div>
                </div>
                <div style={{ textAlign: 'right' }}>
                  <div style={{ fontSize: '1.4rem', fontWeight: '900', color: 'var(--success)' }}>
                    ₹{totalCost ? totalCost.toFixed(2) : '250.00'}
                  </div>
                  <div style={{ fontSize: '0.72rem', color: 'var(--text-muted)' }}>Est. Total</div>
                </div>
              </div>
            )}

            {/* Chat Toggle Button */}
            <button
              onClick={() => { setShowChat(!showChat); setHasUnread(false); }}
              className="btn btn-secondary"
              style={{
                width: '100%',
                padding: '12px',
                borderRadius: '12px',
                position: 'relative',
                fontWeight: '700'
              }}
            >
              <MessageCircle size={18} color="var(--accent-primary)" />
              {showChat ? 'Close Chat' : `Chat with ${workerName}`}
              {hasUnread && !showChat && (
                <div style={{
                  position: 'absolute',
                  top: '8px',
                  right: '12px',
                  width: '8px',
                  height: '8px',
                  background: 'var(--danger)',
                  borderRadius: '50%'
                }} />
              )}
            </button>

            {/* Chat Container */}
            <div style={{ display: showChat ? 'block' : 'none' }}>
              <ChatSystem 
                bookingId={activeBooking.id} 
                senderName={customerName} 
                senderRole="CUSTOMER" 
                onClose={() => setShowChat(false)}
                isVisible={showChat}
                onUnread={() => setHasUnread(true)}
              />
            </div>
          </div>
        )}

        {/* COMPLETED STATE */}
        {status === 'COMPLETED' && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '18px' }}>
            <div style={{
              display: 'flex',
              gap: '12px',
              alignItems: 'center',
              padding: '16px',
              borderRadius: '16px',
              background: 'var(--success-light)',
              border: '1px solid rgba(16, 185, 129, 0.3)'
            }}>
              <CheckCircle2 size={32} color="var(--success)" />
              <div>
                <div style={{ fontWeight: '800', fontSize: '1.05rem', color: 'var(--text-primary)' }}>
                  Service Completed Successfully!
                </div>
                <div style={{ fontSize: '0.82rem', color: 'var(--text-secondary)' }}>
                  Thank you for using WorkNest. Settle the digital invoice below.
                </div>
              </div>
            </div>

            {/* Invoice Breakdown */}
            <div style={{
              padding: '22px',
              borderRadius: '18px',
              background: 'var(--bg-subtle)',
              border: '1px solid var(--border-color)',
              display: 'flex',
              flexDirection: 'column',
              gap: '12px'
            }}>
              <div style={{ fontWeight: '800', fontSize: '1rem', color: 'var(--text-primary)', borderBottom: '1px solid var(--border-color)', paddingBottom: '10px' }}>
                Tax Invoice Breakdown
              </div>
              
              <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.88rem', color: 'var(--text-secondary)' }}>
                <span>Service Category:</span>
                <span style={{ fontWeight: '700', color: 'var(--text-primary)' }}>{activeBooking.professionCategory}</span>
              </div>
              
              <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.88rem', color: 'var(--text-secondary)' }}>
                <span>Duration Rendered:</span>
                <span style={{ fontWeight: '700', color: 'var(--text-primary)' }}>{activeBooking.actualHours ? activeBooking.actualHours.toFixed(1) : initialHours} Hours</span>
              </div>

              <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.88rem', color: 'var(--text-secondary)' }}>
                <span>Doorstep Inspection & Labor:</span>
                <span style={{ fontWeight: '700', color: 'var(--text-primary)' }}>Included</span>
              </div>
              
              <div style={{ borderTop: '1px dashed var(--border-color)', margin: '4px 0' }} />
              
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <span style={{ fontWeight: '800', fontSize: '1.05rem', color: 'var(--text-primary)' }}>
                  Total Payable:
                </span>
                <span style={{ fontWeight: '900', fontSize: '1.4rem', color: 'var(--success)' }}>
                  ₹{activeBooking.totalCost ? activeBooking.totalCost.toFixed(2) : '350.00'}
                </span>
              </div>
            </div>

            {/* Cashless Payment Details */}
            <div style={{
              padding: '18px',
              borderRadius: '16px',
              background: 'var(--accent-primary-light)',
              border: '1px solid rgba(79, 70, 229, 0.25)',
              textAlign: 'center'
            }}>
              <div style={{ fontSize: '0.75rem', fontWeight: '800', color: 'var(--accent-primary)', textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: '6px' }}>
                Direct Cashless Pay (GPay / PhonePe / Paytm / UPI)
              </div>
              <div style={{ fontSize: '1.35rem', fontWeight: '900', color: 'var(--accent-primary)', letterSpacing: '2px' }}>
                9399649234
              </div>
              <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)', marginTop: '4px' }}>
                UPI ID: <span style={{ fontWeight: '700' }}>a6272936@okaxis</span> or Hand over Cash to Pro
              </div>
            </div>

            <button
              onClick={handleCloseInvoice}
              className="btn btn-customer"
              style={{ width: '100%', padding: '14px', fontSize: '0.95rem', fontWeight: '800' }}
            >
              Done • Book Another Service
            </button>
          </div>
        )}
      </div>
    );
  }

  // ─────────────────────────────────────────────────────────────────────────────
  // PRE-BOOKING DISPATCH FLOW
  // ─────────────────────────────────────────────────────────────────────────────
  return (
    <div style={{
      display: 'flex',
      flexDirection: 'column',
      gap: '18px',
      height: '100%',
      overflowY: 'auto',
      paddingRight: '4px'
    }}>
      
      {/* Welcome Card */}
      <div style={{
        padding: '22px 20px',
        borderRadius: '20px',
        background: 'var(--accent-primary-gradient)',
        color: '#ffffff',
        position: 'relative',
        overflow: 'hidden',
        boxShadow: '0 8px 24px -4px rgba(79, 70, 229, 0.35)'
      }}>
        <div style={{ position: 'relative', zIndex: 1 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '6px' }}>
            <span style={{ fontSize: '0.78rem', fontWeight: '800', background: 'rgba(255,255,255,0.2)', padding: '3px 10px', borderRadius: '9999px', textTransform: 'uppercase' }}>
              ⚡ 15-Min Doorstep Dispatch
            </span>
          </div>
          <h2 style={{ fontSize: '1.45rem', fontWeight: '900', letterSpacing: '-0.02em', margin: '0 0 6px 0' }}>
            What do you need repaired?
          </h2>
          <p style={{ fontSize: '0.86rem', opacity: 0.9, margin: 0, lineHeight: 1.4 }}>
            Choose a specialty. We match with the nearest background-checked professional.
          </p>
        </div>
      </div>

      <form onSubmit={handleBook} style={{ display: 'flex', flexDirection: 'column', gap: '18px' }}>
        
        {/* Service Category Grid */}
        <div className="form-group" style={{ marginBottom: 0 }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '8px' }}>
            <label className="form-label" style={{ margin: 0 }}>Service Category</label>
            <span style={{ fontSize: '0.75rem', color: 'var(--accent-primary)', fontWeight: '700' }}>
              Standard Fixed Rates
            </span>
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: '12px' }}>
            {[
              { name: 'Electrician', icon: <Zap size={22} />, color: '#4f46e5', basePrice: '₹250' },
              { name: 'RO Fitter', icon: <Droplet size={22} />, color: '#0284c7', basePrice: '₹350' },
              { name: 'Plumber', icon: <Wrench size={22} />, color: '#06b6d4', basePrice: '₹250' },
              { name: 'Carpenter', icon: <Hammer size={22} />, color: '#d97706', basePrice: '₹300' }
            ].map(cat => {
              const isSelected = selectedProfession === cat.name;
              return (
                <div 
                  key={cat.name}
                  onClick={() => setSelectedProfession(cat.name)}
                  style={{
                    padding: '16px 14px',
                    borderRadius: '16px',
                    border: isSelected ? '2px solid var(--accent-primary)' : '1px solid var(--border-color)',
                    background: isSelected ? 'var(--accent-primary-light)' : 'var(--bg-subtle)',
                    cursor: 'pointer',
                    display: 'flex',
                    flexDirection: 'column',
                    gap: '10px',
                    transition: 'all 0.2s cubic-bezier(0.16, 1, 0.3, 1)',
                    boxShadow: isSelected ? 'var(--shadow-md)' : 'none',
                    transform: isSelected ? 'translateY(-2px)' : 'none'
                  }}
                >
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <div style={{
                      width: '42px',
                      height: '42px',
                      borderRadius: '12px',
                      background: isSelected ? 'var(--accent-primary)' : `${cat.color}15`,
                      color: isSelected ? '#ffffff' : cat.color,
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      transition: 'all 0.2s'
                    }}>
                      {cat.icon}
                    </div>
                    {isSelected && (
                      <CheckCircle2 size={18} color="var(--accent-primary)" />
                    )}
                  </div>
                  <div>
                    <div style={{ fontWeight: '800', fontSize: '0.95rem', color: isSelected ? 'var(--accent-primary)' : 'var(--text-primary)' }}>
                      {cat.name}
                    </div>
                    <div style={{ fontSize: '0.74rem', color: 'var(--text-muted)', marginTop: '2px' }}>
                      From {cat.basePrice}
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        {/* Duration / Package Selector */}
        <div className="form-group" style={{ marginBottom: 0 }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '8px' }}>
            <label className="form-label" style={{ margin: 0 }}>Estimated Work Duration</label>
            <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>Pay for actual time</span>
          </div>

          <div className="touch-scroll-x" style={{
            display: 'flex',
            gap: '8px',
            overflowX: 'auto',
            paddingBottom: '4px',
            scrollbarWidth: 'none',
            WebkitOverflowScrolling: 'touch'
          }}>
            {durationOptions.map(opt => {
              const isSelected = initialHours === opt.value;
              return (
                <div 
                  key={opt.value}
                  onClick={() => setInitialHours(opt.value)}
                  style={{
                    minWidth: '105px',
                    padding: '12px 10px',
                    borderRadius: '14px',
                    border: isSelected ? '2px solid var(--accent-primary)' : '1px solid var(--border-color)',
                    background: isSelected ? 'var(--accent-primary)' : 'var(--bg-subtle)',
                    color: isSelected ? '#ffffff' : 'var(--text-primary)',
                    cursor: 'pointer',
                    display: 'flex',
                    flexDirection: 'column',
                    alignItems: 'center',
                    gap: '4px',
                    transition: 'all 0.2s',
                    boxShadow: isSelected ? '0 6px 16px -2px rgba(79, 70, 229, 0.4)' : 'none',
                    transform: isSelected ? 'scale(1.02)' : 'none'
                  }}
                >
                  <span style={{ fontSize: '0.68rem', fontWeight: '800', opacity: isSelected ? 0.9 : 0.6, textTransform: 'uppercase' }}>
                    {opt.badge}
                  </span>
                  <span style={{ fontWeight: '800', fontSize: '0.85rem' }}>
                    {opt.label}
                  </span>
                  <span style={{ fontWeight: '900', fontSize: '1.05rem', color: isSelected ? '#ffffff' : 'var(--accent-primary)' }}>
                    ₹{opt.price}
                  </span>
                </div>
              );
            })}
          </div>
        </div>

        {/* Doorstep Location Search & GPS Pinning */}
        <div className="form-group" style={{ marginBottom: 0, position: 'relative' }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '6px' }}>
            <label className="form-label" style={{ marginBottom: 0 }}>Doorstep Location</label>
            <button
              type="button"
              onClick={handleUseCurrentGpsLocation}
              disabled={isGpsLocating}
              style={{
                background: 'none',
                border: 'none',
                color: 'var(--accent-customer)',
                fontSize: '0.8rem',
                fontWeight: 700,
                cursor: 'pointer',
                display: 'flex',
                alignItems: 'center',
                gap: '5px',
                padding: '2px 6px',
                borderRadius: '6px'
              }}
              title="Pin map to current GPS location"
            >
              <Navigation size={13} style={{ transform: isGpsLocating ? 'rotate(45deg)' : 'none', transition: 'transform 0.3s' }} />
              {isGpsLocating ? 'Pinning GPS...' : 'Use My GPS'}
            </button>
          </div>

          <div style={{ display: 'flex', gap: '8px', position: 'relative' }}>
            <div style={{ position: 'relative', flex: 1 }}>
              <Search size={18} style={{ position: 'absolute', left: '14px', top: '50%', transform: 'translateY(-50%)', color: 'var(--text-muted)' }} />
              <input 
                type="text"
                className="form-input"
                value={searchLocationQuery}
                onChange={handleSearchInputChange}
                onFocus={() => { if (searchSuggestions.length > 0) setShowSearchSuggestions(true); }}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') {
                    e.preventDefault();
                    if (searchSuggestions.length > 0) {
                      handleSelectSuggestion(searchSuggestions[0]);
                    } else {
                      handleSearchLocation();
                    }
                  }
                }}
                placeholder="Search area, landmark or street..."
                style={{ paddingLeft: '44px' }}
              />
              {searchLocationQuery && (
                <button
                  type="button"
                  onClick={() => { setSearchLocationQuery(''); setSearchSuggestions([]); setShowSearchSuggestions(false); }}
                  style={{
                    position: 'absolute', right: '12px', top: '50%', transform: 'translateY(-50%)',
                    background: 'transparent', border: 'none', color: '#94a3b8',
                    cursor: 'pointer', fontSize: '0.9rem', padding: '4px'
                  }}
                >
                  ✕
                </button>
              )}
            </div>
            <button
              type="button"
              onClick={() => {
                if (searchSuggestions.length > 0) {
                  handleSelectSuggestion(searchSuggestions[0]);
                } else {
                  handleSearchLocation();
                }
              }}
              disabled={isSearchingLocation}
              className="btn btn-secondary"
              style={{ whiteSpace: 'nowrap', padding: '0 16px', fontSize: '0.85rem' }}
            >
              {isSearchingLocation ? 'Locating...' : 'Search'}
            </button>
          </div>

          {/* Live search suggestions dropdown */}
          {showSearchSuggestions && searchSuggestions.length > 0 && (
            <div style={{
              position: 'absolute', top: '100%', left: 0, right: 0, marginTop: '6px',
              background: 'white', borderRadius: '12px', overflow: 'hidden',
              boxShadow: '0 10px 25px rgba(0,0,0,0.15), 0 0 0 1px rgba(0,0,0,0.06)',
              zIndex: 100, maxHeight: '240px', overflowY: 'auto'
            }}>
              {searchSuggestions.map((item, idx) => (
                <div
                  key={item.place_id || idx}
                  onClick={() => handleSelectSuggestion(item)}
                  style={{
                    padding: '10px 14px', display: 'flex', alignItems: 'center', gap: '10px',
                    cursor: 'pointer', borderBottom: idx < searchSuggestions.length - 1 ? '1px solid #f1f5f9' : 'none',
                    transition: 'background 0.15s ease'
                  }}
                  onMouseOver={(e) => e.currentTarget.style.background = '#f8fafc'}
                  onMouseOut={(e) => e.currentTarget.style.background = 'white'}
                >
                  <MapPin size={16} color="var(--accent-customer)" style={{ flexShrink: 0 }} />
                  <div style={{ minWidth: 0, flex: 1 }}>
                    <div style={{ fontWeight: 700, fontSize: '0.85rem', color: '#1e293b', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                      {item.primary || item.short_name}
                    </div>
                    <div style={{ fontSize: '0.72rem', color: '#94a3b8', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                      {item.secondary || item.display_name}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}

          {/* Quick Indian City Chips */}
          <div className="touch-scroll-x" style={{
            display: 'flex', gap: '6px', alignItems: 'center', marginTop: '10px',
            overflowX: 'auto', paddingBottom: '2px', scrollbarWidth: 'none', WebkitOverflowScrolling: 'touch'
          }}>
            <span style={{ fontSize: '0.72rem', fontWeight: 800, color: 'var(--text-muted)', whiteSpace: 'nowrap' }}>
              Quick City:
            </span>
            {quickCities.map((c, i) => (
              <button
                key={i}
                type="button"
                onClick={() => handleSelectCity(c)}
                style={{
                  background: 'var(--bg-card)', border: '1px solid var(--border-color)', borderRadius: '14px',
                  padding: '3px 10px', fontSize: '0.74rem', fontWeight: 700, cursor: 'pointer',
                  color: 'var(--text-primary)', whiteSpace: 'nowrap',
                  boxShadow: 'var(--shadow-sm)'
                }}
              >
                {c.name}
              </button>
            ))}
          </div>
        </div>

        {/* Confirmed Service Address */}
        <div className="form-group" style={{ marginBottom: 0 }}>
          <label className="form-label">Confirmed Street Address / Flat No.</label>
          <div style={{ position: 'relative' }}>
            <MapPin size={18} style={{ position: 'absolute', left: '14px', top: '50%', transform: 'translateY(-50%)', color: 'var(--text-muted)' }} />
            <input 
              type="text"
              className="form-input"
              value={serviceAddress || ''}
              onChange={(e) => setServiceAddress ? setServiceAddress(e.target.value) : null}
              placeholder="e.g. Flat 402, Sunshine Heights, Main Road"
              required
              style={{ paddingLeft: '44px' }}
            />
          </div>
        </div>

        {/* Task Details */}
        <div className="form-group" style={{ marginBottom: 0 }}>
          <label className="form-label">Issue Details (Optional)</label>
          <textarea 
            className="form-input" 
            rows="2"
            value={taskDescription}
            onChange={(e) => setTaskDescription(e.target.value)}
            placeholder={placeholders[selectedProfession] || 'Describe the problem in short...'}
            style={{ resize: 'none' }}
          />
        </div>

        {!bookingLocation && (
          <div style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            gap: '8px',
            color: 'var(--warning)',
            background: 'var(--warning-light)',
            padding: '10px 14px',
            borderRadius: '12px',
            fontSize: '0.82rem',
            fontWeight: '600'
          }}>
            <AlertCircle size={16} /> Drag map pin or search location before requesting
          </div>
        )}

        {/* Submit Booking Button */}
        <button
          type="submit"
          disabled={!bookingLocation}
          className="btn btn-customer"
          style={{
            padding: '16px',
            fontSize: '1.05rem',
            fontWeight: '800',
            borderRadius: '14px',
            boxShadow: '0 8px 24px -4px rgba(79, 70, 229, 0.45)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            gap: '8px'
          }}
        >
          <Zap size={20} /> Request {selectedProfession} • ₹{durationOptions.find(o => o.value === initialHours)?.price}
        </button>
      </form>
    </div>
  );
}
