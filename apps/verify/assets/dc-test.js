/*
 * Digital Credentials API test page (/dc-api-test): asks a wallet on this device through navigator.credentials.get, forwards
 * the encrypted answer to the verifier and shows the result. Values are written with textContent only. Messages come from a
 * data-* attribute (no inline script — CSP).
 */
(() => {
  const M = JSON.parse(document.currentScript.dataset.msg);
  const $ = (i) => document.getElementById(i);
  const setText = (i, v) => {
    $(i).textContent = v;
  };
  const has = "DigitalCredential" in window && !!navigator.credentials;
  setText("sup", has ? M.supported : M.unsupported);
  if (!has) $("go").disabled = true;
  for (const p of ["openid4vp-v1-signed", "org-iso-mdoc"]) {
    const li = document.createElement("li");
    let s = M.protoUnknown;
    try {
      if (has && typeof DigitalCredential.userAgentAllowsProtocol === "function")
        s = DigitalCredential.userAgentAllowsProtocol(p) ? M.protoYes : M.protoNo;
    } catch {}
    li.textContent = p + " — " + s;
    $("protos").appendChild(li);
  }
  const pick = (n) => document.querySelector('input[name="' + n + '"]:checked').value;
  const show = (r, proto) => {
    $("out").hidden = false;
    const o = $("outcome");
    o.className = "result " + (r.outcome || "PENDING");
    o.textContent = (r.outcome || "") + (r.failed_step ? " · " + r.failed_step + ": " + (r.failed_reason || "") : "");
    setText("proto", proto || "");
    setText("checks", (r.checks || []).join(", "));
    setText("disclosed", (r.disclosed || []).join(", "));
    const tb = $("claims");
    if (tb) {
      tb.textContent = "";
      for (const [k, v] of Object.entries(r.claims || {})) {
        const tr = document.createElement("tr");
        const a = document.createElement("th");
        a.textContent = k;
        const b = document.createElement("td");
        b.textContent = typeof v === "string" ? v : JSON.stringify(v);
        tr.append(a, b);
        tb.appendChild(tr);
      }
    }
    const ol = $("trace");
    ol.textContent = "";
    for (const s of r.trace || []) {
      const li = document.createElement("li");
      li.textContent = s;
      ol.appendChild(li);
    }
  };
  const poll = async (t, proto, n) => {
    const r = await fetch("/dc-api-test/result/" + encodeURIComponent(t))
      .then((x) => x.json())
      .catch(() => ({}));
    if (r.state === "DONE") {
      setText("status", "");
      show(r, proto);
      return;
    }
    if (n < 40) setTimeout(() => poll(t, proto, n + 1), 1500);
  };
  $("go").addEventListener("click", async () => {
    $("out").hidden = true;
    setText("status", M.preparing);
    setText("reqs", "");
    let s;
    try {
      const r = await fetch("/dc-api-test/start", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ policy: pick("policy"), protocol: pick("protocol"), origin: location.origin }),
      });
      s = await r.json();
      if (!r.ok) throw new Error(s.reason || s.error || "HTTP " + r.status);
    } catch (e) {
      setText("status", e.message);
      return;
    }
    setText("reqs", JSON.stringify(s.requests, null, 2));
    setText("status", M.waitingWallet);
    let cred;
    try {
      cred = await navigator.credentials.get({ digital: { requests: s.requests }, mediation: "required" });
    } catch (e) {
      setText("status", M.cancelled + (e && e.name ? e.name + " — " : "") + ((e && e.message) || ""));
      return;
    }
    if (!cred) {
      setText("status", M.cancelled + "null");
      return;
    }
    let data = cred.data;
    if (typeof data === "string") {
      try {
        data = JSON.parse(data);
      } catch {}
    }
    const proto = cred.protocol || (s.requests.length === 1 ? s.requests[0].protocol : "");
    const target = s.response_uris[proto];
    const resp = data && data.response;
    if (!target || typeof resp !== "string") {
      setText("status", M.cancelled + "unexpected answer (" + proto + ")");
      return;
    }
    setText("status", M.forwarding);
    const pr = await fetch(target, {
      method: "POST",
      headers: { "content-type": "application/x-www-form-urlencoded" },
      body: "response=" + encodeURIComponent(resp),
    }).catch(() => ({ ok: false, status: 0 }));
    setText("status", M.verifying + (pr.ok ? "" : " (HTTP " + pr.status + ")"));
    poll(s.t, proto, 0);
  });
})();
