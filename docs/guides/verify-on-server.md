---
document_id: GUIDE-0002
title: "Sunucuda doğrulama"
status: Active
version: 1.0.0
created: 2026-09-27
last_updated: 2026-10-07
summary: >
  Kendi sunucunuzda Tamga belgesi doğrulamak: güven kaynağını yükleme, iptal listesi ön çekimi, politika → imzalı OpenID4VP isteği,
  şifreli yanıtı çözme ve kanonik doğrulama hattı (T0 + A–E). Referans uygulama: apps/verify.
---

# Sunucuda belge doğrulama

Bu rehber, Tamga [[t:credential|belgelerini]] barındırılan [[t:verifier|doğrulayıcıya]] gitmeden **kendi sunucunuzda**
doğrulamak isteyen geliştiriciler içindir:
işe alım, kampüs girişi, yaş kontrolü, bilet kapısı.

**Ne zaman okunur:** belge değerlerinin hiçbir aracıya uğramamasını istediğinizde ya da doğrulamayı kendi altyapınızda
yönetmek istediğinizde. Daha hızlı bir başlangıç için barındırılan doğrulayıcı: [[GUIDE-0001]]. Çalışan kod: [[GUIDE-0004]] §2.

## Nasıl çalışır?

1. Sunucunuz ne istediğini bir **politika** ile tanımlar (ör. "diploma: ad, bölüm, mezuniyet yılı") ve imzalı bir istek üretir.
   İstek QR ya da bağlantı olarak gösterilir; içinde kişisel veri yoktur.
2. Kişi cüzdanında isteği görür, onaylar; cüzdan cevabı **şifreli** olarak sunucunuza gönderir.
3. Sunucunuz cevabı çözer ve doğrulama hattını çalıştırır: imza, [[t:trust-list|güven listesi]], [[t:revocation|iptal]] durumu, süre,
   [[t:holder-binding]] ve politika.
4. Sonuç üç değerden biridir: kabul, ret ya da "şu an doğrulanamadı".

`@tamga-network/verifier` bu hattın tamamını uygular ([[SPEC-API-0001]], adımlar T0 + A–E). Referans doğrulayıcı `apps/verify`
(verify.tamga.network) aynı kütüphaneyi kullanır; aşağıdaki adımların tamamı orada çalışır hâlde.

## Hazırlık

1. **Doğrulayıcı kaydı.** Tamga güven listesinde bir doğrulayıcı kaydınız olur: kalıcı kimliğiniz alan adınızdır (`dns_name`),
   istemci kimliğiniz [[t:x509_hash|x509_hash:…]] biçimindedir (liste yayıncısı bunu [[t:access-certificate|erişim sertifikanızdan]]
   hesaplar), ayrıca X.509 sertifikanız
   ve isteyebileceğiniz alanların kapsamı kayıtlıdır. İsteğiniz bu kapsamı aşarsa cüzdan reddeder.
2. **Güven kaynağı.** `@tamga-network/trust` ile güven listelerini yükleyin: `loadTrustSourceFromDir(dist)` ya da düzenli
   indirme + yeniden yükleme (`guardedReload`). Güvenle ilgili her soruyu yalnızca `TrustSource`'a sorun.
3. **İptal listelerini önceden çekin.** `new PrefetchStatusCache()` + düzenli `refresh(uriler)`. Doğrulama anında ağa çıkılmaz.

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

İstemci kimliği `x509_hash` biçimindedir (HAIP 1.0 §5); `pemRpSigner(anahtar, sertifika)` onu sertifikadan hesaplar
([[ADR-0034]]). Sertifikayı yenilerken önce yeni sertifika güven listesine girer, sonra sunucunuz yenisine geçer.

## Sonucu yorumlama

| `outcome` | Anlamı | Kullanıcıya |
|---|---|---|
| `ACCEPTED` | tüm adımlar geçti | yalnızca `claims` içindeki onaylanan alanları kullanın |
| `REJECTED` | belge geçersiz (imza, iptal, süre, bağ, politika) — `failed_step` hangi adımda takıldığını söyler | "Belge kabul edilmedi" |
| `INDETERMINATE` | altyapı ya da tazelik sorunu (ör. D2/D4/D5 adımlarında `STATUS_STALE`) — belge kötü değil | "Şu an doğrulanamadı, tekrar deneyin" |

`checks_performed` / `checks_skipped` denetim için saklanabilir; **kişisel veri saklamayın**. Saat kayması toleransı
`policy.freshness.max_clock_skew_sec` ile ayarlanır (varsayılan 120 sn).

## Kontrol listesi

- [[t:nonce|Nonce]] tek kullanımlıktır; aynı yanıt ikinci kez işlenmez.
- Politika yalnızca gereken alanı ister; yaş için [[t:mdoc]] `age_over_18` gibi tek bir alan yeterlidir.
- [[t:status-list|İptal listesi]] ön çekimi ve güven listesi yenilemesi çalışıyor olmalı. Çalışmıyorsa sonuçlar `INDETERMINATE` olur — bu doğru davranıştır.

## Derinlik: sıfır bilgi ispatıyla yaş doğrulama (`mso_mdoc_zk`)

"18 yaşından büyük mü?" sorusunu belgeyi, doğum tarihini, kurum imzasını ve cihaz anahtarını görmeden sorabilirsiniz
([[ADR-0032]]). Cüzdan [[t:Longfellow-ZK]] ile bir ispat üretir; siz yalnızca "kayıtlı bir kurumun kimlik belgesinde
`age_over_18 = true`" bilgisini öğrenirsiniz. Aynı kişinin iki gösterimi birbirine bağlanamaz.

```ts
const policy: Policy = {
  policy_id: "age-over-18-zk",
  purpose: { "en-US": "Over-18 check — yes/no only" },
  credentials: [{
    // ADR-0044: ZK yalnız kimlik belgesinin kısa ömürlü ZK kopyasıyla (≤ 24 saat, iptal listesi yok)
    id: "identity", vct_values: ["urn:tamga:id:ShortLivedIdentityAttestation:1"],
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

- **Doğrulama paketle gelen WebAssembly ile çalışır;** Rust ya da yerel derleme gerekmez. Bir doğrulama masaüstünde ~3 sn sürer.
- **Çok yüksek hacim için yerel arka uç:** `packages/verifier/zk` kaynağından `cargo build --release --locked --features native
  --bin tamga-zk-verify` (Rust 1.98.1, Linux/macOS), sonra `new NativeZkBackend({ binPath })` ya da ortamdan
  `zkBackendFromEnv()` (`TAMGA_ZK_NATIVE_BIN`) → `VerifyInput.zk`. Doğrulama ~0,2–0,3 sn sürer; ikili yanıt vermezse WASM'a düşer.
- **Yeni adım `Z1`:** devre imzalı listede mi, yalnızca istenen öğe mi açıklandı, zaman damgası taze mi, ispat geçerli mi?
  Kurum imzası, cihaz imzası ve geçerlilik ispatın içinde denetlenir (`checks_skipped`: A4–A7). İptal durumu gelmez
  (`status.value: NOT_APPLICABLE`, nedeni `status.reason`'da). ZK ile yalnız kimlik belgesinin kısa ömürlü kopyası sunulur
  ([[ADR-0044]]): en çok 24 saat geçerlidir, iptal edilen belgenin kopyası yenilenmez; ispat kopyanın türünü bağladığı için
  doğrulayıcı kısa ömrü görür ve iptal denetimi beklemez. İptal ZK'da en geç 24 saatte etkili olur; anında iptal görmeniz
  gerekiyorsa klasik `mso_mdoc` politikasını kullanın.
- **`accept_unrevocable_zk`:** yalnız kısa ömürlü kopya OLMAYAN (işaretsiz) ZK sunumu içindir. `true` iptali denetlenemeyen
  böyle bir sunumu bilerek kabul eder; `false` ya da alan yoksa (0.3.1'den beri varsayılan) işaretsiz ZK sunumu
  `INDETERMINATE` döner (adım `D1`, `STATUS_UNREACHABLE`).
- **Yedek yol:** cüzdan ZK desteklemiyorsa sorgunuz eşleşmez; aynı soruyu klasik `mso_mdoc` politikasıyla
  (`age-over-18-mdoc`) sorun. Cüzdan tarafı: `@tamga-network/zk` (Android yerel kütüphanesi hazır, iOS bekliyor); ispatçısı
  olmayan cüzdan klasik yolu kullanır (ZK5).

## Kurallar

| Kod | Ne der |
|---|---|
| [[SPEC-API-0001]] AP2 | `INDETERMINATE`, `REJECTED` ile aynı kovaya konmaz |
| [[SPEC-API-0001]] AP3–AP4 | sonuç ve kayıtlar alan değerlerini ve iptal indeksini taşımaz |
| [[SPEC-API-0001]] AP6 | istek, doğrulayıcı kaydının kapsamını aşamaz |
| Tek güven arayüzü | güven verisi yalnızca `TrustSource` üzerinden okunur |
| [[SPEC-CRED-0003]] S12 | doğrulama başına iptal listesi çekilmez; toplu ön çekim kullanılır |
| [[SPEC-PROTO-0002]] PV10 | `nonce` tek kullanımlıktır |
| [[ADR-0032]] ZK2, ZK5 | yalnızca imzalı listedeki devreler kabul edilir; ZK yoksa klasik yol |
