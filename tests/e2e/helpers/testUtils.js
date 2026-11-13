/**
 * DSU Paper Hub - E2E Testing Assertion & Lifecycle Utilities
 * Zero external dependencies: pure Node.js ESM
 */

import assert from 'node:assert/strict';
import { performance } from 'node:perf_hooks';
import * as calculations from '../../../src/lib/attendanceCalculations.js';
import { extractAspToken } from '../../../api/erp/attendance.js';

/**
 * Safe serialization helper that supports BigInt, circular references, symbols, functions.
 */
export function safeStringify(val) {
  if (typeof val === 'bigint') {
    return `${val.toString()}n`;
  }
  if (typeof val === 'function') {
    return val.name ? `[Function: ${val.name}]` : '[Function]';
  }
  if (typeof val === 'symbol') {
    return val.toString();
  }
  if (val === undefined) {
    return 'undefined';
  }
  try {
    const seen = new WeakSet();
    return JSON.stringify(val, (key, value) => {
      if (typeof value === 'bigint') {
        return `${value.toString()}n`;
      }
      if (typeof value === 'object' && value !== null) {
        if (seen.has(value)) {
          return '[Circular]';
        }
        seen.add(value);
      }
      return value;
    });
  } catch {
    return String(val);
  }
}

class Expectation {
  constructor(actual, isNot = false) {
    this.actual = actual;
    this.isNot = isNot;
  }

  get not() {
    return new Expectation(this.actual, !this.isNot);
  }

  _evaluate(condition, messageOrFn) {
    const passed = Boolean(condition);
    const success = this.isNot ? !passed : passed;
    if (!success) {
      const message = typeof messageOrFn === 'function' ? messageOrFn() : messageOrFn;
      const err = new Error(message);
      Error.captureStackTrace(err, this._evaluate);
      throw err;
    }
  }

  toBe(expected) {
    this._evaluate(
      Object.is(this.actual, expected),
      () => `Expected ${safeStringify(this.actual)} ${this.isNot ? 'not to be' : 'to be'} ${safeStringify(expected)}`
    );
  }

  toEqual(expected) {
    let passed = false;
    try {
      assert.deepStrictEqual(this.actual, expected);
      passed = true;
    } catch {
      passed = false;
    }
    this._evaluate(
      passed,
      () => `Expected ${safeStringify(this.actual)} ${this.isNot ? 'not to equal' : 'to equal'} ${safeStringify(expected)}`
    );
  }

  toBeCloseTo(expected, numDigits = 2) {
    const diff = Math.abs(this.actual - expected);
    const tolerance = Math.pow(10, -numDigits) / 2;
    this._evaluate(
      diff < tolerance,
      () => `Expected ${this.actual} ${this.isNot ? 'not to be close to' : 'to be close to'} ${expected} (diff: ${diff}, tolerance: ${tolerance})`
    );
  }

  toBeGreaterThan(expected) {
    this._evaluate(
      this.actual > expected,
      () => `Expected ${this.actual} ${this.isNot ? 'not to be >' : 'to be >'} ${expected}`
    );
  }

  toBeGreaterThanOrEqual(expected) {
    this._evaluate(
      this.actual >= expected,
      () => `Expected ${this.actual} ${this.isNot ? 'not to be >=' : 'to be >='} ${expected}`
    );
  }

  toBeLessThan(expected) {
    this._evaluate(
      this.actual < expected,
      () => `Expected ${this.actual} ${this.isNot ? 'not to be <' : 'to be <'} ${expected}`
    );
  }

  toBeLessThanOrEqual(expected) {
    this._evaluate(
      this.actual <= expected,
      () => `Expected ${this.actual} ${this.isNot ? 'not to be <=' : 'to be <='} ${expected}`
    );
  }

  toContain(expected) {
    let passed = false;
    if (typeof this.actual === 'string') {
      passed = this.actual.includes(expected);
    } else if (Array.isArray(this.actual)) {
      passed = this.actual.includes(expected);
    } else if (this.actual instanceof Set || this.actual instanceof Map) {
      passed = this.actual.has(expected);
    }
    this._evaluate(
      passed,
      () => `Expected ${safeStringify(this.actual)} ${this.isNot ? 'not to contain' : 'to contain'} ${safeStringify(expected)}`
    );
  }

  toMatch(pattern) {
    const reg = typeof pattern === 'string' ? new RegExp(pattern) : pattern;
    this._evaluate(
      reg.test(String(this.actual)),
      () => `Expected "${this.actual}" ${this.isNot ? 'not to match' : 'to match'} ${pattern}`
    );
  }

  toHaveLength(expected) {
    const len = this.actual?.length;
    this._evaluate(
      len === expected,
      () => `Expected length ${this.isNot ? 'not to be' : 'to be'} ${expected}, got ${len}`
    );
  }

  toHaveProperty(propName, ...rest) {
    const hasProp = this.actual != null && Object.prototype.hasOwnProperty.call(this.actual, propName);
    if (rest.length === 0) {
      this._evaluate(
        hasProp,
        () => `Expected object ${this.isNot ? 'not to have property' : 'to have property'} "${propName}"`
      );
    } else {
      const expectedValue = rest[0];
      const match = hasProp && Object.is(this.actual[propName], expectedValue);
      this._evaluate(
        match,
        () => `Expected object property "${propName}" ${this.isNot ? 'not to equal' : 'to equal'} ${safeStringify(expectedValue)}, got ${safeStringify(this.actual?.[propName])}`
      );
    }
  }

  toBeDefined() {
    this._evaluate(
      this.actual !== undefined,
      () => `Expected value ${this.isNot ? 'to be undefined' : 'to be defined'}`
    );
  }

  toBeUndefined() {
    this._evaluate(
      this.actual === undefined,
      () => `Expected value ${this.isNot ? 'to be defined' : 'to be undefined'}`
    );
  }

  toBeNull() {
    this._evaluate(
      this.actual === null,
      () => `Expected value ${this.isNot ? 'not to be null' : 'to be null'}`
    );
  }

  toBeTruthy() {
    this._evaluate(
      Boolean(this.actual),
      () => `Expected ${safeStringify(this.actual)} ${this.isNot ? 'to be falsy' : 'to be truthy'}`
    );
  }

  toBeFalsy() {
    this._evaluate(
      !this.actual,
      () => `Expected ${safeStringify(this.actual)} ${this.isNot ? 'to be truthy' : 'to be falsy'}`
    );
  }

  toThrow(expected) {
    if (typeof this.actual !== 'function') {
      throw new TypeError(`Actual value must be a function to test toThrow(), received ${typeof this.actual} (${safeStringify(this.actual)})`);
    }

    let threw = false;
    let error = null;
    try {
      this.actual();
    } catch (err) {
      threw = true;
      error = err;
    }

    if (this.isNot) {
      if (threw) throw new Error(`Expected function not to throw, but it threw: ${error?.message}`);
      return;
    }

    if (!threw) {
      throw new Error(`Expected function to throw, but it did not throw`);
    }

    if (expected) {
      if (typeof expected === 'string' && !error.message.includes(expected)) {
        throw new Error(`Expected error message to include "${expected}", got: "${error.message}"`);
      } else if (expected instanceof RegExp && !expected.test(error.message)) {
        throw new Error(`Expected error message to match ${expected}, got: "${error.message}"`);
      }
    }
  }

  get rejects() {
    return {
      toThrow: async (expected) => {
        let threw = false;
        let error = null;
        try {
          const promise = typeof this.actual === 'function' ? this.actual() : this.actual;
          await promise;
        } catch (err) {
          threw = true;
          error = err;
        }

        if (this.isNot) {
          if (threw) throw new Error(`Expected promise not to reject, but it rejected: ${error?.message}`);
          return;
        }

        if (!threw) {
          throw new Error('Expected promise to reject, but it resolved');
        }

        if (expected) {
          if (typeof expected === 'string' && !error.message.includes(expected)) {
            throw new Error(`Expected rejection message to include "${expected}", got: "${error.message}"`);
          } else if (expected instanceof RegExp && !expected.test(error.message)) {
            throw new Error(`Expected rejection message to match ${expected}, got: "${error.message}"`);
          }
        }
      }
    };
  }
}

export function expect(actual) {
  return new Expectation(actual);
}

// Registry for suites and tests
export class TestRegistry {
  constructor() {
    this.suites = [];
    this.currentSuite = null;
  }

  describe(name, fn) {
    const suite = {
      name,
      tests: [],
      suites: [],
      beforeAllHooks: [],
      afterAllHooks: [],
      beforeEachHooks: [],
      afterEachHooks: [],
      parent: this.currentSuite
    };

    if (this.currentSuite) {
      this.currentSuite.suites = this.currentSuite.suites || [];
      this.currentSuite.suites.push(suite);
    } else {
      this.suites.push(suite);
    }

    const prev = this.currentSuite;
    this.currentSuite = suite;
    try {
      fn();
    } finally {
      this.currentSuite = prev;
    }
  }

  test(name, fn, options = {}) {
    const testCase = {
      name,
      fn,
      skip: options.skip || false,
      timeout: options.timeout || 10000
    };

    if (this.currentSuite) {
      this.currentSuite.tests.push(testCase);
    } else {
      let defaultSuite = this.suites.find(s => s.name === 'Default Suite');
      if (!defaultSuite) {
        defaultSuite = {
          name: 'Default Suite',
          tests: [],
          suites: [],
          beforeAllHooks: [],
          afterAllHooks: [],
          beforeEachHooks: [],
          afterEachHooks: []
        };
        this.suites.push(defaultSuite);
      }
      defaultSuite.tests.push(testCase);
    }
  }

  beforeAll(fn) {
    if (this.currentSuite) this.currentSuite.beforeAllHooks.push(fn);
  }

  afterAll(fn) {
    if (this.currentSuite) this.currentSuite.afterAllHooks.push(fn);
  }

  beforeEach(fn) {
    if (this.currentSuite) this.currentSuite.beforeEachHooks.push(fn);
  }

  afterEach(fn) {
    if (this.currentSuite) this.currentSuite.afterEachHooks.push(fn);
  }

  clear() {
    this.suites = [];
    this.currentSuite = null;
  }
}

export const registry = new TestRegistry();
export const describe = registry.describe.bind(registry);
export const test = registry.test.bind(registry);
export const it = test;
export const beforeAll = registry.beforeAll.bind(registry);
export const before = beforeAll;
export const afterAll = registry.afterAll.bind(registry);
export const after = afterAll;
export const beforeEach = registry.beforeEach.bind(registry);
export const afterEach = registry.afterEach.bind(registry);

// Conditional execution helpers
export function skipIf(condition, name, fn) {
  registry.test(name, fn, { skip: Boolean(condition) });
}

export function testInMode(allowedMode, name, fn) {
  const currentMode = getMode();
  const shouldSkip = allowedMode !== 'all' && allowedMode !== currentMode;
  registry.test(name, fn, { skip: shouldSkip });
}

export function isMockMode() {
  return (process.env.E2E_MODE || 'mock').toLowerCase() === 'mock';
}

export function isLiveMode() {
  return (process.env.E2E_MODE || '').toLowerCase() === 'live';
}

export function getMode() {
  return (process.env.E2E_MODE || 'mock').toLowerCase();
}

/**
 * Upstream ERP Portal URL (Login.aspx, StudentPanel, tblAttendance).
 * - Live mode: https://ums.mydsi.org
 * - Mock mode: http://127.0.0.1:<port>
 */
export function getErpPortalUrl() {
  if (isLiveMode()) {
    return 'https://ums.mydsi.org';
  }
  return process.env.DSU_ERP_BASE_URL || process.env.E2E_MOCK_BASE_URL || 'http://127.0.0.1:3456';
}

/**
 * Local Application Proxy API URL (/api/erp/*).
 * - Both modes: http://127.0.0.1:<port> (local server executing real api/erp/attendance.js)
 */
export function getProxyTargetUrl() {
  return process.env.E2E_PROXY_BASE_URL || process.env.E2E_MOCK_BASE_URL || 'http://127.0.0.1:3456';
}

// Backward compatibility alias:
export function getTargetUrl() {
  return getProxyTargetUrl();
}

/**
 * Perform ASP.NET WebForms handshake GET to extract required hidden tokens.
 */
export async function fetchAspTokens(baseUrl = getErpPortalUrl()) {
  const res = await fetch(`${baseUrl}/Login.aspx/DSU`, {
    headers: {
      'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) Chrome/120.0.0.0 Safari/537.36',
      'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8'
    }
  });
  const html = await res.text();
  return {
    viewState: extractAspToken(html, '__VIEWSTATE'),
    viewStateGenerator: extractAspToken(html, '__VIEWSTATEGENERATOR') || 'C2EE9ABB',
    eventValidation: extractAspToken(html, '__EVENTVALIDATION')
  };
}

/**
 * Construct full URLSearchParams payload for ASP.NET login POST including required form tokens.
 */
export function buildLoginPayload(username, password, tokens = {}) {
  const params = new URLSearchParams();
  params.set('__LASTFOCUS', '');
  params.set('__EVENTTARGET', '');
  params.set('__EVENTARGUMENT', '');
  params.set('__VIEWSTATE', tokens.viewState || '');
  params.set('__VIEWSTATEGENERATOR', tokens.viewStateGenerator || 'C2EE9ABB');
  params.set('__VIEWSTATEENCRYPTED', '');
  params.set('__EVENTVALIDATION', tokens.eventValidation || '');
  params.set('hfWidth', '1920');
  params.set('hfHeight', '1080');
  params.set('hfLoginMethod', '');
  params.set('hfIsStaffLoginWithUserNameOTP', 'false');
  params.set('hfIsStudentLoginWithUserNameOTP', '');
  params.set('hfIsForgotPassword', '');
  params.set('rblRole', 'Student');
  params.set('txtUsername', username);
  params.set('txtPassword', password);
  params.set('btnLogin', 'Login');
  return params;
}

/**
 * In-memory storage implementation for tests simulating localStorage.
 */
export class MemoryStorage {
  constructor() {
    this.store = new Map();
  }
  getItem(key) {
    return this.store.has(key) ? this.store.get(key) : null;
  }
  setItem(key, value) {
    this.store.set(key, String(value));
  }
  removeItem(key) {
    this.store.delete(key);
  }
  clear() {
    this.store.clear();
  }
}

// Re-export calculation functions for test convenience
export const {
  calculatePercentage,
  calculateOverallAttendance,
  calculateAggregateAttendance,
  calculateStaticAdvice,
  calculateStreakProjection,
  calculateCalendarProjection,
  parseLocalDate,
  computeRemainingClasses
} = calculations;

export { assert };
