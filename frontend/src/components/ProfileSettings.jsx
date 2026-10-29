import { useState, useEffect, useRef } from 'react';
import { User, Lock, Mail, Phone, Camera, Save, Key, ShieldCheck, History, CheckCircle, AlertCircle, X, Image as ImageIcon, Upload, Trash2, AlertTriangle } from 'lucide-react';
import { apiUrl, assetUrl } from '../utils/api';

export default function ProfileSettings({ currentUser, onUpdateUser, onLogout }) {
  const [activeTab, setActiveTab] = useState('general');
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState('');
  const [error, setError] = useState('');
  
  const fileInputRef = useRef(null);
  const [showPhotoMenu, setShowPhotoMenu] = useState(false);
  const [showPhotoModal, setShowPhotoModal] = useState(false);

  // General state
  const [mobile, setMobile] = useState(currentUser.mobile || '');
  const [profilePhoto, setProfilePhoto] = useState(currentUser.profilePhoto || '');

  // Password state
  const [oldPassword, setOldPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  
  // Delete Account state
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [deletePassword, setDeletePassword] = useState('');

  // Email state
  const [newEmail, setNewEmail] = useState('');
  const [otpSent, setOtpSent] = useState(false);
  const [otpCode, setOtpCode] = useState('');

  // Earnings state
  const [history, setHistory] = useState([]);
  const [historyLoading, setHistoryLoading] = useState(false);

  const fetchHistory = async () => {
    setHistoryLoading(true);
    try {
      const endpoint = currentUser.role === 'WORKER' 
        ? apiUrl(`/api/bookings/worker/${currentUser.id || currentUser.userId}/history`)
        : apiUrl(`/api/bookings/customer/${encodeURIComponent(currentUser.name)}/history`);
        
      const res = await fetch(endpoint);
      if (res.ok) {
        const data = await res.json();
        setHistory(data);
      }
    } catch (err) {
      console.error(err);
    }
    setHistoryLoading(false);
  };

  useEffect(() => {
    if (activeTab === 'history') {
      fetchHistory();
    }
  }, [activeTab]);

  const handleDeleteAccount = async (e) => {
    e.preventDefault();
    if (!deletePassword) {
      setError("Please enter your password to confirm deletion.");
      return;
    }
    setLoading(true); setMessage(''); setError('');
    try {
      const res = await fetch(apiUrl('/api/profile/delete'), {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ userId: (currentUser?.id || currentUser?.userId), password: deletePassword })
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error);
      
      // Successfully deleted, trigger logout
      if (onLogout) onLogout();
      else onUpdateUser(null);
    } catch (err) {
      setError(err.message);
    }
    setLoading(false);
  };

  const handleUpdateGeneral = async (e) => {
    e.preventDefault();
    setLoading(true); setMessage(''); setError('');
    try {
      const res = await fetch(apiUrl('/api/profile/update'), {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ userId: (currentUser?.id || currentUser?.userId), mobile, profilePhoto })
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error);
      onUpdateUser(data);
      setMessage('Profile updated successfully! Looking good.');
    } catch (err) {
      setError(err.message);
    }
    setLoading(false);
  };

  const handleUpdatePassword = async (e) => {
    e.preventDefault();
    if (newPassword !== confirmPassword) {
      setError("Passwords don't match");
      return;
    }
    setLoading(true); setMessage(''); setError('');
    try {
      const res = await fetch(apiUrl('/api/profile/password'), {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ userId: (currentUser?.id || currentUser?.userId), oldPassword, newPassword })
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error);
      setMessage('Password updated successfully! Your account is secure.');
      setOldPassword(''); setNewPassword(''); setConfirmPassword('');
    } catch (err) {
      setError(err.message);
    }
    setLoading(false);
  };

  const handleRequestEmailOtp = async (e) => {
    e.preventDefault();
    setLoading(true); setMessage(''); setError('');
    try {
      const res = await fetch(apiUrl('/api/profile/email/request-otp'), {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ userId: (currentUser?.id || currentUser?.userId), newEmail })
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error);
      setOtpSent(true);
      setMessage('OTP sent! Please check your new email inbox.');
    } catch (err) {
      setError(err.message);
    }
    setLoading(false);
  };

  const handleVerifyEmailOtp = async (e) => {
    e.preventDefault();
    setLoading(true); setMessage(''); setError('');
    try {
      const res = await fetch(apiUrl('/api/profile/email/verify-otp'), {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ userId: (currentUser?.id || currentUser?.userId), newEmail, otpCode })
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error);
      onUpdateUser(data);
      setMessage('Email verified and updated successfully!');
      setOtpSent(false); setNewEmail(''); setOtpCode('');
    } catch (err) {
      setError(err.message);
    }
    setLoading(false);
  };

  return (
    <div className="profile-container">
      {/* Dynamic Header */}
      <div className="profile-header">
        <div className="profile-header-bg"></div>
        <div style={{ position: 'relative', zIndex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
          <div className="profile-avatar-container" onMouseLeave={() => setShowPhotoMenu(false)}>
            <img 
              src={profilePhoto ? assetUrl(profilePhoto) : `https://ui-avatars.com/api/?name=${currentUser.name}&background=random`} 
              alt="Profile" 
              className="profile-avatar" 
            />
            
            <button 
              className="profile-camera-btn" 
              onClick={() => setShowPhotoMenu(!showPhotoMenu)}
              type="button"
            >
              <Camera size={16} />
            </button>

            {showPhotoMenu && (
              <div className="profile-photo-menu">
                <button 
                  type="button" 
                  className="photo-menu-item"
                  onClick={() => { setShowPhotoModal(true); setShowPhotoMenu(false); }}
                >
                  <ImageIcon size={16} /> View Photo
                </button>
                <button 
                  type="button" 
                  className="photo-menu-item"
                  onClick={() => { fileInputRef.current?.click(); setShowPhotoMenu(false); }}
                >
                  <Upload size={16} /> Update Photo
                </button>
              </div>
            )}

            {/* Hidden File Input */}
            <input 
              type="file" 
              accept="image/*" 
              ref={fileInputRef} 
              style={{ display: 'none' }} 
              onChange={async (e) => {
                const file = e.target.files[0];
                if (!file) return;
                setLoading(true);
                try {
                  const formData = new FormData();
                  formData.append('file', file);
                  const res = await fetch(apiUrl('/api/upload'), { method: 'POST', body: formData });
                  const data = await res.json();
                  if(res.ok) setProfilePhoto(data.url);
                  else alert(data.error);
                } catch(err) {
                  console.error(err);
                }
                setLoading(false);
              }} 
            />

            <div className="profile-role-badge">
              {currentUser.role === 'WORKER' ? <ShieldCheck size={14} /> : <User size={14} />}
              <span>{currentUser.role}</span>
            </div>
          </div>
          <h2 className="profile-name">{currentUser.name}</h2>
          <p className="profile-email">{currentUser.email}</p>
        </div>
      </div>

      {/* Tabs */}
      <div className="profile-tabs">
        <button onClick={() => setActiveTab('general')} className={`profile-tab ${activeTab === 'general' ? 'active' : ''}`}>
          <User size={16} /> General
        </button>
        <button onClick={() => setActiveTab('email')} className={`profile-tab ${activeTab === 'email' ? 'active' : ''}`}>
          <Mail size={16} /> Email
        </button>
        <button onClick={() => setActiveTab('security')} className={`profile-tab ${activeTab === 'security' ? 'active' : ''}`}>
          <Lock size={16} /> Security
        </button>
        <button onClick={() => setActiveTab('history')} className={`profile-tab ${activeTab === 'history' ? 'active' : ''}`}>
          <History size={16} /> History
        </button>
      </div>

      {/* Content Area */}
      <div className="profile-card">
        {error && (
          <div className="profile-alert profile-alert-error">
            <AlertCircle size={20} />
            <span>{error}</span>
          </div>
        )}
        {message && (
          <div className="profile-alert profile-alert-success">
            <CheckCircle size={20} />
            <span>{message}</span>
          </div>
        )}

        {/* GENERAL TAB */}
        {activeTab === 'general' && (
          <form onSubmit={handleUpdateGeneral} className="profile-form">
            <div className="form-row">
              <label className="profile-label">Full Name</label>
              <div className="profile-input-group">
                <User size={20} className="profile-icon" />
                <input type="text" className="profile-input profile-input-disabled" value={currentUser.name} disabled />
              </div>
              <span className="profile-hint">Name cannot be changed directly.</span>
            </div>

            <div className="form-row">
              <label className="profile-label">Mobile Number</label>
              <div className="profile-input-group">
                <Phone size={20} className="profile-icon" />
                <input 
                  type="tel" 
                  className="profile-input" 
                  value={mobile} 
                  onChange={e => setMobile(e.target.value)} 
                  required 
                  pattern="^[6-9]\d{9}$" 
                  title="Must be exactly 10 digits and start with 6, 7, 8, or 9"
                  placeholder="Enter 10-digit mobile number"
                />
              </div>
            </div>



            <button type="submit" disabled={loading} className="profile-btn-primary mt-4">
              <Save size={18} /> {loading ? 'Saving...' : 'Save Changes'}
            </button>
          </form>
        )}

        {/* EMAIL TAB */}
        {activeTab === 'email' && (
          <div className="profile-form">
            <div className="profile-current-email">
              <div className="icon-bg"><Mail size={24} /></div>
              <div>
                <span className="label">Current Verified Email</span>
                <span className="value">{currentUser.email}</span>
              </div>
            </div>

            {!otpSent ? (
              <form onSubmit={handleRequestEmailOtp} className="profile-form mt-4">
                <div className="form-row">
                  <label className="profile-label">New Email Address</label>
                  <div className="profile-input-group">
                    <Mail size={20} className="profile-icon" />
                    <input type="email" className="profile-input" value={newEmail} onChange={e => setNewEmail(e.target.value)} required placeholder="e.g. new@example.com" />
                  </div>
                </div>
                <button type="submit" disabled={loading || !newEmail} className="profile-btn-primary mt-2">
                  Send Verification OTP
                </button>
              </form>
            ) : (
              <form onSubmit={handleVerifyEmailOtp} className="profile-form mt-4">
                <div className="form-row">
                  <label className="profile-label">Verification Code (sent to {newEmail})</label>
                  <div className="profile-input-group">
                    <Key size={20} className="profile-icon" />
                    <input type="text" className="profile-input code-input" value={otpCode} onChange={e => setOtpCode(e.target.value)} required placeholder="123456" maxLength={6} />
                  </div>
                </div>
                <div className="flex-row">
                  <button type="button" onClick={() => setOtpSent(false)} className="profile-btn-secondary" style={{ flex: 1 }}>Cancel</button>
                  <button type="submit" disabled={loading || otpCode.length !== 6} className="profile-btn-primary" style={{ flex: 2 }}>Verify & Update</button>
                </div>
              </form>
            )}
          </div>
        )}

        {/* SECURITY TAB */}
        {activeTab === 'security' && (
          <>
            <form onSubmit={handleUpdatePassword} className="profile-form">
              <div className="form-row">
              <label className="profile-label">Old Password</label>
              <div className="profile-input-group">
                <Lock size={20} className="profile-icon" />
                <input type="password" className="profile-input" value={oldPassword} onChange={e => setOldPassword(e.target.value)} required placeholder="Enter current password" />
              </div>
            </div>
            
            <div className="form-row">
              <label className="profile-label">New Password</label>
              <div className="profile-input-group">
                <Lock size={20} className="profile-icon" />
                <input 
                  type="password" 
                  className="profile-input" 
                  value={newPassword} 
                  onChange={e => setNewPassword(e.target.value)} 
                  required 
                  placeholder="Enter new strong password"
                  pattern="^(?=.*[A-Z])(?=.*[a-z])(?=.*\d)(?=.*[@$!%*?&])[A-Za-z\d@$!%*?&]{6,10}$" 
                  title="Password must be 6 to 10 characters long, and contain at least one uppercase letter, one lowercase letter, one number, and one special character."
                />
              </div>
              <div className="profile-password-hints">
                <span>• At least one uppercase & lowercase letter</span>
                <span>• At least one number & special character (@$!%*?&)</span>
                <span>• Length between 6 and 10 characters</span>
              </div>
            </div>

            <div className="form-row">
              <label className="profile-label">Confirm New Password</label>
              <div className="profile-input-group">
                <Lock size={20} className="profile-icon" />
                <input type="password" className="profile-input" value={confirmPassword} onChange={e => setConfirmPassword(e.target.value)} required placeholder="Re-enter new password" />
              </div>
            </div>
            
            <button type="submit" disabled={loading} className="profile-btn-primary mt-4">
              <ShieldCheck size={18} /> Update Password
            </button>
          </form>
          
          {/* Danger Zone: Delete Account */}
          <div className="danger-zone mt-8" style={{ borderTop: '1px solid rgba(239, 68, 68, 0.2)', paddingTop: '24px' }}>
            <h4 style={{ color: '#ef4444', display: 'flex', alignItems: 'center', gap: '8px', fontSize: '1.2rem', marginBottom: '8px' }}>
              <AlertTriangle size={20} /> Danger Zone
            </h4>
            <p style={{ color: '#94a3b8', fontSize: '0.9rem', marginBottom: '16px' }}>
              Permanently delete your account and all associated data. This action cannot be undone.
            </p>
            
            {!showDeleteConfirm ? (
              <button 
                type="button" 
                onClick={() => setShowDeleteConfirm(true)} 
                className="profile-btn-secondary" 
                style={{ color: '#ef4444', borderColor: 'rgba(239, 68, 68, 0.5)' }}
              >
                <Trash2 size={18} /> Delete Account
              </button>
            ) : (
              <form onSubmit={handleDeleteAccount} className="profile-form" style={{ background: 'rgba(239, 68, 68, 0.05)', padding: '16px', borderRadius: '12px', border: '1px solid rgba(239, 68, 68, 0.2)' }}>
                <div className="form-row">
                  <label className="profile-label" style={{ color: '#ef4444' }}>Confirm Password to Delete</label>
                  <div className="profile-input-group">
                    <Lock size={20} className="profile-icon" style={{ color: '#ef4444' }} />
                    <input 
                      type="password" 
                      className="profile-input" 
                      value={deletePassword} 
                      onChange={e => setDeletePassword(e.target.value)} 
                      required 
                      placeholder="Enter your password" 
                      style={{ borderColor: 'rgba(239, 68, 68, 0.3)' }}
                    />
                  </div>
                </div>
                <div className="flex-row mt-4">
                  <button type="button" onClick={() => { setShowDeleteConfirm(false); setDeletePassword(''); }} className="profile-btn-secondary" style={{ flex: 1 }}>
                    Cancel
                  </button>
                  <button type="submit" disabled={loading || !deletePassword} className="profile-btn-primary" style={{ flex: 1, background: '#ef4444', color: 'white' }}>
                    {loading ? 'Deleting...' : 'Permanently Delete'}
                  </button>
                </div>
              </form>
            )}
          </div>
          </>
        )}

        {/* HISTORY TAB */}
        {activeTab === 'history' && (
          <div className="profile-earnings-wrapper">
            {historyLoading ? (
              <div className="loading-state">Loading history...</div>
            ) : history.length === 0 ? (
              <div className="empty-state">No jobs found in your history.</div>
            ) : (
              <>
                {/* Highlight Stats (Only for Worker) */}
                {currentUser.role === 'WORKER' && (
                  <div className="earnings-hero">
                    <div className="earnings-hero-label">Total Net Earnings</div>
                    <div className="earnings-hero-value">
                      ₹{history.filter(b => b.status === 'COMPLETED').reduce((acc, b) => acc + ((b.totalCost || 0) - (b.commissionAmount || 0)), 0).toFixed(2)}
                    </div>
                    <div className="earnings-hero-sub">From {history.filter(b => b.status === 'COMPLETED').length} completed jobs</div>
                  </div>
                )}

                {/* Highlight Stats (Only for Customer) */}
                {currentUser.role === 'CUSTOMER' && (
                  <div className="earnings-hero" style={{ background: 'linear-gradient(135deg, rgba(16, 185, 129, 0.1), rgba(16, 185, 129, 0.05))', borderColor: 'rgba(16, 185, 129, 0.2)' }}>
                    <div className="earnings-hero-label" style={{ color: '#10b981' }}>Total Amount Spent</div>
                    <div className="earnings-hero-value" style={{ color: '#10b981' }}>
                      ₹{history.filter(b => b.status === 'COMPLETED').reduce((acc, b) => acc + (b.totalCost || 0), 0).toFixed(2)}
                    </div>
                    <div className="earnings-hero-sub" style={{ color: 'rgba(16, 185, 129, 0.8)' }}>On {history.filter(b => b.status === 'COMPLETED').length} completed jobs</div>
                  </div>
                )}

                <div className="earnings-list">
                  <h4 className="earnings-list-title">Recent Activity</h4>
                  {history.slice().reverse().map(job => {
                    const isCancelled = job.status !== 'COMPLETED';
                    const amount = currentUser.role === 'WORKER' 
                      ? ((job.totalCost || 0) - (job.commissionAmount || 0)).toFixed(2)
                      : (job.totalCost || 0).toFixed(2);

                    return (
                      <div key={job.id} className="earning-item" style={isCancelled ? { opacity: 0.75, borderLeft: '4px solid #ef4444' } : { borderLeft: '4px solid #10b981' }}>
                        <div className="earning-header">
                          <div>
                            <div className="earning-customer" style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                              {currentUser.role === 'WORKER' ? `Customer: ${job.customerName}` : `Worker: ${job.workerName || 'N/A'}`}
                              <span style={{ 
                                fontSize: '0.7rem', 
                                padding: '2px 8px', 
                                borderRadius: '12px', 
                                background: isCancelled ? 'rgba(239, 68, 68, 0.1)' : 'rgba(16, 185, 129, 0.1)', 
                                color: isCancelled ? '#ef4444' : '#10b981' 
                              }}>
                                {job.status}
                              </span>
                            </div>
                            <div className="earning-date" style={{ marginTop: '4px', fontSize: '0.8rem' }}>
                              <span style={{ color: '#e2e8f0', fontWeight: '500' }}>{job.taskDescription}</span>
                            </div>
                            <div className="earning-date">
                              <History size={12} style={{ marginRight: '4px' }}/>
                              {job.completedAt ? new Date(job.completedAt).toLocaleString() : new Date(job.createdAt).toLocaleString()}
                            </div>
                          </div>
                          <div className="earning-amount">
                            <div className="amount-val" style={{ color: isCancelled ? '#94a3b8' : 'var(--text-primary)' }}>
                              {isCancelled ? '-' : `₹${amount}`}
                            </div>
                            <div className="amount-label">{currentUser.role === 'WORKER' ? 'Net Payout' : 'Total Paid'}</div>
                          </div>
                        </div>
                        
                        {!isCancelled && currentUser.role === 'WORKER' && (
                          <div className="earning-breakdown">
                            <div className="breakdown-row">
                              <span>Service Fee</span>
                              <span>₹{(job.serviceCost || 0).toFixed(2)}</span>
                            </div>
                            <div className="breakdown-row">
                              <span>Travel Comp</span>
                              <span>₹{(job.travelCost || 0).toFixed(2)}</span>
                            </div>
                            <div className="breakdown-row breakdown-deduction">
                              <span>Platform Fee (-{job.commissionRate}%)</span>
                              <span>-₹{(job.commissionAmount || 0).toFixed(2)}</span>
                            </div>
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              </>
            )}
          </div>
        )}
      </div>

      <style>{`
        .profile-container {
          max-width: 750px;
          margin: 0 auto;
          padding: 24px;
          animation: fade-in-up 0.5s ease-out;
        }

        .profile-header {
          position: relative;
          background: rgba(255,255,255,0.02);
          border: 1px solid rgba(255,255,255,0.08);
          border-radius: 28px;
          padding: 40px 24px;
          text-align: center;
          margin-bottom: 24px;
          overflow: hidden;
          box-shadow: 0 20px 40px -10px rgba(0,0,0,0.3);
        }

        .profile-header-bg {
          position: absolute;
          top: -50%; left: -50%; right: -50%; bottom: -50%;
          background: radial-gradient(circle at top, rgba(99, 102, 241, 0.15), transparent 50%);
          z-index: 0;
          pointer-events: none;
        }

        .profile-avatar-container {
          position: relative;
          display: inline-block;
          margin-bottom: 16px;
        }

        .profile-avatar {
          width: 100px;
          height: 100px;
          border-radius: 50%;
          object-fit: cover;
          border: 4px solid var(--bg-card);
          box-shadow: 0 0 0 2px var(--accent-customer), 0 10px 25px -5px rgba(99, 102, 241, 0.4);
          transition: transform 0.3s ease;
        }

        .profile-avatar-container:hover .profile-avatar {
          transform: scale(1.05) rotate(2deg);
        }

        .profile-camera-btn {
          position: absolute;
          bottom: 5px;
          right: -5px;
          background: var(--bg-card);
          color: var(--text-primary);
          border: 1px solid var(--border-color);
          width: 32px;
          height: 32px;
          border-radius: 50%;
          display: flex;
          align-items: center;
          justify-content: center;
          cursor: pointer;
          box-shadow: 0 4px 10px rgba(0,0,0,0.2);
          transition: all 0.2s;
          z-index: 10;
        }

        .profile-camera-btn:hover {
          background: var(--bg-subtle);
          color: var(--accent-customer);
          transform: scale(1.1);
        }

        .profile-photo-menu {
          position: absolute;
          bottom: -70px;
          right: -100px;
          background: var(--bg-card);
          border: 1px solid var(--border-color);
          border-radius: 12px;
          padding: 8px;
          display: flex;
          flex-direction: column;
          gap: 4px;
          box-shadow: 0 10px 25px rgba(0,0,0,0.3);
          z-index: 20;
          min-width: 150px;
          animation: fade-in-up 0.2s ease-out;
        }

        .photo-menu-item {
          background: transparent;
          border: none;
          padding: 8px 12px;
          border-radius: 8px;
          color: var(--text-primary);
          font-size: 0.85rem;
          display: flex;
          align-items: center;
          gap: 8px;
          cursor: pointer;
          transition: background 0.2s;
          text-align: left;
        }

        .photo-menu-item:hover {
          background: var(--bg-subtle);
        }

        .profile-role-badge {
          position: absolute;
          bottom: -5px;
          left: 50%;
          transform: translateX(-50%);
          background: var(--accent-customer);
          color: #fff;
          font-size: 0.7rem;
          font-weight: 800;
          padding: 4px 10px;
          border-radius: 12px;
          display: flex;
          align-items: center;
          gap: 4px;
          text-transform: uppercase;
          letter-spacing: 1px;
          box-shadow: 0 4px 10px rgba(0,0,0,0.3);
          border: 2px solid var(--bg-card);
        }

        .profile-name {
          font-size: 2rem;
          font-weight: 900;
          margin: 0;
          color: var(--text-primary);
        }

        .profile-email {
          color: var(--text-secondary);
          margin-top: 4px;
          font-size: 1rem;
          font-weight: 500;
        }

        .profile-tabs {
          display: flex;
          gap: 12px;
          margin-bottom: 24px;
          background: rgba(0,0,0,0.2);
          padding: 10px;
          border-radius: 20px;
          border: 1px solid rgba(255,255,255,0.05);
          overflow-x: auto;
          scrollbar-width: none;
        }

        .profile-tabs::-webkit-scrollbar {
          display: none;
        }

        .profile-tab {
          flex: 1;
          min-width: 120px;
          padding: 14px 20px;
          border-radius: 14px;
          border: none;
          background: transparent;
          color: var(--text-secondary);
          font-weight: 600;
          font-size: 0.9rem;
          display: flex;
          align-items: center;
          justify-content: center;
          gap: 8px;
          cursor: pointer;
          transition: all 0.3s cubic-bezier(0.4, 0, 0.2, 1);
        }

        .profile-tab:hover {
          color: var(--text-primary);
          background: rgba(100, 116, 139, 0.1);
        }

        .profile-tab.active {
          background: var(--accent-customer);
          color: #fff;
          box-shadow: 0 8px 20px -5px rgba(99, 102, 241, 0.5);
          transform: translateY(-2px);
        }

        .profile-card {
          background: var(--bg-card);
          border: 1px solid var(--border-color);
          border-radius: 28px;
          padding: 32px;
          box-shadow: 0 20px 40px -10px rgba(0,0,0,0.2);
          position: relative;
          overflow: hidden;
        }

        .profile-alert {
          padding: 16px;
          border-radius: 16px;
          margin-bottom: 24px;
          display: flex;
          align-items: center;
          gap: 12px;
          font-weight: 600;
          font-size: 0.95rem;
          animation: slide-down 0.3s ease-out;
        }

        .profile-alert-error {
          background: rgba(239, 68, 68, 0.1);
          border: 1px solid rgba(239, 68, 68, 0.2);
          color: #fca5a5;
        }

        .profile-alert-success {
          background: rgba(16, 185, 129, 0.1);
          border: 1px solid rgba(16, 185, 129, 0.2);
          color: #6ee7b7;
        }

        .profile-form {
          display: flex;
          flex-direction: column;
          gap: 20px;
        }

        .form-row {
          display: flex;
          flex-direction: column;
          gap: 8px;
        }

        .profile-label {
          font-size: 0.8rem;
          font-weight: 700;
          color: var(--text-secondary);
          text-transform: uppercase;
          letter-spacing: 1px;
          margin-left: 4px;
        }

        .profile-input-group {
          position: relative;
        }

        .profile-icon {
          position: absolute;
          left: 16px;
          top: 50%;
          transform: translateY(-50%);
          color: #64748b;
          transition: color 0.3s;
          pointer-events: none;
        }

        .profile-input {
          width: 100%;
          padding: 16px 16px 16px 48px;
          border-radius: 16px;
          border: 2px solid transparent;
          background: var(--bg-primary);
          color: var(--text-primary);
          font-size: 1rem;
          font-family: inherit;
          transition: all 0.3s;
          box-shadow: inset 0 2px 4px rgba(0,0,0,0.05);
          border: 1px solid var(--border-color);
        }

        .profile-input:focus {
          outline: none;
          border-color: var(--accent-customer);
          background: rgba(255,255,255,0.06);
          box-shadow: 0 0 0 4px rgba(99, 102, 241, 0.15);
        }

        .profile-input:focus + .profile-icon,
        .profile-input-group:focus-within .profile-icon {
          color: var(--accent-customer);
        }

        .profile-input-disabled {
          opacity: 0.6;
          cursor: not-allowed;
          background: rgba(255,255,255,0.01);
        }

        .file-input {
          padding: 12px 16px 12px 48px;
          cursor: pointer;
        }

        .file-input::file-selector-button {
          background: var(--bg-card);
          color: var(--text-primary);
          border: 1px solid var(--border-color);
          padding: 8px 16px;
          border-radius: 8px;
          margin-right: 16px;
          cursor: pointer;
          font-weight: 600;
          transition: all 0.2s;
        }

        .file-input::file-selector-button:hover {
          background: rgba(255,255,255,0.1);
        }

        .code-input {
          font-size: 1.5rem;
          font-weight: 800;
          letter-spacing: 0.3em;
          text-align: center;
          padding-left: 16px;
        }

        .profile-hint {
          font-size: 0.75rem;
          color: var(--text-muted);
          margin-left: 4px;
        }

        .profile-password-hints {
          background: rgba(0,0,0,0.2);
          border: 1px solid rgba(255,255,255,0.05);
          padding: 12px 16px;
          border-radius: 12px;
          display: flex;
          flex-direction: column;
          gap: 6px;
          font-size: 0.75rem;
          color: var(--text-secondary);
        }

        .profile-btn-primary {
          background: linear-gradient(135deg, var(--accent-customer), #c084fc);
          color: #fff;
          border: none;
          padding: 18px 24px;
          border-radius: 16px;
          font-size: 1.05rem;
          font-weight: 800;
          cursor: pointer;
          display: flex;
          align-items: center;
          justify-content: center;
          gap: 10px;
          transition: all 0.3s;
          box-shadow: 0 10px 20px -5px rgba(99, 102, 241, 0.4);
        }

        .profile-btn-primary:hover:not(:disabled) {
          transform: translateY(-2px);
          box-shadow: 0 15px 25px -5px rgba(99, 102, 241, 0.5);
        }

        .profile-btn-primary:active:not(:disabled) {
          transform: translateY(1px);
        }

        .profile-btn-primary:disabled {
          opacity: 0.7;
          cursor: not-allowed;
        }

        .profile-btn-secondary {
          background: transparent;
          color: var(--text-primary);
          border: 1px solid var(--border-color);
          padding: 16px 24px;
          border-radius: 16px;
          font-size: 1rem;
          font-weight: 700;
          cursor: pointer;
          transition: all 0.3s;
        }

        .profile-btn-secondary:hover {
          background: rgba(255,255,255,0.05);
        }

        .mt-4 { margin-top: 24px; }
        .mt-2 { margin-top: 12px; }
        .flex-row { display: flex; gap: 16px; }

        .profile-current-email {
          background: linear-gradient(135deg, rgba(59, 130, 246, 0.1), rgba(168, 85, 247, 0.1));
          border: 1px solid rgba(59, 130, 246, 0.2);
          padding: 20px;
          border-radius: 20px;
          display: flex;
          align-items: center;
          gap: 16px;
        }

        .profile-current-email .icon-bg {
          background: rgba(59, 130, 246, 0.2);
          color: #60a5fa;
          padding: 12px;
          border-radius: 14px;
        }

        .profile-current-email .label {
          display: block;
          font-size: 0.8rem;
          font-weight: 700;
          color: var(--text-secondary);
          text-transform: uppercase;
          margin-bottom: 4px;
        }

        .profile-current-email .value {
          display: block;
          font-size: 1.2rem;
          font-weight: 800;
          color: var(--text-primary);
        }

        /* Earnings Specific */
        .earnings-hero {
          background: linear-gradient(135deg, rgba(16, 185, 129, 0.15), rgba(5, 150, 105, 0.1));
          border: 1px solid rgba(16, 185, 129, 0.3);
          padding: 32px;
          border-radius: 24px;
          text-align: center;
          margin-bottom: 32px;
        }
        
        .earnings-hero-label {
          font-size: 1rem;
          font-weight: 700;
          color: #6ee7b7;
          text-transform: uppercase;
          letter-spacing: 2px;
          margin-bottom: 8px;
        }
        
        .earnings-hero-value {
          font-size: 3.5rem;
          font-weight: 900;
          color: #10b981;
          line-height: 1;
          margin-bottom: 8px;
          text-shadow: 0 10px 30px rgba(16, 185, 129, 0.3);
        }
        
        .earnings-hero-sub {
          font-size: 0.9rem;
          color: rgba(255,255,255,0.7);
        }

        .earnings-list-title {
          font-size: 1.2rem;
          font-weight: 800;
          margin-bottom: 16px;
          padding-left: 8px;
        }

        .earning-item {
          background: rgba(0,0,0,0.2);
          border: 1px solid rgba(255,255,255,0.05);
          border-radius: 20px;
          padding: 20px;
          margin-bottom: 16px;
          transition: transform 0.2s, background 0.2s;
        }

        .earning-item:hover {
          background: rgba(255,255,255,0.02);
          transform: translateY(-2px);
        }

        .earning-header {
          display: flex;
          justify-content: space-between;
          align-items: flex-start;
          margin-bottom: 16px;
          padding-bottom: 16px;
          border-bottom: 1px solid rgba(255,255,255,0.05);
        }

        .earning-customer {
          font-size: 1.1rem;
          font-weight: 800;
          color: var(--text-primary);
          margin-bottom: 4px;
        }

        .earning-date {
          font-size: 0.8rem;
          color: var(--text-secondary);
          display: flex;
          align-items: center;
        }

        .earning-amount {
          text-align: right;
        }

        .amount-val {
          font-size: 1.4rem;
          font-weight: 900;
          color: #10b981;
        }

        .amount-label {
          font-size: 0.75rem;
          color: var(--text-secondary);
          text-transform: uppercase;
          font-weight: 700;
        }

        .earning-breakdown {
          display: flex;
          flex-direction: column;
          gap: 8px;
          background: rgba(255,255,255,0.02);
          padding: 16px;
          border-radius: 12px;
          font-size: 0.9rem;
        }

        .breakdown-row {
          display: flex;
          justify-content: space-between;
          color: var(--text-secondary);
        }

        .breakdown-deduction {
          color: #fca5a5;
          padding-top: 8px;
          border-top: 1px dashed rgba(255,255,255,0.1);
        }

        @keyframes fade-in-up {
          from { opacity: 0; transform: translateY(20px); }
          to { opacity: 1; transform: translateY(0); }
        }
        @keyframes slide-down {
          from { opacity: 0; transform: translateY(-10px); }
          to { opacity: 1; transform: translateY(0); }
        }
        @keyframes fade-in {
          from { opacity: 0; }
          to { opacity: 1; }
        }

        .photo-modal-overlay {
          position: fixed;
          top: 0; left: 0; right: 0; bottom: 0;
          background: rgba(0,0,0,0.8);
          backdrop-filter: blur(5px);
          z-index: 1000;
          display: flex;
          align-items: center;
          justify-content: center;
          animation: fade-in 0.2s ease-out;
        }

        .photo-modal-content {
          position: relative;
          max-width: 90vw;
          max-height: 90vh;
        }

        .photo-modal-img {
          max-width: 100%;
          max-height: 90vh;
          border-radius: 20px;
          border: 2px solid rgba(255,255,255,0.2);
          box-shadow: 0 25px 50px -12px rgba(0,0,0,0.5);
          object-fit: contain;
        }

        .photo-modal-close {
          position: absolute;
          top: -40px;
          right: 0;
          background: rgba(255,255,255,0.1);
          border: none;
          color: white;
          cursor: pointer;
          border-radius: 50%;
          padding: 8px;
          display: flex;
          align-items: center;
          justify-content: center;
          transition: background 0.2s;
        }

        .photo-modal-close:hover {
          background: rgba(255,255,255,0.2);
        }
      `}</style>

      {/* Full Screen Photo Modal JSX */}
      {showPhotoModal && (
        <div className="photo-modal-overlay" onClick={() => setShowPhotoModal(false)}>
          <div className="photo-modal-content" onClick={e => e.stopPropagation()}>
            <button className="photo-modal-close" onClick={() => setShowPhotoModal(false)}>
              <X size={20} />
            </button>
            <img 
              src={profilePhoto ? assetUrl(profilePhoto) : `https://ui-avatars.com/api/?name=${currentUser.name}&background=random`} 
              alt="Profile Full Screen" 
              className="photo-modal-img" 
            />
          </div>
        </div>
      )}
    </div>
  );
}
