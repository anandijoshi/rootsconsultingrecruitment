import React from 'react';
import { Routes, Route, NavLink, Navigate } from 'react-router-dom';
import CoffeeChatLog from './components/CoffeeChatLog';
import ApplicationUpload from './components/ApplicationUpload';
import ApplicationReview from './components/ApplicationReview';
import DecisionTracker from './components/DecisionTracker';
import EmailDashboard from './components/EmailDashboard';

const NAV_ITEMS = [
  { path: '/coffee', label: '☕ Coffee Chats' },
  { path: '/upload', label: '📄 Upload Apps' },
  { path: '/review', label: '🔍 Review' },
  { path: '/decisions', label: '✅ Decisions' },
  { path: '/email', label: '✉️ Email' },
];

export default function App() {
  return (
    <div className="app">
      <header className="app-header">
        <div className="header-brand">
          <span className="brand-icon">🌱</span>
          <span className="brand-name">Roots Recruitment</span>
        </div>
        <nav className="app-nav">
          {NAV_ITEMS.map(({ path, label }) => (
            <NavLink
              key={path}
              to={path}
              className={({ isActive }) => `nav-link ${isActive ? 'active' : ''}`}
            >
              {label}
            </NavLink>
          ))}
        </nav>
      </header>
      <main className="app-main">
        <Routes>
          <Route path="/" element={<Navigate to="/coffee" replace />} />
          <Route path="/coffee" element={<CoffeeChatLog />} />
          <Route path="/upload" element={<ApplicationUpload />} />
          <Route path="/review" element={<ApplicationReview />} />
          <Route path="/decisions" element={<DecisionTracker />} />
          <Route path="/email" element={<EmailDashboard />} />
        </Routes>
      </main>
    </div>
  );
}
