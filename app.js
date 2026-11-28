/* ======================================================================
   CONFIG — replace with your own URL and publishable key from Supabase
   (Settings -> API)
   ====================================================================== */
const SUPABASE_URL = "https://jenfjfhbhelpllkprygu.supabase.co";
const SUPABASE_ANON_KEY = "sb_publishable_VSrYIeBa3AaSmy3QsApwsw_spnYp2PW";

const sb = supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

/* ======================================================================
   STRIPE — for demonstration only (Stripe Payment Link, test mode).
   There is no backend/webhook here: the button only opens the checkout page
   hosted by Stripe. No access is granted automatically in the app based on
   payment — that would need a serverless function (Supabase Edge Function /
   Netlify Function) listening for the successful-payment webhook.
   Replace the link below with your own from the Stripe Dashboard →
   Payment Links → Create (Test mode, so no real card is requested).
   ====================================================================== */
const STRIPE_PAYMENT_LINK = "https://buy.stripe.com/test_28E00lgI24fCbulb8U5AQ00";

document.getElementById("supportBtn").addEventListener("click", ()=>{
  if(STRIPE_PAYMENT_LINK.includes("REPLACE_ME")){
    toast("Add your Stripe Payment Link in the code (STRIPE_PAYMENT_LINK) — see the comment in app.js.", true);
    return;
  }
  window.open(STRIPE_PAYMENT_LINK, "_blank", "noopener");
});

if("serviceWorker" in navigator){
  window.addEventListener("load", ()=>{
    navigator.serviceWorker.register("sw.js").catch(()=>{});
  });
}

// STATUS_LABELS, STATUS_ORDER, CV_FIELDS, escapeHtml, friendlyAuthError and the Dashboard /
// resume-export logic are in logic.js (loaded first), with tests in tests/logic.test.js.

let currentUser = null;
let companii = [];
let aplicari = [];
let cvVersiuni = [];
let DEMO_MODE = false;
// The shared demo account can't delete itself (see supabase/delete_my_account.sql).
const SHARED_DEMO_ACCOUNT_ID = "b50e790b-6604-4833-bcc5-1bfd5a2a9668";

function uid(){ return "demo-" + Math.random().toString(36).slice(2, 10); }

/* ---------------- Demo mode ----------------
   Lets anyone try the app with realistic sample data, with zero calls to
   Supabase. Useful while the real project's database is paused — nothing
   typed here is persisted anywhere, it only lives in this tab's memory. */
function demoSeedData(){
  const co1 = { id:"demo-co-1", nume:"Nova Peak Games", website:"novapeakgames.com", notite:"Referral from a former classmate.", created_at:"2026-09-02T09:00:00.000Z" };
  const co2 = { id:"demo-co-2", nume:"Lighthouse Studios", website:"lighthousestudios.io", notite:null, created_at:"2026-09-10T09:00:00.000Z" };
  const co3 = { id:"demo-co-3", nume:"BrightForge Interactive", website:"brightforge.dev", notite:"Found through BestJobs.eu.", created_at:"2026-09-18T09:00:00.000Z" };
  const companiiSeed = [co3, co2, co1];
  const aplicariSeed = [
    { id:"demo-ap-1", companie_id:co1.id, post:"Game Designer", status:"interviu", data_aplicarii:"2026-09-03", salariu_estimat:4200, notite:"Second interview scheduled next week.", created_at:"2026-09-03T10:00:00.000Z", companii:{ id:co1.id, nume:co1.nume } },
    { id:"demo-ap-2", companie_id:co1.id, post:"QA Analyst", status:"aplicat", data_aplicarii:"2026-09-05", salariu_estimat:null, notite:null, created_at:"2026-09-05T10:00:00.000Z", companii:{ id:co1.id, nume:co1.nume } },
    { id:"demo-ap-3", companie_id:co2.id, post:"Associate Producer", status:"oferta", data_aplicarii:"2026-09-11", salariu_estimat:4800, notite:"Offer received, deciding by Friday.", created_at:"2026-09-11T10:00:00.000Z", companii:{ id:co2.id, nume:co2.nume } },
    { id:"demo-ap-4", companie_id:co2.id, post:"Game Designer", status:"respins", data_aplicarii:"2026-09-12", salariu_estimat:null, notite:"Rejected after the first screening call.", created_at:"2026-09-12T10:00:00.000Z", companii:{ id:co2.id, nume:co2.nume } },
    { id:"demo-ap-5", companie_id:co3.id, post:"QA Tester", status:"aplicat", data_aplicarii:"2026-09-19", salariu_estimat:3600, notite:null, created_at:"2026-09-19T10:00:00.000Z", companii:{ id:co3.id, nume:co3.nume } },
  ];
  const cvSeed = [
    { id:"demo-cv-1", nume_versiune:"Game Design", updated_at:"2026-09-20T12:00:00.000Z",
      descriere:"Game designer focused on systems and QA, with a habit of testing my own designs before anyone else does.",
      experienta:"QA & design intern, 1 year — wrote test plans, logged defects, and proposed balance changes that shipped.",
      educatie:"Game Design, in progress.",
      competente:"Systems design, QA/test planning, Unreal Engine, prototyping in HTML/JS.",
      proiecte:"Several small playable prototypes used to validate mechanics before full production.",
      voluntariat:null },
    { id:"demo-cv-2", nume_versiune:"QA", updated_at:"2026-09-21T12:00:00.000Z",
      descriere:"QA-focused resume: test plans, defect tracking, regression testing.",
      experienta:"Wrote and executed manual test plans (70+ cases) across two shipped apps; kept a defect log through to resolution.",
      educatie:"Game Design, in progress.",
      competente:"Test planning, defect triage, exploratory testing, basic test automation.",
      proiecte:"QA pass on two personal portfolio apps, each with its own written test plan.",
      voluntariat:null },
  ];
  return { companii: companiiSeed, aplicari: aplicariSeed, cvVersiuni: cvSeed };
}

document.getElementById("demoLoginBtn").addEventListener("click", ()=>{
  DEMO_MODE = true;
  currentUser = { id:"demo-user", email:"demo@jobtracker.app" };
  const seed = demoSeedData();
  companii = seed.companii;
  aplicari = seed.aplicari;
  cvVersiuni = seed.cvVersiuni;
  document.getElementById("authScreen").classList.add("hidden");
  document.getElementById("appScreen").classList.remove("hidden");
  document.getElementById("userEmail").textContent = "demo@jobtracker.app";
  document.getElementById("demoBadge").classList.remove("hidden");
  updateDeleteAccountButton();
  renderCompanii(); renderAplicari(); renderDashboard(); renderCv();
});

/* ---------------- Toast ---------------- */
function toast(msg, isError){
  const el = document.createElement("div");
  el.className = "toast";
  if(isError){ el.style.background = "var(--bad)"; el.style.borderColor = "var(--bad)"; el.style.color = "#050010"; }
  el.textContent = msg;
  document.getElementById("toastRoot").appendChild(el);
  setTimeout(()=>el.remove(), 3200);
}

/* ---------------- Auth ---------------- */
let authMode = "login";
document.getElementById("toggleLogin").addEventListener("click", ()=>setAuthMode("login"));
document.getElementById("toggleRegister").addEventListener("click", ()=>setAuthMode("register"));
function setAuthMode(mode){
  authMode = mode;
  document.getElementById("toggleLogin").classList.toggle("active", mode==="login");
  document.getElementById("toggleRegister").classList.toggle("active", mode==="register");
  document.getElementById("authSubmit").textContent = mode==="login" ? "Login" : "Create account";
  document.getElementById("authError").textContent = "";
}

document.getElementById("authForm").addEventListener("submit", async (e)=>{
  e.preventDefault();
  const email = document.getElementById("authEmail").value.trim();
  const password = document.getElementById("authPassword").value;
  const errEl = document.getElementById("authError");
  errEl.textContent = "";
  const submitBtn = document.getElementById("authSubmit");
  submitBtn.disabled = true;
  try{
    if(authMode === "login"){
      const { error } = await sb.auth.signInWithPassword({ email, password });
      if(error) throw error;
    } else {
      const { error } = await sb.auth.signUp({ email, password });
      if(error) throw error;
      errEl.style.color = "var(--good)";
      errEl.textContent = "Account created. If email confirmation is required, check your inbox; otherwise you're logged in automatically.";
    }
  } catch(err){
    errEl.style.color = "var(--bad)";
    errEl.textContent = friendlyAuthError(err.message, authMode);
  } finally {
    submitBtn.disabled = false;
  }
});

/* Security note: on registration we deliberately do NOT confirm whether the
   email already has an account ("an account with this email already exists")
   — that would allow account enumeration (someone could check, email by
   email, who uses the app). The message below is intentionally ambiguous
   on registration. */
document.getElementById("logoutBtn").addEventListener("click", async ()=>{
  if(DEMO_MODE){
    DEMO_MODE = false;
    currentUser = null;
    companii = []; aplicari = []; cvVersiuni = [];
    document.getElementById("demoBadge").classList.add("hidden");
    document.getElementById("appScreen").classList.add("hidden");
    document.getElementById("authScreen").classList.remove("hidden");
    return;
  }
  await sb.auth.signOut();
});

/* ---------------- Delete account ----------------
   Deletes the signed-in user's companies, applications, resume versions and the
   account itself. The browser can't delete an account with the public key, so
   it calls the database function delete_my_account() (supabase/delete_my_account.sql),
   which runs with admin rights but only ever for the user who calls it. */
function updateDeleteAccountButton(){
  const hide = DEMO_MODE || !currentUser || currentUser.id === SHARED_DEMO_ACCOUNT_ID;
  document.getElementById("deleteAccountBtn").classList.toggle("hidden", hide);
}

document.getElementById("deleteAccountBtn").addEventListener("click", ()=>{
  if(DEMO_MODE || !currentUser) return;
  openModal("Delete account", `
    <p>This permanently deletes your account (<strong>${escapeHtml(currentUser.email)}</strong>)
      and everything you saved in it: companies, applications and resume versions.
      It can't be undone.</p>
    <div class="field"><label for="deleteConfirm">Type DELETE to confirm</label>
      <input id="deleteConfirm" name="confirm" autocomplete="off" required></div>
  `, async (fd)=>{
    if(String(fd.get("confirm")).trim() !== "DELETE") return; // the button is disabled until then anyway
    const deleteBtn = document.getElementById("modalSave");
    deleteBtn.disabled = true;
    deleteBtn.textContent = "Deleting...";
    const { error } = await sb.rpc("delete_my_account");
    if(error){
      deleteBtn.disabled = false;
      deleteBtn.textContent = "Delete my account";
      toast("Error: " + error.message, true);
      return;
    }
    closeModal();
    companii = []; aplicari = []; cvVersiuni = [];
    // The account no longer exists on the server; only clear the session saved in this browser.
    await sb.auth.signOut({ scope: "local" });
    toast("Your account and all your data were deleted.");
  });
  // The modal's main button says "Save" by default: here it says what it does,
  // and it stays disabled until DELETE is typed, so it can't be pressed by accident.
  const deleteBtn = document.getElementById("modalSave");
  deleteBtn.textContent = "Delete my account";
  deleteBtn.className = "btn-danger";
  deleteBtn.disabled = true;
  document.getElementById("deleteConfirm").addEventListener("input", (e)=>{
    deleteBtn.disabled = e.target.value.trim() !== "DELETE";
  });
});

sb.auth.onAuthStateChange((event, session)=>{
  currentUser = session ? session.user : null;
  updateDeleteAccountButton();
  if(currentUser){
    document.getElementById("authScreen").classList.add("hidden");
    document.getElementById("appScreen").classList.remove("hidden");
    document.getElementById("userEmail").textContent = currentUser.email;
    loadAll();
  } else {
    document.getElementById("appScreen").classList.add("hidden");
    document.getElementById("authScreen").classList.remove("hidden");
  }
});

/* ---------------- Tabs ---------------- */
document.querySelectorAll(".tab-btn").forEach(btn=>{
  btn.addEventListener("click", ()=>{
    document.querySelectorAll(".tab-btn").forEach(b=>b.classList.remove("active"));
    document.querySelectorAll(".tab-panel").forEach(p=>p.classList.remove("active"));
    btn.classList.add("active");
    document.getElementById("tab-"+btn.dataset.tab).classList.add("active");
  });
});

/* ---------------- Data loading ---------------- */
async function loadAll(){
  await Promise.all([loadCompanii(), loadAplicari(), loadCv()]);
  renderCompanii();
  renderAplicari();
  renderDashboard();
  renderCv();
}

async function loadCv(){
  const { data, error } = await sb.from("cv_versiuni").select("*").order("updated_at", { ascending:false });
  if(error){ toast("Error loading resumes: " + error.message, true); return; }
  cvVersiuni = data || [];
}

async function loadCompanii(){
  const { data, error } = await sb.from("companii").select("*").order("created_at", { ascending:false });
  if(error){ toast("Error loading companies: " + error.message, true); return; }
  companii = data || [];
}

async function loadAplicari(){
  const { data, error } = await sb.from("aplicari").select("*, companii(id, nume)").order("created_at", { ascending:false });
  if(error){ toast("Error loading applications: " + error.message, true); return; }
  aplicari = data || [];
}

/* ---------------- Modal helper ----------------
   Note: the modal no longer closes on backdrop click — only Cancel or Save.
   Reason: otherwise, selecting text in an input/textarea (a click+drag that
   visually ends over the backdrop) would accidentally close the modal and you
   would lose what you were writing. */
/* Keyboard and screen readers: the window is announced as a dialog, Escape works like
   Cancel, Tab stays inside it, and focus goes back to the button that opened it. */
let modalOpener = null;
function onModalKeydown(e){
  const modal = document.querySelector("#modalRoot .modal");
  if(!modal) return;
  if(e.key === "Escape"){ e.preventDefault(); closeModal(); return; }
  if(e.key !== "Tab") return;
  const items = [...modal.querySelectorAll("button, [href], input, select, textarea")]
    .filter(el => !el.disabled && el.offsetParent !== null);
  if(!items.length) return;
  const first = items[0], last = items[items.length - 1];
  if(e.shiftKey && (document.activeElement === first || !modal.contains(document.activeElement))){ e.preventDefault(); last.focus(); }
  else if(!e.shiftKey && (document.activeElement === last || !modal.contains(document.activeElement))){ e.preventDefault(); first.focus(); }
}

function openModal(title, bodyHtml, onSubmit){
  const root = document.getElementById("modalRoot");
  modalOpener = document.activeElement;
  root.innerHTML = `
    <div class="modal-backdrop" id="modalBackdrop">
      <div class="modal" role="dialog" aria-modal="true" aria-labelledby="modalTitle">
        <div class="modal-titlebar">
          <span class="dot" aria-hidden="true"></span><span class="dot" aria-hidden="true"></span><span class="dot" aria-hidden="true"></span>
          <h3 id="modalTitle">${title}</h3>
        </div>
        <div class="modal-body">
          <form id="modalForm">${bodyHtml}
            <div class="modal-actions">
              <button type="button" class="btn-secondary" id="modalCancel">Cancel</button>
              <button type="submit" class="btn-primary" id="modalSave">Save</button>
            </div>
          </form>
        </div>
      </div>
    </div>`;
  const form = document.getElementById("modalForm");
  const saveBtn = document.getElementById("modalSave");
  form.addEventListener("input", ()=>{ saveBtn.classList.add("needs-save"); }, { once:false });
  document.getElementById("modalCancel").addEventListener("click", closeModal);
  form.addEventListener("submit", async (e)=>{
    e.preventDefault();
    await onSubmit(new FormData(e.target));
  });
  document.removeEventListener("keydown", onModalKeydown);
  document.addEventListener("keydown", onModalKeydown);
  (form.querySelector("input, select, textarea") || saveBtn).focus();
}
function closeModal(){
  document.getElementById("modalRoot").innerHTML = "";
  document.removeEventListener("keydown", onModalKeydown);
  if(modalOpener && document.contains(modalOpener)) modalOpener.focus();
  modalOpener = null;
}

/* ---------------- Companii CRUD ---------------- */
document.getElementById("addCompanyBtn").addEventListener("click", ()=>openCompanyModal());

/* Event delegation on the list, instead of inline onclick="" on each row
   (fragile under a strict CSP and, potentially, under XSS if the id were ever
   not a server-generated UUID). */
document.getElementById("companiiList").addEventListener("click", (e)=>{
  const btn = e.target.closest("button[data-action]");
  if(!btn) return;
  const id = btn.dataset.id;
  if(btn.dataset.action === "edit") editCompanyById(id);
  else if(btn.dataset.action === "delete") deleteCompany(id);
});

function openCompanyModal(company){
  const isEdit = !!company;
  openModal(isEdit ? "Edit company" : "New company", `
    <div class="field"><label>Company name</label><input name="nume" required value="${escapeHtml(company?.nume||"")}"></div>
    <div class="field"><label>Website (optional)</label><input name="website" value="${escapeHtml(company?.website||"")}"></div>
    <div class="field"><label>Notes (optional)</label><textarea name="notite" rows="3">${escapeHtml(company?.notite||"")}</textarea></div>
  `, async (fd)=>{
    const payload = {
      nume: fd.get("nume").trim(),
      website: fd.get("website").trim() || null,
      notite: fd.get("notite").trim() || null,
    };
    if(DEMO_MODE){
      if(isEdit){ Object.assign(company, payload); }
      else { companii.unshift({ id:uid(), ...payload, created_at:new Date().toISOString() }); }
      closeModal();
      toast(isEdit ? "Company updated. (demo — not saved to a server)" : "Company added. (demo — not saved to a server)");
      renderCompanii(); renderAplicari(); renderDashboard();
      return;
    }
    let error;
    if(isEdit){
      ({ error } = await sb.from("companii").update(payload).eq("id", company.id));
    } else {
      payload.user_id = currentUser.id;
      ({ error } = await sb.from("companii").insert(payload));
    }
    if(error){ toast("Error: " + error.message, true); return; }
    closeModal();
    toast(isEdit ? "Company updated." : "Company added.");
    await loadCompanii(); await loadAplicari();
    renderCompanii(); renderAplicari(); renderDashboard();
  });
}

async function deleteCompany(id){
  if(!confirm("Delete this company? Its applications will be deleted too.")) return;
  if(DEMO_MODE){
    companii = companii.filter(c=>c.id!==id);
    aplicari = aplicari.filter(a=>a.companie_id!==id);
    toast("Company deleted. (demo)");
    renderCompanii(); renderAplicari(); renderDashboard();
    return;
  }
  const { error } = await sb.from("companii").delete().eq("id", id);
  if(error){ toast("Error: " + error.message, true); return; }
  toast("Company deleted.");
  await loadCompanii(); await loadAplicari();
  renderCompanii(); renderAplicari(); renderDashboard();
}

function renderCompanii(){
  const el = document.getElementById("companiiList");
  if(companii.length === 0){
    el.innerHTML = `<div class="empty-state">No companies yet. Add your first one with the button above.</div>`;
    return;
  }
  el.innerHTML = companii.map(c=>{
    const nrAplicari = aplicari.filter(a=>a.companie_id===c.id).length;
    return `
    <div class="row-item">
      <div class="row-main">
        <div class="row-title">${escapeHtml(c.nume)}</div>
        <div class="row-sub">${nrAplicari} application(s)${c.website ? " · " + escapeHtml(c.website) : ""}</div>
      </div>
      <div class="row-actions">
        <button class="btn-secondary" data-action="edit" data-id="${c.id}">Edit</button>
        <button class="btn-danger" data-action="delete" data-id="${c.id}">Delete</button>
      </div>
    </div>`;
  }).join("");
}
function editCompanyById(id){ openCompanyModal(companii.find(c=>c.id===id)); }

/* ---------------- Aplicari CRUD ---------------- */
document.getElementById("addApplicationBtn").addEventListener("click", ()=>{
  if(companii.length === 0){ toast("Add a company first.", true); return; }
  openApplicationModal();
});

document.getElementById("aplicariList").addEventListener("click", (e)=>{
  const btn = e.target.closest("button[data-action]");
  if(!btn) return;
  const id = btn.dataset.id;
  if(btn.dataset.action === "edit") editApplicationById(id);
  else if(btn.dataset.action === "delete") deleteApplication(id);
});

function openApplicationModal(app){
  const isEdit = !!app;
  const companyOptions = companii.map(c=>`<option value="${c.id}" ${app?.companie_id===c.id?"selected":""}>${escapeHtml(c.nume)}</option>`).join("");
  const statusOptions = STATUS_ORDER.map(s=>`<option value="${s}" ${app?.status===s?"selected":""}>${STATUS_LABELS[s]}</option>`).join("");
  openModal(isEdit ? "Edit application" : "New application", `
    <div class="form-grid">
      <div class="field full"><label>Company</label><select name="companie_id" required>${companyOptions}</select></div>
      <div class="field full"><label>Position</label><input name="post" required value="${escapeHtml(app?.post||"")}"></div>
      <div class="field"><label>Status</label><select name="status">${statusOptions}</select></div>
      <div class="field"><label>Application date</label><input type="date" name="data_aplicarii" value="${app?.data_aplicarii || new Date().toISOString().slice(0,10)}"></div>
      <div class="field full"><label>Estimated salary (optional)</label><input type="number" name="salariu_estimat" step="1" value="${app?.salariu_estimat ?? ""}"></div>
      <div class="field full"><label>Notes (optional)</label><textarea name="notite" rows="3">${escapeHtml(app?.notite||"")}</textarea></div>
    </div>
  `, async (fd)=>{
    const payload = {
      companie_id: fd.get("companie_id"),
      post: fd.get("post").trim(),
      status: fd.get("status"),
      data_aplicarii: fd.get("data_aplicarii") || null,
      salariu_estimat: fd.get("salariu_estimat") ? Number(fd.get("salariu_estimat")) : null,
      notite: fd.get("notite").trim() || null,
    };
    if(DEMO_MODE){
      const companyRef = companii.find(c=>c.id===payload.companie_id);
      const companiiField = companyRef ? { id:companyRef.id, nume:companyRef.nume } : null;
      if(isEdit){ Object.assign(app, payload, { companii: companiiField }); }
      else { aplicari.unshift({ id:uid(), ...payload, created_at:new Date().toISOString(), companii: companiiField }); }
      closeModal();
      toast(isEdit ? "Application updated. (demo — not saved to a server)" : "Application added. (demo — not saved to a server)");
      renderAplicari(); renderCompanii(); renderDashboard();
      return;
    }
    let error;
    if(isEdit){
      ({ error } = await sb.from("aplicari").update(payload).eq("id", app.id));
    } else {
      payload.user_id = currentUser.id;
      ({ error } = await sb.from("aplicari").insert(payload));
    }
    if(error){ toast("Error: " + error.message, true); return; }
    closeModal();
    toast(isEdit ? "Application updated." : "Application added.");
    await loadAplicari();
    renderAplicari(); renderCompanii(); renderDashboard();
  });
}

async function deleteApplication(id){
  if(!confirm("Delete this application?")) return;
  if(DEMO_MODE){
    aplicari = aplicari.filter(a=>a.id!==id);
    toast("Application deleted. (demo)");
    renderAplicari(); renderCompanii(); renderDashboard();
    return;
  }
  const { error } = await sb.from("aplicari").delete().eq("id", id);
  if(error){ toast("Error: " + error.message, true); return; }
  toast("Application deleted.");
  await loadAplicari();
  renderAplicari(); renderCompanii(); renderDashboard();
}

function renderAplicari(){
  const el = document.getElementById("aplicariList");
  if(aplicari.length === 0){
    el.innerHTML = `<div class="empty-state">No applications yet.</div>`;
    return;
  }
  el.innerHTML = aplicari.map(a=>`
    <div class="row-item">
      <div class="row-main">
        <div class="row-title">${escapeHtml(a.post)} <span class="badge badge-${a.status}">${STATUS_LABELS[a.status]}</span></div>
        <div class="row-sub">${escapeHtml(a.companii?.nume || "—")} · ${a.data_aplicarii || "no date"}</div>
      </div>
      <div class="row-actions">
        <button class="btn-secondary" data-action="edit" data-id="${a.id}">Edit</button>
        <button class="btn-danger" data-action="delete" data-id="${a.id}">Delete</button>
      </div>
    </div>`).join("");
}
function editApplicationById(id){ openApplicationModal(aplicari.find(a=>a.id===id)); }

/* ---------------- CV CRUD ---------------- */
document.getElementById("addCvBtn").addEventListener("click", ()=>openCvModal());

document.getElementById("cvList").addEventListener("click", (e)=>{
  const btn = e.target.closest("button[data-action]");
  if(!btn) return;
  const id = btn.dataset.id;
  if(btn.dataset.action === "export") exportCv(id);
  else if(btn.dataset.action === "edit") editCvById(id);
  else if(btn.dataset.action === "delete") deleteCv(id);
});


function openCvModal(cv){
  const isEdit = !!cv;
  const fieldsHtml = CV_FIELDS.map(f=>`
    <div class="field full">
      <label>${f.label}</label>
      <textarea name="${f.key}" rows="${f.rows}" placeholder="${f.placeholder}">${escapeHtml(cv?.[f.key]||"")}</textarea>
    </div>`).join("");
  openModal(isEdit ? "Edit resume" : "New resume", `
    <div class="field full"><label>Version name</label><input name="nume_versiune" required placeholder="e.g. Frontend, Full-stack" value="${escapeHtml(cv?.nume_versiune||"")}"></div>
    ${fieldsHtml}
  `, async (fd)=>{
    const payload = {
      nume_versiune: fd.get("nume_versiune").trim(),
      updated_at: new Date().toISOString(),
    };
    CV_FIELDS.forEach(f=>{ payload[f.key] = fd.get(f.key)?.trim() || null; });
    if(DEMO_MODE){
      if(isEdit){ Object.assign(cv, payload); }
      else { cvVersiuni.unshift({ id:uid(), ...payload }); }
      closeModal();
      toast(isEdit ? "Resume updated. (demo — not saved to a server)" : "Resume added. (demo — not saved to a server)");
      renderCv();
      return;
    }
    let error;
    if(isEdit){
      ({ error } = await sb.from("cv_versiuni").update(payload).eq("id", cv.id));
    } else {
      payload.user_id = currentUser.id;
      ({ error } = await sb.from("cv_versiuni").insert(payload));
    }
    if(error){ toast("Error: " + error.message, true); return; }
    closeModal();
    toast(isEdit ? "Resume updated." : "Resume added.");
    await loadCv();
    renderCv();
  });
}

async function deleteCv(id){
  if(!confirm("Delete this resume version?")) return;
  if(DEMO_MODE){
    cvVersiuni = cvVersiuni.filter(cv=>cv.id!==id);
    toast("Resume deleted. (demo)");
    renderCv();
    return;
  }
  const { error } = await sb.from("cv_versiuni").delete().eq("id", id);
  if(error){ toast("Error: " + error.message, true); return; }
  toast("Resume deleted.");
  await loadCv();
  renderCv();
}

function renderCv(){
  const el = document.getElementById("cvList");
  if(cvVersiuni.length === 0){
    el.innerHTML = `<div class="empty-state">No resume versions yet. Add your first one with the button above.</div>`;
    return;
  }
  el.innerHTML = cvVersiuni.map(cv=>{
    const snippet = CV_FIELDS.map(f=>cv[f.key]).find(v=>v && v.trim()) || "";
    return `
    <div class="row-item">
      <div class="row-main">
        <div class="row-title">${escapeHtml(cv.nume_versiune)}</div>
        <div class="row-sub">Updated: ${new Date(cv.updated_at).toLocaleDateString("en-US")}</div>
        <div class="cv-preview">${escapeHtml(snippet.slice(0,160))}${snippet.length>160?"…":""}</div>
      </div>
      <div class="row-actions">
        <button class="btn-secondary" data-action="export" data-id="${cv.id}">Export</button>
        <button class="btn-secondary" data-action="edit" data-id="${cv.id}">Edit</button>
        <button class="btn-danger" data-action="delete" data-id="${cv.id}">Delete</button>
      </div>
    </div>`;
  }).join("");
}
function editCvById(id){ openCvModal(cvVersiuni.find(cv=>cv.id===id)); }

function exportCv(id){
  const cv = cvVersiuni.find(c=>c.id===id);
  if(!cv) return;
  const html = buildCvExportHtml(cv, new Date().toLocaleDateString("en-US"));   // logic.js
  const blob = new Blob([html], { type:"text/html" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = cvExportFileName(cv.nume_versiune);
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(url);
  toast("Resume exported as an HTML file — you can open it in your browser and save as PDF (Print → Save as PDF), or open it in Word.");
}

/* ---------------- Dashboard ---------------- */
function renderDashboard(){
  const stats = dashboardStats(aplicari, companii);   // the numbers: logic.js
  document.getElementById("statTotal").textContent = stats.total;
  document.getElementById("statCompanii").textContent = stats.companies;
  document.getElementById("statRate").textContent = stats.responseRate + "%";
  document.getElementById("statOferte").textContent = stats.offers;

  const barsEl = document.getElementById("statusBars");
  // The colour comes from a class in styles.css (bar-fill-<status>). The width is set below,
  // through the DOM: the CSP blocks style="" attributes inside HTML, not el.style.
  barsEl.innerHTML = STATUS_ORDER.map(s=>{
    const count = stats.statusCounts[s];
    const pct = (count/stats.maxStatusCount)*100;
    return `<div class="bar-row">
      <div class="bar-label">${STATUS_LABELS[s]}</div>
      <div class="bar-track"><div class="bar-fill bar-fill-${s}" data-pct="${pct}"></div></div>
      <div class="bar-count">${count}</div>
    </div>`;
  }).join("");
  barsEl.querySelectorAll(".bar-fill").forEach(el=>{ el.style.width = el.dataset.pct + "%"; });

  const top = stats.topCompanies;
  const topEl = document.getElementById("topCompanies");
  topEl.innerHTML = top.length
    ? top.map(([nume,count])=>`<div class="top-company"><span>${escapeHtml(nume)}</span><strong>${count}</strong></div>`).join("")
    : `<div class="empty-state">No data yet.</div>`;
}

// ===================== BACK TO TOP =====================
// Shown only when the page is long enough to need it (shouldShowToTop in logic.js): checked on
// scroll, on resize and whenever the page's height changes (companies or applications added,
// another tab, login). A click scrolls up (instantly with reduced motion) and puts keyboard focus
// on the first visible link or button, at the top.
(function setUpBackToTop(){
  const btn = document.getElementById("toTopBtn");
  if(!btn) return;
  let queued = false;
  const update = ()=>{
    queued = false;
    btn.classList.toggle("is-shown",
      shouldShowToTop(window.scrollY, window.innerHeight, document.documentElement.scrollHeight));
  };
  const queue = ()=>{ if(!queued){ queued = true; requestAnimationFrame(update); } };
  window.addEventListener("scroll", queue, { passive:true });
  window.addEventListener("resize", queue);
  if("ResizeObserver" in window) new ResizeObserver(queue).observe(document.body);
  btn.addEventListener("click", ()=>{
    const reduce = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    window.scrollTo({ top:0, behavior: reduce ? "auto" : "smooth" });
    const first = [...document.querySelectorAll("a[href], button:not([disabled])")]
      .find(el => el !== btn && el.offsetParent !== null);
    if(first) first.focus({ preventScroll:true });
  });
  update();
})();
