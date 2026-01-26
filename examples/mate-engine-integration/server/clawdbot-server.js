/**
 * Clawdbot HTTP Server
 * Simple HTTP wrapper for Clawdbot CLI to enable direct communication from Mate-Engine
 *
 * Run on EC2: node clawdbot-server.js
 * Or with PM2: pm2 start clawdbot-server.js --name clawdbot-api
 */

const http = require('http');
const { exec } = require('child_process');
const url = require('url');

// Configuration
const PORT = process.env.PORT || 3000;
const CLAWDBOT_PATH = '/home/ubuntu/.npm-global/bin/clawdbot';
const AUTH_TOKEN = process.env.AUTH_TOKEN || 'your-secret-token-here';

/**
 * Execute Clawdbot CLI and return response
 */
function executeClawdbot(message, sessionId = 'main') {
  return new Promise((resolve, reject) => {
    // Escape special characters for shell
    const escapedMessage = message
      .replace(/\\/g, '\\\\')
      .replace(/"/g, '\\"')
      .replace(/\$/g, '\\$')
      .replace(/`/g, '\\`')
      .replace(/\n/g, ' ');

    const cmd = `${CLAWDBOT_PATH} agent --message "${escapedMessage}" --session-id ${sessionId} 2>/dev/null | grep -v '^[│◇🦞]' | grep -v '^$' | tail -n 1`;

    exec(cmd, { timeout: 60000 }, (error, stdout, stderr) => {
      if (error && !stdout) {
        reject(new Error(`Clawdbot error: ${error.message}`));
        return;
      }
      resolve(stdout.trim());
    });
  });
}

/**
 * Parse JSON body from request
 */
function parseBody(req) {
  return new Promise((resolve, reject) => {
    let body = '';
    req.on('data', chunk => body += chunk);
    req.on('end', () => {
      try {
        resolve(body ? JSON.parse(body) : {});
      } catch (e) {
        reject(new Error('Invalid JSON'));
      }
    });
    req.on('error', reject);
  });
}

/**
 * Verify authentication token
 */
function verifyAuth(req) {
  const authHeader = req.headers.authorization;
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return false;
  }
  return authHeader.slice(7) === AUTH_TOKEN;
}

/**
 * CORS headers
 */
function setCorsHeaders(res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');
}

/**
 * HTTP Server
 */
const server = http.createServer(async (req, res) => {
  setCorsHeaders(res);

  // Handle CORS preflight
  if (req.method === 'OPTIONS') {
    res.writeHead(204);
    res.end();
    return;
  }

  const parsedUrl = url.parse(req.url, true);

  // Health check endpoint
  if (parsedUrl.pathname === '/health' && req.method === 'GET') {
    res.writeHead(200, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({ status: 'ok', service: 'clawdbot-api' }));
    return;
  }

  // Chat endpoint
  if (parsedUrl.pathname === '/chat' && req.method === 'POST') {
    // Verify authentication
    if (!verifyAuth(req)) {
      res.writeHead(401, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ error: 'Unauthorized' }));
      return;
    }

    try {
      const body = await parseBody(req);
      const { message, sessionId } = body;

      if (!message) {
        res.writeHead(400, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ error: 'Message is required' }));
        return;
      }

      const response = await executeClawdbot(message, sessionId || 'main');

      res.writeHead(200, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({
        ok: true,
        response,
        sessionId: sessionId || 'main'
      }));
    } catch (error) {
      res.writeHead(500, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ error: error.message }));
    }
    return;
  }

  // New session endpoint
  if (parsedUrl.pathname === '/session/reset' && req.method === 'POST') {
    if (!verifyAuth(req)) {
      res.writeHead(401, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ error: 'Unauthorized' }));
      return;
    }

    try {
      const body = await parseBody(req);
      const { sessionId } = body;

      await executeClawdbot('/new', sessionId || 'main');

      res.writeHead(200, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ ok: true, message: 'Session reset' }));
    } catch (error) {
      res.writeHead(500, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ error: error.message }));
    }
    return;
  }

  // 404 for other routes
  res.writeHead(404, { 'Content-Type': 'application/json' });
  res.end(JSON.stringify({ error: 'Not found' }));
});

server.listen(PORT, '0.0.0.0', () => {
  console.log(`🦞 Clawdbot API Server running on port ${PORT}`);
  console.log(`   Health: http://localhost:${PORT}/health`);
  console.log(`   Chat:   POST http://localhost:${PORT}/chat`);
  console.log(`   Reset:  POST http://localhost:${PORT}/session/reset`);
});
