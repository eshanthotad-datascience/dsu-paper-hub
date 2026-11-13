/**
 * DSU Paper Hub - Lightweight Zero-Dependency HTTP Mock Server
 * Emulates Dayananda Sagar University (DSU) GNUMS ERP Portal and Proxy API
 */

import http from 'node:http';
import { MOCK_HTML, MOCK_FIXTURES, MOCK_JSON } from './fixtures.js';
import realProxyHandler from '../../../api/erp/attendance.js';

export const MOCK_CONFIG = {
  defaultPort: 3456
};

export class ErpMockServer {
  constructor(options = {}) {
    this.port = options.port || 0; // 0 = ephemeral dynamic port
    this.server = null;
    this.activeSessions = new Set([MOCK_FIXTURES.sessionId]);
    this.faults = new Map();
    this.tableVariant = 'valid'; // 'valid' | 'zeroClasses' | 'atRisk' | 'highPerformer' | 'malformed'
    this.requestLog = [];
    this.baseUrl = '';
  }

  setFault(path, faultConfig) {
    this.faults.set(path, faultConfig);
  }

  clearFaults() {
    this.faults.clear();
  }

  setTableVariant(variant) {
    this.tableVariant = variant;
  }

  getRequestLog() {
    return [...this.requestLog];
  }

  clearRequestLog() {
    this.requestLog = [];
  }

  async start() {
    return new Promise((resolve, reject) => {
      this.server = http.createServer((req, res) => this.handleRequest(req, res));
      this.server.listen(this.port, '127.0.0.1', () => {
        const addr = this.server.address();
        this.port = addr.port;
        this.baseUrl = `http://127.0.0.1:${this.port}`;
        resolve(this);
      });
      this.server.on('error', reject);
    });
  }

  async stop() {
    return new Promise((resolve) => {
      if (this.server) {
        this.server.close(() => resolve());
      } else {
        resolve();
      }
    });
  }

  async handleRequest(req, res) {
    const url = new URL(req.url, `http://${req.headers.host || '127.0.0.1'}`);
    const pathname = url.pathname;

    this.requestLog.push({
      method: req.method,
      path: pathname,
      headers: req.headers,
      time: Date.now()
    });

    // Check fault injection
    if (this.faults.has(pathname)) {
      const fault = this.faults.get(pathname);
      if (fault.delay) {
        await new Promise(r => setTimeout(r, fault.delay));
      }
      if (fault.status) {
        res.writeHead(fault.status, { 'Content-Type': fault.contentType || 'text/plain' });
        res.end(fault.body || 'Simulated Server Error');
        return;
      }
    }

    // Direct simulation endpoints for Tier 3 & Tier 4 tests
    if (pathname === '/api/erp/simulate-504') {
      res.writeHead(504, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ success: false, error: 'ERP portal gateway timeout' }));
      return;
    }

    if (pathname === '/api/erp/simulate-503') {
      res.writeHead(503, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({
        success: false,
        error: 'DSU ERP portal is currently undergoing scheduled maintenance. Please try again after 12:30 AM IST.'
      }));
      return;
    }

    // 1. Handshake GET /Login.aspx/DSU
    if (req.method === 'GET' && pathname.includes('/Login.aspx')) {
      res.writeHead(200, {
        'Content-Type': 'text/html; charset=utf-8',
        'Set-Cookie': ['ASP.NET_SessionId=init_handshake_cookie; path=/; HttpOnly']
      });
      res.end(MOCK_HTML.loginPage);
      return;
    }

    // 2. Auth POST /Login.aspx/DSU
    if (req.method === 'POST' && pathname.includes('/Login.aspx')) {
      let body = '';
      req.on('data', chunk => { body += chunk; });
      req.on('end', () => {
        const params = new URLSearchParams(body);
        const username = params.get('txtUsername') || '';
        const password = params.get('txtPassword') || '';
        const role = params.get('rblRole') || '';

        // Empty credentials check
        if (!username && !password) {
          res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8' });
          res.end(MOCK_HTML.loginPage);
          return;
        }

        // Valid credential check (support both plain valid password and special char password)
        const isValidUser = username.trim().toUpperCase() === MOCK_FIXTURES.validUSN.toUpperCase();
        const isValidPass = password === MOCK_FIXTURES.validPassword || password === '6$0$75659N#&%+=';

        if (isValidUser && isValidPass) {
          const newSessionId = `mock_session_${Date.now()}`;
          this.activeSessions.add(newSessionId);
          res.writeHead(302, {
            'Location': '/StudentPanel/StudentDashboard.aspx',
            'Set-Cookie': [
              `ASP.NET_SessionId=${newSessionId}; path=/; HttpOnly; SameSite=Lax`,
              `NCBL=${MOCK_FIXTURES.ncblToken}; path=/; HttpOnly; SameSite=Lax`
            ]
          });
          res.end();
        } else {
          // Invalid credentials -> 200 OK with #ucMessage_lblError
          res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8' });
          res.end(MOCK_HTML.loginError);
        }
      });
      return;
    }

    // 3. Attendance GET /StudentPanel/TTM_Attendance/TTM_Attendance_StudentAttendance.aspx
    if (req.method === 'GET' && pathname.includes('/TTM_Attendance_StudentAttendance.aspx')) {
      const cookieHeader = req.headers['cookie'] || '';
      const hasValidSession = Array.from(this.activeSessions).some(sess => cookieHeader.includes(sess));

      if (!hasValidSession) {
        res.writeHead(302, { 'Location': '/Login.aspx' });
        res.end();
        return;
      }

      res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8' });
      let html = MOCK_HTML.attendanceValid;
      if (this.tableVariant === 'zeroClasses') html = MOCK_HTML.attendanceZeroClasses;
      if (this.tableVariant === 'atRisk') html = MOCK_HTML.attendanceAtRisk;
      if (this.tableVariant === 'highPerformer') html = MOCK_HTML.attendanceHighPerformer;
      if (this.tableVariant === 'malformed') html = MOCK_HTML.attendanceMalformed;
      res.end(html);
      return;
    }

    // 4. Proxy API /api/erp/attendance - Genuine delegation to production handler
    if (pathname === '/api/erp/attendance') {
      return await realProxyHandler(req, res);
    }

    // 404 Fallback
    res.writeHead(404, { 'Content-Type': 'text/plain' });
    res.end('Not Found');
  }
}

export async function startMockErpServer(options = {}) {
  const server = new ErpMockServer(options);
  await server.start();
  return server;
}

export async function stopMockErpServer(server) {
  if (server) await server.stop();
}

export default ErpMockServer;
