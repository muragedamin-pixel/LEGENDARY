require('dotenv').config();
const express  = require('express');
const cors     = require('cors');
const axios    = require('axios');
const bcrypt   = require('bcryptjs');
const jwt      = require('jsonwebtoken');

const app  = express();
const PORT = process.env.PORT || 3000;

// ── In-memory stores (replace with a DB for production) ───────────────────
const paymentStore = {};
// users: { email → { name, email, passwordHash, createdAt } }
const usersStore   = {};

// ── Middleware ───────────────────────────────────────────────────────────────
app.use(express.json());
app.use(cors({
  origin: process.env.FRONTEND_URL || '*',
  methods: ['GET', 'POST'],
}));

// ── Auth helpers ─────────────────────────────────────────────────────────────

const JWT_SECRET = process.env.JWT_SECRET || 'empress_jwt_secret_change_in_production';
const JWT_EXPIRES = '7d';

function signToken(payload) {
  return jwt.sign(payload, JWT_SECRET, { expiresIn: JWT_EXPIRES });
}

// ── Auth routes ──────────────────────────────────────────────────────────────

/**
 * POST /auth/register
 * Body: { name, email, password }
 */
app.post('/auth/register', async (req, res) => {
  const { name, email, password } = req.body;

  if (!name || !email || !password) {
    return res.status(400).json({ success: false, message: 'name, email and password are required.' });
  }
  if (password.length < 6) {
    return res.status(400).json({ success: false, message: 'Password must be at least 6 characters.' });
  }
  const key = email.toLowerCase().trim();
  if (usersStore[key]) {
    return res.status(409).json({ success: false, message: 'An account with this email already exists.' });
  }

  const passwordHash = await bcrypt.hash(password, 12);
  usersStore[key] = { name: name.trim(), email: key, passwordHash, createdAt: new Date().toISOString() };

  const token = signToken({ email: key, name: name.trim() });
  return res.status(201).json({ success: true, token, user: { name: name.trim(), email: key } });
});

/**
 * POST /auth/login
 * Body: { email, password }
 */
app.post('/auth/login', async (req, res) => {
  const { email, password } = req.body;

  if (!email || !password) {
    return res.status(400).json({ success: false, message: 'email and password are required.' });
  }

  const key  = email.toLowerCase().trim();
  const user = usersStore[key];

  if (!user) {
    return res.status(401).json({ success: false, message: 'Invalid email or password.' });
  }

  const valid = await bcrypt.compare(password, user.passwordHash);
  if (!valid) {
    return res.status(401).json({ success: false, message: 'Invalid email or password.' });
  }

  const token = signToken({ email: key, name: user.name });
  return res.json({ success: true, token, user: { name: user.name, email: key } });
});

/**
 * GET /auth/me  — verify a token and return user info
 * Header: Authorization: Bearer <token>
 */
app.get('/auth/me', (req, res) => {
  const authHeader = req.headers.authorization || '';
  const token = authHeader.startsWith('Bearer ') ? authHeader.slice(7) : null;

  if (!token) return res.status(401).json({ success: false, message: 'No token provided.' });

  try {
    const payload = jwt.verify(token, JWT_SECRET);
    const user    = usersStore[payload.email];
    if (!user) return res.status(401).json({ success: false, message: 'User not found.' });
    return res.json({ success: true, user: { name: user.name, email: user.email } });
  } catch {
    return res.status(401).json({ success: false, message: 'Invalid or expired token.' });
  }
});

// ── Helpers ──────────────────────────────────────────────────────────────────

/**
 * Get OAuth token from Safaricom Daraja API
 */
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

/**
 * Generate the Base64-encoded password for STK Push
 * Format: Base64(Shortcode + Passkey + Timestamp)
 */
function generatePassword(timestamp) {
  const { MPESA_SHORTCODE, MPESA_PASSKEY } = process.env;
  const raw = `${MPESA_SHORTCODE}${MPESA_PASSKEY}${timestamp}`;
  return Buffer.from(raw).toString('base64');
}

/**
 * Format phone number to 254XXXXXXXXX
 */
function formatPhone(phone) {
  let p = phone.replace(/\s+/g, '').replace(/[^0-9]/g, '');
  if (p.startsWith('0'))  p = '254' + p.slice(1);
  if (p.startsWith('+')) p = p.slice(1);
  return p;
}

// ── Routes ───────────────────────────────────────────────────────────────────

// Health check
app.get('/', (_req, res) => {
  res.json({ status: 'EMPRESS server is running 🎉' });
});

/**
 * POST /stk-push
 * Body: { phone, amount, itemName }
 * Initiates an M-Pesa STK Push to the customer's phone
 */
app.post('/stk-push', async (req, res) => {
  const { phone, amount, itemName } = req.body;

  if (!phone || !amount || !itemName) {
    return res.status(400).json({ success: false, message: 'phone, amount and itemName are required.' });
  }

  const formattedPhone = formatPhone(phone);
  if (formattedPhone.length < 12) {
    return res.status(400).json({ success: false, message: 'Invalid phone number.' });
  }

  try {
    const { token, baseUrl } = await getDarajaToken();

    const timestamp = new Date()
      .toISOString()
      .replace(/[-T:.Z]/g, '')
      .slice(0, 14); // YYYYMMDDHHmmss

    const password   = generatePassword(timestamp);
    const shortcode  = process.env.MPESA_SHORTCODE;
    const callbackUrl = `${process.env.RAILWAY_URL}/callback`;

    const payload = {
      BusinessShortCode: shortcode,
      Password: password,
      Timestamp: timestamp,
      TransactionType: 'CustomerPayBillOnline',
      Amount: Math.ceil(Number(amount)),
      PartyA: formattedPhone,
      PartyB: shortcode,
      PhoneNumber: formattedPhone,
      CallBackURL: callbackUrl,
      AccountReference: itemName.slice(0, 12),
      TransactionDesc: `EMPRESS - ${itemName}`.slice(0, 13),
    };

    const stkRes = await axios.post(
      `${baseUrl}/mpesa/stkpush/v1/processrequest`,
      payload,
      { headers: { Authorization: `Bearer ${token}` } }
    );

    const { CheckoutRequestID, ResponseCode, ResponseDescription } = stkRes.data;

    if (ResponseCode !== '0') {
      return res.status(400).json({ success: false, message: ResponseDescription });
    }

    // Store initial pending status
    paymentStore[CheckoutRequestID] = { status: 'pending', itemName, amount };

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

/**
 * POST /callback
 * Safaricom posts payment result here after customer enters PIN
 */
app.post('/callback', (req, res) => {
  const body = req.body?.Body?.stkCallback;

  if (!body) {
    console.warn('[Callback] Unexpected payload:', JSON.stringify(req.body));
    return res.json({ ResultCode: 0, ResultDesc: 'Accepted' });
  }

  const { CheckoutRequestID, ResultCode, ResultDesc, CallbackMetadata } = body;

  console.log(`[Callback] ${CheckoutRequestID} — ResultCode: ${ResultCode} — ${ResultDesc}`);

  if (ResultCode === 0) {
    // Payment successful — extract transaction details
    const items = CallbackMetadata?.Item || [];
    const get   = (name) => items.find(i => i.Name === name)?.Value;

    paymentStore[CheckoutRequestID] = {
      status:    'success',
      mpesaCode: get('MpesaReceiptNumber'),
      amount:    get('Amount'),
      phone:     get('PhoneNumber'),
      date:      get('TransactionDate'),
    };

    console.log(`[Payment SUCCESS] Receipt: ${get('MpesaReceiptNumber')} | Amount: ${get('Amount')}`);
  } else {
    paymentStore[CheckoutRequestID] = {
      status:  'failed',
      message: ResultDesc,
    };
    console.log(`[Payment FAILED] ${ResultDesc}`);
  }

  res.json({ ResultCode: 0, ResultDesc: 'Accepted' });
});

/**
 * GET /status/:checkoutRequestId
 * Frontend polls this to know if payment succeeded
 */
app.get('/status/:checkoutRequestId', (req, res) => {
  const { checkoutRequestId } = req.params;
  const record = paymentStore[checkoutRequestId];

  if (!record) {
    return res.json({ status: 'pending' });
  }

  return res.json(record);
});

// ── Start ────────────────────────────────────────────────────────────────────
app.listen(PORT, () => {
  console.log(`EMPRESS server running on port ${PORT}`);
  console.log(`Environment: ${process.env.MPESA_ENV || 'sandbox'}`);
});
