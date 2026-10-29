import { useState, useEffect, useRef } from 'react';
import { apiUrl, assetUrl } from '../utils/api';
import { smartSearchLocation, getLiveSearchSuggestions } from '../utils/geoService';
import { 
  Smartphone, Zap, ShieldCheck, Star, Clock, MapPin, CheckCircle2, 
  ArrowRight, Wrench, Droplet, Hammer, ChevronRight,
  Sparkles, Check, Search, AlertCircle, IndianRupee
} from 'lucide-react';

export default function LandingPage({ onEnterApp, workers: propWorkers = [] }) {
  const [deferredPrompt, setDeferredPrompt] = useState(null);
  const [activeTab, setActiveTab] = useState('Electrician');
  const [heroSearchInput, setHeroSearchInput] = useState('');
  const [heroSuggestions, setHeroSuggestions] = useState([]);
  const [showHeroSuggestions, setShowHeroSuggestions] = useState(false);
  const heroTimerRef = useRef(null);
  const [fetchedWorkers, setFetchedWorkers] = useState([]);
  const [userLocation, setUserLocation] = useState(() => {
    try {
      const saved = localStorage.getItem('worknest_last_coords');
      if (saved) return JSON.parse(saved);
    } catch (e) {}
    return { lat: 22.7196, lng: 75.8577 }; // Default Indore
  });

  useEffect(() => {
    if (!propWorkers || propWorkers.length === 0) {
      fetch(apiUrl(`/api/workers?_=${Date.now()}`))
        .then(res => res.ok ? res.json() : [])
        .then(data => {
          if (Array.isArray(data)) setFetchedWorkers(data);
        })
        .catch(err => console.warn('Worker sync error:', err));
    }
  }, [propWorkers]);

  const workers = (propWorkers && propWorkers.length > 0) ? propWorkers : fetchedWorkers;

  useEffect(() => {
    if ('geolocation' in navigator) {
      navigator.geolocation.getCurrentPosition(
        pos => {
          const loc = { lat: pos.coords.latitude, lng: pos.coords.longitude };
          setUserLocation(loc);
          try {
            localStorage.setItem('worknest_last_coords', JSON.stringify(loc));
          } catch (e) {}
        },
        () => {},
        { timeout: 7000 }
      );
    }
  }, []);

  const handleHeroInputChange = (e) => {
    const val = e.target.value;
    setHeroSearchInput(val);
    if (heroTimerRef.current) clearTimeout(heroTimerRef.current);
    if (!val || val.trim().length < 2) {
      setHeroSuggestions([]);
      setShowHeroSuggestions(false);
      return;
    }
    heroTimerRef.current = setTimeout(async () => {
      try {
        const list = await getLiveSearchSuggestions(val, userLocation ? { lat: userLocation.lat, lon: userLocation.lng } : null);
        if (Array.isArray(list) && list.length > 0) {
          setHeroSuggestions(list);
          setShowHeroSuggestions(true);
        } else {
          setHeroSuggestions([]);
          setShowHeroSuggestions(false);
        }
      } catch (err) {
        setHeroSuggestions([]);
        setShowHeroSuggestions(false);
      }
    }, 220);
  };

  const handleHeroSearchSubmit = async (place = null) => {
    if (place) {
      try {
        localStorage.setItem('worknest_last_coords', JSON.stringify({ lat: place.lat, lng: place.lon }));
        localStorage.setItem('worknest_last_address', place.display_name);
      } catch (e) {}
      onEnterApp();
      return;
    }

    const q = (heroSearchInput || '').trim();
    if (q) {
      try {
        const res = await smartSearchLocation(q);
        if (res) {
          localStorage.setItem('worknest_last_coords', JSON.stringify({ lat: res.lat, lng: res.lon }));
          localStorage.setItem('worknest_last_address', res.display_name);
        }
      } catch (e) {}
    }
    onEnterApp();
  };

  const handleInstallClick = async () => {
    if (deferredPrompt) {
      deferredPrompt.prompt();
      const { outcome } = await deferredPrompt.userChoice;
      if (outcome === 'accepted') {
        setDeferredPrompt(null);
      }
    }
  };

  // Real available workers from backend
  const availableWorkers = workers.filter(w => w.available);

  const getWorkerDistance = (worker) => {
    if (!worker) return '1.2 km';
    if (userLocation && worker.latitude && worker.longitude) {
      const R = 6371; // km
      const dLat = (worker.latitude - userLocation.lat) * Math.PI / 180;
      const dLon = (worker.longitude - userLocation.lng) * Math.PI / 180;
      const a = 
        Math.sin(dLat/2) * Math.sin(dLat/2) +
        Math.cos(userLocation.lat * Math.PI / 180) * Math.cos(worker.latitude * Math.PI / 180) * 
        Math.sin(dLon/2) * Math.sin(dLon/2);
      const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a));
      const dist = R * c;
      if (dist < 100) {
        return `${dist.toFixed(1)} km`;
      }
    }
    const offset = (((Math.abs(worker.id || 1) * 7) % 25) / 10 + 0.8).toFixed(1);
    return `${offset} km`;
  };

  const getProfessionEmoji = (prof = '') => {
    const p = (prof || '').toLowerCase();
    if (p.includes('elect')) return '⚡';
    if (p.includes('plumb')) return '🔧';
    if (p.includes('carpent')) return '🪚';
    if (p.includes('ro') || p.includes('water') || p.includes('fitter')) return '💧';
    return '🛠️';
  };

  const radarPositions = [
    { top: '24px', right: '36px' },
    { bottom: '24px', left: '32px' },
    { top: '32px', left: '36px' },
    { bottom: '28px', right: '40px' }
  ];

  const services = [
    { 
      id: 'Electrician', 
      name: 'Electrician', 
      icon: <Zap size={22} />, 
      color: '#4f46e5',
      badge: 'Most Booked',
      price: '₹250',
      time: '12-15 mins',
      rating: '4.9★',
      desc: 'Ceiling fan install, switchboard replacement, short circuit detection & appliance wiring.'
    },
    { 
      id: 'Plumber', 
      name: 'Plumber', 
      icon: <Wrench size={22} />, 
      color: '#0284c7',
      badge: 'Rapid Dispatch',
      price: '₹250',
      time: '15-18 mins',
      rating: '4.8★',
      desc: 'Tap leakage, washroom fittings, drain unclogging, water tank repair & pipeline servicing.'
    },
    { 
      id: 'RO Fitter', 
      name: 'RO Purifier', 
      icon: <Droplet size={22} />, 
      color: '#06b6d4',
      badge: 'Specialist',
      price: '₹350',
      time: '20-25 mins',
      rating: '4.9★',
      desc: 'Filter replacement, membrane tune-up, TDS balance adjustment & deep chemical cleaning.'
    },
    { 
      id: 'Carpenter', 
      name: 'Carpenter', 
      icon: <Hammer size={22} />, 
      color: '#d97706',
      badge: 'Master Crafted',
      price: '₹300',
      time: '18-22 mins',
      rating: '4.9★',
      desc: 'Door latch lock fix, modular furniture assembly, wardrobe hinges & custom woodwork.'
    }
  ];

  const comparisons = [
    {
      feature: 'Pricing Model',
      worknest: 'Fixed upfront pricing from ₹250 (Zero Surge)',
      traditional: 'Arbitrary bargaining and hidden charges'
    },
    {
      feature: 'Arrival & Dispatch',
      worknest: 'Live GPS tracking with 15-min doorstep arrival',
      traditional: 'Uncertain arrival times and missed calls'
    },
    {
      feature: 'Safety & Trust',
      worknest: '4-Digit Start OTP Verification',
      traditional: 'No start verification or security check'
    },
    {
      feature: 'Settlement & Invoicing',
      worknest: 'Digital UPI / Cash invoice billed strictly by duration',
      traditional: 'Aggressive manual price escalation after work starts'
    }
  ];

  const reviews = [
    {
      name: 'Priya Sharma',
      role: 'Homeowner, Saket',
      rating: 5,
      comment: 'The electrician arrived within 15 minutes! The live map tracking felt like Uber for home repairs. Super polite and professional.',
      avatar: 'PS',
      service: 'Electrician'
    },
    {
      name: 'Rahul Verma',
      role: 'Apartment Owner, Gurgaon',
      rating: 5,
      comment: 'Our water pipe burst at 8 PM. WorkNest connected us with a verified plumber immediately. Transparent pricing with zero hidden charges.',
      avatar: 'RV',
      service: 'Plumber'
    },
    {
      name: 'Ananya Sen',
      role: 'Resident, Noida',
      rating: 5,
      comment: 'The OTP verification gives immense peace of mind. Great initiative and wonderful real-world experience!',
      avatar: 'AS',
      service: 'RO Purifier'
    },
    {
      name: 'Vikram Joshi',
      role: 'Villa Resident, Indore',
      rating: 5,
      comment: 'Carpenter was highly skilled and assembled our entire modular wardrobe in under an hour. Billed accurately by duration.',
      avatar: 'VJ',
      service: 'Carpenter'
    }
  ];

  return (
    <div style={{
      minHeight: '100vh',
      background: 'var(--bg-primary)',
      color: 'var(--text-primary)',
      display: 'flex',
      flexDirection: 'column',
      width: '100%',
      overflowX: 'hidden'
    }}>
      
      {/* Top Banner Notice */}
      <div style={{
        background: 'var(--accent-primary-gradient)',
        color: '#ffffff',
        padding: '10px 24px',
        fontSize: '0.82rem',
        fontWeight: '700',
        textAlign: 'center',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        gap: '10px',
        width: '100%'
      }}>
        <Sparkles size={16} />
        <span>⚡ Real-Time On-Demand Dispatch Live in Delhi NCR, Indore, Bengaluru & Pune</span>
      </div>

      {/* Full-Width Header / Navigation */}
      <header style={{
        padding: '16px clamp(20px, 4vw, 64px)',
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'center',
        borderBottom: '1px solid var(--border-color)',
        background: 'var(--bg-glass)',
        backdropFilter: 'blur(16px)',
        position: 'sticky',
        top: 0,
        zIndex: 50,
        width: '100%'
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '14px', cursor: 'pointer' }} onClick={onEnterApp}>
          <div style={{
            width: '42px',
            height: '42px',
            background: 'var(--accent-primary-gradient)',
            borderRadius: '12px',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            boxShadow: '0 4px 14px rgba(79, 70, 229, 0.35)',
            color: '#fff'
          }}>
            <Wrench size={22} />
          </div>
          <div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
              <span style={{ fontSize: '1.4rem', fontWeight: '900', letterSpacing: '-0.02em', color: 'var(--text-primary)' }}>
                WorkNest
              </span>
              <span className="badge badge-primary" style={{ fontSize: '0.65rem', padding: '2px 8px' }}>STARTUP</span>
            </div>
            <span className="landing-brand-subtitle" style={{ fontSize: '0.68rem', color: 'var(--text-muted)', fontWeight: '700', textTransform: 'uppercase', letterSpacing: '0.06em', display: 'block' }}>
              On-Demand Home Services Dispatch
            </span>
          </div>
        </div>

        <nav style={{ display: 'flex', alignItems: 'center', gap: '16px' }}>
          <div className="landing-desktop-fleet-pill" style={{ display: 'flex', alignItems: 'center', gap: '8px', fontSize: '0.86rem', color: 'var(--text-secondary)', fontWeight: '600' }}>
            <ShieldCheck size={18} color="var(--success)" />
            <span>100% Background Checked Fleet</span>
          </div>

          <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
            {deferredPrompt && (
              <button onClick={handleInstallClick} className="btn btn-secondary" style={{ padding: '8px 14px', fontSize: '0.82rem' }}>
                <Smartphone size={15} /> Install
              </button>
            )}
            <button onClick={onEnterApp} className="btn btn-customer" style={{ padding: '9px 18px', fontSize: '0.85rem', fontWeight: '800', whiteSpace: 'nowrap' }}>
              Sign In <ArrowRight size={15} />
            </button>
          </div>
        </nav>
      </header>

      {/* WIDESCREEN HERO SECTION (2-Column Screen-Filling Layout) */}
      <section className="landing-hero-section" style={{
        width: '100%',
        padding: '60px clamp(20px, 4vw, 64px)',
        display: 'flex',
        justifyContent: 'center',
        position: 'relative',
        background: 'linear-gradient(180deg, var(--bg-primary) 0%, var(--bg-subtle) 100%)',
        borderBottom: '1px solid var(--border-color)'
      }}>
        {/* Ambient Glows */}
        <div style={{
          position: 'absolute',
          top: '10%',
          left: '20%',
          width: '500px',
          height: '500px',
          background: 'radial-gradient(circle, rgba(79, 70, 229, 0.12) 0%, transparent 70%)',
          pointerEvents: 'none'
        }} />
        <div style={{
          position: 'absolute',
          top: '30%',
          right: '15%',
          width: '600px',
          height: '600px',
          background: 'radial-gradient(circle, rgba(16, 185, 129, 0.08) 0%, transparent 70%)',
          pointerEvents: 'none'
        }} />

        <div className="landing-hero-grid" style={{
          width: '100%',
          position: 'relative',
          zIndex: 1
        }}>
          
          {/* Left Column: Headline, Value Proposition & Quick Search */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: '24px' }}>
            
            {/* Live Status Pill */}
            <div style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: '10px',
              padding: '6px 16px',
              background: 'var(--bg-card)',
              border: '1px solid var(--border-color)',
              borderRadius: '9999px',
              width: 'fit-content',
              boxShadow: 'var(--shadow-sm)'
            }}>
              <div style={{ width: '8px', height: '8px', borderRadius: '50%', background: 'var(--success)', animation: 'pulse 1.5s infinite' }} />
              <span style={{ fontSize: '0.82rem', fontWeight: '800', color: 'var(--text-primary)' }}>
                {availableWorkers.length > 0 
                  ? `${availableWorkers.length} Verified Technician${availableWorkers.length > 1 ? 's' : ''} Online in your Area`
                  : 'Live GPS Dispatch Engine Active'}
              </span>
            </div>

            {/* Giant Heading */}
            <h1 style={{
              fontSize: 'clamp(2.0rem, 5.5vw, 3.8rem)',
              fontWeight: '900',
              lineHeight: 1.15,
              letterSpacing: '-0.03em',
              color: 'var(--text-primary)',
              margin: 0
            }}>
              Professional Repairs, <br />
              <span style={{
                background: 'linear-gradient(135deg, #4f46e5 0%, #7c3aed 50%, #ec4899 100%)',
                WebkitBackgroundClip: 'text',
                WebkitTextFillColor: 'transparent'
              }}>
                Dispatched in 15 Minutes.
              </span>
            </h1>

            {/* Subheading */}
            <p style={{
              fontSize: '1.15rem',
              color: 'var(--text-secondary)',
              lineHeight: 1.6,
              margin: 0,
              maxWidth: '820px'
            }}>
              Need an Electrician, Plumber, RO Specialist, or Carpenter right now? WorkNest pairs your doorstep location with top-rated nearby pros in real time. Transparent rates, live GPS route tracking, and verified safety.
            </p>

            {/* Interactive Hero Booking Box */}
            <div className="glass-panel landing-hero-card" style={{
              padding: '24px',
              borderRadius: '24px',
              background: 'var(--bg-card)',
              border: '1px solid var(--border-color)',
              boxShadow: 'var(--shadow-lg)',
              display: 'flex',
              flexDirection: 'column',
              gap: '16px'
            }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <span className="form-label" style={{ margin: 0, fontSize: '0.78rem' }}>
                  Select Required Specialty:
                </span>
                <span style={{ fontSize: '0.75rem', color: 'var(--success)', fontWeight: '800' }}>
                  ✓ Instant Live Match
                </span>
              </div>

              {/* Service Tabs */}
              <div className="landing-hero-service-tabs" style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '8px' }}>
                {services.map(s => {
                  const isSel = activeTab === s.id;
                  return (
                    <button
                      key={s.id}
                      type="button"
                      onClick={() => setActiveTab(s.id)}
                      style={{
                        padding: '12px 8px',
                        borderRadius: '12px',
                        border: isSel ? '2px solid var(--accent-primary)' : '1px solid var(--border-color)',
                        background: isSel ? 'var(--accent-primary-light)' : 'var(--bg-subtle)',
                        color: isSel ? 'var(--accent-primary)' : 'var(--text-primary)',
                        cursor: 'pointer',
                        display: 'flex',
                        flexDirection: 'column',
                        alignItems: 'center',
                        gap: '6px',
                        fontWeight: '800',
                        fontSize: '0.82rem',
                        transition: 'all 0.2s'
                      }}
                    >
                      <span style={{ color: isSel ? 'var(--accent-primary)' : s.color }}>{s.icon}</span>
                      <span>{s.name}</span>
                    </button>
                  );
                })}
              </div>

              {/* Quick Search & Go Button */}
              <div className="landing-hero-search-row" style={{ display: 'flex', gap: '10px', position: 'relative' }}>
                <div style={{ position: 'relative', flex: 1 }}>
                  <MapPin size={18} style={{ position: 'absolute', left: '14px', top: '50%', transform: 'translateY(-50%)', color: 'var(--text-muted)' }} />
                  <input 
                    type="text"
                    value={heroSearchInput}
                    onChange={handleHeroInputChange}
                    onFocus={() => { if (heroSuggestions.length > 0) setShowHeroSuggestions(true); }}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter') {
                        e.preventDefault();
                        if (heroSuggestions.length > 0) {
                          handleHeroSearchSubmit(heroSuggestions[0]);
                        } else {
                          handleHeroSearchSubmit();
                        }
                      }
                    }}
                    placeholder="Enter locality, street or college (e.g. Prestige Indore)..."
                    className="form-input"
                    style={{ paddingLeft: '44px', height: '52px', fontSize: '0.95rem' }}
                  />
                  {heroSearchInput && (
                    <button
                      type="button"
                      onClick={() => { setHeroSearchInput(''); setHeroSuggestions([]); setShowHeroSuggestions(false); }}
                      style={{
                        position: 'absolute', right: '14px', top: '50%', transform: 'translateY(-50%)',
                        background: 'transparent', border: 'none', color: '#94a3b8',
                        cursor: 'pointer', fontSize: '1rem', padding: '4px'
                      }}
                    >
                      ✕
                    </button>
                  )}

                  {/* Live Suggestions Dropdown */}
                  {showHeroSuggestions && heroSuggestions.length > 0 && (
                    <div style={{
                      position: 'absolute', top: '100%', left: 0, right: 0, marginTop: '6px',
                      background: 'var(--bg-card)', borderRadius: '14px', overflow: 'hidden',
                      boxShadow: '0 12px 30px rgba(0,0,0,0.18), 0 0 0 1px var(--border-color)',
                      zIndex: 100, maxHeight: '240px', overflowY: 'auto'
                    }}>
                      {heroSuggestions.map((item, idx) => (
                        <div
                          key={item.place_id || idx}
                          onClick={() => handleHeroSearchSubmit(item)}
                          style={{
                            padding: '12px 16px', display: 'flex', alignItems: 'center', gap: '10px',
                            cursor: 'pointer', borderBottom: idx < heroSuggestions.length - 1 ? '1px solid var(--border-color)' : 'none',
                            transition: 'background 0.15s ease'
                          }}
                          onMouseOver={(e) => e.currentTarget.style.background = 'var(--bg-subtle)'}
                          onMouseOut={(e) => e.currentTarget.style.background = 'var(--bg-card)'}
                        >
                          <MapPin size={16} color="var(--accent-primary)" style={{ flexShrink: 0 }} />
                          <div style={{ minWidth: 0, flex: 1 }}>
                            <div style={{ fontWeight: 700, fontSize: '0.9rem', color: 'var(--text-primary)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                              {item.primary || item.short_name}
                            </div>
                            <div style={{ fontSize: '0.74rem', color: 'var(--text-muted)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                              {item.secondary || item.display_name}
                            </div>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
                <button
                  type="button"
                  onClick={() => {
                    if (heroSuggestions.length > 0) {
                      handleHeroSearchSubmit(heroSuggestions[0]);
                    } else {
                      handleHeroSearchSubmit();
                    }
                  }}
                  className="btn btn-customer"
                  style={{
                    padding: '0 24px',
                    height: '52px',
                    fontSize: '1rem',
                    fontWeight: '800',
                    borderRadius: '12px',
                    whiteSpace: 'nowrap',
                    gap: '8px'
                  }}
                >
                  <Search size={18} /> Find Nearby {activeTab}
                </button>
              </div>

              {/* Quick City Buttons */}
              <div className="touch-scroll-x" style={{ display: 'flex', alignItems: 'center', gap: '6px', overflowX: 'auto', paddingBottom: '2px', WebkitOverflowScrolling: 'touch' }}>
                <span style={{ fontSize: '0.74rem', color: 'var(--text-muted)', fontWeight: '700', whiteSpace: 'nowrap' }}>City:</span>
                {[
                  { name: '📍 Indore', lat: 22.7196, lng: 75.8577, addr: 'Indore, Madhya Pradesh' },
                  { name: '📍 Bhopal', lat: 23.2599, lng: 77.4126, addr: 'Bhopal, Madhya Pradesh' },
                  { name: '📍 Delhi NCR', lat: 28.6139, lng: 77.2090, addr: 'New Delhi, Delhi' },
                  { name: '📍 Mumbai', lat: 19.0760, lng: 72.8777, addr: 'Mumbai, Maharashtra' },
                  { name: '📍 Bangalore', lat: 12.9716, lng: 77.5946, addr: 'Bangalore, Karnataka' },
                ].map((c, i) => (
                  <button
                    key={i}
                    type="button"
                    onClick={() => handleHeroSearchSubmit({ lat: c.lat, lon: c.lng, display_name: c.addr })}
                    style={{
                      fontSize: '0.74rem',
                      fontWeight: 700,
                      color: 'var(--text-primary)',
                      background: 'var(--bg-card)',
                      padding: '4px 10px',
                      borderRadius: '8px',
                      cursor: 'pointer',
                      border: '1px solid var(--border-color)',
                      whiteSpace: 'nowrap'
                    }}
                  >
                    {c.name}
                  </button>
                ))}
              </div>

              {/* Quick Popular Keywords */}
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap' }}>
                <span style={{ fontSize: '0.74rem', color: 'var(--text-muted)', fontWeight: '700' }}>Popular:</span>
                {['⚡ Fan Regulator', '🔧 Basin Pipe Leak', '💧 Filter Servicing', '🪚 Door Lock Fitting'].map((kw, i) => (
                  <span
                    key={i}
                    onClick={onEnterApp}
                    style={{
                      fontSize: '0.74rem',
                      color: 'var(--text-secondary)',
                      background: 'var(--bg-subtle)',
                      padding: '4px 10px',
                      borderRadius: '8px',
                      cursor: 'pointer',
                      border: '1px solid var(--border-color)'
                    }}
                  >
                    {kw}
                  </span>
                ))}
              </div>
            </div>

            {/* Trust Highlights Row */}
            <div style={{ display: 'flex', gap: '24px', flexWrap: 'wrap' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px', fontSize: '0.85rem', fontWeight: '700' }}>
                <CheckCircle2 size={18} color="var(--success)" />
                <span>Zero Advance Deposit</span>
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px', fontSize: '0.85rem', fontWeight: '700' }}>
                <CheckCircle2 size={18} color="var(--success)" />
                <span>4-Digit Start OTP Verification</span>
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px', fontSize: '0.85rem', fontWeight: '700' }}>
                <CheckCircle2 size={18} color="var(--success)" />
                <span>Transparent Hourly Rates</span>
              </div>
            </div>

          </div>

          {/* Right Column: Live Dispatch Cockpit & Radar Simulation */}
          <div style={{ position: 'relative' }}>
            
            {/* Visual Simulator Card */}
            <div className="glass-panel" style={{
              borderRadius: '28px',
              padding: '28px',
              background: 'var(--bg-card)',
              border: '1px solid var(--border-color)',
              boxShadow: 'var(--shadow-xl)',
              display: 'flex',
              flexDirection: 'column',
              gap: '20px'
            }}>
              
              {/* Simulator Header */}
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderBottom: '1px solid var(--border-color)', paddingBottom: '14px' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                  <div style={{ width: '10px', height: '10px', borderRadius: '50%', background: 'var(--success)', animation: 'pulse 1.5s infinite' }} />
                  <span style={{ fontWeight: '800', fontSize: '0.9rem', color: 'var(--text-primary)' }}>
                    WorkNest GPS Dispatch Engine
                  </span>
                </div>
                <span className="badge badge-success" style={{ fontSize: '0.7rem' }}>
                  ACTIVE RADAR
                </span>
              </div>

              {/* Radar Graphical Box */}
              <div style={{
                height: '240px',
                borderRadius: '20px',
                background: 'radial-gradient(circle at center, rgba(79, 70, 229, 0.15) 0%, rgba(15, 23, 42, 0.05) 70%)',
                border: '1px solid var(--border-color)',
                position: 'relative',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                overflow: 'hidden'
              }}>
                {/* Concentric Radar Rings */}
                <div style={{ position: 'absolute', width: '280px', height: '280px', borderRadius: '50%', border: '1px dashed rgba(79, 70, 229, 0.2)' }} />
                <div style={{ position: 'absolute', width: '180px', height: '180px', borderRadius: '50%', border: '1px solid rgba(79, 70, 229, 0.25)' }} />
                <div style={{ position: 'absolute', width: '80px', height: '80px', borderRadius: '50%', border: '2px solid rgba(79, 70, 229, 0.35)' }} />

                {/* Radar Sweep Effect */}
                <div className="animate-radar" style={{
                  position: 'absolute',
                  width: '280px',
                  height: '280px',
                  borderRadius: '50%',
                  background: 'conic-gradient(from 0deg, rgba(79, 70, 229, 0.28) 0deg, transparent 65deg, transparent 360deg)',
                  pointerEvents: 'none'
                }} />

                {/* Center User Pin */}
                <div style={{
                  position: 'relative',
                  zIndex: 2,
                  display: 'flex',
                  flexDirection: 'column',
                  alignItems: 'center',
                  gap: '4px'
                }}>
                  <div style={{
                    width: '38px',
                    height: '38px',
                    borderRadius: '50%',
                    background: 'var(--accent-primary-gradient)',
                    color: '#fff',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    boxShadow: '0 4px 16px rgba(79, 70, 229, 0.45)'
                  }}>
                    <MapPin size={20} />
                  </div>
                  <span style={{ fontSize: '0.72rem', fontWeight: '800', color: 'var(--text-primary)', background: 'var(--bg-card)', padding: '2px 8px', borderRadius: '6px', border: '1px solid var(--border-color)' }}>
                    Your Location
                  </span>
                </div>

                {/* Real Available Worker Pins */}
                {availableWorkers.length > 0 ? (
                  availableWorkers.slice(0, 3).map((w, idx) => {
                    const pos = radarPositions[idx] || radarPositions[0];
                    const distStr = getWorkerDistance(w);
                    const emoji = getProfessionEmoji(w.profession);
                    return (
                      <div
                        key={w.id || idx}
                        style={{
                          position: 'absolute',
                          ...pos,
                          display: 'flex',
                          alignItems: 'center',
                          gap: '6px',
                          background: 'var(--bg-card)',
                          padding: '5px 12px',
                          borderRadius: '10px',
                          border: '1px solid var(--border-color)',
                          boxShadow: 'var(--shadow-sm)',
                          zIndex: 3
                        }}
                      >
                        <div style={{ width: '8px', height: '8px', borderRadius: '50%', background: 'var(--success)' }} />
                        <span style={{ fontSize: '0.74rem', fontWeight: '800' }}>
                          {emoji} {w.name} ({distStr})
                        </span>
                      </div>
                    );
                  })
                ) : (
                  <div style={{
                    position: 'absolute',
                    bottom: '16px',
                    background: 'var(--bg-card)',
                    padding: '6px 14px',
                    borderRadius: '10px',
                    border: '1px solid var(--border-color)',
                    fontSize: '0.74rem',
                    fontWeight: '700',
                    color: 'var(--text-muted)',
                    zIndex: 3
                  }}>
                    Scanning for online technicians in your area...
                  </div>
                )}
              </div>

              {/* Real Technician Dispatch Preview */}
              {availableWorkers.length > 0 ? (() => {
                const featured = availableWorkers[0];
                const initials = (featured.name || 'Pro')
                  .split(' ')
                  .map(n => n[0])
                  .join('')
                  .toUpperCase()
                  .slice(0, 2);
                const featuredDist = getWorkerDistance(featured);

                return (
                  <div style={{
                    padding: '16px',
                    borderRadius: '16px',
                    background: 'var(--bg-subtle)',
                    border: '1px solid var(--border-color)',
                    display: 'flex',
                    alignItems: 'center',
                    gap: '14px'
                  }}>
                    {featured.profilePhoto ? (
                      <img
                        src={assetUrl(featured.profilePhoto)}
                        alt={featured.name}
                        style={{
                          width: '46px',
                          height: '46px',
                          borderRadius: '14px',
                          objectFit: 'cover',
                          boxShadow: '0 4px 12px rgba(16, 185, 129, 0.25)'
                        }}
                      />
                    ) : (
                      <div style={{
                        width: '46px',
                        height: '46px',
                        borderRadius: '14px',
                        background: 'var(--accent-worker-gradient)',
                        color: '#fff',
                        fontWeight: '900',
                        fontSize: '1.05rem',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        boxShadow: '0 4px 12px rgba(16, 185, 129, 0.3)'
                      }}>
                        {initials}
                      </div>
                    )}
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                        <span style={{ fontWeight: '800', fontSize: '0.98rem', color: 'var(--text-primary)' }}>
                          {featured.name}
                        </span>
                        <ShieldCheck size={16} color="var(--success)" />
                      </div>
                      <div style={{ fontSize: '0.76rem', color: 'var(--text-muted)', display: 'flex', alignItems: 'center', gap: '6px', marginTop: '2px' }}>
                        <span>⭐ {featured.rating ? featured.rating.toFixed(1) : '5.0'} • {featured.profession}</span>
                        <span>•</span>
                        <span style={{ color: 'var(--success)', fontWeight: '700' }}>Available ({featuredDist})</span>
                      </div>
                    </div>
                    <button
                      type="button"
                      onClick={onEnterApp}
                      className="btn btn-worker"
                      style={{ padding: '8px 16px', fontSize: '0.8rem', fontWeight: '800' }}
                    >
                      Book Pro
                    </button>
                  </div>
                );
              })() : (
                <div style={{
                  padding: '16px',
                  borderRadius: '16px',
                  background: 'var(--bg-subtle)',
                  border: '1px solid var(--border-color)',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '14px'
                }}>
                  <div style={{
                    width: '46px',
                    height: '46px',
                    borderRadius: '14px',
                    background: 'var(--bg-card)',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    border: '1px solid var(--border-color)',
                    color: 'var(--text-muted)'
                  }}>
                    <Wrench size={20} />
                  </div>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ fontWeight: '800', fontSize: '0.92rem', color: 'var(--text-primary)' }}>
                      Dispatch Radar Ready
                    </div>
                    <div style={{ fontSize: '0.74rem', color: 'var(--text-muted)', marginTop: '2px' }}>
                      Submit your service request to broadcast to nearest available pros
                    </div>
                  </div>
                  <button
                    type="button"
                    onClick={onEnterApp}
                    className="btn btn-customer"
                    style={{ padding: '8px 16px', fontSize: '0.8rem', fontWeight: '800' }}
                  >
                    Request Pro
                  </button>
                </div>
              )}

              {/* Live Dispatch Metrics Row */}
              <div style={{
                display: 'grid',
                gridTemplateColumns: 'repeat(3, 1fr)',
                gap: '8px',
                paddingTop: '12px',
                borderTop: '1px solid var(--border-color)',
                textAlign: 'center'
              }}>
                <div>
                  <div style={{ fontSize: '1.1rem', fontWeight: '900', color: 'var(--text-primary)' }}>15 Mins</div>
                  <div style={{ fontSize: '0.68rem', color: 'var(--text-muted)', fontWeight: '800', textTransform: 'uppercase' }}>Avg Arrival</div>
                </div>
                <div>
                  <div style={{ fontSize: '1.1rem', fontWeight: '900', color: 'var(--success)' }}>
                    {availableWorkers.length > 0 ? `${availableWorkers.length} Active` : 'On-Duty'}
                  </div>
                  <div style={{ fontSize: '0.68rem', color: 'var(--text-muted)', fontWeight: '800', textTransform: 'uppercase' }}>Fleet Online</div>
                </div>
                <div>
                  <div style={{ fontSize: '1.1rem', fontWeight: '900', color: 'var(--accent-primary)' }}>₹0</div>
                  <div style={{ fontSize: '0.68rem', color: 'var(--text-muted)', fontWeight: '800', textTransform: 'uppercase' }}>Advance Fee</div>
                </div>
              </div>

              {/* Live Ticker Feed */}
              <div style={{
                display: 'flex',
                alignItems: 'center',
                gap: '8px',
                fontSize: '0.78rem',
                color: 'var(--text-muted)',
                background: 'var(--bg-subtle)',
                padding: '8px 14px',
                borderRadius: '10px'
              }}>
                <span className="badge badge-primary" style={{ fontSize: '0.65rem' }}>LIVE FLEET</span>
                <span>
                  {availableWorkers.length > 0
                    ? `${availableWorkers[0].name} (${availableWorkers[0].profession}) is online and accepting requests in real time`
                    : 'Dispatch radar active • Submit booking to alert nearest technicians'
                  }
                </span>
              </div>

            </div>
          </div>

        </div>
      </section>

      {/* FULL-WIDTH STATS STRIP (EDGE-TO-EDGE) */}
      <section style={{
        width: '100%',
        padding: '36px clamp(20px, 4vw, 64px)',
        background: 'var(--bg-card)',
        borderBottom: '1px solid var(--border-color)',
        display: 'flex',
        justifyContent: 'center'
      }}>
        <div style={{
          width: '100%',
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))',
          gap: '32px'
        }}>
          {[
            { metric: '15 Mins', label: 'Average Technician Arrival', icon: <Clock size={20} color="var(--accent-primary)" /> },
            { metric: '12,000+', label: 'Successful Repairs Settled', icon: <CheckCircle2 size={20} color="var(--success)" /> },
            { metric: '4.9 / 5', label: 'Verified Customer Rating', icon: <Star size={20} color="var(--warning)" fill="var(--warning)" /> },
            { metric: '₹250 Flat', label: 'Starting Price (Zero Surge)', icon: <IndianRupee size={20} color="var(--accent-primary)" /> }
          ].map((item, idx) => (
            <div key={idx} style={{ display: 'flex', alignItems: 'center', gap: '16px' }}>
              <div style={{
                width: '48px',
                height: '48px',
                borderRadius: '14px',
                background: 'var(--bg-subtle)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                border: '1px solid var(--border-color)'
              }}>
                {item.icon}
              </div>
              <div>
                <div style={{ fontSize: '1.6rem', fontWeight: '900', color: 'var(--text-primary)', lineHeight: 1.1 }}>
                  {item.metric}
                </div>
                <div style={{ fontSize: '0.8rem', color: 'var(--text-muted)', fontWeight: '600', marginTop: '2px' }}>
                  {item.label}
                </div>
              </div>
            </div>
          ))}
        </div>
      </section>

      {/* FULL-WIDTH CATEGORY SHOWCASE */}
      <section className="landing-section-pad" style={{
        width: '100%',
        padding: '80px clamp(20px, 4vw, 64px)',
        display: 'flex',
        justifyContent: 'center'
      }}>
        <div style={{ width: '100%' }}>
          
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-end', marginBottom: '40px', flexWrap: 'wrap', gap: '16px' }}>
            <div>
              <span className="badge badge-primary" style={{ marginBottom: '10px' }}>ON-DEMAND FLEET</span>
              <h2 style={{ fontSize: '2.4rem', fontWeight: '900', letterSpacing: '-0.02em', margin: 0 }}>
                Popular Home Repair Categories
              </h2>
            </div>
            <p style={{ color: 'var(--text-secondary)', fontSize: '0.98rem', maxWidth: '600px', margin: 0 }}>
              All services backed by standard transparent hourly rates, background-checked pros, and digital receipts.
            </p>
          </div>

          <div style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fit, minmax(290px, 1fr))',
            gap: '24px'
          }}>
            {services.map(svc => (
              <div 
                key={svc.id}
                onClick={onEnterApp}
                className="glass-panel"
                style={{
                  padding: '28px',
                  borderRadius: '24px',
                  cursor: 'pointer',
                  display: 'flex',
                  flexDirection: 'column',
                  justifyContent: 'space-between',
                  background: 'var(--bg-card)',
                  border: '1px solid var(--border-color)',
                  transition: 'all 0.25s cubic-bezier(0.16, 1, 0.3, 1)'
                }}
                onMouseEnter={(e) => {
                  e.currentTarget.style.transform = 'translateY(-6px)';
                  e.currentTarget.style.borderColor = svc.color;
                  e.currentTarget.style.boxShadow = 'var(--shadow-xl)';
                }}
                onMouseLeave={(e) => {
                  e.currentTarget.style.transform = 'translateY(0)';
                  e.currentTarget.style.borderColor = 'var(--border-color)';
                  e.currentTarget.style.boxShadow = 'var(--shadow-sm)';
                }}
              >
                <div>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '20px' }}>
                    <div style={{
                      width: '52px',
                      height: '52px',
                      borderRadius: '16px',
                      background: `${svc.color}15`,
                      color: svc.color,
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center'
                    }}>
                      {svc.icon}
                    </div>
                    <div style={{ display: 'flex', gap: '6px' }}>
                      <span style={{
                        fontSize: '0.72rem',
                        fontWeight: '800',
                        color: svc.color,
                        background: `${svc.color}15`,
                        padding: '4px 10px',
                        borderRadius: '9999px',
                        textTransform: 'uppercase'
                      }}>
                        {svc.badge}
                      </span>
                    </div>
                  </div>

                  <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '8px' }}>
                    <h3 style={{ fontSize: '1.35rem', fontWeight: '900', color: 'var(--text-primary)', margin: 0 }}>
                      {svc.name}
                    </h3>
                    <span style={{ fontSize: '0.82rem', fontWeight: '800', color: 'var(--warning)' }}>
                      {svc.rating}
                    </span>
                  </div>

                  <p style={{ fontSize: '0.9rem', color: 'var(--text-secondary)', lineHeight: 1.55, marginBottom: '24px' }}>
                    {svc.desc}
                  </p>
                </div>

                <div style={{
                  paddingTop: '20px',
                  borderTop: '1px solid var(--border-color)',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between'
                }}>
                  <div>
                    <span style={{ fontSize: '0.72rem', color: 'var(--text-muted)', textTransform: 'uppercase', display: 'block', fontWeight: '700' }}>
                      Starts from
                    </span>
                    <span style={{ fontSize: '1.4rem', fontWeight: '900', color: 'var(--text-primary)' }}>
                      {svc.price}
                    </span>
                  </div>
                  <div style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: '4px',
                    color: 'var(--accent-primary)',
                    fontWeight: '800',
                    fontSize: '0.9rem'
                  }}>
                    Request Pro <ChevronRight size={18} />
                  </div>
                </div>
              </div>
            ))}
          </div>

        </div>
      </section>

      {/* WHY WORKNEST VS LOCAL CONTRACTORS (Widescreen Comparison) */}
      <section className="landing-section-pad" style={{
        width: '100%',
        padding: '80px clamp(20px, 4vw, 64px)',
        background: 'var(--bg-subtle)',
        borderTop: '1px solid var(--border-color)',
        borderBottom: '1px solid var(--border-color)',
        display: 'flex',
        justifyContent: 'center'
      }}>
        <div style={{ width: '100%' }}>
          
          <div style={{ textAlign: 'center', marginBottom: '48px' }}>
            <span className="badge badge-success" style={{ marginBottom: '10px' }}>THE WORKNEST DIFFERENCE</span>
            <h2 style={{ fontSize: '2.4rem', fontWeight: '900', letterSpacing: '-0.02em', margin: '0 0 12px 0' }}>
              Why Homeowners Choose WorkNest Over Roadside Contractors
            </h2>
            <p style={{ color: 'var(--text-secondary)', fontSize: '1rem', maxWidth: '750px', margin: '0 auto' }}>
              Experience the new benchmark of professionalism, safety, and transparent pricing.
            </p>
          </div>

          <div style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))',
            gap: '20px'
          }}>
            {comparisons.map((c, i) => (
              <div key={i} className="glass-panel" style={{
                padding: '24px',
                borderRadius: '20px',
                background: 'var(--bg-card)',
                display: 'flex',
                flexDirection: 'column',
                gap: '14px'
              }}>
                <div style={{ fontSize: '0.82rem', fontWeight: '800', color: 'var(--text-muted)', textTransform: 'uppercase' }}>
                  {c.feature}
                </div>
                
                <div style={{
                  padding: '14px',
                  borderRadius: '12px',
                  background: 'var(--success-light)',
                  border: '1px solid rgba(16, 185, 129, 0.25)',
                  display: 'flex',
                  alignItems: 'flex-start',
                  gap: '10px'
                }}>
                  <Check size={18} color="var(--success)" style={{ flexShrink: 0, marginTop: '2px' }} />
                  <div>
                    <div style={{ fontSize: '0.75rem', fontWeight: '800', color: 'var(--success)', textTransform: 'uppercase' }}>
                      WorkNest Standard
                    </div>
                    <div style={{ fontSize: '0.9rem', fontWeight: '700', color: 'var(--text-primary)', marginTop: '2px' }}>
                      {c.worknest}
                    </div>
                  </div>
                </div>

                <div style={{
                  padding: '14px',
                  borderRadius: '12px',
                  background: 'var(--danger-light)',
                  border: '1px solid rgba(239, 68, 68, 0.2)',
                  display: 'flex',
                  alignItems: 'flex-start',
                  gap: '10px'
                }}>
                  <AlertCircle size={18} color="var(--danger)" style={{ flexShrink: 0, marginTop: '2px' }} />
                  <div>
                    <div style={{ fontSize: '0.75rem', fontWeight: '800', color: 'var(--danger)', textTransform: 'uppercase' }}>
                      Traditional Local Mechanics
                    </div>
                    <div style={{ fontSize: '0.86rem', color: 'var(--text-muted)', marginTop: '2px' }}>
                      {c.traditional}
                    </div>
                  </div>
                </div>
              </div>
            ))}
          </div>

        </div>
      </section>

      {/* FULL-WIDTH HOW IT WORKS SECTION */}
      <section className="landing-section-pad" style={{
        width: '100%',
        padding: '80px clamp(20px, 4vw, 64px)',
        display: 'flex',
        justifyContent: 'center'
      }}>
        <div style={{ width: '100%' }}>
          
          <div style={{ textAlign: 'center', marginBottom: '52px' }}>
            <span className="badge badge-primary" style={{ marginBottom: '10px' }}>SEAMLESS 3-STEP DISPATCH</span>
            <h2 style={{ fontSize: '2.4rem', fontWeight: '900', letterSpacing: '-0.02em', margin: 0 }}>
              How WorkNest Works
            </h2>
          </div>

          <div style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fit, minmax(320px, 1fr))',
            gap: '28px'
          }}>
            {[
              {
                num: '01',
                title: 'Choose Service & Pin Doorstep',
                desc: 'Select your repair requirement, pick estimated duration, and confirm your location on our interactive map.'
              },
              {
                num: '02',
                title: 'Real-Time Match & GPS Tracking',
                desc: 'The closest background-checked technician accepts your request. Watch their route live as they arrive in 15 minutes.'
              },
              {
                num: '03',
                title: 'Secure OTP Start & Cashless Pay',
                desc: 'Share the unique 4-digit start OTP when the technician arrives at your door. Settle invoices digitally via UPI or Cash.'
              }
            ].map((step, idx) => (
              <div key={idx} className="glass-panel" style={{
                padding: '36px 30px',
                borderRadius: '24px',
                background: 'var(--bg-card)',
                border: '1px solid var(--border-color)',
                position: 'relative'
              }}>
                <div style={{
                  fontSize: '2.8rem',
                  fontWeight: '900',
                  color: 'var(--accent-primary)',
                  opacity: 0.35,
                  marginBottom: '14px',
                  fontFamily: 'monospace'
                }}>
                  {step.num}
                </div>
                <h3 style={{ fontSize: '1.25rem', fontWeight: '900', marginBottom: '10px', color: 'var(--text-primary)' }}>
                  {step.title}
                </h3>
                <p style={{ fontSize: '0.94rem', color: 'var(--text-secondary)', lineHeight: 1.6 }}>
                  {step.desc}
                </p>
              </div>
            ))}
          </div>

        </div>
      </section>

      {/* FULL-WIDTH CUSTOMER STORIES */}
      <section className="landing-section-pad" style={{
        width: '100%',
        padding: '80px clamp(20px, 4vw, 64px)',
        background: 'var(--bg-subtle)',
        borderTop: '1px solid var(--border-color)',
        borderBottom: '1px solid var(--border-color)',
        display: 'flex',
        justifyContent: 'center'
      }}>
        <div style={{ width: '100%' }}>
          
          <div style={{ textAlign: 'center', marginBottom: '48px' }}>
            <span className="badge badge-warning" style={{ marginBottom: '10px' }}>VERIFIED EXPERIENCES</span>
            <h2 style={{ fontSize: '2.4rem', fontWeight: '900', letterSpacing: '-0.02em', margin: 0 }}>
              Trusted by 10,000+ Homes Across Cities
            </h2>
          </div>

          <div style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))',
            gap: '20px'
          }}>
            {reviews.map((r, i) => (
              <div key={i} className="glass-panel" style={{
                padding: '28px',
                borderRadius: '22px',
                background: 'var(--bg-card)',
                display: 'flex',
                flexDirection: 'column',
                justifyContent: 'space-between',
                gap: '20px'
              }}>
                <div>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '12px' }}>
                    <div style={{ display: 'flex', gap: '3px', color: '#f59e0b' }}>
                      {[...Array(r.rating)].map((_, idx) => (
                        <Star key={idx} size={15} fill="#f59e0b" />
                      ))}
                    </div>
                    <span className="badge badge-primary" style={{ fontSize: '0.68rem' }}>
                      {r.service}
                    </span>
                  </div>
                  <p style={{ fontSize: '0.94rem', color: 'var(--text-secondary)', lineHeight: 1.6, fontStyle: 'italic', margin: 0 }}>
                    "{r.comment}"
                  </p>
                </div>

                <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                  <div style={{
                    width: '44px',
                    height: '44px',
                    borderRadius: '50%',
                    background: 'var(--accent-primary-gradient)',
                    color: '#fff',
                    fontWeight: '800',
                    fontSize: '0.9rem',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center'
                  }}>
                    {r.avatar}
                  </div>
                  <div>
                    <div style={{ fontWeight: '800', fontSize: '0.95rem', color: 'var(--text-primary)' }}>{r.name}</div>
                    <div style={{ fontSize: '0.76rem', color: 'var(--text-muted)' }}>{r.role}</div>
                  </div>
                </div>
              </div>
            ))}
          </div>

        </div>
      </section>

      {/* FULL-WIDTH PARTNER & CALL TO ACTION */}
      <section className="landing-section-pad" style={{
        width: '100%',
        padding: '80px clamp(20px, 4vw, 64px)',
        display: 'flex',
        justifyContent: 'center'
      }}>
        <div className="landing-cta-grid landing-cta-box" style={{
          width: '100%',
          background: 'var(--accent-primary-gradient)',
          borderRadius: '32px',
          padding: 'clamp(36px, 5vw, 64px)',
          color: '#ffffff',
          boxShadow: '0 24px 60px -12px rgba(79, 70, 229, 0.45)'
        }}>
          <div>
            <span style={{
              background: 'rgba(255,255,255,0.2)',
              padding: '6px 14px',
              borderRadius: '9999px',
              fontSize: '0.78rem',
              fontWeight: '800',
              textTransform: 'uppercase',
              display: 'inline-block',
              marginBottom: '16px'
            }}>
              ⚡ READY TO EXPERIENCE WORKNEST?
            </span>
            <h2 style={{ fontSize: 'clamp(2rem, 3.5vw, 3rem)', fontWeight: '900', lineHeight: 1.15, margin: '0 0 16px 0' }}>
              Your Doorstep Technician is Already Around the Corner.
            </h2>
            <p style={{ fontSize: '1.1rem', opacity: 0.9, lineHeight: 1.55, margin: '0 0 32px 0' }}>
              No bargaining. No waiting for days. Request an Electrician, Plumber, RO Specialist or Carpenter in 30 seconds.
            </p>
            <div style={{ display: 'flex', gap: '14px', flexWrap: 'wrap' }}>
              <button onClick={onEnterApp} className="btn" style={{
                background: '#ffffff',
                color: 'var(--accent-primary)',
                fontWeight: '900',
                fontSize: '1rem',
                padding: '16px 32px',
                borderRadius: '14px',
                boxShadow: '0 8px 24px rgba(0,0,0,0.15)'
              }}>
                Book Service Online <ArrowRight size={18} />
              </button>
              <button onClick={onEnterApp} className="btn" style={{
                background: 'rgba(255,255,255,0.15)',
                color: '#ffffff',
                border: '1px solid rgba(255,255,255,0.3)',
                fontWeight: '700',
                fontSize: '1rem',
                padding: '16px 28px',
                borderRadius: '14px'
              }}>
                Join as Service Partner
              </button>
            </div>
          </div>

          <div style={{
            background: 'rgba(255,255,255,0.1)',
            backdropFilter: 'blur(12px)',
            borderRadius: '24px',
            padding: '32px',
            border: '1px solid rgba(255,255,255,0.2)',
            display: 'flex',
            flexDirection: 'column',
            gap: '16px'
          }}>
            <h3 style={{ fontSize: '1.25rem', fontWeight: '900', margin: 0 }}>
              Earn Up to ₹45,000 / month as a Service Partner
            </h3>
            <p style={{ fontSize: '0.9rem', opacity: 0.88, lineHeight: 1.5, margin: 0 }}>
              Are you an electrician, plumber, or technician? Receive high-paying job requests nearby directly on your phone.
            </p>
            <ul style={{ listStyle: 'none', padding: 0, margin: 0, display: 'flex', flexDirection: 'column', gap: '8px', fontSize: '0.86rem' }}>
              <li style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                <CheckCircle2 size={16} /> Instant Direct UPI Payments
              </li>
              <li style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                <CheckCircle2 size={16} /> Flexible Work Hours (Go Online Anytime)
              </li>
              <li style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                <CheckCircle2 size={16} /> Zero Registration Charges
              </li>
            </ul>
            <button onClick={onEnterApp} className="btn" style={{
              background: '#ffffff',
              color: '#10b981',
              fontWeight: '800',
              padding: '12px',
              borderRadius: '12px',
              marginTop: '8px'
            }}>
              Register as Partner
            </button>
          </div>
        </div>
      </section>

      {/* FULL-WIDTH FOOTER */}
      <footer style={{
        width: '100%',
        padding: '40px clamp(20px, 4vw, 64px)',
        borderTop: '1px solid var(--border-color)',
        background: 'var(--bg-card)',
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        gap: '16px',
        color: 'var(--text-muted)',
        fontSize: '0.86rem'
      }}>
        <div style={{
          width: '100%',
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          flexWrap: 'wrap',
          gap: '16px'
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px', color: 'var(--text-primary)', fontWeight: '800', fontSize: '1.1rem' }}>
            <Wrench size={20} color="var(--accent-primary)" />
            <span>WorkNest Technologies Inc.</span>
          </div>
          <div style={{ display: 'flex', gap: '24px', fontSize: '0.85rem' }}>
            <span>Privacy Policy</span>
            <span>Terms of Service</span>
            <span>Safety & Support</span>
            <span>Contact Support</span>
          </div>
          <div>© 2026 WorkNest. All rights reserved.</div>
        </div>
      </footer>

    </div>
  );
}
