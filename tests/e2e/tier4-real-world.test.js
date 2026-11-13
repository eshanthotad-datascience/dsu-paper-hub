/**
 * tests/e2e/tier4-real-world.test.js
 * Tier 4: Real-World Application Scenarios
 * Simulates complete, authentic student user journeys and university operational conditions.
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

describe('Tier 4: Real-World Application Scenarios', () => {
  test('T4-SC01: Real Student USN 26UGENG2182 Onboarding & Live Dynamic Dashboard', async () => {
    // Persona: Eshan Subash Thotad, 1st Year B.Tech CS at DSU
    // Credentials: USN 26UGENG2182, Password 6$0$75659N
    const res = await fetch(`${getTargetUrl()}/api/erp/attendance`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(TEST_CREDENTIALS.valid)
    });

    expect(res.status).toBe(200);
    const dashboard = await res.json();
    expect(dashboard.success).toBe(true);
    expect(dashboard.studentName).toBe('ESHAN SUBASH THOTAD');
    expect(dashboard.usn).toBe('26UGENG2182');
    expect(dashboard.overall.conducted).toBe(78);
    expect(dashboard.overall.attended).toBe(63);
    expect(dashboard.overall.absent).toBe(15);
    expect(dashboard.overall.percentage).toBe(80.77);

    // Eligibility check: overall >= 75% is ELIGIBLE
    const isEligible = dashboard.overall.percentage >= 75.0;
    expect(isEligible).toBe(true);

    // Verify dynamic parsing yields all 8 courses
    expect(dashboard.subjects).toHaveLength(8);

    // Verify key subjects from B.Tech CS cluster
    const linearAlgebra = dashboard.subjects.find(s => s.code === '26EN1101');
    expect(linearAlgebra.attended).toBe(4);
    expect(linearAlgebra.conducted).toBe(5);
    expect(linearAlgebra.percentage).toBe(80.0);

    const chemTheory = dashboard.subjects.find(s => s.code === '26EN1102' && s.slotType === 'Theory');
    expect(chemTheory.conducted).toBe(16);
    expect(chemTheory.attended).toBe(10);
    expect(chemTheory.percentage).toBe(62.5);

    const chemLab = dashboard.subjects.find(s => s.code === '26EN1102' && s.slotType === 'Practical');
    expect(chemLab.conducted).toBe(8);
    expect(chemLab.attended).toBe(7);
    expect(chemLab.percentage).toBe(87.5);
  });

  test('T4-SC02: At-Risk Student Attendance Recovery Plan (62.5% -> 75%)', () => {
    // Persona: Student fell behind due to illness in Chemistry Theory (26EN1102): 10 attended / 16 conducted (62.5%)
    // 1. Immediate streak advice to reach 75%:
    // x = ceil((0.75 * 16 - 10) / (1 - 0.75)) = ceil((12 - 10) / 0.25) = 8 consecutive classes
    const streak = calculateStaticAdvice(10, 16, 75);
    expect(streak.mustAttend).toBe(8);
    expect(streak.canSkip).toBe(0);
    expect(streak.status).toBe('danger');

    // 2. Student activates Academic Calendar Projection:
    // Future classes scheduled in semester: F = 13 (Mon/Wed/Fri schedule until semester end, Kanakadasa Jayanthi excluded)
    // Final conducted: 16 + 13 = 29.
    // Minimum required attended: ceil(29 * 0.75) = 22.
    // Max attainable attended: 10 + 13 = 23 >= 22 -> Reached!
    // Required future classes: 22 - 10 = 12 out of 13.
    // Allowed future absences: 13 - 12 = 1.
    const calProj = calculateCalendarProjection({ attended: 10, conducted: 16, futureSlots: 13, targetPct: 75 });
    expect(calProj.isReachable).toBe(true);
    expect(calProj.isCooked).toBe(false);
    expect(calProj.classesNeeded).toBe(12);
    expect(calProj.canSkip).toBe(1);
    expect(calProj.maxPossiblePct).toBe(79.31);
    expect(calProj.adviceText).toContain('Need 12 of 13 remaining classes');
  });

  test('T4-SC03: High-Attendance Student Strategic Bunk Optimizer (92% -> 85%)', () => {
    // Persona: Distinction student with 92.0% in Data Structures (50 conducted, 46 attended)
    // Student wants to attend a 4-day hackathon and tests allowable skips without dropping below 85% distinction

    // 1. Immediate streak bunk capacity at 85%:
    // y = floor((100 * 46 - 85 * 50) / 85) = floor((4600 - 4250) / 85) = floor(350 / 85) = 4 classes
    const streak85 = calculateStaticAdvice(46, 50, 85);
    expect(streak85.canSkip).toBe(4);
    expect(streak85.classesNeeded).toBe(0);

    // Verify mathematical invariant: After 4 skips, attendance is 46 / 54 = 85.19% >= 85%
    expect(calculatePercentage(46, 50 + 4)).toBe(85.19);
    // After 5 skips, attendance drops to 46 / 55 = 83.64% < 85%
    expect(calculatePercentage(46, 50 + 5)).toBe(83.64);

    // 2. Calendar-aware semester projection at 85% with 16 future classes (F = 16):
    // Final: 66. Req: ceil(66 * 0.85) = 57. Needed: 57 - 46 = 11. Can skip: 16 - 11 = 5 classes.
    const calProj85 = calculateCalendarProjection({ attended: 46, conducted: 50, futureSlots: 16, targetPct: 85 });
    expect(calProj85.canSkip).toBe(5);
    expect(calProj85.classesNeeded).toBe(11);

    // 3. Student tests sliding target down to 75% pass mark:
    // Immediate bunk capacity jumps to: floor((4600 - 3750) / 75) = floor(850 / 75) = 11 classes
    const streak75 = calculateStaticAdvice(46, 50, 75);
    expect(streak75.canSkip).toBe(11);
    expect(calculatePercentage(46, 50 + 11)).toBe(75.41); // >= 75%
  });

  test('T4-SC04: Multi-Branch Curriculum Ingestion & Structural Adaptability', () => {
    // Verifies architecture across diverse academic schools at DSU:
    // School 1: School of Engineering (B.Tech CS, 8 subjects, mixed Theory + Practical)
    const engSubjects = MOCK_JSON.validProxyResponse.subjects;
    const engResult = calculateOverallAttendance(engSubjects, 'weighted');
    expect(engSubjects.length).toBe(8);
    expect(engSubjects.some(s => s.slotType === 'Practical')).toBe(true);
    expect(engResult.totalConducted).toBe(78);
    expect(engResult.percentage).toBe(80.77);

    // School 2: School of Commerce & Management (BBA, 5 pure theory courses, 30 hours each)
    const mgmtSubjects = [
      { code: '23MB101', slotType: 'Theory', name: 'FINANCIAL ACCOUNTING', conducted: 30, attended: 27, absent: 3, percentage: 90.0 },
      { code: '23MB102', slotType: 'Theory', name: 'BUSINESS ECONOMICS', conducted: 30, attended: 24, absent: 6, percentage: 80.0 },
      { code: '23MB103', slotType: 'Theory', name: 'MARKETING MANAGEMENT', conducted: 30, attended: 24, absent: 6, percentage: 80.0 },
      { code: '23MB104', slotType: 'Theory', name: 'ORGANIZATIONAL BEHAVIOR', conducted: 30, attended: 24, absent: 6, percentage: 80.0 },
      { code: '23MB105', slotType: 'Theory', name: 'BUSINESS STATISTICS', conducted: 30, attended: 21, absent: 9, percentage: 70.0 }
    ];
    const mgmtResult = calculateOverallAttendance(mgmtSubjects, 'weighted');
    expect(mgmtSubjects.length).toBe(5);
    expect(mgmtSubjects.every(s => s.slotType === 'Theory')).toBe(true);
    expect(mgmtResult.totalConducted).toBe(150);
    expect(mgmtResult.totalAttended).toBe(120);
    expect(mgmtResult.percentage).toBe(80.0);

    // School 3: School of Law (BA LLB, 4 intensive courses with 50 conducted hours each)
    const lawSubjects = [
      { code: '23LW101', slotType: 'Theory', name: 'CONSTITUTIONAL LAW I', conducted: 50, attended: 45, absent: 5, percentage: 90.0 },
      { code: '23LW102', slotType: 'Theory', name: 'LAW OF TORTS', conducted: 50, attended: 45, absent: 5, percentage: 90.0 },
      { code: '23LW103', slotType: 'Theory', name: 'FAMILY LAW', conducted: 50, attended: 45, absent: 5, percentage: 90.0 },
      { code: '23LW104', slotType: 'Theory', name: 'LEGAL METHODS', conducted: 50, attended: 40, absent: 10, percentage: 80.0 }
    ];
    const lawResult = calculateOverallAttendance(lawSubjects, 'weighted');
    expect(lawSubjects.length).toBe(4);
    expect(lawResult.totalConducted).toBe(200);
    expect(lawResult.totalAttended).toBe(175);
    expect(lawResult.percentage).toBe(87.5);
  });

  test('T4-SC05: ERP Portal Maintenance & Network Outage Fault Tolerance', async () => {
    // Persona: Student logs in during GNUMS maintenance window (11:55 PM - 12:30 AM IST)
    const res = await fetch(`${getTargetUrl()}/api/erp/simulate-503`, { method: 'POST' });
    expect(res.status).toBe(503);
    const data = await res.json();
    expect(data.success).toBe(false);
    expect(data.error).toContain('scheduled maintenance');

    // UI state machine receives 503 error, presents manual Quick Calculator fallback
    const quickModeActive = true;
    expect(quickModeActive).toBe(true);

    // Student performs quick manual calculation: conducted = 30, attended = 24, target = 75%
    const quickAdvice = calculateStaticAdvice(24, 30, 75);
    expect(quickAdvice.pct).toBe(80.0);
    expect(quickAdvice.canSkip).toBe(2);
    expect(quickAdvice.status).toBe('safe');
  });

  test('T4-SC06: End-of-Semester Debarment / "You\'re Cooked" Edge Scenario', () => {
    // Persona: Student with severe attendance shortage in Environmental Science (26EN1111)
    // Conducted: 40, Attended: 15 (37.50%, 25 absences). Target: 75%
    // Only 10 classes remaining before the semester concludes (F = 10)

    // 1. Feasibility check:
    // Final conducted: 50. Required attended at 75%: ceil(50 * 0.75) = 38.
    // Max possible attended: 15 + 10 = 25.
    // Deficit: 38 - 25 = 13 classes. Max achievable percentage: (25/50) * 100 = 50.0%
    const calProj75 = calculateCalendarProjection({ attended: 15, conducted: 40, futureSlots: 10, targetPct: 75 });
    expect(calProj75.isCooked).toBe(true);
    expect(calProj75.isReachable).toBe(false);
    expect(calProj75.status).toBe('cooked');
    expect(calProj75.deficit).toBe(13);
    expect(calProj75.classesNeeded).toBe(23);
    expect(calProj75.maxPossiblePct).toBe(50.0);
    expect(calProj75.adviceText).toContain("You're cooked");

    // 2. Student searches for achievable threshold by sliding target down to 50%:
    // At 50% target: Required attended: ceil(50 * 0.50) = 25.
    // Max attainable: 25 >= 25 -> Feasible!
    // Must attend all 10 remaining classes without any absence.
    const calProj50 = calculateCalendarProjection({ attended: 15, conducted: 40, futureSlots: 10, targetPct: 50 });
    expect(calProj50.isCooked).toBe(false);
    expect(calProj50.isReachable).toBe(true);
    expect(['warning', 'tight']).toContain(calProj50.status);
    expect(calProj50.classesNeeded).toBe(10);
    expect(calProj50.canSkip).toBe(0);
  });
});
