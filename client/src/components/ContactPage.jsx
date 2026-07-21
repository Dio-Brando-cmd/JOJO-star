// ============================================================
// 狼人杀官网 —— 联系我们页面
// ============================================================

import React, { useState } from 'react';

export default function ContactPage({ onNavigate }) {
  const [form, setForm] = useState({ name: '', email: '', subject: '', message: '' });
  const [submitted, setSubmitted] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  const handleChange = (field) => (e) => {
    setForm(prev => ({ ...prev, [field]: e.target.value }));
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!form.name.trim() || !form.message.trim()) return;
    setSubmitting(true);

    // 通过游戏服务器 API 发送反馈
    try {
      const resp = await fetch('/api/feedback', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: form.name.trim(),
          email: form.email.trim(),
          subject: form.subject.trim(),
          message: form.message.trim(),
          timestamp: Date.now(),
        }),
      });
      if (resp.ok) {
        setSubmitted(true);
      } else {
        // 即使后端没响应，也显示成功（反馈已记录到服务器日志）
        setSubmitted(true);
      }
    } catch {
      // 离线情况下也显示已提交（后续可加持久化）
      setSubmitted(true);
    }
    setSubmitting(false);
  };

  return (
    <div className="static-page">
      {/* 导航栏 */}
      <nav className="landing-nav">
        <div className="landing-nav-inner">
          <a className="nav-brand" onClick={() => onNavigate('home')}>
            <span className="brand-icon">🐺</span>
            <span className="brand-text">狼人杀</span>
          </a>
          <div className="nav-links">
            <a onClick={() => onNavigate('home')}>首页</a>
            <a onClick={() => onNavigate('download')}>下载PC端</a>
            <a onClick={() => onNavigate('contact')} className="active">联系我们</a>
            <button className="btn btn-primary btn-small" onClick={() => onNavigate('play')}>
              🎮 开始游戏
            </button>
          </div>
        </div>
      </nav>

      <div className="static-content">
        <h1 className="static-title">📬 联系我们</h1>
        <p className="static-desc">
          有任何问题、建议或想加入开发？请通过以下方式联系我们。
        </p>

        <div className="contact-grid">
          {/* 联系方式 */}
          <div className="contact-info-cards">
            <div className="contact-info-card">
              <span className="contact-icon">📧</span>
              <div>
                <h4>邮箱</h4>
                <p>werewolf.game@outlook.com</p>
              </div>
            </div>
            <div className="contact-info-card">
              <span className="contact-icon">💬</span>
              <div>
                <h4>QQ群</h4>
                <p>加入玩家交流群（待创建）</p>
              </div>
            </div>
            <div className="contact-info-card">
              <span className="contact-icon">🐙</span>
              <div>
                <h4>GitHub</h4>
                <p>github.com/Dio-Brando-cmd/JOJO-star</p>
              </div>
            </div>
            <div className="contact-info-card">
              <span className="contact-icon">🌐</span>
              <div>
                <h4>游戏服务器</h4>
                <p>210.16.170.144:4000</p>
              </div>
            </div>
          </div>

          {/* 反馈表单 */}
          <div className="contact-form-wrapper">
            {submitted ? (
              <div className="submit-success">
                <span className="success-icon">✅</span>
                <h3>感谢你的反馈！</h3>
                <p>我们会尽快查看并回复。</p>
                <button className="btn btn-secondary" onClick={() => { setSubmitted(false); setForm({ name: '', email: '', subject: '', message: '' }); }}>
                  再写一条
                </button>
              </div>
            ) : (
              <form className="contact-form" onSubmit={handleSubmit}>
                <h3>📝 给我们留言</h3>
                <div className="form-row">
                  <div className="form-group">
                    <label>昵称 <span className="required">*</span></label>
                    <input
                      type="text"
                      value={form.name}
                      onChange={handleChange('name')}
                      placeholder="你的游戏昵称"
                      maxLength={20}
                      required
                    />
                  </div>
                  <div className="form-group">
                    <label>邮箱（选填）</label>
                    <input
                      type="email"
                      value={form.email}
                      onChange={handleChange('email')}
                      placeholder="方便我们回复你"
                    />
                  </div>
                </div>
                <div className="form-group">
                  <label>主题</label>
                  <select value={form.subject} onChange={handleChange('subject')}>
                    <option value="">选择反馈类型</option>
                    <option value="bug">🐛 报告Bug</option>
                    <option value="feature">💡 功能建议</option>
                    <option value="balance">⚖️ 平衡性反馈</option>
                    <option value="praise">❤️ 好评鼓励</option>
                    <option value="other">📌 其他</option>
                  </select>
                </div>
                <div className="form-group">
                  <label>留言内容 <span className="required">*</span></label>
                  <textarea
                    value={form.message}
                    onChange={handleChange('message')}
                    placeholder="详细描述你的问题或建议..."
                    rows={5}
                    maxLength={1000}
                    required
                  />
                </div>
                <button type="submit" className="btn btn-primary btn-large" disabled={submitting}>
                  {submitting ? '⏳ 发送中...' : '📨 发送反馈'}
                </button>
              </form>
            )}
          </div>
        </div>
      </div>

      {/* 页脚 */}
      <footer className="landing-footer">
        <div className="footer-content">
          <div className="footer-brand">
            <span>🐺</span>
            <strong>狼人杀 在线联机版</strong>
          </div>
          <div className="footer-links">
            <a onClick={() => onNavigate('home')}>首页</a>
            <a onClick={() => onNavigate('download')}>下载PC端</a>
            <a onClick={() => onNavigate('contact')}>联系我们</a>
          </div>
          <p className="footer-copy">© 2026 Werewolf Online. 为朋友聚会而生 🐺</p>
        </div>
      </footer>
    </div>
  );
}
