import React, { useState, useEffect, useMemo } from 'react';
import { 
  ToggleLeft, ToggleRight, Check, X, ShieldAlert, ArrowRight, Play, 
  RefreshCw, MessageCircle, ShieldCheck, MapPin, Key, Loader2, 
  Sparkles, Wrench, IndianRupee, Clock, User, PhoneCall, AlertCircle,
  Navigation, ExternalLink
} from 'lucide-react';
import ChatSystem from './ChatSystem';
import { apiUrl } from '../utils/api';

export default function WorkerView({ 
  workers = [], 
  activeBooking, 
  setActiveBooking, 
  refreshData, 
  currentUser,
  broadcasts: globalBroadcasts = [],
  selectedJob = null,
  onSelectJob = null,
  onAcceptJob: propAcceptJob = null
}) {
  const [showChat, setShowChat] = useState(false);
  const [broadcasts, setBroadcasts] = useState([]);
  const [filterCategory, setFilterCategory] = useState('ALL'); // 'ALL' or 'MY_PROFESSION'
  const [otpInput, setOtpInput] = useState('');
  const [localAvailable, setLocalAvailable] = useState(false);
  const [hasUnread, setHasUnread] = useState(false);
  const [isStartingTravel, setIsStartingTravel] = useState(false);
  const [isVerifying, setIsVerifying] = useState(false);

  // Helper: Open turn-by-turn navigation in Google Maps app or browser
  const openInGoogleMaps = (lat, lng, addressHint = '') => {
    if (!lat || !lng) {
      alert('Destination coordinates not found for this work request.');
      return;
    }
    const cleanLat = parseFloat(lat);
    const cleanLng = parseFloat(lng);
    const url = `https://www.google.com/maps/dir/?api=1&destination=${cleanLat},${cleanLng}&travelmode=driving`;
    window.open(url, '_blank', 'noopener,noreferrer');
  };

  // Derive activeWorker from logged-in user
  const activeWorker = workers.find(w => w.userId == currentUser?.id) || 
                       workers.find(w => w.name?.toLowerCase() === currentUser?.name?.toLowerCase());

  useEffect(() => {
    if (activeWorker) {
      setLocalAvailable(activeWorker.available);
    }
  }, [activeWorker?.available]);

  useEffect(() => {
    if (activeWorker && !activeBooking) {
      fetch(apiUrl(`/api/bookings/active/worker/${activeWorker.id}`))
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
  }, [activeWorker, activeBooking]);

  useEffect(() => {
    let interval;
    if (activeWorker && localAvailable && (!activeBooking || activeBooking.status === 'COMPLETED' || activeBooking.status === 'CANCELLED')) {
      const fetchBroadcasts = async () => {
        try {
          const res = await fetch(apiUrl(`/api/bookings/broadcasts?profession=${encodeURIComponent(activeWorker.profession)}`));
          if (res.ok) {
            const data = await res.json();
            setBroadcasts(data);
          }
        } catch (e) {
          console.error('Failed to fetch broadcasts');
        }
      };
      fetchBroadcasts();
      interval = setInterval(fetchBroadcasts, 4000);
    } else {
      setBroadcasts([]);
    }
    return () => clearInterval(interval);
  }, [activeWorker, activeBooking, localAvailable]);

  // Toggle availability
  const toggleAvailability = async () => {
    if (!activeWorker) return;
    const newStatus = !localAvailable;
    setLocalAvailable(newStatus);

    try {
      const response = await fetch(apiUrl(`/api/workers/${activeWorker.id}/availability?available=${newStatus}`), {
        method: 'PUT'
      });
      if (response.ok) {
        refreshData();
      } else {
        setLocalAvailable(!newStatus);
      }
    } catch (err) {
      console.error(err);
      setLocalAvailable(!newStatus);
    }
  };

  // Real-time GPS tracking when en route
  useEffect(() => {
    if (activeBooking && activeBooking.status === 'EN_ROUTE') {
      if ('geolocation' in navigator) {
        const watchId = navigator.geolocation.watchPosition(
          async (position) => {
            const { latitude, longitude } = position.coords;
            try {
              await fetch(apiUrl(`/api/bookings/${activeBooking.id}/location?latitude=${latitude}&longitude=${longitude}`), {
                method: 'PUT'
              });
            } catch (e) {
              console.error('Failed to update live location', e);
            }
          },
          (error) => console.warn('Geolocation error:', error),
          { enableHighAccuracy: true, maximumAge: 10000, timeout: 5000 }
        );
        return () => navigator.geolocation.clearWatch(watchId);
      }
    }
  }, [activeBooking?.status, activeBooking?.id]);

  // Accept Booking
  const handleAcceptJob = async (jobId) => {
    try {
      const response = await fetch(apiUrl(`/api/bookings/${jobId}/accept?workerId=${activeWorker.id}`), {
        method: 'PUT'
      });
      if (response.ok) {
        const updated = await response.json();
        setActiveBooking(updated);
        refreshData();
      } else {
        const text = await response.text();
        alert(text || 'Failed to accept job. It may have been assigned to another pro.');
      }
    } catch (err) {
      console.error(err);
    }
  };

  // Start Travel
  const handleStartTravel = async () => {
    if (!activeBooking || isStartingTravel) return;
    setIsStartingTravel(true);
    try {
      const response = await fetch(apiUrl(`/api/bookings/${activeBooking.id}/start-travel`), {
        method: 'PUT'
      });
      if (response.ok) {
        const updated = await response.json();
        setActiveBooking(updated);
        refreshData();
      }
    } catch (err) {
      console.error(err);
    } finally {
      setIsStartingTravel(false);
    }
  };

  // Start Work with OTP
  const handleStartWork = async () => {
    if (!activeBooking || isVerifying) return;
    if (otpInput.length !== 4) {
      alert('Please enter the 4-digit start OTP provided by the customer.');
      return;
    }
    setIsVerifying(true);
    try {
      const response = await fetch(apiUrl(`/api/bookings/${activeBooking.id}/start-work?otp=${otpInput}`), {
        method: 'PUT'
      });
      if (response.ok) {
        const updated = await response.json();
        setActiveBooking(updated);
        setOtpInput('');
        refreshData();
      } else {
        const text = await response.text();
        alert(text || 'Incorrect OTP code. Please check with customer.');
      }
    } catch (err) {
      console.error(err);
    } finally {
      setIsVerifying(false);
    }
  };

  // Complete Booking
  const handleComplete = async () => {
    if (!activeBooking) return;
    if (!window.confirm('Confirm that the task is finished and ready to generate the final invoice?')) return;
    try {
      const response = await fetch(apiUrl(`/api/bookings/${activeBooking.id}/complete`), {
        method: 'PUT'
      });
      if (response.ok) {
        const updated = await response.json();
        setActiveBooking(updated);
        refreshData();
      }
    } catch (err) {
      console.error(err);
    }
  };

  if (workers.length === 0) {
    return (
      <div className="glass-panel" style={{ padding: '32px', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', height: '100%' }}>
        <Loader2 size={32} className="animate-spin" color="var(--accent-worker)" />
        <h2 style={{ fontSize: '1.1rem', fontWeight: '800', color: 'var(--text-muted)', marginTop: '16px' }}>
          Syncing Partner Profile...
        </h2>
      </div>
    );
  }

  if (!activeWorker) {
    return (
      <div className="glass-panel" style={{ padding: '32px', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', height: '100%', textAlign: 'center' }}>
        <div style={{
          width: '54px',
          height: '54px',
          borderRadius: '50%',
          background: 'var(--warning-light)',
          color: 'var(--warning)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          marginBottom: '14px'
        }}>
          <AlertCircle size={28} />
        </div>
        <h2 style={{ fontSize: '1.25rem', fontWeight: '800', color: 'var(--text-primary)' }}>
          Provider Profile Inactive
        </h2>
        <p style={{ color: 'var(--text-muted)', fontSize: '0.88rem', marginTop: '6px', maxWidth: '300px' }}>
          Your account is currently registered as customer or awaiting worker verification.
        </p>
      </div>
    );
  }

  const isOngoing = activeBooking && activeBooking.workerId === activeWorker.id && ['ACCEPTED', 'EN_ROUTE', 'ACTIVE'].includes(activeBooking.status);
  const isCompleted = activeBooking && activeBooking.workerId === activeWorker.id && activeBooking.status === 'COMPLETED';

  return (
    <div style={{
      display: 'flex',
      flexDirection: 'column',
      gap: '18px',
      height: '100%',
      overflowY: 'auto',
      paddingRight: '4px'
    }}>
      
      {/* Worker Availability Header Card */}
      <div style={{
        padding: '18px 20px',
        borderRadius: '20px',
        background: 'var(--bg-card)',
        border: '1px solid var(--border-color)',
        boxShadow: 'var(--shadow-sm)',
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'center'
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '12px', minWidth: 0, flex: 1 }}>
          <div style={{
            width: '44px',
            height: '44px',
            borderRadius: '14px',
            background: 'var(--accent-worker-gradient)',
            color: '#fff',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            fontSize: '1.1rem',
            fontWeight: '900',
            boxShadow: '0 4px 12px rgba(16, 185, 129, 0.3)',
            flexShrink: 0
          }}>
            {activeWorker.name ? activeWorker.name.charAt(0).toUpperCase() : 'W'}
          </div>
          <div style={{ minWidth: 0, flex: 1 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
              <h3 style={{ fontWeight: '800', fontSize: '1rem', color: 'var(--text-primary)', margin: 0, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                {activeWorker.name}
              </h3>
              <ShieldCheck size={15} color="var(--success)" style={{ flexShrink: 0 }} />
            </div>
            <span style={{ fontSize: '0.75rem', color: 'var(--accent-worker)', fontWeight: '700', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', display: 'block' }}>
              Certified {activeWorker.profession}
            </span>
          </div>
        </div>

        {/* Online / Offline Toggle */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
          <span className={`badge ${localAvailable ? 'badge-success' : 'badge-warning'}`} style={{ textTransform: 'uppercase' }}>
            {localAvailable ? '● READY FOR JOBS' : '○ OFFLINE'}
          </span>
          <button 
            onClick={toggleAvailability} 
            disabled={isOngoing}
            style={{
              background: 'none',
              border: 'none',
              cursor: isOngoing ? 'not-allowed' : 'pointer',
              color: localAvailable ? 'var(--success)' : 'var(--text-muted)',
              opacity: isOngoing ? 0.5 : 1,
              display: 'flex',
              alignItems: 'center',
              padding: '2px'
            }}
            title={localAvailable ? 'Click to go Offline' : 'Click to go Online'}
          >
            {localAvailable ? <ToggleRight size={38} /> : <ToggleLeft size={38} />}
          </button>
        </div>
      </div>

      {/* Main Cockpit Section */}
      <div className="glass-panel" style={{
        padding: '22px',
        flex: 1,
        display: 'flex',
        flexDirection: 'column',
        gap: '18px',
        background: 'var(--bg-card)'
      }}>
        
        {/* Cockpit Section Header */}
        <div style={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          borderBottom: '1px solid var(--border-color)',
          paddingBottom: '12px'
        }}>
          <div>
            <h3 style={{ fontSize: '1.15rem', fontWeight: '800', color: 'var(--text-primary)', margin: 0 }}>
              Dispatch Cockpit
            </h3>
            <span style={{ fontSize: '0.74rem', color: 'var(--text-muted)' }}>
              Real-time radar & active task manager
            </span>
          </div>
          <span className="badge badge-primary" style={{ fontSize: '0.7rem' }}>
            FLEET VERIFIED
          </span>
        </div>

        {/* 1. Broadcasted Jobs Available Nearby */}
        {!isOngoing && !isCompleted && localAvailable && (
          (() => {
            const effectiveList = (globalBroadcasts && globalBroadcasts.length > 0) ? globalBroadcasts : broadcasts;
            const matchingCount = effectiveList.filter(j => 
              !activeWorker?.profession || j.professionCategory?.toLowerCase() === activeWorker.profession?.toLowerCase()
            ).length;
            const displayedJobs = effectiveList.filter(j => {
              if (filterCategory === 'MY_PROFESSION' && activeWorker?.profession) {
                return j.professionCategory?.toLowerCase() === activeWorker.profession?.toLowerCase();
              }
              return true;
            });

            if (effectiveList.length === 0) {
              return (
                <div style={{
                  padding: '28px 20px',
                  borderRadius: '16px',
                  background: 'var(--bg-subtle)',
                  border: '1px dashed var(--border-color)',
                  textAlign: 'center'
                }}>
                  <div style={{ fontSize: '1.8rem', marginBottom: '8px' }}>📡</div>
                  <div style={{ fontWeight: '800', fontSize: '0.95rem', color: 'var(--text-primary)' }}>
                    Radar Active: Scanning for Requests
                  </div>
                  <div style={{ fontSize: '0.78rem', color: 'var(--text-muted)', marginTop: '4px' }}>
                    Waiting for customer bookings in your area. New requests will pop up automatically.
                  </div>
                </div>
              );
            }

            return (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                    <div style={{ width: '8px', height: '8px', borderRadius: '50%', background: 'var(--warning)', animation: 'pulse 1.5s infinite' }} />
                    <h4 style={{ fontSize: '0.85rem', fontWeight: '800', color: 'var(--text-primary)', textTransform: 'uppercase', letterSpacing: '0.04em', margin: 0 }}>
                      Live Market Requests ({displayedJobs.length})
                    </h4>
                  </div>
                  {/* Filter Pill */}
                  <div style={{ display: 'flex', gap: '4px', background: 'var(--bg-subtle)', padding: '2px', borderRadius: '8px', border: '1px solid var(--border-color)' }}>
                    <button
                      type="button"
                      onClick={() => setFilterCategory('ALL')}
                      style={{
                        padding: '3px 8px', borderRadius: '6px', border: 'none',
                        background: filterCategory === 'ALL' ? 'var(--accent-primary)' : 'transparent',
                        color: filterCategory === 'ALL' ? '#fff' : 'var(--text-muted)',
                        fontSize: '0.68rem', fontWeight: 800, cursor: 'pointer'
                      }}
                    >
                      All ({effectiveList.length})
                    </button>
                    {activeWorker?.profession && (
                      <button
                        type="button"
                        onClick={() => setFilterCategory('MY_PROFESSION')}
                        style={{
                          padding: '3px 8px', borderRadius: '6px', border: 'none',
                          background: filterCategory === 'MY_PROFESSION' ? 'var(--accent-primary)' : 'transparent',
                          color: filterCategory === 'MY_PROFESSION' ? '#fff' : 'var(--text-muted)',
                          fontSize: '0.68rem', fontWeight: 800, cursor: 'pointer'
                        }}
                      >
                        {activeWorker.profession} ({matchingCount})
                      </button>
                    )}
                  </div>
                </div>

                {displayedJobs.map(job => {
                  const isSelected = selectedJob?.id === job.id;
                  return (
                    <div 
                      key={job.id} 
                      style={{
                        padding: '18px',
                        borderRadius: '16px',
                        background: isSelected ? 'rgba(79, 70, 229, 0.08)' : 'var(--bg-subtle)',
                        border: isSelected ? '2px solid #4f46e5' : '1px solid var(--border-color)',
                        boxShadow: isSelected ? '0 0 16px rgba(79, 70, 229, 0.22)' : 'var(--shadow-sm)',
                        display: 'flex',
                        flexDirection: 'column',
                        gap: '12px',
                        transition: 'all 0.2s ease'
                      }}
                    >
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                        <div>
                          <div style={{ display: 'flex', alignItems: 'center', gap: '6px', marginBottom: '6px' }}>
                            <span className="badge badge-warning">
                              NEW REQUEST #{job.id}
                            </span>
                            <span className="badge badge-primary" style={{ textTransform: 'capitalize' }}>
                              {job.professionCategory}
                            </span>
                          </div>
                          <div style={{ fontWeight: '800', fontSize: '1.05rem', color: 'var(--text-primary)' }}>
                            {job.customerName}
                          </div>
                        </div>
                        <div style={{ textAlign: 'right' }}>
                          <span style={{ fontSize: '1.25rem', fontWeight: '900', color: 'var(--success)' }}>
                            ₹{Math.round(job.totalCost || job.serviceCost || 250)}
                          </span>
                          <span style={{ display: 'block', fontSize: '0.7rem', color: 'var(--text-muted)' }}>
                            Est. Payout
                          </span>
                        </div>
                      </div>

                      <div style={{ display: 'flex', flexDirection: 'column', gap: '6px', fontSize: '0.84rem', color: 'var(--text-secondary)' }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                          <MapPin size={15} color="var(--accent-primary)" style={{ flexShrink: 0 }} />
                          <span style={{ whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                            {job.serviceAddress || 'Address on Map'}
                          </span>
                        </div>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                          <Wrench size={15} color="var(--accent-primary)" style={{ flexShrink: 0 }} />
                          <span>{job.taskDescription || 'Standard Doorstep Repair'}</span>
                        </div>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                          <Clock size={15} color="var(--accent-primary)" style={{ flexShrink: 0 }} />
                          <span>Estimated: {job.initialHours} Hour(s)</span>
                        </div>
                      </div>

                      <div style={{ display: 'flex', gap: '8px', marginTop: '4px', flexWrap: 'wrap' }}>
                        <button 
                          type="button"
                          onClick={() => {
                            if (onSelectJob) {
                              onSelectJob(isSelected ? null : job);
                            }
                          }}
                          style={{
                            flex: '1 1 110px',
                            padding: '11px',
                            borderRadius: '12px',
                            border: isSelected ? '2px solid #4f46e5' : '1px solid var(--border-color)',
                            background: isSelected ? '#4f46e5' : 'var(--bg-card)',
                            color: isSelected ? '#ffffff' : 'var(--text-primary)',
                            fontWeight: '800',
                            fontSize: '0.85rem',
                            cursor: 'pointer',
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                            gap: '6px',
                            transition: 'all 0.15s ease'
                          }}
                        >
                          <Navigation size={15} />
                          {isSelected ? 'Route on Map' : 'View Route'}
                        </button>

                        <button 
                          type="button"
                          onClick={() => propAcceptJob ? propAcceptJob(job.id) : handleAcceptJob(job.id)} 
                          className="btn btn-worker"
                          style={{
                            flex: '1 1 110px',
                            padding: '11px',
                            borderRadius: '12px',
                            fontWeight: '800',
                            fontSize: '0.88rem',
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                            gap: '6px'
                          }}
                        >
                          <Check size={16} /> Accept Job
                        </button>

                        {job.startLat && job.startLng && (
                          <button
                            type="button"
                            onClick={(e) => {
                              e.stopPropagation();
                              openInGoogleMaps(job.startLat, job.startLng, job.serviceAddress);
                            }}
                            className="btn btn-secondary"
                            style={{
                              padding: '11px 12px',
                              borderRadius: '12px',
                              fontWeight: '700',
                              fontSize: '0.82rem',
                              display: 'flex',
                              alignItems: 'center',
                              justifyContent: 'center',
                              gap: '6px',
                              color: '#1a73e8'
                            }}
                            title={`Navigate to destination in Google Maps (${parseFloat(job.startLat).toFixed(4)}, ${parseFloat(job.startLng).toFixed(4)})`}
                          >
                            <MapPin size={15} color="#1a73e8" />
                            <span>Maps</span>
                            <ExternalLink size={13} style={{ opacity: 0.7 }} />
                          </button>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            );
          })()
        )}

        {/* 2. Accepted - Ready to Depart */}
        {activeBooking?.workerId === activeWorker.id && activeBooking.status === 'ACCEPTED' && (
          <div style={{
            padding: '20px',
            borderRadius: '16px',
            background: 'var(--bg-subtle)',
            border: '1px solid var(--border-color)',
            display: 'flex',
            flexDirection: 'column',
            gap: '16px'
          }}>
            <div>
              <span className="badge badge-info" style={{ marginBottom: '8px' }}>
                JOB CONFIRMED
              </span>
              <h4 style={{ fontSize: '1.2rem', fontWeight: '800', color: 'var(--text-primary)', margin: '0 0 4px 0' }}>
                Customer: {activeBooking.customerName}
              </h4>
              <p style={{ fontSize: '0.86rem', color: 'var(--text-secondary)', margin: 0 }}>
                Please tap Start Travel when you leave your current location. Real-time GPS sharing will be activated.
              </p>
            </div>

            {/* Customer Doorstep Location & Google Maps Redirection Button */}
            <div style={{
              padding: '14px',
              borderRadius: '14px',
              background: 'var(--bg-card)',
              border: '1px solid var(--border-color)',
              display: 'flex',
              flexDirection: 'column',
              gap: '10px'
            }}>
              <div style={{ display: 'flex', alignItems: 'flex-start', gap: '8px' }}>
                <MapPin size={18} color="var(--accent-customer)" style={{ flexShrink: 0, marginTop: '2px' }} />
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ fontSize: '0.72rem', fontWeight: 800, textTransform: 'uppercase', color: 'var(--accent-customer)' }}>
                    Customer Doorstep Destination
                  </div>
                  <div style={{ fontSize: '0.9rem', fontWeight: 700, color: 'var(--text-primary)', lineHeight: 1.3, marginTop: '2px' }}>
                    {activeBooking.serviceAddress || 'Doorstep destination on map'}
                  </div>
                  {activeBooking.startLat && activeBooking.startLng && (
                    <div style={{ fontSize: '0.74rem', color: 'var(--text-muted)', fontFamily: 'monospace', marginTop: '4px' }}>
                      GPS: {parseFloat(activeBooking.startLat).toFixed(5)}, {parseFloat(activeBooking.startLng).toFixed(5)}
                    </div>
                  )}
                </div>
              </div>

              <button
                type="button"
                onClick={() => openInGoogleMaps(activeBooking.startLat, activeBooking.startLng, activeBooking.serviceAddress)}
                className="btn"
                style={{
                  width: '100%',
                  padding: '13px',
                  borderRadius: '12px',
                  fontSize: '0.94rem',
                  fontWeight: '800',
                  background: 'linear-gradient(135deg, #1a73e8 0%, #4285f4 100%)',
                  color: '#ffffff',
                  boxShadow: '0 4px 14px rgba(66, 133, 244, 0.35)',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  gap: '8px',
                  cursor: 'pointer'
                }}
              >
                <Navigation size={18} />
                <span>Navigate in Google Maps</span>
                <ExternalLink size={15} style={{ opacity: 0.8 }} />
              </button>
            </div>

            <button 
              onClick={handleStartTravel} 
              disabled={isStartingTravel} 
              className="btn btn-worker"
              style={{
                width: '100%',
                padding: '16px',
                borderRadius: '14px',
                fontSize: '1.05rem',
                fontWeight: '800'
              }}
            >
              {isStartingTravel ? <Loader2 className="animate-spin" /> : <Play size={20} />} 
              {isStartingTravel ? 'Starting Travel...' : 'Start Travel & Share GPS'}
            </button>
            
            <button 
              onClick={() => setShowChat(!showChat)} 
              className="btn btn-secondary"
              style={{ width: '100%', padding: '12px', borderRadius: '12px', fontWeight: '700' }}
            >
              <MessageCircle size={18} color="var(--accent-primary)" />
              <span>{showChat ? 'Close Chat' : 'Chat with Customer'}</span>
            </button>
            
            {showChat && (
              <ChatSystem 
                bookingId={activeBooking.id} 
                senderName={activeWorker.name} 
                senderRole="WORKER" 
                onClose={() => setShowChat(false)} 
              />
            )}
          </div>
        )}

        {/* 3. En-Route Driving Simulator & OTP Entry */}
        {activeBooking?.workerId === activeWorker.id && activeBooking.status === 'EN_ROUTE' && (
          <div style={{
            display: 'flex',
            flexDirection: 'column',
            gap: '16px'
          }}>
            <div style={{
              display: 'flex',
              alignItems: 'center',
              gap: '10px',
              padding: '14px',
              borderRadius: '14px',
              background: 'var(--accent-primary-light)',
              border: '1px solid rgba(79, 70, 229, 0.25)'
            }}>
              <Check size={20} color="var(--accent-primary)" />
              <div>
                <div style={{ fontWeight: '800', fontSize: '0.95rem', color: 'var(--text-primary)' }}>
                  En-Route to Customer
                </div>
                <div style={{ fontSize: '0.78rem', color: 'var(--text-muted)' }}>
                  Live GPS coordinate broadcast is active
                </div>
              </div>
            </div>

            {/* Google Maps Turn-by-Turn Navigation Button */}
            <div style={{
              padding: '14px',
              borderRadius: '14px',
              background: 'var(--bg-card)',
              border: '1px solid var(--border-color)',
              display: 'flex',
              flexDirection: 'column',
              gap: '10px'
            }}>
              <div style={{ display: 'flex', alignItems: 'flex-start', gap: '8px' }}>
                <MapPin size={18} color="var(--accent-customer)" style={{ flexShrink: 0, marginTop: '2px' }} />
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ fontSize: '0.72rem', fontWeight: 800, textTransform: 'uppercase', color: 'var(--accent-customer)' }}>
                    Destination Address
                  </div>
                  <div style={{ fontSize: '0.9rem', fontWeight: 700, color: 'var(--text-primary)', lineHeight: 1.3, marginTop: '2px' }}>
                    {activeBooking.serviceAddress || 'Doorstep destination'}
                  </div>
                  {activeBooking.startLat && activeBooking.startLng && (
                    <div style={{ fontSize: '0.74rem', color: 'var(--text-muted)', fontFamily: 'monospace', marginTop: '4px' }}>
                      GPS: {parseFloat(activeBooking.startLat).toFixed(5)}, {parseFloat(activeBooking.startLng).toFixed(5)}
                    </div>
                  )}
                </div>
              </div>

              <button
                type="button"
                onClick={() => openInGoogleMaps(activeBooking.startLat, activeBooking.startLng, activeBooking.serviceAddress)}
                className="btn"
                style={{
                  width: '100%',
                  padding: '14px',
                  borderRadius: '12px',
                  fontSize: '0.98rem',
                  fontWeight: '800',
                  background: 'linear-gradient(135deg, #1a73e8 0%, #4285f4 100%)',
                  color: '#ffffff',
                  boxShadow: '0 4px 16px rgba(66, 133, 244, 0.4)',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  gap: '8px',
                  cursor: 'pointer'
                }}
              >
                <Navigation size={18} />
                <span>Turn-by-Turn Navigation on Google Maps</span>
                <ExternalLink size={16} style={{ opacity: 0.85 }} />
              </button>
            </div>
            
            {/* OTP Entry Card */}
            <div style={{
              padding: '20px',
              borderRadius: '16px',
              background: 'var(--bg-subtle)',
              border: '1px solid var(--border-color)',
              display: 'flex',
              flexDirection: 'column',
              gap: '12px'
            }}>
              <div>
                <label className="form-label" style={{ marginBottom: '4px' }}>
                  Ask Customer for 4-Digit Start OTP
                </label>
                <span style={{ fontSize: '0.78rem', color: 'var(--text-muted)' }}>
                  Required to verify your arrival and begin work timer
                </span>
              </div>

              <div style={{ display: 'flex', gap: '10px' }}>
                <div style={{ position: 'relative', flex: 1 }}>
                  <Key size={18} style={{ position: 'absolute', left: '14px', top: '50%', transform: 'translateY(-50%)', color: 'var(--text-muted)' }} />
                  <input 
                    type="text" 
                    value={otpInput} 
                    onChange={e => setOtpInput(e.target.value.replace(/\D/g, '').slice(0, 4))} 
                    required 
                    maxLength={4}
                    placeholder="0000" 
                    className="form-input"
                    style={{
                      paddingLeft: '44px',
                      letterSpacing: '6px',
                      fontWeight: '900',
                      fontSize: '1.25rem',
                      textAlign: 'center'
                    }} 
                  />
                </div>
                <button 
                  onClick={handleStartWork} 
                  disabled={otpInput.length !== 4 || isVerifying} 
                  className="btn btn-worker"
                  style={{ padding: '0 20px', fontWeight: '800' }}
                >
                  {isVerifying ? <Loader2 className="animate-spin" /> : 'Verify & Start'}
                </button>
              </div>
            </div>

            <button 
              onClick={() => setShowChat(!showChat)} 
              className="btn btn-secondary"
              style={{ width: '100%', padding: '12px', borderRadius: '12px', fontWeight: '700' }}
            >
              <MessageCircle size={18} color="var(--accent-primary)" />
              <span>{showChat ? 'Close Chat' : 'Chat with Customer'}</span>
            </button>
            
            {showChat && (
              <ChatSystem 
                bookingId={activeBooking.id} 
                senderName={activeWorker.name} 
                senderRole="WORKER" 
                onClose={() => setShowChat(false)} 
              />
            )}
          </div>
        )}

        {/* 4. Active Work in Progress */}
        {activeBooking?.workerId === activeWorker.id && activeBooking.status === 'ACTIVE' && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
            <div style={{
              display: 'flex',
              gap: '10px',
              alignItems: 'center',
              padding: '14px',
              borderRadius: '14px',
              background: 'var(--success-light)',
              border: '1px solid rgba(16, 185, 129, 0.3)'
            }}>
              <Play size={20} color="var(--success)" />
              <div>
                <div style={{ fontWeight: '800', fontSize: '0.95rem', color: 'var(--text-primary)' }}>
                  Work In Progress
                </div>
                <div style={{ fontSize: '0.78rem', color: 'var(--text-muted)' }}>
                  Session started at {new Date(activeBooking.startedAt).toLocaleTimeString()}
                </div>
              </div>
            </div>

            <div style={{
              padding: '18px',
              borderRadius: '16px',
              background: 'var(--bg-subtle)',
              border: '1px solid var(--border-color)',
              display: 'flex',
              flexDirection: 'column',
              gap: '10px'
            }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.88rem' }}>
                <span className="text-muted">Client:</span>
                <span style={{ fontWeight: '700', color: 'var(--text-primary)' }}>{activeBooking.customerName}</span>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.88rem' }}>
                <span className="text-muted">Job Details:</span>
                <span style={{ fontWeight: '700', color: 'var(--text-primary)' }}>{activeBooking.taskDescription}</span>
              </div>
              <div style={{ borderTop: '1px dashed var(--border-color)', margin: '4px 0' }} />
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <span className="text-muted">Base Service Fee:</span>
                <span style={{ fontSize: '1.25rem', fontWeight: '900', color: 'var(--success)' }}>
                  ₹{activeBooking.serviceCost ? activeBooking.serviceCost.toFixed(2) : '250.00'}
                </span>
              </div>
            </div>

            <button
              type="button"
              onClick={() => openInGoogleMaps(activeBooking.startLat, activeBooking.startLng, activeBooking.serviceAddress)}
              className="btn btn-secondary"
              style={{
                width: '100%',
                padding: '12px',
                borderRadius: '12px',
                fontSize: '0.88rem',
                fontWeight: '700',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                gap: '8px',
                color: '#1a73e8'
              }}
            >
              <MapPin size={16} color="#1a73e8" />
              <span>View Doorstep on Google Maps</span>
              <ExternalLink size={14} style={{ opacity: 0.7 }} />
            </button>

            <button 
              onClick={handleComplete} 
              className="btn btn-worker"
              style={{
                width: '100%',
                padding: '16px',
                borderRadius: '14px',
                fontSize: '1.05rem',
                fontWeight: '800'
              }}
            >
              Finish Work & Settle Invoice
            </button>
            
            <button 
              onClick={() => setShowChat(!showChat)} 
              className="btn btn-secondary"
              style={{ width: '100%', padding: '12px', borderRadius: '12px', fontWeight: '700' }}
            >
              <MessageCircle size={18} color="var(--accent-primary)" />
              <span>{showChat ? 'Close Chat' : 'Chat with Customer'}</span>
            </button>
            
            {showChat && (
              <ChatSystem 
                bookingId={activeBooking.id} 
                senderName={activeWorker.name} 
                senderRole="WORKER" 
                onClose={() => setShowChat(false)} 
              />
            )}
          </div>
        )}

        {/* 5. Complete Settlement Summary */}
        {activeBooking?.workerId === activeWorker.id && activeBooking.status === 'COMPLETED' && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
            <div style={{
              display: 'flex',
              alignItems: 'center',
              gap: '12px',
              padding: '16px',
              borderRadius: '16px',
              background: 'var(--success-light)',
              border: '1px solid rgba(16, 185, 129, 0.3)'
            }}>
              <ShieldCheck size={32} color="var(--success)" />
              <div>
                <div style={{ fontWeight: '800', fontSize: '1.05rem', color: 'var(--text-primary)' }}>
                  Job Finished & Invoiced!
                </div>
                <div style={{ fontSize: '0.82rem', color: 'var(--text-secondary)' }}>
                  Direct payment collected from customer
                </div>
              </div>
            </div>
            
            <div style={{
              padding: '18px',
              borderRadius: '16px',
              background: 'var(--bg-subtle)',
              border: '1px solid var(--border-color)',
              display: 'flex',
              flexDirection: 'column',
              gap: '10px'
            }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.88rem' }}>
                <span className="text-muted">Total Customer Billed:</span>
                <span style={{ fontWeight: '700', color: 'var(--text-primary)' }}>₹{activeBooking.totalCost.toFixed(2)}</span>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.88rem' }}>
                <span className="text-muted">Platform Fee ({activeBooking.commissionRate}%):</span>
                <span style={{ color: 'var(--danger)', fontWeight: '700' }}>-₹{(activeBooking.commissionAmount || 0).toFixed(2)}</span>
              </div>
              <div style={{ borderTop: '1px dashed var(--border-color)', margin: '4px 0' }} />
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <span style={{ fontWeight: '800', fontSize: '1rem', color: 'var(--text-primary)' }}>
                  Your Net Earnings:
                </span>
                <span style={{ fontWeight: '900', fontSize: '1.4rem', color: 'var(--success)' }}>
                  ₹{(activeBooking.totalCost - (activeBooking.commissionAmount || 0)).toFixed(2)}
                </span>
              </div>
            </div>

            <button 
              onClick={() => { setActiveBooking(null); refreshData(); }} 
              className="btn btn-worker"
              style={{ width: '100%', padding: '14px', fontSize: '0.95rem', fontWeight: '800' }}
            >
              Return to Dispatch Cockpit
            </button>
          </div>
        )}

        {/* 6. Online Scanning State */}
        {(!isOngoing && !isCompleted && localAvailable && broadcasts.length === 0) && (
          <div style={{
            textAlign: 'center',
            padding: '48px 16px',
            display: 'flex',
            flexDirection: 'column',
            gap: '12px',
            alignItems: 'center',
            justifyContent: 'center',
            flex: 1
          }}>
            <div style={{
              width: '56px',
              height: '56px',
              borderRadius: '50%',
              background: 'var(--accent-worker-light)',
              color: 'var(--accent-worker)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center'
            }}>
              <RefreshCw className="animate-spin" size={26} style={{ animationDuration: '3s' }} />
            </div>
            <div>
              <div style={{ fontWeight: '800', fontSize: '1.05rem', color: 'var(--text-primary)', marginBottom: '4px' }}>
                Radar Active • Scanning for Requests
              </div>
              <p style={{ fontSize: '0.84rem', color: 'var(--text-muted)', maxWidth: '300px', margin: '0 auto', lineHeight: 1.5 }}>
                You will be notified immediately when a resident in your vicinity needs an {activeWorker.profession}. Keep this tab active!
              </p>
            </div>
          </div>
        )}
        
        {/* 7. Offline State */}
        {(!isOngoing && !isCompleted && !localAvailable) && (
          <div style={{
            textAlign: 'center',
            padding: '48px 16px',
            display: 'flex',
            flexDirection: 'column',
            gap: '12px',
            alignItems: 'center',
            justifyContent: 'center',
            flex: 1
          }}>
            <div style={{
              width: '56px',
              height: '56px',
              borderRadius: '50%',
              background: 'var(--warning-light)',
              color: 'var(--warning)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center'
            }}>
              <ToggleLeft size={32} />
            </div>
            <div>
              <div style={{ fontWeight: '800', fontSize: '1.05rem', color: 'var(--text-primary)', marginBottom: '4px' }}>
                You Are Currently Offline
              </div>
              <p style={{ fontSize: '0.84rem', color: 'var(--text-muted)', maxWidth: '300px', margin: '0 auto' }}>
                Toggle your status to ONLINE at the top to receive incoming service orders and customer requests.
              </p>
            </div>
          </div>
        )}

      </div>
    </div>
  );
}
