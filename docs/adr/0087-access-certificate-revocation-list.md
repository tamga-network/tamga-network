---
document_id: ADR-0087
title: "Erişim sertifikası iptal listesi"
status: Active
review_status: Completed
version: 1.0.0
created: 2026-11-15
last_updated: 2026-11-15
summary: >
  Doğrulayıcı erişim sertifikaları (WRPAC, X.509) için RFC 5280 iptal listesi (CRL) yayımlanır. Doğrulayıcının kaydı askıya
  alınınca ya da iptal edilince erişim sertifikası aynı yayında kesin olarak iptal edilir (ETSI TS 119 411-8 REV-6.3.9-04;
  askı için de `certificateHold` kullanılmaz), kayıt sona erince ve sertifika yenisiyle değişince de iptal edilir. CRL'i
  sertifikayı veren makam imzalar; kök çevrim dışı kaldığı için erişim sertifikaları kökçe imzalı, anahtarı liste yayıncısında
  duran bir erişim sertifikası makamından verilir ve onun CRL'i her yayında ve saatte bir yeniden imzalanır (nextUpdate 24
  saat). Adres yeni alt alan adı açmadan güven listesi alan adının altındadır: `/crl/<makam>.crl`. Kayıt sertifikaları (WRPRC)
  CRL'e girmez; iptalleri ADR-0068'in durum listesinde kalır. Tamga cüzdan çekirdeği ve doğrulayıcı imzalı listeyi esas alır,
  CRL'i ayrıca çekmez; CRL AB cüzdanları ve PKIX doğrulayıcıları içindir. Kabul: 2026-11-15.
domain: Trust
related: ["[[ADR-0024]]", "[[ADR-0026]]", "[[ADR-0034]]", "[[ADR-0056]]", "[[ADR-0058]]", "[[ADR-0068]]", "[[ADR-0075]]", "[[SPEC-ID-0002]]", "[[SPEC-TRUST-0001]]", "[[FW-POL-0003]]", "[[FW-TF-0001]]"]
---

# Kısaca

Bir doğrulayıcı ağda iki sertifika taşır: kim olduğunu gösteren erişim sertifikası (X.509) ve neyi isteyebileceğini gösteren
kayıt sertifikası. Kayıt sertifikasının bir iptal listesi vardı ([[ADR-0068]]); erişim sertifikasının yoktu. Doğrulayıcı askıya
alınınca Tamga cüzdanı onu imzalı listeden tanıyıp reddediyordu, ama sertifikayı yalnız X.509 yoluyla denetleyen bir AB cüzdanı
sertifikayı hâlâ geçerli görürdü. Bu kararla erişim sertifikaları için standart bir iptal listesi (CRL) yayımlanır ve askı,
iptal ya da sona erme anında sertifika o listeye girer.

# Bağlam

- **AB kuralı.** ETSI TS 119 411-8 V1.1.1 §6.3.9: erişim sertifikası sağlayıcısı doğrulayıcının kaydını izler ve kayıt
  **askıya alınınca ya da iptal edilince erişim sertifikasını iptal eder** (REV-6.3.9-02/03/04). İptal durumu bilgisi ve CRL
  profili EN 319 411-1'e bağlanır (REV-6.3.9-01, CSS-6.6.2-01). EN 319 411-1'in metni kütüphanede değil; aşağıdaki süreler bilinen
  üst sınırların altında seçildi.
- **RFC 5280.** CRL v2 (§5), `nextUpdate` bu profilde zorunlu (§5.1.2.5), Authority Key Identifier (§5.2.1) ve CRL Number
  (§5.2.3) uzantıları, girdi başına reasonCode (§5.3.1). CRL'i sertifikayı veren makam imzalar; başka bir imzacı yalnız dolaylı
  CRL (indirect CRL, `cRLIssuer` + `indirectCRL`) ile mümkündür ve doğrulayıcılarda desteği zayıftır. Sertifika CRL'in yerini
  CRL Distribution Points uzantısıyla (§4.2.1.13) gösterir.
- **AB uyum turu (2026-11-15, öneri 4; KA-411-8-1).** AB referans cüzdan kütüphanesi erişim sertifikasında PKIX iptal denetimi
  yapıyor; bizim sertifikamız iptal yolu göstermediği için ya hiç denetlenemiyor ya da (sıkı kipte) reddedilebilir.
- **Bugün.** Erişim sertifikalarını çevrim dışı kök doğrudan verir ([[ADR-0058]]); kökün anahtarı yalnız operatörün gizli
  klasöründedir, sunucuda yoktur. Doğrulayıcının durumu (`ACTIVE`/`SUSPENDED`/`REVOKED`/`RETIRED`) imzalı listededir; Tamga
  cüzdan çekirdeği isteği imzalayan yaprağı listedeki parmak iziyle eşler ve etkin olmayan kaydı reddeder. Kayıt sertifikası
  askıda ve iptalde [[ADR-0068]] K4 ile durum listesinde iptal edilir.
- **Proje yönetiminin yönü.** İptal yolu olarak CRL seçildi (OCSP değil); yayın adresi yeni alt alan adı açılmadan mevcut güven
  listesi alan adının altında bir yol olacak; ad onayı ayrıca.

# Karar

## K1 — Kapsam: hangi sertifika hangi yoldan iptal edilir

| Sertifika | Biçim | İptal yolu |
|---|---|---|
| Erişim sertifikası (WRPAC) | X.509 | **CRL** (bu karar) |
| Kayıt sertifikası (WRPRC) | JWT / CWT (ETSI TS 119 475) | Token Status List ([[ADR-0068]]) — değişmedi |
| Belge veren sertifikası | X.509 | imzalı listedeki kurum durumu (C1/C2); bu kararın kapsamı dışında |

Her sertifika türünün tek bir iptal yolu vardır. CRL yalnız X.509 seri numarası taşır; kayıt sertifikası CRL'e girmez.
Doğrulayıcı askıya alınınca aynı yayında iki şey olur: kayıt sertifikaları durum listesinde, erişim sertifikası CRL'de iptal
edilir. Tetik tektir (kayıt defterindeki durum değişikliği), çıktılar ayrıdır.

## K2 — Erişim sertifikası makamı

- CRL'i, sertifikayı veren makam imzalar (doğrudan CRL). Kök çevrim dışı kaldığı için erişim sertifikaları **erişim sertifikası
  makamından** (`access-ca-1`) verilir: kökçe imzalı ara makam; basicConstraints CA, yol uzunluğu 0 (kritik); keyUsage
  keyCertSign + cRLSign (kritik); SKI; AKI = kökün SKI'si; kendi CRL dağıtım noktası kökün CRL'i. Yalnız erişim sertifikası verir.
- Makamın anahtarı liste yayıncısında, kayıt kurumu anahtarıyla aynı korumada durur. Kök anahtarı yayıncıya gitmez.
- Kökün kendi CRL'i (ara makamları ve geçiş döneminde kökün doğrudan verdiği erişim sertifikalarını kapsar) kökün durduğu
  bilgisayarda imzalanır (`ops/gen-pki.ts --root-crl`); `nextUpdate` en çok 365 gün; ara makam ya da kökün verdiği bir erişim
  sertifikası iptal edilince hemen yeniden imzalanır. Yayıncı bu kopyayı denetler (makam imzası, düzenleyen ad, süre, gerekli
  seri numaraları) ve yayımlar; eksik ya da süresi dolmuş kopyada alarm verir.
- Geçiş: bugünkü, kökün doğrudan verdiği erişim sertifikaları süreleri dolana ya da yenilenene kadar kökün CRL'iyle kapsanır;
  yenilenirken erişim sertifikası makamından verilir (aynı anahtarla yenileme [[ADR-0058]] gibi; `client_id` değişir, kalıcı
  kimlik `dns_name` değişmez — [[ADR-0034]], [[ADR-0075]]). İstek nesnesinin `x5c`'si yapraktan sonra ara makamı taşır (kök hariç).

## K3 — Adres ve dağıtım noktası

- Adres yayın kökünde, yeni alt alan adı olmadan: `<güven listesi alan adı>/crl/<makam>.crl`. Gerçek ağ
  `https://trust.tamga.network/crl/access-ca-1.crl` ve `…/crl/root-ca.crl`; sandbox `https://trust.sandbox.tamga.network/crl/…`.
- Biçim DER, yanıt türü `application/pkix-crl` (RFC 2585), herkese açık, CORS açık.
- Her erişim sertifikası ve erişim sertifikası makamının sertifikası, verenin CRL'ini gösteren tek dağıtım noktalı, kritik olmayan
  CRL Distribution Points uzantısı (2.5.29.31) taşır (`cRLIssuer` ve `reasons` yok).
- Ayar kayıt defterinde `national_lists[].roles.access_ca.crl` (`issuers[{ca, uri}]`); yayıncının iç ayarıdır, LOTL'e yazılmaz.
  Ayar yoksa CRL üretilmez.

## K4 — CRL profili ve tazelik

- v2, ES256 (ecdsa-with-SHA256), düzenleyen = makamın konu adı (bayt bayt aynı), AKI = makamın SKI'si, CRLNumber (makam başına
  tekdüze artar), girdi başına reasonCode.
- Anahtarı yayıncıda duran makamın CRL'i **her yayında ve her saatlik heartbeat'te** yeniden imzalanır; `nextUpdate` =
  `thisUpdate` + 24 saat. Böylece yayıncı bir gün dursa bile CRL süresi geçmiş görünür (doğrulayıcı bayat bilgiyle geçerli saymaz).
- Durum yayın klasöründe kalıcıdır (`access-crl-state.json`: makam başına CRL numarası, görülen sertifikalar, iptaller; kişisel
  veri yok). Dosya kaybolursa durum yayımlanmış CRL'den kurulur (iptaller CRL'in kendisinde imzalıdır).

## K5 — İptal tetikleri

| Olay | reasonCode |
|---|---|
| Doğrulayıcının kaydı askıya alındı (`SUSPENDED`) ya da iptal edildi (`REVOKED`) | `privilegeWithdrawn` (9) |
| Kayıt sona erdi (`RETIRED`) | `cessationOfOperation` (5) |
| Erişim sertifikası kayıttan kalktı (yenisiyle değişti) ve süresi dolmadı | `superseded` (4) |
| Elle iptal (`crl-revoke`; ör. anahtar ele geçirildi) | `keyCompromise` (1), `affiliationChanged` (3), `superseded`, `cessationOfOperation`, `privilegeWithdrawn` |

- İptal otomatik ve aynı yayındadır (REV-6.3.9-04). İptal edilen sertifika listeden çıkmaz.
- Elle iptal isteği [[ADR-0068]] K4'teki yoldan doğrulanır (kayıt kurumu, doğrulayıcının kendisi ya da yetkili kamu makamı,
  REV-6.2.4-02/03); herkese açık değişiklik kaydına seri numarası, alan adı ve gerekçe kodu yazılır, kişi adı yazılmaz.

## K6 — Askı için kesin iptal (`certificateHold` yok)

- Askıya alınan kaydın erişim sertifikası **kesin olarak iptal edilir**; RFC 5280'in geri alınabilir `certificateHold` gerekçesi
  kullanılmaz. Kayıt yeniden etkin olunca doğrulayıcıya yeni erişim sertifikası verilir (aynı anahtar olabilir, yeni seri numarası).
- Etkin (`ACTIVE`) bir kayıt iptal edilmiş bir erişim sertifikasını gösteremez: yayıncı bu durumda liste imzalanmadan yayını
  durdurur.

## K7 — Kim denetler

- **Tamga cüzdan çekirdeği ve doğrulayıcı CRL'i çekmez.** Erişim sertifikasının güvenini imzalı listedeki kayıttan (parmak izi +
  durum) alırlar; CRL aynı kayıt defteri durumundan üretilir, yeni bilgi taşımaz. İkinci denetim ağ isteği, gecikme ve
  "hangi doğrulayıcıyla konuşuluyor" sızıntısı ekler, güvenlik kazancı yoktur.
- CRL **AB cüzdanları ve PKIX doğrulayıcıları** içindir: erişim sertifikasını yalnız X.509 zinciriyle denetleyen bir cüzdan
  askıdaki doğrulayıcıyı CRL'den görür.
- Doğrulama hattında belge veren sertifikası için CRL/OCSP adımı (A3c) bugünkü gibi atlanır (belge verenin durumu listede).

## K8 — Yayılım

- Sandbox: erişim sertifikası makamı, ayar, CRL ve nginx yanıt türü bugünden (makamın anahtarı sandbox sunucusuna yüklenince CRL orada imzalanır); yeni erişim sertifikaları makamdan verilir.
- Gerçek ağ: makam sertifikası kökün töreninde verilir, anahtarı yayıncıya konur, kökün CRL'i imzalanır, ağın kendi doğrulayıcısının
  erişim sertifikası makamdan yenilenir ve ayar eklenir — yol adları onaylandıktan sonra. Ayar eklenmeden gerçek ağın yayını
  değişmez.

# Değerlendirilen seçenekler

| Seçenek | Sonuç | Neden |
|---|---|---|
| OCSP | ret | Sürekli çevrim içi yanıtlayıcı ve imza anahtarı ister; her denetimde hangi sertifikanın sorulduğunu sunucuya söyler (gizlilik); AB cüzdanları CRL'i de okur |
| Bugünkü yol (yalnız listeden düşürme) + gerekçe | ret | REV-6.3.9-04 sertifikanın iptalini ister; X.509 yolunu izleyen cüzdan askıyı göremez |
| Kökün doğrudan imzaladığı CRL, yalnız törenle | ret | Askı anında iptal için her seferinde çevrim dışı tören gerekir; "aynı yayında" kuralı tutulamaz |
| Dolaylı CRL ya da ayrı CRL imzacısı (aynı ad, başka anahtar) | ret | RFC 5280'de var ama doğrulayıcılarda desteği zayıf ve tutarsız; birlikte çalışma riski |
| Askıda `certificateHold` | ret | Geri alınabilir iptal; birçok doğrulayıcı onu ya hiç işlemez ya kesin iptal sayar; ETSI ve [[ADR-0068]] askıda iptal der |
| Tamga cüzdanında da CRL denetimi | ret | Aynı bilgi imzalı listede; çift denetim ağ isteği ve sızıntı ekler |
| **Çevrim içi erişim sertifikası makamı + doğrudan CRL, 24 saat + kökün yıllık CRL'i** | **seçildi** | Standart PKI düzeni (çevrim dışı kök, çevrim içi veren makam); askı aynı yayında; ek protokol yok |

# Değişmezler

| Kod | Kural |
|---|---|
| AR1 | Doğrulayıcının kaydı askıya alınınca, iptal edilince ya da sona erince erişim sertifikası aynı yayında CRL'e girer; askı için de kesin iptal kullanılır (`certificateHold` yok) ve iptal edilen sertifika listeden çıkmaz. |
| AR2 | Bu karardan sonra verilen erişim sertifikası verenin CRL'ini gösteren CRL Distribution Points uzantısını taşır; çevrim içi makamın CRL'i en geç 24 saatte bir yeniden imzalanır (nextUpdate ≤ 24 saat). |
| AR3 | Etkin bir doğrulayıcı kaydı iptal edilmiş bir erişim sertifikasını gösteremez; yayıncı bu durumda liste imzalanmadan yayını durdurur. |
| AR4 | Kayıt sertifikası CRL'e girmez; her sertifika türünün tek iptal yolu vardır (erişim sertifikası CRL, kayıt sertifikası [[ADR-0068]] durum listesi). |
| AR5 | Tamga cüzdan çekirdeği ve doğrulayıcı erişim sertifikasının güvenini imzalı listeden alır; CRL onlar için ek ya da alternatif bir güven kaynağı değildir. |

# Sonuçlar

- `apps/trust-publisher`: `src/access-crl.ts` (iptal planı, CRL imzası ve denetimi, durum kurtarma), `build` ve `heartbeat`
  bağlantısı, `crl-status`, `crl-revoke`; `roles.access_ca.crl` TL11 izin listesinde ve LOTL'e yazılmaz.
- `ops/gen-pki.ts`: `access-ca-1` (geliştirme ve sandbox), erişim sertifikalarında CRL dağıtım noktası, `--root-crl`.
  `ops/pki-issue.ts`: `--ca`, `--crl-uri` (gerçek ağda erişim sertifikasında zorunlu), ara makamın sertifikası `<ad>.chain.pem`.
- Operatör: nginx `trust.*` bloklarında `/crl/` (`application/pkix-crl`).
- Belgeler: [[SPEC-TRUST-0001]] §2 ve sürüm notu.
- Gerçek ağda yapılacaklar K8'de; yol adları (`/crl/`, `access-ca-1.crl`, `root-ca.crl`) ve makamın konu adı onay bekler.

# Durum

**Accepted — 2026-11-15** (proje yönetimi onayı; birebir alıntı özel onay kaydında). DECISIONS: D-REG-5.
AR1–AR5 bağlayıcıdır. Sandbox'ta yürürlükte; gerçek ağda yol adları onaylanınca (K8).
