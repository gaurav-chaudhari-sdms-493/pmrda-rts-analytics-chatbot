# Commissioner Chatbot — Query Scope & 200 Example Questions

**Purpose:** Defines the scope of questions the PMC Commissioner (and senior leadership) can ask the AI chatbot, with 200 concrete examples in English, Marathi, Hindi, and mixed language — the way a real Commissioner would actually type/speak them.

**Data source:** PMC CMS database (complaints, officers, wards, zones, departments, SLA, escalations, feedback).

---

## Scope Definition (What the chatbot MUST answer)

| # | Intent Category                  | What it covers                                                           |
| - | -------------------------------- | ------------------------------------------------------------------------ |
| A | Pending / Open complaints        | Counts & lists by department, ward, zone, category, age                  |
| B | Officer performance              | Best/worst officers, resolution counts, avg time, per ward/dept/category |
| C | SLA compliance & breaches        | % within SLA, breached complaints, near-breach warnings                  |
| D | Escalations                      | Escalated complaints, escalation levels, repeat escalations              |
| E | Category analysis                | Top categories, category trends, category × ward                        |
| F | Ward / Zone comparison           | Rankings, best/worst wards, zone rollups                                 |
| G | Trends & time analysis           | Daily/weekly/monthly trends, spikes, seasonal patterns                   |
| H | Resolution stats                 | Resolved counts, avg resolution time, closure rate                       |
| I | Citizen feedback                 | Ratings, satisfaction %, negative feedback                               |
| J | Hotspots / Location              | Geographic clusters, repeat-complaint locations                          |
| K | Department deep-dive             | One department's full picture                                            |
| L | Aging / Oldest                   | Complaints pending > X days, oldest open complaints                      |
| M | Source / Channel                 | Web vs call center vs walk-in vs Swachhata                               |
| N | Reopened / Rejected / Duplicates | Quality-of-resolution signals                                            |
| O | Workload & staffing              | Officer workload, unassigned complaints, capacity                        |
| P | Specific complaint lookup        | Status of one complaint by number                                        |

## Out of Scope (chatbot must politely refuse / redirect)

- Modifying data (assign, transfer, close, escalate a complaint) — read-only chatbot
- Personal citizen data (mobile numbers, addresses) beyond what's needed for a specific complaint lookup by the Commissioner
- HR/payroll/disciplinary actions against officers
- Questions unrelated to PMC complaint management (general knowledge, politics, weather)
- Predictions presented as facts (may show trends, must label projections as estimates)

---

## 200 Example Queries

### A. Pending / Open Complaints (1–20)

1. How many complaints are pending in Pune right now, department wise?
2. पुण्यात सध्या किती तक्रारी प्रलंबित आहेत? विभागानुसार दाखवा.
3. Show me total open complaints today.
4. आज एकूण किती तक्रारी open आहेत?
5. Ward wise pending complaints ka breakdown do.
6. Kothrud ward madhe kiti complaints pending aahet?
7. Which department has the highest number of pending complaints?
8. सर्वात जास्त प्रलंबित तक्रारी कोणत्या विभागाकडे आहेत?
9. Water Supply department madhe kiti pending complaints?
10. Zone 3 मध्ये किती तक्रारी प्रलंबित आहेत, ward wise दाखवा.
11. Drainage department ki kitni complaints abhi tak khuli hain?
12. Pending complaints in Aundh ward, category wise.
13. रस्ते विभागाच्या (Road department) किती तक्रारी अजून सुटलेल्या नाहीत?
14. How many complaints are in ASSIGNED status but no action taken yet?
15. Kiti complaints ajun acknowledge pan zalya nahit?
16. Solid Waste Management च्या pending तक्रारी ward wise दाखवा.
17. Give me pending complaint count for all 15 wards in one table.
18. Sabse kam pending complaints kis ward mein hain?
19. आजपर्यंत आलेल्या एकूण तक्रारींपैकी किती % प्रलंबित आहेत?
20. Show open complaints registered this week, zone wise.

### B. Officer Performance (21–40)

21. Which officer is performing best in Pune overall?
22. पुण्यात सर्वात चांगली कामगिरी करणारा अधिकारी कोण आहे?
23. Which officer is performing well in Kothrud ward?
24. Hadapsar ward madhe konta officer best perform karto aahe?
25. Top 10 officers by complaints resolved this month.
26. या महिन्यात सर्वात जास्त तक्रारी सोडवणारे 10 अधिकारी दाखवा.
27. Which officer resolves water supply complaints fastest?
28. पाणीपुरवठा तक्रारी सर्वात लवकर कोण सोडवतो?
29. Sabse slow officer kaun hai? Average resolution time ke hisab se.
30. Which officers have the most SLA breaches?
31. कोणत्या अधिकाऱ्यांकडे सर्वात जास्त SLA breach आहेत?
32. Show worst performing 5 officers this quarter.
33. Ward L1 officers che performance ranking dakhava.
34. Officer XYZ ne is mahine kitni complaints resolve ki?
35. Compare performance of officers in Zone 1 vs Zone 2.
36. Garbage category madhe konta officer sagLyat changla kaam karto?
37. Which department's officers have the best average resolution time?
38. कोणत्या अधिकाऱ्याकडे सध्या सर्वात जास्त workload आहे?
39. Officers who haven't resolved a single complaint in last 30 days.
40. गेल्या ३० दिवसात एकही तक्रार न सोडवलेले अधिकारी कोण?

### C. SLA Compliance & Breaches (41–55)

41. What is the overall SLA compliance rate this month?
42. या महिन्याचा एकूण SLA compliance rate किती आहे?
43. How many complaints have breached SLA right now?
44. सध्या किती तक्रारींची SLA मुदत उलटून गेली आहे?
45. SLA breach hone wali complaints department wise dikhao.
46. Which ward has the worst SLA compliance?
47. कोणत्या ward चा SLA compliance सर्वात वाईट आहे?
48. Complaints reaching 90% of SLA time — show me the critical list.
49. Kiti complaints SLA chya 75% warning level la pohochlya aahet?
50. SLA compliance trend for last 6 months.
51. गेल्या ६ महिन्यांचा SLA compliance trend दाखवा.
52. Water department ka SLA compliance kitna hai is quarter?
53. Which category has the most SLA breaches?
54. कोणत्या category मध्ये सर्वात जास्त SLA breach होतात?
55. Are we meeting the 90% SLA compliance target? Show gap.

### D. Escalations (56–67)

56. How many complaints got escalated this month?
57. या महिन्यात किती तक्रारी escalate झाल्या?
58. Which complaints have been escalated twice or more?
59. दोनदा किंवा जास्त वेळा escalate झालेल्या तक्रारी दाखवा.
60. Kitni complaints Commissioner level tak escalate hui hain?
61. Escalations department wise, last 30 days.
62. Escalation zalelya complaints madhun kiti ajun pending aahet?
63. Which ward generates the most escalations?
64. कोणत्या ward मधून सर्वात जास्त escalations होतात?
65. Show complaints escalated to Additional Commissioner level.
66. Auto-escalation vs manual escalation count this month.
67. Escalate होऊनही न सुटलेल्या तक्रारी किती आहेत?

### E. Category Analysis (68–82)

68. What are the top 5 complaint categories in Pune?
69. पुण्यातील टॉप ५ तक्रार categories कोणत्या?
70. Garbage complaints kiti aahet city madhe, ward wise?
71. रस्त्यांच्या खड्ड्यांच्या (pothole) किती तक्रारी आल्या या महिन्यात?
72. Which category is rising fastest compared to last month?
73. गेल्या महिन्याच्या तुलनेत कोणती category सर्वात वेगाने वाढते आहे?
74. Streetlight complaints in Zone 4, status wise breakdown.
75. Pani puravtha (water supply) complaints ka trend last 3 months.
76. Which sub-categories under Drainage have the most complaints?
77. अतिक्रमण (encroachment) तक्रारी कोणत्या ward मध्ये जास्त आहेत?
78. Category wise average resolution time — which is slowest?
79. Monsoon-related complaints (drainage, potholes, tree fall) kiti aalya June pasun?
80. Mosquito/fogging complaints किती आहेत आणि किती सुटल्या?
81. Compare garbage vs drainage complaint volumes this year.
82. कोणत्या category च्या तक्रारी सर्वात लवकर सुटतात?

### F. Ward / Zone Comparison (83–97)

83. Rank all 15 wards by pending complaints.
84. सर्व १५ wards ची pending तक्रारींनुसार ranking दाखवा.
85. Which ward is best performing overall this month?
86. या महिन्यात सर्वोत्तम कामगिरी करणारा ward कोणता?
87. Worst 3 wards by resolution rate.
88. Zone wise complaint summary — ek table madhe dakhava.
89. Zone 2 आणि Zone 5 ची तुलना करा — pending, resolved, SLA.
90. Kis zone mein sabse zyada complaints aati hain?
91. Ward league table — like the decision dashboard ranking.
92. Aundh vs Kothrud — कोणता ward चांगला perform करतो?
93. Which prabhag has the most complaints in Ward 8?
94. प्रत्येक zone मध्ये सर्वात problematic ward कोणता?
95. Resolution rate ward wise, best to worst.
96. Zonal officer wise performance comparison.
97. Which zone improved the most compared to last quarter?

### G. Trends & Time Analysis (98–112)

98. Show complaint trend for last 12 months.
99. गेल्या १२ महिन्यांचा तक्रारींचा trend दाखवा.
100. Daily average complaints this month vs last month.
101. या आठवड्यात किती नवीन तक्रारी आल्या, दिवसानुसार?
102. Is mahine complaints badh rahi hain ya kam ho rahi hain?
103. Which day of the week gets the most complaints?
104. Complaint volume during monsoon vs summer — compare.
105. पावसाळ्यात कोणत्या तक्रारी वाढतात? Data दाखवा.
106. Any unusual spike in complaints this week? Where?
107. या आठवड्यात कुठे अचानक तक्रारी वाढल्या आहेत का?
108. Monthly resolved vs received — are we keeping up?
109. Last 7 days madhe kiti complaints aalya ani kiti sutlya?
110. Year on year comparison — 2025 vs 2026 complaint volume.
111. Festival period (Ganeshotsav) madhle complaint patterns dakhava.
112. Backlog वाढतोय की कमी होतोय? गेल्या ३ महिन्यांचा trend.

### H. Resolution Stats (113–127)

113. How many complaints were resolved this month?
114. या महिन्यात किती तक्रारी सोडवल्या गेल्या?
115. What is the average resolution time city-wide?
116. शहराचा सरासरी resolution time किती दिवस आहे?
117. Average resolution time department wise.
118. Kitne complaints 48 hours ke andar resolve hue?
119. Resolution rate this quarter vs last quarter.
120. २-५ दिवसांच्या target मध्ये किती % तक्रारी सुटतात?
121. Which department improved resolution time the most?
122. Aaj kiti complaints resolve zalya?
123. Same-day resolution किती तक्रारींचं झालं या महिन्यात?
124. Closed vs Resolved count — kiti complaints citizen ne close kelya?
125. Total complaints resolved since system go-live.
126. Legacy (जुन्या) तक्रारींपैकी किती अजून प्रलंबित आहेत?
127. Which officer has the fastest average resolution time in Roads dept?

### I. Citizen Feedback & Satisfaction (128–137)

128. What is the average citizen satisfaction rating?
129. नागरिकांचं सरासरी satisfaction rating किती आहे?
130. How many citizens gave 1-star or 2-star feedback this month?
131. कोणत्या विभागाला सर्वात वाईट feedback मिळतो?
132. Ward wise satisfaction score dikhao.
133. Kiti resolved complaints la citizens ni feedback dila?
134. Show me recent negative feedback comments with complaint numbers.
135. Are we meeting the 4.0/5.0 satisfaction target?
136. Feedback rating trend — सुधारतोय की खालावतोय?
137. Officers with the best citizen ratings.

### J. Hotspots & Location (138–147)

138. Show complaint hotspots on the city map.
139. शहरात सर्वात जास्त तक्रारी कुठून येतात? Hotspot दाखवा.
140. Which locations have repeat complaints of the same type?
141. एकाच ठिकाणाहून पुन्हा पुन्हा येणाऱ्या तक्रारी कोणत्या?
142. Garbage hotspots in Zone 1.
143. Sinhagad Road area madhun kiti complaints aalya last month?
144. Top 10 locations by complaint count this month.
145. कोणत्या prabhag मध्ये drainage च्या तक्रारी concentrate झाल्या आहेत?
146. Pothole complaints ka geographic cluster dikhao.
147. Areas with complaints but zero resolutions — kuthe aahet?

### K. Department Deep-Dive (148–159)

148. Give me the full picture of Water Supply department — pending, resolved, SLA, officers.
149. आरोग्य विभागाचा (Health dept) पूर्ण report दाखवा.
150. Solid Waste department ke top issues kya hain?
151. Road department मध्ये किती अधिकारी active आहेत आणि त्यांचा workload?
152. Electrical department SLA performance last 3 months.
153. Drainage विभागाच्या तक्रारी कोणत्या ward मध्ये सर्वात जास्त?
154. Which department has the biggest backlog?
155. सर्वात मोठा backlog कोणत्या विभागाकडे आहे?
156. Building permission department chya complaints chi status summary.
157. Encroachment dept — pending vs resolved trend.
158. Which department gets the most escalations per 100 complaints?
159. Tree/garden department madhe kiti complaints monsoon madhe aalya?

### L. Aging / Oldest Complaints (160–169)

160. Show complaints pending for more than 30 days.
161. ३० दिवसांपेक्षा जास्त काळ प्रलंबित तक्रारी दाखवा.
162. What are the 10 oldest open complaints in the city?
163. शहरातील सर्वात जुन्या १० open तक्रारी कोणत्या?
164. 90 din se zyada purani complaints kis department mein hain?
165. Aging bucket wise breakdown — 0-7, 7-30, 30-90, 90+ days.
166. Ward 5 मधल्या ६० दिवसांपेक्षा जुन्या तक्रारी कोणत्या अधिकाऱ्याकडे आहेत?
167. Oldest pending complaint in Water Supply — full details.
168. Kiti complaints 6 mahine peksha jasta junya aahet?
169. Why are complaints aging in Drainage dept — which status are they stuck in?

### M. Source / Channel (170–177)

170. How many complaints came from the call center vs web this month?
171. या महिन्यात किती तक्रारी call center मधून आणि किती web वरून आल्या?
172. Walk-in (reception) complaints kiti aahet is week?
173. Swachhata app वरून किती तक्रारी sync झाल्या?
174. Channel wise resolution rate — konta channel best?
175. Mobile app se aane wali complaints ka percentage kitna hai?
176. External partner apps मधून आलेल्या तक्रारींची status summary.
177. Which channel has the highest duplicate rate?

### N. Reopened / Rejected / Duplicates (178–185)

178. How many complaints were reopened by citizens this month?
179. नागरिकांनी या महिन्यात किती तक्रारी reopen केल्या?
180. Which department has the highest reopen rate?
181. सर्वात जास्त reopen rate कोणत्या विभागाचा आहे? — म्हणजे काम नीट होत नाही.
182. Kitni complaints reject hui aur kis reason se?
183. Rejected complaints ward wise, with rejection reasons.
184. Duplicate म्हणून mark झालेल्या तक्रारी किती आहेत?
185. Officers whose resolutions get reopened the most.

### O. Workload & Staffing (186–193)

186. Which officers are overloaded right now?
187. सध्या कोणते अधिकारी overloaded आहेत? Workload score दाखवा.
188. How many complaints are unassigned right now?
189. किती तक्रारी अजून कोणालाही assign झालेल्या नाहीत? का?
190. Ward 12 madhe Water dept sathi officer nemla aahe ka?
191. Average complaints per officer, department wise.
192. Wards where no L1 officer is mapped for a department.
193. Kis ward mein staff shortage ki wajah se complaints atki hain?

### P. Specific Complaint Lookup (194–200)

194. What is the status of complaint CMS20260001234?
195. तक्रार क्रमांक CMS20260005678 ची सद्यस्थिती काय आहे?
196. CMS20260009999 kis officer ke paas hai aur kitne din se?
197. Show full history of complaint CMS20260001234.
198. या तक्रारीवर आतापर्यंत काय action झाली — CMS20260002222?
199. Complaint CMS20260003333 चा SLA अजून किती शिल्लक आहे?
200. Is complaint CMS20260004444 escalated? Kaun handle kar raha hai?

---

## Verified Data Mapping (smoke-tested with SQL on CMS database, 2026-08-27)

Every category A–P was verified answerable with a live SQL query. Key tables/columns:

| Category               | Backing tables / columns                                                                                                                                   | Verified             |
| ---------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------- | -------------------- |
| A. Pending             | `complaint` + `status_master.is_terminal=false`, `department_master`, `ward_master`                                                                | ✅                   |
| B. Officer performance | `complaint.resolved_by_id` → `user_master.full_name`, `complaint_assignment` (37K+ rows)                                                            | ✅                   |
| C. SLA                 | `complaint.sla_status`, `sla_deadline`, `sla_hours`, `sla_paused_*`                                                                                | ✅                   |
| D. Escalations         | `escalation_history`, `complaint.escalation_level`, `last_escalated_at`                                                                              | ✅                   |
| E. Categories          | `complaint.category_id`, `sub_category_id` (81 categories in data)                                                                                     | ✅                   |
| F. Ward/Zone           | `complaint.ward_id`, `zone_id`, `prabhag_id`                                                                                                         | ✅                   |
| G. Trends              | `complaint.created_at` (78 months of history)                                                                                                            | ✅                   |
| H. Resolution          | `complaint.resolved_at`, `closed_at` (avg 19.2 days in test data)                                                                                      | ✅ ⚠️ see caveat 1 |
| I. Feedback            | `complaint_feedback.rating` (15.5K rows, avg 2.51)                                                                                                       | ✅                   |
| J. Hotspots            | `complaint.latitude/longitude` (508K geocoded) + PostGIS                                                                                                 | ✅                   |
| K. Dept deep-dive      | joins of all above                                                                                                                                         | ✅ ⚠️ see caveat 2 |
| L. Aging               | `created_at` + non-terminal status                                                                                                                       | ✅                   |
| M. Channels            | `complaint.source_channel` enum: WEB, MOBILE, CALL_CENTER, WALK_IN, ABHYAGAT_KAKSH, EMAIL, WHATSAPP, EXTERNAL_API; Swachhata via `swachhata_complaint` | ✅                   |
| N. Reopen/Reject/Dup   | `complaint.reopen_count` (12K reopened), `is_duplicate`, `parent_complaint_id`, status CLOSED_INVALID                                                | ✅                   |
| O. Workload            | `complaint.assigned_to_id`, `ward_officer_id`, `officer_jurisdiction`, `department_ward_officer`                                                   | ✅                   |
| P. Lookup              | `complaint.complaint_number` (CMS{YEAR}{ID} format)                                                                                                      | ✅                   |

## SQL Query Templates (per intent category)

One parameterized template per category — each covers all questions in its block. The bot swaps the `WHERE` filters (`ward_id`, `department_id`, `category_id`, date range) per question. Table names are the **physical** names (`_master` suffix). "Pending" always means `status_master.is_terminal = false`.

> Common filter fragments used below:
>
> - `:date_from` / `:date_to` — resolved from phrases like "this month", "गेल्या महिन्यात", "last quarter"
> - `AND c.ward_id = :ward_id` / `AND c.department_id = :dept_id` / `AND c.zone_id = :zone_id` / `AND c.category_id = :category_id` — added only when the question names one
> - Marathi answers: select `*_mar` columns (`ward_name_mar`, `department_name_mar`, `full_name_mar`, `status_name_mar`)

### A. Pending / Open complaints (Q1–20)

```sql
-- Pending count with breakdown (swap GROUP BY column: department / ward / zone / category / status)
SELECT d.department_name, d.department_name_mar, COUNT(*) AS pending
FROM complaint c
JOIN status_master s      ON s.id = c.status_id AND s.is_terminal = false
JOIN department_master d  ON d.id = c.department_id
-- optional: AND c.ward_id = :ward_id  AND c.zone_id = :zone_id
-- optional: AND c.created_at >= :date_from AND c.created_at < :date_to
GROUP BY d.id, d.department_name, d.department_name_mar
ORDER BY pending DESC;

-- Pending % of total (Q19)
SELECT COUNT(*) FILTER (WHERE s.is_terminal = false) AS pending,
       COUNT(*) AS total,
       ROUND(100.0 * COUNT(*) FILTER (WHERE s.is_terminal = false) / COUNT(*), 1) AS pending_pct
FROM complaint c JOIN status_master s ON s.id = c.status_id;

-- Stuck in a specific status (Q14–15: ASSIGNED but untouched / not acknowledged)
SELECT COUNT(*) FROM complaint c
JOIN status_master s ON s.id = c.status_id
WHERE s.status_code = :status_code;   -- 'ASSIGNED' | 'REGISTERED' | 'PENDING' ...
```

### B. Officer performance (Q21–40)

```sql
-- Top/bottom officers by resolved count + avg resolution time (ORDER ASC = worst, DESC = best)
SELECT u.full_name, u.designation, d.department_name,
       COUNT(*) AS resolved_count,
       ROUND(AVG(EXTRACT(epoch FROM (c.resolved_at - c.created_at))/86400)::numeric, 1) AS avg_days
FROM complaint c
JOIN user_master u ON u.id = c.resolved_by_id
LEFT JOIN department_master d ON d.id = u.department_id
WHERE c.resolved_at IS NOT NULL
  AND c.resolved_at >= :date_from AND c.resolved_at < :date_to
-- optional: AND c.ward_id = :ward_id AND c.category_id = :category_id
GROUP BY u.id, u.full_name, u.designation, d.department_name
ORDER BY resolved_count DESC   -- or: avg_days ASC (fastest, Q27) / avg_days DESC (slowest, Q29)
LIMIT :n;

-- Officers with most SLA breaches (Q30–31)
SELECT u.full_name, COUNT(*) AS breaches
FROM complaint c
JOIN user_master u ON u.id = COALESCE(c.assigned_to_id, c.ward_officer_id)
WHERE c.sla_status = 'BREACHED'
GROUP BY u.id, u.full_name ORDER BY breaches DESC LIMIT :n;

-- Officers with zero resolutions in last 30 days (Q39–40)
SELECT u.full_name, u.designation
FROM user_master u
WHERE u.user_type LIKE '%L1%' AND u.is_active = true
  AND NOT EXISTS (SELECT 1 FROM complaint c
                  WHERE c.resolved_by_id = u.id
                    AND c.resolved_at >= now() - interval '30 days');
```

### C. SLA compliance & breaches (Q41–55)

```sql
-- Overall SLA compliance % (swap GROUP BY for dept/ward/category compliance)
SELECT COUNT(*) FILTER (WHERE c.resolved_at IS NOT NULL AND c.resolved_at <= c.sla_deadline) AS within_sla,
       COUNT(*) FILTER (WHERE c.resolved_at IS NOT NULL) AS total_resolved,
       ROUND(100.0 * COUNT(*) FILTER (WHERE c.resolved_at <= c.sla_deadline)
             / NULLIF(COUNT(*) FILTER (WHERE c.resolved_at IS NOT NULL), 0), 1) AS compliance_pct
FROM complaint c
WHERE c.sla_deadline IS NOT NULL
  AND c.created_at >= :date_from AND c.created_at < :date_to;

-- Currently breached (Q43–45)
SELECT COUNT(*) FROM complaint c
JOIN status_master s ON s.id = c.status_id AND s.is_terminal = false
WHERE c.sla_status = 'BREACHED' OR c.sla_deadline < now();

-- Near-breach warning list, 75% / 90% consumed (Q48–49)
SELECT c.complaint_number, c.title, c.sla_deadline,
       ROUND(100.0 * EXTRACT(epoch FROM (now() - c.created_at))
             / NULLIF(EXTRACT(epoch FROM (c.sla_deadline - c.created_at)), 0)) AS sla_consumed_pct
FROM complaint c
JOIN status_master s ON s.id = c.status_id AND s.is_terminal = false
WHERE c.sla_deadline IS NOT NULL AND c.sla_deadline > now()
  AND (now() - c.created_at) >= :threshold * (c.sla_deadline - c.created_at)  -- :threshold = 0.75 | 0.90
ORDER BY sla_consumed_pct DESC;

-- Compliance trend by month (Q50–51): wrap the first query with GROUP BY date_trunc('month', c.created_at)
```

### D. Escalations (Q56–67)

```sql
-- Escalation counts (swap GROUP BY: department / ward / month / to_level)
SELECT eh.to_level, COUNT(*) AS cnt
FROM escalation_history eh
JOIN complaint c ON c.id = eh.complaint_id
WHERE eh.created_at >= :date_from AND eh.created_at < :date_to
-- optional: AND eh.escalation_type = 'AUTO' / 'MANUAL' (Q66)
GROUP BY eh.to_level ORDER BY cnt DESC;

-- Escalated ≥ N times (Q58–59)
SELECT c.complaint_number, c.escalation_level, COUNT(eh.id) AS times_escalated
FROM complaint c JOIN escalation_history eh ON eh.complaint_id = c.id
GROUP BY c.id, c.complaint_number, c.escalation_level
HAVING COUNT(eh.id) >= :n ORDER BY times_escalated DESC;

-- Escalated but still pending (Q62, Q67)
SELECT COUNT(*) FROM complaint c
JOIN status_master s ON s.id = c.status_id AND s.is_terminal = false
WHERE c.escalation_level > 0;
```

### E. Category analysis (Q68–82)

```sql
-- Top categories (swap GROUP BY to sub_category_master via sub_category_id for Q76)
SELECT cat.category_name, cat.category_name_mar, COUNT(*) AS cnt
FROM complaint c JOIN category_master cat ON cat.id = c.category_id
WHERE c.created_at >= :date_from AND c.created_at < :date_to
-- optional: AND c.ward_id = :ward_id / AND c.zone_id = :zone_id
GROUP BY cat.id, cat.category_name, cat.category_name_mar ORDER BY cnt DESC LIMIT :n;

-- Fastest rising category, this month vs last (Q72–73)
SELECT cat.category_name,
       COUNT(*) FILTER (WHERE c.created_at >= date_trunc('month', now())) AS this_month,
       COUNT(*) FILTER (WHERE c.created_at >= date_trunc('month', now()) - interval '1 month'
                          AND c.created_at <  date_trunc('month', now())) AS last_month
FROM complaint c JOIN category_master cat ON cat.id = c.category_id
GROUP BY cat.id, cat.category_name
ORDER BY (this_month - last_month) DESC LIMIT :n;

-- Category avg resolution time, slowest first (Q78, Q82: ASC for fastest)
SELECT cat.category_name, ROUND(AVG(EXTRACT(epoch FROM (c.resolved_at - c.created_at))/86400)::numeric,1) AS avg_days
FROM complaint c JOIN category_master cat ON cat.id = c.category_id
WHERE c.resolved_at IS NOT NULL
GROUP BY cat.id, cat.category_name ORDER BY avg_days DESC;
```

### F. Ward / Zone comparison (Q83–97)

```sql
-- Ward league table: pending, resolved, resolution rate (Q83–92, Q95)
SELECT w.ward_name, w.ward_name_mar,
       COUNT(*) AS total,
       COUNT(*) FILTER (WHERE s.is_terminal = false) AS pending,
       COUNT(*) FILTER (WHERE s.status_code = 'RESOLVED') AS resolved,
       ROUND(100.0 * COUNT(*) FILTER (WHERE s.status_code = 'RESOLVED') / COUNT(*), 1) AS resolution_rate
FROM complaint c
JOIN status_master s ON s.id = c.status_id
JOIN ward_master w   ON w.id = c.ward_id AND w.ward_number IS NOT NULL   -- filters out 'Head Office' bucket
WHERE c.created_at >= :date_from AND c.created_at < :date_to
GROUP BY w.id, w.ward_name, w.ward_name_mar
ORDER BY resolution_rate DESC;    -- or pending ASC/DESC per question

-- Zone rollup (Q88–90, Q96): same query, JOIN zone z ON z.id = c.zone_id, GROUP BY zone
-- Prabhag drill-down (Q93): GROUP BY c.prabhag_id JOIN prabhag_master
-- Quarter-over-quarter improvement (Q97): two date-windowed CTEs of the above, diff resolution_rate
```

### G. Trends & time analysis (Q98–112)

```sql
-- Trend by period (swap date_trunc: 'day' | 'week' | 'month'; Q98–102, Q108–110)
SELECT date_trunc(:period, c.created_at)::date AS bucket,
       COUNT(*) AS received,
       COUNT(*) FILTER (WHERE c.resolved_at IS NOT NULL
                          AND date_trunc(:period, c.resolved_at) = date_trunc(:period, c.created_at)) AS resolved_same_period
FROM complaint c
WHERE c.created_at >= :date_from
GROUP BY 1 ORDER BY 1;

-- Received vs resolved per month — backlog direction (Q108, Q112)
SELECT date_trunc('month', d)::date AS month,
       (SELECT COUNT(*) FROM complaint WHERE date_trunc('month', created_at) = date_trunc('month', d)) AS received,
       (SELECT COUNT(*) FROM complaint WHERE date_trunc('month', resolved_at) = date_trunc('month', d)) AS resolved
FROM generate_series(:date_from, now(), interval '1 month') d;

-- Day-of-week pattern (Q103)
SELECT to_char(c.created_at, 'Day') AS dow, COUNT(*)
FROM complaint c GROUP BY 1, EXTRACT(dow FROM c.created_at) ORDER BY EXTRACT(dow FROM c.created_at);

-- Spike detection (Q106–107): compare this week's ward×category counts vs 4-week average, flag > 2x
```

### H. Resolution stats (Q113–127)

```sql
-- Resolved count + avg time (⚠️ caveat 1: add AND c.created_at >= :golive_date to exclude legacy)
SELECT COUNT(*) AS resolved,
       ROUND(AVG(EXTRACT(epoch FROM (c.resolved_at - c.created_at))/86400)::numeric,1) AS avg_days,
       COUNT(*) FILTER (WHERE c.resolved_at - c.created_at <= interval '48 hours') AS within_48h,
       COUNT(*) FILTER (WHERE c.resolved_at::date = c.created_at::date) AS same_day
FROM complaint c
WHERE c.resolved_at IS NOT NULL
  AND c.resolved_at >= :date_from AND c.resolved_at < :date_to;
-- optional GROUP BY department / officer for Q117, Q121, Q127

-- Resolved vs citizen-closed (Q124)
SELECT s.status_code, COUNT(*) FROM complaint c
JOIN status_master s ON s.id = c.status_id
WHERE s.is_terminal = true GROUP BY s.status_code;

-- Legacy pending remainder (Q126)
SELECT COUNT(*) FROM complaint c
JOIN status_master s ON s.id = c.status_id AND s.is_terminal = false
WHERE c.created_at < :golive_date;
```

### I. Citizen feedback (Q128–137)

```sql
-- Avg rating + distribution (swap GROUP BY: department / ward / officer for Q131–132, Q137)
SELECT ROUND(AVG(f.rating)::numeric, 2) AS avg_rating,
       COUNT(*) AS total_feedback,
       COUNT(*) FILTER (WHERE f.rating <= 2) AS negative
FROM complaint_feedback f
JOIN complaint c ON c.id = f.complaint_id
WHERE f.created_at >= :date_from AND f.created_at < :date_to;

-- Feedback coverage (Q133)
SELECT ROUND(100.0 * COUNT(f.id) / COUNT(c.id), 1) AS feedback_pct
FROM complaint c
JOIN status_master s ON s.id = c.status_id AND s.status_code = 'RESOLVED'
LEFT JOIN complaint_feedback f ON f.complaint_id = c.id;

-- Recent negative comments (Q134)
SELECT c.complaint_number, f.rating, f.comment, f.created_at
FROM complaint_feedback f JOIN complaint c ON c.id = f.complaint_id
WHERE f.rating <= 2 ORDER BY f.created_at DESC LIMIT :n;
```

### J. Hotspots & location (Q138–147)

```sql
-- Top locations by complaint density, ~100m grid (Q138–139, Q144)
SELECT ROUND(c.latitude::numeric, 3) AS lat, ROUND(c.longitude::numeric, 3) AS lng,
       COUNT(*) AS cnt, MIN(c.address) AS sample_address
FROM complaint c
WHERE c.latitude IS NOT NULL
  AND c.created_at >= :date_from
-- optional: AND c.category_id = :category_id (Q142, Q146) AND c.zone_id = :zone_id
GROUP BY 1, 2 HAVING COUNT(*) >= :min_cluster ORDER BY cnt DESC LIMIT :n;

-- Repeat same-type complaints at same spot (Q140–141)
SELECT ROUND(latitude::numeric,3) lat, ROUND(longitude::numeric,3) lng, category_id, COUNT(*)
FROM complaint WHERE latitude IS NOT NULL
GROUP BY 1,2,3 HAVING COUNT(*) > :n ORDER BY count DESC;

-- PostGIS variant (preferred where geometry available): ST_ClusterDBSCAN over ST_MakePoint(longitude, latitude)
```

### K. Department deep-dive (Q148–159)

```sql
-- Full department scorecard (Q148–150, Q154–157)
SELECT d.department_name,
       COUNT(*) AS total,
       COUNT(*) FILTER (WHERE s.is_terminal = false) AS pending,
       COUNT(*) FILTER (WHERE s.status_code = 'RESOLVED') AS resolved,
       COUNT(*) FILTER (WHERE c.sla_status = 'BREACHED') AS sla_breached,
       COUNT(*) FILTER (WHERE c.escalation_level > 0) AS escalated,
       ROUND(AVG(EXTRACT(epoch FROM (c.resolved_at - c.created_at))/86400)
             FILTER (WHERE c.resolved_at IS NOT NULL)::numeric, 1) AS avg_days
FROM complaint c
JOIN status_master s ON s.id = c.status_id
JOIN department_master d ON d.id = c.department_id
WHERE d.id = :dept_id        -- drop for all-departments comparison
GROUP BY d.id, d.department_name;

-- Active officers + workload in a department (Q151)
SELECT u.full_name, u.designation,
       COUNT(c.id) FILTER (WHERE s.is_terminal = false) AS open_assigned
FROM user_master u
LEFT JOIN complaint c ON COALESCE(c.assigned_to_id, c.ward_officer_id) = u.id
LEFT JOIN status_master s ON s.id = c.status_id
WHERE u.department_id = :dept_id AND u.is_active = true
GROUP BY u.id, u.full_name, u.designation ORDER BY open_assigned DESC;

-- Escalations per 100 complaints (Q158): scorecard query, ORDER BY 100.0*escalated/total DESC
```

### L. Aging / Oldest (Q160–169)

```sql
-- Aging buckets (Q165)
SELECT CASE
         WHEN now() - c.created_at < interval '7 days'  THEN '0-7d'
         WHEN now() - c.created_at < interval '30 days' THEN '7-30d'
         WHEN now() - c.created_at < interval '90 days' THEN '30-90d'
         ELSE '90d+' END AS bucket,
       COUNT(*)
FROM complaint c JOIN status_master s ON s.id = c.status_id AND s.is_terminal = false
GROUP BY 1 ORDER BY 1;

-- Oldest open list (Q160–164, Q166–168; add filters per question)
SELECT c.complaint_number, c.title, c.created_at,
       EXTRACT(day FROM now() - c.created_at) AS age_days,
       d.department_name, w.ward_name, u.full_name AS assigned_officer, s.status_name
FROM complaint c
JOIN status_master s ON s.id = c.status_id AND s.is_terminal = false
LEFT JOIN department_master d ON d.id = c.department_id
LEFT JOIN ward_master w ON w.id = c.ward_id
LEFT JOIN user_master u ON u.id = COALESCE(c.assigned_to_id, c.ward_officer_id)
WHERE c.created_at < now() - (:days || ' days')::interval
ORDER BY c.created_at ASC LIMIT :n;

-- Where aging complaints are stuck (Q169): GROUP BY s.status_name on the above
```

### M. Source / Channel (Q170–177)

```sql
-- Channel mix + per-channel resolution rate (Q170–175)
SELECT c.source_channel,
       COUNT(*) AS received,
       COUNT(*) FILTER (WHERE s.status_code = 'RESOLVED') AS resolved,
       ROUND(100.0 * COUNT(*) FILTER (WHERE s.status_code = 'RESOLVED') / COUNT(*), 1) AS resolution_rate,
       ROUND(100.0 * COUNT(*) / SUM(COUNT(*)) OVER (), 1) AS share_pct
FROM complaint c JOIN status_master s ON s.id = c.status_id
WHERE c.created_at >= :date_from AND c.created_at < :date_to
GROUP BY c.source_channel ORDER BY received DESC;
-- enum values: WEB, MOBILE, CALL_CENTER, WALK_IN, ABHYAGAT_KAKSH, EMAIL, WHATSAPP, EXTERNAL_API

-- Swachhata synced (Q173): SELECT COUNT(*) FROM swachhata_complaint;
-- Partner apps (Q176): WHERE c.external_app_id IS NOT NULL, GROUP BY external_app_id
-- Duplicate rate per channel (Q177): add COUNT(*) FILTER (WHERE c.is_duplicate) to channel mix
```

### N. Reopened / Rejected / Duplicates (Q178–185)

```sql
-- Reopen counts + rate (swap GROUP BY: department for Q180–181, officer for Q185)
SELECT d.department_name,
       COUNT(*) FILTER (WHERE c.reopen_count > 0) AS reopened,
       ROUND(100.0 * COUNT(*) FILTER (WHERE c.reopen_count > 0) / COUNT(*), 2) AS reopen_rate
FROM complaint c JOIN department_master d ON d.id = c.department_id
GROUP BY d.id, d.department_name ORDER BY reopen_rate DESC;

-- Rejected with reasons (Q182–183)
SELECT c.complaint_number, w.ward_name, c.resolution_remarks AS rejection_reason
FROM complaint c
JOIN status_master s ON s.id = c.status_id AND s.status_code = 'CLOSED_INVALID'
LEFT JOIN ward_master w ON w.id = c.ward_id
ORDER BY c.updated_at DESC;

-- Duplicates (Q184)
SELECT COUNT(*) FROM complaint WHERE is_duplicate = true OR parent_complaint_id IS NOT NULL;
```

### O. Workload & staffing (Q186–193)

```sql
-- Officer workload score: (Pending×1.5 + InProgress×1.0 + Overdue×3.0) (Q186–187, Q191)
SELECT u.full_name, d.department_name,
       COUNT(*) FILTER (WHERE s.status_code IN ('REGISTERED','ASSIGNED','PENDING')) * 1.5
     + COUNT(*) FILTER (WHERE s.status_code = 'PROCESSING') * 1.0
     + COUNT(*) FILTER (WHERE c.sla_deadline < now() AND s.is_terminal = false) * 3.0 AS workload_score,
       COUNT(*) FILTER (WHERE s.is_terminal = false) AS open_count
FROM complaint c
JOIN status_master s ON s.id = c.status_id
JOIN user_master u ON u.id = COALESCE(c.assigned_to_id, c.ward_officer_id)
LEFT JOIN department_master d ON d.id = u.department_id
GROUP BY u.id, u.full_name, d.department_name ORDER BY workload_score DESC LIMIT :n;

-- Unassigned open complaints (Q188–189, Q193)
SELECT COUNT(*) FROM complaint c
JOIN status_master s ON s.id = c.status_id AND s.is_terminal = false
WHERE c.assigned_to_id IS NULL AND c.ward_officer_id IS NULL;
-- breakdown: GROUP BY c.ward_id / c.department_id to show WHERE they're stuck

-- Ward×dept coverage gaps (Q190, Q192)
SELECT w.ward_name, d.department_name
FROM ward_master w CROSS JOIN department_master d
WHERE w.ward_number IS NOT NULL AND d.is_active = true
  AND NOT EXISTS (SELECT 1 FROM department_ward_officer dwo
                  WHERE dwo.ward_id = w.id AND dwo.department_id = d.id AND dwo.is_active = true);
```

### P. Specific complaint lookup (Q194–200)

```sql
-- Full status card (Q194–196, Q199–200)
SELECT c.complaint_number, c.title, s.status_name, s.status_name_mar,
       cat.category_name AS category, d.department_name, w.ward_name,
       u.full_name AS assigned_officer,
       c.created_at, c.sla_deadline,
       GREATEST(c.sla_deadline - now(), interval '0') AS sla_remaining,
       c.escalation_level, c.reopen_count
FROM complaint c
JOIN status_master s ON s.id = c.status_id
LEFT JOIN category_master cat ON cat.id = c.category_id
LEFT JOIN department_master d ON d.id = c.department_id
LEFT JOIN ward_master w ON w.id = c.ward_id
LEFT JOIN user_master u ON u.id = COALESCE(c.assigned_to_id, c.ward_officer_id)
WHERE c.complaint_number = :complaint_number;

-- Full action history (Q197–198)
SELECT h.created_at, h.action_type, h.remarks, u.full_name AS by_officer
FROM complaint_action_history h
JOIN complaint c ON c.id = h.complaint_id
LEFT JOIN user_master u ON u.id = h.performed_by_id
WHERE c.complaint_number = :complaint_number
ORDER BY h.created_at ASC;
```

### Caveats the chatbot MUST handle

1. **`resolved_at` is NOT backfilled for legacy-migrated complaints** — average resolution time queries are only reliable for new-CMS-era complaints. Bot must scope resolution-time answers to post-go-live data or state the limitation.
2. **Mart tables (`officer_performance`, `ward_performance`, `daily_summary`) may be empty/stale** — decision dashboards already moved to live queries; the bot must compute from live `complaint` queries, not marts.
3. **Pending = `status_master.is_terminal = false`** — do NOT hardcode status codes. Actual codes in DB: REGISTERED, ASSIGNED, PENDING_INFO, TRANSFERRED, ESCALATED, RESOLVED, CLOSED_INVALID, REOPENED, PENDING, PROCESSING (differs from lifecycle doc names).
4. **Physical table names use `_master` suffix**: `status_master`, `department_master`, `ward_master`, `user_master` (columns: `full_name`, `department_name`, `ward_name` + `_mar` Marathi variants — use these for Marathi answers).
5. **Prod TRUE pending ≈ 31.6K** (after 2026-08-13 status sync); older DB copies show inflated pending counts. Point the bot at prod (`pmc_cms_new1`), never at stale dev DBs.
6. **Ward data includes non-ward buckets** (e.g. "Head Office") — ward rankings should filter to the 15 real wards.

## Notes for AI Team

1. **Language handling:** Users will mix Marathi (Devanagari + Romanized "Marathi in English letters"), Hindi, and English freely in one sentence. The bot must detect intent regardless of script/language and may reply in the language the question was asked in.
2. **Entity resolution needed:** Ward names (Kothrud/कोथरूड/kothrud), department synonyms (garbage = कचरा = Solid Waste Management; pani = पाणी = Water Supply; khadde = potholes = Roads), officer names, date phrases ("गेल्या महिन्यात", "is hafte", "last quarter", "पावसाळ्यात").
3. **Default time window:** If no period stated, assume current/live for counts ("pending") and current month for performance/trends. Always state the window used in the answer.
4. **Answer format:** Number first, then breakdown table, then one-line insight (e.g., "Drainage backlog grew 12% this month"). Commissioner wants decisions, not raw dumps.
5. **Drill-down:** Every aggregate answer should support follow-ups: "show ward wise" → "show officer wise" → "show the complaint list".
6. **Data guardrails:** Counts must match the decision dashboard (`created_at`-scoped open KPIs). Legacy-migrated data: ~486K total, ~31.6K truly pending — bot must not double-count.
7. **Refusal examples (out of scope):** "Transfer this complaint to Roads dept" → refuse, read-only. "Officer X la suspend kara" → refuse, HR matter. "Who will win the election?" → refuse, unrelated.
