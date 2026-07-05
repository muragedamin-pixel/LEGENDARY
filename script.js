// ── THEME TOGGLE ──
const themeBtn = document.getElementById('theme-toggle');
if (localStorage.getItem('theme') === 'dark') {
  document.body.classList.add('dark');
  themeBtn.textContent = '☀️';
}
themeBtn.addEventListener('click', () => {
  document.body.classList.toggle('dark');
  const isDark = document.body.classList.contains('dark');
  themeBtn.textContent = isDark ? '☀️' : '🌙';
  localStorage.setItem('theme', isDark ? 'dark' : 'light');
});

// ── HERO SLIDESHOW ──
const slides = document.querySelectorAll('.hero-slideshow .slide');
let current = 0;
setInterval(() => {
  slides[current].classList.remove('active');
  slides[current].classList.add('exit');
  const exiting = current;
  setTimeout(() => slides[exiting].classList.remove('exit'), 900);
  current = (current + 1) % slides.length;
  slides[current].classList.add('active');
}, 5000);

// Hamburger menu
const hamburger = document.getElementById('hamburger');
const navLinks = document.getElementById('nav-links');
hamburger.addEventListener('click', () => navLinks.classList.toggle('open'));

// Product filter tabs
const tabs = document.querySelectorAll('.tab');
const products = document.querySelectorAll('.product-card');
const collectionSection = document.getElementById('collection');

function applyFilter(filter) {
  products.forEach(p => p.classList.toggle('hidden', p.dataset.cat !== filter));
  tabs.forEach(t => t.classList.toggle('active', t.dataset.filter === filter));
  collectionSection.scrollIntoView({ behavior: 'smooth' });
  // wire quick-add after filter
  document.querySelectorAll('.product-card:not(.hidden) .quick-add').forEach(btn => {
    btn.onclick = (e) => {
      e.stopPropagation();
      const card = btn.closest('.product-card');
      const name = card.querySelector('h4').textContent;
      const price = card.querySelector('strong').textContent;
      const img = card.querySelector('img')?.src || '';
      addToCart(name, price, img);
      btn.textContent = '✓ Added!';
      setTimeout(() => btn.textContent = 'Quick Add', 1200);
    };
  });
}

// hide all on load
products.forEach(p => p.classList.add('hidden'));

// category card clicks
document.querySelectorAll('.cat-card').forEach(card => {
  card.addEventListener('click', () => {
    const heading = card.querySelector('h3').textContent.trim().toLowerCase();
    const map = { handbags: 'bags', shoes: 'shoes', clothing: 'clothing' };
    applyFilter(map[heading] || heading);
  });
});

// also wire the tab buttons
tabs.forEach(tab => {
  tab.addEventListener('click', () => applyFilter(tab.dataset.filter));
});

// Click bag/shoe card → product page
document.querySelectorAll('.product-card[data-cat="bags"], .product-card[data-cat="shoes"]').forEach(card => {
  card.style.cursor = 'pointer';
  card.addEventListener('click', (e) => {
    if (e.target.classList.contains('quick-add')) return;
    const img = card.querySelector('img')?.src || '';
    const name = card.querySelector('h4')?.textContent || '';
    const price = card.querySelector('strong')?.textContent || '';
    window.location.href = `product.html?img=${encodeURIComponent(img)}&name=${encodeURIComponent(name)}&price=${encodeURIComponent(price)}`;
  });
});

// ── CART ──
const cart = [];

function openCart() {
  document.getElementById('cart-drawer').classList.add('open');
  document.getElementById('cart-overlay').classList.add('open');
}
function closeCart() {
  document.getElementById('cart-drawer').classList.remove('open');
  document.getElementById('cart-overlay').classList.remove('open');
}
document.getElementById('cart-icon').addEventListener('click', openCart);
document.getElementById('cart-close').addEventListener('click', closeCart);
document.getElementById('cart-overlay').addEventListener('click', closeCart);

function renderCart() {
  const itemsEl = document.getElementById('cart-items');
  const countEl = document.getElementById('cart-count');
  const totalEl = document.getElementById('cart-total');
  const footerEl = document.getElementById('cart-footer');

  countEl.textContent = cart.length;
  if (cart.length === 0) {
    itemsEl.innerHTML = '<p class="cart-empty">Your cart is empty.</p>';
    footerEl.style.display = 'none';
    return;
  }
  footerEl.style.display = 'block';
  itemsEl.innerHTML = cart.map((item, i) => `
    <div class="cart-item">
      <img src="${item.img}" alt="${item.name}" />
      <div class="cart-item-info">
        <h4>${item.name}</h4>
        <span>${item.price}</span>
      </div>
      <button class="cart-item-remove" onclick="removeFromCart(${i})">✕</button>
    </div>
  `).join('');

  // calc total (strip non-numeric except comma/dot)
  const total = cart.reduce((sum, item) => {
    const num = parseInt(item.price.replace(/[^0-9]/g, '')) || 0;
    return sum + num;
  }, 0);
  totalEl.textContent = 'Ksh ' + total.toLocaleString();
}

function removeFromCart(i) {
  cart.splice(i, 1);
  renderCart();
}

function addToCart(name, price, img) {
  cart.push({ name, price, img });
  renderCart();
  openCart();
}

function openPayModal() {
  if (!cart.length) return;
  document.getElementById('pay-modal-total').textContent = document.getElementById('cart-total').textContent;
  document.getElementById('pay-modal').classList.add('open');
}
function closePayModal() {
  document.getElementById('pay-modal').classList.remove('open');
  ['mpesa','visa','paypal','equity'].forEach(m => {
    const el = document.getElementById('pay-' + m);
    if (el) el.classList.remove('open');
  });
}

function openShipping(e) {
  e.preventDefault();
  document.getElementById('shipping-modal').classList.add('open');
}

function togglePayInput(method) {
  ['mpesa','visa','paypal','equity'].forEach(m => {
    const el = document.getElementById('pay-' + m);
    if (el) el.classList.toggle('open', m === method && !el.classList.contains('open'));
  });
}

function confirmPay(method) {
  closePayModal();
  // show rating modal after short delay
  setTimeout(() => {
    document.getElementById('rating-modal').classList.add('open');
  }, 400);
}

// Star rating
let selectedRating = 0;
document.querySelectorAll('.star').forEach(star => {
  star.addEventListener('mouseover', () => {
    document.querySelectorAll('.star').forEach(s => s.classList.toggle('on', s.dataset.v <= star.dataset.v));
  });
  star.addEventListener('mouseleave', () => {
    document.querySelectorAll('.star').forEach(s => s.classList.toggle('on', s.dataset.v <= selectedRating));
  });
  star.addEventListener('click', () => {
    selectedRating = star.dataset.v;
    document.querySelectorAll('.star').forEach(s => s.classList.toggle('on', s.dataset.v <= selectedRating));
  });
});

function submitRating() {
  if (!selectedRating) { alert('Please select a star rating.'); return; }
  document.getElementById('rating-thanks').style.display = 'block';
  document.querySelector('#rating-modal .btn-primary').style.display = 'none';
  setTimeout(() => document.getElementById('rating-modal').classList.remove('open'), 2000);
}

// Newsletter form
document.getElementById('newsletter-form').addEventListener('submit', e => {
  e.preventDefault();
  e.target.style.display = 'none';
  const msg = document.getElementById('newsletter-msg');
  msg.textContent = '🎉 You\'re on the list! Welcome to the PRE LOVED family.';
  msg.style.fontSize = '1.1rem';
});

// Scroll reveal
const observer = new IntersectionObserver(entries => {
  entries.forEach(entry => {
    if (entry.isIntersecting) {
      entry.target.style.opacity = '1';
      entry.target.style.transform = 'translateY(0)';
    }
  });
}, { threshold: 0.1 });

document.querySelectorAll('.cat-card, .product-card, .stat, .tcard').forEach(el => {
  el.style.opacity = '0';
  el.style.transform = 'translateY(20px)';
  el.style.transition = 'opacity .5s ease, transform .5s ease';
  observer.observe(el);
});
