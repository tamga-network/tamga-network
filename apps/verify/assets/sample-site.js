/*
 * Sample relying party (/sample-site): "Sign up / Sign in with Tamga" through the site kit (/tamga-verifier.js, loaded before
 * this file) and passkey sign-in. Parameters and messages come from data-* attributes (no inline script — CSP).
 */
(() => {
  const cfg = document.currentScript.dataset;
  const M = JSON.parse(cfg.msg);
  const $ = (i) => document.getElementById(i);
  const msg = (t) => {
    const m = $("msg");
    if (m) m.textContent = t;
  };
  const post = (u, b) =>
    fetch(u, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify(b || {}) }).then(
      async (r) => ({ ok: r.ok, j: await r.json() }),
    );
  const passkeyOk = () => {
    if (!TamgaVerifier.passkey.supported()) {
      msg(M.pkUnsupported);
      return false;
    }
    return true;
  };
  async function pkRegister() {
    if (!passkeyOk()) return;
    try {
      const o = await post("/sample-site/passkey/register/options");
      if (!o.ok) return msg(o.j.reason);
      const resp = await TamgaVerifier.passkey.create(o.j);
      const v = await post("/sample-site/passkey/register/verify", resp);
      if (v.ok) location.reload();
      else msg(v.j.reason);
    } catch (e) {
      msg(M.pkNotAdded + e.message);
    }
  }
  async function pkLogin() {
    if (!passkeyOk()) return;
    try {
      const o = await post("/sample-site/passkey/login/options");
      if (!o.ok) return msg(o.j.reason);
      const resp = await TamgaVerifier.passkey.get(o.j.options);
      const v = await post("/sample-site/passkey/login/verify", { flow: o.j.flow, response: resp });
      if (v.ok) location.reload();
      else msg(v.j.reason);
    } catch (e) {
      msg(M.pkNoLogin + e.message);
    }
  }
  const go = (policy) => {
    msg("");
    TamgaVerifier.mount($("tamga"), {
      verifier: cfg.verifier,
      policy,
      lang: cfg.lang,
      start: (o) =>
        fetch("/sample-site/start", {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({ policy, ...(o && o.dcApiOrigin ? { dc_api_origin: o.dcApiOrigin } : {}) }),
        }).then((r) => {
          if (!r.ok) throw new Error(M.openFailed + " (" + r.status + ")");
          return r.json();
        }),
      onResult: async (id) => {
        const r = await fetch("/sample-site/session", {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({ presentation_id: id }),
        });
        const j = await r.json();
        if (j.ok) location.reload();
        else msg(j.reason || M.sessionFailed);
      },
    });
  };
  const on = (id, fn) => {
    const el = $(id);
    if (el) el.addEventListener("click", fn);
  };
  on("addpk", pkRegister);
  on("pklogin", pkLogin);
  on("signup", () => go("site-signup"));
  on("login", () => go("site-signin"));
  on("reviewsignup", () => go("review-site-signup"));
})();
