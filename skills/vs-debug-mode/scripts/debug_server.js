#!/usr/bin/env node
/**
 * Debug Log Server
 *
 * Endpoints:
 *   POST /session { name: "fix-null-user" } → { session_id: "fix-null-user-a1b2c3", log_file: "..." }
 *   POST /log { sessionId: "...", msg: "...", data: {...} } → { ok: true }
 *   GET / → { status: "ok", log_dir: "..." }
 *
 * Usage:
 *     node debug_server.js /path/to/project
 *
 * Environment:
 *     DEBUG_LOG_DIR - Override log subdirectory (default: .debug)
 *     DEBUG_PORT    - Override port (default: 8787)
 */
const http = require('http');
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const { execSync } = require('child_process');

const generateId = () => crypto.randomBytes(3).toString('hex');

// Normalize name to kebab-case: "Fix Null User" → "fix-null-user"
const toKebabCase = (str) =>
  str
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-') // non-alphanumeric → dash
    .replace(/-+/g, '-')          // multiple dashes → single
    .replace(/^-|-$/g, '');       // trim leading/trailing dashes

const PROJECT_DIR = process.argv[2] || '.';
const LOG_SUBDIR = process.env.DEBUG_LOG_DIR || '.debug';
const LOG_DIR = path.resolve(PROJECT_DIR, LOG_SUBDIR);
const PORT = parseInt(process.env.DEBUG_PORT || '8787', 10);
const HOST = process.env.DEBUG_HOST || '127.0.0.1';
const SAFE_SESSION_ID = /^[a-z0-9][a-z0-9-]{0,79}$/;
const LOCAL_ORIGIN = /^https?:\/\/(localhost|127\.0\.0\.1|\[::1\])(?::\d+)?$/;

// Check if server already running
(async () => {
  try {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 500);
    const res = await fetch(`http://${HOST}:${PORT}`, { signal: controller.signal });
    clearTimeout(timeout);
    if (res.ok) {
      // Server already running - output JSON and exit successfully
      console.log(JSON.stringify({
        status: 'already_running',
        log_dir: LOG_DIR,
        endpoint: `http://${HOST}:${PORT}/log`,
      }));
      process.exit(0);
    }
  } catch {}

  // Cleanup stale port (crash recovery)
  try {
    const pid = execSync(`lsof -ti:${PORT}`, { encoding: 'utf-8' }).trim();
    if (pid) {
      execSync(`kill -9 ${pid}`);
    }
  } catch {}

  startServer();
})();

function startServer() {
  fs.mkdirSync(LOG_DIR, { recursive: true });

  const getLogFile = (sessionId) => {
    if (!SAFE_SESSION_ID.test(sessionId)) {
      throw new Error('Invalid sessionId');
    }

    const logFile = path.resolve(LOG_DIR, `debug-${sessionId}.log`);
    const relative = path.relative(LOG_DIR, logFile);
    if (relative.startsWith('..') || path.isAbsolute(relative)) {
      throw new Error('Invalid log path');
    }

    return logFile;
  };

  const corsHeaders = (req) => {
    const cors = {
      'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type',
    };
    const origin = req.headers.origin;
    if (origin && LOCAL_ORIGIN.test(origin)) {
      cors['Access-Control-Allow-Origin'] = origin;
    }
    return cors;
  };

  const server = http.createServer((req, res) => {
    const cors = corsHeaders(req);

    if (req.method === 'OPTIONS') {
      res.writeHead(204, cors);
      res.end();
      return;
    }

    if (req.method === 'GET') {
      res.writeHead(200, { 'Content-Type': 'application/json', ...cors });
      res.end(JSON.stringify({
        status: 'ok',
        log_dir: LOG_DIR,
      }));
      return;
    }

    // Create new session: POST /session { name: "fix-null-user" }
    if (req.method === 'POST' && req.url === '/session') {
      let body = '';
      req.on('data', chunk => (body += chunk));
      req.on('end', () => {
        try {
          const data = body ? JSON.parse(body) : {};
          const name = toKebabCase(data.name || 'debug').slice(0, 64) || 'debug';
          const sessionId = `${name}-${generateId()}`;
          const logFile = getLogFile(sessionId);

          // Create empty log file
          fs.writeFileSync(logFile, '');

          res.writeHead(200, { 'Content-Type': 'application/json', ...cors });
          res.end(JSON.stringify({
            session_id: sessionId,
            log_file: logFile,
          }));

          console.log(`[session] Created: ${sessionId}`);
        } catch (e) {
          res.writeHead(400, { 'Content-Type': 'application/json', ...cors });
          res.end(JSON.stringify({ error: e.message }));
        }
      });
      return;
    }

    // Log message: POST /log { sessionId: "...", msg: "...", data: {...} }
    if (req.method === 'POST' && req.url === '/log') {
      let body = '';
      req.on('data', chunk => (body += chunk));
      req.on('end', () => {
        try {
          const data = body ? JSON.parse(body) : {};
          const sessionId = data.sessionId || 'default';
          const logFile = getLogFile(sessionId);

          // Remove sessionId from stored entry (it's in filename)
          const { sessionId: _, ...rest } = data;
          const entry = { ts: new Date().toISOString(), ...rest };

          fs.appendFileSync(logFile, JSON.stringify(entry) + '\n');

          res.writeHead(200, { 'Content-Type': 'application/json', ...cors });
          res.end(JSON.stringify({ ok: true, log_file: logFile }));

          console.log(`[${sessionId}] ${entry.msg || JSON.stringify(entry).slice(0, 80)}`);
        } catch (e) {
          res.writeHead(400, { 'Content-Type': 'application/json', ...cors });
          res.end(JSON.stringify({ error: e.message }));
        }
      });
      return;
    }

    res.writeHead(404, cors);
    res.end('Not found');
  });

  server.listen(PORT, HOST, () => {
    // Output JSON for easy parsing by agent
    console.log(JSON.stringify({
      status: 'started',
      log_dir: LOG_DIR,
      endpoint: `http://${HOST}:${PORT}/log`,
    }));
  });
}
