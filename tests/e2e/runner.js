#!/usr/bin/env node
/**
 * DSU Paper Hub - Zero-Dependency E2E Test Runner
 * 
 * Supports:
 * - Filtering by tier: --tier=1,2,3,4 or --tier=all
 * - Dual-mode testing: --mode=mock (default), --mode=live, --mode=all
 * - Pattern matching: --filter=<string>
 * - Fail-fast bail: --bail
 * - Native ESM execution, zero external npm dependencies
 */

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { performance } from 'node:perf_hooks';
import { registry } from './helpers/testUtils.js';
import { ErpMockServer } from './helpers/erpMockServer.js';

// ANSI formatting helpers
const fmt = {
  reset: '\x1b[0m',
  bold: '\x1b[1m',
  dim: '\x1b[2m',
  green: '\x1b[32m',
  red: '\x1b[31m',
  yellow: '\x1b[33m',
  blue: '\x1b[34m',
  cyan: '\x1b[36m',
  magenta: '\x1b[35m',
  bgRed: '\x1b[41m\x1b[37m\x1b[1m',
  bgGreen: '\x1b[42m\x1b[30m\x1b[1m'
};

// Parse command line arguments
function parseArgs(args) {
  const options = {
    tier: 'all',
    mode: 'mock',
    filter: '',
    bail: false,
    help: false
  };

  for (let i = 0; i < args.length; i++) {
    const arg = args[i];
    if (arg === '--help' || arg === '-h') {
      options.help = true;
    } else if (arg.startsWith('--tier=')) {
      options.tier = arg.split('=')[1].trim();
    } else if (arg === '-t' && args[i + 1]) {
      options.tier = args[++i].trim();
    } else if (arg.startsWith('--mode=')) {
      options.mode = arg.split('=')[1].trim().toLowerCase();
    } else if (arg === '-m' && args[i + 1]) {
      options.mode = args[++i].trim().toLowerCase();
    } else if (arg.startsWith('--filter=')) {
      options.filter = arg.split('=')[1].trim();
    } else if (arg === '-f' && args[i + 1]) {
      options.filter = args[++i].trim();
    } else if (arg === '--bail' || arg === '-b') {
      options.bail = true;
    }
  }

  return options;
}

function printHelp() {
  console.log(`
${fmt.bold}DSU Paper Hub - E2E Test Runner${fmt.reset}

${fmt.bold}USAGE:${fmt.reset}
  node tests/e2e/runner.js [options]

${fmt.bold}OPTIONS:${fmt.reset}
  ${fmt.cyan}-t, --tier=<1|2|3|4|all>${fmt.reset}     Filter test suites by tier (default: all)
  ${fmt.cyan}-m, --mode=<mock|live|all>${fmt.reset}   Execution mode: mock, live, or all (default: mock)
  ${fmt.cyan}-f, --filter=<pattern>${fmt.reset}       Filter test cases matching name pattern
  ${fmt.cyan}-b, --bail${fmt.reset}                  Stop execution immediately on first failure
  ${fmt.cyan}-h, --help${fmt.reset}                  Show this help message

${fmt.bold}EXAMPLES:${fmt.reset}
  node tests/e2e/runner.js                    # Run all tiers in mock mode
  node tests/e2e/runner.js --tier=1           # Run Tier 1 feature coverage tests only
  node tests/e2e/runner.js --tier=2 --mode=mock
  node tests/e2e/runner.js --mode=live        # Run against live DSU ERP portal
  node tests/e2e/runner.js --filter="streak"  # Run only tests containing "streak"
`);
}

// Discover test files in tests/e2e/ matching tier filter
function discoverTestFiles(e2eDir, tierOption) {
  if (!fs.existsSync(e2eDir)) {
    throw new Error(`E2E tests directory not found at: ${e2eDir}`);
  }

  const allFiles = fs.readdirSync(e2eDir);
  const testFiles = allFiles.filter(file => file.endsWith('.test.js'));

  if (tierOption === 'all' || tierOption === '') {
    return testFiles.sort().map(f => path.join(e2eDir, f));
  }

  const tierNum = tierOption.replace(/^tier/i, '');
  if (!['1', '2', '3', '4'].includes(tierNum)) {
    console.error(`${fmt.red}Invalid --tier argument: "${tierOption}". Valid tiers are: 1, 2, 3, 4, all.${fmt.reset}`);
    process.exit(1);
  }

  const prefix = `tier${tierNum}-`;
  const matched = testFiles.filter(file => file.startsWith(prefix));

  return matched.sort().map(f => path.join(e2eDir, f));
}

// Execute a suite and recursively execute any child suites
async function executeSuiteTree(suite, options = {}, context = { parentName: '', inheritedBeforeEach: [], inheritedAfterEach: [] }) {
  const fullSuiteName = context.parentName ? `${context.parentName} > ${suite.name}` : suite.name;
  console.log(`${fmt.bold}${fmt.magenta}▶ Suite: ${fullSuiteName}${fmt.reset}`);

  let total = 0;
  let passed = 0;
  let failed = 0;
  let skipped = 0;
  const failures = [];

  // Run beforeAll hooks for this suite
  for (const hook of suite.beforeAllHooks || []) {
    try {
      await hook();
    } catch (err) {
      console.error(`  ${fmt.red}✗ beforeAll hook failed: ${err.message}${fmt.reset}`);
      failed++;
      failures.push({
        suiteName: fullSuiteName,
        testName: '(beforeAll hook)',
        error: err
      });
      return { total, passed, failed, skipped, failures };
    }
  }

  const allBeforeEach = [...context.inheritedBeforeEach, ...(suite.beforeEachHooks || [])];
  const allAfterEach = [...(suite.afterEachHooks || []), ...context.inheritedAfterEach];

  for (const testCase of suite.tests || []) {
    if (options.filter && !testCase.name.toLowerCase().includes(options.filter.toLowerCase())) {
      continue;
    }

    total++;
    if (testCase.skip) {
      skipped++;
      console.log(`  ${fmt.yellow}○ ${testCase.name} (SKIPPED)${fmt.reset}`);
      continue;
    }

    // Run beforeEach hooks
    let beforeEachFailed = false;
    for (const hook of allBeforeEach) {
      try {
        await hook();
      } catch (err) {
        beforeEachFailed = true;
        failed++;
        console.error(`  ${fmt.red}✗ ${testCase.name} (beforeEach hook failed: ${err.message})${fmt.reset}`);
        failures.push({
          suiteName: fullSuiteName,
          testName: `${testCase.name} (beforeEach hook)`,
          error: err
        });
        break;
      }
    }

    if (!beforeEachFailed) {
      const testStart = performance.now();
      let testFailed = false;
      try {
        await testCase.fn();
        const duration = (performance.now() - testStart).toFixed(1);
        passed++;
        console.log(`  ${fmt.green}✓${fmt.reset} ${testCase.name} ${fmt.dim}(${duration}ms)${fmt.reset}`);
      } catch (err) {
        testFailed = true;
        const duration = (performance.now() - testStart).toFixed(1);
        failed++;
        console.log(`  ${fmt.red}✗ ${testCase.name} (${duration}ms)${fmt.reset}`);
        failures.push({
          suiteName: fullSuiteName,
          testName: testCase.name,
          error: err
        });

        if (options.bail) {
          console.log(`\n${fmt.red}Bailing early after first failure (--bail specified).${fmt.reset}`);
          break;
        }
      }

      // Run afterEach hooks
      for (const hook of allAfterEach) {
        try {
          await hook();
        } catch (err) {
          console.error(`  ${fmt.red}✗ afterEach hook failed: ${err.message}${fmt.reset}`);
          if (!testFailed) failed++;
          failures.push({
            suiteName: fullSuiteName,
            testName: `${testCase.name} (afterEach hook)`,
            error: err
          });
        }
      }
    }

    if (options.bail && failed > 0) break;
  }

  // Recursively execute nested child suites
  for (const childSuite of suite.suites || []) {
    if (options.bail && failed > 0) break;
    const childResult = await executeSuiteTree(childSuite, options, {
      parentName: fullSuiteName,
      inheritedBeforeEach: allBeforeEach,
      inheritedAfterEach: allAfterEach
    });
    total += childResult.total;
    passed += childResult.passed;
    failed += childResult.failed;
    skipped += childResult.skipped;
    failures.push(...childResult.failures);
  }

  // Run afterAll hooks for this suite
  for (const hook of suite.afterAllHooks || []) {
    try {
      await hook();
    } catch (err) {
      console.error(`  ${fmt.red}✗ afterAll hook failed: ${err.message}${fmt.reset}`);
      failed++;
      failures.push({
        suiteName: fullSuiteName,
        testName: '(afterAll hook)',
        error: err
      });
    }
  }

  console.log('');
  return { total, passed, failed, skipped, failures };
}

// Execute all registered top-level suites
async function executeSuites(suites, options = {}) {
  let total = 0;
  let passed = 0;
  let failed = 0;
  let skipped = 0;
  const failures = [];

  for (const suite of suites) {
    const res = await executeSuiteTree(suite, options);
    total += res.total;
    passed += res.passed;
    failed += res.failed;
    skipped += res.skipped;
    failures.push(...res.failures);

    if (options.bail && failed > 0) break;
  }

  return { total, passed, failed, skipped, failures };
}

// Main runner orchestrator
async function main() {
  const options = parseArgs(process.argv.slice(2));

  if (options.help) {
    printHelp();
    process.exit(0);
  }

  const startTime = performance.now();
  const __filename = fileURLToPath(import.meta.url);
  const e2eDir = path.dirname(__filename);

  console.log(`\n${fmt.bold}${fmt.cyan}======================================================================`);
  console.log(`           DSU PAPER HUB - E2E TEST RUNNER (ZERO-DEPENDENCY)`);
  console.log(`   Tier: ${fmt.yellow}${options.tier.toUpperCase()}${fmt.cyan} | Mode: ${fmt.yellow}${options.mode.toUpperCase()}${fmt.cyan} | Filter: ${fmt.yellow}${options.filter || 'none'}${fmt.cyan} | Bail: ${fmt.yellow}${options.bail}${fmt.cyan}`);
  console.log(`======================================================================${fmt.reset}\n`);

  // Progressive testability: configure mock server in both mock and live modes
  let sharedMockServer = null;
  if (options.mode === 'mock' || options.mode === 'all') {
    sharedMockServer = new ErpMockServer();
    await sharedMockServer.start();
    process.env.E2E_MOCK_BASE_URL = sharedMockServer.baseUrl;
    process.env.E2E_PROXY_BASE_URL = sharedMockServer.baseUrl;
    process.env.DSU_ERP_BASE_URL = sharedMockServer.baseUrl;
    process.env.E2E_MODE = 'mock';
    console.log(`${fmt.dim}[Harness] Mock ERP server active at ${sharedMockServer.baseUrl}${fmt.reset}\n`);
  } else {
    // Live mode: Start local proxy server to host /api/erp/attendance
    sharedMockServer = new ErpMockServer();
    await sharedMockServer.start();
    process.env.E2E_PROXY_BASE_URL = sharedMockServer.baseUrl;
    process.env.DSU_ERP_BASE_URL = 'https://ums.mydsi.org';
    process.env.E2E_MODE = 'live';
    console.log(`${fmt.yellow}[Harness] Running in LIVE mode against https://ums.mydsi.org (Proxy at ${sharedMockServer.baseUrl})${fmt.reset}\n`);
  }

  const testFiles = discoverTestFiles(e2eDir, options.tier);
  if (testFiles.length === 0) {
    console.log(`${fmt.yellow}No test files found matching tier filter: ${options.tier}${fmt.reset}`);
    if (sharedMockServer) await sharedMockServer.stop();
    process.exit(1);
  }

  console.log(`${fmt.dim}Discovered ${testFiles.length} test suite file(s):${fmt.reset}`);
  testFiles.forEach(f => console.log(` - ${path.basename(f)}`));
  console.log('');

  let totalTests = 0;
  let passedTests = 0;
  let failedTests = 0;
  let skippedTests = 0;
  const allFailures = [];

  try {
    for (const filePath of testFiles) {
      registry.clear();
      const fileUrl = pathToFileURL(filePath).href;
      console.log(`${fmt.bold}${fmt.blue}Loading: ${path.basename(filePath)}${fmt.reset}`);
      
      // Dynamic import loads test registrations into registry
      await import(fileUrl);

      const result = await executeSuites(registry.suites, options);
      totalTests += result.total;
      passedTests += result.passed;
      failedTests += result.failed;
      skippedTests += result.skipped;
      allFailures.push(...result.failures);

      if (options.bail && failedTests > 0) break;
    }
  } catch (err) {
    console.error(`\n${fmt.red}${fmt.bold}Fatal Execution Error:${fmt.reset}`, err);
    failedTests++;
  } finally {
    if (sharedMockServer) {
      await sharedMockServer.stop();
    }
  }

  const totalDuration = ((performance.now() - startTime) / 1000).toFixed(2);

  // Failure diagnostics
  if (allFailures.length > 0) {
    console.log(`${fmt.bold}${fmt.red}========================== FAILURES (${allFailures.length}) ==========================${fmt.reset}`);
    allFailures.forEach((f, idx) => {
      console.log(`\n${fmt.bold}${idx + 1}) [${f.suiteName}] > ${f.testName}:${fmt.reset}`);
      console.log(`${fmt.red}${f.error.stack || f.error.message}${fmt.reset}`);
    });
    console.log('');
  }

  // Final summary box
  console.log(`${fmt.bold}${fmt.cyan}======================================================================`);
  console.log(`                          TEST RUN SUMMARY`);
  console.log(`======================================================================${fmt.reset}`);
  console.log(`  Suites Executed : ${testFiles.length}`);
  console.log(`  Total Tests     : ${totalTests}`);
  console.log(`  Passed          : ${fmt.green}${passedTests}${fmt.reset}`);
  console.log(`  Failed          : ${failedTests > 0 ? fmt.red : fmt.dim}${failedTests}${fmt.reset}`);
  console.log(`  Skipped         : ${skippedTests > 0 ? fmt.yellow : fmt.dim}${skippedTests}${fmt.reset}`);
  console.log(`  Total Duration  : ${totalDuration}s`);
  console.log(`  Final Status    : ${failedTests === 0 ? fmt.bgGreen + ' PASS ' : fmt.bgRed + ' FAIL '}${fmt.reset}`);
  console.log(`${fmt.bold}${fmt.cyan}======================================================================${fmt.reset}\n`);

  process.exit(failedTests === 0 ? 0 : 1);
}

main().catch(err => {
  console.error('Unhandled runner error:', err);
  process.exit(1);
});
