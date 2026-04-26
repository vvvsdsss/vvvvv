'use client';

import { useState, useRef, useEffect } from 'react';
import { Send, User, Bot, LogIn, LogOut, Zap, Crown, AlertCircle, Loader2 } from 'lucide-react';

type Message = { role: 'user' | 'assistant'; content: string };

export default function Home() {
  const [messages, setMessages] = useState<Message[]>([
    { role: 'assistant', content: '👋 你好！我是AI助手。\n\n🆓 免费用户：每日10次GPT-4o-mini对话\n👑 Pro用户：解锁GPT-4o，每月1000次额度\n\n直接输入问题开始体验。' }
  ]);
  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(false);
  const [model, setModel] = useState('gpt-4o-mini');
  const [token, setToken] = useState('');
  const [user, setUser] = useState<any>(null);
  const [showAuth, setShowAuth] = useState(false);
  const [authTab, setAuthTab] = useState<'login' | 'register'>('login');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const bottomRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const t = localStorage.getItem('ai_token');
    if (t) { setToken(t); fetchUser(t); }
  }, []);

  useEffect(() => { bottomRef.current?.scrollIntoView({ behavior: 'smooth' }); }, [messages]);

  async function fetchUser(t: string) {
    const res = await fetch('/api/user', { headers: { Authorization: `Bearer ${t}` } });
    if (res.ok) { const data = await res.json(); setUser(data); }
    else { localStorage.removeItem('ai_token'); setToken(''); }
  }

  async function handleAuth(e: React.FormEvent) {
    e.preventDefault();
    const endpoint = authTab === 'login' ? '/api/auth/login' : '/api/auth/register';
    const res = await fetch(endpoint, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email, password }),
    });
    const data = await res.json();
    if (res.ok) {
      localStorage.setItem('ai_token', data.token);
      setToken(data.token);
      setUser(data.user);
      setShowAuth(false);
      setEmail(''); setPassword('');
    } else {
      alert(data.error || '操作失败');
    }
  }

  async function handleUpgrade() {
    if (!token) return setShowAuth(true);
    const res = await fetch('/api/stripe/checkout', {
      method: 'POST',
      headers: { Authorization: `Bearer ${token}` },
    });
    const data = await res.json();
    if (data.url) window.location.href = data.url;
    else alert('支付初始化失败');
  }

  async function sendMessage() {
    if (!input.trim() || loading) return;
    if (!token) { setShowAuth(true); return; }

    const userMsg: Message = { role: 'user', content: input.trim() };
    const newMessages = [...messages, userMsg];
    setMessages(newMessages);
    setInput('');
    setLoading(true);

    try {
      const res = await fetch('/api/chat', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          messages: newMessages.map(m => ({ role: m.role, content: m.content })),
          model,
        }),
      });

      if (!res.ok) {
        const err = await res.json();
        setMessages(prev => [...prev, { role: 'assistant', content: `❌ ${err.error || '请求失败'}` }]);
        if (res.status === 401) {
          localStorage.removeItem('ai_token');
          setToken(''); setUser(null);
        }
        setLoading(false);
        return;
      }

      const reader = res.body?.getReader();
      const decoder = new TextDecoder();
      let assistantContent = '';
      
      setMessages(prev => [...prev, { role: 'assistant', content: '' }]);
      
      if (reader) {
        while (true) {
          const { done, value } = await reader.read();
          if (done) break;
          assistantContent += decoder.decode(value, { stream: true });
          setMessages(prev => {
            const updated = [...prev];
            updated[updated.length - 1] = { role: 'assistant', content: assistantContent };
            return updated;
          });
        }
      }
      
      const remaining = res.headers.get('X-Remaining-Credits');
      if (remaining && user) setUser({ ...user, credits: parseInt(remaining) });

    } catch {
      setMessages(prev => [...prev, { role: 'assistant', content: '❌ 网络错误，请刷新重试' }]);
    } finally {
      setLoading(false);
    }
  }

  const isProModel = model !== 'gpt-4o-mini';
  const canUseModel = user?.tier !== 'free' || !isProModel;

  return (
    <div className="chat-container">
      <header className="chat-header">
        <div className="header-brand">
          <div className="header-icon">
            <Bot style={{ width: 20, height: 20, color: '#34d399' }} />
          </div>
          <div>
            <div className="header-title">AI Chat Pro</div>
            <div className="header-subtitle">聚合GPT-4o · Claude · Kimi</div>
          </div>
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
          {user ? (
            <div style={{ display: 'flex', alignItems: 'center', gap: 12, fontSize: 12 }}>
              <span className={`user-badge ${user.tier === 'pro' ? 'pro' : ''}`}>
                <Crown style={{ width: 12, height: 12 }} /> {user.tier.toUpperCase()}
              </span>
              <span style={{ color: '#9ca3af' }}>剩余 {user.credits} 次</span>
              <button 
                onClick={() => { localStorage.removeItem('ai_token'); setToken(''); setUser(null); }}
                className="btn btn-ghost"
                title="退出"
              >
                <LogOut style={{ width: 16, height: 16 }} />
              </button>
            </div>
          ) : (
            <button 
              onClick={() => setShowAuth(true)}
              className="btn btn-primary"
            >
              <LogIn style={{ width: 14, height: 14 }} /> 登录 / 注册
            </button>
          )}
        </div>
      </header>

      <div className="model-bar">
        <span style={{ color: '#6b7280' }}>模型</span>
        <select 
          value={model} 
          onChange={e => setModel(e.target.value)}
          className="model-select"
        >
          <option value="gpt-4o-mini">🆓 GPT-4o Mini（免费/极速）</option>
          <option value="gpt-4o">👑 GPT-4o（Pro专属/高智商）</option>
        </select>
        
        {user?.tier === 'free' && isProModel && (
          <button 
            onClick={handleUpgrade}
            className="upgrade-link"
          >
            <Zap style={{ width: 12, height: 12 }} /> 升级Pro解锁
          </button>
        )}
      </div>

      <div className="chat-messages">
        {messages.map((m, i) => (
          <div key={i} className={`message ${m.role === 'user' ? 'user' : ''}`}>
            {m.role === 'assistant' && (
              <div className="avatar avatar-bot">
                <Bot style={{ width: 16, height: 16, color: '#34d399' }} />
              </div>
            )}
            
            <div className={`message-bubble ${m.role}`}>
              {m.content}
            </div>

            {m.role === 'user' && (
              <div className="avatar avatar-user">
                <User style={{ width: 16, height: 16, color: '#d1d5db' }} />
              </div>
            )}
          </div>
        ))}
        
        {loading && (
          <div className="message">
            <div className="avatar avatar-bot">
              <Loader2 style={{ width: 16, height: 16, color: '#34d399' }} className="loading-spinner" />
            </div>
            <div className="message-bubble assistant" style={{ color: '#9ca3af' }}>
              思考中<span style={{ animation: 'pulse 1.5s infinite' }}>...</span>
            </div>
          </div>
        )}
        <div ref={bottomRef} />
      </div>

      <div className="input-area">
        {!token && (
          <div 
            onClick={() => setShowAuth(true)}
            className="alert alert-warning"
          >
            <AlertCircle style={{ width: 16, height: 16, flexShrink: 0 }} />
            <span>请先登录。新用户注册即送每日10次免费额度。</span>
          </div>
        )}
        
        {user?.tier === 'free' && user?.credits <= 2 && user?.credits > 0 && (
          <div className="alert alert-info">
            <span>免费额度即将耗尽 ({user.credits}次剩余)</span>
            <button onClick={handleUpgrade} style={{ color: '#34d399', fontWeight: 500, background: 'none', border: 'none', cursor: 'pointer' }}>升级Pro →</button>
          </div>
        )}

        <div className="input-box">
          <input
            value={input}
            onChange={e => setInput(e.target.value)}
            onKeyDown={e => e.key === 'Enter' && !e.shiftKey && sendMessage()}
            placeholder={token ? (canUseModel ? '输入任何问题...' : '请升级以使用此模型') : '请先登录后对话'}
            disabled={!token || loading || !canUseModel}
            maxLength={4000}
            className="input-field"
          />
          <button
            onClick={sendMessage}
            disabled={!token || loading || !input.trim() || !canUseModel}
            className="send-btn"
          >
            {loading ? <Loader2 style={{ width: 20, height: 20 }} className="loading-spinner" /> : <Send style={{ width: 20, height: 20 }} />}
          </button>
        </div>
        <div className="disclaimer">
          AI生成内容仅供参考，请勿用于违法违规用途
        </div>
      </div>

      {showAuth && (
        <div className="modal-overlay">
          <div className="modal">
            <div className="modal-tabs">
              <button 
                onClick={() => setAuthTab('login')} 
                className={`modal-tab ${authTab==='login'?'active':''}`}
              >
                登录
              </button>
              <button 
                onClick={() => setAuthTab('register')} 
                className={`modal-tab ${authTab==='register'?'active':''}`}
              >
                注册领额度
              </button>
            </div>
            
            <form onSubmit={handleAuth} style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
              <div className="form-group">
                <label className="form-label">邮箱</label>
                <input 
                  type="email" 
                  required 
                  value={email} 
                  onChange={e=>setEmail(e.target.value)} 
                  className="form-input"
                  placeholder="you@example.com"
                />
              </div>
              <div className="form-group">
                <label className="form-label">密码</label>
                <input 
                  type="password" 
                  required 
                  minLength={6}
                  value={password} 
                  onChange={e=>setPassword(e.target.value)} 
                  className="form-input"
                  placeholder="至少6位字符"
                />
              </div>
              <button 
                type="submit" 
                className="btn btn-primary"
                style={{ width: '100%', padding: '10px 0' }}
              >
                {authTab === 'login' ? '立即登录' : '注册并领取10次/日免费额度'}
              </button>
            </form>
            
            <button 
              onClick={() => setShowAuth(false)} 
              style={{ marginTop: 16, width: '100%', fontSize: 12, color: '#4b5563', background: 'none', border: 'none', cursor: 'pointer' }}
            >
              暂不登录，返回体验
            </button>
          </div>
        </div>
      )}
    </div>
  );
}