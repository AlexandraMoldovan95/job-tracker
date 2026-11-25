// Tests for logic.js: escaping user text, the auth error messages, the Dashboard numbers
// and the exported resume. No browser, no Supabase.
// Run:  node --test tests/
const test = require("node:test");
const assert = require("node:assert/strict");
const L = require("../logic.js");

const app = (status, company) => ({ status, companii: company ? { nume: company } : null });

// ---------- user text never runs as markup ----------

test("escapeHtml turns markup characters into plain text", () => {
  assert.equal(L.escapeHtml(`<img src=x onerror="alert('x')">`),
    "&lt;img src=x onerror=&quot;alert(&#39;x&#39;)&quot;&gt;");
  assert.equal(L.escapeHtml("Tom & Jerry"), "Tom &amp; Jerry");
});

test("escapeHtml copes with empty and non-text values", () => {
  assert.equal(L.escapeHtml(null), "");
  assert.equal(L.escapeHtml(undefined), "");
  assert.equal(L.escapeHtml(4200), "4200");
});

// ---------- auth messages ----------

test("registering with an email that already has an account doesn't confirm it", () => {
  const msg = L.friendlyAuthError("User already registered", "register");
  assert.doesNotMatch(msg, /already/i);
  assert.match(msg, /try logging in instead/);
});

test("wrong login and a short password get plain messages", () => {
  assert.equal(L.friendlyAuthError("Invalid login credentials", "login"), "Incorrect email or password.");
  assert.equal(L.friendlyAuthError("Password should be at least 6 characters.", "register"),
    "Password must be at least 6 characters.");
});

test("an unknown error is passed through, and an empty one gets a fallback", () => {
  assert.equal(L.friendlyAuthError("Email rate limit exceeded", "register"), "Email rate limit exceeded");
  assert.equal(L.friendlyAuthError("", "login"), "Something went wrong.");
});

// ---------- Dashboard ----------

test("no applications yet: 0% response rate, not an error", () => {
  const s = L.dashboardStats([], []);
  assert.equal(s.total, 0);
  assert.equal(s.responseRate, 0);
  assert.equal(s.offers, 0);
  assert.equal(s.maxStatusCount, 1);       // bars stay at 0 width instead of dividing by 0
  assert.deepEqual(s.topCompanies, []);
});

test("response rate counts interview, offer and rejection, and is rounded", () => {
  // 1 interview + 1 rejection out of 3 = 66.7% -> 67
  const s = L.dashboardStats([app("interviu"), app("respins"), app("aplicat")], [{}, {}]);
  assert.equal(s.responseRate, 67);
  assert.equal(s.companies, 2);
});

test("withdrawn and still-applied don't count as answers", () => {
  const s = L.dashboardStats([app("aplicat"), app("retras")], []);
  assert.equal(s.responseRate, 0);
});

test("counts per status, in the dashboard's order, and the offers tile", () => {
  const s = L.dashboardStats([app("oferta"), app("oferta"), app("interviu")], []);
  assert.deepEqual(s.statusCounts, { aplicat: 0, interviu: 1, oferta: 2, respins: 0, retras: 0 });
  assert.equal(s.offers, 2);
  assert.equal(s.maxStatusCount, 2);
});

test("top companies: most applications first, at most 5, a missing company shown as a dash", () => {
  const list = [
    ...["A", "A", "A"].map((c) => app("aplicat", c)),
    ...["B", "B"].map((c) => app("aplicat", c)),
    ...["C", "D", "E", "F"].map((c) => app("aplicat", c)),
    app("aplicat", null), app("aplicat", null),
  ];
  const top = L.dashboardStats(list, []).topCompanies;
  assert.equal(top.length, 5);
  assert.deepEqual(top.slice(0, 3), [["A", 3], ["B", 2], ["—", 2]]);
});

// ---------- the exported resume ----------

const CV = { nume_versiune: "QA Tester", experienta: "HP - Technical Support Engineer", competente: "Test cases\nBug reports" };

test("the export has the version name, the date and only the filled-in sections", () => {
  const html = L.buildCvExportHtml(CV, "11/25/2026");
  assert.match(html, /<title>QA Tester — CV<\/title>/);
  assert.match(html, /Exported from Job Tracker — 11\/25\/2026/);
  assert.match(html, /<h2>Experience<\/h2><pre>HP - Technical Support Engineer<\/pre>/);
  assert.match(html, /<h2>Skills<\/h2><pre>Test cases\nBug reports<\/pre>/);
  assert.doesNotMatch(html, /Education|Volunteering|No content added yet/);
});

test("a resume with only blank sections says so instead of exporting an empty page", () => {
  const html = L.buildCvExportHtml({ nume_versiune: "Empty", descriere: "   \n" }, "x");
  assert.match(html, /No content added yet\./);
  assert.doesNotMatch(html, /<section>/);
});

test("markup typed into the resume stays text in the exported file", () => {
  const html = L.buildCvExportHtml({ nume_versiune: "<b>CV</b>", proiecte: "</pre><script>alert(1)</script>" }, "x");
  assert.doesNotMatch(html, /<script>/);
  assert.match(html, /&lt;\/pre&gt;&lt;script&gt;alert\(1\)&lt;\/script&gt;/);
  assert.match(html, /<h1>&lt;b&gt;CV&lt;\/b&gt;<\/h1>/);
});

test("the file name keeps letters, digits, dashes and spaces; slashes and dots can't get through", () => {
  assert.equal(L.cvExportFileName("QA Tester-2026_v2"), "QA Tester-2026_v2.html");
  assert.equal(L.cvExportFileName("../../etc/passwd"), "______etc_passwd.html");
  assert.equal(L.cvExportFileName("Română"), "Rom_n_.html");
});

test("a name that is empty or only spaces becomes cv.html", () => {
  assert.equal(L.cvExportFileName(""), "cv.html");
  assert.equal(L.cvExportFileName(undefined), "cv.html");
  assert.equal(L.cvExportFileName("   "), "cv.html");   // used to give ".html"
});
