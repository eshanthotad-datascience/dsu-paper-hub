/**
 * tests/adversarial_m1_stress.mjs
 * Comprehensive Adversarial Stress-Test Suite for Milestone 1: ERP Authentication & Proxy Service
 *
 * Authored by: challenger_m1_1 (Empirical Challenger)
 * Tests:
 * 1. Live DSU ERP Authentication (valid creds, session cookie verification)
 * 2. Invalid passwords & non-existent USNs (HTTP 401)
 * 3. Empty credentials, missing fields, non-string types, malformed/non-JSON bodies (HTTP 400)
 * 4. Passwords and USNs with required special characters ($, &, #, %) and combinations
 * 5. Boundary inputs: SQL injection (' OR '1'='1, admin' --), XSS (<script>), long strings (5,000 chars)
 * 6. Timeout and unreachable upstream portal resilience (HTTP 502/504)
 * 7. HTTP method restrictions (GET, PUT, DELETE -> 405; OPTIONS -> 204)
 * 8. Real Vite dev server proxy integration tests over dynamic ephemeral TCP socket
 * 9. Concurrency / race condition stress test (5 simultaneous requests)
 * 10. Robustness of HTML token extraction and attendance parsing functions
 */

import { createServer } from 'vite';
import handler, {
  authenticateDsuErp,
  extractAspToken,
  extractErrorMessage,
  parseCookies,
  parseAttendanceHtml
} from '../api/erp/attendance.js';

const LIVE_USN = '26UGENG2182';
const LIVE_PASS = '6$0$75659N';

let testsRun = 0;
let testsPassed = 0;
let testsFailed = 0;
const failures = [];

function assert(condition, message) {
  testsRun++;
  if (!condition) {
    testsFailed++;
    failures.push(message);
    console.error(`  ❌ FAILED: ${message}`);
  } else {
    testsPassed++;
    console.log(`  ✅ PASSED: ${message}`);
  }
}

function createMockRes() {
  return {
    statusCode: 200,
    headers: {},
    body: null,
    setHeader(k, v) {
      this.headers[k.toLowerCase()] = v;
      return this;
    },
    getHeader(k) {
      return this.headers[k.toLowerCase()];
    },
    status(code) {
      this.statusCode = code;
      return this;
    },
    json(data) {
      this.body = data;
      return this;
    },
    end(data) {
      if (data && typeof data === 'string') {
        try { this.body = JSON.parse(data); } catch { this.body = data; }
      }
      return this;
    }
  };
}

async function runTestGroup(name, fn) {
  console.log(`\n============================================================`);
  console.log(`TEST GROUP: ${name}`);
  console.log(`============================================================`);
  try {
    await fn();
  } catch (err) {
    testsFailed++;
    failures.push(`Unhandled error in group "${name}": ${err.message}`);
    console.error(`  💥 UNHANDLED EXCEPTION in ${name}:`, err);
  }
}

async function main() {
  console.log('Starting Milestone 1 Adversarial Stress-Test Suite...');
  const startTime = Date.now();

  // -------------------------------------------------------------------------
  // GROUP 1: Unit & Edge Robustness of Pure Extraction Helpers
  // -------------------------------------------------------------------------
  await runTestGroup('Unit & Extraction Edge Cases', async () => {
    // 1.1 extractAspToken handles null, empty, malformed
    assert(extractAspToken(null, '__VIEWSTATE') === '', 'extractAspToken(null) returns empty string');
    assert(extractAspToken('', '__VIEWSTATE') === '', 'extractAspToken("") returns empty string');
    assert(extractAspToken(12345, '__VIEWSTATE') === '', 'extractAspToken(non-string) returns empty string');

    // 1.2 name before value vs value before name
    const htmlNormal = '<input type="hidden" name="__VIEWSTATE" id="__VIEWSTATE" value="NORMAL_TOKEN" />';
    assert(extractAspToken(htmlNormal, '__VIEWSTATE') === 'NORMAL_TOKEN', 'extractAspToken extracts name-then-value');

    const htmlInverted = '<input type="hidden" value="INVERTED_TOKEN" id="__VIEWSTATE" name="__VIEWSTATE" />';
    assert(extractAspToken(htmlInverted, '__VIEWSTATE') === 'INVERTED_TOKEN', 'extractAspToken extracts value-then-name');

    // 1.3 single quotes
    const htmlSingleQuotes = "<input type='hidden' name='__VIEWSTATE' value='SINGLE_TOKEN' />";
    assert(extractAspToken(htmlSingleQuotes, '__VIEWSTATE') === 'SINGLE_TOKEN', 'extractAspToken extracts single quotes');

    // 1.4 extractErrorMessage handles #ucMessage_lblError
    const htmlErr1 = '<div><span id="ucMessage_lblError" style="color:Red;">Invalid Username or Password</span></div>';
    assert(extractErrorMessage(htmlErr1) === 'Invalid Username or Password', 'extractErrorMessage extracts #ucMessage_lblError');

    // 1.5 extractErrorMessage handles generic lblError and alert-danger
    const htmlErr2 = '<div><div class="alert alert-danger"><span>Account is locked</span></div></div>';
    assert(extractErrorMessage(htmlErr2) === 'Account is locked', 'extractErrorMessage extracts alert-danger');

    // 1.6 parseCookies handles varied cookie response representations
    const mockRes1 = {
      headers: {
        getSetCookie: () => [
          'ASP.NET_SessionId=abc123session; path=/; HttpOnly',
          'NCBL=xyz789ncbl; path=/'
        ]
      }
    };
    const cookies1 = parseCookies(mockRes1);
    assert(cookies1.sessionId === 'abc123session', 'parseCookies extracts sessionId via getSetCookie()');
    assert(cookies1.ncbl === 'xyz789ncbl', 'parseCookies extracts ncbl via getSetCookie()');
    assert(cookies1.cookieHeader.includes('ASP.NET_SessionId=abc123session'), 'parseCookies builds cookieHeader');

    // 1.7 parseAttendanceHtml with empty or broken table
    const brokenHtmlResult = parseAttendanceHtml('<html><body>No table here</body></html>', '26UGENG2182');
    assert(brokenHtmlResult.subjects.length === 0, 'parseAttendanceHtml with no table returns empty subjects');
    assert(brokenHtmlResult.studentName === 'Student', 'parseAttendanceHtml with no name defaults to "Student"');
  });

  // -------------------------------------------------------------------------
  // GROUP 2: Direct authenticateDsuErp Live & Stress Probes
  // -------------------------------------------------------------------------
  await runTestGroup('Direct authenticateDsuErp Live Probes', async () => {
    // 2.1 Live valid credentials against DSU portal
    console.log('  Testing live valid credentials...');
    const liveAuth = await authenticateDsuErp(LIVE_USN, LIVE_PASS);
    assert(liveAuth.success === true, 'Live auth returns success=true');
    assert(liveAuth.statusCode === 200, 'Live auth returns statusCode=200');
    assert(typeof liveAuth.cookieHeader === 'string' && liveAuth.cookieHeader.length > 0, 'Live auth returns non-empty cookieHeader');
    assert(liveAuth.cookieHeader.includes('ASP.NET_SessionId='), 'Live auth cookieHeader contains ASP.NET_SessionId');
    assert(liveAuth.sessionId !== null && liveAuth.sessionId.length > 5, 'Live auth sessionId is present and valid');
    assert(liveAuth.location.toLowerCase().includes('/studentpanel/'), 'Live auth redirects to /studentpanel/');

    // 2.2 Invalid password with valid USN
    console.log('  Testing invalid password with valid USN...');
    const badPassAuth = await authenticateDsuErp(LIVE_USN, 'WrongPassword987!');
    assert(badPassAuth.success === false, 'Invalid password returns success=false');
    assert(badPassAuth.statusCode === 401, 'Invalid password returns statusCode=401');
    assert(typeof badPassAuth.error === 'string' && badPassAuth.error.length > 0, 'Invalid password returns descriptive error');

    // 2.3 Non-existent USN
    console.log('  Testing non-existent USN...');
    const nonExistentAuth = await authenticateDsuErp('NONEXISTENT_USN_99999', 'AnyPassword123');
    assert(nonExistentAuth.success === false, 'Non-existent USN returns success=false');
    assert(nonExistentAuth.statusCode === 401, 'Non-existent USN returns statusCode=401');

    // 2.4 Empty & whitespace credentials
    const emptyAuth1 = await authenticateDsuErp('', '');
    assert(emptyAuth1.success === false && emptyAuth1.statusCode === 400, 'Empty credentials return 400');
    const spaceAuth = await authenticateDsuErp('   ', '   ');
    assert(spaceAuth.success === false && spaceAuth.statusCode === 400, 'Whitespace credentials return 400');

    // 2.5 Individual and Combined Special Characters ($, &, #, %)
    console.log('  Testing individual and combined special characters ($, &, #, %)...');
    const specialChars = [
      { name: 'dollar $', pass: 'p$word' },
      { name: 'ampersand &', pass: 'p&word' },
      { name: 'hash #', pass: 'p#word' },
      { name: 'percent %', pass: 'p%word' },
      { name: 'combined $123&456#789%ABC', pass: 'p$123&456#789%ABC' },
    ];
    for (const sc of specialChars) {
      const res = await authenticateDsuErp(LIVE_USN, sc.pass);
      assert(res.success === false && res.statusCode === 401, `Special character test [${sc.name}] returns 401`);
    }

    // 2.6 SQL injection strings in authenticateDsuErp
    console.log('  Testing SQL injection strings in credentials...');
    const sqliAuth1 = await authenticateDsuErp("' OR '1'='1", "' OR '1'='1");
    assert(sqliAuth1.success === false && sqliAuth1.statusCode === 401, "SQL injection (' OR '1'='1) returns 401 without unhandled crash");

    const sqliAuth2 = await authenticateDsuErp("admin' --", "admin' --");
    assert(sqliAuth2.success === false && sqliAuth2.statusCode === 401, "SQL injection (admin' --) returns 401 without unhandled crash");

    // 2.7 Timeout resilience (unroutable IP or low timeout)
    console.log('  Testing timeout / connection error resilience...');
    const timeoutAuth = await authenticateDsuErp(LIVE_USN, LIVE_PASS, {
      baseUrl: 'http://10.255.255.1', // Unroutable private IP
      timeoutMs: 800,
    });
    assert(timeoutAuth.success === false, 'Unreachable host returns success=false');
    assert(timeoutAuth.statusCode === 504 || timeoutAuth.statusCode === 502, 'Unreachable host returns 504 or 502 without crash');
  });

  // -------------------------------------------------------------------------
  // GROUP 3: Serverless Handler (api/erp/attendance.js) In-Memory Invocations
  // -------------------------------------------------------------------------
  await runTestGroup('Serverless Handler In-Memory Invocations', async () => {
    // 3.1 Valid Live Request
    const resLive = createMockRes();
    await handler({ method: 'POST', body: { username: LIVE_USN, password: LIVE_PASS } }, resLive);
    assert(resLive.statusCode === 200, 'Handler returns HTTP 200 for live credentials');
    assert(resLive.body?.success === true, 'Handler returns body.success=true');
    assert(resLive.body?.studentName?.includes('ESHAN'), 'Handler returns correct studentName');
    assert(resLive.body?.usn === LIVE_USN, 'Handler echoes normalized USN');
    assert(Array.isArray(resLive.body?.subjects) && resLive.body.subjects.length > 0, 'Handler returns parsed subjects array');
    assert(typeof resLive.body?.overall?.percentage === 'number', 'Handler returns overall attendance stats');

    // 3.2 Missing and Empty Fields
    const missingCases = [
      { name: 'empty body', body: {} },
      { name: 'missing password', body: { username: LIVE_USN } },
      { name: 'missing username', body: { password: LIVE_PASS } },
      { name: 'null username', body: { username: null, password: LIVE_PASS } },
      { name: 'null password', body: { username: LIVE_USN, password: null } },
      { name: 'numeric username', body: { username: 12345, password: LIVE_PASS } },
      { name: 'boolean password', body: { username: LIVE_USN, password: true } },
      { name: 'whitespace strings', body: { username: '   ', password: '   ' } },
    ];

    for (const c of missingCases) {
      const res = createMockRes();
      await handler({ method: 'POST', body: c.body }, res);
      assert(res.statusCode === 400 && res.body?.success === false, `Handler returns HTTP 400 for ${c.name}`);
    }

    // 3.3 HTTP Methods Other Than POST
    const methodCases = ['GET', 'PUT', 'DELETE', 'PATCH', 'HEAD'];
    for (const m of methodCases) {
      const res = createMockRes();
      await handler({ method: m }, res);
      assert(res.statusCode === 405 && res.body?.success === false, `Handler returns HTTP 405 for ${m}`);
    }

    // 3.4 OPTIONS Preflight
    const resOpt = createMockRes();
    await handler({ method: 'OPTIONS' }, resOpt);
    assert(resOpt.statusCode === 204, 'Handler returns HTTP 204 for OPTIONS preflight');
    assert(resOpt.getHeader('access-control-allow-origin') === '*', 'Handler sets CORS Access-Control-Allow-Origin');

    // 3.5 Malformed String Body Handling (parseRequestBody string branch)
    const resMalformedString = createMockRes();
    await handler({ method: 'POST', body: '{ not a valid json' }, resMalformedString);
    assert(resMalformedString.statusCode === 400, 'Handler returns HTTP 400 for malformed string body');
  });

  // -------------------------------------------------------------------------
  // GROUP 4: Vite Dev Server Proxy Integration (Real HTTP over TCP)
  // -------------------------------------------------------------------------
  await runTestGroup('Vite Dev Server Proxy (Live HTTP Socket)', async () => {
    console.log(`  Spawning Vite dev server on dynamic ephemeral port (port 0)...`);
    const server = await createServer({
      configFile: 'vite.config.js',
      server: { port: 0 },
    });
    await server.listen();
    const actualPort = server.httpServer.address().port;
    console.log(`  Vite dev server listening on port ${actualPort}`);
    const baseUrl = `http://localhost:${actualPort}`;

    try {
      // 4.1 Live Auth through Vite Dev Proxy
      console.log('  Proxy probe: live credentials...');
      const pLive = await fetch(`${baseUrl}/api/erp/attendance`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ username: LIVE_USN, password: LIVE_PASS }),
      });
      const pLiveJson = await pLive.json();
      assert(pLive.status === 200, 'Dev proxy returns HTTP 200 for live auth');
      assert(pLiveJson.success === true, 'Dev proxy response success=true');
      assert(pLiveJson.studentName?.includes('ESHAN'), 'Dev proxy studentName contains ESHAN');
      assert(pLiveJson.subjects?.length > 0, 'Dev proxy subjects retrieved');

      // 4.2 Invalid Password through Dev Proxy
      console.log('  Proxy probe: invalid password...');
      const pBad = await fetch(`${baseUrl}/api/erp/attendance`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ username: LIVE_USN, password: 'WrongPassword999' }),
      });
      const pBadJson = await pBad.json();
      assert(pBad.status === 401, 'Dev proxy returns HTTP 401 for wrong password');
      assert(pBadJson.success === false, 'Dev proxy success=false for wrong password');
      assert(typeof pBadJson.error === 'string', 'Dev proxy error message present');

      // 4.3 Non-existent USN through Dev Proxy
      console.log('  Proxy probe: non-existent USN...');
      const pNon = await fetch(`${baseUrl}/api/erp/attendance`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ username: 'NONEXISTENT_STUDENT_000', password: 'password123' }),
      });
      const pNonJson = await pNon.json();
      assert(pNon.status === 401, 'Dev proxy returns HTTP 401 for non-existent USN');
      assert(pNonJson.success === false, 'Dev proxy success=false for non-existent USN');

      // 4.4 Missing / Empty Payload through Dev Proxy
      const pEmpty = await fetch(`${baseUrl}/api/erp/attendance`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({}),
      });
      assert(pEmpty.status === 400, 'Dev proxy returns HTTP 400 for empty JSON body');

      // 4.5 Malformed JSON through Dev Proxy
      const pMalformed = await fetch(`${baseUrl}/api/erp/attendance`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: '{"username": "26UGENG2182", password: broken-json-syntax',
      });
      const pMalformedJson = await pMalformed.json();
      assert(pMalformed.status === 400, 'Dev proxy returns HTTP 400 for malformed JSON syntax');
      assert(pMalformedJson.error === 'Malformed JSON payload', 'Dev proxy reports "Malformed JSON payload"');

      // 4.6 Non-JSON Plain Text Body through Dev Proxy
      const pText = await fetch(`${baseUrl}/api/erp/attendance`, {
        method: 'POST',
        headers: { 'Content-Type': 'text/plain' },
        body: 'just some plain text that is not json',
      });
      assert(pText.status === 400, 'Dev proxy returns HTTP 400 for plain text body');

      // 4.7 Special Characters in Password through Dev Proxy ($, &, #, %)
      console.log('  Proxy probe: special characters in password ($, &, #, %)...');
      const specialTestCases = [
        { name: '$', pass: 'p$word' },
        { name: '&', pass: 'p&word' },
        { name: '#', pass: 'p#word' },
        { name: '%', pass: 'p%word' },
        { name: 'combo', pass: 'Pass$123&456#789%ABC' },
      ];
      for (const tc of specialTestCases) {
        const pSpecial = await fetch(`${baseUrl}/api/erp/attendance`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ username: LIVE_USN, password: tc.pass }),
        });
        const pSpecialJson = await pSpecial.json();
        assert(pSpecial.status === 401, `Dev proxy returns HTTP 401 for password with [${tc.name}]`);
        assert(pSpecialJson.success === false, `Dev proxy success=false for [${tc.name}]`);
      }

      // 4.8 SQL Injection Strings through Dev Proxy
      console.log('  Proxy probe: SQL injection strings in credentials...');
      const pSqli = await fetch(`${baseUrl}/api/erp/attendance`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ username: "' OR '1'='1", password: "' OR '1'='1" }),
      });
      const pSqliJson = await pSqli.json();
      assert(pSqli.status === 401, 'Dev proxy returns HTTP 401 for SQLi payload');
      assert(pSqliJson.success === false, 'Dev proxy safely rejects SQLi string without server error');

      // 4.9 Malicious HTML/XSS Tag Handling (Upstream ASP.NET Request Validation)
      console.log('  Proxy probe: HTML/XSS tags against upstream ERP...');
      const pXss = await fetch(`${baseUrl}/api/erp/attendance`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ username: '<script>alert("xss")</script>', password: '<img src=x onerror=alert(1)>' }),
      });
      const pXssJson = await pXss.json();
      // Upstream DSU ASP.NET throws HttpRequestValidationException (500), which proxy safely handles as 502
      assert(pXss.status === 502 || pXss.status === 401, 'Dev proxy safely maps upstream XSS rejection to HTTP 502/401');
      assert(pXssJson.success === false, 'Dev proxy returns success=false for XSS probe');
      assert(!pXssJson.error.includes('ReferenceError') && !pXssJson.error.includes('TypeError'), 'Proxy does not leak unhandled runtime exceptions');

      // 4.10 Very Long Strings (5,000 characters) Stress Test
      console.log('  Proxy probe: Long string stress test (5,000 chars)...');
      const longString = 'A'.repeat(5000);
      const pLong = await fetch(`${baseUrl}/api/erp/attendance`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ username: longString, password: longString }),
      });
      assert(pLong.status === 401 || pLong.status === 400 || pLong.status === 502, 'Dev proxy handles 5,000 char input without crash or hang');

      // 4.11 Method Not Allowed through Dev Proxy
      const pGet = await fetch(`${baseUrl}/api/erp/attendance`, { method: 'GET' });
      assert(pGet.status === 405, 'Dev proxy rejects GET with HTTP 405');

      // 4.12 OPTIONS Preflight through Dev Proxy
      const pOpt = await fetch(`${baseUrl}/api/erp/attendance`, { method: 'OPTIONS' });
      assert(pOpt.status === 204, 'Dev proxy handles OPTIONS with HTTP 204');

      // 4.13 Static Assets Passthrough Check
      const pStatic = await fetch(`${baseUrl}/`);
      const pStaticText = await pStatic.text();
      assert(pStatic.status === 200 && pStaticText.includes('id="root"'), 'Dev proxy passes through static index.html');

      // -----------------------------------------------------------------------
      // 4.14 Concurrency Stress: 5 Rapid Parallel Requests
      // -----------------------------------------------------------------------
      console.log('  Proxy probe: Concurrent requests stress test (5 simultaneous)...');
      const concurrentRequests = [
        fetch(`${baseUrl}/api/erp/attendance`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ username: LIVE_USN, password: LIVE_PASS }),
        }),
        fetch(`${baseUrl}/api/erp/attendance`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ username: LIVE_USN, password: 'BadPassword1' }),
        }),
        fetch(`${baseUrl}/api/erp/attendance`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({}),
        }),
        fetch(`${baseUrl}/api/erp/attendance`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ username: 'NONEXISTENT', password: 'BadPassword2' }),
        }),
        fetch(`${baseUrl}/api/erp/attendance`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ username: LIVE_USN, password: LIVE_PASS }),
        }),
      ];

      const responses = await Promise.all(concurrentRequests);
      const [r1, r2, r3, r4, r5] = responses;
      assert(r1.status === 200, 'Concurrent req 1 (valid) returned 200');
      assert(r2.status === 401, 'Concurrent req 2 (invalid) returned 401');
      assert(r3.status === 400, 'Concurrent req 3 (empty) returned 400');
      assert(r4.status === 401, 'Concurrent req 4 (nonexistent) returned 401');
      assert(r5.status === 200, 'Concurrent req 5 (valid) returned 200');

      const json1 = await r1.json();
      const json5 = await r5.json();
      assert(json1.success === true && json1.studentName?.includes('ESHAN'), 'Concurrent req 1 data integrity preserved');
      assert(json5.success === true && json5.studentName?.includes('ESHAN'), 'Concurrent req 5 data integrity preserved');

    } finally {
      await server.close();
      console.log('  Vite dev server closed cleanly.');
    }
  });

  // -------------------------------------------------------------------------
  // FINAL REPORT & SUMMARY
  // -------------------------------------------------------------------------
  const elapsedMs = Date.now() - startTime;
  console.log(`\n============================================================`);
  console.log(`ADVERSARIAL STRESS-TEST SUMMARY`);
  console.log(`============================================================`);
  console.log(`Total Empirical Checks: ${testsRun}`);
  console.log(`Passed: ${testsPassed}`);
  console.log(`Failed: ${testsFailed}`);
  console.log(`Execution Time: ${elapsedMs}ms`);

  if (failures.length > 0) {
    console.error(`\nFailures encountered (${failures.length}):`);
    failures.forEach((f, idx) => console.error(`  ${idx + 1}. ${f}`));
    process.exit(1);
  } else {
    console.log(`\n🎉 ALL ADVERSARIAL STRESS TESTS PASSED EMPIRICALLY!`);
    console.log(`VERDICT: APPROVE`);
    process.exit(0);
  }
}

main().catch((err) => {
  console.error('\nFATAL TEST SUITE CRASH:', err);
  process.exit(1);
});
