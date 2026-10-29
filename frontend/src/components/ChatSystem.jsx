import React, { useState, useEffect, useRef } from 'react';
import { Send, MessageCircle, X, Loader2 } from 'lucide-react';
import { apiUrl } from '../utils/api';

export default function ChatSystem({ bookingId, senderName, senderRole, onClose, isVisible, onUnread }) {
  const [messages, setMessages] = useState([]);
  const [newMsg, setNewMsg] = useState('');
  const [sending, setSending] = useState(false);
  const chatEndRef = useRef(null);
  const containerRef = useRef(null);

  const fetchMessages = async () => {
    if (!bookingId) return;
    try {
      const res = await fetch(apiUrl(`/api/chat/${bookingId}`));
      if (res.ok) {
        const data = await res.json();
        setMessages(prev => {
          if (!isVisible && prev.length > 0 && data.length > prev.length) {
            if (onUnread) onUnread();
          }
          return data;
        });
      }
    } catch (err) { console.error('Chat poll error:', err); }
  };

  // Poll messages
  useEffect(() => {
    fetchMessages();
    const interval = setInterval(fetchMessages, 1000);
    return () => clearInterval(interval);
  }, [bookingId]);

  // Auto-scroll
  useEffect(() => {
    chatEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  const handleSend = async (e) => {
    e.preventDefault();
    if (!newMsg.trim() || sending) return;
    setSending(true);
    try {
      await fetch(apiUrl(`/api/chat/${bookingId}`), {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ senderName, senderRole, message: newMsg.trim() })
      });
      setNewMsg('');
      fetchMessages(); // Immediate refresh after send
    } catch (err) { console.error('Send error:', err); }
    setSending(false);
  };

  const recipientRole = senderRole === 'CUSTOMER' ? 'WORKER' : 'CUSTOMER';

  return (
    <div style={{
      position: 'fixed', bottom: '20px', right: '20px', width: 'min(340px, calc(100vw - 40px))', height: 'min(480px, calc(100vh - 100px))',
      display: 'flex', flexDirection: 'column', zIndex: 1000,
      background: 'var(--bg-card)', 
      borderRadius: '12px', border: '1px solid var(--border-color)',
      boxShadow: '0 10px 25px -5px rgba(0,0,0,0.1)', overflow: 'hidden'
    }}>
      {/* Header */}
      <div style={{ 
        padding: '16px', display: 'flex', justifyContent: 'space-between', alignItems: 'center',
        background: 'var(--bg-secondary)',
        borderBottom: '1px solid var(--border-color)'
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
          <div style={{ background: 'var(--accent-customer)', padding: '6px', borderRadius: '50%' }}>
            <MessageCircle size={18} color="#fff" />
          </div>
          <div style={{ display: 'flex', flexDirection: 'column' }}>
            <span className="text-primary-color" style={{ fontWeight: '600', fontSize: '0.9rem' }}>Chat Support</span>
            <span className="text-muted" style={{ fontSize: '0.7rem' }}>Connected with {recipientRole}</span>
          </div>
        </div>
        <button onClick={onClose} className="btn-secondary border-subtle" style={{ borderRadius: '8px', padding: '6px', cursor: 'pointer', display: 'flex', background: 'transparent' }}>
          <X size={18} />
        </button>
      </div>

      {/* Messages */}
      <div ref={containerRef} style={{ flex: 1, overflowY: 'auto', padding: '16px', display: 'flex', flexDirection: 'column', gap: '10px' }}>
        {messages.length === 0 && (
          <div style={{ textAlign: 'center', marginTop: '20px' }} className="text-muted">
            <MessageCircle size={32} style={{ margin: '0 auto 8px', opacity: 0.3 }} />
            <p style={{ fontSize: '0.8rem' }}>No messages yet. Say hello!</p>
          </div>
        )}
        {messages.map((msg, i) => {
          const isMine = msg.senderRole === senderRole;
          return (
            <div key={msg.id || i} style={{
              display: 'flex', flexDirection: 'column',
              alignItems: isMine ? 'flex-end' : 'flex-start',
              maxWidth: '80%', alignSelf: isMine ? 'flex-end' : 'flex-start'
            }}>
              <span className="text-muted" style={{ fontSize: '0.65rem', fontWeight: '600', marginBottom: '3px', textTransform: 'uppercase' }}>
                {isMine ? 'You' : msg.senderName}
              </span>
              <div style={{
                padding: '10px 14px', borderRadius: '14px',
                background: isMine ? 'var(--accent-customer)' : 'var(--bg-secondary)',
                color: isMine ? '#fff' : 'var(--text-primary)',
                fontSize: '0.85rem', fontWeight: '500',
                boxShadow: '0 1px 2px rgba(0,0,0,0.05)',
                borderBottomRightRadius: isMine ? '4px' : '14px',
                borderBottomLeftRadius: isMine ? '14px' : '4px'
              }}>
                {msg.message}
              </div>
              <div className="text-muted" style={{ fontSize: '0.65rem', marginTop: '4px', textAlign: isMine ? 'right' : 'left' }}>
                {new Date(msg.sentAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
              </div>
            </div>
          );
        })}
        <div ref={chatEndRef} />
      </div>

      {/* Input */}
      <form onSubmit={handleSend} style={{ 
        padding: '12px 14px', borderTop: '1px solid var(--border-color)',
        display: 'flex', gap: '8px', background: 'var(--bg-secondary)'
      }}>
        <input
          type="text"
          className="form-input"
          value={newMsg} 
          onChange={e => setNewMsg(e.target.value)}
          placeholder="Type a message..."
          style={{ 
            flex: 1, 
            border: '1px solid var(--border-color)', background: 'var(--bg-primary)',
            borderRadius: '20px', padding: '10px 16px', color: 'var(--text-primary)',
            fontSize: '0.85rem', outline: 'none'
          }}
        />
        <button
          type="submit"
          disabled={!newMsg.trim() || sending}
          style={{
            background: newMsg.trim() ? 'var(--accent-customer)' : 'var(--bg-primary)',
            color: newMsg.trim() ? '#fff' : 'var(--text-muted)',
            border: 'none', borderRadius: '50%', width: '40px', height: '40px',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            cursor: newMsg.trim() ? 'pointer' : 'not-allowed',
            transition: 'all 0.2s',
            flexShrink: 0
          }}
        >
          {sending ? <Loader2 size={18} className="animate-spin" /> : <Send size={18} />}
        </button>
      </form>
    </div>
  );
}
