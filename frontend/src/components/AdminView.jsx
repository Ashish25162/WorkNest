import React, { useState, useEffect } from 'react';
import { Settings, Shield, Award, Landmark, FileText, TrendingUp, Users, Sparkles, CheckCircle2 } from 'lucide-react';
import { apiUrl } from '../utils/api';

export default function AdminView({ refreshTrigger }) {
  const [stats, setStats] = useState({
    totalRevenue: 0.0,
    totalCommission: 0.0,
    completedBookings: 0,
    activeBookings: 0,
    totalWorkers: 0,
    commissionPercentage: 10.0
  });
  const [transactions, setTransactions] = useState([]);
  const [commissionInput, setCommissionInput] = useState(10.0);
  const [updating, setUpdating] = useState(false);

  // Fetch admin data
  const fetchAdminData = async () => {
    try {
      const statsRes = await fetch(apiUrl('/api/admin/stats'));
      if (statsRes.ok) {
        const statsData = await statsRes.json();
        setStats(statsData);
        setCommissionInput(statsData.commissionPercentage);
      }

      const txRes = await fetch(apiUrl('/api/admin/transactions'));
      if (txRes.ok) {
        const txData = await txRes.json();
        setTransactions(txData.reverse()); // Show newest first
      }
    } catch (err) {
      console.error('Error fetching admin stats:', err);
    }
  };

  useEffect(() => {
    fetchAdminData();
  }, [refreshTrigger]);

  // Update commission percentage on server
  const handleUpdateCommission = async (val) => {
    setCommissionInput(val);
    setUpdating(true);
    try {
      const response = await fetch(apiUrl(`/api/admin/commission?percentage=${val}`), {
        method: 'PUT'
      });
      if (response.ok) {
        fetchAdminData();
      }
    } catch (err) {
      console.error(err);
    } finally {
      setUpdating(false);
    }
  };

  return (
    <div style={{
      display: 'flex',
      flexDirection: 'column',
      gap: '24px',
      height: '100%',
      maxWidth: '1200px',
      margin: '0 auto',
      width: '100%'
    }}>
      
      {/* Commission Configuration Card */}
      <div className="glass-panel" style={{
        padding: '24px',
        borderRadius: '20px',
        background: 'var(--bg-card)',
        border: '1px solid var(--border-color)',
        boxShadow: 'var(--shadow-sm)'
      }}>
        <div style={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          borderBottom: '1px solid var(--border-color)',
          paddingBottom: '14px',
          marginBottom: '18px'
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
            <div style={{
              width: '36px',
              height: '36px',
              borderRadius: '10px',
              background: 'var(--accent-admin-light)',
              color: 'var(--accent-admin)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center'
            }}>
              <Settings size={20} />
            </div>
            <div>
              <h3 style={{ fontSize: '1.15rem', fontWeight: '800', margin: 0, color: 'var(--text-primary)' }}>
                Marketplace Take-Rate Settings
              </h3>
              <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>
                Platform fee automatically deducted upon job completion
              </span>
            </div>
          </div>
          <span style={{ fontSize: '1.35rem', fontWeight: '900', color: 'var(--accent-admin)' }}>
            {commissionInput}%
          </span>
        </div>

        <div className="form-group" style={{ marginBottom: 0 }}>
          <input 
            type="range" 
            min="0" 
            max="30" 
            step="1" 
            value={commissionInput} 
            onChange={(e) => handleUpdateCommission(parseFloat(e.target.value))}
            style={{ 
              width: '100%', 
              accentColor: 'var(--accent-admin)',
              borderRadius: '8px',
              height: '8px',
              outline: 'none',
              cursor: 'pointer'
            }}
            disabled={updating}
          />
          
          {/* Preset Buttons */}
          <div style={{ display: 'flex', gap: '8px', marginTop: '14px' }}>
            {[2, 5, 10, 15, 20].map(val => (
              <button
                key={val}
                type="button"
                onClick={() => handleUpdateCommission(val)}
                style={{
                  flex: 1,
                  padding: '8px 0',
                  borderRadius: '10px',
                  fontSize: '0.82rem',
                  fontWeight: '800',
                  cursor: 'pointer',
                  border: stats.commissionPercentage === val ? '2px solid var(--accent-admin)' : '1px solid var(--border-color)',
                  backgroundColor: stats.commissionPercentage === val ? 'var(--accent-admin-light)' : 'var(--bg-subtle)',
                  color: stats.commissionPercentage === val ? 'var(--accent-admin)' : 'var(--text-secondary)',
                  transition: 'all 0.2s'
                }}
              >
                {val}%
              </button>
            ))}
          </div>
          <span style={{ fontSize: '0.74rem', color: 'var(--text-muted)', display: 'block', marginTop: '10px' }}>
            * Updates take effect immediately for all subsequent customer-to-worker settlements.
          </span>
        </div>
      </div>

      {/* Metrics Row */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: '16px' }}>
        
        <div className="glass-panel" style={{
          padding: '20px',
          borderRadius: '18px',
          background: 'var(--bg-card)',
          border: '1px solid var(--border-color)',
          display: 'flex',
          flexDirection: 'column',
          gap: '8px'
        }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <span style={{ fontSize: '0.74rem', fontWeight: '800', color: 'var(--text-muted)', textTransform: 'uppercase' }}>
              PLATFORM COMMISSIONS
            </span>
            <Landmark size={18} color="var(--accent-admin)" />
          </div>
          <div style={{ fontSize: '1.8rem', fontWeight: '900', color: 'var(--accent-admin)' }}>
            ₹{stats.totalCommission ? stats.totalCommission.toFixed(2) : '0.00'}
          </div>
          <span style={{ fontSize: '0.74rem', color: 'var(--text-muted)' }}>Net Company Revenue</span>
        </div>

        <div className="glass-panel" style={{
          padding: '20px',
          borderRadius: '18px',
          background: 'var(--bg-card)',
          border: '1px solid var(--border-color)',
          display: 'flex',
          flexDirection: 'column',
          gap: '8px'
        }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <span style={{ fontSize: '0.74rem', fontWeight: '800', color: 'var(--text-muted)', textTransform: 'uppercase' }}>
              GROSS TRANSACTION VOLUME
            </span>
            <TrendingUp size={18} color="var(--success)" />
          </div>
          <div style={{ fontSize: '1.8rem', fontWeight: '900', color: 'var(--success)' }}>
            ₹{stats.totalRevenue ? stats.totalRevenue.toFixed(2) : '0.00'}
          </div>
          <span style={{ fontSize: '0.74rem', color: 'var(--text-muted)' }}>Total GTV Processed</span>
        </div>

        <div className="glass-panel" style={{
          padding: '20px',
          borderRadius: '18px',
          background: 'var(--bg-card)',
          border: '1px solid var(--border-color)',
          display: 'flex',
          flexDirection: 'column',
          gap: '8px'
        }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <span style={{ fontSize: '0.74rem', fontWeight: '800', color: 'var(--text-muted)', textTransform: 'uppercase' }}>
              ACTIVE JOBS
            </span>
            <Sparkles size={18} color="var(--accent-customer)" />
          </div>
          <div style={{ fontSize: '1.8rem', fontWeight: '900', color: 'var(--text-primary)' }}>
            {stats.activeBookings || 0}
          </div>
          <span style={{ fontSize: '0.74rem', color: 'var(--text-muted)' }}>Currently In-Progress</span>
        </div>

        <div className="glass-panel" style={{
          padding: '20px',
          borderRadius: '18px',
          background: 'var(--bg-card)',
          border: '1px solid var(--border-color)',
          display: 'flex',
          flexDirection: 'column',
          gap: '8px'
        }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <span style={{ fontSize: '0.74rem', fontWeight: '800', color: 'var(--text-muted)', textTransform: 'uppercase' }}>
              COMPLETED GIGS
            </span>
            <CheckCircle2 size={18} color="var(--warning)" />
          </div>
          <div style={{ fontSize: '1.8rem', fontWeight: '900', color: 'var(--text-primary)' }}>
            {stats.completedBookings || 0}
          </div>
          <span style={{ fontSize: '0.74rem', color: 'var(--text-muted)' }}>Settled Successfully</span>
        </div>
      </div>

      {/* Transactions Ledger Table */}
      <div className="glass-panel" style={{
        padding: '24px',
        borderRadius: '20px',
        background: 'var(--bg-card)',
        border: '1px solid var(--border-color)',
        boxShadow: 'var(--shadow-sm)',
        display: 'flex',
        flexDirection: 'column',
        gap: '16px',
        minHeight: '340px'
      }}>
        <div style={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          borderBottom: '1px solid var(--border-color)',
          paddingBottom: '12px'
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <FileText size={18} color="var(--accent-admin)" />
            <h4 style={{ fontSize: '1.1rem', fontWeight: '800', margin: 0, color: 'var(--text-primary)' }}>
              Live Settlement Ledger
            </h4>
          </div>
          <span style={{ fontSize: '0.78rem', color: 'var(--text-muted)' }}>
            Real-time audit trail
          </span>
        </div>

        <div style={{ overflowX: 'auto' }}>
          {transactions.length === 0 ? (
            <div style={{ color: 'var(--text-muted)', fontSize: '0.88rem', textAlign: 'center', padding: '48px 0' }}>
              No completed transactions recorded yet. Book a service and complete work to view ledger items.
            </div>
          ) : (
            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.85rem', textAlign: 'left' }}>
              <thead>
                <tr style={{ borderBottom: '1px solid var(--border-color)', color: 'var(--text-muted)' }}>
                  <th style={{ padding: '10px 8px' }}>Client / Provider</th>
                  <th style={{ padding: '10px 8px' }}>Description</th>
                  <th style={{ padding: '10px 8px' }}>Total Amount</th>
                  <th style={{ padding: '10px 8px' }}>Take-Rate</th>
                  <th style={{ padding: '10px 8px', textAlign: 'right' }}>Status</th>
                </tr>
              </thead>
              <tbody>
                {transactions.map(tx => (
                  <tr key={tx.id} style={{ borderBottom: '1px solid var(--border-color)' }}>
                    <td style={{ padding: '12px 8px' }}>
                      <div style={{ fontWeight: '700', color: 'var(--text-primary)' }}>
                        {tx.customerName} → {tx.workerName.split(' (')[0]}
                      </div>
                      <div style={{ fontSize: '0.72rem', color: 'var(--text-muted)' }}>Order #{tx.id}</div>
                    </td>
                    <td style={{ padding: '12px 8px', color: 'var(--text-secondary)' }}>
                      {tx.taskDescription}
                    </td>
                    <td style={{ padding: '12px 8px', fontWeight: '800', color: 'var(--text-primary)' }}>
                      ₹{tx.totalCost.toFixed(2)}
                    </td>
                    <td style={{ padding: '12px 8px', color: 'var(--accent-admin)', fontWeight: '800' }}>
                      ₹{tx.commissionAmount ? tx.commissionAmount.toFixed(2) : '0.00'} ({tx.commissionRate}%)
                    </td>
                    <td style={{ padding: '12px 8px', textAlign: 'right' }}>
                      <span className={`badge ${
                        tx.status === 'COMPLETED' ? 'badge-success' :
                        tx.status === 'CANCELLED' ? 'badge-danger' : 'badge-warning'
                      }`}>
                        {tx.status}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      </div>
    </div>
  );
}
