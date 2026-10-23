/**
 * Digital Credentials API deneme sayfası (routes/dc-test.ts). Mantık sayfa betiğinde yalnız tarayıcı çağrısı ve iletimdir;
 * karar doğrulayıcıda. Sayfa verileri yalnız `textContent` ile yazar (yanıttan gelen hiçbir değer HTML olarak işlenmez).
 */
import { esc, jsLit, page, type Lang } from "./html.js";

/** Denemede seçilebilen politikalar: mdoc (iki protokol) ve SD-JWT (yalnız OpenID4VP). */
export const DC_TEST_POLICIES = ["age-over-18-mdoc", "age-over-15-mdoc", "event-tamga-id"];

const T = {
  en: {
    title: "Digital Credentials API test",
    lede: "Ask a wallet on this device for a credential through the browser (W3C Digital Credentials API) — no QR code. The verifier decides; this page only forwards the encrypted answer and shows the result.",
    support: "Browser support",
    supported: "This browser has the Digital Credentials API.",
    unsupported:
      "This browser does not support the Digital Credentials API. Try Chrome or Edge 141+ on Android or desktop (desktop Chrome hands over to your phone), or Safari on iOS 26 / macOS 26 for org-iso-mdoc. The QR code flow on the sample site works everywhere.",
    protoYes: "accepted by this browser",
    protoNo: "not accepted by this browser",
    protoUnknown: "browser does not say",
    policy: "What to ask for",
    pMdoc: "Over 18 — mdoc (ISO/IEC 18013-5); both protocols",
    pMdoc15: "Over 15 — mdoc (ISO/IEC 18013-5); both protocols",
    pSd: "Tamga identity is valid — SD-JWT VC; OpenID4VP only",
    protocol: "Protocol",
    both: "Both — browser and wallet choose",
    oid: "openid4vp-v1-signed (OpenID4VP 1.0 Annex A, signed request)",
    mdoc: "org-iso-mdoc (ISO/IEC 18013-7 Annex C)",
    go: "Request credential",
    preparing: "Preparing the signed request…",
    waitingWallet: "Waiting for the wallet (approve in your wallet)…",
    forwarding: "Forwarding the encrypted answer to the verifier…",
    verifying: "Verifying…",
    cancelled: "No credential returned: ",
    requests: "Requests sent to navigator.credentials.get",
    response: "Answer protocol",
    checks: "Checks performed",
    claims: "Disclosed values (sandbox sample data)",
    disclosed: "Disclosed fields",
    trace: "Verifier trace",
    sample: "Sample site (QR / same-device link)",
    note: "Sandbox only: test credentials from sandbox.tamga.network. The request is bound to this page's origin; another site cannot reuse it.",
  },
  tr: {
    title: "Digital Credentials API denemesi",
    lede: "Bu cihazdaki cüzdandan tarayıcı üzerinden belge isteyin (W3C Digital Credentials API) — QR yok. Kararı doğrulayıcı verir; bu sayfa yalnız şifreli yanıtı iletir ve sonucu gösterir.",
    support: "Tarayıcı desteği",
    supported: "Bu tarayıcıda Digital Credentials API var.",
    unsupported:
      "Bu tarayıcı Digital Credentials API'yi desteklemiyor. Android ya da masaüstünde Chrome veya Edge 141+ deneyin (masaüstü Chrome telefonunuza devreder), org-iso-mdoc için iOS 26 / macOS 26 Safari. Örnek sitedeki QR akışı her yerde çalışır.",
    protoYes: "bu tarayıcı kabul ediyor",
    protoNo: "bu tarayıcı kabul etmiyor",
    protoUnknown: "tarayıcı bildirmiyor",
    policy: "Ne istensin",
    pMdoc: "18 yaş üstü — mdoc (ISO/IEC 18013-5); iki protokol",
    pMdoc15: "15 yaş üstü — mdoc (ISO/IEC 18013-5); iki protokol",
    pSd: "Tamga kimliği geçerli — SD-JWT VC; yalnız OpenID4VP",
    protocol: "Protokol",
    both: "İkisi — tarayıcı ve cüzdan seçer",
    oid: "openid4vp-v1-signed (OpenID4VP 1.0 Ek A, imzalı istek)",
    mdoc: "org-iso-mdoc (ISO/IEC 18013-7 Ek C)",
    go: "Belge iste",
    preparing: "İmzalı istek hazırlanıyor…",
    waitingWallet: "Cüzdan bekleniyor (cüzdanda onaylayın)…",
    forwarding: "Şifreli yanıt doğrulayıcıya iletiliyor…",
    verifying: "Doğrulanıyor…",
    cancelled: "Belge dönmedi: ",
    requests: "navigator.credentials.get'e giden istekler",
    response: "Yanıtın protokolü",
    checks: "Yapılan denetimler",
    claims: "Açıklanan değerler (sandbox örnek verisi)",
    disclosed: "Açıklanan alanlar",
    trace: "Doğrulayıcı izi",
    sample: "Örnek site (QR / aynı cihaz bağlantısı)",
    note: "Yalnız sandbox: sandbox.tamga.network deneme belgeleri. İstek bu sayfanın kökenine bağlıdır; başka bir site kullanamaz.",
  },
} as const;

export function dcTestPage(lang: Lang, o: { showValues: boolean }) {
  const t = T[lang];
  const body = `<p class="eyebrow">Sandbox · W3C Digital Credentials API</p><h1>${esc(t.title)}</h1><p class="lede">${esc(t.lede)}</p>
<section><div class="panel"><h2>${esc(t.support)}</h2><p id="sup" class="muted"></p><ul id="protos" class="small"></ul></div></section>
<section id="form"><div class="panel">
<p><strong>${esc(t.policy)}</strong></p>
<p><label><input type="radio" name="policy" value="age-over-18-mdoc" checked> ${esc(t.pMdoc)}</label><br>
<label><input type="radio" name="policy" value="age-over-15-mdoc"> ${esc(t.pMdoc15)}</label><br>
<label><input type="radio" name="policy" value="event-tamga-id"> ${esc(t.pSd)}</label></p>
<p><strong>${esc(t.protocol)}</strong></p>
<p><label><input type="radio" name="protocol" value="both" checked> ${esc(t.both)}</label><br>
<label><input type="radio" name="protocol" value="openid4vp"> ${esc(t.oid)}</label><br>
<label><input type="radio" name="protocol" value="mdoc"> ${esc(t.mdoc)}</label></p>
<div class="row"><button class="btn" id="go" type="button">${esc(t.go)}</button><a class="btn secondary" href="/sample-site">${esc(t.sample)}</a></div>
<p id="status" class="muted"></p></div></section>
<section id="out" hidden><div id="outcome" class="result PENDING"></div>
<p class="small"><strong>${esc(t.response)}:</strong> <code id="proto"></code></p>
<p class="small"><strong>${esc(t.checks)}:</strong> <span id="checks"></span></p>
<p class="small"><strong>${esc(t.disclosed)}:</strong> <span id="disclosed"></span></p>
${o.showValues ? `<div class="panel"><h2>${esc(t.claims)}</h2><table id="claims"></table></div>` : ""}
<details><summary>${esc(t.trace)}</summary><ol id="trace" class="small"></ol></details></section>
<section><details><summary>${esc(t.requests)}</summary><pre id="reqs"></pre></details><p class="muted small">${esc(t.note)}</p></section>
<script>
(function(){
const M=${jsLit(t)};const $=(i)=>document.getElementById(i);
const setText=(i,v)=>{$(i).textContent=v;};
const has="DigitalCredential" in window&&!!navigator.credentials;
setText("sup",has?M.supported:M.unsupported);
if(!has){$("go").disabled=true;}
const P=["openid4vp-v1-signed","org-iso-mdoc"];
for(const p of P){const li=document.createElement("li");let s=M.protoUnknown;try{if(has&&typeof DigitalCredential.userAgentAllowsProtocol==="function")s=DigitalCredential.userAgentAllowsProtocol(p)?M.protoYes:M.protoNo;}catch(e){}li.textContent=p+" — "+s;$("protos").appendChild(li);}
const pick=(n)=>document.querySelector('input[name="'+n+'"]:checked').value;
const show=(r,proto)=>{$("out").hidden=false;const o=$("outcome");o.className="result "+(r.outcome||"PENDING");o.textContent=(r.outcome||"")+(r.failed_step?" · "+r.failed_step+": "+(r.failed_reason||""):"");
setText("proto",proto||"");setText("checks",(r.checks||[]).join(", "));setText("disclosed",(r.disclosed||[]).join(", "));
const tb=$("claims");if(tb){tb.textContent="";for(const [k,v] of Object.entries(r.claims||{})){const tr=document.createElement("tr");const a=document.createElement("th");a.textContent=k;const b=document.createElement("td");b.textContent=typeof v==="string"?v:JSON.stringify(v);tr.append(a,b);tb.appendChild(tr);}}
const ol=$("trace");ol.textContent="";for(const s of r.trace||[]){const li=document.createElement("li");li.textContent=s;ol.appendChild(li);}};
const poll=async(t,proto,n)=>{const r=await fetch("/dc-api-test/result/"+encodeURIComponent(t)).then((x)=>x.json()).catch(()=>({}));if(r.state==="DONE"){setText("status","");show(r,proto);return;}if(n<40)setTimeout(()=>poll(t,proto,n+1),1500);};
$("go").onclick=async()=>{
$("out").hidden=true;setText("status",M.preparing);setText("reqs","");
let s;try{const r=await fetch("/dc-api-test/start",{method:"POST",headers:{"content-type":"application/json"},body:JSON.stringify({policy:pick("policy"),protocol:pick("protocol"),origin:location.origin})});s=await r.json();if(!r.ok)throw new Error(s.reason||s.error||("HTTP "+r.status));}catch(e){setText("status",e.message);return;}
setText("reqs",JSON.stringify(s.requests,null,2));setText("status",M.waitingWallet);
let cred;try{cred=await navigator.credentials.get({digital:{requests:s.requests},mediation:"required"});}catch(e){setText("status",M.cancelled+(e&&e.name?e.name+" — ":"")+(e&&e.message||""));return;}
if(!cred){setText("status",M.cancelled+"null");return;}
let data=cred.data;if(typeof data==="string"){try{data=JSON.parse(data);}catch(e){}}
const proto=cred.protocol||(s.requests.length===1?s.requests[0].protocol:"");
const target=s.response_uris[proto];const resp=data&&data.response;
if(!target||typeof resp!=="string"){setText("status",M.cancelled+"unexpected answer ("+proto+")");return;}
setText("status",M.forwarding);
const pr=await fetch(target,{method:"POST",headers:{"content-type":"application/x-www-form-urlencoded"},body:"response="+encodeURIComponent(resp)}).catch((e)=>({ok:false,status:0,e}));
setText("status",M.verifying+(pr.ok?"":" (HTTP "+pr.status+")"));poll(s.t,proto,0);};
})();
</script>`;
  return page(lang, t.title, body);
}
