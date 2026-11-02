/*
 * Tamga UI — shared page behaviour: theme switch (system · light · dark, remembered per browser), fingerprint copy buttons,
 * and small helpers for pages that render live data (window.TamgaUI). The early theme stamp is tamga-theme.js in <head>.
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
    // DOM nodes, not an HTML string: service pages enforce Trusted Types (require-trusted-types-for 'script')
    if (out)
      out.replaceChildren(
        ...(fp.match(/.{1,4}/g) || []).flatMap((g, i) => {
          const part =
            i % 2 ? Object.assign(document.createElement("i"), { textContent: g }) : document.createTextNode(g);
          return i ? [document.createTextNode(" "), part] : [part];
        }),
      );
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
  /** DOM builder: el("td", { class: "mono" }, "text", node, [more]) — strings become text nodes (no HTML parsing). */
  const el = (tag, attrs, ...children) => {
    const n = document.createElement(tag);
    for (const [k, v] of Object.entries(attrs || {}))
      if (v !== undefined && v !== null && v !== false) n.setAttribute(k, v);
    append(n, children);
    return n;
  };
  const append = (n, children) => {
    for (const c of children.flat(Infinity))
      if (c === null || c === undefined || c === false) continue;
      else n.append(typeof c === "string" || typeof c === "number" ? String(c) : c);
    return n;
  };
  const PILL = {
    ACTIVE: ["", "Active"],
    SUSPENDED: ["warn", "Suspended"],
    REVOKED: ["bad", "Revoked"],
    RETIRED: ["muted", "Retired"],
  };
  window.TamgaUI = {
    esc,
    el,
    /** Replace an element's children with text/nodes (fetched data goes in as text, never as HTML). */
    set: (target, ...children) => {
      const n = typeof target === "string" ? document.getElementById(target) : target;
      if (n) n.replaceChildren(...append(document.createDocumentFragment(), children).childNodes);
      return n;
    },
    small: (...children) => el("small", null, ...children),
    /** Status pill as a node: pillNode("ACTIVE") maps the status; pillNode("Any text", "warn" | "muted" | "") shows free text. */
    pillNode: (status, kind) => {
      const m = kind === undefined ? PILL[status] || ["muted", status] : [kind, status];
      return el("span", { class: `pill ${m[0]}`.trim() }, m[1]);
    },
    row: (...cells) => el("tr", null, ...cells),
    cell: (attrs, ...children) => el("td", attrs, ...children),
    link: (href, text, attrs) => el("a", { href, ...(attrs || {}) }, text),
    date: (iso) => new Date(iso).toLocaleDateString(locale, { day: "numeric", month: "short", year: "numeric" }),
    dateTime: (iso) =>
      new Date(iso).toLocaleString(locale, { day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" }),
    days: (iso) => Math.round((new Date(iso) - Date.now()) / 86400000),
    /** @deprecated HTML string; service pages build nodes with `pillNode` (CSP: text nodes only). */
    pill: (status) => {
      const m = PILL[status] || ["muted", status];
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
