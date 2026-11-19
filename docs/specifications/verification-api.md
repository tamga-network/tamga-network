---
document_id: SPEC-API-0001
title: "Doğrulama hattı ve API"
status: Active
version: 1.0.0
created: 2026-09-09
last_updated: 2026-11-19
summary: >
  Doğrulamanın kanonik algoritmasını ve issuer/verifier servislerinin HTTP
  yüzeyini tanımlar. Merkezî katkı ADIM KODU KAYIT DEFTERİdir: A1…E4, dört
  spesifikasyona dağılmış doğrulama adımlarının tek normatif listesi. Bu kodlar
  `failed_step` alanında makine okunur biçimde taşınır, böylece "doğrulama
  başarısız" yerine "C2'de düştü — issuer bu şemaya yetkili değil" denebilir.
  İkinci kural: HTTP durum kodu doğrulama sonucunu KODLAMAZ — reddedilen bir
  credential başarılı bir API çağrısıdır; 4xx yalnızca taşıma/istek hatasıdır.
  Üçüncüsü: sonuç üç değerlidir ve INDETERMINATE ayrı bir sebep alanı taşır.
---

Bu şartname, bir [[t:credential|belgenin]] doğrulanırken geçtiği adımları tek bir sırada toplar ve barındırılan
[[t:verifier]] ile [[t:issuer]] servisinin HTTP arayüzünü tanımlar; doğrulayıcı ve kurum geliştiricileri içindir.

**Ne zaman okunur**

- Önce [Belge gösterme](/concepts/presentation) sayfasını, sonra [[GUIDE-0002]] rehberini okuyun.
- Barındırılan doğrulayıcıyı kullanıyorsanız §4'e, belge veren servisini kullanıyorsanız §5'e gidin.
- Bir sonuç kodunun (A1, C2, D5 gibi) anlamını arıyorsanız §1 tablosuna bakın.

**Kısaca**

Doğrulama beş katmanda ilerler: biçim (belge bozulmamış ve imzalı mı), şema (türü tanınıyor mu), güven (veren kurum
[[t:trust-list|güven listesinde]] ve bu türü vermeye yetkili mi), [[t:revocation]] (belge iptal edilmiş mi) ve politika
(doğrulayıcının istedikleri karşılanıyor mu). Her adımın kalıcı bir kodu vardır. Sonuç üç değerden biridir: geçerli, geçersiz ya da doğrulanamadı.
Doğrulanamadı, belgenin sahte olduğu anlamına gelmez; örneğin [[t:status-list]] o an güncel olmayabilir. HTTP durum kodu sonucu
taşımaz; sonuç her zaman yanıtın gövdesindedir.

---

# Kapsam

Bu şartname iki şeyi tanımlar:

1. **Kanonik doğrulama algoritması** — dört şartnameye dağılmış adımların
   tek normatif sırası ve kod kayıt defteri.
2. **Servis API yüzeyi** — belge veren ve doğrulayıcı servislerinin HTTP arayüzü.

Protokol uçları ([[SPEC-PROTO-0001]] OID4VCI, [[SPEC-PROTO-0002]] OID4VP)
burada tekrarlanmaz; bu doküman **servisin kendi** yönetim ve entegrasyon
yüzeyini tanımlar.

---

# 1. Adım Kodu Kayıt Defteri (Normatif)

Doğrulama beş katmanda ilerler. Bu tablo **kanoniktir**; [[ARCH-0003]] §4.1
onun özet görünümüdür. Beş katmandan önce bir ön adım (`T0`, §1.0), barındırılan doğrulayıcıda ayrıca bir takma ad adımı (`P1`,
§1.F) vardır (2026-11-19).

## 1.0 — Ön adım: güven kaynağı tazeliği ve politika biçimi

| Kod | Adım |
|---|---|
| `T0` | Belgeye bakılmadan önce çalışır. Politikanın tazelik sınırları (`max_trust_age_sec`, `max_status_token_age_sec`; verilmişse `max_clock_skew_sec` ≤ 600 ve `max_anchor_lag_sec`) eksik ya da geçersizse, güven bloğu (`require_recognition`, tanıma isteniyorsa iki harfli `state_code`, `min_issuer_assurance`, `allowed_categories`) ya da aralık kısıtları bozuksa, güven kaynağı sağlıksızsa (liste bayat ya da okunamıyor — [[ARCH-0003]]/CMP4) ya da yaşı politikanın `max_trust_age_sec`'ini aşıyorsa sonuç **her zaman** `INDETERMINATE`/`INDEXER_STALE`'dir; `T0` hiçbir zaman `REJECTED` vermez |

## 1.A — Format katmanı → [[SPEC-CRED-0002]] §8

| Kod | Adım |
|---|---|
| `A1` | Birleşik dizeyi `~` ile böl; KB-JWT var mı. A1 çağıranın yapılandırma hatalarını da taşır (2026-11-04): ör. `policyCredentialId` politikadaki bir belge değilse belgeye hiç bakılmadan, A adımlarından önce REJECTED (2026-11-19); Digital Credentials API yolunda verilen `aud` sayfa kökeninden türetilenle uyuşmuyor ya da `origin` ile `aud` = `client_id` birlikte verildi — açık iletiyle REJECTED |
| `A2` | Başlık: `alg=ES256`, `typ=dc+sd-jwt`, `x5c` var mı |
| `A3` | `x5c` zinciri + JWT imzası: yaprak, verilen güven çapalarından birine bağlanır (Tamga kök CA'sı ya da tazelik içindeki bir dış listenin çapası). Ara sertifikalar CA olmalı (`basicConstraints cA=true`), **KeyUsage uzantısını taşımalı ve içinde `keyCertSign` olmalı** (uzantısı olmayan ara sertifika RED) ve `pathLenConstraint`'i aşmamalı; `iat` 300 sn'den fazla ileri tarihliyse RED. Kök CA'nın durumu bu adımda değil **`C1`**'de denetlenir: kurumun bağlı olduğu kök, belgenin `iat`'ında `ACTIVE` ya da `ROLLING_OVER` olmalı ve hiç `REVOKED` olmamış olmalıdır ([[SPEC-ID-0002]] §3; sonradan emekli edilen kök, önce verilmiş belgeyi düşürmez; iptal edilmiş kökün belgesi `C1` koduyla reddedilir). Tek sertifikalık `x5c`'de yaprağın kendisi çapa olabilir (dış listedeki hizmet sertifikası, [[ADR-0036]]); `issuerId` yine yapraktan türer ve `C1` onu listede arar. Çağıran zincir denetimini bilerek kapattıysa (`rootCertsDer: "none"`, yalnız SD-JWT VC) A3 `checks_performed`'te değil `checks_skipped`'te görünür. **mdoc:** `x5chain` yaprağı ya listedeki bir çapanın (kök CA ya da dış listedeki hizmet sertifikası) kendisidir ya da doğrudan onunla imzalanmıştır — ara sertifika kabul edilmez (ISO/IEC 18013-5 Ek B: belge imzacısı sertifikası doğrudan IACA'dan verilir, yol uzunluğu 0; AB PID/EAA mdoc profilleri de bu zinciri kullanır) **mdoc `validityInfo.signed`** (imza anı; C1/C2 bu ana göre sorulur, SD-JWT `iat` muadili) saat payından ileride ise REDDEDİLİR; `validFrom` de ileride ise belge henüz geçerli değildir ve sonuç `A7`'dir (2026-11-19). |
| `A3b` | **`issuerId`, `x5c` yaprak sertifikasının parmak izinden türetilir** — `iss` claim'inden DEĞİL (§1.2). `iss` tutarlılık denetimi güven kaydını gerektirdiği için B adımlarından sonra, `C1`'den önce çalışır ve bu kodla raporlanır |
| `A3c` | Yaprak sertifika CRL/OCSP'de iptal edilmiş mi ([[SPEC-ID-0002]]) |
| `A3d` | `cnf` claim'i **mevcut** mu — yoksa RED (Tamga'da KB istisnasız zorunlu) |
| `A4` | `_sd_alg == "sha-256"` |
| `A5` | Her disclosure: **önce hash, sonra çöz**; digest `_sd`'de eşleşiyor mu |
| `A6` | KB-JWT: imza, `aud`, `nonce`, `iat`, `sd_hash` |
| `A7` | `exp` geçmiş ya da `nbf` gelmemiş mi mdoc: `validFrom` < `signed` ise REDDEDİLİR (ISO/IEC 18013-5 `validFrom` ≥ `signed`; 2026-11-19). |
| `A8` | Yinelenen digest / açıktaki claim ile çakışma yok mu |

**`Z1` — zero-knowledge proof (`mso_mdoc_zk`, [[ADR-0032]]):** devre imzalı listede ve dosya özeti eşleşiyor (ZK2); açıklanan
öğeler yalnız istenenler, tek ad alanında, devrenin öznitelik sayısıyla (ZK3); zaman damgası pencere içinde;
[[t:Longfellow-ZK]] ispatı geçerli. `mso_mdoc_zk` A-sırası: A1 çözme · A8 docType · A2 `msoX5chain` · A3 zincir + sertifika ispat anında geçerli · A3b ·
Z1. A4–A7 Z1 kapsamındadır.

## 1.B — Şema katmanı → [[SPEC-SCHEMA-0001]] §7

| Kod | Adım |
|---|---|
| `B1` | `vct` ve `vct#integrity` oku |
| `B2` | `schemaId = keccak256(vct)`; kayıtlı ve `REVOKED` değil mi. Tür Tamga kataloğunda yoksa yalnız belge zinciri bu türe kefil olan bir dış listeye bağlıysa kabul edilir ([[ADR-0036]] FD2); türe kefil olabilecek dış liste o an kullanılamıyorsa (yüklenememiş ya da süresi geçmiş) ya da bağlanan dış liste bayatsa sonuç RED değil `INDETERMINATE`/`INDEXER_STALE`'dir (FD3; 2026-11-19) |
| `B3` | Type Metadata al. Referans uygulamada tür tanımları pakete gömülüdür (`@tamga-network/schemas`, katalogla aynı içerik): doğrulama sırasında URL'den ya da kayıttan çekim yapılmaz; tanım pakette yoksa `INDETERMINATE`/`SCHEMA_UNREACHABLE`. Bütünlük bağı yine `B4`'tedir (2026-11-19) |
| `B4` | Bütünlük: hash `== vct#integrity` **ve** `== contentHash` (zincir) |
| `B5` | `extends` zinciri; her adımda `extends#integrity` |
| `B6` | JSON Schema 2020-12 uyumu (`schema_uri` Tamga ekidir, [[SPEC-SCHEMA-0001]] §2.1) |

## 1.C — Güven katmanı → [[SPEC-TRUST-0001]] §6 (`TrustSource`; imzalı güven listeleri)

| Kod | Adım |
|---|---|
| `C1` | `isCredentialAcceptable(issuerId, iat)` — **iat = belgenin `iat` claim'i** |
| `C2` | `isCredentialSchemaAcceptable(issuerId, schemaId, iat)` — **atlanamaz** |
| `C3` | `isRecognizedBy(kendi devletim, issuerId)` |
| `C4` | Belgenin `category` claim'i ↔ kayıttaki belge veren sınıfı: PUB ↔ `urn:tamga:eaa:pub`, QUALIFIED ↔ `urn:tamga:eaa:qualified`, EAA (I1–I2) ↔ claim yok; uyuşmazlık → RED ([[ADR-0010]] K5, [[SPEC-CRED-0002]]/C18). mdoc ve ZK sunumunda `category` alanı yoktur: bu formatlarda C4 uygulanmaz ve `checks_skipped`'te görünür; dış listedeki kurumda da uygulanmaz ([[ADR-0036]]). Kurumun sınıfı her biçimde sonuç nesnesinde `issuer.class` olarak güven listesindeki kayıttan döner ([[ADR-0010]] uygulama notu, 2026-11-12) |

## 1.D — İptal katmanı → [[SPEC-CRED-0003]] §7

| Kod | Adım |
|---|---|
| `D1` | `status.status_list` oku (`idx`, `uri`). ZK sunumunda (`mso_mdoc_zk`) indeks gelmez: ispatın bağladığı tür kısa ömürlü ZK kopyasıysa (`urn:tamga:id:ShortLivedIdentityAttestation:1`, tür kuralı ≤ 24 saat, iptal listesi yok — [[ADR-0044]] K5) D adımları uygulanmaz ve `status.value = NOT_APPLICABLE` (gerekçe kısa ömür); işaretsiz ZK sunumu aşağıdaki kurala tabidir. ZK dışı belgede `status` yoksa: tür şemasında `uses_status_list: true` ise RED (iptal denetimi sessizce atlanmaz — [[ADR-0056]] K13), değilse `NOT_APPLICABLE` Okunamayan `status` girişi (nesne değil; `status_list` yok ya da nesne değil; `idx` negatif olmayan tamsayı değil; `uri` boş) iptal denetimini atlatmaz: SD-JWT VC ve mdoc'ta `REJECTED`, `status entry malformed` (2026-11-19). |
| `D2` | Status List Token'ı **ön çekim önbelleğinden** al |
| `D3` | Token imzası; `sub == uri`; `iss` aynı güven zincirinde. İmzacı, imza denetiminden önce kurumun güven listesindeki ACTIVE iptal anahtarlarına sabitlenir (`expectedSignerFingerprints` — [[ADR-0056]] K6); kayıtlı anahtar yoksa `INDETERMINATE`. İptal anahtarı yalnız geçerlilik penceresindeyse (`valid_from`…`valid_to`, verilmişse) imzacı sayılır. İmzacı **kayıtlı** ama penceresi dışındaki (ya da `RETIRED`) bir iptal anahtarıysa — anahtar yenilenmiş, önbellekte eski liste — sonuç RED değil `INDETERMINATE`/`STATUS_STALE`'dir; kayıtlı olmayan (ya da `REVOKED` / `SUSPENDED`) imzacı `REJECTED` kalır. Önbellekteki gövde bir belirteç olarak okunamıyorsa (ör. sunucunun hata sayfası) sonuç RED değil `INDETERMINATE`/`STATUS_UNREACHABLE`'dır |
| `D4` | Tazelik: `exp` geçmemiş, token yaşı (`şimdi − iat`) politikanın `max_status_token_age_sec` sınırında Sıkıştırılmış listenin açılmış boyutu `bits` ile hesaplanan üst sınırı aşıyorsa liste okunamaz: `INDETERMINATE` (`D4`); D3'teki `iat` saat payı politikanın `max_clock_skew_sec`'idir (2026-11-19). |
| `D5` | Çapa: belirtecin özeti (`contentHash`), listenin çapa günlüğündeki son satırıyla eşleşiyor mu. Belirteç sürüm alanı taşımaz; geri alma zamanla anlaşılır. Uyuşmayan belirteç çapadan **eskiyse**: önbellek çapadan önce (ya da saat toleransı içinde) çekildiyse `INDETERMINATE`/`STATUS_STALE`, açıkça sonra çekildiyse `REJECTED`. Uyuşmayan belirteç çapadan **yeniyse** bu olağan yayın sırasıdır (önce CDN, sonra çapa — [[SPEC-CRED-0003]] §5.2) ve D5 `checks_skipped`'te görünür; pay sınırlıdır: belirteç bilinen son çapadan `max_anchor_lag_sec` (+ saat toleransı) kadardan daha yeniyse çapası gecikmiştir → `INDETERMINATE`/`STATUS_STALE`. Liste çapa günlüğünde hiç yoksa aynı pay belgenin `iat`'ından sayılır: yeni verilmiş belgede D5 atlanır, pay dolduysa `INDETERMINATE`/`STATUS_STALE`. Dış listedeki kurumun iptal listesi için çapa günlüğü yoktur, D5 atlanır ([[ADR-0036]]). `max_anchor_lag_sec` politikanın tazelik alanıdır (§4.4): varsayılan 3600 sn (çapa günlüğünün saatlik kadansı); Tamga Verify 600 sn kullanır |
| `D6` | `bits=2` ile `idx` oku; `0x00` dışı → RED |

## 1.E — Politika katmanı → yerel

| Kod | Adım |
|---|---|
| `E1` | Assurance eşiği (ör. `category=EDUCATION && assurance>=I2`) |
| `E2` | İstenen claim'lerin hepsi açıklanmış mı |
| `E3` | RP scope aşımı yok mu ([[SPEC-PROTO-0002]] §6). RP kaydı zorunlu girdidir: verilmemesi RED, `null` (kayıtsız RP) RED; `"none"` adımı bilerek atlar ve E3 `checks_skipped`'te görünür ([[ADR-0056]] K4). Kapsam denetimine seçici açıklanan bütün alanlar ile kurumun açıkta bıraktığı alanlardan politikanın istedikleri girer; ikisi de `disclosed_claims`'te görünür |
| `E4` | Denetim kaydı yazıldı — yalnız denetim kaydı yeri (`audit`) verildiyse ve kayıt yazıldıysa `checks_performed`'te; yoksa `checks_skipped`'te ([[ADR-0056]] K11). Denetim yazıcısı hata verirse doğrulama sonucu yine döner ve E4 `checks_skipped`'te görünür |

## 1.F — Takma ad → [[ADR-0031]] (yalnız barındırılan doğrulayıcı)

| Kod | Adım |
|---|---|
| `P1` | Site başına takma ad sunumu (ayrı `vp_token` girdisi) doğrulanır: imza, hedef (`aud`), `nonce` ve cüzdan birimi bağı. `P1`'i paket (`verifyPresentation`) değil barındırılan doğrulayıcı (Tamga Verify) raporlar. Yalnız takma ad isteyen politikada takma ad sunumun tek sahiplik kanıtıdır ve sunum tüketilmeden önce denetlenir: geçmeyen takma ad bir denemedir (`400`, sunum açık kalır), geçen takma adın sonucu `checks_performed: ["P1", "E4"]`'tür. Belge + takma ad politikasında belge kabul edildikten sonra takma ad geçmezse sonuç `failed_step: "P1"` ile `REJECTED` (ya da `INDETERMINATE`) olur. `P1` adım listesinin dışındadır: takma ad istemeyen politikada `checks_skipped`'te görünmez (2026-11-19) |

**Evet/hayır alanının okunuşu:** `isYes(çıktı, alan)` yalnız sonuç `ACCEPTED` ve açıklanan değer tam olarak `true` ise `true`
döner (ör. `age_over_18`, düz ya da ZK sunumda); red, doğrulanamadı, değer yok ya da `"true"`/`1` gibi başka değerler `false`'tur
([[ADR-0056]]). Geçiş kartı yalnız bu sürecin `ACCEPTED` çıktısından verilir (`PassRegistry.issue({ verified })` — K9).

Geçiş kartı jetonunun `jti`'si en çok 128 karakterlik bir dizgidir; dize olmayan ya da daha uzun `jti` reddedilir (AP13 tekrar listesi).

## 1.1 C1/C2 zamana bağlıdır

`C1` ve `C2`, kurumun **bugün** belge verip veremeyeceğini değil, belgenin verildiği **an** kabul edilebilir olup
olmadığını sorar. Belge verme zamanına ait sorular (`isValidIssuer`, `isAuthorizedForSchema`: "şimdi verebilir mi?")
doğrulamada kullanılsaydı iki sessiz hata çıkardı:

| Senaryo | Belge verme zamanı sorusuyla | Doğrusu |
|---|---|---|
| Bakanlık kapandı (`REVOKED`, halefi var) | Tüm diplomaları `C1`'de RED | Kapanıştan önce verilenler kabul ([[ADR-0002]] #4) |
| Kurum askıya alındı (`SUSPENDED`), sonra yeniden etkinleşti | Askıdayken bütün belgeler `C1`'de RED, sonra kabul | Askıdayken RED ("issuer suspended"); askı kalkınca askıdan önce verilenler kabul, askıda verilenler RED ([[ADR-0088]]) |
| Şema `DEPRECATED` oldu (yeni sürüm çıktı) | Eski şemayla verilen her belge `C2`'de RED | Kabul — şema kaydının durumu, [[SPEC-TRUST-0001]] |
| CA planlı rotasyon | `A3` + `C1` RED | Kabul — rotasyon ele geçirilme değildir |

Bu yüzden her iki sorgu belgenin **`iat`** değerini alır ve "o an kabul
edilebilir miydi" diye sorar. Bu, doğrulamanın **geçmişe dönük** bir işlem
olduğunu kabul eder — belge geçmişte verilmiştir, bugünkü durum değil o
günkü durum belirleyicidir.

**Askı (istisna, [[ADR-0088]]).** `C1` bir tek durumda bugüne de bakar: kurum doğrulama anında güven listesinde `SUSPENDED`
ise belge verilme anından bağımsız reddedilir (`failed_reason: "issuer suspended"`; SI1). Askı geçicidir ve belgeleri iptal etmez:
kurum yeniden etkinleşince askıdan önce verilmiş belgeler yeniden kabul edilir (SI2). İptal, emeklilik ve kayıt süresinin dolması
verilme anı kuralıyla değerlendirilir (SI3). Bu, AB çerçevesinin (ARF 3.0 §4.6.5) askı kuralıdır.

**ZK sunumu (`mso_mdoc_zk`).** Sıfır bilgi ispatında belgenin imza anı açıklanmaz. Bu yolda `C1` ve `C2` ispatın zaman damgasıyla (sunum anı; doğrulayıcı saatine saat toleransı içinde yakın olmalıdır) sorulur: kurum ve tür yetkisi sunum anında geçerli olmalıdır. Kısa ömürlü ZK kopyası en çok 24 saat önce verildiğinden ([[ADR-0044]]) iki an arasındaki fark en çok bir gündür. Bu, AP11'in ZK sunumu için açık istisnasıdır ([[ADR-0032]] uygulama notu, 2026-11-12). İki sonucu vardır: kurum belgeyi verdikten sonra kapandıysa ZK sunumu reddedilir; kurum belgenin verildiği anda kabul edilebilir değildiyse ama sunum anında kabul edilebilirse sunum bu adımlardan geçer. İşaretsiz ZK sunumunda (yalnız `accept_unrevocable_zk: true` ile kabul edilir) bir günlük sınır yoktur.

## 1.2 `issuerId` sertifikadan türetilir

`A3b` kritiktir. Doğrulayıcı `issuerId`'yi **`iss`
claim'inden alırsa**, aynı kök CA altında geçerli sertifikası olan **herhangi
bir** kurum, `iss` alanına üniversitenin tanımlayıcısını yazıp onun adına belge
üretebilir — imza kendi sertifikasıyla geçerli, zincir geçerli, `iss` sahte.

Kural: `issuerId = keccak256(stateCode, SHA-256(x5c[0] DER))` — [[SPEC-ID-0002]].
`iss` claim'i yalnızca **tutarlılık kontrolü** için kullanılır: kayıtlı
belge verenin `metadataURI`'siyle eşleşmeli; eşleşmiyorsa RED.

**`iss` zorunludur (SD-JWT VC).** Tamga kataloğundaki türlerde `iss` eksik ya da boşsa sonuç `A3b` ile RED'dir; değer, kurumun güven listesindeki kaydının `issuer_url` alanıyla birebir aynı olmalıdır. mdoc ve ZK sunumunda `iss` alanı yoktur; bağ yalnız sertifikadan kurulur. Dış listedeki kurumda ([[ADR-0036]]) kayıtta adres olmadığından bu denetim uygulanmaz.

**Yerel geliştirme bayrağı (`allowLocalIssuerUrls`).** Varsayılan kapalıdır. Açıkken `iss` yerel bir adresse — `http://localhost` ya da 127.0.0.0/8, 10.0.0.0/8, 172.16.0.0/12, 192.168.0.0/16 aralığında bir IPv4 adresi — kayıttaki adresle eşitlik aranmaz; aynı gevşetme iptal belirtecinin `iss`'i için de geçerlidir. Genel bir IP adresi yerel sayılmaz. Tamga Verify bu bayrağı yalnız yayın adresi `https` değilken açar; canlı doğrulayıcıda kapalıdır.

## 1.3 Sıra ve kısa devre

Adımlar **sırayla** çalıştırılır. İlk başarısızlıkta durulur ve o kod
`failed_step` olarak döner.

**İstisna:** `E4` her durumda çalışır — reddedilen doğrulama da kayda geçer (denetim kaydı yeri olan doğrulayıcıda; yoksa E4
atlandı olarak raporlanır — [[ADR-0056]] K11).

**Kodların raporlanışı (uygulama notu, 2026-11-11).** Referans uygulama bazı adımları komşu kodla raporlar: `cnf` eksikliği (`A3d`) `A3`, yinelenen özet ve çakışma (`A8`) SD-JWT VC'de `A5` olarak döner; mdoc ve ZK'de `A8`, belge türünün (docType) politikada olmamasıdır. `A2` (Tamga türünde eski `typ`) ve `A4` (Tamga türünde `_sd_alg` yok) türün katalogda olup olmadığı bilinince, yani `B2`'den sonra; `A3b` (`iss` tutarlılığı) güven kaydı okununca, yani `B6`'dan sonra denetlenir — birden çok kusuru olan belgede dönen kod sıradaki ilk kod olmayabilir. Beklenmeyen istisnada `failed_step` o katmanın ilk kodudur (`T0`, `A1`, `B1`, `C1`, `D1`, `E1`). SD-JWT VC'nin A-sırası: A1 · A2 · A3 (`cnf` eksikliği dahil) · A4 · A5 (yinelenen özet dahil) · A6 · A7; `policyCredentialId` denetimi (A1) bunlardan önce yapılır (2026-11-19). mdoc'un A-sırası: A1 · A8 · A2 · A3 · A3b · A4, A7, A5 · A3d · A6. Zincir verilen köklerin hiçbirine bağlanmıyorsa (`A3`) ya da tür katalogda yoksa ve çapa bir dış kuruma çözülemiyorsa (`B2`), RED vermeden önce istenen türe kefil olabilecek bir dış listenin o an kullanılıp kullanılamadığına bakılır: kullanılamıyorsa sonuç `INDETERMINATE`'tir (§2.3). Denetimlerin kendisi eksiksiz yapılır: başarılı doğrulamada `A3d` ve `A8` `checks_performed`'ta görünür; başarısızlığın tam nedeni `failed_reason` alanındadır. Bu raporlama proje yönetiminin onayıyla (2026-11-12) referans uygulamanın bağlayıcı davranışıdır; kodların kayıtlardaki okunuşu değişmesin diye (AP1) değiştirilmez ([[ADR-0056]] uygulama notu).

## 1.4 Kod kararlılığı

**Değişmez AP1:** Bir adım kodunun anlamı **asla değişmez.** Yeni adım
eklenirse yeni kod alır; kaldırılan adımın kodu **yeniden kullanılmaz.**

Gerekçe: `failed_step` denetim kayıtlarında yıllarca saklanır. `C2`'nin anlamı
2029'da değişirse, 2027 kayıtları yanlış okunur.

---

## 1.5 Çok belgeli sunum

Bir yanıttaki her sunum aynı `nonce` ve `aud` ile ayrı ayrı doğrulanır; bu, belgelerin başka bir oturumdan alınıp karıştırılmasını
engeller. Belgelerin **aynı kişiye ya da aynı cüzdan birimine** ait olduğu ise bugünkü standart araçlarla (SD-JWT VC ve mdoc,
belge başına ayrı cihaz anahtarı) kanıtlanamaz: iki kişi bir aracı üzerinden oturumu paylaşıp her biri kendi belgesinin sahiplik
kanıtını imzalarsa doğrulayıcı iki belgeyi tek kişiden gelmiş gibi görür (AB ARF tartışması "credential pooling"; konu AB'de
açıktır). Bütün belgeleri tek anahtara bağlamak bağlanamazlığı bozar; kanıtlayıcı yöntemler (sıfır bilgi ispatı ya da cüzdan
biriminin imzaladığı ortak bağ) henüz standart değildir. Bu yüzden barındırılan doğrulayıcı (Tamga Verify) sunum başına **tek
belge** doğrular (isteğe bağlı takma ad onunla birlikte gelir ve yalnız siteye özgü bir tanımlayıcıdır, kişi hakkında bir nitelik
taşımaz); politikada ikinci belge varsa sunumu kapalı tutar. Birden çok belgeyi kendi sunucusunda birleştiren güvenen taraf bu
sınırı bilmelidir: aynı yanıttaki belgelerin aynı kişiye ait olduğu varsayılmamalıdır.

# 2. Doğrulama Sonucu

## 2.1 Üç değerli sonuç

| `outcome` | Anlamı |
|---|---|
| `ACCEPTED` | Tüm adımlar geçti |
| `REJECTED` | Bir adım başarısız — belge geçersiz |
| `INDETERMINATE` | **Doğrulanamadı** — altyapı erişilemez, belge hakkında hüküm yok |

**Değişmez AP2:** `INDETERMINATE`, `REJECTED` ile aynı kovaya konmaz. Kullanıcı
arayüzünde ayrı gösterilir. "Bu diploma sahte" ile "şu an kontrol edemiyorum"
arasındaki fark, bir insanın işe alınıp alınmamasıdır.

## 2.2 Sonuç nesnesi

```json
{
  "verification_id": "vrf_tl1f9cq8k2m7x4p0a3d5",
  "outcome": "ACCEPTED",
  "failed_step": null,
  "failed_reason": null,
  "indeterminate_reason": null,

  "spec_version": "SPEC-API-0001@1.0.0",
  "sdk_version": "@tamga-network/verifier@0.8.8",
  "checks_performed": ["T0",
                       "A1","A2","A3","A3b","A3d","A4","A5","A6","A7","A8",
                       "B1","B2","B3","B4","B6",
                       "C1","C2","C3","C4",
                       "D1","D2","D3","D4","D5","D6",
                       "E1","E2","E3","E4"],
  "checks_skipped": ["A3c","B5","Z1"],

  "issuer": {
    "issuer_id": "0x7f3a…",
    "state_code": "TR",
    "category": "EDUCATION",
    "assurance": "I2",
    "class": "EAA",
    "legal_name": "Örnek Üniversitesi"
  },
  "schema": {
    "schema_id": "0x9c21…",
    "vct": "urn:tamga:edu:DiplomaCredential:1",
    "status": "ACTIVE"
  },
  "disclosed_claims": ["is_graduate","qualification_title","eqf_level",
                       "isced_f_code","awarding_body_name","awarding_date",
                       "family_name","given_name"],
  "status": {
    "value": "VALID",
    "list_version": 8412,
    "token_age_sec": 1830
  },
  "freshness": {
    "trust_source": "list",
    "trust_version": 412,
    "trust_age_sec": 95
  },
  "evaluated_at": "2026-11-19T09:12:44.000Z"
}
```

**Örnekteki `checks_skipped` (uygulama notu, 2026-11-12).** Örnek, referans uygulamanın (`@tamga-network/verifier`) denetim kaydı yeri verilmiş bir SD-JWT VC sunumunda döndürdüğü sonuçtur. Referans uygulama iki adımı bugün yapmaz ve her sunumda `checks_skipped`'te bildirir: `A3c` (yaprak sertifikanın CRL/OCSP sorgusu) ve `B5` (`extends` zinciri). Sunumun biçiminde olmayan adımlar da `checks_skipped`'e girer: ZK olmayan her sunumda `Z1` (2026-11-19); `P1` adım listesinin dışındadır ve hiç `checks_skipped`'te görünmez (§1.F). Sonuç nesnesinde `failed_reason` her zaman vardır (kabulde `null`); `freshness` güven kaynağının türünü, sürümünü ve yaşını taşır (`trust_source`, `trust_version`, `trust_age_sec`); `schema`'da sürüm alanı yoktur; `issuer.legal_name` güven listesindeki kayıttan gelir. Alan sırası anlam taşımaz. `E4`, denetim kaydı yazıldığı için `checks_performed`'tedir; denetim kaydı yeri verilmediyse o da `checks_skipped`'te görünür (§1.E, `E4`).

| Alan | Anlamı |
|---|---|
| `status.reason` | İsteğe bağlı metin (`string \| null`): durum değerinin nedeni, kendiliğinden anlaşılmadığında. Ör. `NOT_APPLICABLE` + ZK sunumu: iptal indeksi açılmaz ([[ADR-0032]] ZK4). Kişisel veri taşımaz. |

## 2.3 `indeterminate_reason`

`outcome == INDETERMINATE` olduğunda **zorunlu**:

| Değer | Kaynak |
|---|---|
| `SCHEMA_UNREACHABLE` | [[SPEC-SCHEMA-0001]] §7 Ş3(c) |
| `STATUS_UNREACHABLE` | [[SPEC-CRED-0003]] §7 Ş3(c) |
| `STATUS_STALE` | [[SPEC-CRED-0003]] §8.2 tazelik eşiği aşıldı; ya da D5'te doğrulayıcının ön çekim gecikmesi / saat toleransı penceresi / okunamayan çapa zamanı / çapa gecikme penceresinin aşılması (belirteç son çapadan `max_anchor_lag_sec`'ten daha yeni ya da liste hiç çapalanmamış); ya da D3'te liste, kurumun kayıtlı ama geçerlilik penceresi dışındaki bir iptal anahtarıyla imzalı |
| `CHAIN_UNREACHABLE` | Zincir ve indeksleyici erişilemez |
| `INDEXER_STALE` | [[ARCH-0003]]/CMP4 |
| `SDK_VERSION_MISMATCH` | [[ARCH-0005]] §4.2 M2; ayrıca `Z1`'de doğrulayıcı tarafının ZK bileşeni kullanılamıyorsa (devre dosyası yok, WASM yüklenemiyor) — sunumun değil doğrulayıcının eksiği |
| `STATUS_VALUE_UNKNOWN` | `D6`: iptal listesindeki değerin tanımlı anlamı yok — IETF Token Status List 0x03 ve 0x0B–0x0F uygulamaya özel, ötekiler tanımsız; 4 ya da 8 bitlik (dış) listelerde gelebilir (2026-10-24). Belge iptal edildi denemez, geçerli de denemez; `status.value = UNKNOWN`. Tamga türlerinin listeleri 1 ya da 2 bitle yayımlanır ([[ADR-0048]], [[ADR-0063]]) |

Ayrıca şu durumlar `INDETERMINATE` verir, `REJECTED` vermez:

- **Beklenmeyen istisna** (kütüphane hatası, bozuk güven kaydı …): o adımda `INDETERMINATE`, nedeni o katmanın değeri (A →
  `CHAIN_UNREACHABLE`, B → `SCHEMA_UNREACHABLE`, C/E/T0 → `INDEXER_STALE`, D → `STATUS_UNREACHABLE`); `failed_reason`'a
  istisna iletisi girmez (AP3), yalnız adım ve hata türü. Sonuç E4 denetim kaydına yine düşer. Barındırılan doğrulayıcıda
  sunum tüketildikten **sonra** oluşan iç hata da bu kurala girer: hata, hattın sonundaki (E) katmanda ya da sonrasındadır;
  neden `INDEXER_STALE`, `failed_step` `null`, `failed_reason` "internal error after verification (…)" olur. Kapalı kümede ayrı
  bir "iç hata" değeri yoktur; bu durum liste bayatlığından `failed_step`'in boş olmasıyla ayrılır.
- **İşaretsiz ZK sunumu ve `accept_unrevocable_zk: false`:** ZK sunumunda iptal indeksi gelmez (ZK4). Kısa ömür işaretini
  taşıyan sunum (ispatın bağladığı tür ZK kopyası, [[ADR-0044]] K5) bu bayrak olmadan kabul edilir. İşaretsiz ZK sunumunda
  politika iptal denetimini şart koşuyorsa sonuç `D1` / `STATUS_UNREACHABLE`; yalnız açıkça `true` yazılmışsa kabul edilir:
  `status.value = NOT_APPLICABLE`, `status.reason` dolu. **Alan verilmemişse `false` sayılır** (`ADR-0044/ZC4`).

- **Ret nedeni sabit iletidir (2026-11-11):** `failed_reason` belgedeki bir değeri (ör. `category`, `typ`, `_sd_alg`), cüzdanın gönderdiği serbest metni ya da kütüphane istisnasının iletisini taşımaz; alan **adı** taşıyabilir. Belgeden gelen sertifika ya da imza okunamıyorsa sonuç RED'dir; sertifikalar okunduktan sonraki beklenmeyen hata (çağıranın verdiği çapa bozuk, kütüphane hatası) `INDETERMINATE`'tir.
- **Kullanılamayan dış liste ([[ADR-0036]] FD3):** zincir verilen köklerin hiçbirine bağlanmıyorsa (`A3`) ya da tür katalogda yoksa ve çapa bir dış kuruma çözülemiyorsa (`B2`), istenen türe kefil olabilecek bir dış liste o an kullanılamıyor (yüklenememiş ya da süresi geçmiş) ise sonuç RED değil `INDETERMINATE`/`INDEXER_STALE`'dir. Tür, `A3`'te politikadan okunur (imzası doğrulanmamış belgeden değil).
- **Barındırılan doğrulayıcıda deneme sınırı:** sahiplik kanıtına ulaşmadan `INDETERMINATE` olan yanıtlar da deneme sayılır; sunum bu yüzden kapanırsa sonucu `REJECTED` değil `INDETERMINATE`'tir ve `indeterminate_reason` korunur (AP2). Bekleyen sunumun `last_attempt` alanı denemenin `outcome` ve `indeterminate_reason` değerlerini de taşır. Doğrulama hattına girmeyen sonuçlar (kişinin reddi, deneme sınırı) da denetim kaydına yazılır ve E4 `checks_performed`'te görünür; denetim kaydı her zaman dönen sonuçla aynı çıktıyı taşır. Cüzdanın hata yanıtındaki `error` yalnız OpenID4VP'nin tanımlı kodlarından biriyse kayda geçer; başka değer `wallet error` olarak yazılır.

## 2.4 `disclosed_claims` — yalnızca adlar

**Değişmez AP3:** Sonuç nesnesi claim **değerlerini** taşımaz, yalnızca
**adlarını**. Değerler çağıran uygulamaya ayrı bir kanaldan ve açıkça
istendiğinde verilir.

Gerekçe: sonuç nesnesi denetim kaydına yazılır ([[ARCH-0004]] §5.2). Değerler
oraya sızarsa, kişisel veri log altyapısına yayılır.

**Dönen değerler (2026-11-11).** Çağırana (`claims`; barındırılan doğrulayıcıda §4.3) yalnız politikanın **istediği** alanların (`required_claims`) doğrulanmış değerleri verilir. Cüzdanın fazladan açıkladığı alan `disclosed_claims`'te görünür ve E3'te denetlenir ama değeri dönmez. Belgenin teknik alanları — `iss`, `iat`, `exp`, `vct`, `category`, kişinin kopya anahtarı `cnf` ve iptal sırasını taşıyan `status` — hiçbir zaman dönmez (AP4).

## 2.5 `idx` asla yer almaz

**Değişmez AP4:** `status.status_list.idx` sonuç nesnesinde, denetim kaydında
veya herhangi bir API yanıtında **bulunmaz** ([[ARCH-0004]] §5.3).

İlişkilendirme gerekiyorsa kuruma özel [[t:salted-hash]] kullanılır:
`HMAC(kurum_tuzu, uri || idx)`.

---

# 3. HTTP Durum Kodu Sonucu Kodlamaz

**Değişmez AP5:** Reddedilen bir belge **başarılı bir API çağrısıdır**.

| Durum | Ne zaman |
|---|---|
| `200` | Doğrulama çalıştı — `outcome` ne olursa olsun |
| `400` | İstek gövdesi bozuk, eksik parametre |
| `401` / `403` | API kimlik doğrulaması / yetki |
| `404` | Bilinmeyen sunum ya da başka bir doğrulayıcının sunumu (varlığı açığa vurulmaz) |
| `410` | Açıklanan değerler zaten okundu ya da süresi doldu (`/claims`, `claims_gone`; değerler bir kez ve sonuçtan sonra en çok 5 dakika okunur — §4.3; 2026-11-19) |
| `409` | Idempotency çakışması (planlanan — §6.2) |
| `429` | Hız sınırı |
| `500` | Servis hatası |
| `503` | Bağımlılık erişilemez **ve** sonuç üretilemedi. Referans doğrulayıcı güven listesi bayat ya da okunamazken sunum açma isteğine (RP beyanı olsun olmasın) `503` + `Retry-After` döner; `400`/`401` değil (2026-11-19) |

**Tüketilmiş sunuma gelen yanıt (2026-11-19).** Sunum, sahiplik kanıtına ulaşan bir yanıtla bir kez tüketildikten sonra aynı
sunuma gelen her cüzdan yanıtı (`/vp/response`, `/vp/dc-mdoc/{id}`) `400 invalid_request` (`nonce already used (PV10)`) alır; bu
bir taşıma hatasıdır, ikinci bir doğrulama sonucu değildir ve saklanan sonucu değiştirmez. Kapanmış ya da süresi geçmiş sunumun
istek nesnesi çekimi `404` alır.

Karıştırmak yaygın bir hatadır ve iki sorun üretir: (1) istemciler ağ hatası
ile geçersiz belgeyi ayıramaz, (2) izleme sistemleri reddedilen belgeleri
"hata oranı" sanır ve gerçek arızalar gürültüde kaybolur.

---

# 4. Doğrulayıcı servis API'si

Taban (barındırılan doğrulayıcı, Tamga Verify): `https://verify.tamga.network` (gerçek ağ), `https://verify.sandbox.tamga.network`
(sandbox). Uçlar kökün altındadır; yolda sürüm öneki (`/api/v1`) yoktur (2026-11-19). Kimlik doğrulama: sunumu açan ve sonucu
okuyan doğrulayıcı `Authorization: Bearer <RP beyanı>` gönderir — güven listesinde kayıtlı erişim sertifikasının anahtarıyla
imzalı kısa ömürlü bir JWS (`typ: tamga-rp+jwt`, ES256, `jti` tek kullanımlık; §6.4). Tarayıcı yalnız durum jetonunu
(`X-Tamga-Status-Token` ya da `?st=`) kullanır ve yalnız durumu görür.

Bu bölüm akışın çekirdeğini anlatır. Bütün uçların (QR görüntüsü, politika listesi, ISO/IEC 18013-7 Ek C yanıt ucu, sayfa kiti),
istek ve yanıt alanlarının ve hata kodlarının tam tanımı OpenAPI başvurusundadır: [Tamga Verify API](/api/verify).

## 4.1 Sunum isteği başlat

```http
POST /presentations
Authorization: Bearer <RP beyanı>
Accept: application/json
Content-Type: application/json
Idempotency-Key: 3f9a1c...

{
  "policy_id": "job-application-degree"
}
```

```json
{
  "presentation_id": "prs_Q2x0dVJmNkp3",
  "request_uri": "https://verify.tamga.network/vp/req/prs_Q2x0dVJmNkp3",
  "qr_payload": "openid4vp://?client_id=x509_hash%3AUvo3…&request_uri=…&request_uri_method=post",
  "expires_at": "2026-11-19T09:17:44.000Z",
  "status_token": "9VdB0qXr7mYk2LwPq1sZ3A"
}
```

İstek gövdesinde yalnız iki alan okunur: `policy_id` (zorunlu) ve isteğe bağlı `dc_api_origin` (tarayıcının Digital Credentials
API'si için sayfa kökeni; verilirse yanıtta `dc_api_request` / `dc_api_requests` da gelir). Başka alan yok sayılır: kullanım amacı
politikadan ve kayıt sertifikasından gelir ([[SPEC-PROTO-0002]] §3), yanıt modu yoldan belirlenir (cihazlar arası
`direct_post.jwt`, tarayıcıda `dc_api.jwt`), sunumun ömrü sabit 300 saniyedir (2026-11-19). `Accept: application/json`
gönderilmezse doğrulayıcı JSON yerine kendi bekleme sayfasına yönlendirir. `status_token` yalnız tarayıcıya verilir.

`policy_id`, önceden tanımlı bir politikaya işaret eder (§4.4). DCQL sorgusu
istek gövdesinde **elle yazılmaz** — politikadan üretilir. Böylece aşırı talep,
kod değişikliği değil politika değişikliği gerektirir.

## 4.2 Sonucu al

```http
GET /presentations/prs_01J8XK
```

Sunum henüz gelmediyse `{"state": "PENDING"}`; geldiyse §2.2'deki sonuç
nesnesi.

## 4.3 Açıklanan değerleri al (ayrı çağrı)

```http
GET /presentations/prs_01J8XK/claims
```

```json
{
  "claims": {
    "is_graduate": true,
    "qualification_title": { "tr-TR": "Bilgisayar Mühendisliği Lisans Diploması" },
    "eqf_level": 6,
    "isced_f_code": "0613"
  }
}
```

**Ayrı uç olmasının sebebi** AP3'tür: değerler denetim kaydına giden sonuç
nesnesinden ayrılır ve bu uca erişim ayrıca yetkilendirilir ve loglanır.

## 4.4 Politika yönetimi

```json
{
  "policy_id": "job-application-degree",
  "credentials": [
    {
      "id": "diploma",
      "vct_values": [
        "urn:tamga:edu:DiplomaCredential:1",
        "urn:tamga:edu:DiplomaCredential:2"
      ],
      "required_claims": ["is_graduate","qualification_title","eqf_level",
                          "isced_f_code","awarding_body_name","awarding_date"],
      "constraints": { "is_graduate": true, "eqf_level": { "min": 6 } }
    }
  ],
  "trust": {
    "min_issuer_assurance": "I2",
    "allowed_categories": ["EDUCATION"],
    "require_recognition": true,
    "state_code": "TR"
  },
  "freshness": {
    "max_status_token_age_sec": 21600,
    "max_trust_age_sec": 86400
  }
}
```

Politika hem DCQL sorgusunu ([[SPEC-PROTO-0002]] §4) hem `E1`–`E3` adımlarını
besler. Tek kaynak.

`freshness.max_anchor_lag_sec` (isteğe bağlı, sn): D5 çapa gecikme penceresi; verilmezse 3600. `freshness.max_clock_skew_sec` (isteğe bağlı, en çok 600 sn): saat toleransı; verilmezse 120.

**Değişmez AP6:** Politikadaki `required_claims`, RP'nin güven listesindeki kaydının
`scopes[]`'ini (`allowedScopes`) aşamaz. Servis, politika kaydedilirken bunu kontrol eder ve
aşan politikayı **reddeder** — aşırı talep, sunum anında değil politika
tanımlanırken engellenir.

**Barındırılan doğrulayıcıda (uygulama notu, 2026-11-19).** Tamga Verify'da politikalar servisin yapılandırmasıdır (listesi
`GET /policies`); politika kaydeden bir uç yoktur. AP6 bu yüzden **sunum açılırken** denetlenir: politika, sunumu açan doğrulayıcının
güven listesindeki kapsamını aşıyorsa `POST /presentations` `400 policy_exceeds_scope` döner (`detail` aşan alanları sayar) ve
istek nesnesi hiç üretilmez — aşan talep cüzdana ulaşmaz.

---

# 5. Belge veren servis API'si

Taban: `https://issuer.tamga.network/{slug}/api/v1` (kurum başına yol). OID4VCI uçları ayrıdır
([[SPEC-PROTO-0001]]); buradakiler **operatör ve entegrasyon** yüzeyidir. Uygulanan uçların tam tanımı OpenAPI başvurusundadır:
[Belge veren API](/api/issuer) (2026-11-19).

## 5.1 Belge teklifi üret (credential offer)

```http
POST /offers
Idempotency-Key: 8c21f...

{
  "credential_configuration_id": "urn:tamga:edu:DiplomaCredential:1",
  "subject_ref": "OBS-2022510041",
  "batch_size": 1
}
```

```json
{
  "offer_id": "ofr_01J8XM",
  "offer_uri": "https://issuer.tamga.network/example-university/offers/8a3f9c21",
  "tx_code": "493812",
  "expires_at": "2026-09-09T09:17:44Z"
}
```

`subject_ref` kurumun **kendi** kimliğidir (öğrenci numarası). Tamga bu değeri
hiçbir yere taşımaz; belgeye girmez, zincire yazılmaz.

**`tx_code` yalnızca bu yanıtta döner** ve saklanmaz — operatör ekranında
gösterilir, sonra unutulur.

## 5.2 Belge verme ön kontrolü

```http
POST /offers/preflight
{ "credential_configuration_id": "urn:tamga:edu:DiplomaCredential:1", "subject_ref": "OBS-2022510041" }
```

```json
{
  "ok": false,
  "blockers": [
    {
      "code": "ISCED_MAPPING_MISSING",
      "detail": "Program 'Yapay Zekâ Mühendisliği' ulusal ISCED-F tablosunda yok",
      "resolution": "packages/schemas/data/tr/overrides.json içine ekleyin"
    }
  ]
}
```

Bu uç, [[ARCH-0003]]/CMP5'in operatöre görünen hâlidir: eşlemede karşılığı
olmayan program için belge verme **durur**, tahmini kod üretilmez.

## 5.3 İptal ve askı

```http
POST /revocations
{ "credential_id": "crd_01J8XN", "action": "REVOKE", "reason_code": "DISCIPLINARY" }
```

```json
{ "queued": true, "effective_after": "2026-09-09T10:00:00Z" }
```

`effective_after`, bir sonraki yayın döngüsüdür ([[SPEC-CRED-0003]] §5.1).
**Anında iptal yoktur** ve API bunu açıkça söyler — çağıranın beklentisi
baştan doğru kurulur.

`action`: `REVOKE` (kalıcı, `0x01`) veya `SUSPEND` / `UNSUSPEND` (`0x02`).

## 5.4 Durum listesi yayın durumu

```http
GET /status-lists/{list_id}
```

```json
{
  "list_id": "0x4f…",
  "list_uri": "https://status.tamga.network/7f3a9c21",
  "version": 8412,
  "published_at": "2026-09-09T09:00:00Z",
  "next_publish_at": "2026-09-09T10:00:00Z",
  "chain_version": 8412,
  "in_sync": true,
  "capacity_used_pct": 41.2
}
```

`in_sync == false`, yayın hattının kırıldığını gösterir — CDN ile zincir
çapası ayrışmış demektir ([[ARCH-0004]] §5.1 alarmı).

---

# 6. Ortak Kurallar

## 6.1 Hata biçimi

**Bugünkü referans servisler (2026-11-19).** İki servis iki biçim kullanır:

- **Belge veren API** (`/{slug}/api/v1`): RFC 9457 problem ayrıntısının en küçük biçimi, `application/problem+json`:
  `{ "type": "about:blank", "title": "<kısa ileti>", "status": <kod> }`. `detail`, `instance` ve `tamga_code` bugün üretilmez.
- **Doğrulayıcı (Tamga Verify):** OAuth biçimi `{ "error": "<kod>", "error_description": "<isteğe bağlı ileti>" }`; kapsam aşımında
  ayrıca `detail` (aşan alanların listesi, `policy_exceeds_scope`). Gövde ayrıştırma hatası gibi çerçeve hataları ve beklenmeyen
  hatalar `{ "statusCode": <kod>, "error": "<HTTP neden ifadesi>", "message": "<ileti>" }` biçimindedir; 5xx'te ileti her zaman
  `internal error`'dır (iç ayrıntı yanıta girmez).

Aşağıdaki örnek RFC 9457'nin tam biçimini ve hedeflenen `tamga_code` uzantısını gösterir; bugün belge veren yalnız `type`, `title`
ve `status` alanlarını üretir.

```json
{
  "type": "https://docs.tamga.network/errors/schema-not-authorized",
  "title": "Belge veren bu şemayla belge veremez",
  "status": 403,
  "detail": "issuer 0x7f3a… schemaId 0x9c21… için yetkilendirilmemiş",
  "instance": "/api/v1/offers",
  "tamga_code": "SCHEMA_NOT_AUTHORIZED"
}
```

**Değişmez AP7:** `detail` alanı kişisel veri içermez. "Ayşe Yılmaz için kayıt
yok" yerine `SUBJECT_NOT_FOUND` döner; ayrıntı yalnızca kurumun kendi denetim
kaydındadır ([[SPEC-PROTO-0001]]/PR8'in servis karşılığı).

## 6.2 Yineleme güvenliği (idempotency)

**Planlanan — henüz uygulanmadı (2026-11-19).** Referans servisler (doğrulayıcı `apps/verify`, belge veren) bugün
`Idempotency-Key` başlığını işlemez; başlık yok sayılır ve `409` üretilmez. Tekrar çağrı yeni bir sunum ya da işlem açar.
Hedef davranış: yan etkili her `POST` (`/offers`, `/revocations`, `/presentations`) başlığı kabul eder; aynı anahtarla tekrar
çağrı aynı yanıtı döndürür, farklı gövdeyle aynı anahtar `409` üretir; saklama süresi 24 saat. §4.1 ve §5.1 örneklerindeki
başlık bu hedefi gösterir.

## 6.3 Sürümleme

Belge veren API yol tabanlıdır: `/{slug}/api/v1`. Barındırılan doğrulayıcının yolunda sürüm öneki yoktur (§4); sürümü
OpenAPI belgesi taşır (2026-11-19). Kırıcı değişiklik `/v2` açar; `/v1` en az **12 ay**
paralel yaşar ([[ARCH-0005]] §5.3 ile aynı politika).

## 6.4 Kimlik doğrulama

| Yüzey | Yöntem |
|---|---|
| Operatör paneli → belge veren API | OIDC + rol tabanlı yetki |
| OBS → belge veren API | mTLS veya istemci kimlik bilgisi |
| Doğrulayıcı uygulaması → doğrulayıcı API | RP beyanı: `Authorization: Bearer <tamga-rp+jwt>` — güven listesindeki erişim sertifikasının anahtarıyla imzalı, en çok 60 saniyelik, `jti`'si tek kullanımlık JWS; paylaşılan gizli anahtar yok (`createRpAssertion()`). Tarayıcı yalnız durum jetonuyla (`X-Tamga-Status-Token` ya da `?st=`) durumu okur (2026-11-19) |
| Kapı terminali → doğrulayıcı `/terminal/verify` | Terminal anahtarı: terminal grubuna bağlı, işletmecinin verdiği taşıyıcı anahtar (`Authorization: Bearer`); anahtarsız istek 401, jeton okunmaz ([[ADR-0065]] TK1–TK3). Anahtarlar yönetici uçlarından (`/terminal/keys`, iç adres) verilir ve iptal edilir. |
| Kurum Konsolu → doğrulayıcı `/terminal/keys` (kurum adına) | Kuruma daraltılmış belirteç: `x-tamga-institution` + `x-institution-token` = base64url(HMAC-SHA256(yönetici belirteci, `tamga-terminal-keys/v1:` + kurum)); kurum yalnız imzalı listede (`terminal_groups[].institution_id`) kendisine bağlı grupların anahtarlarını alır, görür ve iptal eder; listede geri çekilen grubun anahtarı kapıda 403 ([[ADR-0069]] TG1–TG3). |
| OID4VCI / OID4VP uçları | Protokolün kendi mekanizması |

## 6.5 Hız sınırı

`429` + `Retry-After`. Öneri: `/offers` için kurum başına 100/dk,
`/presentations` için 1000/dk. Tamga Verify sunum açma (`/presentations`), cüzdan yanıtı (`/vp/response`) ve kapı doğrulama
(`/terminal/verify`) uçlarında `429 rate_limited` + `Retry-After` döner; istemci adresi saklanmaz ve loglanmaz.

Örnek sitenin sunum başlatma ucu (`/sample-site/start`, yalnız sandbox) da sınırlıdır. Vekil istemci adresini iletmediğinden beyansız istekler tek kovayı paylaşır; vekil her istekte kendi yazdığı bir istemci anahtarı başlığı gönderiyorsa (`TAMGA_VERIFY_CLIENT_KEY_HEADER`) kovalar istemci başına ayrılır. Başlık yalnız yerel vekilden gelen istekte okunur; değeri saklanmaz ve loglanmaz.

---

# 7. Değişmezler

| # | Değişmez |
|---|---|
| **AP1** | Adım kodunun anlamı asla değişmez; kaldırılan kod yeniden kullanılmaz. |
| **AP2** | `INDETERMINATE`, `REJECTED` ile aynı kovaya konmaz. |
| **AP3** | Sonuç nesnesi claim değerlerini değil adlarını taşır. |
| **AP4** | `idx` hiçbir API yanıtında veya kayıtta bulunmaz. |
| **AP5** | HTTP durum kodu doğrulama sonucunu kodlamaz. |
| **AP6** | Politikanın `required_claims`'i RP'nin güven listesindeki kaydının scope'unu aşamaz. |
| **AP7** | Hata `detail` alanı kişisel veri içermez. |
| **AP8** | `C2` (şema yetkisi) hiçbir yapılandırmayla atlanamaz. |
| **AP11** | `C1` ve `C2` belgenin `iat`'ını alır; belge verme zamanı sorguları doğrulamada kullanılmaz. İstisna: ZK sunumunda (`mso_mdoc_zk`) belgenin imza anı ispatta gizlidir; `C1` ve `C2` ispatın zaman damgasını alır (§1.1, [[ADR-0032]]). |
| **AP12** | `issuerId` `x5c` yaprak parmak izinden türetilir, `iss` claim'inden değil. |
| **AP13** | Geçiş kartı jetonu doğrulaması ([[ADR-0012]] B): imza `pass_grant`'taki kopya anahtarıyla, `aud` = doğrulayıcının kalıcı kimliği (güven listesindeki kaydının `dns_name`'i; sertifika yenilense de değişmez, [[ADR-0034]]), ömür (`exp` − `iat`) ≤ 60 s, `iat` ≤ şimdi + 30 s, `exp` ≤ şimdi + 60 s + 30 s (saat kayması toleransı), `jti` tekrar listesi (terminal grubu içinde çevrim içi paylaşılır); jetondan kişisel veri çıkarılmaz ve loglanmaz. Kapı isteği terminal anahtarıyla gelir; anahtarsız istek jetona dokunmaz ([[ADR-0065]] TK1). |
| **AP9** | `E4` (denetim kaydı) reddedilen doğrulamalarda da çalışır (denetim kaydı yeri olan doğrulayıcıda; barındırılan doğrulayıcıda her zaman). |
| **AP10** | `tx_code` yanıt dışında hiçbir yerde saklanmaz. |

---

# Güvenlik ve Mahremiyet Notları

**Sonuç nesnesi bir denetim artefaktıdır.** AP3 ve AP4 birlikte, saklanan kaydın bir takip yüzeyine dönüşmesini engeller.
Referans doğrulayıcı (`apps/verify`) denetim kaydını bugün **yalnız bellekte** tutar: son 1000 olay, süreç yeniden başlayınca
silinir; kalıcı saklama ve [[ARCH-0004]] §5.4'teki 12 aylık süre **planlanan** davranıştır, bugün güvence değildir (2026-11-19).
`/claims` okuması da değer içermeyen bir olay olarak kayda düşer (`claims.read`: doğrulama kimliği, politika, verildi mi).

**`/claims` ucu ayrı yetkilendirilir.** Doğrulama sonucunu görmek ile
açıklanan değerleri okumak farklı yetkilerdir. Bir İK asistanı "aday
doğrulandı" görebilir ama not ortalamasını (açıklanmışsa) görmeyebilir.

**`checks_skipped` boş değilse dikkat.** Bir adım uygulanmamış demektir: biçimin taşımadığı (ör. mdoc ve ZK sunumunda
`C4`), politikanın istemediği (`C3`), çağıranın bilerek kapattığı (`E3`, `E4`) ya da uygulamanın yapmadığı bir adım; eski bir
SDK da bir kontrolü atlamış olabilir ([[ARCH-0005]] §4.1). Doğrulayıcı uygulaması atlananları **görünür** kılmalı, sessizce
kabul etmemelidir.

**Preflight bir sızıntı yüzeyi olabilir.** `/offers/preflight`, `subject_ref`
ile sorgulanır ve "bu öğrenci var mı" sorusunu cevaplar. Kurum içi bir uçtur;
dışarı açılmamalıdır.

---

# Açık Konular

1. `E1`–`E3` politika adımları kurum tarafından özelleştirilebilir. Nereye
   kadar? Tamamen serbest bırakmak `C2`'yi dolaylı olarak atlatabilir mi?
   AP8 bunu yasaklıyor ama teknik zorlama mekanizması yazılmadı.
2. `/claims` ucunun yetki modeli (rol tabanlı mı, alan bazlı mı) tanımlanmadı.
3. Toplu doğrulama ucu (`POST /presentations/batch`) gerekli mi? Bir üniversite
   binlerce mezunu toplu doğrulatmak isteyebilir — ama bu, kişi bazlı sunum
   modeliyle çelişir.
4. `subject_ref`'in belge veren içinde nasıl saklandığı bu dokümanın kapsamı
   dışında ama kurumun KVKK yükümlülüğüdür; `PM-GTM-0001` pilot sözleşmesinde
   ele alınmalı.
5. Adım kodu kayıt defterinin makine okunur hâli (`step-codes.json`)
   `@tamga-network/core`'da yayınlanmalı mı? Muhtemelen evet → [[ARCH-0005]].

---

# İlgili Dokümanlar

[[ARCH-0003]] · [[ARCH-0004]] · [[ARCH-0005]] · [[SPEC-CRED-0002]] ·
[[SPEC-CRED-0003]] · [[SPEC-SCHEMA-0001]] · [[SPEC-SCHEMA-0002]] ·
[[SPEC-BC-0001]] · [[SPEC-PROTO-0001]] · [[SPEC-PROTO-0002]] · [[INVARIANTS]]

---

# Durum

**Yürürlükte** — sürüm 1.0.0 (2026-10-02).

**Sürüm notu (2026-11-19, ikinci; denetim turu — sürüm 1.0 kalır).** Denetim turunda şartname metni referans uygulamaya ve
OpenAPI belgesine göre düzeltildi, davranış değişmedi: ön adım `T0` (§1.0) ve takma ad adımı `P1` (§1.F) kayıt defterine girdi;
A-sırası, `policyCredentialId` denetimi ve dış liste kullanılamazken `B2`'nin `INDETERMINATE`'i yazıldı (§1.A, §1.B, §1.3); `B3`'te
tür tanımlarının pakete gömülü olduğu yazıldı; örnek sonuç gerçek çıktı biçimine getirildi (§2.2); `410` ve tüketilmiş sunuma
gelen yanıtın `400`'ü eklendi (§3); doğrulayıcının tabanı, kimlik doğrulaması, okunan istek alanları ve OpenAPI başvurusu
düzeltildi (§4, §4.1); AP6'nın barındırılan doğrulayıcıda sunum açılırken denetlendiği yazıldı (§4.4); hata biçimi, sürümleme ve
kimlik doğrulama tablosu bugünkü servislere göre yazıldı (§6.1, §6.3, §6.4).

**Sürüm notu (2026-11-19; denetim turu — sürüm 1.0 kalır).** Protokol denetim turu: okunamayan `status`
girişi `D1`'de REDDEDİLİR (§1.D); mdoc'ta ileri tarihli `signed` `A3`'te, `validFrom` < `signed` `A7`'de REDDEDİLİR (§1.A; ZK
sunumunda `signed` gizli olduğundan bu kontrol uygulanmaz — ZK yolunda zaman denetimi ispat anı ve sertifikadır); `REVOKED` tip
`B2`'de REDDEDİLİR; iptal listesinin boyutu `bits` ile sınırlanır ve aşım `D4` DOĞRULANAMADI'dır (§1.D); güven listesi bayatken
`503` (§3); politika örneği T0'dan geçecek biçimde düzeltildi (§4.4); `Idempotency-Key` planlanan olarak işaretlendi (§6.2); denetim
kaydının saklanışı bugünkü bellek içi davranışla yazıldı (Güvenlik notları).

**Sürüm notu (2026-11-12; proje yönetimi onayıyla — davranış değişmedi).** Belge–kod taramasından kalan üç sapma belge
tarafında kapatıldı ve karar belgelerine bağlandı: ZK sunumunda `C1`/`C2`'nin ispat anına göre sorulması AP11'in açık istisnası
([[ADR-0032]] uygulama notu; §1.1, AP11 satırı); mdoc ve ZK sunumunda `C4`'ün uygulanmaması ve sınıfın `issuer.class`'tan
okunması ([[ADR-0010]] uygulama notu; §1.C); `A3d` ve `A8` kodlarının raporlanışı ([[ADR-0056]] uygulama notu; §1.3).

