#!/bin/bash
# =============================================================
# Script de despliegue de Clawdbot API Server para EC2
# =============================================================
# INSTRUCCIONES:
# 1. Abre la consola de AWS: https://console.aws.amazon.com
# 2. Ve a EC2 > Instances > selecciona tu instancia
# 3. Click "Connect" (arriba) > "EC2 Instance Connect" > "Connect"
# 4. Se abrira una terminal en tu navegador
# 5. Copia y pega TODO este script en esa terminal
# =============================================================

echo "=== Instalando Clawdbot API Server ==="

# Crear directorio para el servidor
mkdir -p ~/clawdbot-server
cd ~/clawdbot-server

# Crear el archivo del servidor HTTP
cat > clawdbot-server.js << 'SERVEREOF'
const http = require('http');
const { exec } = require('child_process');
const url = require('url');

const PORT = 3000;
const CLAWDBOT_PATH = process.env.CLAWDBOT_PATH || '/home/ubuntu/.npm-global/bin/clawdbot';
const AUTH_TOKEN = process.env.AUTH_TOKEN || 'mi-token-secreto-12345';

function executeClawdbot(message, sessionId = 'main') {
  return new Promise((resolve, reject) => {
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

function parseBody(req) {
  return new Promise((resolve, reject) => {
    let body = '';
    req.on('data', chunk => body += chunk);
    req.on('end', () => {
      try { resolve(body ? JSON.parse(body) : {}); }
      catch (e) { reject(new Error('Invalid JSON')); }
    });
    req.on('error', reject);
  });
}

function verifyAuth(req) {
  const authHeader = req.headers.authorization;
  if (!authHeader || !authHeader.startsWith('Bearer ')) return false;
  return authHeader.slice(7) === AUTH_TOKEN;
}

function setCorsHeaders(res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');
}

const server = http.createServer(async (req, res) => {
  setCorsHeaders(res);
  if (req.method === 'OPTIONS') { res.writeHead(204); res.end(); return; }
  const parsedUrl = url.parse(req.url, true);

  if (parsedUrl.pathname === '/health' && req.method === 'GET') {
    exec(`${CLAWDBOT_PATH} --version 2>/dev/null`, (error, stdout) => {
      const version = stdout ? stdout.trim() : 'unknown';
      res.writeHead(200, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ status: 'ok', service: 'clawdbot-api', clawdbot: version || 'running' }));
    });
    return;
  }

  if (parsedUrl.pathname === '/chat' && req.method === 'POST') {
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
      res.end(JSON.stringify({ success: true, ok: true, response, sessionId: sessionId || 'main' }));
    } catch (error) {
      res.writeHead(500, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ error: error.message }));
    }
    return;
  }

  if (parsedUrl.pathname === '/session/reset' && req.method === 'POST') {
    if (!verifyAuth(req)) {
      res.writeHead(401, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ error: 'Unauthorized' }));
      return;
    }
    try {
      const body = await parseBody(req);
      await executeClawdbot('/new', body.sessionId || 'main');
      res.writeHead(200, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ ok: true, message: 'Session reset' }));
    } catch (error) {
      res.writeHead(500, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ error: error.message }));
    }
    return;
  }

  res.writeHead(404, { 'Content-Type': 'application/json' });
  res.end(JSON.stringify({ error: 'Not found' }));
});

server.listen(PORT, '0.0.0.0', () => {
  console.log(`Clawdbot API Server running on port ${PORT}`);
  console.log(`  Health: http://localhost:${PORT}/health`);
  console.log(`  Chat:   POST http://localhost:${PORT}/chat`);
});
SERVEREOF

echo "=== Archivo creado: ~/clawdbot-server/clawdbot-server.js ==="

# Instalar PM2 si no esta instalado
if ! command -v pm2 &> /dev/null; then
  echo "=== Instalando PM2 (para mantener el servidor activo) ==="
  sudo npm install -g pm2
fi

# Detener servidor anterior si existe
pm2 delete clawdbot-api 2>/dev/null || true

# Iniciar el servidor con PM2
echo "=== Iniciando servidor en puerto 3000 ==="
pm2 start ~/clawdbot-server/clawdbot-server.js --name "clawdbot-api"

# Configurar PM2 para que inicie automaticamente al reiniciar EC2
pm2 save
sudo env PATH=$PATH:/usr/bin pm2 startup systemd -u ubuntu --hp /home/ubuntu 2>/dev/null || true
pm2 save

echo ""
echo "=== LISTO! ==="
echo ""
echo "Servidor corriendo en puerto 3000"
echo "Prueba: curl http://localhost:3000/health"
echo ""
echo "IMPORTANTE: Ahora debes abrir el puerto 3000 en AWS Security Group"
echo "  1. Ve a EC2 > Security Groups"
echo "  2. Selecciona el Security Group de tu instancia"
echo "  3. Edit inbound rules > Add rule"
echo "  4. Type: Custom TCP, Port: 3000, Source: 0.0.0.0/0"
echo "  5. Save rules"
echo ""

# Verificar que funciona
echo "=== Verificando servidor ==="
sleep 2
curl -s http://localhost:3000/health | python3 -m json.tool 2>/dev/null || curl -s http://localhost:3000/health
echo ""
echo "=== Despliegue completado! ==="
