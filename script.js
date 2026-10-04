// ── SAFE HELPERS ─────────────────────────────────────────────────────────────
function readStorage(key, fallback) {
  try {
    const value = localStorage.getItem(key);
    return value === null ? fallback : JSON.parse(value);
  } catch (_) { return fallback; }
}

function escapeHtml(value) {
  return String(value ?? '')
    .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;').replace(/'/g, '&#039;');
}

function safeImageUrl(value) {
  const url = String(value || '').trim();
  return /^(https?:|data:image\/|\/|\.\/|\.\.\/)/i.test(url) ? url : '';
}

// ── THEME TOGGLE ─────────────────────────────────────────────────────────────
const themeBtn = document.getElementById('theme-toggle');
function applyTheme(dark) {
  document.body.classList.toggle('dark', dark);
  if (!themeBtn) return;
  themeBtn.textContent = dark ? '☀️' : '🌙';
  themeBtn.setAttribute('aria-pressed', String(dark));
  themeBtn.setAttribute('aria-label', dark ? 'Switch to light mode' : 'Switch to dark mode');
}
if (themeBtn) {
  const savedTheme = localStorage.getItem('theme');
  const prefersDark = window.matchMedia?.('(prefers-color-scheme: dark)').matches;
  applyTheme(savedTheme ? savedTheme === 'dark' : Boolean(prefersDark));
  themeBtn.addEventListener('click', () => {
    const dark = !document.body.classList.contains('dark');
    applyTheme(dark);
    localStorage.setItem('theme', dark ? 'dark' : 'light');
  });
}

// ── SELLER LISTINGS ──────────────────────────────────────────────────────────
const productGrid = document.getElementById('products');
const categoryLabels = { bags: 'Handbag', shoes: 'Shoes', clothing: 'Clothing' };
const categoryIcons = { bags: '👜', shoes: '👠', clothing: '👗' };
const sellerListings = readStorage('sellerListings', []);
if (productGrid && Array.isArray(sellerListings)) {
  sellerListings.forEach(item => {
    const card = document.createElement('div');
    const cat = String(item?.cat || '');
    const name = escapeHtml(item?.name || '');
    const price = escapeHtml(item?.priceLabel || '');
    const image = safeImageUrl(item?.img);
    card.className = 'product-card hidden';
    card.dataset.cat = cat;
    card.dataset.sellerItem = 'true';
    card.innerHTML = `<span class="badge">New</span><div class="product-img">${image ? `<img src="${image}" alt="${name}">` : `<span style="font-size:3rem">${categoryIcons[cat] || '🛍'}</span>`}<div class="overlay"><button class="quick-add">Quick Add</button></div></div><span class="product-tag">${escapeHtml(categoryLabels[cat] || cat)}</span><h4>${name}</h4><strong>${price}</strong>`;
    productGrid.appendChild(card);
  });
}

// ── HERO SLIDESHOW ───────────────────────────────────────────────────────────
const slides = [...document.querySelectorAll('.hero-slideshow .slide')];
let currentSlide = 0;
if (slides.length > 1) setInterval(() => {
  slides[currentSlide].classList.remove('active');
  slides[currentSlide].classList.add('exit');
  const previous = currentSlide;
  setTimeout(() => slides[previous]?.classList.remove('exit'), 900);
  currentSlide = (currentSlide + 1) % slides.length;
  slides[currentSlide].classList.add('active');
}, 5000);

// ── NAVIGATION AND FILTERS ───────────────────────────────────────────────────
const hamburger = document.getElementById('hamburger');
const navLinks = document.getElementById('nav-links');
hamburger?.addEventListener('click', () => navLinks?.classList.toggle('open'));
const tabs = [...document.querySelectorAll('.tab')];
const products = [...document.querySelectorAll('.product-card')];
const collection = document.getElementById('collection');

function addToCart(name, price, img) {
  cart.push({ name: String(name || ''), price: String(price || ''), img: safeImageUrl(img) });
  renderCart();
  openCart();
  track('ADD_TO_CART', `${name} | ${price}`);
}
function applyFilter(filter) {
  products.forEach(card => card.classList.toggle('hidden', card.dataset.cat !== filter));
  tabs.forEach(tab => tab.classList.toggle('active', tab.dataset.filter === filter));
  collection?.scrollIntoView({ behavior: 'smooth' });
  document.querySelectorAll('.product-card:not(.hidden) .quick-add').forEach(button => {
    button.onclick = event => {
      event.stopPropagation();
      const card = button.closest('.product-card');
      addToCart(card?.querySelector('h4')?.textContent, card?.querySelector('strong')?.textContent, card?.querySelector('img')?.src);
      button.textContent = '✓ Added!';
      setTimeout(() => { button.textContent = 'Quick Add'; }, 1200);
    };
  });
}
products.forEach(card => card.classList.add('hidden'));
document.querySelectorAll('.cat-card').forEach(card => card.addEventListener('click', () => {
  const heading = card.querySelector('h3')?.textContent.trim().toLowerCase();
  applyFilter({ handbags: 'bags', shoes: 'shoes', clothing: 'clothing' }[heading] || heading);
}));
tabs.forEach(tab => tab.addEventListener('click', () => applyFilter(tab.dataset.filter)));
products.forEach(card => card.addEventListener('click', event => {
  if (event.target.closest('.quick-add')) return;
  const name = card.querySelector('h4')?.textContent || '';
  const price = card.querySelector('strong')?.textContent || '';
  const img = card.querySelector('img')?.src || '';
  if (card.dataset.sellerItem === 'true') addToCart(name, price, img);
  else if (card.dataset.cat === 'bags' || card.dataset.cat === 'shoes') window.location.href = `product.html?img=${encodeURIComponent(img)}&name=${encodeURIComponent(name)}&price=${encodeURIComponent(price)}`;
}));

// ── CART ─────────────────────────────────────────────────────────────────────
const cart = [];
function openCart() { document.getElementById('cart-drawer')?.classList.add('open'); document.getElementById('cart-overlay')?.classList.add('open'); }
function closeCart() { document.getElementById('cart-drawer')?.classList.remove('open'); document.getElementById('cart-overlay')?.classList.remove('open'); }
document.getElementById('cart-icon')?.addEventListener('click', openCart);
document.getElementById('cart-close')?.addEventListener('click', closeCart);
document.getElementById('cart-overlay')?.addEventListener('click', closeCart);
function renderCart() {
  const items = document.getElementById('cart-items');
  const count = document.getElementById('cart-count');
  const total = document.getElementById('cart-total');
  const footer = document.getElementById('cart-footer');
  if (!items || !count || !total || !footer) return;
  count.textContent = cart.length;
  footer.style.display = cart.length ? 'block' : 'none';
  items.innerHTML = cart.length ? cart.map((item, index) => `<div class="cart-item"><img src="${item.img}" alt="${escapeHtml(item.name)}"><div class="cart-item-info"><h4>${escapeHtml(item.name)}</h4><span>${escapeHtml(item.price)}</span></div><button class="cart-item-remove" onclick="removeFromCart(${index})">✕</button></div>`).join('') : '<p class="cart-empty">Your cart is empty.</p>';
  total.textContent = 'Ksh ' + cart.reduce((sum, item) => sum + (parseInt(item.price.replace(/[^0-9]/g, ''), 10) || 0), 0).toLocaleString();
}
function removeFromCart(index) { cart.splice(index, 1); renderCart(); }
function openPayModal() { if (!cart.length) return; const modal = document.getElementById('pay-modal'); if (modal) { document.getElementById('pay-modal-total').textContent = document.getElementById('cart-total')?.textContent || ''; modal.classList.add('open'); } }
function closePayModal() { document.getElementById('pay-modal')?.classList.remove('open'); ['mpesa','visa','paypal','equity'].forEach(method => document.getElementById('pay-' + method)?.classList.remove('open')); }
function openShipping(event) { event.preventDefault(); document.getElementById('shipping-modal')?.classList.add('open'); }
function togglePayInput(method) { ['mpesa','visa','paypal','equity'].forEach(item => document.getElementById('pay-' + item)?.classList.toggle('open', item === method)); }

// ── PAYMENT AND RATING ───────────────────────────────────────────────────────
const SERVER_URL = 'https://harmonious-flow-production-0060.up.railway.app';

// ── ACTIVITY TRACKER ─────────────────────────────────────────────────────────
function track(action, detail = '') {
  const token = localStorage.getItem('authToken');
  fetch(`${SERVER_URL}/activity`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
    },
    body: JSON.stringify({ action, detail }),
  }).catch(() => {});
}
// Track page view
track('PAGE_VIEW', 'index.html');

async function initiateMpesaPayment() {
  const phone = document.querySelector('#pay-mpesa input[type="tel"]')?.value.trim();
  const button = document.querySelector('#pay-mpesa .confirm-pay');
  if (!phone || !button) { alert('Please enter your M-Pesa phone number.'); return; }
  const original = button.textContent;
  button.disabled = true; button.textContent = 'Sending…';
  try {
    const response = await fetch(`${SERVER_URL}/stk-push`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ phone, amount: (document.getElementById('cart-total')?.textContent || '').replace(/[^0-9]/g, ''), itemName: cart.length === 1 ? cart[0].name : 'EMPRESS Order' }) });
    const data = await response.json();
    if (!data.success) throw new Error(data.message || 'Payment failed');
    button.textContent = 'Check your phone…';
    pollPaymentStatus(data.checkoutRequestId, button, original);
  } catch (error) { alert(error.message || 'Could not reach payment server. Please try again.'); button.disabled = false; button.textContent = original; }
}
function pollPaymentStatus(requestId, button, original) {
  let attempts = 0;
  const timer = setInterval(async () => {
    try {
      const data = await (await fetch(`${SERVER_URL}/status/${encodeURIComponent(requestId)}`)).json();
      if (data.status === 'success' || data.status === 'failed' || ++attempts >= 30) {
        clearInterval(timer); button.disabled = false; button.textContent = original;
        if (data.status === 'success') { closePayModal(); setTimeout(() => document.getElementById('rating-modal')?.classList.add('open'), 400); }
        else if (data.status === 'failed') alert(`Payment failed: ${data.message || 'Please try again.'}`);
        else alert('Payment timed out. If you completed the payment, we will confirm shortly.');
      }
    } catch (_) { if (++attempts >= 30) { clearInterval(timer); button.disabled = false; button.textContent = original; } }
  }, 3000);
}
function confirmPay(method) { if (method === 'M-Pesa') return initiateMpesaPayment(); closePayModal(); setTimeout(() => document.getElementById('rating-modal')?.classList.add('open'), 400); }
let selectedRating = 0;
document.querySelectorAll('.star').forEach(star => {
  star.addEventListener('mouseover', () => document.querySelectorAll('.star').forEach(item => item.classList.toggle('on', Number(item.dataset.v) <= Number(star.dataset.v))));
  star.addEventListener('mouseleave', () => document.querySelectorAll('.star').forEach(item => item.classList.toggle('on', Number(item.dataset.v) <= selectedRating)));
  star.addEventListener('click', () => { selectedRating = Number(star.dataset.v); star.dispatchEvent(new MouseEvent('mouseleave')); });
});
function submitRating() { if (!selectedRating) return alert('Please select a star rating.'); document.getElementById('rating-thanks')?.style.setProperty('display', 'block'); document.querySelector('#rating-modal .btn-primary')?.style.setProperty('display', 'none'); setTimeout(() => document.getElementById('rating-modal')?.classList.remove('open'), 2000); }

document.getElementById('newsletter-form')?.addEventListener('submit', event => { event.preventDefault(); event.target.style.display = 'none'; const message = document.getElementById('newsletter-msg'); if (message) { message.textContent = "🎉 You're on the list! Welcome to the EMPRESS family."; message.style.fontSize = '1.1rem'; } });

// ── NAV AUTH ─────────────────────────────────────────────────────────────────
(function initNavAuth() {
  const container = document.getElementById('nav-auth');
  if (!container) return;
  const user = readStorage('authUser', null);
  if (!user) { container.innerHTML = '<a class="nav-profile-btn" href="login.html?redirect=profile.html" title="Sign in to your account">👤</a>'; return; }
  const profile = readStorage('sellerProfile', {});
  const name = String(user.name || 'User');
  const firstName = name.split(' ')[0];
  const avatar = safeImageUrl(profile?.avatar) || `https://ui-avatars.com/api/?name=${encodeURIComponent(name)}&background=e8a0b0&color=fff&size=36&bold=true`;
  container.innerHTML = `<button class="nav-avatar-btn" id="nav-user-btn" onclick="toggleAuthDropdown()" title="${escapeHtml(name)}"><img class="nav-avatar-img" src="${avatar}" alt="${escapeHtml(firstName)}"><span class="nav-avatar-name">${escapeHtml(firstName)}</span><span class="nav-avatar-caret">▾</span></button><div class="nav-dropdown" id="nav-dropdown"><a href="profile.html">👤 My Profile</a><a href="dashboard.html">🛍 My Dashboard</a><div class="dropdown-divider"></div><button class="dropdown-logout" onclick="logOut()">Sign Out</button></div>`;
  document.addEventListener('click', event => { const dropdown = document.getElementById('nav-dropdown'); const button = document.getElementById('nav-user-btn'); if (dropdown && button && !dropdown.contains(event.target) && !button.contains(event.target)) dropdown.classList.remove('open'); });
})();
function toggleAuthDropdown() { document.getElementById('nav-dropdown')?.classList.toggle('open'); }
function logOut() {
  const token = localStorage.getItem('authToken');
  if (token) {
    fetch(`${SERVER_URL}/auth/logout`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${token}` },
    }).catch(() => {});
  }
  track('LOGOUT', 'Signed out from nav');
  localStorage.removeItem('authToken');
  localStorage.removeItem('authUser');
  window.location.reload();
}

if ('IntersectionObserver' in window) {
  const observer = new IntersectionObserver(entries => entries.forEach(entry => { if (entry.isIntersecting) { entry.target.style.opacity = '1'; entry.target.style.transform = 'translateY(0)'; } }), { threshold: 0.1 });
  document.querySelectorAll('.cat-card, .product-card, .stat, .tcard').forEach(element => { element.style.opacity = '0'; element.style.transform = 'translateY(20px)'; element.style.transition = 'opacity .5s ease, transform .5s ease'; observer.observe(element); });
}
