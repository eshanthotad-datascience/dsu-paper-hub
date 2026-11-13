#!/usr/bin/env node
/**
 * scripts/verify-dsu-erp.js
 * Standalone Automated Verification CLI for Dayananda Sagar University (DSU) ERP
 *
 * Supports:
 * - Default credentials: USN 26UGENG2182, password from $DSU_PASSWORD or 6$0$75659N
 * - Flag parsing: --usn, --password, --base-url, --timeout, --json, --help
 * - Native ESM, zero external npm dependencies
 */

import { authenticateDsuErp, fetchAttendanceHtml, parseAttendanceHtml } from '../api/erp/attendance.js';

export function parseCliArgs(args) {
  const options = {
    usn: '26UGENG2182',
    password: process.env.DSU_PASSWORD !== undefined ? process.env.DSU_PASSWORD : '6$0$75659N',
    baseUrl: process.env.DSU_ERP_BASE_URL || process.env.E2E_MOCK_BASE_URL || 'https://ums.mydsi.org',
    timeoutMs: 15000,
    json: false,
    help: false
  };

  for (let i = 0; i < args.length; i++) {
    const arg = args[i];
    if (arg === '--help' || arg === '-h') {
      options.help = true;
    } else if (arg.startsWith('--usn=')) {
      options.usn = arg.substring(6).trim();
    } else if (arg.startsWith('--password=')) {
      options.password = arg.substring(11);
    } else if (arg.startsWith('--base-url=')) {
      options.baseUrl = arg.substring(11).trim();
    } else if (arg.startsWith('--timeout=')) {
      options.timeoutMs = parseInt(arg.substring(10), 10) || 15000;
    } else if (arg === '--json') {
      options.json = true;
    }
  }

  return options;
}

export function printHelp() {
  console.log(`
DSU Paper Hub - Standalone ERP Verification CLI

USAGE:
  node scripts/verify-dsu-erp.js [options]

OPTIONS:
  --usn=<USN>            Student USN (default: 26UGENG2182)
  --password=<PWD>       Portal password (default: $DSU_PASSWORD or 6$0$75659N)
  --base-url=<URL>       Target ERP Base URL
  --timeout=<MS>         Request timeout in milliseconds (default: 15000)
  --json                 Emit machine-readable JSON output
  -h, --help             Show this help message
`);
}

export async function runCli(argv = process.argv.slice(2)) {
  const options = parseCliArgs(argv);

  if (options.help) {
    printHelp();
    return 0;
  }

  if (options.password === undefined || options.password === null || options.password.trim() === '') {
    if (options.json) {
      console.log(JSON.stringify({ success: false, error: 'Password is required' }));
    } else {
      console.error('Error: Password is required');
    }
    return 1;
  }

  if (!options.usn || options.usn.trim() === '') {
    if (options.json) {
      console.log(JSON.stringify({ success: false, error: 'USN is required' }));
    } else {
      console.error('Error: USN is required');
    }
    return 1;
  }

  try {
    const authResult = await authenticateDsuErp(options.usn, options.password, {
      baseUrl: options.baseUrl,
      timeoutMs: options.timeoutMs
    });

    if (!authResult.success) {
      if (options.json) {
        console.log(JSON.stringify({ success: false, error: authResult.error || 'Authentication failed' }));
      } else {
        console.error(`[ERROR] Authentication failed: ${authResult.error || 'Invalid Username or Password'}`);
      }
      return 1;
    }

    const html = await fetchAttendanceHtml(authResult.cookieHeader, {
      baseUrl: options.baseUrl,
      timeoutMs: options.timeoutMs
    });

    const parsed = parseAttendanceHtml(html, options.usn);

    if (options.json) {
      console.log(JSON.stringify({
        success: true,
        verified: true,
        studentName: parsed.studentName,
        usn: parsed.usn,
        overall: parsed.overall,
        subjects: parsed.subjects
      }, null, 2));
    } else {
      console.log(`[SUCCESS] DSU ERP Verification Passed`);
      console.log(`Authenticated successfully as ${parsed.studentName} (${parsed.usn})`);
      console.log(`Overall Attendance: ${parsed.overall.percentage}% (${parsed.overall.attended}/${parsed.overall.conducted})`);
      console.log(`Enrolled Subjects (${parsed.subjects.length}):`);
      for (const s of parsed.subjects) {
        console.log(` - [${s.code}] ${s.name}: ${s.percentage}% (${s.attended}/${s.conducted}) [${s.slotType}]`);
      }
    }
    return 0;
  } catch (err) {
    if (options.json) {
      console.log(JSON.stringify({ success: false, error: err.message }));
    } else {
      console.error(`[ERROR] ${err.message}`);
    }
    return 1;
  }
}

// Direct execution guard
const isMain = process.argv[1] && (
  process.argv[1].endsWith('verify-dsu-erp.js') ||
  process.argv[1].endsWith('verify-dsu-erp')
);

if (isMain) {
  runCli().then((code) => {
    process.exit(code);
  }).catch((err) => {
    console.error(`[FATAL] ${err.message}`);
    process.exit(1);
  });
}
