// Job Tracker: the pure logic (no DOM, no Supabase), shared by the page and the tests.
// Loaded with a plain <script> before app.js, so everything here is a global there;
// in Node (tests/logic.test.js) the same file is loaded with require().

const STATUS_LABELS = { aplicat:"Applied", interviu:"Interview", oferta:"Offer", respins:"Rejected", retras:"Withdrawn" };
const STATUS_ORDER = ["aplicat","interviu","oferta","respins","retras"];

// The resume sections: the form in app.js and the export below both use this list.
const CV_FIELDS = [
  { key:"descriere",   label:"Description / About me",   rows:3,  placeholder:"A short summary about you (optional)." },
  { key:"experienta",  label:"Experience",                rows:6,  placeholder:"Jobs, role, period, achievements..." },
  { key:"educatie",    label:"Education",                 rows:4,  placeholder:"School/university, major, period..." },
  { key:"competente",  label:"Skills",                    rows:3,  placeholder:"Technical skills, tools, languages..." },
  { key:"proiecte",    label:"Projects",                  rows:4,  placeholder:"Relevant personal/course projects..." },
  { key:"voluntariat", label:"Volunteering",              rows:3,  placeholder:"Volunteer activities (optional)." },
];

/* Everything a user types (company names, notes, resume text) goes through this before it
   is put into HTML, so it shows up as text and never runs as markup. */
function escapeHtml(s){
  return String(s ?? "").replace(/[&<>"']/g, m=>({ "&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;" }[m]));
}

/* Supabase's auth errors, in plain words. On registration, "already registered" is NOT
   confirmed: saying so would tell anyone which emails have an account. */
function friendlyAuthError(msg, mode){
  if(mode === "register" && /already registered/i.test(msg)){
    return "Registration failed. Check the email you entered, or try logging in instead.";
  }
  if(/invalid login credentials/i.test(msg)) return "Incorrect email or password.";
  if(/password/i.test(msg) && /6/i.test(msg)) return "Password must be at least 6 characters.";
  return msg || "Something went wrong.";
}

/* The Dashboard numbers. Response rate = applications that got an answer (interview,
   offer or rejection) out of all applications, rounded; 0 when there are none. */
function dashboardStats(aplicari, companii){
  const statusCounts = {};
  STATUS_ORDER.forEach(s=>{ statusCounts[s] = aplicari.filter(a=>a.status===s).length; });
  const answered = statusCounts.interviu + statusCounts.oferta + statusCounts.respins;
  const counts = {};
  aplicari.forEach(a=>{ const n = a.companii?.nume || "—"; counts[n] = (counts[n]||0)+1; });
  return {
    total: aplicari.length,
    companies: companii.length,
    responseRate: aplicari.length ? Math.round((answered/aplicari.length)*100) : 0,
    offers: statusCounts.oferta,
    statusCounts,
    maxStatusCount: Math.max(1, ...STATUS_ORDER.map(s=>statusCounts[s])),   // the full-width bar
    topCompanies: Object.entries(counts).sort((a,b)=>b[1]-a[1]).slice(0,5),  // [name, count], at most 5
  };
}

/* The exported resume: a standalone HTML file with its own clean styles (the app's CSP
   doesn't apply to a downloaded file). Empty sections are left out. */
function buildCvExportHtml(cv, dateText){
  const sections = CV_FIELDS
    .filter(f=>cv[f.key] && cv[f.key].trim())
    .map(f=>`<section><h2>${escapeHtml(f.label)}</h2><pre>${escapeHtml(cv[f.key])}</pre></section>`)
    .join("\n");
  return `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>${escapeHtml(cv.nume_versiune)} — CV</title>
<link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=Newsreader:wght@600&family=Source+Sans+3:wght@400;600&display=swap">
<style>
  body{font-family:"Source Sans 3",Georgia,serif;max-width:720px;margin:40px auto;padding:0 24px 60px;color:#2c2620;line-height:1.65;}
  h1{font-family:"Newsreader",Georgia,serif;font-size:1.7rem;font-weight:600;border-bottom:2px solid #2b6777;padding-bottom:.35em;margin-bottom:.2em;}
  h2{font-family:"Newsreader",Georgia,serif;font-size:1.1rem;font-weight:600;color:#2b6777;margin:1.6em 0 .3em;}
  .meta{color:#6f6656;font-size:.82rem;margin-bottom:1.8rem;}
  pre{white-space:pre-wrap;word-wrap:break-word;font-family:inherit;font-size:1rem;margin:0;}
  @media print{ body{margin:0;padding:20px;} }
</style>
</head>
<body>
<h1>${escapeHtml(cv.nume_versiune)}</h1>
<div class="meta">Exported from Job Tracker — ${dateText}</div>
${sections || '<p style="color:#6f6656;">No content added yet.</p>'}
</body>
</html>`;
}

/* The download's file name: only letters, digits, "-", "_" and spaces survive (so no "/" or
   ".." can reach the file system); a name that ends up empty becomes "cv". */
function cvExportFileName(name){
  return ((name || "").replace(/[^a-z0-9-_ ]/gi, "_").trim() || "cv") + ".html";
}

// In Node (the tests) `module` exists and the functions are exported; in the browser it doesn't,
// so this is skipped and everything above stays a plain global for app.js.
if (typeof module !== "undefined" && module.exports) {
  module.exports = { STATUS_LABELS, STATUS_ORDER, CV_FIELDS, escapeHtml, friendlyAuthError,
                     dashboardStats, buildCvExportHtml, cvExportFileName };
}
