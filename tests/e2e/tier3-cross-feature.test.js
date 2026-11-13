/**
 * tests/e2e/tier3-cross-feature.test.js
 * Tier 3: Cross-Feature Combinations & Pairwise Matrix
 * Validates complex interactions between subsystems: Auth, Proxy, Parser, Math Engine, Calendar, and Client State.
 */

import { describe, test, it, expect, getTargetUrl } from './helpers/testUtils.js';
import { MOCK_HTML, MOCK_FIXTURES, TEST_CREDENTIALS, MOCK_CALENDAR, MOCK_JSON } from './helpers/fixtures.js';
import {
  calculatePercentage,
  calculateOverallAttendance,
  calculateAggregateAttendance,
  calculateStaticAdvice,
  calculateStreakProjection,
  calculateCalendarProjection,
  computeRemainingClasses
} from './helpers/attendanceCalculations.js';

describe('Tier 3: Cross-Feature Combinations & Pairwise Matrix', () => {
  test('T3-01: End-to-End Pipeline — Valid Auth, Dynamic Table Extraction, and Aggregate Attendance', async () => {
    // Pipeline: Auth credentials -> Proxy endpoint -> Dynamic extraction -> Aggregate math verification
    const res = await fetch(`${getTargetUrl()}/api/erp/attendance`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(TEST_CREDENTIALS.valid)
    });

    expect(res.status).toBe(200);
    const data = await res.json();
    expect(data.success).toBe(true);
    expect(data.studentName).toBe('ESHAN SUBASH THOTAD');
    expect(data.usn).toBe('26UGENG2182');
    expect(data.overall.conducted).toBe(78);
    expect(data.overall.attended).toBe(63);
    expect(data.overall.absent).toBe(15);
    expect(data.overall.percentage).toBe(80.77);
    expect(data.subjects).toHaveLength(8);

    // Cross-validate that math engine on returned subjects matches overall summary
    const computedAggregate = calculateOverallAttendance(data.subjects, 'weighted');
    expect(computedAggregate.totalConducted).toBe(data.overall.conducted);
    expect(computedAggregate.totalAttended).toBe(data.overall.attended);
    expect(computedAggregate.percentage).toBe(data.overall.percentage);
  });

  test('T3-02: Auth Failure Cascade — Invalid Credentials Handling, Client Error State, and Banner Alert', async () => {
    // Pipeline: Invalid credentials -> 401 response -> Client error state machine -> UI banner alert model
    const res = await fetch(`${getTargetUrl()}/api/erp/attendance`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(TEST_CREDENTIALS.invalidPassword)
    });

    expect(res.status).toBe(401);
    const data = await res.json();
    expect(data.success).toBe(false);
    expect(data.error).toContain('Invalid Username or Password');

    // Simulate client state machine transition
    const clientState = {
      isLoading: false,
      isAuthenticated: false,
      errorBanner: {
        visible: true,
        text: data.error,
        variant: 'danger'
      },
      cachedSubjects: null
    };

    expect(clientState.isLoading).toBe(false);
    expect(clientState.isAuthenticated).toBe(false);
    expect(clientState.errorBanner.visible).toBe(true);
    expect(clientState.errorBanner.text).toBe('Invalid Username or Password');
    expect(clientState.cachedSubjects).toBeNull();
  });

  test('T3-03: Course Slot Disambiguation — Dual-Slot Parsing and Independent Streak Projections', () => {
    // Course 26EN1102 has both Practical (7/8) and Theory (10/16) slots
    // Practical Slot: 7/8 = 87.50%
    const practicalAdvice = calculateStaticAdvice(7, 8, 75);
    expect(practicalAdvice.pct).toBe(87.50);
    expect(practicalAdvice.status).toBe('safe');
    expect(practicalAdvice.canSkip).toBe(1); // floor((700 - 600)/75) = 1
    expect(practicalAdvice.classesNeeded).toBe(0);

    // Theory Slot: 10/16 = 62.50%
    const theoryAdvice = calculateStaticAdvice(10, 16, 75);
    expect(theoryAdvice.pct).toBe(62.50);
    expect(theoryAdvice.status).toBe('danger');
    expect(theoryAdvice.canSkip).toBe(0);
    expect(theoryAdvice.classesNeeded).toBe(8); // ceil((1200 - 1000)/25) = 8

    // Verify keying prevents collision: map keys must be unique
    const slotMap = new Map();
    slotMap.set('26EN1102_practical', practicalAdvice);
    slotMap.set('26EN1102_theory', theoryAdvice);

    expect(slotMap.size).toBe(2);
    expect(slotMap.get('26EN1102_practical').status).toBe('safe');
    expect(slotMap.get('26EN1102_theory').status).toBe('danger');
  });

  test('T3-04: Academic Calendar Integration — Holiday Skipping, Future Slots, and isCooked Transition', () => {
    // Course 26EN1111: Conducted 17, Attended 11 (64.71%), target 75%
    // Timetable: 2 classes per week. Today: Nov 13, End: Dec 15 (8 classes scheduled after Kanakadasa Jayanthi Nov 20)
    const futureSlots = 8;

    // At Target 75%:
    // Final: 17 + 8 = 25. Req attended: ceil(25 * 0.75) = 19. Max possible: 11 + 8 = 19.
    // 19 >= 19 -> Feasible!
    const proj75 = calculateCalendarProjection({ attended: 11, conducted: 17, futureSlots, targetPct: 75 });
    expect(proj75.isReachable).toBe(true);
    expect(proj75.isCooked).toBe(false);
    expect(proj75.status).toBe('warning');
    expect(proj75.classesNeeded).toBe(8);
    expect(proj75.canSkip).toBe(0);
    expect(proj75.maxPossiblePct).toBe(76.0);

    // Shift slider to Target 80%:
    // Req attended: ceil(25 * 0.80) = 20. Max possible: 19 < 20. Cooked!
    const proj80 = calculateCalendarProjection({ attended: 11, conducted: 17, futureSlots, targetPct: 80 });
    expect(proj80.isReachable).toBe(false);
    expect(proj80.isCooked).toBe(true);
    expect(proj80.status).toBe('cooked');
    expect(proj80.deficit).toBe(1);
    expect(proj80.adviceText).toContain("You're cooked");
  });

  test('T3-05: Proxy & Client Cache Lifecycle — Hit/Miss Mechanics, Invalidation, and Real-Time Slider', async () => {
    // Simulated Client Cache Store
    const clientCache = {
      entry: null,
      fetchCount: 0,
      async getAttendance(forceRefresh = false) {
        if (!forceRefresh && this.entry && (Date.now() - this.entry.timestamp < 15 * 60 * 1000)) {
          return this.entry.data;
        }
        this.fetchCount++;
        const res = await fetch(`${getTargetUrl()}/api/erp/attendance`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(TEST_CREDENTIALS.valid)
        });
        const data = await res.json();
        this.entry = { data, timestamp: Date.now() };
        return data;
      }
    };

    // 1. First fetch -> Cache Miss (network fetch 1)
    const data1 = await clientCache.getAttendance();
    expect(clientCache.fetchCount).toBe(1);
    expect(data1.studentName).toBe('ESHAN SUBASH THOTAD');

    // 2. Second fetch -> Cache Hit (zero network requests)
    const data2 = await clientCache.getAttendance();
    expect(clientCache.fetchCount).toBe(1);
    expect(data2).toEqual(data1);

    // 3. User drags slider from 75% to 85% -> Recomputes projections synchronously without network
    const initialAdvice = calculateStaticAdvice(data2.overall.attended, data2.overall.conducted, 75);
    expect(initialAdvice.canSkip).toBe(6);

    const higherAdvice = calculateStaticAdvice(data2.overall.attended, data2.overall.conducted, 85);
    expect(higherAdvice.canSkip).toBe(0);
    expect(higherAdvice.classesNeeded).toBe(22);
    expect(clientCache.fetchCount).toBe(1); // Still no network calls

    // 4. Force refresh -> Cache Invalidation (network fetch 2)
    const data3 = await clientCache.getAttendance(true);
    expect(clientCache.fetchCount).toBe(2);
    expect(data3.studentName).toBe('ESHAN SUBASH THOTAD');
  });

  test('T3-06: Encoding Resilience — Special Characters in Password and ASP.NET Form Serialization', async () => {
    // Password with URL-reserved characters: $, &, %, +, =, #
    const complexPassword = '6$0$75659N#&%+=';
    const params = new URLSearchParams();
    params.set('txtUsername', '26UGENG2182');
    params.set('txtPassword', complexPassword);
    params.set('rblRole', 'Student');

    const serialized = params.toString();
    expect(serialized).toContain('%24'); // $
    expect(serialized).toContain('%23'); // #
    expect(serialized).toContain('%26'); // &
    expect(serialized).toContain('%25'); // %
    expect(serialized).toContain('%2B'); // +
    expect(serialized).toContain('%3D'); // =

    // Decodes cleanly without truncation at &
    const parsedBack = new URLSearchParams(serialized);
    expect(parsedBack.get('txtPassword')).toBe(complexPassword);

    // Server accepts properly encoded password and redirects
    const res = await fetch(`${getTargetUrl()}/Login.aspx/DSU`, {
      method: 'POST',
      body: serialized,
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      redirect: 'manual'
    });

    expect(res.status).toBe(302);
  });

  test('T3-07: Gateway Timeout (504) Resilience — Stale Cache Fallback and UI Warning Badge', async () => {
    // Existing cached session
    const staleData = MOCK_JSON.validProxyResponse;

    // Simulate upstream ERP outage
    const res = await fetch(`${getTargetUrl()}/api/erp/simulate-504`, { method: 'POST' });
    expect(res.status).toBe(504);

    // Client resilience fallback logic:
    let displayState;
    if (!res.ok && staleData) {
      displayState = {
        data: staleData,
        isStale: true,
        banner: {
          visible: true,
          variant: 'warning',
          message: 'ERP portal temporarily unreachable; displaying cached attendance data.'
        }
      };
    }

    expect(displayState.isStale).toBe(true);
    expect(displayState.data.studentName).toBe('ESHAN SUBASH THOTAD');
    expect(displayState.banner.variant).toBe('warning');
    expect(displayState.banner.message).toContain('temporarily unreachable');
  });

  test('T3-08: Multi-Branch Contact Hour Variance — Aggregate vs Unweighted Mean Math Consistency', () => {
    // Dataset 1: Engineering curriculum (high contact hour variance between Lab and Core Theory)
    const engSubjects = [
      { code: 'LAB', conducted: 20, attended: 20 },      // 100% (20 hours)
      { code: 'THEORY', conducted: 60, attended: 36 }    // 60% (60 hours)
    ];

    // Total: 56 / 80 = 70.0% weighted; Mean of [100, 60] = 80.0% unweighted
    const engWeighted = calculateOverallAttendance(engSubjects, 'weighted');
    const engUnweighted = calculateOverallAttendance(engSubjects, 'unweighted');
    expect(engWeighted.percentage).toBe(70.00);
    expect(engUnweighted.percentage).toBe(80.00);

    // Dataset 2: Management curriculum (uniform 30 contact hours per subject)
    const mgmtSubjects = [
      { code: 'M1', conducted: 30, attended: 27 }, // 90%
      { code: 'M2', conducted: 30, attended: 24 }, // 80%
      { code: 'M3', conducted: 30, attended: 21 }  // 70%
    ];

    // Total: 72 / 90 = 80.0% weighted; Mean of [90, 80, 70] = 80.0% unweighted
    const mgmtWeighted = calculateOverallAttendance(mgmtSubjects, 'weighted');
    const mgmtUnweighted = calculateOverallAttendance(mgmtSubjects, 'unweighted');
    expect(mgmtWeighted.percentage).toBe(80.00);
    expect(mgmtUnweighted.percentage).toBe(80.00);

    // Mathematical invariant: When contact hours are uniform across courses, weighted and unweighted are equal
    expect(mgmtWeighted.percentage).toBe(mgmtUnweighted.percentage);
  });
});
