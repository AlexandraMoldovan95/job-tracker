// Puts the theme on <html> before the page is drawn, so a light-theme visitor never sees the dark
// page flash first: the saved choice from the light/dark button, or the system setting on a first
// visit (pickTheme in logic.js, loaded just before this). A file, not an inline script, because the
// CSP allows no inline scripts.
(function () {
  var saved = null;
  try { saved = localStorage.getItem("jt-theme"); } catch (e) { /* storage blocked: follow the system */ }
  var systemDark = !!(window.matchMedia && window.matchMedia("(prefers-color-scheme: dark)").matches);
  document.documentElement.setAttribute("data-theme", pickTheme(saved, systemDark));
})();
