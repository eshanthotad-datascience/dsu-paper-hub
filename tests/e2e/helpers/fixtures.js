/**
 * DSU Paper Hub - E2E Test Fixtures & Authoritative Datasets
 * Zero-dependency: pure Node.js ESM exports
 */

export const MOCK_FIXTURES = {
  viewState: 'wEPDwULLTE4MzI5MTI0NzcPZBYCZgIDk3NzUzZGY=',
  viewStateGenerator: 'C2EE9ABB',
  eventValidation: 'wEWBQLVq4rGBwL+04S4DALp8uWlBgLCr9q1DgLAq9q1Dg==',
  validUSN: '26UGENG2182',
  validPassword: '6$0$75659N',
  studentName: 'ESHAN SUBASH THOTAD',
  sessionId: 'mock_session_aspnet_12345',
  ncblToken: 'mock_ncbl_security_67890'
};

export const TEST_CREDENTIALS = {
  valid: {
    username: '26UGENG2182',
    password: '6$0$75659N'
  },
  invalidPassword: {
    username: '26UGENG2182',
    password: 'WrongPassword999!'
  },
  nonExistentUser: {
    username: '99UGENG9999',
    password: '6$0$75659N'
  },
  specialCharPassword: {
    username: '26UGENG2182',
    password: '6$0$75659N' // Contains '$'
  },
  empty: {
    username: '',
    password: ''
  }
};

export const MOCK_HTML = {
  loginPage: `<!DOCTYPE html>
<html xmlns="http://www.w3.org/1999/xhtml">
<head><title>Login - Dayananda Sagar University</title></head>
<body>
  <form method="post" action="./Login.aspx/DSU" id="form1">
    <div class="aspNetHidden">
      <input type="hidden" name="__LASTFOCUS" id="__LASTFOCUS" value="" />
      <input type="hidden" name="__EVENTTARGET" id="__EVENTTARGET" value="" />
      <input type="hidden" name="__EVENTARGUMENT" id="__EVENTARGUMENT" value="" />
      <input type="hidden" name="__VIEWSTATE" id="__VIEWSTATE" value="${MOCK_FIXTURES.viewState}" />
      <input type="hidden" name="__VIEWSTATEGENERATOR" id="__VIEWSTATEGENERATOR" value="${MOCK_FIXTURES.viewStateGenerator}" />
      <input type="hidden" name="__EVENTVALIDATION" id="__EVENTVALIDATION" value="${MOCK_FIXTURES.eventValidation}" />
    </div>
    <div class="login-box">
      <input type="radio" name="rblRole" id="rblRole_0" value="Staff" />
      <input type="radio" name="rblRole" id="rblRole_1" value="Student" checked="checked" />
      <input type="text" name="txtUsername" id="txtUsername" class="form-control" placeholder="Username" />
      <input type="password" name="txtPassword" id="txtPassword" class="form-control" placeholder="Password" />
      <input type="submit" name="btnLogin" value="Login" id="btnLogin" class="btn btn-primary" />
    </div>
  </form>
</body>
</html>`,

  loginError: `<!DOCTYPE html>
<html>
<head><title>Login - Dayananda Sagar University</title></head>
<body>
  <div class="alert alert-danger margin-top-10">
    <span id="ucMessage_lblError">Invalid Username or Password</span>
  </div>
</body>
</html>`,

  // Captured live attendance table for 26UGENG2182 (ESHAN SUBASH THOTAD)
  attendanceValid: `<!DOCTYPE html>
<html>
<head><title>Student Attendance - Dayananda Sagar University</title></head>
<body>
  <div class="page-header">
    <span id="ctl00_lblCurrentUsername">ESHAN SUBASH THOTAD</span>
    <span id="ctl00_lblStudentAdmissionNo">26UGENG2182</span>
  </div>
  <div class="row">
    <span id="ctl00_cphPageContent_lblTotalLectureLabCount">78</span>
    <span id="ctl00_cphPageContent_lblPresentLectureLabCount">63</span>
    <span id="ctl00_cphPageContent_lblAbsentLectureLabCount">15</span>
    <span id="ctl00_cphPageContent_lblPresentPCTCount">80.77</span>
  </div>
  <table class="table table-bordered table-advanced table-striped table-hover" id="tblAttendance">
    <thead>
      <tr>
        <th class="text-center">Sr.</th>
        <th class="text-center">Slot Type</th>
        <th class="text-center">Course</th>
        <th class="text-center">Conducted</th>
        <th class="text-center">Present</th>
        <th class="text-center">Absent</th>
        <th class="text-center">Attendance %</th>
      </tr>
    </thead>
    <tbody>
      <tr>
        <td class="text-center">1</td>
        <td class="text-center">Theory</td>
        <td>26EN1101 - LINEAR ALGEBRA AND DATA FOUNDATIONS</td>
        <td class="text-center">5</td>
        <td class="text-center">4</td>
        <td class="text-center">1</td>
        <td class="text-center">80.00 %</td>
      </tr>
      <tr>
        <td class="text-center">2</td>
        <td class="text-center">Practical</td>
        <td>26EN1102 - ENGINEERING CHEMISTRY FOR CS CLUSTER</td>
        <td class="text-center">8</td>
        <td class="text-center">7</td>
        <td class="text-center">1</td>
        <td class="text-center">87.50 %</td>
      </tr>
      <tr>
        <td class="text-center">3</td>
        <td class="text-center">Theory</td>
        <td>26EN1102 - ENGINEERING CHEMISTRY FOR CS CLUSTER</td>
        <td class="text-center">16</td>
        <td class="text-center">10</td>
        <td class="text-center">6</td>
        <td class="text-center">62.50 %</td>
      </tr>
      <tr>
        <td class="text-center">4</td>
        <td class="text-center">Practical</td>
        <td>26EN1105 - ENGINEERING GRAPHICS & GENERATIVE DESIGN FOR CS CLUSTER</td>
        <td class="text-center">9</td>
        <td class="text-center">8</td>
        <td class="text-center">1</td>
        <td class="text-center">88.89 %</td>
      </tr>
      <tr>
        <td class="text-center">5</td>
        <td class="text-center">Theory</td>
        <td>26EN1105 - ENGINEERING GRAPHICS & GENERATIVE DESIGN FOR CS CLUSTER</td>
        <td class="text-center">20</td>
        <td class="text-center">20</td>
        <td class="text-center">0</td>
        <td class="text-center">100.00 %</td>
      </tr>
      <tr>
        <td class="text-center">6</td>
        <td class="text-center">Practical</td>
        <td>26EN1107 - ENGINEERING SCIENCE COURSE II FOR CS - INTRODUCTION TO C</td>
        <td class="text-center">1</td>
        <td class="text-center">1</td>
        <td class="text-center">0</td>
        <td class="text-center">100.00 %</td>
      </tr>
      <tr>
        <td class="text-center">7</td>
        <td class="text-center">Theory</td>
        <td>26EN1111 - ENVIRONMENTAL SCIENCE</td>
        <td class="text-center">17</td>
        <td class="text-center">11</td>
        <td class="text-center">6</td>
        <td class="text-center">64.71 %</td>
      </tr>
      <tr>
        <td class="text-center">8</td>
        <td class="text-center">Theory</td>
        <td>26EN1112 - INDIAN CONSTITUTION & LAW</td>
        <td class="text-center">2</td>
        <td class="text-center">2</td>
        <td class="text-center">0</td>
        <td class="text-center">100.00 %</td>
      </tr>
    </tbody>
    <tfoot>
      <tr>
        <td colspan="3" class="text-bold">Total</td>
        <td class="text-center">78</td>
        <td class="text-center">63</td>
        <td class="text-center">15</td>
        <td class="text-center">80.77 %</td>
      </tr>
    </tfoot>
  </table>
</body>
</html>`,

  // Zero classes conducted (semester onset)
  attendanceZeroClasses: `<!DOCTYPE html>
<html>
<body>
  <span id="ctl00_lblCurrentUsername">NEW STUDENT</span>
  <table id="tblAttendance">
    <tbody>
      <tr>
        <td>1</td>
        <td>Theory</td>
        <td>26EN1101 - LINEAR ALGEBRA AND DATA FOUNDATIONS</td>
        <td>0</td>
        <td>0</td>
        <td>0</td>
        <td>0.00 %</td>
      </tr>
    </tbody>
    <tfoot>
      <tr><td colspan="3">Total</td><td>0</td><td>0</td><td>0</td><td>0.00 %</td></tr>
    </tfoot>
  </table>
</body>
</html>`,

  // At-risk student (65% attendance)
  attendanceAtRisk: `<!DOCTYPE html>
<html>
<body>
  <span id="ctl00_lblCurrentUsername">AT RISK STUDENT</span>
  <table id="tblAttendance">
    <tbody>
      <tr>
        <td>1</td>
        <td>Theory</td>
        <td>26EN1101 - LINEAR ALGEBRA AND DATA FOUNDATIONS</td>
        <td>40</td>
        <td>26</td>
        <td>14</td>
        <td>65.00 %</td>
      </tr>
    </tbody>
    <tfoot>
      <tr><td colspan="3">Total</td><td>40</td><td>26</td><td>14</td><td>65.00 %</td></tr>
    </tfoot>
  </table>
</body>
</html>`,

  // High performer student (92% attendance)
  attendanceHighPerformer: `<!DOCTYPE html>
<html>
<body>
  <span id="ctl00_lblCurrentUsername">HIGH PERFORMER</span>
  <table id="tblAttendance">
    <tbody>
      <tr>
        <td>1</td>
        <td>Theory</td>
        <td>26EN1101 - LINEAR ALGEBRA AND DATA FOUNDATIONS</td>
        <td>50</td>
        <td>46</td>
        <td>4</td>
        <td>92.00 %</td>
      </tr>
    </tbody>
    <tfoot>
      <tr><td colspan="3">Total</td><td>50</td><td>46</td><td>4</td><td>92.00 %</td></tr>
    </tfoot>
  </table>
</body>
</html>`,

  // Malformed HTML table (missing tbody, corrupt rows)
  attendanceMalformed: `<!DOCTYPE html>
<html>
<body>
  <span id="ctl00_lblCurrentUsername">CORRUPT DOM</span>
  <table id="tblAttendance">
    <tr><td>No valid columns here</td></tr>
  </table>
</body>
</html>`
};

export const MOCK_JSON = {
  validProxyResponse: {
    success: true,
    studentName: 'ESHAN SUBASH THOTAD',
    usn: '26UGENG2182',
    overall: {
      conducted: 78,
      attended: 63,
      absent: 15,
      percentage: 80.77
    },
    subjects: [
      {
        id: '26EN1101_theory',
        slotType: 'Theory',
        code: '26EN1101',
        name: 'LINEAR ALGEBRA AND DATA FOUNDATIONS (Theory)',
        baseName: 'LINEAR ALGEBRA AND DATA FOUNDATIONS',
        conducted: 5,
        attended: 4,
        absent: 1,
        percentage: 80.0
      },
      {
        id: '26EN1102_practical',
        slotType: 'Practical',
        code: '26EN1102',
        name: 'ENGINEERING CHEMISTRY FOR CS CLUSTER (Practical)',
        baseName: 'ENGINEERING CHEMISTRY FOR CS CLUSTER',
        conducted: 8,
        attended: 7,
        absent: 1,
        percentage: 87.5
      },
      {
        id: '26EN1102_theory',
        slotType: 'Theory',
        code: '26EN1102',
        name: 'ENGINEERING CHEMISTRY FOR CS CLUSTER (Theory)',
        baseName: 'ENGINEERING CHEMISTRY FOR CS CLUSTER',
        conducted: 16,
        attended: 10,
        absent: 6,
        percentage: 62.5
      },
      {
        id: '26EN1105_practical',
        slotType: 'Practical',
        code: '26EN1105',
        name: 'ENGINEERING GRAPHICS & GENERATIVE DESIGN FOR CS CLUSTER (Practical)',
        baseName: 'ENGINEERING GRAPHICS & GENERATIVE DESIGN FOR CS CLUSTER',
        conducted: 9,
        attended: 8,
        absent: 1,
        percentage: 88.89
      },
      {
        id: '26EN1105_theory',
        slotType: 'Theory',
        code: '26EN1105',
        name: 'ENGINEERING GRAPHICS & GENERATIVE DESIGN FOR CS CLUSTER (Theory)',
        baseName: 'ENGINEERING GRAPHICS & GENERATIVE DESIGN FOR CS CLUSTER',
        conducted: 20,
        attended: 20,
        absent: 0,
        percentage: 100.0
      },
      {
        id: '26EN1107_practical',
        slotType: 'Practical',
        code: '26EN1107',
        name: 'ENGINEERING SCIENCE COURSE II FOR CS - INTRODUCTION TO C (Practical)',
        baseName: 'ENGINEERING SCIENCE COURSE II FOR CS - INTRODUCTION TO C',
        conducted: 1,
        attended: 1,
        absent: 0,
        percentage: 100.0
      },
      {
        id: '26EN1111_theory',
        slotType: 'Theory',
        code: '26EN1111',
        name: 'ENVIRONMENTAL SCIENCE (Theory)',
        baseName: 'ENVIRONMENTAL SCIENCE',
        conducted: 17,
        attended: 11,
        absent: 6,
        percentage: 64.71
      },
      {
        id: '26EN1112_theory',
        slotType: 'Theory',
        code: '26EN1112',
        name: 'INDIAN CONSTITUTION & LAW (Theory)',
        baseName: 'INDIAN CONSTITUTION & LAW',
        conducted: 2,
        attended: 2,
        absent: 0,
        percentage: 100.0
      }
    ]
  },

  invalidCredentialsResponse: {
    success: false,
    error: 'Invalid Username or Password'
  }
};

export const MOCK_CALENDAR = {
  academicYear: '2026-2027',
  semester: 'Odd Semester 2026-2027',
  semesterType: 'ODD',
  semesterNumber: 1,
  semesterStartDate: '2026-08-01',
  semesterEndDate: '2026-12-15',
  startDate: '2026-08-01',
  endDate: '2026-12-15',
  lastWorkingDay: '2026-12-07',
  saturdayRule: 'OFF_2ND_4TH',
  workingDaysOfWeek: [1, 2, 3, 4, 5], // Mon-Fri
  alternateSaturdays: [1, 3], // 1st & 3rd Saturday working
  holidays: [
    { date: '2026-08-15', name: 'Independence Day', type: 'GAZETTED' },
    { date: '2026-09-07', name: 'Ganesh Chaturthi', type: 'GAZETTED' },
    { date: '2026-10-02', name: 'Gandhi Jayanti', type: 'GAZETTED' },
    { date: '2026-10-20', name: 'Maha Navami', type: 'GAZETTED' },
    { date: '2026-10-21', name: 'Vijayadashami', type: 'GAZETTED' },
    { date: '2026-11-01', name: 'Kannada Rajyotsava', type: 'GAZETTED' },
    { date: '2026-11-09', name: 'Deepavali', type: 'GAZETTED' },
    { date: '2026-11-20', name: 'Kanakadasa Jayanthi', type: 'GAZETTED' },
    { date: '2026-11-26', name: 'Constitution Day Observance', type: 'RESTRICTED' },
    { date: '2026-12-25', name: 'Christmas', type: 'GAZETTED' }
  ]
};

// Aliases for convenience across blueprints
export const rawHandshakeHtml = MOCK_HTML.loginPage;
export const rawAttendanceHtml = MOCK_HTML.attendanceValid;
export const rawLoginErrorHtml = MOCK_HTML.loginError;

export default {
  MOCK_FIXTURES,
  TEST_CREDENTIALS,
  MOCK_HTML,
  MOCK_JSON,
  MOCK_CALENDAR,
  rawHandshakeHtml,
  rawAttendanceHtml,
  rawLoginErrorHtml
};
