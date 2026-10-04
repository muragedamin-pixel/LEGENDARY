require('dotenv').config();
const express  = require('express');
const cors     = require('cors');
const axios    = require('axios');
const bcrypt   = require('bcryptjs');
const jwt      = require('jsonwebtoken');

const app  = express();
const PORT = process.env.PORT || 3000;

// ── In-memory stores ──────────────────────────────────────────────────────────
const paymentStore = {};
// users: { email → { name, email, passwordHash, createdAt, lastSeen } }
const usersStore   = {};
// activityLog: [ { id, email, name, action, detail, ip, timestamp } ]
const activityLog  = [];
let   activitySeq  = 1;

// ── Middleware ────────────────────────────────────────────────────────────────
app.use(express.json());

const FRONTEND_URL = process.env.FRONTEND_URL || '*';
app.use(cors({
  origin: FRONTEND_URL === '*' ? '*' : (origin, cb) => {
    // Allow requests with no origin (mobile apps, curl, Postman)
    if (!origin) return cb(null, true);
    const allowed = FRONTEND_URL.split(',').map(u => u.trim());
    if (allowed.includes(origin)) return cb(null, true);
    cb(new Error(`CORS: origin ${origin} not allowed`));
  },
  methods: ['GET', 'POST'],
  allowedHeaders: ['Content-Type', 'Authorization'],
}));

// ── Helpers ───────────────────────────────────────────────────────────────────

const JWT_SECRET  = process.env.JWT_SECRET || 'empress_jwt_secret_change_in_production';
const JWT_EXPIRES = '30d';   // keep users logged in for 30 days

function signToken(payload) {
  return jwt.sign(payload, JWT_SECRET, { expiresIn: JWT_EXPIRES });
}

/** Verify JWT from Authorization header. Returns payload or null. */
function verifyToken(req) {
  const authHeader = req.headers.authorization || '';
  const token = authHeader.startsWith('Bearer ') ? authHeader.slice(7) : null;
  if (!token) return null;
  try { return jwt.verify(token, JWT_SECRET); }
  catch { return null; }
}

/** Log an activity event */
function logActivity(email, name, action, detail = '', req = null) {
  const ip = req
    ? (req.headers['x-forwarded-for'] || req.socket?.remoteAddress || 'unknown')
    : 'system';
  activityLog.push({
    id:        activitySeq++,
    email:     email || 'guest',
    name:      name  || 'Guest',
    action,
    detail,
    ip,
    timestamp: new Date().toISOString(),
  });
  // Keep only latest 1000 events in memory
  if (activityLog.length > 1000) activityLog.splice(0, activityLog.length - 1000);
  console.log(`[Activity] ${action} | ${email || 'guest'} | ${detail}`);
}

// ── Auth routes ───────────────────────────────────────────────────────────────

/**
 * POST /auth/register
 * Body: { name, email, password }
 */
app.post('/auth/register', async (req, res) => {
  const { name, email, password } = req.body;

  if (!name || !email || !password)
    return res.status(400).json({ success: false, message: 'name, email and password are required.' });
  if (password.length < 6)
    return res.status(400).json({ success: false, message: 'Password must be at least 6 characters.' });

  const key = email.toLowerCase().trim();
  if (usersStore[key])
    return res.status(409).json({ success: false, message: 'An account with this email already exists.' });

  const passwordHash = await bcrypt.hash(password, 12);
  usersStore[key] = {
    name: name.trim(), email: key, passwordHash,
    createdAt: new Date().toISOString(), lastSeen: new Date().toISOString(),
  };

  const token = signToken({ email: key, name: name.trim() });
  logActivity(key, name.trim(), 'REGISTER', `New account created`, req);

  return res.status(201).json({ success: true, token, user: { name: name.trim(), email: key } });
});

/**
 * POST /auth/login
 * Body: { email, password }
 */
app.post('/auth/login', async (req, res) => {
  const { email, password } = req.body;

  if (!email || !password)
    return res.status(400).json({ success: false, message: 'email and password are required.' });

  const key  = email.toLowerCase().trim();
  const user = usersStore[key];

  if (!user) {
    logActivity(key, null, 'LOGIN_FAIL', 'Account not found', req);
    return res.status(401).json({ success: false, message: 'Invalid email or password.' });
  }

  const valid = await bcrypt.compare(password, user.passwordHash);
  if (!valid) {
    logActivity(key, user.name, 'LOGIN_FAIL', 'Wrong password', req);
    return res.status(401).json({ success: false, message: 'Invalid email or password.' });
  }

  // Update lastSeen
  usersStore[key].lastSeen = new Date().toISOString();
  const token = signToken({ email: key, name: user.name });
  logActivity(key, user.name, 'LOGIN', 'Signed in', req);

  return res.json({ success: true, token, user: { name: user.name, email: key } });
});

/**
 * GET /auth/me  — verify token & return user (used to auto-restore session)
 * Header: Authorization: Bearer <token>
 */
app.get('/auth/me', (req, res) => {
  const payload = verifyToken(req);
  if (!payload) return res.status(401).json({ success: false, message: 'Invalid or expired token.' });

  const user = usersStore[payload.email];
  if (!user)  return res.status(401).json({ success: false, message: 'User not found.' });

  // Update lastSeen silently
  usersStore[payload.email].lastSeen = new Date().toISOString();

  return res.json({
    success: true,
    user: { name: user.name, email: user.email, createdAt: user.createdAt, lastSeen: user.lastSeen },
  });
});

/**
 * POST /auth/logout
 * Header: Authorization: Bearer <token>
 * Logs the logout event (token invalidation is handled client-side).
 */
app.post('/auth/logout', (req, res) => {
  const payload = verifyToken(req);
  if (payload) {
    const user = usersStore[payload.email];
    logActivity(payload.email, user?.name, 'LOGOUT', 'Signed out', req);
  }
  return res.json({ success: true });
});

// ── Activity routes ───────────────────────────────────────────────────────────

/**
 * POST /activity
 * Body: { action, detail }
 * Header: Authorization: Bearer <token>  (optional — logs as guest if missing)
 * Records a frontend activity event (page view, add to cart, etc.)
 */
app.post('/activity', (req, res) => {
  const { action, detail } = req.body;
  if (!action) return res.status(400).json({ success: false, message: 'action is required.' });

  const payload = verifyToken(req);
  const email   = payload?.email || null;
  const name    = payload ? (usersStore[payload.email]?.name || payload.name) : null;

  logActivity(email, name, action, detail || '', req);
  return res.json({ success: true });
});

/**
 * GET /activity
 * Header: Authorization: Bearer <token>  (required)
 * Returns latest activity events. Only accessible to logged-in users.
 * Query: ?limit=50&email=filter@email.com
 */
app.get('/activity', (req, res) => {
  const payload = verifyToken(req);
  if (!payload) return res.status(401).json({ success: false, message: 'Authentication required.' });

  const limit      = Math.min(parseInt(req.query.limit) || 50, 200);
  const emailFilter = req.query.email ? req.query.email.toLowerCase().trim() : null;

  let events = [...activityLog].reverse(); // newest first
  if (emailFilter) events = events.filter(e => e.email === emailFilter);
  events = events.slice(0, limit);

  return res.json({ success: true, count: events.length, events });
});

// ── M-Pesa helpers ────────────────────────────────────────────────────────────

async function getDarajaToken() {
  const { MPESA_CONSUMER_KEY, MPESA_CONSUMER_SECRET, MPESA_ENV } = process.env;
  const baseUrl = MPESA_ENV === 'live'
    ? 'https://api.safaricom.co.ke'
    : 'https://sandbox.safaricom.co.ke';

  const credentials = Buffer.from(`${MPESA_CONSUMER_KEY}:${MPESA_CONSUMER_SECRET}`).toString('base64');
  const res = await axios.get(`${baseUrl}/oauth/v1/generate?grant_type=client_credentials`, {
    headers: { Authorization: `Basic ${credentials}` },
  });
  return { token: res.data.access_token, baseUrl };
}

function generatePassword(timestamp) {
  const { MPESA_SHORTCODE, MPESA_PASSKEY } = process.env;
  return Buffer.from(`${MPESA_SHORTCODE}${MPESA_PASSKEY}${timestamp}`).toString('base64');
}

function formatPhone(phone) {
  let p = phone.replace(/\s+/g, '').replace(/[^0-9]/g, '');
  if (p.startsWith('0'))  p = '254' + p.slice(1);
  if (p.startsWith('+')) p = p.slice(1);
  return p;
}

// ── Payment routes ────────────────────────────────────────────────────────────

app.get('/', (_req, res) => res.json({ status: 'EMPRESS server is running 🎉' }));

app.post('/stk-push', async (req, res) => {
  const { phone, amount, itemName } = req.body;
  if (!phone || !amount || !itemName)
    return res.status(400).json({ success: false, message: 'phone, amount and itemName are required.' });

  const formattedPhone = formatPhone(phone);
  if (formattedPhone.length < 12)
    return res.status(400).json({ success: false, message: 'Invalid phone number.' });

  // Log purchase attempt
  const payload = verifyToken(req);
  logActivity(
    payload?.email, payload ? usersStore[payload.email]?.name : null,
    'PURCHASE_ATTEMPT', `Item: ${itemName} | Amount: Ksh ${amount} | Phone: ${formattedPhone}`, req
  );

  try {
    const { token, baseUrl } = await getDarajaToken();
    const timestamp   = new Date().toISOString().replace(/[-T:.Z]/g, '').slice(0, 14);
    const password    = generatePassword(timestamp);
    const shortcode   = process.env.MPESA_SHORTCODE;
    const callbackUrl = `${process.env.RAILWAY_URL}/callback`;

    const stkRes = await axios.post(
      `${baseUrl}/mpesa/stkpush/v1/processrequest`,
      {
        BusinessShortCode: shortcode, Password: password, Timestamp: timestamp,
        TransactionType: 'CustomerPayBillOnline',
        Amount: Math.ceil(Number(amount)),
        PartyA: formattedPhone, PartyB: shortcode, PhoneNumber: formattedPhone,
        CallBackURL: callbackUrl,
        AccountReference: itemName.slice(0, 12),
        TransactionDesc: `EMPRESS - ${itemName}`.slice(0, 13),
      },
      { headers: { Authorization: `Bearer ${token}` } }
    );

    const { CheckoutRequestID, ResponseCode, ResponseDescription } = stkRes.data;
    if (ResponseCode !== '0')
      return res.status(400).json({ success: false, message: ResponseDescription });

    paymentStore[CheckoutRequestID] = {
      status: 'pending', itemName, amount,
      email: payload?.email || null,
    };

    return res.json({
      success: true,
      checkoutRequestId: CheckoutRequestID,
      message: 'STK Push sent. Ask customer to enter their M-Pesa PIN.',
    });

  } catch (err) {
    console.error('[STK Push Error]', err?.response?.data || err.message);
    return res.status(500).json({
      success: false,
      message: err?.response?.data?.errorMessage || 'Failed to initiate payment.',
    });
  }
});

app.post('/callback', (req, res) => {
  const body = req.body?.Body?.stkCallback;
  if (!body) {
    console.warn('[Callback] Unexpected payload:', JSON.stringify(req.body));
    return res.json({ ResultCode: 0, ResultDesc: 'Accepted' });
  }

  const { CheckoutRequestID, ResultCode, ResultDesc, CallbackMetadata } = body;
  const record = paymentStore[CheckoutRequestID] || {};

  if (ResultCode === 0) {
    const items = CallbackMetadata?.Item || [];
    const get   = (name) => items.find(i => i.Name === name)?.Value;

    paymentStore[CheckoutRequestID] = {
      status:    'success',
      mpesaCode: get('MpesaReceiptNumber'),
      amount:    get('Amount'),
      phone:     get('PhoneNumber'),
      date:      get('TransactionDate'),
      email:     record.email || null,
    };

    logActivity(
      record.email, null, 'PURCHASE_SUCCESS',
      `Receipt: ${get('MpesaReceiptNumber')} | Item: ${record.itemName} | Amount: Ksh ${get('Amount')}`
    );
  } else {
    paymentStore[CheckoutRequestID] = { status: 'failed', message: ResultDesc, email: record.email || null };
    logActivity(record.email, null, 'PURCHASE_FAILED', `Reason: ${ResultDesc} | Item: ${record.itemName}`);
  }

  res.json({ ResultCode: 0, ResultDesc: 'Accepted' });
});

app.get('/status/:checkoutRequestId', (req, res) => {
  const record = paymentStore[req.params.checkoutRequestId];
  return res.json(record || { status: 'pending' });
});

// ── Start ─────────────────────────────────────────────────────────────────────
app.listen(PORT, () => {
  console.log(`EMPRESS server running on port ${PORT}`);
  console.log(`Environment: ${process.env.MPESA_ENV || 'sandbox'}`);
  logActivity('system', 'System', 'SERVER_START', `Port ${PORT}`);
});
