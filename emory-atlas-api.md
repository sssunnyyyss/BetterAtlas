## Emory Course Atlas API

**Base URL:** `https://atlas.emory.edu/api/?page=fose`

All endpoints use **POST** with `Content-Type: application/json`. No authentication required for search/details.

---

### 1. Search Classes

**URL:** `https://atlas.emory.edu/api/?page=fose&route=search`

Optionally append `&subject=XX` to the URL (appears cosmetic; the real filter is in the POST body).

**Request Body:**
```json
{
  "other": { "srcdb": "<term_code>" },
  "criteria": [
    { "field": "<field_name>", "value": "<value>" }
  ]
}
```

**Response:**
```json
{
  "srcdb": "5261",
  "count": 213,
  "results": [
    {
      "key": "2594",
      "code": "CS 110",
      "title": "Computer Science Fundamentals",
      "crn": "3663",
      "no": "1",              // section number
      "total": "2",           // total sections for this course
      "schd": "LEC",          // component type
      "stat": "A",            // A=Active/Open, W=Waitlisted, C=Closed
      "isCancelled": "",
      "meets": "MW 1-2:15p",
      "mpkey": "2137",
      "meetingTimes": "[{\"meet_day\":\"0\",\"start_time\":\"1300\",\"end_time\":\"1415\"}, ...]",
      "instr": "S. Das",
      "start_date": "2026-01-13",
      "end_date": "2026-04-27",
      "enrl_stat": "O",       // O=Open, W=Waitlisted, C=Closed
      "srcdb": "5261"
    }
  ]
}
```

**`meetingTimes` days:** 0=Monday, 1=Tuesday, 2=Wednesday, 3=Thursday, 4=Friday

---

### 2. Course Details

**URL:** `https://atlas.emory.edu/api/?page=fose&route=details`

**Request Body:**
```json
{
  "group": "code:CS 170",
  "key": "crn:4052",
  "srcdb": "5261",
  "matched": "crn:4052"
}
```

**Response fields:**

| Field | Example | Description |
|---|---|---|
| `code` | `"CS 170"` | Subject + catalog number |
| `title` | `"Introduction To Computer Science I"` | Course title |
| `section` | `"1"` | Section number |
| `crn` | `"4052"` | Class/CRN number |
| `description` | `"An introduction to..."` | Course description |
| `seats` | HTML string | Enrollment/seats info (HTML) |
| `hours_html` | `"4"` | Credit hours |
| `credit_hours_options` | `"4"` | Available credit hour options |
| `grademode_code` | `"Student Option"` | Grading mode |
| `enrl_stat_html` | `"Open"` | Enrollment status |
| `inst_method_code` | `"In Person"` | Instruction method |
| `dates_html` | `"2026-01-13 through 2026-04-27"` | Session dates |
| `registration_restrictions` | `"(MATH 111 or ...) and ..."` | Prerequisites |
| `attributes` | `""` | GER/other attributes |
| `clssnotes` | `""` | Class notes |
| `instructordetail_html` | HTML string | Instructor name, email, role |
| `meeting_html` | HTML string | Meeting times + room/building |
| `syllabus_pdf_bn_html` | HTML string | Syllabus link (requires login) |
| `order_books_bn_html` | HTML string | Bookstore form |
| `allInGroup` | Array | All sections of this course |
| `gmods` | `"GRD,Graded,SUS,Satisfactory/Unsatisfactory"` | Grade mode options |
| `xlist` | `""` | Cross-listed courses |

---

### 3. Promoted Content

**URL:** `https://atlas.emory.edu/api/?page=fose&route=promoted`

**Request Body:**
```json
{
  "srcdb": "5266",
  "screen": "empty-space"
}
```

Returns `[]` typically. Used for homepage promotions.

---

### Search Criteria Fields

| `field` | Description | Example `value` |
|---|---|---|
| `keyword` | Free-text search (title, subject, instructor) | `"machine learning"` |
| `subject` | Subject code | `"CS"`, `"MATH"`, `"BIOL_OX"` |
| `camp` | Campus | `"ATL@ATLANTA"`, `"OXF@OXFORD"`, `"ATL@ONLINE"`, `"ONLIN@ONLINE"`, `"OXF@ONLINE"` |
| `rqmnt_designtn` | General education requirement | `"CW"`, `"FS"`, `"FW"`, `"HAE"`, `"HTH"` |
| `career` | Academic career | `"UCOL"`, `"GSAS"`, `"GBUS"`, `"LAW"`, `"MED"`, `"UOXF"`, `"PUBH"`, `"THEO"` |
| `session` | Academic session | `"MAY"`, `"5W1"`, `"FB"`, `"SPC"` |
| `instructor` | Instructor name (partial match) | `"Das"` |
| `instmode` | Instruction method | `"P"` (In Person), `"DL"` (Online), `"BL"` (Hybrid), `"FL"` (Hyflex), `"DR"` (Directed Research) |
| `schd` | Component/schedule type | `"LEC"`, `"LAB"`, `"DIS"`, `"SEM"`, `"RSC"`, `"IND"` |
| `stat` | Course status | `"A"` (Open), `"A,W"` (Open or Waitlisted) |
| `overlap` | Meeting time slot (by ID) | `"3441"` (F 8am-9:15am) |
| `hours` | Credit hours | `"3"`, `"4"` |
| `business_attr` | Business school attributes | `"business_attr_ACT"`, `"business_attr_FIN"` |
| `othr_attr` | Other attributes | `"othr_attr_UBUSNOPERM"`, `"othr_attr_LEXPL"` |

Multiple criteria can be combined in the `criteria` array.

---

### Term Codes (`srcdb`)

| Code | Term |
|---|---|
| `5266` | Summer 2026 |
| `5261` | Spring 2026 |
| `5259` | Fall 2025 |
| `5256` | Summer 2025 |
| `5251` | Spring 2025 |
| `5249` | Fall 2024 |
| `5246` | Summer 2024 |
| `5241` | Spring 2024 |
| `5239` | Fall 2023 |
| `5236` | Summer 2023 |
| `5231` | Spring 2023 |
| `5229` | Fall 2022 |
| `5226` | Summer 2022 |
| `5221` | Spring 2022 |
| `5219` | Fall 2021 |
| `5216` | Summer 2021 |
| `5211` | Spring 2021 |
| `5209` | Fall 2020 |
| `5201` | Spring 2020 |
| `5199` | Fall 2019 |
| `5191` | Spring 2019 |

**Pattern:** Spring = `52X1`, Summer = `52X6`, Fall = `52X9` (with X incrementing per academic year)

---

### Quick Example (curl)

```bash
# Search for all open CS lectures in Spring 2026
curl -X POST 'https://atlas.emory.edu/api/?page=fose&route=search' \
  -H 'Content-Type: application/json' \
  -d '{"other":{"srcdb":"5261"},"criteria":[{"field":"subject","value":"CS"},{"field":"schd","value":"LEC"},{"field":"stat","value":"A"}]}'

# Get details for a specific section
curl -X POST 'https://atlas.emory.edu/api/?page=fose&route=details' \
  -H 'Content-Type: application/json' \
  -d '{"group":"code:CS 170","key":"crn:4052","srcdb":"5261","matched":"crn:4052"}'
```

The API is powered by the **FOSE** (Faculty/Online Schedule of Events) platform. No API key, auth token, or rate limiting was observed for read-only search/detail operations. Cart and waitlist routes require authentication via Emory's SSO.
