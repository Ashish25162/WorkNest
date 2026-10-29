import React, { useState } from 'react';
import { User, Phone, Mail, MapPin, Lock, Eye, EyeOff, ArrowRight, UserPlus, LogIn, ShieldCheck, Loader2, Sparkles, Wrench, Shield, CheckCircle2 } from 'lucide-react';
import { apiUrl } from '../utils/api';

export default function AuthScreen({ onLogin }) {
  const [mode, setMode] = useState('login'); // 'login' | 'register' | 'otp' | 'forgot' | 'reset'
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [successMsg, setSuccessMsg] = useState('');
  const [otpCode, setOtpCode] = useState('');

  const [form, setForm] = useState({
    name: '', mobile: '', email: '', address: '', password: '', role: 'CUSTOMER', profession: 'Electrician', profilePhoto: ''
  });
  const [loginForm, setLoginForm] = useState({ identifier: '', password: '' });
  const [resetForm, setResetForm] = useState({ identifier: '', otp: '', newPassword: '' });

  const handleRegister = async (e) => {
    e.preventDefault();
    if (form.role === 'WORKER' && !form.profilePhoto) {
      setError('Profile Photo is mandatory for Service Professionals.');
      return;
    }
    
    setLoading(true);
    setError('');
    
    let coords = '';
    if (navigator.geolocation) {
      try {
        const position = await new Promise((resolve, reject) => {
          navigator.geolocation.getCurrentPosition(resolve, reject, { timeout: 8000 });
        });
        coords = `${position.coords.latitude},${position.coords.longitude}`;
      } catch (err) {
        console.warn('Geolocation failed or denied, proceeding without coords.', err);
      }
    }

    try {
      const payload = { ...form, address: coords };

      const res = await fetch(apiUrl('/api/auth/register'), {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      });
      const data = await res.json();
      if (!res.ok) { setError(data.error || 'Registration failed'); setLoading(false); return; }
      setSuccessMsg(`OTP sent to your email!`);
      setMode('otp');
    } catch (err) {
      setError('Failed to connect to server. Please check your network.');
    }
    setLoading(false);
  };

  const handleVerifyOtp = async (e) => {
    e.preventDefault();
    setError(''); setLoading(true);
    try {
      const res = await fetch(apiUrl('/api/auth/verify-otp'), {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ mobile: form.mobile, otp: otpCode })
      });
      const data = await res.json();
      if (!res.ok) { setError(data.error || 'OTP verification failed'); setLoading(false); return; }
      setSuccessMsg('Account verified! Welcome to WorkNest. You can now log in.');
      setMode('login');
      setLoginForm({ identifier: form.email, password: form.password });
    } catch (err) { setError('Network error.'); }
    setLoading(false);
  };

  const handleForgotPassword = async (e) => {
    e.preventDefault();
    setError(''); setLoading(true);
    try {
      const res = await fetch(apiUrl('/api/auth/forgot-password'), {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ identifier: resetForm.identifier })
      });
      const data = await res.json();
      if (!res.ok) { setError(data.error || 'Failed to request OTP'); setLoading(false); return; }
      setSuccessMsg(`OTP sent! Please check your email or mobile.`);
      setResetForm(prev => ({ ...prev, mobile: data.mobile }));
      setMode('reset');
    } catch (err) { setError('Network error.'); }
    setLoading(false);
  };

  const handleResetPassword = async (e) => {
    e.preventDefault();
    setError(''); setLoading(true);
    try {
      const res = await fetch(apiUrl('/api/auth/reset-password'), {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ mobile: resetForm.mobile, otp: resetForm.otp, newPassword: resetForm.newPassword })
      });
      const data = await res.json();
      if (!res.ok) { setError(data.error || 'Password reset failed'); setLoading(false); return; }
      setSuccessMsg('Password reset successful! You can now log in.');
      setMode('login');
      setLoginForm({ identifier: resetForm.identifier, password: resetForm.newPassword });
    } catch (err) { setError('Network error.'); }
    setLoading(false);
  };

  const handleLogin = async (e) => {
    e.preventDefault();
    setError(''); setLoading(true);

    try {
      if (navigator.geolocation) {
        try {
          await new Promise((resolve, reject) => {
            navigator.geolocation.getCurrentPosition(resolve, reject, { timeout: 4000 });
          });
        } catch(e) {
          // ignore
        }
      }

      const res = await fetch(apiUrl('/api/auth/login'), {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(loginForm)
      });
      const data = await res.json();
      if (!res.ok) { setError(data.error || 'Login failed'); setLoading(false); return; }
      onLogin(data);
    } catch (err) {
      setError('Network error. Is the backend server running?');
    }
    setLoading(false);
  };

  return (
    <div style={{
      minHeight: '100vh',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      background: 'var(--bg-primary)',
      padding: '24px 16px',
      position: 'relative'
    }}>
      {/* Background ambient lighting */}
      <div style={{
        position: 'absolute',
        width: '600px',
        height: '600px',
        background: 'radial-gradient(circle, rgba(79, 70, 229, 0.12) 0%, rgba(124, 58, 237, 0.04) 50%, transparent 70%)',
        top: '50%',
        left: '50%',
        transform: 'translate(-50%, -50%)',
        pointerEvents: 'none'
      }} />

      <div style={{ position: 'relative', zIndex: 1, width: '100%', maxWidth: '480px' }}>
        
        {/* Brand Header */}
        <div style={{ textAlign: 'center', marginBottom: '28px' }}>
          <div style={{
            display: 'inline-flex',
            alignItems: 'center',
            justifyContent: 'center',
            width: '54px',
            height: '54px',
            background: 'var(--accent-primary-gradient)',
            borderRadius: '16px',
            boxShadow: '0 8px 24px -4px rgba(79, 70, 229, 0.4)',
            color: '#fff',
            marginBottom: '14px'
          }}>
            <Wrench size={28} />
          </div>
          <h1 style={{
            fontSize: '1.9rem',
            fontWeight: '900',
            letterSpacing: '-0.02em',
            color: 'var(--text-primary)',
            marginBottom: '4px'
          }}>
            WorkNest
          </h1>
          <p style={{
            color: 'var(--text-muted)',
            fontSize: '0.85rem',
            fontWeight: '600',
            textTransform: 'uppercase',
            letterSpacing: '0.06em'
          }}>
            On-Demand Service & Real-Time Dispatch
          </p>
        </div>

        {/* Card */}
        <div className="glass-panel" style={{
          borderRadius: '24px',
          padding: '32px 28px',
          background: 'var(--bg-card)',
          border: '1px solid var(--border-color)',
          boxShadow: 'var(--shadow-xl)'
        }}>

          {/* Mode Switch Tabs */}
          {mode !== 'otp' && (
            <div style={{
              display: 'flex',
              gap: '6px',
              padding: '4px',
              borderRadius: '14px',
              background: 'var(--bg-subtle)',
              border: '1px solid var(--border-color)',
              marginBottom: '26px'
            }}>
              <button
                type="button"
                onClick={() => { setMode('login'); setError(''); setSuccessMsg(''); }}
                style={{
                  flex: 1,
                  padding: '10px 12px',
                  borderRadius: '10px',
                  border: 'none',
                  cursor: 'pointer',
                  fontSize: '0.88rem',
                  fontWeight: '700',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  gap: '8px',
                  transition: 'all 0.2s',
                  background: mode === 'login' ? 'var(--bg-card)' : 'transparent',
                  color: mode === 'login' ? 'var(--accent-primary)' : 'var(--text-muted)',
                  boxShadow: mode === 'login' ? 'var(--shadow-sm)' : 'none'
                }}
              >
                <LogIn size={16} /> Sign In
              </button>
              <button
                type="button"
                onClick={() => { setMode('register'); setError(''); setSuccessMsg(''); }}
                style={{
                  flex: 1,
                  padding: '10px 12px',
                  borderRadius: '10px',
                  border: 'none',
                  cursor: 'pointer',
                  fontSize: '0.88rem',
                  fontWeight: '700',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  gap: '8px',
                  transition: 'all 0.2s',
                  background: mode === 'register' ? 'var(--bg-card)' : 'transparent',
                  color: mode === 'register' ? 'var(--accent-primary)' : 'var(--text-muted)',
                  boxShadow: mode === 'register' ? 'var(--shadow-sm)' : 'none'
                }}
              >
                <UserPlus size={16} /> Register
              </button>
            </div>
          )}

          {/* Alerts */}
          {error && (
            <div style={{
              background: 'var(--danger-light)',
              border: '1px solid rgba(239, 68, 68, 0.25)',
              borderRadius: '12px',
              padding: '12px 14px',
              marginBottom: '20px',
              color: 'var(--danger)',
              fontSize: '0.85rem',
              fontWeight: '600'
            }}>
              ⚠ {error}
            </div>
          )}

          {successMsg && (
            <div style={{
              background: 'var(--success-light)',
              border: '1px solid rgba(16, 185, 129, 0.25)',
              borderRadius: '12px',
              padding: '12px 14px',
              marginBottom: '20px',
              color: 'var(--success)',
              fontSize: '0.85rem',
              fontWeight: '600'
            }}>
              ✓ {successMsg}
            </div>
          )}

          {/* LOGIN FORM */}
          {mode === 'login' && (
            <form onSubmit={handleLogin}>
              <div style={{ marginBottom: '22px' }}>
                <h2 style={{ color: 'var(--text-primary)', fontSize: '1.35rem', fontWeight: '800', marginBottom: '6px' }}>
                  Welcome back
                </h2>
                <p style={{ color: 'var(--text-muted)', fontSize: '0.86rem' }}>
                  Enter your credentials to access your dashboard.
                </p>
              </div>

              <div className="form-group" style={{ marginBottom: '16px' }}>
                <label className="form-label">Email or Mobile Number</label>
                <div style={{ position: 'relative' }}>
                  <Mail size={18} style={{ position: 'absolute', left: '14px', top: '50%', transform: 'translateY(-50%)', color: 'var(--text-muted)' }} />
                  <input
                    type="text"
                    value={loginForm.identifier}
                    onChange={e => setLoginForm({ ...loginForm, identifier: e.target.value })}
                    required
                    placeholder="e.g. user@example.com or 9876543210"
                    className="form-input"
                    style={{ paddingLeft: '44px' }}
                  />
                </div>
              </div>

              <div className="form-group" style={{ marginBottom: '20px' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <label className="form-label" style={{ margin: 0 }}>Password</label>
                  <button
                    type="button"
                    onClick={() => { setMode('forgot'); setError(''); setSuccessMsg(''); }}
                    style={{ background: 'none', border: 'none', color: 'var(--accent-primary)', fontSize: '0.78rem', fontWeight: '700', cursor: 'pointer' }}
                  >
                    Forgot Password?
                  </button>
                </div>
                <div style={{ position: 'relative' }}>
                  <Lock size={18} style={{ position: 'absolute', left: '14px', top: '50%', transform: 'translateY(-50%)', color: 'var(--text-muted)' }} />
                  <input
                    type={showPassword ? 'text' : 'password'}
                    value={loginForm.password}
                    onChange={e => setLoginForm({ ...loginForm, password: e.target.value })}
                    required
                    placeholder="Enter your password"
                    className="form-input"
                    style={{ paddingLeft: '44px', paddingRight: '44px' }}
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword(!showPassword)}
                    style={{ position: 'absolute', right: '14px', top: '50%', transform: 'translateY(-50%)', background: 'none', border: 'none', color: 'var(--text-muted)', cursor: 'pointer' }}
                  >
                    {showPassword ? <EyeOff size={18} /> : <Eye size={18} />}
                  </button>
                </div>
              </div>

              <button
                type="submit"
                disabled={loading}
                className="btn btn-customer"
                style={{ width: '100%', padding: '14px', fontSize: '0.95rem', fontWeight: '800' }}
              >
                {loading ? <Loader2 size={18} className="animate-spin" /> : <><LogIn size={18} /> Sign In</>}
              </button>
            </form>
          )}

          {/* REGISTER FORM */}
          {mode === 'register' && (
            <form onSubmit={handleRegister}>
              <div style={{ marginBottom: '18px' }}>
                <h2 style={{ color: 'var(--text-primary)', fontSize: '1.35rem', fontWeight: '800', marginBottom: '4px' }}>
                  Create Account
                </h2>
                <p style={{ color: 'var(--text-muted)', fontSize: '0.85rem' }}>
                  Join WorkNest as a customer or service technician.
                </p>
              </div>

              {/* Role Toggle */}
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '8px', marginBottom: '18px' }}>
                {[
                  { role: 'CUSTOMER', label: 'I need services', icon: '👤' },
                  { role: 'WORKER', label: 'I provide repairs', icon: '🛠️' }
                ].map(r => (
                  <button
                    key={r.role}
                    type="button"
                    onClick={() => setForm({ ...form, role: r.role })}
                    style={{
                      padding: '12px 10px',
                      borderRadius: '12px',
                      cursor: 'pointer',
                      textAlign: 'center',
                      transition: 'all 0.2s',
                      border: form.role === r.role ? '2px solid var(--accent-primary)' : '1px solid var(--border-color)',
                      background: form.role === r.role ? 'var(--accent-primary-light)' : 'var(--bg-subtle)',
                      color: form.role === r.role ? 'var(--accent-primary)' : 'var(--text-muted)'
                    }}
                  >
                    <div style={{ fontSize: '1.2rem', marginBottom: '2px' }}>{r.icon}</div>
                    <div style={{ fontWeight: '800', fontSize: '0.85rem' }}>{r.role}</div>
                    <div style={{ fontSize: '0.7rem', opacity: 0.85 }}>{r.label}</div>
                  </button>
                ))}
              </div>

              {form.role === 'WORKER' && (
                <div className="form-group" style={{ marginBottom: '14px' }}>
                  <label className="form-label">Service Specialty</label>
                  <select
                    value={form.profession}
                    onChange={e => setForm({ ...form, profession: e.target.value })}
                    className="form-input"
                  >
                    {['Electrician', 'RO Fitter', 'Plumber', 'Carpenter'].map(cat => (
                      <option key={cat} value={cat}>{cat}</option>
                    ))}
                  </select>
                </div>
              )}

              {[
                { key: 'name', label: 'Full Name', icon: <User size={18} />, type: 'text', placeholder: 'e.g. John Doe' },
                { key: 'mobile', label: 'Mobile Number (10 digits)', icon: <Phone size={18} />, type: 'tel', placeholder: '9876543210' },
                { key: 'email', label: 'Email Address', icon: <Mail size={18} />, type: 'email', placeholder: 'you@example.com' },
              ].map(f => (
                <div key={f.key} className="form-group" style={{ marginBottom: '14px' }}>
                  <label className="form-label">{f.label}</label>
                  <div style={{ position: 'relative' }}>
                    <span style={{ position: 'absolute', left: '14px', top: '50%', transform: 'translateY(-50%)', color: 'var(--text-muted)' }}>{f.icon}</span>
                    <input 
                      type={f.type} 
                      value={form[f.key]} 
                      onChange={e => setForm({ ...form, [f.key]: e.target.value })} 
                      required
                      placeholder={f.placeholder} 
                      className="form-input"
                      style={{ paddingLeft: '44px' }} 
                      pattern={f.key === 'mobile' ? '^[6-9]\\d{9}$' : undefined}
                      title={f.key === 'mobile' ? 'Must be 10 digits starting with 6, 7, 8, or 9' : undefined}
                    />
                  </div>
                </div>
              ))}

              <div className="form-group" style={{ marginBottom: '14px' }}>
                <label className="form-label">
                  {form.role === 'WORKER' ? 'Profile Photo (Required for Pros)' : 'Profile Photo (Optional)'}
                </label>
                <input 
                  type="file" 
                  accept="image/*" 
                  className="form-input"
                  style={{ padding: '8px 12px' }}
                  onChange={async (e) => {
                    const file = e.target.files[0];
                    if (!file) return;
                    setLoading(true);
                    try {
                      const formData = new FormData();
                      formData.append('file', file);
                      const res = await fetch(apiUrl('/api/upload'), { method: 'POST', body: formData });
                      const data = await res.json();
                      if(res.ok) {
                        setForm(prev => ({ ...prev, profilePhoto: data.url }));
                      } else {
                        alert(data.error);
                      }
                    } catch(err) {
                      console.error(err);
                    }
                    setLoading(false);
                  }} 
                  required={form.role === 'WORKER' && !form.profilePhoto} 
                />
                {form.profilePhoto && (
                  <div style={{ marginTop: '6px', fontSize: '0.8rem', color: 'var(--success)', fontWeight: '700' }}>
                    ✓ Photo uploaded successfully
                  </div>
                )}
              </div>

              <div className="form-group" style={{ marginBottom: '22px' }}>
                <label className="form-label">Password</label>
                <div style={{ position: 'relative' }}>
                  <Lock size={18} style={{ position: 'absolute', left: '14px', top: '50%', transform: 'translateY(-50%)', color: 'var(--text-muted)' }} />
                  <input 
                    type={showPassword ? 'text' : 'password'} 
                    value={form.password} 
                    onChange={e => setForm({ ...form, password: e.target.value })} 
                    required
                    placeholder="6-10 chars, uppercase, number & symbol" 
                    className="form-input"
                    style={{ paddingLeft: '44px', paddingRight: '44px' }} 
                    pattern="^(?=.*[A-Z])(?=.*[a-z])(?=.*\d)(?=.*[@$!%*?&])[A-Za-z\d@$!%*?&]{6,10}$"
                    title="6 to 10 chars, at least one uppercase, lowercase, number, and special char (@$!%*?&)"
                  />
                  <button 
                    type="button" 
                    onClick={() => setShowPassword(!showPassword)} 
                    style={{ position: 'absolute', right: '14px', top: '50%', transform: 'translateY(-50%)', background: 'none', border: 'none', color: 'var(--text-muted)', cursor: 'pointer' }}
                  >
                    {showPassword ? <EyeOff size={18} /> : <Eye size={18} />}
                  </button>
                </div>
              </div>

              <button 
                type="submit" 
                disabled={loading} 
                className={`btn ${form.role === 'WORKER' ? 'btn-worker' : 'btn-customer'}`}
                style={{ width: '100%', padding: '14px', fontSize: '0.95rem', fontWeight: '800' }}
              >
                {loading ? <Loader2 size={18} className="animate-spin" /> : <><UserPlus size={18} /> Register & Get OTP</>}
              </button>
            </form>
          )}

          {/* OTP VERIFICATION */}
          {mode === 'otp' && (
            <form onSubmit={handleVerifyOtp}>
              <div style={{ textAlign: 'center', marginBottom: '20px' }}>
                <div style={{
                  width: '50px',
                  height: '50px',
                  borderRadius: '50%',
                  background: 'var(--accent-primary-light)',
                  color: 'var(--accent-primary)',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  margin: '0 auto 12px'
                }}>
                  <ShieldCheck size={28} />
                </div>
                <h2 style={{ color: 'var(--text-primary)', fontSize: '1.35rem', fontWeight: '800', marginBottom: '4px' }}>
                  Verify Email OTP
                </h2>
                <p style={{ color: 'var(--text-muted)', fontSize: '0.85rem' }}>
                  Enter the 6-digit verification code sent to <br />
                  <b style={{ color: 'var(--accent-primary)' }}>{form.email}</b>
                </p>
              </div>

              <div style={{ marginBottom: '24px' }}>
                <input 
                  type="text" 
                  value={otpCode} 
                  onChange={e => setOtpCode(e.target.value.replace(/\D/g, '').slice(0, 6))} 
                  required 
                  maxLength={6}
                  placeholder="000000" 
                  className="form-input"
                  style={{
                    textAlign: 'center',
                    fontSize: '1.8rem',
                    fontWeight: '900',
                    letterSpacing: '0.4em',
                    padding: '14px'
                  }} 
                />
              </div>

              <button 
                type="submit" 
                disabled={loading || otpCode.length !== 6} 
                className="btn btn-customer"
                style={{ width: '100%', padding: '14px', fontSize: '0.95rem', fontWeight: '800' }}
              >
                {loading ? <Loader2 size={18} className="animate-spin" /> : <><CheckCircle2 size={18} /> Confirm & Activate</>}
              </button>

              <button 
                type="button" 
                onClick={() => { setMode('register'); setError(''); }}
                className="btn btn-ghost"
                style={{ width: '100%', marginTop: '10px', fontSize: '0.85rem' }}
              >
                ← Back to Registration
              </button>
            </form>
          )}

          {/* FORGOT PASSWORD */}
          {mode === 'forgot' && (
            <form onSubmit={handleForgotPassword}>
              <div style={{ marginBottom: '20px' }}>
                <h2 style={{ color: 'var(--text-primary)', fontSize: '1.35rem', fontWeight: '800', marginBottom: '6px' }}>
                  Reset Password
                </h2>
                <p style={{ color: 'var(--text-muted)', fontSize: '0.85rem' }}>
                  Enter your registered email or mobile to receive a reset code.
                </p>
              </div>

              <div className="form-group" style={{ marginBottom: '20px' }}>
                <label className="form-label">Email or Mobile Number</label>
                <div style={{ position: 'relative' }}>
                  <Mail size={18} style={{ position: 'absolute', left: '14px', top: '50%', transform: 'translateY(-50%)', color: 'var(--text-muted)' }} />
                  <input 
                    type="text" 
                    value={resetForm.identifier} 
                    onChange={e => setResetForm({ ...resetForm, identifier: e.target.value })} 
                    required
                    placeholder="Enter email or mobile" 
                    className="form-input"
                    style={{ paddingLeft: '44px' }} 
                  />
                </div>
              </div>

              <button 
                type="submit" 
                disabled={loading} 
                className="btn btn-customer"
                style={{ width: '100%', padding: '14px', fontSize: '0.95rem', fontWeight: '800' }}
              >
                {loading ? <Loader2 size={18} className="animate-spin" /> : <>Send Reset Code</>}
              </button>

              <button 
                type="button" 
                onClick={() => { setMode('login'); setError(''); }}
                className="btn btn-ghost"
                style={{ width: '100%', marginTop: '10px', fontSize: '0.85rem' }}
              >
                ← Back to Login
              </button>
            </form>
          )}

          {/* RESET PASSWORD */}
          {mode === 'reset' && (
            <form onSubmit={handleResetPassword}>
              <div style={{ marginBottom: '20px' }}>
                <h2 style={{ color: 'var(--text-primary)', fontSize: '1.35rem', fontWeight: '800', marginBottom: '6px' }}>
                  Create New Password
                </h2>
                <p style={{ color: 'var(--text-muted)', fontSize: '0.85rem' }}>
                  Enter the 6-digit OTP and choose a new password.
                </p>
              </div>

              <div className="form-group" style={{ marginBottom: '16px' }}>
                <label className="form-label">6-Digit Code</label>
                <input 
                  type="text" 
                  value={resetForm.otp} 
                  onChange={e => setResetForm({ ...resetForm, otp: e.target.value.replace(/\D/g, '').slice(0, 6) })}
                  required 
                  maxLength={6}
                  placeholder="000000" 
                  className="form-input"
                  style={{ textAlign: 'center', fontSize: '1.5rem', fontWeight: '800', letterSpacing: '0.3em' }} 
                />
              </div>

              <div className="form-group" style={{ marginBottom: '24px' }}>
                <label className="form-label">New Password</label>
                <div style={{ position: 'relative' }}>
                  <Lock size={18} style={{ position: 'absolute', left: '14px', top: '50%', transform: 'translateY(-50%)', color: 'var(--text-muted)' }} />
                  <input 
                    type={showPassword ? 'text' : 'password'} 
                    value={resetForm.newPassword} 
                    onChange={e => setResetForm({ ...resetForm, newPassword: e.target.value })} 
                    required
                    placeholder="New password" 
                    className="form-input"
                    style={{ paddingLeft: '44px', paddingRight: '44px' }} 
                  />
                  <button 
                    type="button" 
                    onClick={() => setShowPassword(!showPassword)} 
                    style={{ position: 'absolute', right: '14px', top: '50%', transform: 'translateY(-50%)', background: 'none', border: 'none', color: 'var(--text-muted)', cursor: 'pointer' }}
                  >
                    {showPassword ? <EyeOff size={18} /> : <Eye size={18} />}
                  </button>
                </div>
              </div>

              <button 
                type="submit" 
                disabled={loading || resetForm.otp.length !== 6} 
                className="btn btn-customer"
                style={{ width: '100%', padding: '14px', fontSize: '0.95rem', fontWeight: '800' }}
              >
                {loading ? <Loader2 size={18} className="animate-spin" /> : <><Lock size={18} /> Update Password</>}
              </button>
            </form>
          )}

        </div>

        {/* Footer */}
        <p style={{ textAlign: 'center', color: 'var(--text-muted)', fontSize: '0.78rem', marginTop: '20px', fontWeight: '500' }}>
          Protected by WorkNest Dispatch Security v2.0
        </p>
      </div>
    </div>
  );
}
