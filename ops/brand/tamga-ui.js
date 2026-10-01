/*
 * Tamga UI — shared page behaviour: theme switch (system · light · dark, remembered per browser), fingerprint copy buttons,
 * and small helpers for pages that render live data (window.TamgaUI). The early theme stamp lives inline in <head>.
 */
(() => {
  const root = document.documentElement;
  const buttons = document.querySelectorAll("[data-theme-choice]");
  const setTheme = (choice) => {
    if (choice === "system") delete root.dataset.theme;
    else root.dataset.theme = choice;
    buttons.forEach((b) => b.setAttribute("aria-pressed", String(b.dataset.themeChoice === choice)));
    try {
      if (choice === "system") localStorage.removeItem("tamga.theme");
      else localStorage.setItem("tamga.theme", choice);
    } catch {}
  };
  buttons.forEach((b) => b.addEventListener("click", () => setTheme(b.dataset.themeChoice)));
  setTheme(root.dataset.theme || "system");

  // Fingerprints: groups of four, Copy takes the full value
  const copied = root.lang === "tr" ? "Kopyalandı" : "Copied";
  document.querySelectorAll("[data-fp]").forEach((el) => {
    const fp = el.dataset.fp;
    const out = el.querySelector(".fp");
    if (out)
      out.innerHTML = fp
        .match(/.{1,4}/g)
        .map((g, i) => (i % 2 ? `<i>${g}</i>` : g))
        .join(" ");
    const btn = el.querySelector(".copy");
    if (!btn) return;
    const label = btn.textContent;
    btn.addEventListener("click", async () => {
      try {
        await navigator.clipboard.writeText(fp);
      } catch {
        return;
      }
      btn.textContent = copied;
      btn.classList.add("done");
      setTimeout(() => {
        btn.textContent = label;
        btn.classList.remove("done");
      }, 1600);
    });
  });

  const esc = (s) =>
    String(s ?? "").replace(
      /[&<>"']/g,
      (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c],
    );
  const locale = root.lang === "tr" ? "tr-TR" : "en-GB";
  window.TamgaUI = {
    esc,
    date: (iso) => new Date(iso).toLocaleDateString(locale, { day: "numeric", month: "short", year: "numeric" }),
    dateTime: (iso) =>
      new Date(iso).toLocaleString(locale, { day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" }),
    days: (iso) => Math.round((new Date(iso) - Date.now()) / 86400000),
    pill: (status) => {
      const m = {
        ACTIVE: ["", "Active"],
        SUSPENDED: ["warn", "Suspended"],
        REVOKED: ["bad", "Revoked"],
        RETIRED: ["muted", "Retired"],
      }[status] || ["muted", status];
      return `<span class="pill ${m[0]}">${esc(m[1])}</span>`;
    },
    /** JWS payload (no verification — display only; clients verify with @tamga-network/trust). */
    jwsPayload: (jws) => {
      try {
        return JSON.parse(atob(jws.split(".")[1].replace(/-/g, "+").replace(/_/g, "/")));
      } catch {
        return null;
      }
    },
  };
})();
