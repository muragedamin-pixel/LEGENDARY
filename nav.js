/**
 * nav.js — shared navigation logic for all EMPRESS pages
 * Loaded inline in <body> right after <nav>, runs immediately (no DOMContentLoaded needed
 * because the nav elements already exist in the DOM at this point).
 */

(function () {
  'use strict';

  const SERVER_URL = 'https://harmonious-flow-production-0060.up.railway.app';

  // ── HELPERS ───────────────────────────────────────────────────────────────
  function safeGet(key) {
    try { return JSON.parse(localStorage.getItem(key) || 'null'); }
    catch { return null; }
  }

  function esc(s) {
    return String(s || '')
      .replace(/&/g,'&amp;')
      .replace(/</g,'&lt;')
      .replace(/>/g,'&gt;')
      .replace(/"/g,'&quot;');
  }

  // ── THEME ─────────────────────────────────────────────────────────────────
  function initTheme() {
    const btn = document.getElementById('theme-toggle');
    if (!btn) return;

    const saved      = localStorage.getItem('theme');
    const prefersDark = window.matchMedia
      ? window.matchMedia('(prefers-color-scheme: dark)').matches
      : false;
    const isDark = saved ? saved === 'dark' : prefersDark;

    applyTheme(isDark);

    btn.addEventListener('click', function () {
      var next = !document.body.classList.contains('dark');
      applyTheme(next);
      localStorage.setItem('theme', next ? 'dark' : 'light');
    });
  }

  function applyTheme(dark) {
    document.body.classList.toggle('dark', dark);
    var btn = document.getElementById('theme-toggle');
    if (!btn) return;
    btn.textContent = dark ? '☀️' : '🌙';
    btn.setAttribute('aria-pressed', String(dark));
  }

  // ── HAMBURGER ─────────────────────────────────────────────────────────────
  function initHamburger() {
    var btn   = document.getElementById('hamburger');
    var links = document.getElementById('nav-links');
    if (!btn || !links) return;

    btn.addEventListener('click', function (e) {
      e.stopPropagation();
      links.classList.toggle('open');
    });

    document.addEventListener('click', function (e) {
      if (!links.contains(e.target) && !btn.contains(e.target)) {
        links.classList.remove('open');
      }
    });
  }

  // ── AUTH NAV ──────────────────────────────────────────────────────────────
  function initNavAuth() {
    var container = document.getElementById('nav-auth');
    if (!container) return;

    var user = safeGet('authUser');
    var page = (location.pathname.split('/').pop() || 'index.html');

    if (!user) {
      container.innerHTML =
        '<a class="nav-profile-btn" href="login.html?redirect=' +
        encodeURIComponent(page) +
        '" title="Sign in" aria-label="Sign in">👤</a>';
      return;
    }

    var p         = safeGet('sellerProfile') || {};
    var avatarSrc = p.avatar ||
      ('https://ui-avatars.com/api/?name=' + encodeURIComponent(user.name || 'U') +
       '&background=e8a0b0&color=fff&size=36&bold=true');
    var firstName = esc((user.name || 'User').split(' ')[0]);
    var email     = esc((user.email || '').toLowerCase());

    container.innerHTML =
      '<button class="nav-avatar-btn" id="nav-user-btn"' +
        ' onclick="window.__empressNavToggleDrop()"' +
        ' title="' + esc(user.name || 'User') + '"' +
        ' aria-haspopup="true" aria-expanded="false">' +
        '<img class="nav-avatar-img" src="' + esc(avatarSrc) + '" alt="' + firstName + '"' +
          ' onerror="this.src=\'https://ui-avatars.com/api/?name=U&background=e8a0b0&color=fff&size=36&bold=true\'" />' +
        '<span class="nav-avatar-name">' + firstName + '</span>' +
        '<span class="nav-avatar-caret">▾</span>' +
      '</button>' +
      '<div class="nav-dropdown" id="nav-dropdown">' +
        '<a href="profile.html">👤 My Profile</a>' +
        '<a href="dashboard.html">🛍 My Dashboard</a>' +
        '<a href="store.html?seller=' + email + '">🔗 My Store</a>' +
        '<div class="dropdown-divider"></div>' +
        '<button class="dropdown-logout" onclick="window.__empressLogout()">Sign Out</button>' +
      '</div>';

    // close dropdown on outside click
    document.addEventListener('click', function (e) {
      var dd = document.getElementById('nav-dropdown');
      var nb = document.getElementById('nav-user-btn');
      if (dd && nb && !dd.contains(e.target) && !nb.contains(e.target)) {
        dd.classList.remove('open');
        nb.setAttribute('aria-expanded', 'false');
      }
    });
  }

  // ── GLOBAL FUNCTIONS (called from inline onclick attrs) ───────────────────
  window.__empressNavToggleDrop = function () {
    var dd = document.getElementById('nav-dropdown');
    var nb = document.getElementById('nav-user-btn');
    if (!dd) return;
    var isOpen = dd.classList.toggle('open');
    if (nb) nb.setAttribute('aria-expanded', String(isOpen));
  };

  window.__empressLogout = function () {
    var token = localStorage.getItem('authToken');
    if (token) {
      fetch(SERVER_URL + '/auth/logout', {
        method: 'POST',
        headers: { Authorization: 'Bearer ' + token },
      }).catch(function () {});
    }
    if (typeof track === 'function') track('LOGOUT', 'Signed out from nav');
    localStorage.removeItem('authToken');
    localStorage.removeItem('authUser');
    window.location.href = 'index.html';
  };

  // ── RUN IMMEDIATELY ───────────────────────────────────────────────────────
  // nav elements are already in DOM when this script runs
  initTheme();
  initHamburger();
  initNavAuth();

})();
