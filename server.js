const express = require('express');
const cors = require('cors');
const dotenv = require('dotenv');
const path = require('path');
const nodemailer = require('nodemailer');
const qrcode = require('qrcode');
const { OpenAI } = require('openai');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');

// Load environment variables
dotenv.config({ override: true });

const db = require('./models/db');

const app = express();
const PORT = process.env.PORT || 5000;
const JWT_SECRET = process.env.JWT_SECRET || 'clubpulse_secret_key_change_in_production';

// Middlewares
app.use(cors());
app.use(express.json({ limit: '50mb' }));
app.use(express.urlencoded({ limit: '50mb', extended: true }));

// Redirect root to landing.html
app.get('/', (req, res) => {
  res.redirect('/landing.html');
});

// Serve static files from 'public' if it exists
const publicPath = path.join(__dirname, 'public');
app.use(express.static(publicPath));

// API Key setup
const openai = process.env.OPENAI_API_KEY ? new OpenAI({ apiKey: process.env.OPENAI_API_KEY }) : null;

// ==========================================
// Nodemailer Config
// ==========================================
let transporter;
if (process.env.EMAIL_USER && process.env.EMAIL_PASS) {
  transporter = nodemailer.createTransport({
    service: process.env.EMAIL_SERVICE || 'gmail',
    auth: {
      user: process.env.EMAIL_USER,
      pass: process.env.EMAIL_PASS
    },
    tls: {
      rejectUnauthorized: false
    }
  });
}

// Helper: Send ticket email with QR code
// Helper: Send ticket email with QR code and Gate Pass to all members
async function sendTicketEmail(team, eventName, tickets) {
  const fs = require('fs');
  const gatePassPath = path.join(__dirname, 'public', 'get-pass.png');
  
  const results = [];

  if (!transporter) {
    tickets.forEach(t => {
      console.log(`[MOCK EMAIL] To: ${t.email} (${t.name})`);
      console.log(`Subject: Personalized Pass & Ticket for ${eventName} - ${t.name}`);
      console.log(`Body: Hi ${t.name}, you are registered as ${t.role} of team ${team.name} in ${eventName}.`);
      results.push({ email: t.email, role: t.role, status: 'mock_sent', error: '' });
    });
    return { mock: true, sent: false, sentCount: 0, errorCount: 0, error: null, results };
  }

  let sentCount = 0;
  let errorCount = 0;
  let lastError = null;

  for (const t of tickets) {
    if (!t.email || t.email.trim().length === 0) continue;

    const attachments = [
      { filename: 'ticket-qr.png', path: t.qrCode, cid: 'qrcode' }
    ];
    
    // Attach gate pass (use t.cardImage if provided, otherwise fallback to get-pass.png)
    let hasGatePass = false;
    if (t.cardImage && t.cardImage.startsWith('data:image/')) {
      const parts = t.cardImage.split(';base64,');
      if (parts.length === 2) {
        const mimeType = parts[0].split(':')[1];
        const extension = mimeType.split('/')[1] || 'png';
        const buffer = Buffer.from(parts[1], 'base64');
        attachments.push({ filename: `get-pass.${extension}`, content: buffer, cid: 'gatepass' });
        hasGatePass = true;
      }
    }

    if (!hasGatePass && fs.existsSync(gatePassPath)) {
      attachments.push({ filename: 'get-pass.png', path: gatePassPath, cid: 'gatepass' });
      hasGatePass = true;
    }

    const mailOptions = {
      from: process.env.EMAIL_USER,
      to: t.email,
      subject: `🎟️ Personalized ID Card & Gate Pass for ${eventName} - ${t.name}`,
      html: `
        <div style="background-color: #0d0e12; color: #ffffff; font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif; padding: 30px; border-radius: 12px; border: 1px solid #3b3d4a; max-width: 500px; margin: auto;">
          <h2 style="color: #00ffcc; border-bottom: 2px solid #a855f7; padding-bottom: 10px;">ClubPulse Gate Pass</h2>
          <p>Hi <strong>${t.name}</strong>,</p>
          <p>You and your team <strong>${team.name}</strong> are registered successfully for <strong>${eventName}</strong>!</p>
          <p>Here is your personalized access ticket and gate pass. Please keep this email or screenshot the pass for fast check-in at the entrance.</p>
          
          <div style="background: rgba(255, 255, 255, 0.05); padding: 15px; border-radius: 8px; border: 1px solid rgba(255, 255, 255, 0.1); margin: 15px 0;">
            <table style="width: 100%; border-collapse: collapse; color: #cbd5e0; font-size: 14px;">
              <tr>
                <td style="padding: 4px 0; font-weight: bold; color: #a855f7; width: 120px;">Participant:</td>
                <td style="padding: 4px 0;">${t.name} (${t.role})</td>
              </tr>
              <tr>
                <td style="padding: 4px 0; font-weight: bold; color: #a855f7;">Team Name:</td>
                <td style="padding: 4px 0;">${team.name}</td>
              </tr>
              <tr>
                <td style="padding: 4px 0; font-weight: bold; color: #a855f7;">Team ID:</td>
                <td style="padding: 4px 0; font-family: monospace; font-size: 13px; color: #00ffcc;">${team._id}</td>
              </tr>
              <tr>
                <td style="padding: 4px 0; font-weight: bold; color: #a855f7;">Event Name:</td>
                <td style="padding: 4px 0;">${eventName}</td>
              </tr>
            </table>
          </div>

          <div style="background: rgba(255, 255, 255, 0.05); padding: 20px; border-radius: 8px; border: 1px solid rgba(255, 255, 255, 0.1); margin: 20px 0; text-align: center;">
            <h4 style="margin: 0 0 10px 0; color: #fbbf24; text-transform: uppercase; letter-spacing: 0.5px;">Your Access QR Ticket</h4>
            <img src="cid:qrcode" alt="QR Code Ticket" style="width: 200px; height: 200px; border-radius: 8px; background: white; padding: 10px;" />
            <p style="font-size: 12px; color: #a0aec0; margin-top: 10px;">Scan at the registration counter.</p>
          </div>

          ${hasGatePass ? `
          <div style="margin: 20px 0; text-align: center;">
            <h4 style="margin: 0 0 10px 0; color: #00ffcc; text-transform: uppercase; letter-spacing: 1px;">Your Hackathon Gate Pass</h4>
            <img src="cid:gatepass" alt="Hackathon Gate Pass" style="width: 100%; max-width: 400px; border-radius: 10px; border: 1px solid #3b3d4a; display: block; margin: 0 auto;" />
            <p style="font-size: 11px; color: #a0aec0; margin-top: 8px;">${t.cardImage ? '(Your personalized gate pass is attached above)' : '(Personalized physical pass card can be downloaded from the registration page)'}</p>
          </div>
          ` : ''}

          <p style="font-size: 13px; color: #cbd5e0;">Team Members:</p>
          <ul style="color: #a0aec0; padding-left: 20px; font-size: 13px;">
            <li><strong>${team.leaderName}</strong> (Leader)</li>
            ${team.members.map(m => `<li>${m.name}</li>`).join('')}
          </ul>
          
          <footer style="margin-top: 30px; border-top: 1px solid #1a1c24; padding-top: 15px; font-size: 11px; color: #718096; text-align: center;">
            ClubPulse Dashboard - Powered by AI & Smart Operations
          </footer>
        </div>
      `,
      attachments
    };

    let status = 'pending';
    let errorMsg = '';
    try {
      await transporter.sendMail(mailOptions);
      sentCount++;
      status = 'sent';
    } catch (error) {
      console.error(`Nodemailer error sending to ${t.email}:`, error);
      errorCount++;
      lastError = error.message;
      status = 'failed';
      errorMsg = error.message;
    }

    results.push({ email: t.email, role: t.role, status, error: errorMsg });
  }

  return { mock: false, sent: sentCount > 0, sentCount, errorCount, error: lastError, results };
}

// Helper: Send welcome and dinner coupon emails to all team members
async function sendWelcomeAndCouponEmails(team, eventName) {
  const results = [];
  const teamIdHex = team._id.toString().toUpperCase();
  const teamIdShort = teamIdHex.slice(-6);

  if (!transporter) {
    console.log(`[MOCK DINNER EMAIL] Event: ${eventName}, Team: ${team.name}`);
    
    // Leader
    const leaderCoupon = `DINNER-CP-${teamIdShort}-01`;
    console.log(`[MOCK EMAIL] To: ${team.leaderEmail}. Subject: Welcome to ${eventName}! Dinner Coupon: ${leaderCoupon}`);
    results.push({ email: team.leaderEmail, coupon: leaderCoupon, status: 'mock_sent' });

    // Members
    let idx = 2;
    for (const m of (team.members || [])) {
      if (!m.email || m.email.trim().length === 0) continue;
      const memberCoupon = `DINNER-CP-${teamIdShort}-${idx < 10 ? '0' + idx : idx}`;
      console.log(`[MOCK EMAIL] To: ${m.email}. Subject: Welcome to ${eventName}! Dinner Coupon: ${memberCoupon}`);
      results.push({ email: m.email, coupon: memberCoupon, status: 'mock_sent' });
      idx++;
    }
    return { mock: true, sent: false, sentCount: 0, results };
  }

  let sentCount = 0;
  
  const fs = require('fs');
  const couponPath = path.join(__dirname, 'public', 'coupon.png');
  const hasCouponImage = fs.existsSync(couponPath);

  // Compile list of recipients
  const recipients = [];
  recipients.push({
    name: team.leaderName,
    email: team.leaderEmail,
    role: 'Leader',
    couponCode: `DINNER-CP-${teamIdShort}-01`
  });

  let idx = 2;
  for (const m of (team.members || [])) {
    if (!m.email || m.email.trim().length === 0) continue;
    recipients.push({
      name: m.name,
      email: m.email,
      role: 'Member',
      couponCode: `DINNER-CP-${teamIdShort}-${idx < 10 ? '0' + idx : idx}`
    });
    idx++;
  }

  for (const recipient of recipients) {
    const attachments = [];
    if (hasCouponImage) {
      attachments.push({
        filename: 'coupon.png',
        path: couponPath,
        cid: 'coupon'
      });
    }

    const mailOptions = {
      from: process.env.EMAIL_USER,
      to: recipient.email,
      subject: `🍽️ Welcome to ${eventName}! Your Dinner Coupon - ${recipient.name}`,
      html: `
        <div style="background-color: #0d0e12; color: #ffffff; font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif; padding: 30px; border-radius: 12px; border: 1px solid #3b3d4a; max-width: 500px; margin: auto;">
          <h2 style="color: #00ffcc; border-bottom: 2px solid #a855f7; padding-bottom: 10px; margin-top: 0;">Welcome to ${eventName}!</h2>
          <p>Hi <strong>${recipient.name}</strong>,</p>
          <p>You have successfully checked in at the registration desk for <strong>${eventName}</strong> as part of team <strong>${team.name}</strong>.</p>
          <p>We are thrilled to have you! To kick off the event, here is your complimentary dinner coupon. Please present the coupon code or scan code at the catering counter.</p>
          
          <!-- Dinner Coupon -->
          ${hasCouponImage ? `
          <div style="margin: 25px 0; text-align: center;">
            <img src="cid:coupon" alt="Refreshment Coupon" style="width: 100%; max-width: 450px; border-radius: 12px; border: 1px solid #3b3d4a; display: block; margin: 0 auto;" />
            <div style="background: rgba(0, 0, 0, 0.4); padding: 12px; border-radius: 8px; border: 1px dashed rgba(255, 255, 255, 0.2); display: inline-block; margin-top: 12px; text-align: center;">
              <span style="font-family: monospace; font-size: 18px; font-weight: bold; color: #fbbf24; letter-spacing: 1px;">${recipient.couponCode}</span>
            </div>
          </div>
          ` : `
          <!-- Fallback Dinner Coupon Card -->
          <div style="background: linear-gradient(135deg, #1e1b4b, #311042); padding: 24px; border-radius: 16px; border: 1px solid #a855f7; margin: 25px 0; text-align: center; box-shadow: 0 8px 24px rgba(168, 85, 247, 0.2);">
            <div style="font-size: 11px; font-weight: 700; color: #fbbf24; text-transform: uppercase; letter-spacing: 2px; margin-bottom: 8px;">Complimentary Dinner Pass</div>
            <h3 style="font-size: 20px; font-weight: 800; color: #00ffcc; margin: 0 0 16px 0; text-transform: uppercase;">🍽️ Event Dinner Coupon</h3>
            
            <div style="background: rgba(0, 0, 0, 0.4); padding: 12px; border-radius: 8px; border: 1px dashed rgba(255, 255, 255, 0.2); display: inline-block; margin-bottom: 16px;">
              <span style="font-family: monospace; font-size: 20px; font-weight: bold; color: #fbbf24; letter-spacing: 1px;">${recipient.couponCode}</span>
            </div>
            
            <div style="width: 100%; border-top: 1px solid rgba(255, 255, 255, 0.08); padding-top: 12px; font-size: 12px; color: #cbd5e0; text-align: left;">
              <table style="width: 100%; border-collapse: collapse;">
                <tr>
                  <td style="color: #a855f7; font-weight: 600; padding: 2px 0;">Participant:</td>
                  <td style="text-align: right; color: #ffffff;">${recipient.name} (${recipient.role})</td>
                </tr>
                <tr>
                  <td style="color: #a855f7; font-weight: 600; padding: 2px 0;">Team:</td>
                  <td style="text-align: right; color: #ffffff;">${team.name}</td>
                </tr>
                <tr>
                  <td style="color: #a855f7; font-weight: 600; padding: 2px 0;">Event:</td>
                  <td style="text-align: right; color: #ffffff;">${eventName}</td>
                </tr>
              </table>
            </div>
          </div>
          `}
 
          <p style="font-size: 12px; color: #cbd5e0;">* Note: This coupon code is unique and valid for one-time dinner redemption on the event premises.</p>
          
          <footer style="margin-top: 30px; border-top: 1px solid #1a1c24; padding-top: 15px; font-size: 11px; color: #718096; text-align: center;">
            ClubPulse Dashboard - Powered by AI & Smart Operations
          </footer>
        </div>
      `,
      attachments
    };

    try {
      await transporter.sendMail(mailOptions);
      sentCount++;
      results.push({ email: recipient.email, coupon: recipient.couponCode, status: 'sent' });
    } catch (error) {
      console.error(`Error sending welcome/dinner email to ${recipient.email}:`, error);
      results.push({ email: recipient.email, coupon: recipient.couponCode, status: 'failed', error: error.message });
    }
  }

  return { mock: false, sent: sentCount > 0, sentCount, results };
}

// Helper: Send email to team leader when a topic is allocated
async function sendTopicAllocationEmail(team, topicTitle, topicDescription) {
  if (!transporter) {
    console.log(`[MOCK EMAIL] To: ${team.leaderEmail} (${team.leaderName})`);
    console.log(`Subject: Topic Allocated: ${topicTitle}`);
    console.log(`Body: Hi ${team.leaderName}, your team ${team.name} has been allocated the topic: ${topicTitle}.`);
    return { mock: true, sent: false };
  }

  const mailOptions = {
    from: process.env.EMAIL_USER,
    to: team.leaderEmail,
    subject: `💡 Topic Allocated for Your Team - ${topicTitle}`,
    html: `
      <div style="background-color: #0d0e12; color: #ffffff; font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif; padding: 30px; border-radius: 12px; border: 1px solid #3b3d4a; max-width: 500px; margin: auto;">
        <h2 style="color: #00ffcc; border-bottom: 2px solid #a855f7; padding-bottom: 10px; margin-top: 0;">Topic Allocated!</h2>
        <p>Hi <strong>${team.leaderName}</strong> (Team Leader),</p>
        <p>Your team <strong>${team.name}</strong> has been allocated the following topic/challenge statement:</p>
        
        <div style="background: rgba(255, 255, 255, 0.05); padding: 18px; border-radius: 8px; border: 1px solid rgba(255, 255, 255, 0.1); margin: 20px 0;">
          <h3 style="color: #fbbf24; margin-top: 0; margin-bottom: 8px;">${topicTitle}</h3>
          <p style="color: #cbd5e0; font-size: 14px; margin: 0; line-height: 1.5;">${topicDescription}</p>
        </div>

        <p style="font-size: 13px; color: #a0aec0;">Best of luck with your hackathon project! Please coordinate with your team members to start working on the challenge.</p>
        
        <footer style="margin-top: 30px; border-top: 1px solid #1a1c24; padding-top: 15px; font-size: 11px; color: #718096; text-align: center;">
          ClubPulse Dashboard - Powered by AI & Smart Operations
        </footer>
      </div>
    `
  };

  try {
    await transporter.sendMail(mailOptions);
    console.log(`Allocation email sent successfully to ${team.leaderEmail}`);
    return { mock: false, sent: true };
  } catch (error) {
    console.error(`Error sending allocation email to ${team.leaderEmail}:`, error);
    return { mock: false, sent: false, error: error.message };
  }
}

// ==========================================
// AUTH MIDDLEWARE
// ==========================================
function authenticateToken(req, res, next) {
  const authHeader = req.headers['authorization'];
  const token = authHeader && authHeader.split(' ')[1]; // Bearer <token>
  if (!token) return res.status(401).json({ error: 'Access denied. No token provided.' });

  try {
    const decoded = jwt.verify(token, JWT_SECRET);
    req.userId = decoded.userId;
    req.user = decoded;
    next();
  } catch (err) {
    return res.status(403).json({ error: 'Invalid or expired token.' });
  }
}

// ==========================================
// AUTH ROUTES (public)
// ==========================================

// POST /api/auth/signup
app.post('/api/auth/signup', async (req, res) => {
  try {
    const { name, email, password, clubName } = req.body;
    if (!name || !email || !password) return res.status(400).json({ error: 'Name, email and password are required.' });
    if (password.length < 6) return res.status(400).json({ error: 'Password must be at least 6 characters.' });

    // Check if email already in use
    const existing = await db.User.findOne({ email: email.toLowerCase().trim() });
    if (existing) return res.status(409).json({ error: 'An account with this email already exists.' });

    const hashedPassword = await bcrypt.hash(password, 12);
    const user = await db.User.create({
      name: name.trim(),
      email: email.toLowerCase().trim(),
      password: hashedPassword,
      clubName: (clubName || 'My Club').trim(),
      role: 'Admin'
    });

    const token = jwt.sign(
      { userId: user._id.toString(), name: user.name, email: user.email, clubName: user.clubName },
      JWT_SECRET,
      { expiresIn: '7d' }
    );

    res.status(201).json({
      message: 'Account created successfully!',
      token,
      user: { id: user._id, name: user.name, email: user.email, clubName: user.clubName }
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// POST /api/auth/login
app.post('/api/auth/login', async (req, res) => {
  try {
    const { email, password } = req.body;
    if (!email || !password) return res.status(400).json({ error: 'Email and password are required.' });

    const user = await db.User.findOne({ email: email.toLowerCase().trim() });
    if (!user) return res.status(401).json({ error: 'Invalid email or password.' });

    const isValid = await bcrypt.compare(password, user.password);
    if (!isValid) return res.status(401).json({ error: 'Invalid email or password.' });

    const token = jwt.sign(
      { userId: user._id.toString(), name: user.name, email: user.email, clubName: user.clubName },
      JWT_SECRET,
      { expiresIn: '7d' }
    );

    res.json({
      message: 'Login successful!',
      token,
      user: { id: user._id, name: user.name, email: user.email, clubName: user.clubName }
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// GET /api/auth/me
app.get('/api/auth/me', authenticateToken, async (req, res) => {
  try {
    const user = await db.User.findById(req.userId);
    if (!user) return res.status(404).json({ error: 'User not found.' });
    res.json({ id: user._id, name: user.name, email: user.email, clubName: user.clubName });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// ==========================================
// REST API ROUTES (all protected)
// ==========================================

// 1. Dashboard Stats
app.get('/api/stats', authenticateToken, async (req, res) => {
  try {
    const uid = req.userId;
    const totalMembers = await db.Member.countDocuments({ userId: uid });
    const activeCount = await db.Member.countDocuments({ userId: uid, status: 'active' });

    const totalTasks = await db.Task.countDocuments({ userId: uid });
    const completedTasksCount = await db.Task.countDocuments({ userId: uid, status: 'completed' });
    const taskCompletionRate = totalTasks > 0 ? Math.round((completedTasksCount / totalTasks) * 100) : 0;

    const totalTeams = await db.Team.countDocuments({ userId: uid });
    const completedEventsCount = await db.Event.countDocuments({ userId: uid, status: 'completed' });

    let attendanceRate = 0;
    if (totalTeams > 0 && completedEventsCount > 0) {
      const teams = await db.Team.find({ userId: uid });
      let totalCheckins = 0;
      teams.forEach(t => { totalCheckins += t.attendedEvents ? t.attendedEvents.length : 0; });
      attendanceRate = Math.round((totalCheckins / (totalTeams * completedEventsCount)) * 100);
      if (attendanceRate > 100) attendanceRate = 100;
    } else {
      attendanceRate = totalMembers > 0 ? 82 : 0;
    }

    const teamsList = await db.Team.find({ userId: uid });
    let totalParticipants = 0;
    teamsList.forEach(t => { totalParticipants += 1 + (t.members ? t.members.length : 0); });

    const upcomingEvents = await db.Event.find({ userId: uid, status: 'upcoming' }).sort({ date: 1 }).limit(3);
    const recentMembers = await db.Member.find({ userId: uid }).sort({ createdAt: -1 }).limit(5);

    res.json({ totalMembers, activeCount, taskCompletionRate, attendanceRate, totalParticipants, upcomingEvents, recentMembers });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// 2. Members Management
app.get('/api/members', authenticateToken, async (req, res) => {
  try {
    const members = await db.Member.find({ userId: req.userId }).sort({ name: 1 });
    res.json(members);
  } catch (error) { res.status(500).json({ error: error.message }); }
});

app.get('/api/members/leaderboard', authenticateToken, async (req, res) => {
  try {
    const leaderboard = await db.Member.find({ userId: req.userId }).sort({ engagementScore: -1 }).limit(10);
    res.json(leaderboard);
  } catch (error) { res.status(500).json({ error: error.message }); }
});

app.post('/api/members', authenticateToken, async (req, res) => {
  try {
    const newMember = await db.Member.create({ ...req.body, userId: req.userId });
    res.status(201).json(newMember);
  } catch (error) { res.status(400).json({ error: error.message }); }
});

app.put('/api/members/:id', authenticateToken, async (req, res) => {
  try {
    const updated = await db.Member.findByIdAndUpdate(req.params.id, req.body, { new: true });
    if (!updated) return res.status(404).json({ error: 'Member not found' });
    res.json(updated);
  } catch (error) { res.status(400).json({ error: error.message }); }
});

app.delete('/api/members/:id', authenticateToken, async (req, res) => {
  try {
    const deleted = await db.Member.findByIdAndDelete(req.params.id);
    if (!deleted) return res.status(404).json({ error: 'Member not found' });
    res.json({ message: 'Member deleted successfully', member: deleted });
  } catch (error) { res.status(500).json({ error: error.message }); }
});

app.get('/api/public/events', async (req, res) => {
  try {
    const { email } = req.query;
    if (!email || email.trim().length === 0) {
      return res.json([]);
    }
    const user = await db.User.findOne({ email: email.toLowerCase().trim() });
    if (!user) {
      return res.json([]);
    }
    const events = await db.Event.find({ userId: user._id }).sort({ date: 1 });
    res.json(events);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Route: Generate registration URL QR code dynamically
app.get('/api/public/register-qr', async (req, res) => {
  try {
    const { email } = req.query;
    const protocol = req.headers['x-forwarded-proto'] || req.protocol;
    const host = req.get('host');
    let registerUrl = `${protocol}://${host}/register.html`;
    
    if (email && email.trim().length > 0) {
      registerUrl += `?email=${encodeURIComponent(email.toLowerCase().trim())}`;
    }
    
    // Generate QR code pointing to the registration page URL
    const qrCodeDataUrl = await qrcode.toDataURL(registerUrl, {
      color: {
        dark: '#0f172a', // Theme deep slate
        light: '#ffffff'
      },
      width: 400,
      margin: 2
    });
    
    res.json({ qrCode: qrCodeDataUrl, url: registerUrl });
  } catch (err) {
    res.status(500).json({ error: 'Failed to generate QR code: ' + err.message });
  }
});

app.get('/api/events', authenticateToken, async (req, res) => {
  try {
    const events = await db.Event.find({ userId: req.userId }).sort({ date: 1 });
    res.json(events);
  } catch (error) { res.status(500).json({ error: error.message }); }
});

app.get('/api/events/stats/monthly-attendance', authenticateToken, async (req, res) => {
  try {
    const uid = req.userId;
    const events = await db.Event.find({ userId: uid, status: 'completed' });
    const teams = await db.Team.find({ userId: uid });

    const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
    const monthlyAttendance = months.reduce((acc, month) => { acc[month] = 0; return acc; }, {});

    for (const event of events) {
      const eventDate = new Date(event.date);
      const monthName = months[eventDate.getMonth()];
      let attendees = 0;
      teams.forEach(t => {
        if (t.attendedEvents && t.attendedEvents.some(id => id.toString() === event._id.toString())) {
          attendees += 1 + (t.members ? t.members.length : 0);
        }
      });
      if (attendees === 0) attendees = Math.round(event.maxCapacity * 0.75);
      monthlyAttendance[monthName] += attendees;
    }

    const totalEvents = await db.Event.countDocuments({ userId: uid });
    if (totalEvents === 0 || Object.values(monthlyAttendance).every(v => v === 0)) {
      monthlyAttendance['Jan'] = 0; monthlyAttendance['Feb'] = 0; monthlyAttendance['Mar'] = 0;
    }

    res.json(monthlyAttendance);
  } catch (error) { res.status(500).json({ error: error.message }); }
});

app.post('/api/events', authenticateToken, async (req, res) => {
  try {
    const newEvent = await db.Event.create({ ...req.body, userId: req.userId });
    res.status(201).json(newEvent);
  } catch (error) { res.status(400).json({ error: error.message }); }
});

app.put('/api/events/:id', authenticateToken, async (req, res) => {
  try {
    const updated = await db.Event.findByIdAndUpdate(req.params.id, req.body, { new: true });
    if (!updated) return res.status(404).json({ error: 'Event not found' });
    res.json(updated);
  } catch (error) { res.status(400).json({ error: error.message }); }
});

app.delete('/api/events/:id', authenticateToken, async (req, res) => {
  try {
    const deleted = await db.Event.findByIdAndDelete(req.params.id);
    if (!deleted) return res.status(404).json({ error: 'Event not found' });
    res.json({ message: 'Event deleted successfully', event: deleted });
  } catch (error) { res.status(500).json({ error: error.message }); }
});

app.post('/api/events/:id/attendance', authenticateToken, async (req, res) => {
  try {
    const eventId = req.params.id;
    const { memberIds } = req.body;
    const event = await db.Event.findById(eventId);
    if (!event) return res.status(404).json({ error: 'Event not found' });

    if (memberIds && Array.isArray(memberIds)) {
      for (const mId of memberIds) {
        const member = await db.Member.findById(mId);
        if (member) {
          const newScore = (member.engagementScore || 0) + 10;
          await db.Member.findByIdAndUpdate(mId, { engagementScore: newScore });
        }
      }
    }
    res.json({ message: 'Event attendance recorded successfully', membersCount: memberIds ? memberIds.length : 0 });
  } catch (error) { res.status(500).json({ error: error.message }); }
});

// 4. Tasks Management
app.get('/api/tasks', authenticateToken, async (req, res) => {
  try {
    const tasks = await db.Task.find({ userId: req.userId }).populate('assignedTo');
    res.json(tasks);
  } catch (error) { res.status(500).json({ error: error.message }); }
});

app.post('/api/tasks', authenticateToken, async (req, res) => {
  try {
    const newTask = await db.Task.create({ ...req.body, userId: req.userId });
    const populated = await db.Task.findById(newTask._id).populate('assignedTo');
    res.status(201).json(populated);
  } catch (error) { res.status(400).json({ error: error.message }); }
});

app.put('/api/tasks/:id', authenticateToken, async (req, res) => {
  try {
    const updated = await db.Task.findByIdAndUpdate(req.params.id, req.body, { new: true }).populate('assignedTo');
    if (!updated) return res.status(404).json({ error: 'Task not found' });
    res.json(updated);
  } catch (error) { res.status(400).json({ error: error.message }); }
});

app.delete('/api/tasks/:id', authenticateToken, async (req, res) => {
  try {
    const deleted = await db.Task.findByIdAndDelete(req.params.id);
    if (!deleted) return res.status(404).json({ error: 'Task not found' });
    res.json({ message: 'Task deleted successfully', task: deleted });
  } catch (error) { res.status(500).json({ error: error.message }); }
});

app.put('/api/tasks/:id/complete', authenticateToken, async (req, res) => {
  try {
    const task = await db.Task.findById(req.params.id);
    if (!task) return res.status(404).json({ error: 'Task not found' });

    const updatedTask = await db.Task.findByIdAndUpdate(req.params.id, { status: 'completed' }, { new: true }).populate('assignedTo');
    const member = await db.Member.findById(task.assignedTo);
    if (member) {
      await db.Member.findByIdAndUpdate(task.assignedTo, {
        completedTasks: (member.completedTasks || 0) + 1,
        engagementScore: (member.engagementScore || 0) + 15
      });
    }
    res.json({ message: 'Task marked as completed', task: updatedTask });
  } catch (error) { res.status(500).json({ error: error.message }); }
});

// 5. Teams Management & Registration
app.get('/api/teams', authenticateToken, async (req, res) => {
  try {
    const teams = await db.Team.find({ userId: req.userId }).populate('registeredEvent');
    res.json(teams);
  } catch (error) { res.status(500).json({ error: error.message }); }
});

app.post('/api/teams/register', async (req, res) => {
  try {
    const { name, leaderName, leaderEmail, members, registeredEvent, college } = req.body;
    const event = await db.Event.findById(registeredEvent);
    if (!event) return res.status(404).json({ error: 'Target Event not found' });

    const newTeam = await db.Team.create({
      name, leaderName, leaderEmail,
      members: members || [],
      registeredEvent,
      college: college || 'N/A',
      attendedEvents: [],
      userId: event.userId // Inherit userId from event
    });

    const tickets = [];
    const teamIdHex = newTeam._id.toString().toUpperCase();
    const teamIdShort = teamIdHex.slice(-6);

    // Generate personalized QR code for leader
    const leaderQrData = JSON.stringify({
      teamId: newTeam._id,
      eventId: event._id,
      teamName: newTeam.name,
      eventName: event.title,
      participantName: newTeam.leaderName,
      role: 'Leader'
    });
    const leaderQrCode = await qrcode.toDataURL(leaderQrData);
    const leaderPartId = `CP-${teamIdShort}-01`;
    tickets.push({
      name: newTeam.leaderName,
      email: newTeam.leaderEmail,
      role: 'Leader',
      qrCode: leaderQrCode,
      participantId: leaderPartId,
      college: newTeam.college
    });

    // Generate personalized QR codes for each team member
    let idx = 2;
    for (const m of (newTeam.members || [])) {
      const memberQrData = JSON.stringify({
        teamId: newTeam._id,
        eventId: event._id,
        teamName: newTeam.name,
        eventName: event.title,
        participantName: m.name,
        role: 'Member'
      });
      const memberQrCode = await qrcode.toDataURL(memberQrData);
      const memberPartId = `CP-${teamIdShort}-${idx < 10 ? '0' + idx : idx}`;
      tickets.push({
        name: m.name,
        email: m.email,
        role: 'Member',
        qrCode: memberQrCode,
        participantId: memberPartId,
        college: newTeam.college
      });
      idx++;
    }

    res.status(201).json({ 
      message: 'Team registered successfully', 
      team: newTeam, 
      tickets
    });
  } catch (error) { res.status(400).json({ error: error.message }); }
});

// POST /api/teams/send-emails (Public)
app.post('/api/teams/send-emails', async (req, res) => {
  try {
    const { teamId, tickets } = req.body;
    if (!teamId || !tickets || !Array.isArray(tickets)) {
      return res.status(400).json({ error: 'teamId and tickets array are required.' });
    }

    const team = await db.Team.findById(teamId);
    if (!team) return res.status(404).json({ error: 'Team not found' });
    const event = await db.Event.findById(team.registeredEvent);
    if (!event) return res.status(404).json({ error: 'Event not found for this team' });

    const emailResult = await sendTicketEmail(team, event.title, tickets);

    // Save status results back to database
    let updatedLeaderStatus = 'pending';
    let updatedLeaderError = '';
    const updatedMembers = team.members.map(m => {
      return {
        _id: m._id,
        name: m.name,
        email: m.email,
        emailStatus: m.emailStatus || 'pending',
        emailError: m.emailError || ''
      };
    });

    if (emailResult.results && emailResult.results.length > 0) {
      emailResult.results.forEach(resItem => {
        if (resItem.role === 'Leader') {
          updatedLeaderStatus = resItem.status;
          updatedLeaderError = resItem.error || '';
        } else {
          const idx = updatedMembers.findIndex(m => m.email.toLowerCase() === resItem.email.toLowerCase());
          if (idx !== -1) {
            updatedMembers[idx].emailStatus = resItem.status;
            updatedMembers[idx].emailError = resItem.error || '';
          }
        }
      });
    } else {
      const status = emailResult.sent ? 'sent' : (emailResult.mock ? 'mock_sent' : 'failed');
      updatedLeaderStatus = status;
      updatedLeaderError = emailResult.error || '';
      updatedMembers.forEach(m => {
        m.emailStatus = status;
        m.emailError = emailResult.error || '';
      });
    }

    await db.Team.findByIdAndUpdate(teamId, {
      leaderEmailStatus: updatedLeaderStatus,
      leaderEmailError: updatedLeaderError,
      members: updatedMembers
    });

    res.json({
      message: 'Emails processed successfully',
      emailSent: emailResult.sent,
      mockEmail: emailResult.mock
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// POST /api/teams/submit-project (Public Gateway)
app.post('/api/teams/submit-project', async (req, res) => {
  try {
    const { teamId, leaderEmail, projectLiveLink, projectGithubLink, projectPptLink, projectReportLink } = req.body;
    if (!teamId || !leaderEmail || !projectLiveLink || !projectGithubLink || !projectPptLink || !projectReportLink) {
      return res.status(400).json({ error: 'All fields (teamId, leaderEmail, live project link, github, ppt, report) are required.' });
    }

    const team = await db.Team.findById(teamId);
    if (!team) return res.status(404).json({ error: 'Team not found with the provided Team ID.' });

    // Validate leader email matches (case-insensitive)
    if (team.leaderEmail.toLowerCase().trim() !== leaderEmail.toLowerCase().trim()) {
      return res.status(401).json({ error: 'Invalid credentials. Leader email does not match this Team ID.' });
    }

    // Save project links to database
    const updatedTeam = await db.Team.findByIdAndUpdate(teamId, {
      projectLiveLink: projectLiveLink.trim(),
      projectGithubLink: projectGithubLink.trim(),
      projectPptLink: projectPptLink.trim(),
      projectReportLink: projectReportLink.trim(),
      projectSubmitted: true,
      projectSubmittedAt: new Date()
    }, { new: true });

    res.json({
      message: 'Project submitted successfully!',
      team: updatedTeam
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// POST /api/teams/prepare-resend (Protected)
app.post('/api/teams/prepare-resend', authenticateToken, async (req, res) => {
  try {
    const { teamId, participantEmail } = req.body;
    if (!teamId || !participantEmail) {
      return res.status(400).json({ error: 'teamId and participantEmail are required.' });
    }

    const team = await db.Team.findById(teamId);
    if (!team) return res.status(404).json({ error: 'Team not found' });
    const event = await db.Event.findById(team.registeredEvent);
    if (!event) return res.status(404).json({ error: 'Event not found for this team' });

    let isLeader = team.leaderEmail.toLowerCase() === participantEmail.toLowerCase();
    let memberIndex = -1;
    if (!isLeader) {
      memberIndex = team.members.findIndex(m => m.email.toLowerCase() === participantEmail.toLowerCase());
      if (memberIndex === -1) {
        return res.status(404).json({ error: 'Participant not found in this team' });
      }
    }

    const targetName = isLeader ? team.leaderName : team.members[memberIndex].name;
    const targetRole = isLeader ? 'Leader' : 'Member';
    const teamIdHex = team._id.toString().toUpperCase();
    const teamIdShort = teamIdHex.slice(-6);

    const qrData = JSON.stringify({
      teamId: team._id,
      eventId: event._id,
      teamName: team.name,
      eventName: event.title,
      participantName: targetName,
      role: targetRole
    });
    const qrCode = await qrcode.toDataURL(qrData);

    const participantId = isLeader
      ? `CP-${teamIdShort}-01`
      : `CP-${teamIdShort}-${(memberIndex + 2) < 10 ? '0' + (memberIndex + 2) : (memberIndex + 2)}`;

    res.json({
      name: targetName,
      teamName: team.name,
      eventName: event.title,
      qrCode,
      participantId,
      college: team.college
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// POST /api/teams/resend-pass (Protected)
app.post('/api/teams/resend-pass', authenticateToken, async (req, res) => {
  try {
    const { teamId, participantEmail, newEmail, cardImage } = req.body;
    if (!teamId || !participantEmail) {
      return res.status(400).json({ error: 'teamId and participantEmail are required.' });
    }

    const team = await db.Team.findById(teamId);
    if (!team) return res.status(404).json({ error: 'Team not found' });
    const event = await db.Event.findById(team.registeredEvent);
    if (!event) return res.status(404).json({ error: 'Event not found for this team' });

    let isLeader = team.leaderEmail.toLowerCase() === participantEmail.toLowerCase();
    let memberIndex = -1;
    if (!isLeader) {
      memberIndex = team.members.findIndex(m => m.email.toLowerCase() === participantEmail.toLowerCase());
      if (memberIndex === -1) {
        return res.status(404).json({ error: 'Participant not found in this team' });
      }
    }

    let finalEmail = participantEmail.trim().toLowerCase();
    if (newEmail && newEmail.trim().length > 0 && newEmail.trim().toLowerCase() !== participantEmail.toLowerCase()) {
      finalEmail = newEmail.trim().toLowerCase();
      if (isLeader) {
        team.leaderEmail = finalEmail;
      } else {
        team.members[memberIndex].email = finalEmail;
      }
    }

    const targetName = isLeader ? team.leaderName : team.members[memberIndex].name;
    const targetRole = isLeader ? 'Leader' : 'Member';
    const teamIdHex = team._id.toString().toUpperCase();
    const teamIdShort = teamIdHex.slice(-6);

    const qrData = JSON.stringify({
      teamId: team._id,
      eventId: event._id,
      teamName: team.name,
      eventName: event.title,
      participantName: targetName,
      role: targetRole
    });
    const qrCode = await qrcode.toDataURL(qrData);

    const participantId = isLeader
      ? `CP-${teamIdShort}-01`
      : `CP-${teamIdShort}-${(memberIndex + 2) < 10 ? '0' + (memberIndex + 2) : (memberIndex + 2)}`;

    const ticket = {
      name: targetName,
      email: finalEmail,
      role: targetRole,
      qrCode,
      participantId,
      college: team.college,
      cardImage
    };

    const emailResult = await sendTicketEmail(team, event.title, [ticket]);

    const status = emailResult.sent ? 'sent' : (emailResult.mock ? 'mock_sent' : 'failed');
    const errorMsg = emailResult.error || '';

    if (isLeader) {
      team.leaderEmailStatus = status;
      team.leaderEmailError = errorMsg;
      await db.Team.findByIdAndUpdate(teamId, {
        leaderEmail: team.leaderEmail,
        leaderEmailStatus: status,
        leaderEmailError: errorMsg
      });
    } else {
      team.members[memberIndex].emailStatus = status;
      team.members[memberIndex].emailError = errorMsg;
      await db.Team.findByIdAndUpdate(teamId, {
        members: team.members
      });
    }

    res.json({
      message: 'Email processed successfully',
      emailSent: emailResult.sent,
      mockEmail: emailResult.mock,
      error: errorMsg,
      status
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

app.put('/api/teams/:id/grade', authenticateToken, async (req, res) => {
  try {
    const { performanceGrade, performanceFeedback } = req.body;
    const team = await db.Team.findById(req.params.id);
    if (!team) return res.status(404).json({ error: 'Team not found' });

    const updated = await db.Team.findByIdAndUpdate(req.params.id, { performanceGrade, performanceFeedback }, { new: true }).populate('registeredEvent');
    const leaderMember = await db.Member.findOne({ email: team.leaderEmail, userId: req.userId });
    if (leaderMember) {
      await db.Member.findByIdAndUpdate(leaderMember._id, {
        engagementScore: (leaderMember.engagementScore || 0) + Math.round(performanceGrade * 0.5)
      });
    }
    res.json({ message: 'Team performance graded successfully', team: updated });
  } catch (error) { res.status(400).json({ error: error.message }); }
});
app.post('/api/teams/:id/attend', async (req, res) => {
  try {
    const { eventId, remove } = req.body;
    const team = await db.Team.findById(req.params.id);
    if (!team) return res.status(404).json({ error: 'Team not found' });
    const event = await db.Event.findById(eventId);
    if (!event) return res.status(404).json({ error: 'Event not found' });

    if (!team.attendedEvents) team.attendedEvents = [];
    const isAlreadyAttended = team.attendedEvents.map(id => id.toString()).includes(eventId.toString());

    if (remove) {
      if (isAlreadyAttended) {
        team.attendedEvents = team.attendedEvents.filter(id => id.toString() !== eventId.toString());
        await db.Team.findByIdAndUpdate(team._id, { attendedEvents: team.attendedEvents });
        const leaderMember = await db.Member.findOne({ email: team.leaderEmail, userId: event.userId });
        if (leaderMember) {
          await db.Member.findByIdAndUpdate(leaderMember._id, {
            engagementScore: Math.max(0, (leaderMember.engagementScore || 0) - 20)
          });
        }
      }
      res.json({ message: 'Team attendance removed successfully', team });
    } else {
      let welcomeEmailsResult = null;
      if (!isAlreadyAttended) {
        team.attendedEvents.push(eventId);
        await db.Team.findByIdAndUpdate(team._id, { attendedEvents: team.attendedEvents });
        const leaderMember = await db.Member.findOne({ email: team.leaderEmail, userId: event.userId });
        if (leaderMember) {
          await db.Member.findByIdAndUpdate(leaderMember._id, {
            engagementScore: (leaderMember.engagementScore || 0) + 20
          });
        }
        try {
          welcomeEmailsResult = await sendWelcomeAndCouponEmails(team, event.title);
        } catch (emailErr) {
          console.error('Error sending welcome and coupon emails:', emailErr);
        }
      }
      res.json({ 
        message: 'Team attendance recorded successfully', 
        team,
        welcomeEmailsSent: welcomeEmailsResult ? welcomeEmailsResult.sent : false,
        welcomeEmailsMock: welcomeEmailsResult ? welcomeEmailsResult.mock : false
      });
    }
  } catch (error) { res.status(400).json({ error: error.message }); }
});
// 6. Problem Statements
app.get('/api/problems', authenticateToken, async (req, res) => {
  try {
    const problems = await db.ProblemStatement.find({ userId: req.userId }).populate('eventId').populate('allocatedToTeams');
    res.json(problems);
  } catch (error) { res.status(500).json({ error: error.message }); }
});

app.post('/api/problems', authenticateToken, async (req, res) => {
  try {
    const newProblem = await db.ProblemStatement.create({ ...req.body, userId: req.userId });
    const populated = await db.ProblemStatement.findById(newProblem._id).populate('eventId');
    res.status(201).json(populated);
  } catch (error) { res.status(400).json({ error: error.message }); }
});

app.put('/api/problems/:id', authenticateToken, async (req, res) => {
  try {
    const updated = await db.ProblemStatement.findByIdAndUpdate(req.params.id, req.body, { new: true }).populate('eventId').populate('allocatedToTeams');
    if (!updated) return res.status(404).json({ error: 'Problem statement not found' });
    res.json(updated);
  } catch (error) { res.status(400).json({ error: error.message }); }
});

app.delete('/api/problems/:id', authenticateToken, async (req, res) => {
  try {
    const deleted = await db.ProblemStatement.findByIdAndDelete(req.params.id);
    if (!deleted) return res.status(404).json({ error: 'Problem statement not found' });
    res.json({ message: 'Problem statement deleted successfully', problem: deleted });
  } catch (error) { res.status(500).json({ error: error.message }); }
});

app.post('/api/problems/allocate', authenticateToken, async (req, res) => {
  try {
    const { problemId, teamId } = req.body;
    const problem = await db.ProblemStatement.findById(problemId);
    if (!problem) return res.status(404).json({ error: 'Problem statement not found' });
    const team = await db.Team.findById(teamId);
    if (!team) return res.status(404).json({ error: 'Team not found' });

    // Check if team is already allocated to this problem
    if (!problem.allocatedToTeams) {
      problem.allocatedToTeams = [];
    }
    if (!problem.allocatedToTeams.includes(teamId)) {
      problem.allocatedToTeams.push(teamId);
      await problem.save();
    }

    await db.Team.findByIdAndUpdate(teamId, { problemStatement: problem.title });

    // Send allocated topic email to the team leader
    await sendTopicAllocationEmail(team, problem.title, problem.description);

    res.json({ message: 'Problem allocated successfully', problem, team });
  } catch (error) { res.status(500).json({ error: error.message }); }
});

app.post('/api/problems/deallocate', authenticateToken, async (req, res) => {
  try {
    const { problemId, teamId } = req.body;
    const problem = await db.ProblemStatement.findById(problemId);
    if (!problem) return res.status(404).json({ error: 'Problem statement not found' });

    if (teamId) {
      // Clear problemStatement for this specific team
      await db.Team.findByIdAndUpdate(teamId, { problemStatement: '' });
      // Remove teamId from problem.allocatedToTeams
      if (problem.allocatedToTeams) {
        problem.allocatedToTeams = problem.allocatedToTeams.filter(id => id.toString() !== teamId.toString());
        await problem.save();
      }
    } else {
      // Deallocate all teams
      if (problem.allocatedToTeams && problem.allocatedToTeams.length > 0) {
        for (const tId of problem.allocatedToTeams) {
          await db.Team.findByIdAndUpdate(tId, { problemStatement: '' });
        }
      }
      problem.allocatedToTeams = [];
      await problem.save();
    }

    res.json({ message: 'Problem de-allocated successfully', problem });
  } catch (error) { res.status(500).json({ error: error.message }); }
});

app.post('/api/problems/allocate-random', authenticateToken, async (req, res) => {
  try {
    const { eventId } = req.body;
    if (!eventId) return res.status(400).json({ error: 'eventId is required' });

    const uid = req.userId;
    // For random allocation, look for problems that have no allocated teams
    const unallocatedProblems = await db.ProblemStatement.find({ 
      userId: uid, 
      eventId,
      $or: [
        { allocatedToTeams: { $exists: false } },
        { allocatedToTeams: { $size: 0 } }
      ]
    });
    const unallocatedTeams = await db.Team.find({ userId: uid, registeredEvent: eventId, problemStatement: '' });

    if (unallocatedProblems.length === 0) return res.status(400).json({ error: 'No unallocated problem statements found.' });
    if (unallocatedTeams.length === 0) return res.status(400).json({ error: 'No registered teams without problem statements found.' });

    let allocatedCount = 0;
    const limit = Math.min(unallocatedProblems.length, unallocatedTeams.length);
    for (let i = 0; i < limit; i++) {
      const problem = unallocatedProblems[i];
      const team = unallocatedTeams[i];

      await db.ProblemStatement.findByIdAndUpdate(problem._id, { 
        $push: { allocatedToTeams: team._id } 
      });
      await db.Team.findByIdAndUpdate(team._id, { problemStatement: problem.title });

      // Send allocated topic email to the team leader
      await sendTopicAllocationEmail(team, problem.title, problem.description);

      allocatedCount++;
    }
    res.json({ message: `Successfully allocated ${allocatedCount} problem statements to teams.` });
  } catch (error) { res.status(500).json({ error: error.message }); }
});

// 7. AI Reports
app.post('/api/ai/generate-report', authenticateToken, async (req, res) => {
  try {
    const uid = req.userId;
    const totalMembers = await db.Member.countDocuments({ userId: uid });
    const activeMembers = await db.Member.countDocuments({ userId: uid, status: 'active' });
    const totalTasks = await db.Task.countDocuments({ userId: uid });
    const completedTasks = await db.Task.countDocuments({ userId: uid, status: 'completed' });
    const totalTeams = await db.Team.countDocuments({ userId: uid });
    const totalEvents = await db.Event.countDocuments({ userId: uid });
    const taskRate = totalTasks > 0 ? Math.round((completedTasks / totalTasks) * 100) : 0;

    let responseText = '';
    if (openai) {
      const promptText = `Provide a premium executive performance report for a hackathon club named ClubPulse. 
      Current Statistics:
      - Total Registered Members: ${totalMembers} (Active: ${activeMembers})
      - Total Projects/Teams Registered: ${totalTeams}
      - Total Tasks Assigned: ${totalTasks} (Completed: ${completedTasks}, Rate: ${taskRate}%)
      - Total Events Managed: ${totalEvents}
      Suggest three insights, strategic actions, and performance assessments. Formatting: Markdown style, professional, sleek tone.`;
      const completion = await openai.chat.completions.create({ messages: [{ role: 'user', content: promptText }], model: 'gpt-4o-mini' });
      responseText = completion.choices[0].message.content;
    } else {
      responseText = `## 📊 ClubPulse AI Performance Report
Generated on: ${new Date().toLocaleDateString()}

### 1. Executive Summary
ClubPulse is demonstrating solid operations with a **${taskRate}%** task completion rate across **${totalTasks}** tasks. With **${totalMembers}** registered club members and **${totalTeams}** hackathon teams, member recruitment is robust.

### 2. Strategic Insights
- 🟢 **Member Engagement:** High-performing active base (**${activeMembers}** active members). Engagement driven by practical workshops and regular meets.
- 🟡 **Operational Bottleneck:** ${totalTasks - completedTasks} pending tasks require attention. Members should be reassigned to avoid delay.
- 💎 **Growth Vector:** Expanding problem statement categories into Web3/AI will increase team registrations.

### 3. Action Plan
1. **Reallocate Tasks:** Move resources from complete tasks to assist pending integration work.
2. **Launch Gamification:** Introduce direct awards to members based on engagement scores.
3. **Problem Statement Allocations:** Scale manual problem statements randomly to minimize onboarding friction.`;
    }
    res.json({ report: responseText });
  } catch (error) { res.status(500).json({ error: error.message }); }
});

app.post('/api/ai/predict', authenticateToken, async (req, res) => {
  try {
    const uid = req.userId;
    const totalEvents = await db.Event.countDocuments({ userId: uid });
    const completedEvents = await db.Event.countDocuments({ userId: uid, status: 'completed' });
    const totalTeams = await db.Team.countDocuments({ userId: uid });

    let responseText = '';
    if (openai) {
      const promptText = `Provide a predictive model and forecast report for ClubPulse club activities.
      Completed Events: ${completedEvents}, Total Teams: ${totalTeams}, Total Events: ${totalEvents}.
      Forecast member participation growth for the next quarter, predict hackathon completion rates, and give capacity suggestions. Format: Markdown.`;
      const completion = await openai.chat.completions.create({ messages: [{ role: 'user', content: promptText }], model: 'gpt-4o-mini' });
      responseText = completion.choices[0].message.content;
    } else {
      responseText = `## 🔮 ClubPulse AI Predictive Report
Forecast Period: Q3-Q4 2026

### 1. Attendance & Registration Forecast
- Based on past workshops, team registrations are projected to scale by **+25%** month-over-month.
- Estimated participation: **${Math.round(totalTeams * 1.25 * 4)} developers** across ${Math.round(totalTeams * 1.25)} teams.

### 2. Task Completion Trends
- The current task completion velocity is **0.8 tasks/day per team**.
- Prediction: **92%** of core event tasks will be finished before the next opening ceremony.

### 3. Recommendations
- 🔺 **Server Capacity:** API endpoint loads will surge by **150%** during QR-code check-ins.
- 📅 **Schedule Buffer:** Introduce a 2-day buffer for sponsor decks due to dependency bottlenecks.`;
    }
    res.json({ prediction: responseText });
  } catch (error) { res.status(500).json({ error: error.message }); }
});

app.post('/api/ai/auto-schedule', authenticateToken, async (req, res) => {
  try {
    const uid = req.userId;
    const pendingTasks = await db.Task.find({ userId: uid, status: 'pending' });
    const activeMembers = await db.Member.find({ userId: uid, status: 'active' });

    if (pendingTasks.length === 0) return res.json({ report: '## 🤖 AI Auto-Scheduler\nNo pending tasks found in the queue. System is fully operational!' });
    if (activeMembers.length === 0) return res.json({ report: '## 🤖 AI Auto-Scheduler\nNo active club members available for task allocation. Please activate members first.' });

    let reportText = '## 🤖 AI Task Auto-Allocation Report\n\nAllocated tasks based on active workload statistics:\n\n';
    for (let i = 0; i < pendingTasks.length; i++) {
      const task = pendingTasks[i];
      const member = activeMembers[i % activeMembers.length];
      await db.Task.findByIdAndUpdate(task._id, { assignedTo: member._id, status: 'in-progress' });
      reportText += `- **Task:** "${task.title}" ➡️ Assigned to **${member.name}** (${member.role})\n`;
    }
    reportText += `\n**Success:** Distributed ${pendingTasks.length} pending tasks across ${Math.min(pendingTasks.length, activeMembers.length)} active developers.`;
    res.json({ report: reportText });
  } catch (error) { res.status(500).json({ error: error.message }); }
});

app.get('/api/events/:id/details-report', authenticateToken, async (req, res) => {
  try {
    const eventId = req.params.id;
    const event = await db.Event.findById(eventId);
    if (!event) return res.status(404).json({ error: 'Event not found' });

    // Fetch all teams registered for this event
    const teams = await db.Team.find({ registeredEvent: eventId });

    // Find the winner(s)
    let winnerText = 'No winner determined yet (grades are pending).';
    if (teams.length > 0) {
      const gradedTeams = teams.filter(t => t.performanceGrade != null && t.performanceGrade > 0);
      if (gradedTeams.length > 0) {
        gradedTeams.sort((a, b) => b.performanceGrade - a.performanceGrade);
        const maxGrade = gradedTeams[0].performanceGrade;
        const winners = gradedTeams.filter(t => t.performanceGrade === maxGrade);
        winnerText = winners.map(w => `${w.name} (${w.performanceGrade}/100) from ${w.college || 'N/A'}`).join(', ');
      }
    }

    // Format a beautiful text report
    let txt = `================================================================================
                       EVENT DETAILS & PERFORMANCE REPORT
================================================================================

EVENT METADATA
--------------------------------------------------------------------------------
Title:        ${event.title}
Type:         ${event.type}
Date:         ${event.date ? new Date(event.date).toLocaleDateString('en-US', { day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' }) : 'N/A'}
Location:     ${event.location}
Venue:        ${event.venue || 'N/A'}
Organizer:    ${event.organizer || 'N/A'}
Capacity:     ${event.maxCapacity} teams

WINNERS PODIUM
--------------------------------------------------------------------------------
Winner:       ${winnerText}

PARTICIPATING TEAMS & MARKS
--------------------------------------------------------------------------------
Total Teams:  ${teams.length}
`;

    if (teams.length === 0) {
      txt += `\nNo teams registered for this event yet.`;
    } else {
      teams.forEach((t, index) => {
        txt += `\n--------------------------------------------------------------------------------
${index + 1}. TEAM: ${t.name}
   Topic:           ${t.problemStatement || 'Not allocated'}
   College:         ${t.college || 'N/A'}
   Team Grade/Marks:${t.performanceGrade != null ? t.performanceGrade + '/100' : 'Pending'}
   Feedback:        ${t.performanceFeedback || 'N/A'}
   
   LEADER:
   Name:            ${t.leaderName}
   Email:           ${t.leaderEmail}
   
   ADDITIONAL MEMBERS:
`;
        if (!t.members || t.members.length === 0) {
          txt += `   None added\n`;
        } else {
          t.members.forEach((m, mIdx) => {
            txt += `   [${mIdx + 1}] Name: ${m.name} | Email: ${m.email}\n`;
          });
        }
      });
    }

    txt += `\n================================================================================
Generated automatically by ClubPulse on ${new Date().toLocaleString()}
================================================================================`;

    res.json({
      report: txt,
      filename: `event-report-${event.title.replace(/[^a-z0-9]/gi, '_').toLowerCase()}.txt`
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

app.post('/api/events/:id/email-certificates', authenticateToken, async (req, res) => {
  try {
    const eventId = req.params.id;
    const event = await db.Event.findById(eventId);
    if (!event) return res.status(404).json({ error: 'Event not found' });

    const { certificates } = req.body;
    if (!certificates || !Array.isArray(certificates)) {
      return res.status(400).json({ error: 'certificates array is required' });
    }

    const results = [];
    if (!transporter) {
      // Mock sending certificates
      certificates.forEach(c => {
        console.log(`[MOCK EMAIL CERTIFICATE] To: ${c.email} | Name: ${c.name}`);
        console.log(`Subject: 🎓 Certificate of Participation for ${event.title} - ${c.name}`);
        console.log(`Body: Hi ${c.name}, congratulations on participating in ${event.title}! Your certificate is attached.`);
        results.push({ email: c.email, name: c.name, status: 'mock_sent', error: '' });
      });
      return res.json({
        message: 'Mock certificates sent successfully (no transporter configured)',
        mock: true,
        sentCount: certificates.length,
        results
      });
    }

    let sentCount = 0;
    let errorCount = 0;
    
    for (const c of certificates) {
      if (!c.email || c.email.trim().length === 0) continue;

      const attachments = [];
      if (c.cardImage && c.cardImage.startsWith('data:image/')) {
        const parts = c.cardImage.split(';base64,');
        if (parts.length === 2) {
          const extension = parts[0].split(':')[1].split('/')[1] || 'png';
          const buffer = Buffer.from(parts[1], 'base64');
          attachments.push({
            filename: `certificate-${c.name.toLowerCase().replace(/[^a-z0-9]/g, '-')}.${extension}`,
            content: buffer
          });
        }
      }

      const mailOptions = {
        from: process.env.EMAIL_USER,
        to: c.email,
        subject: `🎓 Certificate of Participation for ${event.title} - ${c.name}`,
        html: `
          <div style="font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px; border: 1px solid #e2e8f0; border-radius: 12px; background-color: #ffffff; color: #1e293b;">
            <div style="text-align: center; margin-bottom: 20px;">
              <h2 style="color: #059669; margin: 0;">Congratulations ${c.name}!</h2>
              <p style="color: #64748b; font-size: 14px; margin-top: 4px;">You have successfully participated in <strong>${event.title}</strong>.</p>
            </div>
            <div style="line-height: 1.6; font-size: 15px; margin-bottom: 24px;">
              <p>Hi <strong>${c.name}</strong>,</p>
              <p>Thank you for being a part of <strong>${event.title}</strong>! We are thrilled to present you with your official <strong>Certificate of Participation</strong>.</p>
              <p>Your certificate is attached to this email. Feel free to download, print, or share it on your social media channels to showcase your achievement!</p>
            </div>
            <div style="border-top: 1px solid #e2e8f0; padding-top: 16px; text-align: center; font-size: 12px; color: #94a3b8;">
              <p>&copy; 2026 ClubPulse. Sent on behalf of the event organizers.</p>
            </div>
          </div>
        `,
        attachments
      };

      try {
        await transporter.sendMail(mailOptions);
        sentCount++;
        results.push({ email: c.email, name: c.name, status: 'sent', error: '' });
      } catch (mailErr) {
        console.error(`Failed to send certificate to ${c.email}:`, mailErr);
        errorCount++;
        results.push({ email: c.email, name: c.name, status: 'failed', error: mailErr.message });
      }
    }

    res.json({
      message: `Successfully emailed certificates to ${sentCount} participants.`,
      sentCount,
      errorCount,
      results
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// 8. AI Event-Specific Report
app.post('/api/ai/event-report', authenticateToken, async (req, res) => {
  try {
    const { eventId } = req.body;
    if (!eventId) return res.status(400).json({ error: 'eventId is required' });

    const event = await db.Event.findById(eventId);
    if (!event) return res.status(404).json({ error: 'Event not found' });

    const uid = req.userId;
    const teamsForEvent = await db.Team.find({ userId: uid, registeredEvent: eventId });
    const problemStatements = await db.ProblemStatement.find({ userId: uid, eventId });
    const allocatedProblems = problemStatements.filter(p => p.allocatedToTeams && p.allocatedToTeams.length > 0);
    const attendedTeams = teamsForEvent.filter(t =>
      t.attendedEvents && t.attendedEvents.map(id => id.toString()).includes(eventId.toString())
    );
    const gradedTeams = teamsForEvent.filter(t => t.performanceGrade != null && t.performanceGrade > 0);
    const avgGrade = gradedTeams.length > 0
      ? (gradedTeams.reduce((sum, t) => sum + (t.performanceGrade || 0), 0) / gradedTeams.length).toFixed(1) : 'N/A';
    const totalParticipants = teamsForEvent.reduce((sum, t) => sum + 1 + (t.members ? t.members.length : 0), 0);
    const attendanceRate = teamsForEvent.length > 0 ? Math.round((attendedTeams.length / teamsForEvent.length) * 100) : 0;

    let responseText = '';
    if (openai) {
      const promptText = `Generate a detailed post-event analysis report for:
Event: ${event.title}, Date: ${new Date(event.date).toLocaleDateString()}, Status: ${event.status}
Stats: Teams: ${teamsForEvent.length}, Participants: ${totalParticipants}, Attendance: ${attendanceRate}%, Problems: ${problemStatements.length} (${allocatedProblems.length} allocated), Avg Grade: ${avgGrade}
Provide: Executive summary, highlights, performance analysis, recommendations. Use Markdown with emojis.`;
      const completion = await openai.chat.completions.create({ messages: [{ role: 'user', content: promptText }], model: 'gpt-4o-mini' });
      responseText = completion.choices[0].message.content;
    } else {
      responseText = `## 🎯 Event Report: ${event.title}
**Date:** ${new Date(event.date).toLocaleDateString()} | **Status:** ${event.status.toUpperCase()} | **Venue:** ${event.venue || event.location || 'TBD'}

---

### 📋 Executive Summary
The event **"${event.title}"** brought together **${totalParticipants} participants** across **${teamsForEvent.length} registered teams**, achieving an attendance rate of **${attendanceRate}%**. ${event.status === 'completed' ? 'The event concluded successfully with strong engagement metrics.' : 'The event is currently upcoming/in-progress.'}

### 📊 Key Statistics
- **Teams Registered:** ${teamsForEvent.length}
- **Total Participants:** ${totalParticipants}
- **Attendance Rate:** ${attendanceRate}% (${attendedTeams.length}/${teamsForEvent.length} teams)
- **Problem Statements:** ${problemStatements.length} released, ${allocatedProblems.length} allocated
- **Graded Teams:** ${gradedTeams.length} | **Avg Score:** ${avgGrade}${avgGrade !== 'N/A' ? '/100' : ''}

### 🏆 Performance Highlights
${gradedTeams.length > 0
  ? gradedTeams.slice(0, 3).map(t => `- **${t.name}** — Grade: **${t.performanceGrade}/100**`).join('\n')
  : '- No performance grades recorded yet for this event.'}

### 💡 Strategic Insights
- 🟢 **Participation:** ${teamsForEvent.length >= 5 ? 'Strong team turnout — consider expanding capacity for next edition.' : 'Grow participation by promoting registration through social channels.'}
- 🟡 **Problem Distribution:** ${allocatedProblems.length < problemStatements.length ? `${problemStatements.length - allocatedProblems.length} problem statements remain unallocated.` : 'All problem statements are allocated. ✅'}
- 💎 **Attendance Tracking:** ${attendanceRate >= 75 ? 'Excellent attendance. QR check-in system is working effectively.' : 'Attendance rate is below target. Consider enabling QR-code reminders.'}

### 📌 Recommendations
1. **Capacity Planning:** Aim for **${Math.ceil(teamsForEvent.length * 1.25)} teams** for the next iteration.
2. **Early Registration:** Open registrations at least 3 weeks in advance.
3. **Grading Automation:** Implement automated rubrics to speed up performance grading.`;
    }
    res.json({ report: responseText });
  } catch (error) { res.status(500).json({ error: error.message }); }
});

// 9. AI Chat Mentor
app.post('/api/ai/mentor', authenticateToken, async (req, res) => {
  try {
    const { message, history } = req.body;
    if (!message) return res.status(400).json({ error: 'Message is required' });

    let responseText = '';
    if (openai) {
      const systemPrompt = {
        role: 'system',
        content: `You are ChatMentor, a premium AI Hackathon and Project Mentor inside the ClubPulse dashboard. 
        You help students, developers, and organizers with:
        - Choosing tech stacks (e.g. React, Node.js, Python, MongoDB).
        - Brainstorming creative hackathon project ideas.
        - Team formation, division of tasks, and pitch deck creation.
        - Coding assistance, debugging advice, and architectural patterns.
        Keep your advice structured, professional, inspiring, and concise. Use markdown formatting with bullet points and bold headers.`
      };
      
      const messages = [systemPrompt];
      if (history && Array.isArray(history)) {
        history.forEach(h => {
          messages.push({ role: h.role, content: h.content });
        });
      }
      messages.push({ role: 'user', content: message });

      const completion = await openai.chat.completions.create({
        messages,
        model: 'gpt-4o-mini'
      });
      responseText = completion.choices[0].message.content;
    } else {
      // Mock Fallback engine
      const msgLower = message.toLowerCase();
      if (msgLower.includes('idea') || msgLower.includes('brainstorm') || msgLower.includes('project')) {
        responseText = `### 💡 AI Mentor Project Ideas
Here are three premium project ideas matching your hackathon environment:
1. **EcoTrack IoT:** An analytics dashboard tracking local community carbon footprints using real-time sensor integration.
2. **HealthSphere:** A decentralized web platform that utilizes AI to analyze dietary habits and suggest preventive care.
3. **SmartEdu Portal:** An adaptive education tool matching learning styles with tailored visual quizzes.

**Mentor Tip:** Focus on building a working *Minimum Viable Product (MVP)* instead of a complete feature set. Present a clean UI and solid core flow!`;
      } else if (msgLower.includes('tech') || msgLower.includes('stack') || msgLower.includes('database') || msgLower.includes('react') || msgLower.includes('node')) {
        responseText = `### 🛠️ Recommended Tech Stacks
For hackathons, speed of development and ease of integration are key:
- **Frontend:** React.js, Tailwind CSS, or Vite for blazing fast setups.
- **Backend:** Node.js with Express.js (extremely quick to write APIs).
- **Database:** MongoDB (schemaless, stores JSON structures directly) or PostgreSQL (if you need relational data).
- **Hosting:** Vercel (frontend) and Render (backend) for quick deployment.

**Mentor Tip:** Stick to technologies you already know. A hackathon is not the best place to learn a complex new language from scratch!`;
      } else if (msgLower.includes('pitch') || msgLower.includes('presentation') || msgLower.includes('slide') || msgLower.includes('demo')) {
        responseText = `### 🎤 Pitching & Presentation Guide
A winning hackathon pitch should cover the following points in under 3 minutes:
1. **The Hook:** Start with a compelling problem statement or a real-world story.
2. **The Solution:** Briefly demonstrate your application (show, don't just tell).
3. **Tech Stack & Architecture:** Briefly explain the technical design and integrations.
4. **Market & Impact:** Who will use this, and why does it matter?
5. **Future Roadmap:** How would you scale this post-hackathon?

**Mentor Tip:** Make sure your live demo works! If it's risky, prepare a backup video recording of the working app flow.`;
      } else {
        responseText = `### 👋 Hello! I am ChatMentor, your AI Hackathon guide.
I can help you with:
- **Project Ideas:** Ask me to suggest project concepts.
- **Tech Stack advice:** Get recommendations on databases, frameworks, and APIs.
- **Presentation Tips:** Learn how to pitch to judges and design slide decks.
- **Debugging & Architecture:** Ask about architectural patterns or task division.

How can I help you succeed today?`;
      }
    }
    res.json({ reply: responseText });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// 9b. AI Pitch Analyzer & Deck Scorer
app.post('/api/ai/pitch-analysis', authenticateToken, async (req, res) => {
  try {
    const { title, description, techStack, pitchScript, slideOutline } = req.body;
    if (!title || !pitchScript) {
      return res.status(400).json({ error: 'Project title and pitch script are required.' });
    }

    let responseJson = null;
    if (openai) {
      const promptText = `Act as an expert Hackathon Mentor and Venture Capital Pitch Coach. 
Analyze the following project pitch and slide details:
- Project Title: ${title}
- Description: ${description || 'Not provided'}
- Tech Stack: ${techStack || 'Not provided'}
- Slide Outline/Details: ${slideOutline || 'Not provided'}
- Pitch Script/Presentation Text: ${pitchScript}

Provide a comprehensive pitch assessment. Respond ONLY with a valid JSON object matching the following structure (no markdown boxes, no wrapper, just raw JSON):
{
  "scores": {
    "hook": 85,
    "techDepth": 75,
    "feasibility": 80,
    "flow": 90,
    "overall": 82
  },
  "feedback": {
    "strengths": [
      "Strength point 1",
      "Strength point 2"
    ],
    "gaps": [
      "Gap point 1",
      "Gap point 2"
    ],
    "suggestions": [
      "Improvement suggestion 1",
      "Improvement suggestion 2"
    ]
  },
  "refinedElevatorPitch": "A perfectly polished, compelling 100-word elevator pitch summarizing this project."
}
Return only JSON. Keep scores realistic and based on the input text. If the text is short or lacks detail, reflect it in lower scores and gap feedback. Ensure the scores are numbers (not strings).`;

      const completion = await openai.chat.completions.create({
        messages: [{ role: 'user', content: promptText }],
        model: 'gpt-4o-mini',
        response_format: { type: "json_object" }
      });
      
      const content = completion.choices[0].message.content;
      responseJson = JSON.parse(content);
    } else {
      // Smart Rule-based Fallback Generator
      const scriptLower = pitchScript.toLowerCase();
      const techLower = (techStack || '').toLowerCase();
      const descLower = (description || '').toLowerCase();
      
      // Calculate scores dynamically based on content presence
      let hookScore = 55;
      if (pitchScript.length > 300) hookScore += 15;
      if (scriptLower.includes('imagine') || scriptLower.includes('have you ever') || scriptLower.includes('problem') || scriptLower.includes('statist') || scriptLower.includes('percent')) {
        hookScore += 20;
      }
      hookScore = Math.min(100, hookScore);

      let techScore = 50;
      if (techLower.length > 5) techScore += 15;
      if (techLower.includes('react') || techLower.includes('node') || techLower.includes('express') || techLower.includes('mongodb') || techLower.includes('python') || techLower.includes('next.js') || techLower.includes('database') || techLower.includes('api')) {
        techScore += 20;
      }
      if (scriptLower.includes('architecture') || scriptLower.includes('database') || scriptLower.includes('endpoint') || scriptLower.includes('model')) {
        techScore += 10;
      }
      techScore = Math.min(100, techScore);

      let feasibilityScore = 60;
      if (pitchScript.length > 600) feasibilityScore += 10;
      if (scriptLower.includes('mvp') || scriptLower.includes('prototype') || scriptLower.includes('limit') || scriptLower.includes('scope') || scriptLower.includes('future')) {
        feasibilityScore += 15;
      }
      if (scriptLower.includes('blockchain') || scriptLower.includes('quantum') || scriptLower.includes('agi') || scriptLower.includes('everything')) {
        feasibilityScore -= 10; // overly ambitious
      }
      feasibilityScore = Math.max(30, Math.min(100, feasibilityScore));

      let flowScore = 50;
      if (pitchScript.length > 200) flowScore += 15;
      if (pitchScript.length > 500) flowScore += 15;
      if (scriptLower.includes('first') || scriptLower.includes('then') || scriptLower.includes('finally') || scriptLower.includes('conclude') || scriptLower.includes('thank you')) {
        flowScore += 15;
      }
      flowScore = Math.min(100, flowScore);

      const overallScore = Math.round((hookScore + techScore + feasibilityScore + flowScore) / 4);

      // Generate context-based feedback
      const strengths = [];
      const gaps = [];
      const suggestions = [];

      // Strengths
      if (pitchScript.length > 500) {
        strengths.push("Comprehensive script length providing context and detail.");
      } else {
        strengths.push("Concise presentation structure that respects the time limit.");
      }
      if (techLower.length > 5) {
        strengths.push(`Clearly identified tech stack: ${techStack}.`);
      }
      if (hookScore > 70) {
        strengths.push("Engaging hook that directly addresses a problem or paints a scenario.");
      } else {
        strengths.push("Good focus on the core value proposition.");
      }

      // Gaps
      if (pitchScript.length < 200) {
        gaps.push("Pitch script is too brief; lacks depth and explanation of execution.");
      }
      if (!techStack || techStack.length < 3) {
        gaps.push("Missing tech stack specifications or explanation of implementation tools.");
      }
      if (feasibilityScore < 65) {
        gaps.push("Lacks clarity on what is fully functional for the MVP vs future scope.");
      }
      if (gaps.length === 0) {
        gaps.push("Could provide more business viability and target user demographics.");
      }

      // Suggestions
      if (pitchScript.length < 250) {
        suggestions.push("Expand the script to address the user experience and explain the demo flow.");
      }
      if (techScore < 70) {
        suggestions.push("Explain *why* this specific stack was chosen over alternatives (e.g. speed, offline support).");
      }
      if (flowScore < 70) {
        suggestions.push("Structure the pitch chronologically: Hook ➔ Problem ➔ Solution ➔ Demo ➔ Tech Stack ➔ Team.");
      }
      suggestions.push("Practice the pacing to ensure you complete the demo with at least 30 seconds left for Q&A.");

      const elevatorPitch = `Meet ${title}: a smart solution engineered to solve ${description ? description.slice(0, 80) + '...' : 'a key workflow issue'} using ${techStack || 'a modern tech stack'}. By focusing on feasibility and a seamless user experience, our prototype delivers high impact right out of the box, resolving latency issues and offering a clean interface. We've built this as an MVP ready to scale, ensuring that the primary user pain points are resolved during the hackathon demo.`;

      responseJson = {
        scores: { hook: hookScore, techDepth: techScore, feasibility: feasibilityScore, flow: flowScore, overall: overallScore },
        feedback: { strengths, gaps, suggestions },
        refinedElevatorPitch: elevatorPitch
      };
    }

    res.json(responseJson);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// ==========================================
// SOLO REGISTRATION & AI MATCHMAKING ROUTES
// ==========================================

// GET /api/solo-registrants (Admin only)
app.get('/api/solo-registrants', authenticateToken, async (req, res) => {
  try {
    const registrants = await db.SoloRegistrant.find({ userId: req.userId }).populate('registeredEvent');
    res.json(registrants);
  } catch (error) { res.status(500).json({ error: error.message }); }
});

// POST /api/public/solo-registrants (Public)
app.post('/api/public/solo-registrants', async (req, res) => {
  try {
    const { name, email, skills, interests, registeredEvent } = req.body;
    const event = await db.Event.findById(registeredEvent);
    if (!event) return res.status(404).json({ error: 'Target Event not found' });

    const newSolo = await db.SoloRegistrant.create({
      name, email,
      skills: skills || [],
      interests: interests || [],
      registeredEvent,
      matchedTeam: null,
      userId: event.userId // Inherit userId from event
    });
    res.status(201).json({ message: 'Solo registration successful', solo: newSolo });
  } catch (error) { res.status(400).json({ error: error.message }); }
});

// DELETE /api/solo-registrants/:id (Admin only)
app.delete('/api/solo-registrants/:id', authenticateToken, async (req, res) => {
  try {
    const deleted = await db.SoloRegistrant.findByIdAndDelete(req.params.id);
    if (!deleted) return res.status(404).json({ error: 'Solo registrant not found' });
    res.json({ message: 'Solo registrant deleted successfully', solo: deleted });
  } catch (error) { res.status(500).json({ error: error.message }); }
});

// POST /api/solo-registrants/match (Admin only: Skill-based matchmaking suggestions)
app.post('/api/solo-registrants/match', authenticateToken, async (req, res) => {
  try {
    const { eventId, targetTeamSize = 3 } = req.body;
    if (!eventId) return res.status(400).json({ error: 'eventId is required' });

    const unmatched = await db.SoloRegistrant.find({ userId: req.userId, registeredEvent: eventId, matchedTeam: null });
    if (unmatched.length === 0) return res.json({ message: 'No unmatched solo registrants found for this event.', matches: [] });

    // Local heuristic skill-balancing matchmaking algorithm
    const pool = [...unmatched];
    const suggestions = [];
    let groupIndex = 1;

    while (pool.length > 0) {
      const currentTeam = [];
      const leader = pool.shift();
      currentTeam.push(leader);

      const existingSkills = new Set(leader.skills || []);

      while (currentTeam.length < targetTeamSize && pool.length > 0) {
        let bestCandidateIndex = -1;
        let minimumOverlap = Infinity;

        for (let i = 0; i < pool.length; i++) {
          const candidate = pool[i];
          let overlapCount = 0;
          
          (candidate.skills || []).forEach(skill => {
            if (existingSkills.has(skill)) overlapCount++;
          });

          if (overlapCount < minimumOverlap) {
            minimumOverlap = overlapCount;
            bestCandidateIndex = i;
          }
        }

        if (bestCandidateIndex !== -1) {
          const member = pool.splice(bestCandidateIndex, 1)[0];
          currentTeam.push(member);
          (member.skills || []).forEach(skill => existingSkills.add(skill));
        } else {
          break;
        }
      }

      suggestions.push({
        id: `suggested-team-${groupIndex++}`,
        name: `AI Match Team ${groupIndex - 1}`,
        members: currentTeam
      });
    }

    res.json({ message: `Suggested ${suggestions.length} team matchings.`, matches: suggestions });
  } catch (error) { res.status(500).json({ error: error.message }); }
});

// POST /api/solo-registrants/confirm-match (Admin only: Confirm preview suggestion and batch-create Teams)
app.post('/api/solo-registrants/confirm-match', authenticateToken, async (req, res) => {
  try {
    const { eventId, matches } = req.body;
    if (!eventId) return res.status(400).json({ error: 'eventId is required' });
    if (!matches || !Array.isArray(matches) || matches.length === 0) return res.status(400).json({ error: 'Suggested matches are required' });

    const event = await db.Event.findById(eventId);
    if (!event) return res.status(404).json({ error: 'Event not found' });

    const createdTeams = [];

    for (const match of matches) {
      if (!match.members || match.members.length === 0) continue;

      const leader = match.members[0];
      const otherMembers = match.members.slice(1).map(m => ({
        name: m.name,
        email: m.email
      }));

      // Create a Team record
      const newTeam = await db.Team.create({
        name: match.name || `Match Team ${Math.floor(Math.random() * 1000)}`,
        leaderName: leader.name,
        leaderEmail: leader.email,
        members: otherMembers,
        registeredEvent: eventId,
        attendedEvents: [],
        userId: req.userId
      });

      // Mark all matched solo registrants
      for (const m of match.members) {
        await db.SoloRegistrant.findByIdAndUpdate(m._id, { matchedTeam: newTeam._id });
      }

      // Generate Access QR Code pass
      const qrData = JSON.stringify({ teamId: newTeam._id, eventId: event._id, teamName: newTeam.name, eventName: event.title });
      const qrCodeDataUrl = await qrcode.toDataURL(qrData);

      // Async email trigger
      sendTicketEmail(newTeam, event.title, qrCodeDataUrl).catch(console.error);

      createdTeams.push({
        team: newTeam,
        qrCode: qrCodeDataUrl
      });
    }

    res.status(201).json({ message: `Successfully formed ${createdTeams.length} teams.`, teams: createdTeams });
  } catch (error) { res.status(500).json({ error: error.message }); }
});

// Route for simple server status check
app.get('/api/status', (req, res) => {
  res.json({
    status: 'online',
    appName: 'ClubPulse API Server',
    databaseConnected: db.getIsConnected(),
    useMockFallback: db.getUseMock(),
    timestamp: new Date()
  });
});

// Headless fallback on Root
app.get('/', (req, res) => {
  res.sendFile(path.join(publicPath, 'landing.html'));
});

// Start server
db.connectDb().then(() => {
  app.listen(PORT, () => {
    console.log(`ClubPulse server running on port ${PORT}`);
    console.log(`API endpoints available at http://localhost:${PORT}/api`);
    console.log(`Landing page: http://localhost:${PORT}/landing.html`);
  });
});
