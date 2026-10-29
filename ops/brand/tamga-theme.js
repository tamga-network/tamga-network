/* Tamga UI — early theme stamp, loaded in <head> before the page paints (no flash). External file: no inline script under CSP. */
try {
  const t = localStorage.getItem("tamga.theme");
  if (t === "light" || t === "dark") document.documentElement.dataset.theme = t;
} catch {}
