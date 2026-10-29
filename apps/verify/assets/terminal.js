/*
 * Gate terminal (/terminal): reads a pass token from the camera (BarcodeDetector, else the self-hosted jsQR in
 * /assets/vendor/jsQR.js) or from the text box and asks /terminal/verify with the terminal key. Parameters and messages come
 * from data-* attributes (no inline script — CSP).
 */
(() => {
  const cfg = document.currentScript.dataset;
  const M = JSON.parse(cfg.msg);
  const $ = (i) => document.getElementById(i);
  let last = "";
  try {
    $("key").value = sessionStorage.getItem("tamga-terminal-key") || "";
  } catch {}
  $("key").addEventListener("input", () => {
    try {
      sessionStorage.setItem("tamga-terminal-key", $("key").value.trim());
    } catch {}
  });
  async function check(tk) {
    const r = await fetch("/terminal/verify", {
      method: "POST",
      headers: { "content-type": "application/json", authorization: "Bearer " + $("key").value.trim() },
      body: JSON.stringify({ token: tk, terminal_group: cfg.group }),
    });
    const j = await r.json();
    $("res").className = "result " + (j.ok ? "ACCEPTED" : "REJECTED");
    $("res").textContent = j.ok ? M.pass : M.stop;
    $("det").textContent = j.ok
      ? "pass " + j.passId + " · " + j.expiresIn + " " + M.left
      : r.status === 401 || r.status === 403
        ? M.keyNeeded
        : j.reason || "";
  }
  $("chk").addEventListener("click", () => check($("tok").value.trim()));
  $("cam").addEventListener("click", async () => {
    if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
      $("camnote").textContent = M.camInsecure;
      return;
    }
    const v = $("v");
    v.hidden = false;
    let s;
    try {
      s = await navigator.mediaDevices.getUserMedia({ video: { facingMode: "environment" } });
    } catch {
      try {
        s = await navigator.mediaDevices.getUserMedia({ video: true });
      } catch (e) {
        $("camnote").textContent = M.camFailed + e.message;
        return;
      }
    }
    v.srcObject = s;
    await v.play();
    let read;
    if ("BarcodeDetector" in window) {
      const d = new BarcodeDetector({ formats: ["qr_code"] });
      read = async () => {
        const c = await d.detect(v);
        return c.length ? c[0].rawValue : null;
      };
    } else if (window.jsQR) {
      const cv = document.createElement("canvas");
      const cx = cv.getContext("2d", { willReadFrequently: true });
      read = async () => {
        if (!v.videoWidth) return null;
        cv.width = v.videoWidth;
        cv.height = v.videoHeight;
        cx.drawImage(v, 0, 0);
        const im = cx.getImageData(0, 0, cv.width, cv.height);
        const r = jsQR(im.data, im.width, im.height, { inversionAttempts: "dontInvert" });
        return r ? r.data : null;
      };
    } else {
      $("camnote").textContent = M.qrLib;
      return;
    }
    $("camnote").textContent = M.camOn;
    setInterval(async () => {
      try {
        const tk = await read();
        if (tk && tk !== last) {
          last = tk;
          $("tok").value = tk;
          check(tk);
        }
      } catch {}
    }, 400);
  });
})();
