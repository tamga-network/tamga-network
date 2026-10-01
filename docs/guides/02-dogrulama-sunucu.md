---
document_id: GUIDE-0002
title: Sunucuda Belge Doğrulama (@tamga-network/verifier)
category: Guide
domain: Integration
status: Draft
review_status: Draft
version: 0.2.2
created: 2026-09-27
last_updated: 2026-10-01
authors:
  - Tamga Network Engineering
tags: [guide, verifier, openid4vp, sd-jwt, mdoc, status-list]
keywords: [verifyPresentation, createPresentationRequest, decryptResponse, PrefetchStatusCache, TrustSource]
summary: >
  Kendi sunucunuzda Tamga belgesi doğrulamak: güven kaynağını yükleme, status list ön çekimi, politika → imzalı OpenID4VP isteği,
  şifreli yanıtı çözme ve kanonik doğrulama hattı (T0 + A–E). Referans uygulama: apps/verify.
priority: High
language: tr
audience: [integrators, engineers]
related: ["[[SPEC-API-0001]]", "[[SPEC-PROTO-0002]]", "[[SPEC-TRUST-0001]]", "[[GUIDE-0001]]"]
---

> **Sürüm notu 0.2.2 (2026-10-01) — [[ADR-0034]] (D-PROTO-2):** istemci kimliği `x509_hash` (HAIP 1.0 §5), `pemRpSigner(anahtar, sertifika)` hesaplar. Sertifika yenilerken önce yeni sertifika güven listesine girer, sonra sunucu geçer.

# Sunucuda belge doğrulama

`@tamga-network/verifier`, [[SPEC-API-0001]]'deki kanonik doğrulama hattını (T0 + A–E) uygular ve üç değerli sonuç döndürür.
Referans uygulama `apps/verify` (verify.tamga.network) bu kütüphaneyi kullanır; aşağıdaki adımların tamamı orada çalışır hâlde.

## Hazırlık
1. **RP kaydı:** Tamga güven listesinde doğrulayıcı kaydınız (kalıcı kimlik `dns_name` = alan adınız; `client_id` = `x509_hash:…`, liste yayıncısı erişim sertifikanızdan hesaplar), X.509 sertifikanız
   ve izinli alan kapsamınız. İsteğiniz kapsamı aşarsa cüzdan reddeder (AP6).
2. **Güven kaynağı:** `@tamga-network/trust` → `loadTrustSourceFromDir(dist)` ya da periyodik indirme + yeniden yükleme
   (`guardedReload`). Güven sorusu yalnızca `TrustSource` üzerinden sorulur (BT4).
3. **Status ön çekimi:** `new PrefetchStatusCache()` + düzenli `refresh(uriler)` — doğrulama anında ağ çağrısı yapılmaz (S12).

## Akış
```ts
import { dcqlFromPolicy, createPresentationRequest, decryptResponse, verifyPresentation, pemRpSigner,
         PrefetchStatusCache, type Policy } from "@tamga-network/verifier";

const policy: Policy = { policy_id: "ise-alim", /* credentials, trust, freshness */ } as Policy;
const signer = await pemRpSigner(RP_KEY_PEM, RP_CERT_PEM); // client_id = x509_hash (sertifikadan)
// 1) istek: QR / derin bağlantı olarak gösterilir (kişisel veri yok; yalnızca request_uri)
const req = await createPresentationRequest({ signer, dcql: dcqlFromPolicy(policy),
  responseUri: "https://ornek.com.tr/vp/response", requestUriBase: "https://ornek.com.tr/vp/req" });
// 2) cüzdan şifreli yanıtı response_uri'ye POST eder → çöz
const resp = await decryptResponse(jweBody, req.encPrivateKey); // istekle üretilen anahtar; req.state ile eşleştirin
// 3) doğrula (SD-JWT; mdoc için format: "mso_mdoc" + responseUri)
const { result, claims } = await verifyPresentation({ presentation: resp.vp_token["diploma"][0], aud: signer.clientId, nonce: req.nonce,
  policy, policyCredentialId: "diploma", trust, statusCache, rootCertsDer, rp: trust.relyingParty(signer.clientId) });
```
Alan adları ve imzalar paket tiplerinde tanımlıdır; tam çalışan örnek `apps/verify/src/routes/presentations.ts`.

## Sonucu yorumlama
| `outcome` | Anlamı | Kullanıcıya |
|---|---|---|
| `ACCEPTED` | tüm adımlar geçti | yalnızca `claims` içindeki onaylanan alanları kullanın |
| `REJECTED` | belge geçersiz (imza, iptal, süre, bağ, politika) — `failed_step` hangi adım | "Belge kabul edilmedi" |
| `INDETERMINATE` | altyapı/tazelik sorunu (ör. D2/D4/D5 `STATUS_STALE`) — belge kötü değil | "Şu an doğrulanamadı, tekrar deneyin" |

`checks_performed` / `checks_skipped` denetim için saklanabilir; **kişisel veri saklamayın** (AP3/AP4). Saat kayması toleransı
`policy.freshness.max_clock_skew_sec` (varsayılan 120 sn).

## Sıfır bilgi ispatıyla yaş doğrulama (`mso_mdoc_zk`)
"18 yaşından büyük mü?" sorusunu belgeyi, doğum tarihini, kurum imzasını ve cihaz anahtarını görmeden sorabilirsiniz
([[ADR-0032]]). Cüzdan Longfellow ZK ile ispat üretir; siz yalnız "kayıtlı bir kurumun kimlik belgesinde `age_over_18 = true`"
öğrenirsiniz. Aynı kişinin iki gösterimi birbirine bağlanamaz.

```ts
const policy: Policy = {
  policy_id: "age-over-18-zk",
  purpose: { "en-US": "Over-18 check — yes/no only" },
  credentials: [{
    id: "identity", vct_values: ["urn:tamga:id:IdentityAttestation:1"],
    format: "mso_mdoc_zk", namespace: "tamga.id.1",
    required_claims: ["age_over_18"], constraints: { age_over_18: true }, // yalnız eşitlik
  }],
  trust: { ... }, freshness: { ... },
};
// İstek: kabul edilen devreler imzalı listeden (ZK2)
const dcql = dcqlFromPolicy(policy, { zkCircuits: trust.zkCircuits?.() ?? [] });
// Yanıt: vp_token.identity[0] = base64url(DeviceResponse{ zkDocuments })
const { result } = await verifyPresentation({ presentation, format: "mso_mdoc_zk", responseUri, aud, nonce,
  policy, policyCredentialId: "identity", trust, statusCache, rootCertsDer });
```

- **Doğrulama paketle gelen WebAssembly ile** çalışır (Rust ya da yerel derleme gerekmez); bir doğrulama masaüstünde ~3 sn.
  Çok yüksek hacim için yerel arka uç: `packages/verifier/zk` kaynağından `cargo build --release --locked --features native
  --bin tamga-zk-verify` (Rust 1.98.1, Linux/macOS), sonra `new NativeZkBackend({ binPath })` ya da ortamdan
  `zkBackendFromEnv()` (`TAMGA_ZK_NATIVE_BIN`) → `VerifyInput.zk`. Doğrulama ~0,2–0,3 sn; ikili yanıt vermezse WASM'a düşer.
- Yeni adım **`Z1`**: devre imzalı listede mi, yalnız istenen öğe mi açıklandı, zaman damgası taze mi, ispat geçerli mi.
  Kurum imzası, cihaz imzası ve geçerlilik ispatın içinde denetlenir (`checks_skipped`: A4–A7). İptal durumu gelmez
  (`status: NOT_APPLICABLE`); ZK ile sunulan belgeler kısa ömürlüdür.
- **Yedek yol (ZK5):** cüzdan ZK desteklemiyorsa sorgunuz eşleşmez; aynı soruyu klasik `mso_mdoc` politikasıyla
  (`age-over-18-mdoc`) sorun. Tamga Wallet'ta ZK üretimi telefon sürümüyle gelir (Aşama 2).

## Kontrol listesi
- Nonce tek kullanım; aynı yanıt ikinci kez işlenmez (PV10).
- Politika yalnızca gereken alanı ister; yaş için mdoc `age_over_18` gibi tek alan yeterli.
- Status ön çekimi ve güven listesi yenilemesi çalışıyor (yoksa sonuçlar `INDETERMINATE` olur — bu doğru davranıştır).
