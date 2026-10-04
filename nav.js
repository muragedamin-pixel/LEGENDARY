/**
 * nav.js — shared navigation logic for all EMPRESS pages
 * Include after <body> opens, before page-specific scripts.
 */

(function () {
  'use strict';

  const SERVER_URL = 'https://harmonious-flow-production-0060.up.railway.app';

  // ── THEME ──────────────────────────────────────────────────────────────────
  function initTheme() {
    const btn = document.getElementById('theme-toggle');
    if (!btn) return;
    const saved = localStorage.getItem('theme');
    const prefersDark = window.matchMedia('(prefers-color-scheme: dark)').matches;
    const isDark = saved ? saved === 'dark' : prefersDark;
    applyTheme(isDark);
    btn.addEventListener('click', () => {
      const next = !document.body.classList.contains('dark');
      applyTheme(next);
      localStorage.setItem('theme', next ? 'dark' : 'light');
    });
    // update aria
    document.body.addEventListener('classChange', updateThemeBtn);
  }

  function applyTheme(dark) {
    document.body.classList.toggle('dark', dark);
    const btn = document.getElementById('theme-toggle');
    if (btn) {
      btn.textContent = dark ? '☀️' : '🌙';
      btn.setAttribute('aria-pressed', dark);
    }
  }

  // ── HAMBURGER ──────────────────────────────────────────────────────────────
  function initHamburger() {
    const btn   = document.getElementById('hamburger');
    const links = document.getElementById('nav-links');
    if (!btn || !links) return;
    btn.addEventListener('click', () => links.classList.toggle('open'));
    // close on outside click
    document.addEventListener('click', (e) => {
      if (!links.contains(e.target) && !btn.contains(e.target)) {
        links.classList.remove('open');
      }
    });
  }

  // ── AUTH NAV ──────────────────────────────────────────────────────────────
  function initNavAuth() {
    const container = document.getElementById('nav-auth');
    if (!container) return;

    const user = safeGet('authUser');
    const page = location.pathname.split('/').pop() || 'index.html';

    if (!user) {
      container.innerHTML = `
        <a class="nav-profile-btn" href="login.html?redirect=${encodeURIComponent(page)}" title="Sign in to your account" aria-label="Sign in">
          👤
        </a>`;
      return;
    }

    const p         = safeGet('sellerProfile') || {};
    const avatarSrc = p.avatar || `https://ui-avatars.com/api/?name=${encodeURIComponent(user.name || 'U')}&background=e8a0b0&color=fff&size=36&bold=true`;
    const firstName = esc((user.name || 'User').split(' ')[0]);

    container.innerHTML = `
      <button class="nav-avatar-btn" id="nav-user-btn" onclick="window.__empressNavToggleDrop()" title="${esc(user.name || 'User')}" aria-haspopup="true" aria-expanded="false">
        <img class="nav-avatar-img" src="${esc(avatarSrc)}" alt="${firstName}" onerror="this.src='https://ui-avatars.com/api/?name=U&background=e8a0b0&color=fff&size=36&bold=true'" />
        <span class="nav-avatar-name">${firstName}</span>
        <span class="nav-avatar-caret">▾</span>
      </button>
      <div class="nav-dropdown" id="nav-dropdown" role="menu">
        <a href="profile.html" role="menuitem">👤 My Profile</a>
        <a href="dashboard.html" role="menuitem">🛍 My Dashboard</a>
        <a href="store.html?seller=${encodeURIComponent((user.email || '').toLowerCase())}" role="menuitem">🔗 My Store</a>
        <div class="dropdown-divider"></div>
        <button class="dropdown-logout" onclick="window.__empressLogout()" role="menuitem">Sign Out</button>
      </div>`;

    // close on outside click
    document.addEventListener('click', (e) => {
      const dd = document.getElementById('nav-dropdown');
      const nb = document.getElementById('nav-user-btn');
      if (dd && !dd.contains(e.target) && nb && !nb.contains(e.target)) {
        dd.classList.remove('open');
        nb.setAttribute('aria-expanded', 'false');
      }
    });
  }

  // ── GLOBAL NAV FUNCTIONS (called from inline onclick) ─────────────────────
  window.__empressNavToggleDrop = function () {
    const dd = document.getElementById('nav-dropdown');
    const nb = document.getElementById('nav-user-btn');
    if (!dd) return;
    const isOpen = dd.classList.toggle('open');
    if (nb) nb.setAttribute('aria-expanded', isOpen);
  };

  window.__empressLogout = function () {
    const token = localStorage.getItem('authToken');
    if (token) {
      fetch(`${SERVER_URL}/auth/logout`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${token}` },
      }).catch(() => {});
    }
    // track if track() is available
    if (typeof track === 'function') track('LOGOUT', 'Signed out from nav');
    localStorage.removeItem('authToken');
    localStorage.removeItem('authUser');
    window.location.href = 'index.html';
  };

  // ── HELPERS ───────────────────────────────────────────────────────────────
  function safeGet(key) {
    try { return JSON.parse(localStorage.getItem(key) || 'null'); }
    catch { return null; }
  }

  function esc(s) {
    return String(s || '').replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;');
  }

  // ── INIT ──────────────────────────────────────────────────────────────────
  document.addEventListener('DOMContentLoaded', () => {
    initTheme();
    initHamburger();
    initNavAuth();
  });

})();
