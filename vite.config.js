import react from '@vitejs/plugin-react'
import { defineConfig } from 'vite'
import { Buffer } from 'node:buffer'
import path from 'node:path'
import process from 'node:process'
import { pathToFileURL } from 'node:url'

/**
 * Custom Vite dev server plugin to emulate Vercel serverless function
 * execution for /api/erp/attendance during local development (npm run dev).
 */
function dsuErpDevProxyPlugin() {
  return {
    name: 'dsu-erp-dev-proxy',
    configureServer(server) {
      server.middlewares.use(async (req, res, next) => {
        const url = req.url ? req.url.split('?')[0].replace(/\/+$/, '') : '';

        if (url === '/api/erp/attendance') {
          // Handle CORS preflight
          if (req.method === 'OPTIONS') {
            res.statusCode = 204;
            res.setHeader('Access-Control-Allow-Origin', '*');
            res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
            res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
            res.end();
            return;
          }

          // Enforce POST method
          if (req.method !== 'POST') {
            res.statusCode = 405;
            res.setHeader('Content-Type', 'application/json');
            res.end(JSON.stringify({ success: false, error: 'Method Not Allowed' }));
            return;
          }

          try {
            // 1. Buffer and parse JSON request stream with size ceiling
            const MAX_BODY_BYTES = 64 * 1024; // 64 KB
            let totalBytes = 0;
            const chunks = [];
            for await (const chunk of req) {
              totalBytes += chunk.length;
              if (totalBytes > MAX_BODY_BYTES) {
                res.statusCode = 413;
                res.setHeader('Content-Type', 'application/json');
                res.end(JSON.stringify({ success: false, error: 'Payload Too Large' }));
                return;
              }
              chunks.push(chunk);
            }
            const rawBody = Buffer.concat(chunks).toString('utf-8');
            if (rawBody.trim()) {
              let parsed;
              try {
                parsed = JSON.parse(rawBody);
              } catch {
                res.statusCode = 400;
                res.setHeader('Content-Type', 'application/json');
                res.end(JSON.stringify({ success: false, error: 'Malformed JSON payload' }));
                return;
              }

              // Reject JSON primitives, null, or arrays
              if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) {
                res.statusCode = 400;
                res.setHeader('Content-Type', 'application/json');
                res.end(JSON.stringify({
                  success: false,
                  error: 'Request body must be a JSON object with username and password',
                }));
                return;
              }

              req.body = parsed;
            } else {
              req.body = {};
            }

            // 2. Attach Vercel response helper polyfills
            if (!res.status) {
              res.status = function (code) {
                res.statusCode = code;
                return res;
              };
            }
            if (!res.json) {
              res.json = function (data) {
                if (!res.getHeader('Content-Type')) {
                  res.setHeader('Content-Type', 'application/json');
                }
                res.end(JSON.stringify(data));
                return res;
              };
            }

            // 3. Dynamically import handler using absolute file URL (immune to Vite temp config paths)
            const rootDir = server.config?.root || process.cwd();
            const apiPath = path.resolve(rootDir, 'api/erp/attendance.js');
            const fileUrl = `${pathToFileURL(apiPath).href}?t=${Date.now()}`;
            const { default: handler } = await import(fileUrl);
            await handler(req, res);
          } catch (err) {
            console.error('[dsuErpDevProxyPlugin] Error:', err);
            if (!res.headersSent) {
              res.statusCode = 500;
              res.setHeader('Content-Type', 'application/json');
              res.end(JSON.stringify({
                success: false,
                error: err.message || 'Internal Dev Server Proxy Error',
              }));
            }
          }
        } else {
          next();
        }
      });
    },
  };
}

// https://vite.dev/config/
export default defineConfig({
  plugins: [react(), dsuErpDevProxyPlugin()],
})
