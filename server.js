require('dotenv').config();
const express = require('express');
const cors = require('cors');
const { Resend } = require('@resend/node');

const app = express();
app.use(cors());
app.use(express.json({ limit: '2mb' }));

const resend = new Resend(process.env.RESEND_API_KEY);
const FROM_EMAIL = process.env.FROM_EMAIL || 'Roots Recruitment <onboarding@resend.dev>';

app.post('/api/send-email', async (req, res) => {
  const { to, subject, html } = req.body;
  if (!to || !subject || !html) {
    return res.status(400).json({ error: 'Missing required fields: to, subject, html' });
  }
  try {
    const { data, error } = await resend.emails.send({ from: FROM_EMAIL, to, subject, html });
    if (error) return res.status(400).json({ error });
    res.json({ success: true, id: data.id });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.post('/api/send-emails-bulk', async (req, res) => {
  const { emails } = req.body;
  if (!Array.isArray(emails) || emails.length === 0) {
    return res.status(400).json({ error: 'emails must be a non-empty array' });
  }
  const results = [];
  for (const email of emails) {
    try {
      const { data, error } = await resend.emails.send({
        from: FROM_EMAIL,
        to: email.to,
        subject: email.subject,
        html: email.html,
      });
      results.push({ email: email.to, success: !error, id: data?.id, error: error?.message });
    } catch (err) {
      results.push({ email: email.to, success: false, error: err.message });
    }
  }
  res.json({ results });
});

const PORT = process.env.PORT || 3001;
app.listen(PORT, () => console.log(`Email server running on port ${PORT}`));
