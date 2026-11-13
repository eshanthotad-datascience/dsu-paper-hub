# DSU Paper Hub Dynamic Attendance Calculator: Test Infrastructure & Verification Architecture (TEST_INFRA)

## 1. Executive Summary & Zero-Dependency Architecture

The **DSU Paper Hub Dynamic Attendance Calculator** verification suite is an opaque-box, requirement-driven, zero-dependency testing system.

### Key Architectural Tenets:
1. **Zero External Dependencies**: The test runner (`tests/e2e/runner.js`), assertion engine (`tests/e2e/helpers/testUtils.js`), and mock server (`tests/e2e/helpers/erpMockServer.js`) rely solely on native Node.js built-ins (`node:fs`, `node:path`, `node:http`, `node:assert/strict`, `node:perf_hooks`, `node:url`). No external packages (such as Jest, Vitest, or Mocha) are required, guaranteeing instant portability across any Node.js 18+, 20+, 22+, or 24+ environment without `npm install` overhead.
2. **Progressive Testability**: Testing is partitioned into decoupled layers. Developers and CI pipelines can execute pure calculation tests, HTML parser tests, and mock HTTP server tests immediately—without requiring a live internet connection, valid student credentials, or a running Vite development server.
3. **Mock/Live Dual-Mode**: Every integration test can run in two modes:
   - **Mock Mode (`--mode=mock`)**: Routes requests to a local ephemeral HTTP mock server (`http://127.0.0.1:<port>`) pre-loaded with authoritative GNUMS ERP HTML snapshots, verifying protocols, state machines, and error states deterministically in under 150ms.
   - **Live Mode (`--mode=live`)**: Routes requests directly to Dayananda Sagar University's official GNUMS portal (`https://ums.mydsi.org`), validating live authentication, real session cookies, and student USN `26UGENG2182` live subject attendance.
4. **Hierarchical Test Tiers (Tiers 1 to 4)**: Tests are strictly segmented into 4 methodology tiers ensuring exhaustive feature coverage, boundary resilience, combinatorial interaction safety, and real-world student workflow fidelity.

---

## 2. Directory Structure & Component Layout

All end-to-end verification assets are organized under `tests/e2e/`:

```
dsu-paper-hub/
├── TEST_INFRA.md                          # This authoritative test infrastructure specification
├── package.json                           # Configured with test:e2e, test:e2e:tier1..4, etc.
└── tests/
    └── e2e/
        ├── runner.js                      # Custom zero-dependency test runner CLI
        ├── helpers/
        │   ├── testUtils.js               # Assertion library, registry, lifecycle hooks, mode flags
        │   ├── erpMockServer.js           # Ephemeral Node HTTP mock server simulating GNUMS & proxy API
        │   ├── fixtures.js                # Raw HTML snapshots, credentials, calendar datasets, JSON schemas
        │   └── attendanceCalculations.js  # Authoritative pure math calculation engine
        ├── tier1-feature-coverage.test.js # Tier 1: Equivalence partitions (56 tests across 11 features)
        ├── tier2-boundary-corner.test.js  # Tier 2: Boundary value analysis (56 tests across 11 features)
        ├── tier3-cross-feature.test.js    # Tier 3: Pairwise combinatorial interaction tests (8 tests)
        └── tier4-real-world.test.js       # Tier 4: End-to-end realistic student workflows (6 scenarios)
```

---

## 3. Test Tiers Specification & Methodology

The testing strategy follows a 4-tier progressive hierarchy totaling **126 tests**:

| Tier | Name | Focus | Tests Executed | Description |
|:---:|:---|:---|:---:|:---|
| **Tier 1** | Feature Coverage | Equivalence Partitions | **56 tests** | Validates positive contract compliance and core functionality across all 11 features defined in `PROJECT.md`. |
| **Tier 2** | Boundary & Corner Cases | Boundary Value Analysis | **56 tests** | Probes edge conditions: 0/0 conducted, 100%, 0%, target sliders (60%/75%/85%/100%), passwords with `$`/special chars, malformed HTML, calendar leap years, extreme inputs. |
| **Tier 3** | Cross-Feature Interactions | Pairwise & Combinatorial | **8 tests** | Verifies coupled sub-systems: Auth + Table Parsing + Math; Invalid Auth + UI Error Alert; Multi-slot (Theory/Lab) + Streak Math; Holidays + Cooked Warning; Cache Hit/Miss Lifecycle. |
| **Tier 4** | Real-World Scenarios | End-to-End User Journeys | **6 scenarios** | Simulates authentic student personas: Happy path (`26UGENG2182`), At-Risk recovery (62.5% $\to$ 75%), Bunk planning (92% $\to$ 85%), Multi-branch courses, ERP portal outage recovery, End-of-semester debarment. |

---

## 4. Progressive Testability Architecture

Progressive testability ensures that verification can occur incrementally during development without waiting for end-to-end infrastructure:

```
┌─────────────────────────────────────────────────────────────────┐
│ Level 0: Pure Mathematical Functions (attendanceCalculations.js) │
│ - Percentage rounding, streak canSkip/mustAttend formulas       │
│ - Requires: Zero network, zero server. Runs in < 1ms.           │
└──────────────────────────────┬──────────────────────────────────┘
                               │
┌──────────────────────────────▼──────────────────────────────────┐
│ Level 1: Static HTML Parsing & Token Extraction                 │
│ - __VIEWSTATE / __EVENTVALIDATION regex extraction              │
│ - #tblAttendance row extraction & subject code splitting       │
│ - Requires: Raw HTML strings from fixtures.js                   │
└──────────────────────────────┬──────────────────────────────────┘
                               │
┌──────────────────────────────▼──────────────────────────────────┐
│ Level 2: Local HTTP Mock Server (erpMockServer.js)              │
│ - ASP.NET 302 redirects, session cookies, ucMessage error       │
│ - Proxy API /api/erp/attendance request/response validation     │
│ - Requires: Local ephemeral Node HTTP server (port 0)           │
└──────────────────────────────┬──────────────────────────────────┘
                               │
┌──────────────────────────────▼──────────────────────────────────┐
│ Level 3: Live DSU ERP Integration (--mode=live)                 │
│ - Live TLS connection to https://ums.mydsi.org/Login.aspx/DSU   │
│ - Live verification of USN 26UGENG2182 with password 6$0$..     │
│ - Verifies dynamic semester subjects in production              │
└─────────────────────────────────────────────────────────────────┘
```

---

## 5. Test Runner CLI Specification (`tests/e2e/runner.js`)

### CLI Syntax
```bash
node tests/e2e/runner.js [options]
```

### Options Reference
| Option | Short | Argument | Default | Description |
|---|:---:|:---:|:---:|---|
| `--tier` | `-t` | `<1\|2\|3\|4\|all>` | `all` | Filter test suites to execute by tier number. |
| `--mode` | `-m` | `<mock\|live\|all>` | `mock` | Select target environment (`mock` runs against local mock server, `live` hits `ums.mydsi.org`). |
| `--filter` | `-f` | `<pattern>` | `""` | Run only test cases whose description contains `<pattern>`. |
| `--bail` | `-b` | none | `false` | Halt test execution immediately upon encountering the first failure. |
| `--help` | `-h` | none | `false` | Print runner CLI help and usage examples. |

### Exit Codes
- **`0`**: All executed tests passed cleanly.
- **`1`**: One or more tests failed, or a fatal runner runtime error occurred.

### Standard Output Formatting
The runner emits ANSI color-coded, hierarchical execution logs:
- **Suite Header**: `▶ Suite: <Suite Name>` (Magenta bold)
- **Passing Test**: `  ✓ <Test Name> (<duration>ms)` (Green checkmark)
- **Failing Test**: `  ✗ <Test Name> (<duration>ms)` (Red cross)
- **Skipped Test**: `  ○ <Test Name> (SKIPPED)` (Yellow circle)
- **Summary Box**: Comprehensive counts of suites, tests, passed, failed, skipped, total duration, and a high-contrast `PASS` or `FAIL` badge.

---

## 6. Helper APIs & Dual-Mode Harness

### 6.1 `tests/e2e/helpers/testUtils.js`
Zero-dependency assertion and test-lifecycle library:
- **Test Definition**: `describe(name, fn)`, `test(name, fn)`, `it(name, fn)`.
- **Lifecycle Hooks**: `beforeAll(fn)`, `afterAll(fn)`, `beforeEach(fn)`, `afterEach(fn)`.
- **Assertion DSL (`expect(actual)`)**:
  - `.toBe(expected)`: Strict equality via `Object.is`.
  - `.toEqual(expected)`: Deep recursive strict equality via Node's `node:assert/strict`.
  - `.toBeCloseTo(expected, numDigits = 2)`: Approximate numerical equality for floating-point attendance percentages.
  - `.toBeGreaterThan(num)`, `.toBeGreaterThanOrEqual(num)`.
  - `.toBeLessThan(num)`, `.toBeLessThanOrEqual(num)`.
  - `.toContain(substringOrElement)`.
  - `.toMatch(regexOrString)`.
  - `.toHaveLength(expectedLen)`.
  - `.toHaveProperty(key, optValue)`.
  - `.toBeDefined()`, `.toBeUndefined()`, `.toBeNull()`, `.toBeTruthy()`, `.toBeFalsy()`.
  - `.toThrow(expectedMessageOrRegex)`.
  - `.rejects.toThrow(expectedMessageOrRegex)`.
  - Negation chain: `expect(x).not.toBe(y)`.
- **Environment & Mode Utilities**:
  - `isMockMode()`: Returns `true` if running in mock mode.
  - `isLiveMode()`: Returns `true` if running against live portal.
  - `getTargetUrl()`: Returns `https://ums.mydsi.org` in live mode, or `process.env.E2E_MOCK_BASE_URL` in mock mode.
  - `skipIf(condition, name, fn)`.
  - `testInMode(mode, name, fn)`.

### 6.2 `tests/e2e/helpers/erpMockServer.js`
Native Node `http.createServer` instance providing deterministic GNUMS emulation:
- **`start()`**: Binds to ephemeral port `127.0.0.1:0` to guarantee collision-free parallel test execution.
- **`stop()`**: Gracefully terminates sockets and server.
- **Routes Emulated**:
  1. `GET /Login.aspx/DSU`: Serves HTML containing valid ASP.NET tokens (`__VIEWSTATE`, `__VIEWSTATEGENERATOR`, `__EVENTVALIDATION`).
  2. `POST /Login.aspx/DSU`:
     - Valid USN (`26UGENG2182`) + password (`6$0$75659N`) $\to$ HTTP 302 with `Location: /StudentPanel/StudentDashboard.aspx`, sets `ASP.NET_SessionId` and `NCBL`.
     - Invalid credentials $\to$ HTTP 200 with `#ucMessage_lblError` ("Invalid Username or Password").
     - Empty credentials $\to$ HTTP 200 re-rendering form.
  3. `GET /StudentPanel/TTM_Attendance/TTM_Attendance_StudentAttendance.aspx`:
     - Checks session cookie. If valid $\to$ serves `#tblAttendance` HTML with live 8 subjects.
     - If missing/invalid session $\to$ HTTP 302 redirect to `/Login.aspx`.
  4. `POST /api/erp/attendance`:
     - Emulates backend serverless proxy endpoint returning normalized JSON contract or 401 error.
  5. `POST /api/erp/simulate-504` and `POST /api/erp/simulate-503`:
     - Replicates gateway timeouts and maintenance notices.
- **Fault Injection Engine**:
  - `setFault(pathname, { delay, status, body, contentType })`: Simulates server delays, HTTP 500/503 errors, or connection failures.
  - `setTableVariant(variant)`: Dynamically swaps served HTML between `'valid'`, `'zeroClasses'`, `'atRisk'`, `'highPerformer'`, and `'malformed'`.
  - `clearFaults()`, `getRequestLog()`, `clearRequestLog()`.

### 6.3 `tests/e2e/helpers/fixtures.js`
Centralized repository of authoritative test datasets:
- **`MOCK_FIXTURES`**: Captured tokens, session IDs, and verified USN.
- **`TEST_CREDENTIALS`**:
  - `valid`: `26UGENG2182` / `6$0$75659N`
  - `invalidPassword`: `26UGENG2182` / `WrongPassword999!`
  - `nonExistentUser`: `99UGENG9999` / `anypass`
  - `specialCharPassword`: `26UGENG2182` / `6$0$75659N` (testing `$` in URLSearchParams)
  - `empty`: `""` / `""`
- **`MOCK_HTML`**:
  - `loginPage`: Full ASP.NET login HTML with hidden inputs.
  - `loginError`: HTML containing `<span id="ucMessage_lblError">Invalid Username or Password</span>`.
  - `attendanceValid`: Authoritative 8-subject table for `26UGENG2182` (Linear Algebra, Chem Lab/Theory, Graphics Lab/Theory, C Lab, Evs, Constitution).
  - `attendanceZeroClasses`: Table with 0 conducted classes.
  - `attendanceAtRisk`: Table with 65% attendance.
  - `attendanceHighPerformer`: Table with 92% attendance.
  - `attendanceMalformed`: Truncated HTML missing columns.
- **`MOCK_CALENDAR`**:
  - Semester start (`2026-08-01`) & end (`2026-12-15`).
  - Working days (`Mon-Fri` + alternate Saturdays).
  - List of official holidays (Independence Day, Ganesh Chaturthi, Gandhi Jayanti, etc.).
- **`MOCK_JSON`**: Normalized JSON matching proxy API contract.

---

## 7. Package Scripts & CI/CD Integration

### `package.json` Test Scripts
The following test scripts are configured in `package.json`:

```json
{
  "scripts": {
    "test:e2e": "node tests/e2e/runner.js",
    "test:e2e:mock": "node tests/e2e/runner.js --mode=mock",
    "test:e2e:live": "node tests/e2e/runner.js --mode=live",
    "test:e2e:tier1": "node tests/e2e/runner.js --tier=1",
    "test:e2e:tier2": "node tests/e2e/runner.js --tier=2",
    "test:e2e:tier3": "node tests/e2e/runner.js --tier=3",
    "test:e2e:tier4": "node tests/e2e/runner.js --tier=4",
    "test:e2e:bail": "node tests/e2e/runner.js --bail"
  }
}
```

---

## 8. Verification & Troubleshooting Guide

### 1. Division by Zero / NaN in Percentage
- **Problem**: When a new semester starts, conducted hours are 0 ($C = 0$).
- **Handling**: `calculatePercentage(attended, conducted)` returns `100.0%` and never `NaN` or `Infinity`.

### 2. Password Encoding with Special Characters
- **Problem**: Passwords like `6$0$75659N` contain `$`. In URL-encoded POST bodies, `$` must be serialized as `%24`.
- **Handling**: Always use native `new URLSearchParams()` to serialize POST request bodies. Never perform manual string concatenation.

### 3. ASP.NET Token Extraction Failures
- **Problem**: The order of attributes in `<input>` tags can vary (`name` before `value` or `value` before `name`), and quotes can be single or double.
- **Handling**: Use dual regex patterns:
  ```javascript
  const reg1 = new RegExp(`<input[^>]*name=["']${name}["'][^>]*value=["']([^"']*)["']`, 'i');
  const reg2 = new RegExp(`<input[^>]*value=["']([^"']*)["'][^>]*name=["']${name}["']`, 'i');
  ```

### 4. Handling 302 Redirects in Node.js `fetch`
- **Problem**: By default, `fetch()` follows HTTP 302 redirects automatically. In GNUMS authentication, following the 302 drops the initial `Set-Cookie` headers if not captured immediately.
- **Handling**: Always set `redirect: 'manual'` during login POST requests to inspect the `302 Found` status and capture `Set-Cookie` headers directly.
