/*
 * Waiting page (/p/:id while PENDING): polls the presentation state and reloads when the wallet has answered. Backs off on
 * 429 / errors (Retry-After respected, cap 30 s). Parameters come from data-* attributes (no inline script — CSP).
 */
(() => {
  const url = document.currentScript.dataset.poll;
  const base = 2000;
  let wait = base;
  const poll = async () => {
    try {
      const r = await fetch(url);
      if (r.ok) {
        wait = base;
        const j = await r.json();
        if (j.state === "DONE") return location.reload();
      } else {
        const ra = Number(r.headers.get("retry-after"));
        wait = Math.min(30000, Math.max(ra > 0 ? ra * 1000 : 0, wait * 2));
      }
    } catch {
      wait = Math.min(30000, wait * 2);
    }
    setTimeout(poll, wait);
  };
  setTimeout(poll, base);
})();
