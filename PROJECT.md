# Project: DSU Paper Hub Dynamic Attendance Calculator

## Architecture
The dynamic attendance calculator integrates with the Dayananda Sagar University (DSU) GNUMS ERP portal (`https://ums.mydsi.org/Login.aspx/DSU`) via a serverless proxy route and Vite dev proxy, dynamic table parser, pure mathematical calculation engine, academic calendar store, and an interactive React UI dashboard.

```
[Student in Browser]
       │
       ▼
[React UI: AttendanceCalculator.jsx]
       │  (fetches /api/erp/attendance)
       ▼
[Backend Proxy: api/erp/attendance.js & Vite dev proxy]
       │
       ├── 1. Handshake GET (extracts ViewState, EventValidation)
       ├── 2. Auth POST (submits credentials, captures session cookies)
       │      └─ Invalid credentials check (handles #ucMessage_lblError)
       ├── 3. Attendance GET (fetches #tblAttendance HTML)
       └── 4. Dynamic Parser (extracts live subjects, slot types, conducted/attended)
       │
       ▼ (returns normalized JSON)
[Calculations Engine: attendanceCalculations.js + academicCalendar.json]
       │  (computes %, streak bunk margins, calendar projections, cooked warnings)
       ▼
[Interactive Dashboard UI]
```

## Feature Inventory
| # | Feature | Description | Milestone | Source |
|---|---------|-------------|-----------|--------|
| 1 | DSU ERP Handshake & Auth | ASP.NET token extraction, auth POST, session cookie management (`ASP.NET_SessionId`, `NCBL`) | M1 | spec_miner_survey_2 |
| 2 | Invalid Credential Handling | Detection of `#ucMessage_lblError` and informative error response | M1 | spec_miner_survey_2 |
| 3 | Backend Serverless / Dev Proxy | `/api/erp/attendance` route for production & Vite dev proxy for local dev | M1 | explorer_survey_1 |
| 4 | Dynamic Subject & Attendance Parsing | Parsing `#tblAttendance` into normalized JSON without hardcoding branches/subjects | M2 | spec_miner_survey_2 |
| 5 | Theory & Practical Slot Handling | Distinguishing and handling course slot types and course codes | M2 | spec_miner_survey_2 |
| 6 | Attendance Math Engine | Pure functions for subject %, aggregate %, immediate streak skip/need | M3 | explorer_survey_3 |
| 7 | Academic Calendar & Semester Projections | Date-stepping, holiday filtering, future slots, and feasibility ("cooked") alerts | M3 | explorer_survey_3 |
| 8 | UI Dashboard Overhaul | Dynamic rendering of live subjects, login card, threshold slider, error banner | M4 | explorer_survey_1 |
| 9 | Client ERP Integration | `src/lib/erpClient.js` client layer with caching & state management | M4 | explorer_survey_1 |
| 10 | Automated CLI Verification Script | Standalone verification script (`scripts/verify-dsu-erp.js`) for test credentials | M5 | ORIGINAL_REQUEST |
| 11 | E2E Testing Suite & Build Verification | Complete test runner passing all Tiers 1-4 and `npm run build` | M5 | ORIGINAL_REQUEST |

## Milestones
| # | Name | Scope | Dependencies | Status |
|---|------|-------|-------------|--------|
| M1 | ERP Authentication & Proxy Service | Backend proxy (`api/erp/attendance.js`), Vite proxy, handshake GET, auth POST, session cookies, invalid credential detection | none | DONE (Gate PASS) |
| M2 | Dynamic Attendance Extraction & Parser | Fetching and parsing `#tblAttendance`, student name, enrolled subjects, slot types, conducted/attended hours | M1 | IN_PROGRESS (862c6f23-7f49-43f5-a7bd-79d708be6504) |
| M3 | Calculations Engine & Academic Calendar | `attendanceCalculations.js` mathematical formulas, edge cases, `academicCalendar.json`, semester calendar projection | none | IN_PROGRESS (152ef1f4-4a48-41ce-94a9-bd016bb118b3) |
| M4 | UI Integration & Interactive Dashboard | `AttendanceCalculator.jsx` overhaul, `erpClient.js`, target threshold slider, projection cards, responsive CSS | M2, M3 | PLANNED |
| M5 | E2E Verification & Hardening | Automated verification script `scripts/verify-dsu-erp.js`, 100% pass of E2E test suite, `npm run build` validation | M4 | PLANNED |

## Interface Contracts

### M1/M2 Proxy API: `/api/erp/attendance`
- **Method**: `POST`
- **Request Body**:
  ```json
  {
    "username": "26UGENG2182",
    "password": "..."
  }
  ```
- **Success Response (HTTP 200)**:
  ```json
  {
    "success": true,
    "studentName": "ESHAN SUBASH THOTAD",
    "usn": "26UGENG2182",
    "overall": {
      "conducted": 78,
      "attended": 63,
      "absent": 15,
      "percentage": 80.77
    },
    "subjects": [
      {
        "slotType": "Theory",
        "code": "26EN1101",
        "name": "LINEAR ALGEBRA AND DATA FOUNDATIONS",
        "conducted": 5,
        "attended": 4,
        "absent": 1,
        "percentage": 80.0
      }
    ]
  }
  ```
- **Error Response (HTTP 401)**:
  ```json
  {
    "success": false,
    "error": "Invalid Username or Password"
  }
  ```

### M3 Calculations Engine: `src/lib/attendanceCalculations.js`
- `calculatePercentage(attended, conducted)` -> `number` (rounded to 2 decimal places)
- `calculateStreakProjection(attended, conducted, targetPct)` -> `{ canSkip: number, mustAttend: number }`
- `calculateCalendarProjection(attended, conducted, futureSlots, targetPct)` -> `{ isCooked: boolean, maxAttainablePct: number, requiredFutureAttendance: number, allowedFutureAbsences: number, neededClasses: number }`
- `calculateAggregateAttendance(subjects)` -> `{ totalConducted: number, totalAttended: number, percentage: number }`

### M3 Calendar Schema: `src/data/academicCalendar.json`
- Semester start & end dates
- Holidays list (`[{ date: "YYYY-MM-DD", name: "..." }]`)
- Weekly working days (`[1, 2, 3, 4, 5]`) and Saturday schedule
- Default weekly hours per subject (e.g. 4 for 4-credit courses)

## Code Layout
- `api/erp/attendance.js`: Production Vercel serverless function & ERP proxy
- `vite.config.js`: Vite dev server configuration with proxy middleware
- `src/lib/erpClient.js`: Frontend client wrapper for ERP API
- `src/lib/attendanceCalculations.js`: Pure mathematical calculation module
- `src/data/academicCalendar.json`: DSU academic calendar dataset
- `src/components/AttendanceCalculator.jsx`: Attendance calculator React component
- `src/App.css`: Styles for attendance calculator and widgets
- `scripts/verify-dsu-erp.js`: Standalone automated verification script
- `tests/e2e/`: E2E test suites created by E2E Testing Track
