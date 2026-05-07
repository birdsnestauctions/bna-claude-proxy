const express = require('express');
const https = require('https');

const app = express();
const PORT = process.env.PORT || 3000;
const ANTHROPIC_KEY = process.env.ANTHROPIC_API_KEY || '';
const ALLOWED_ORIGIN = 'https://birdsnestauctions.github.io';

// CORS
app.use((req, res, next) => {
  res.setHeader('Access-Control-Allow-Origin', ALLOWED_ORIGIN);
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  if (req.method === 'OPTIONS') return res.sendStatus(204);
  next();
});

app.use(express.json());

// Health check
app.get('/', (req, res) => {
  res.send('BNA Claude Proxy is running.');
});

// Proxy endpoint
app.post('/v1/messages', (req, res) => {
  if (!ANTHROPIC_KEY) {
    return res.status(500).json({ error: { message: 'API key not configured on server.' } });
  }

  const body = JSON.stringify(req.body);

  const options = {
    hostname: 'api.anthropic.com',
    path: '/v1/messages',
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'x-api-key': ANTHROPIC_KEY,
      'anthropic-version': '2023-06-01',
      'Content-Length': Buffer.byteLength(body),
    }
  };

  const proxyReq = https.request(options, proxyRes => {
    let data = '';
    proxyRes.on('data', chunk => { data += chunk; });
    proxyRes.on('end', () => {
      res.status(proxyRes.statusCode).json(JSON.parse(data));
    });
  });

  proxyReq.on('error', err => {
    console.error('Proxy error:', err.message);
    res.status(502).json({ error: { message: 'Proxy error: ' + err.message } });
  });

  proxyReq.write(body);
  proxyReq.end();
});

// Catch-all — logs any unmatched routes so you can see what's hitting the proxy
app.use((req, res) => {
  console.log(`Unmatched request: ${req.method} ${req.url}`);
  res.status(404).send('Not found');
});

app.listen(PORT, () => {
  console.log('BNA Claude Proxy running on port ' + PORT);
});
