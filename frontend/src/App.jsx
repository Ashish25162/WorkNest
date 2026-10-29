import React, { useState, useEffect, useCallback } from 'react';
import CustomerView from './components/CustomerView';
import WorkerView from './components/WorkerView';
import AdminView from './components/AdminView';
import AuthScreen from './components/AuthScreen';
import LandingPage from './components/LandingPage';
import ProfileSettings from './components/ProfileSettings';
import InteractiveMap from './components/InteractiveMap';
import { apiUrl } from './utils/api';
import { ShieldCheck, Truck, Users, Landmark, MapPin, LogOut, User, Sun, Moon, Wrench, Sparkles } from 'lucide-react';

export default function App() {
  const [currentUser, setCurrentUser] = useState(null); // null = not logged in
  const [showLanding, setShowLanding] = useState(true);
  const [isAdminRoute, setIsAdminRoute] = useState(false);
  const [activeTab, setActiveTab] = useState('customer');
  const [workers, setWorkers] = useState([]);
  const [activeBooking, setActiveBooking] = useState(null);
  const [broadcasts, setBroadcasts] = useState([]);
  const [selectedJob, setSelectedJob] = useState(null);
  const [mobileTab, setMobileTab] = useState('form'); // 'form' or 'map' for mobile devices
  const [refreshTrigger, setRefreshTrigger] = useState(0);
  const [theme, setTheme] = useState('light');
  const [showProfile, setShowProfile] = useState(false);
  const [bookingLocation, setBookingLocationState] = useState(() => {
    try {
      const saved = localStorage.getItem('worknest_last_coords');
      if (saved) {
        const p = JSON.parse(saved);
        if (p.lat && p.lng) return [p.lat, p.lng];
      }
    } catch (e) {}
    return [22.7196, 75.8577]; // Default to Indore
  });

  const [serviceAddress, setServiceAddressState] = useState(() => {
    try {
      const saved = localStorage.getItem('worknest_last_address');
      if (saved) return saved;
    } catch (e) {}
    return 'Indore, Madhya Pradesh';
  });

  const setBookingLocation = useCallback((coords) => {
    setBookingLocationState(coords);
    if (coords && coords.length >= 2) {
      try {
        localStorage.setItem('worknest_last_coords', JSON.stringify({ lat: coords[0], lng: coords[1] }));
      } catch (e) {}
    }
  }, []);

  const setServiceAddress = useCallback((addr) => {
    setServiceAddressState(addr);
    if (addr) {
      try {
        localStorage.setItem('worknest_last_address', addr);
      } catch (e) {}
    }
  }, []);

  // Manage theme changes
  useEffect(() => {
    document.documentElement.setAttribute('data-theme', theme);
  }, [theme]);

  const toggleTheme = () => {
    setTheme(prev => prev === 'dark' ? 'light' : 'dark');
  };

  // Check if URL is /admin
  useEffect(() => {
    const path = window.location.pathname;
    if (path === '/admin' || path === '/admin/') {
      setIsAdminRoute(true);
    }

    // Check session storage for saved login
    try {
      const saved = sessionStorage.getItem('gigmap_user');
      if (saved) {
        setCurrentUser(JSON.parse(saved)); 
        setShowLanding(false); // Skip landing if already logged in
      }
    } catch (e) {
      console.warn('Session storage inaccessible:', e);
    }
  }, []);

  // Handle login
  const handleLogin = (userData) => {
    setCurrentUser(userData);
    try {
      sessionStorage.setItem('gigmap_user', JSON.stringify(userData));
    } catch (e) {
      console.warn('Session storage write failed:', e);
    }
    setShowProfile(false); // Reset profile view on login

    // Auto-set tab based on role
    if (userData.role === 'WORKER') setActiveTab('worker');
    else if (userData.role === 'ADMIN') setIsAdminRoute(true);
    else setActiveTab('customer');
  };

  const handleLogout = () => {
    setCurrentUser(null);
    setActiveBooking(null);
    try {
      sessionStorage.removeItem('gigmap_user');
    } catch (e) { /* ignore */ }
    setIsAdminRoute(false);
    setShowProfile(false); // Reset profile view on logout
    window.history.pushState({}, '', '/');
  };

  // 1. Fetch Workers
  const fetchWorkers = async () => {
    try {
      const response = await fetch(apiUrl(`/api/workers?_=${new Date().getTime()}`));
      if (response.ok) {
        const data = await response.json();
        setWorkers(data);
      }
    } catch (err) {
      console.error('Error fetching workers:', err);
    }
  };

  // 2. Fetch Open Broadcast Jobs (for Uber-style global dispatch map)
  const fetchBroadcasts = useCallback(async () => {
    try {
      const res = await fetch(apiUrl(`/api/bookings/broadcasts?_=${Date.now()}`));
      if (res.ok) {
        const data = await res.json();
        setBroadcasts(Array.isArray(data) ? data : []);
      }
    } catch (err) {
      console.warn('Failed to fetch broadcasts:', err);
    }
  }, []);

  // 3. Fetch Active Booking Details (polling)
  const fetchActiveBooking = async (id) => {
    try {
      const response = await fetch(apiUrl(`/api/bookings/${id}`));
      if (response.ok) {
        const booking = await response.json();
        setActiveBooking(booking);

        // If completed or cancelled, trigger administrative sync
        if (booking.status === 'COMPLETED' || booking.status === 'CANCELLED') {
          setRefreshTrigger(prev => prev + 1);
        }
      }
    } catch (err) {
      console.error('Error polling booking:', err);
    }
  };

  // 4. Accept Broadcast Job (as Worker)
  const handleAcceptJob = async (jobId) => {
    const activeWorker = workers.find(w => w.userId == currentUser?.id) || 
                         workers.find(w => w.name?.toLowerCase() === currentUser?.name?.toLowerCase());
    const workerId = activeWorker ? activeWorker.id : currentUser?.id;
    if (!workerId) {
      alert('Unable to identify active worker profile.');
      return;
    }
    try {
      const response = await fetch(apiUrl(`/api/bookings/${jobId}/accept?workerId=${workerId}`), {
        method: 'PUT'
      });
      if (response.ok) {
        const updated = await response.json();
        setActiveBooking(updated);
        setSelectedJob(null);
        setMobileTab('form'); // Switch back to active task in cockpit
        handleRefreshAll();
        return updated;
      } else {
        const text = await response.text();
        alert(text || 'Failed to accept job. It may have already been claimed.');
      }
    } catch (err) {
      console.error('Accept job error:', err);
      alert('Network error while accepting job.');
    }
  };

  const handleSelectJob = useCallback((job) => {
    setSelectedJob(job);
    if (job) {
      setMobileTab('map'); // Auto-switch to map view on mobile when a job is picked to see the route
    }
  }, []);

  // Initial load
  useEffect(() => {
    if (currentUser) {
      fetchWorkers();
      fetchBroadcasts();
    }
  }, [refreshTrigger, currentUser, fetchBroadcasts]);

  // Periodic polling for global workers status, broadcasts & availability
  useEffect(() => {
    if (!currentUser) return;
    const interval = setInterval(() => {
      fetchWorkers();
      fetchBroadcasts();
    }, 3500);
    return () => clearInterval(interval);
  }, [currentUser, fetchBroadcasts]);

  // Periodic polling for active booking
  useEffect(() => {
    if (!activeBooking || activeBooking.status === 'COMPLETED' || activeBooking.status === 'CANCELLED') return;

    const bookingInterval = setInterval(() => {
      fetchActiveBooking(activeBooking.id);
    }, 2000);

    return () => clearInterval(bookingInterval);
  }, [activeBooking]);

  const handleRefreshAll = () => {
    fetchWorkers();
    fetchBroadcasts();
    if (activeBooking) {
      fetchActiveBooking(activeBooking.id);
    }
    setRefreshTrigger(prev => prev + 1);
  };

  // ── 2. NOT LOGGED IN ──────────────────────────────────────────────────────────
  if (!currentUser) {
    if (showLanding && !isAdminRoute) {
      return <LandingPage onEnterApp={() => setShowLanding(false)} workers={workers} />;
    }
    return <AuthScreen onLogin={handleLogin} />;
  }

  // ── ADMIN ROUTE: Separate admin panel ──
  if (isAdminRoute || currentUser.role === 'ADMIN') {
    return (
      <div className="app-container" style={{ display: 'flex', flexDirection: 'column', height: '100vh' }}>
        <header className="navbar">
          <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
            <div style={{
              width: '38px',
              height: '38px',
              borderRadius: '10px',
              background: 'var(--accent-admin-gradient)',
              color: '#ffffff',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              boxShadow: '0 4px 12px rgba(124, 58, 237, 0.3)'
            }}>
              <Landmark size={20} />
            </div>
            <div>
              <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                <h1 style={{ fontSize: '1.2rem', fontWeight: '900', letterSpacing: '-0.02em', margin: 0, color: 'var(--text-primary)' }}>
                  WorkNest
                </h1>
                <span className="badge badge-warning" style={{ fontSize: '0.65rem', padding: '2px 6px' }}>
                  ADMIN
                </span>
              </div>
              <span style={{ fontSize: '0.68rem', color: 'var(--text-muted)', fontWeight: '700', textTransform: 'uppercase', letterSpacing: '0.06em' }}>
                Management & Settlement Console
              </span>
            </div>
          </div>

          <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
            <div style={{
              display: 'flex',
              alignItems: 'center',
              gap: '8px',
              padding: '6px 14px',
              borderRadius: '9999px',
              background: 'var(--bg-subtle)',
              border: '1px solid var(--border-color)'
            }}>
              <div style={{ width: '8px', height: '8px', borderRadius: '50%', background: 'var(--warning)', animation: 'pulse 1.5s infinite' }} />
              <span style={{ fontSize: '0.82rem', fontWeight: '700', color: 'var(--text-primary)' }}>
                {currentUser.name}
              </span>
            </div>
            
            {/* Theme Toggle */}
            <button
              onClick={toggleTheme}
              className="btn btn-secondary"
              style={{ padding: '8px 10px', borderRadius: '10px' }}
              title="Toggle Theme"
            >
              {theme === 'dark' ? <Sun size={16} /> : <Moon size={16} />}
            </button>
            
            <button
              onClick={handleLogout}
              className="btn btn-secondary"
              style={{ padding: '8px 14px', borderRadius: '10px', fontSize: '0.82rem', gap: '6px' }}
            >
              <LogOut size={14} /> Logout
            </button>
          </div>
        </header>

        <main style={{ flex: 1, overflow: 'auto', padding: '24px', background: 'var(--bg-primary)' }}>
          <AdminView refreshTrigger={refreshTrigger} />
        </main>
      </div>
    );
  }

  // ── MAIN PORTAL: Customer / Worker views ──
  const userRole = currentUser.role;

  return (
    <div className="app-container">
      {/* Header / Navbar */}
      <header className="navbar">
        <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
          <div style={{
            width: '36px',
            height: '36px',
            borderRadius: '10px',
            background: userRole === 'WORKER' ? 'var(--accent-worker-gradient)' : 'var(--accent-customer-gradient)',
            color: '#ffffff',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            boxShadow: userRole === 'WORKER' 
              ? '0 4px 14px rgba(16, 185, 129, 0.35)' 
              : '0 4px 14px rgba(79, 70, 229, 0.35)',
            flexShrink: 0
          }}>
            {userRole === 'WORKER' ? <Truck size={20} /> : <Wrench size={20} />}
          </div>
          <div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
              <h1 style={{ fontSize: '1.15rem', fontWeight: '900', letterSpacing: '-0.02em', margin: 0, color: 'var(--text-primary)' }}>
                WorkNest
              </h1>
              <span className={`badge ${userRole === 'WORKER' ? 'badge-success' : 'badge-primary'}`} style={{ fontSize: '0.62rem', padding: '2px 6px' }}>
                {userRole === 'WORKER' ? 'PRO' : 'CLIENT'}
              </span>
            </div>
            <span className="navbar-subtitle" style={{ fontSize: '0.65rem', color: 'var(--text-muted)', fontWeight: '700', textTransform: 'uppercase', letterSpacing: '0.06em' }}>
              Real-Time On-Demand Dispatch
            </span>
          </div>
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
          
          {/* User badge */}
          <div style={{
            display: 'flex',
            alignItems: 'center',
            gap: '6px',
            padding: '5px 10px',
            borderRadius: '9999px',
            background: 'var(--bg-subtle)',
            border: '1px solid var(--border-color)'
          }}>
            <div style={{
              width: '22px',
              height: '22px',
              borderRadius: '50%',
              background: userRole === 'WORKER' ? 'var(--accent-worker-gradient)' : 'var(--accent-customer-gradient)',
              color: '#fff',
              fontSize: '0.7rem',
              fontWeight: '800',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center'
            }}>
              {currentUser.name ? currentUser.name.charAt(0).toUpperCase() : 'U'}
            </div>
            <span className="navbar-user-name" style={{ fontSize: '0.82rem', fontWeight: '700', color: 'var(--text-primary)' }}>
              {currentUser.name}
            </span>
          </div>

          {/* Theme Toggle */}
          <button
            onClick={toggleTheme}
            className="btn btn-secondary"
            style={{ padding: '7px 9px', borderRadius: '10px' }}
            title="Toggle theme"
          >
            {theme === 'dark' ? <Sun size={15} /> : <Moon size={15} />}
          </button>

          {/* Role Navigation Button (Desktop) */}
          {userRole === 'CUSTOMER' && (
            <button
              onClick={() => { setShowProfile(false); setMobileTab('form'); }}
              className={`btn navbar-desktop-only ${!showProfile && mobileTab === 'form' ? 'btn-customer' : 'btn-secondary'}`}
              style={{ padding: '7px 12px', fontSize: '0.8rem', borderRadius: '10px' }}
            >
              <Users size={14} /> <span className="navbar-btn-text">Book Service</span>
            </button>
          )}

          {userRole === 'WORKER' && (
            <button
              onClick={() => { setShowProfile(false); setMobileTab('form'); }}
              className={`btn navbar-desktop-only ${!showProfile && mobileTab === 'form' ? 'btn-worker' : 'btn-secondary'}`}
              style={{ padding: '7px 12px', fontSize: '0.8rem', borderRadius: '10px' }}
            >
              <Truck size={14} /> <span className="navbar-btn-text">Jobs Cockpit</span>
            </button>
          )}

          <button
            onClick={() => setShowProfile(!showProfile)}
            className={`btn navbar-desktop-only ${showProfile ? 'btn-primary' : 'btn-secondary'}`}
            style={{ padding: '7px 12px', fontSize: '0.8rem', borderRadius: '10px' }}
            title="Profile & History"
          >
            <User size={14} /> <span className="navbar-btn-text">Profile</span>
          </button>

          <button
            onClick={handleLogout}
            className="btn btn-secondary"
            style={{ padding: '7px 12px', fontSize: '0.8rem', borderRadius: '10px' }}
            title="Sign Out"
          >
            <LogOut size={14} /> <span className="navbar-btn-text">Logout</span>
          </button>
        </div>
      </header>

      {/* Main Multi-Panel Workspace */}
      <main className={`main-content mobile-tab-${mobileTab}`}>
        {/* Control Panel Section */}
        <section className="control-panel-section">
          {showProfile ? (
            <div style={{ overflowY: 'auto', height: '100%' }}>
              <ProfileSettings currentUser={currentUser} onUpdateUser={handleLogin} onLogout={handleLogout} />
            </div>
          ) : (
            <>
              {userRole === 'CUSTOMER' && (
                <CustomerView
                  workers={workers}
                  activeBooking={activeBooking}
                  setActiveBooking={setActiveBooking}
                  refreshData={handleRefreshAll}
                  currentUser={currentUser}
                  onUpdateUser={handleLogin}
                  bookingLocation={bookingLocation}
                  setBookingLocation={setBookingLocation}
                  serviceAddress={serviceAddress}
                  setServiceAddress={setServiceAddress}
                />
              )}
              {userRole === 'WORKER' && (
                <WorkerView
                  workers={workers}
                  activeBooking={activeBooking}
                  setActiveBooking={setActiveBooking}
                  refreshData={handleRefreshAll}
                  currentUser={currentUser}
                  onUpdateUser={handleLogin}
                  broadcasts={broadcasts}
                  selectedJob={selectedJob}
                  onSelectJob={handleSelectJob}
                  onAcceptJob={handleAcceptJob}
                />
              )}
            </>
          )}
        </section>

        {/* Live-Map Simulator HUD Section */}
        <section className="map-panel-section">
          <InteractiveMap
            workers={workers}
            activeBooking={activeBooking}
            setActiveBooking={setActiveBooking}
            currentUser={currentUser}
            bookingLocation={bookingLocation}
            setBookingLocation={setBookingLocation}
            serviceAddress={serviceAddress}
            setServiceAddress={setServiceAddress}
            broadcasts={broadcasts}
            selectedJob={selectedJob}
            onSelectJob={handleSelectJob}
            onAcceptJob={handleAcceptJob}
            refreshData={handleRefreshAll}
            mobileTab={mobileTab}
            onSwitchToForm={() => setMobileTab('form')}
          />
        </section>
      </main>

      {/* Mobile Bottom Navigation Bar (Visible only on mobile <= 860px) */}
      <nav className="mobile-view-tabs">
        <button
          type="button"
          onClick={() => { setMobileTab('map'); setShowProfile(false); }}
          className={`mobile-tab-btn ${mobileTab === 'map' && !showProfile ? 'active' : ''}`}
        >
          <MapPin size={18} />
          <span>Live Map</span>
        </button>

        <button
          type="button"
          onClick={() => { setMobileTab('form'); setShowProfile(false); }}
          className={`mobile-tab-btn ${mobileTab === 'form' && !showProfile ? 'active' : ''}`}
        >
          {userRole === 'WORKER' ? <Truck size={18} /> : <Wrench size={18} />}
          <span>{userRole === 'WORKER' ? `Cockpit (${broadcasts.length})` : 'Book Service'}</span>
        </button>

        <button
          type="button"
          onClick={() => setShowProfile(true)}
          className={`mobile-tab-btn ${showProfile ? 'active' : ''}`}
        >
          <User size={18} />
          <span>Profile</span>
        </button>
      </nav>
    </div>
  );
}
