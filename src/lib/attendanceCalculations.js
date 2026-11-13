/**
 * src/lib/attendanceCalculations.js
 * Authoritative Pure Mathematical Calculation Engine for DSU Paper Hub
 * Matches PROJECT.md M3 specification and provides zero-dependency calculation formulas.
 */

/**
 * Calculates standard percentage.
 * @param {number} attended 
 * @param {number} conducted 
 * @returns {number} percentage rounded to 2 decimal places
 */
export function calculatePercentage(attended, conducted) {
  const c = Number(conducted) || 0;
  const a = Number(attended) || 0;
  if (c <= 0) return 100.0;
  if (a >= c) return 100.0;
  if (a <= 0) return 0.0;
  const pct = (a / c) * 100;
  return Math.min(100.0, Math.max(0.0, Math.round(pct * 100) / 100));
}

/**
 * Calculates overall attendance across an array of subjects.
 * Modes: 'weighted' (default, contact-hour based) or 'unweighted' (mean of percentages).
 */
export function calculateOverallAttendance(subjects = [], mode = 'weighted') {
  if (!Array.isArray(subjects) || subjects.length === 0) {
    return { percentage: 100.0, totalAttended: 0, totalConducted: 0 };
  }

  const totalAttended = subjects.reduce((sum, s) => sum + (Number(s.attended) || 0), 0);
  const totalConducted = subjects.reduce((sum, s) => sum + (Number(s.conducted ?? s.total) || 0), 0);

  if (mode === 'unweighted') {
    const valid = subjects.filter(s => (Number(s.conducted ?? s.total) || 0) > 0);
    const mean = valid.length > 0
      ? valid.reduce((sum, s) => sum + calculatePercentage(s.attended, s.conducted ?? s.total), 0) / valid.length
      : 100.0;
    return {
      percentage: Math.round(mean * 100) / 100,
      totalAttended,
      totalConducted
    };
  }

  return {
    percentage: calculatePercentage(totalAttended, totalConducted),
    totalAttended,
    totalConducted
  };
}

export function calculateAggregateAttendance(subjects) {
  return calculateOverallAttendance(subjects, 'weighted');
}

/**
 * Static immediate streak advice (when future semester schedule length is unknown).
 * Computes:
 * - canSkip (y_skip = floor((100*A - T*C) / T)) when current >= T
 * - classesNeeded (x_needed = ceil((T*C - 100*A) / (100 - T))) when current < T
 */
export function calculateStaticAdvice(attended, conducted, targetPct = 75) {
  const A = Math.max(0, Number(attended) || 0);
  const C = Math.max(A, Number(conducted) || 0);
  const T = Number(targetPct);
  const pct = calculatePercentage(A, C);

  if (C === 0) {
    return {
      pct: 100.0,
      status: 'safe',
      canSkip: 0,
      classesNeeded: 0,
      mustAttend: 0,
      adviceText: 'No classes conducted yet.'
    };
  }

  if (pct >= T) {
    const canSkip = T <= 0 ? Infinity : Math.floor((100 * A - T * C) / T);
    if (canSkip > 0) {
      return {
        pct,
        status: 'safe',
        canSkip,
        classesNeeded: 0,
        mustAttend: 0,
        adviceText: `On track! You can skip ${canSkip} upcoming class${canSkip === 1 ? '' : 'es'}.`
      };
    } else {
      return {
        pct,
        status: 'tight',
        canSkip: 0,
        classesNeeded: 0,
        mustAttend: 0,
        adviceText: 'Attendance is tight. Attend your next class to stay above target.'
      };
    }
  } else {
    if (T >= 100) {
      return {
        pct,
        status: 'danger',
        canSkip: 0,
        classesNeeded: Infinity,
        mustAttend: Infinity,
        adviceText: 'Cannot achieve 100% attendance once a class has been missed.'
      };
    }
    const classesNeeded = Math.ceil((T * C - 100 * A) / (100 - T));
    return {
      pct,
      status: 'danger',
      canSkip: 0,
      classesNeeded,
      mustAttend: classesNeeded,
      adviceText: `Need to attend next ${classesNeeded} consecutive class${classesNeeded === 1 ? '' : 'es'} to hit ${T}%.`
    };
  }
}

export function calculateStreakProjection(attended, conducted, targetPct = 75) {
  const adv = calculateStaticAdvice(attended, conducted, targetPct);
  return {
    canSkip: adv.canSkip,
    mustAttend: adv.classesNeeded,
    classesNeeded: adv.classesNeeded,
    status: adv.status,
    pct: adv.pct
  };
}

/**
 * Calendar-Aware Projection Engine.
 * Evaluates full semester trajectory incorporating future scheduled classes F.
 */
export function calculateCalendarProjection({
  attended,
  conducted,
  futureSlots = 0,
  targetPct = 75
}) {
  const A = Math.max(0, Number(attended) || 0);
  const C = Math.max(A, Number(conducted) || 0);
  const F = Math.max(0, Number(futureSlots) || 0);
  const T = Number(targetPct);
  const currentPct = calculatePercentage(A, C);

  // When no future classes remain
  if (F === 0) {
    const reachable = currentPct >= T;
    const staticRes = calculateStaticAdvice(A, C, T);
    if (!reachable) {
      const deficit = Math.max(0, Math.ceil((C * T) / 100) - A);
      return {
        pct: currentPct,
        status: 'cooked',
        isReachable: false,
        isCooked: true,
        maxPossiblePct: currentPct,
        maxAttainablePct: currentPct,
        futureSlots: 0,
        deficit,
        classesNeeded: 0,
        mustAttend: 0,
        neededClasses: 0,
        requiredFutureAttendance: 0,
        canSkip: 0,
        allowedFutureAbsences: 0,
        adviceText: `You're cooked — semester ended with 0 classes remaining. Final attendance is ${currentPct}% (target ${T}% missed).`
      };
    } else {
      return {
        pct: currentPct,
        status: 'safe',
        isReachable: true,
        isCooked: false,
        maxPossiblePct: currentPct,
        maxAttainablePct: currentPct,
        futureSlots: 0,
        deficit: 0,
        classesNeeded: 0,
        mustAttend: 0,
        neededClasses: 0,
        requiredFutureAttendance: 0,
        canSkip: staticRes.canSkip,
        allowedFutureAbsences: staticRes.canSkip,
        adviceText: `Target achieved! Final attendance is ${currentPct}%. Semester complete with no remaining classes.`
      };
    }
  }

  const finalConducted = C + F;
  const reqAttended = Math.ceil((finalConducted * T) / 100.0);
  const maxPossibleAttended = A + F;
  const maxPossiblePct = calculatePercentage(maxPossibleAttended, finalConducted);

  // Feasibility Check
  if (maxPossibleAttended < reqAttended) {
    const deficit = reqAttended - maxPossibleAttended;
    const needed = reqAttended - A;
    return {
      pct: currentPct,
      status: 'cooked',
      isReachable: false,
      isCooked: true,
      maxPossiblePct,
      maxAttainablePct: maxPossiblePct,
      futureSlots: F,
      deficit,
      classesNeeded: needed,
      mustAttend: needed,
      neededClasses: needed,
      requiredFutureAttendance: needed,
      canSkip: 0,
      allowedFutureAbsences: 0,
      adviceText: `You're cooked — need ${needed}, but only ${F} classes left! Max achievable is ${maxPossiblePct}%.`
    };
  }

  // Reachable target
  const needed = Math.max(0, reqAttended - A);
  const canSkip = Math.max(0, F - needed);

  if (currentPct >= T) {
    return {
      pct: currentPct,
      status: canSkip > 0 ? 'safe' : 'tight',
      isReachable: true,
      isCooked: false,
      maxPossiblePct,
      maxAttainablePct: maxPossiblePct,
      futureSlots: F,
      deficit: 0,
      classesNeeded: needed,
      mustAttend: needed,
      neededClasses: needed,
      requiredFutureAttendance: needed,
      canSkip,
      allowedFutureAbsences: canSkip,
      adviceText: canSkip > 0
        ? `Can skip ${canSkip} of ${F} remaining classes to finish at ${T}%.`
        : `Attendance is tight. Must attend ${needed} of ${F} remaining classes.`
    };
  } else {
    return {
      pct: currentPct,
      status: 'warning',
      isReachable: true,
      isCooked: false,
      maxPossiblePct,
      maxAttainablePct: maxPossiblePct,
      futureSlots: F,
      deficit: 0,
      classesNeeded: needed,
      mustAttend: needed,
      neededClasses: needed,
      requiredFutureAttendance: needed,
      canSkip,
      allowedFutureAbsences: canSkip,
      adviceText: `Need ${needed} of ${F} remaining classes to reach ${T}%.`
    };
  }
}

/**
 * Timezone-safe local date parser.
 * Prevents UTC midnight strings ('YYYY-MM-DD') from shifting backward in negative UTC offsets.
 */
export function parseLocalDate(input) {
  if (!input) return new Date();
  if (input instanceof Date) {
    const d = new Date(input.getTime());
    d.setHours(0, 0, 0, 0);
    return d;
  }
  if (typeof input === 'string') {
    const parts = input.trim().split('T')[0].split('-');
    if (parts.length === 3) {
      const year = parseInt(parts[0], 10);
      const month = parseInt(parts[1], 10) - 1;
      const day = parseInt(parts[2], 10);
      return new Date(year, month, day, 0, 0, 0, 0);
    }
  }
  const d = new Date(input);
  d.setHours(0, 0, 0, 0);
  return d;
}

/**
 * Computes remaining class instances between startDate (or today) and semesterEndDate.
 */
export function computeRemainingClasses({
  timetableByDay = {},
  holidays = [],
  saturdayOffRule,
  saturdayRule,
  semesterEndDate,
  startDate
} = {}) {
  if (!semesterEndDate) return 0;

  const effectiveSaturdayRule = saturdayOffRule || saturdayRule || 'OFF_2ND_4TH';

  const endDate = parseLocalDate(semesterEndDate);
  endDate.setHours(23, 59, 59, 999);

  const cur = parseLocalDate(startDate);

  if (cur > endDate) return 0;

  const holidaySet = new Set(
    holidays.map(h => (typeof h === 'string' ? h : h.date))
  );

  let futureCount = 0;
  const runnerDate = new Date(cur);

  while (runnerDate <= endDate) {
    const y = runnerDate.getFullYear();
    const m = String(runnerDate.getMonth() + 1).padStart(2, '0');
    const d = String(runnerDate.getDate()).padStart(2, '0');
    const dateStr = `${y}-${m}-${d}`;

    const dayOfWeek = runnerDate.getDay(); // 0 = Sun, 6 = Sat

    let isHoliday = holidaySet.has(dateStr);

    if (dayOfWeek === 0) {
      isHoliday = true; // Sunday off
    } else if (dayOfWeek === 6) {
      if (effectiveSaturdayRule === 'OFF_ALL') {
        isHoliday = true;
      } else if (effectiveSaturdayRule === 'OFF_2ND_4TH') {
        const dom = runnerDate.getDate();
        const satIdx = Math.ceil(dom / 7);
        if (satIdx === 2 || satIdx === 4) {
          isHoliday = true;
        }
      }
    }

    if (!isHoliday) {
      const dayClasses = timetableByDay[dayOfWeek];
      if (Array.isArray(dayClasses)) {
        futureCount += dayClasses.length;
      } else if (typeof dayClasses === 'number') {
        futureCount += dayClasses;
      } else if (dayClasses !== undefined) {
        futureCount += 1;
      }
    }

    runnerDate.setDate(runnerDate.getDate() + 1);
  }

  return futureCount;
}

export default {
  calculatePercentage,
  calculateOverallAttendance,
  calculateAggregateAttendance,
  calculateStaticAdvice,
  calculateStreakProjection,
  calculateCalendarProjection,
  parseLocalDate,
  computeRemainingClasses
};
