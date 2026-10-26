---
document_id: FW-RB-0004
title: "Event Ticket Rulebook"
status: Active
version: 1.0.0
created: 2026-09-27
last_updated: 2026-10-16
summary: >
  Etkinlik biletinin (`urn:tamga:tkt:EventTicket:1`) rulebook'u (Tamga Rulebook'tan dallanır), AB Attestation Rulebook
  şablonunun bölüm yapısıyla: kişisel veri taşımayan, cihaza bağlı, kapıda tek kullanımlık bir belge. Öznitelikler ve üst
  veri, hukuki kategori, SD-JWT VC kodlaması, kim verir, kapıda tek kullanım, doğrulama politikası, güven çapaları,
  geçerlilik, iptal ve devir. Kaynaklar ADR-0012, ADR-0014 ve şema kataloğudur.
---

| Sürüm | Tarih | Açıklama |
|---|---|---|
| 1.0.0 | 2026-10-16 | Tamga ARF 1.0'ın güncel metni; AB Attestation Rulebook şablonunun (sürüm 1.5) bölüm yapısında. |

**Şema sahibi:** Tamga Network (bugün geçici işletmeci). **Geri bildirim:** <https://github.com/tamga-network/tamga-network/issues>

---

# 1. Giriş

## 1.1 Kapsam ve amaç

| Tür | `vct` | Katalog |
|---|---|---|
| Etkinlik bileti | `urn:tamga:tkt:EventTicket:1` | `schemas.tamga.network/v1/tkt/EventTicket/1.0.0` |

**Amaç:** bilet satıcısının ya da organizatörün bileti cüzdana vermesi ve kapının bileti kişiyi tanımadan, bir kez geçirmesi.
Bilet **kişisel veri taşımaz**: kişiyi değil bileti gösterir; cihaz anahtarına bağlıdır (`cnf`), kimlik alanı yoktur. Kapıda kimlik
gerekiyorsa (örneğin isimli bilet) bu ayrı bir gösterimdir (kimlik belgesi, Identity Rulebook). Bilet AB gözünde nitelikli olmayan
bir **[[t:EAA]]**'dır.

## 1.2 Belge yapısı

Bölüm 2 öznitelikler ve üst veri; Bölüm 3 kodlama; Bölüm 4 kullanım, belge verme ve kapıda tek kullanım; Bölüm 5 güven
çapaları; Bölüm 6 geçerlilik, iptal ve devir; Bölüm 7 AB uyumu.

## 1.3 Anahtar kelimeler

**MUST**, **MUST NOT**, **SHOULD** ve **MAY** RFC 2119 anlamındadır (Tamga Rulebook §0).

## 1.4 Terimler

Terimler Ek D'dedir; AB terimleri ARF Annex 1 anlamındadır.

---

# 2. Öznitelikler ve üst veri

## 2.0 AB şartları ve bu belgedeki karşılıkları

| Şart | Karşılık |
|---|---|
| EAA olduğunun göstergesi (ARB_12) | §2.1 |
| Belge verenin kimliği, Ek V b (ARB_15) | `iss`, `x5c` yaprak sertifikası; ayrıca `organizer_name` |
| Öznenin kimliği, Ek V c (ARB_17) | Bilerek yoktur: bilet kişiyi değil cihazı bağlar ([[ADR-0014]]); kişi gerekiyorsa kimlik belgesi ayrıca istenir |
| Geçerlilik başlangıcı ve sonu, Ek V e (ARB_19) | `iat`, `exp` (§6.1); etkinlik zamanı `event_start`, `event_end` |
| Güven çapasının konumu, Ek V h (ARB_21) | Belgede ayrı alan yoktur; konum belge verenin sertifika zinciri ve Tamga güven listeleridir (§5) |

## 2.1 Giriş ve hukuki kategori

Alanlar etkinliği, mekânı ve bilet sınıfını anlatır; satıcının bilet numarası yalnız özetiyle taşınır. **Hukuki kategori
(`category`):** belge veren **MUST** `urn:tamga:eaa:qualified` ya da `urn:tamga:eaa:pub` değerini yalnız kayıt sınıfı nitelikli
ya da kamu ise ve kayıttaki değerle yazmak; I1–I2'de **MUST NOT** (RB-AP-14). Nitelikli olmayan EAA'da yokluk, ETSI TS 119 472-1
kuralına uygun göstergedir (AB şablonundaki adla `category`; ARF metninde eski adı `attestation_legal_category`, ARB_25).

## 2.2 Zorunlu öznitelikler

| Veri tanımlayıcısı | Tanım | Veri türü | Örnek değer |
|---|---|---|---|
| `event_id` | Etkinlik kodu | metin (1–64) | `KONSER-2026-11-21` |
| `event_name` | Etkinlik adı | metin (1–200) | `Kış Konseri` |
| `event_start`, `event_end` | Başlangıç ve bitiş | tarih-saat (RFC 3339) | `2026-11-21T19:00:00+03:00` |
| `venue_name` | Mekân | metin (1–200) | `Kültür Merkezi` |
| `organizer_name` | Organizatör | metin (1–200) | `Örnek Etkinlik A.Ş.` |
| `ticket_class` | Bilet sınıfı (ör. STANDARD, VIP, STUDENT) | metin (1–64) | `STANDARD` |
| `ticket_no_hash` | Satıcının bilet numarasının özeti; satıcı kendi kaydıyla eşler | `sha256-…` | `sha256-…` |
| `gate` | Kapının geçiş kartı alacağı doğrulayıcı: `verifier_client_id`, `terminal_group`, isteğe bağlı `policy_id` | nesne | `{"verifier_client_id":"x509_hash:…","terminal_group":"ana-giris"}` |

## 2.3 İsteğe bağlı öznitelikler

| Veri tanımlayıcısı | Tanım | Veri türü | Örnek değer |
|---|---|---|---|
| `seat` | Koltuk | metin (≤ 32) | `B-14` |

## 2.4 Koşullu öznitelikler

Yok.

## 2.5 Zorunlu üst veri

| Veri tanımlayıcısı | Tanım | Veri türü | Örnek değer |
|---|---|---|---|
| `iss` | Belge verenin adresi | URI | `https://issuer.tamga.network/ornek-bilet` |
| `vct`, `vct#integrity` | Tür ve tür tanımının özeti | URN, `sha256-…` | `urn:tamga:tkt:EventTicket:1` |
| `iat`, `exp` | Verildiği an ve geçerliliğin sonu | NumericDate | — |
| `cnf` | Cüzdanın cihaz anahtarı | JWK | — |
| `status` | İptal ve "kullanıldı" biti için liste atfı | nesne | `{"status_list":{"idx":701,"uri":"https://status.tamga.network/c41f9a07"}}` |

## 2.6 İsteğe bağlı üst veri

Yok.

## 2.7 Koşullu üst veri

| Veri tanımlayıcısı | Koşul | Veri türü |
|---|---|---|
| `category` | Yalnız kayıt sınıfı nitelikli ya da kamu olan belge verende (§2.1) | `urn:tamga:eaa:qualified` \| `urn:tamga:eaa:pub` |

---

# 3. Kodlama

## 3.1 ISO/IEC 18013-5 (mdoc)

**Yakın alan analizi (ARB_02).** Kapıda internetsiz doğrulama gerekir; bunu bilet değil, kişisel veri içermeyen 60 saniyelik imzalı
geçiş jetonu karşılar ([[ADR-0012]]; §4.3): terminal jetonu çevrim dışı doğrular. Bu yüzden bilet mdoc olarak verilmez.

## 3.2 SD-JWT VC

Bilet [[t:SD-JWT-VC]] olarak, HAIP 1.0'ın SD-JWT VC profiline uygun verilir (ARB_01b): `alg` ES256, `typ` `dc+sd-jwt`, `x5c`,
`vct#integrity` zorunlu. Bütün claim adları Tamga'ya özgü adlardır (ARB_06b). "Seçici açıklama" sütunu Type Metadata'daki `sd`
değeridir (ARB_30).

| Veri tanımlayıcısı | Claim adı | Kodlama | Not | Seçici açıklama |
|---|---|---|---|---|
| `event_id`, `event_name`, `venue_name`, `organizer_name`, `ticket_class`, `seat`, `ticket_no_hash` | aynı | string | Tamga'ya özgü | MUST |
| `event_start`, `event_end` | aynı | string (RFC 3339 tarih-saat) | Tamga'ya özgü | MUST |
| `gate` | `gate` | nesne | Tamga'ya özgü; kişisel veri değildir | MUST NOT |
| `iss`, `vct`, `vct#integrity`, `iat`, `exp`, `cnf`, `status`, `category` | aynı | — | taşıma profili | MUST NOT |

**Örnek (JWT claim kümesi, açıklamalar çözülmüş hâliyle):**

```json
{
  "iss": "https://issuer.tamga.network/ornek-bilet",
  "vct": "urn:tamga:tkt:EventTicket:1",
  "vct#integrity": "sha256-…",
  "iat": 1792000000,
  "exp": 1795390800,
  "cnf": { "jwk": { "kty": "EC", "crv": "P-256", "x": "…", "y": "…" } },
  "status": { "status_list": { "idx": 701, "uri": "https://status.tamga.network/c41f9a07" } },
  "gate": { "verifier_client_id": "x509_hash:…", "terminal_group": "ana-giris" },
  "event_id": "KONSER-2026-11-21",
  "event_name": "Kış Konseri",
  "event_start": "2026-11-21T19:00:00+03:00",
  "event_end": "2026-11-21T22:00:00+03:00",
  "venue_name": "Kültür Merkezi",
  "organizer_name": "Örnek Etkinlik A.Ş.",
  "ticket_class": "STANDARD",
  "seat": "B-14",
  "ticket_no_hash": "sha256-…"
}
```

## 3.3 W3C VCDM

Kullanılmaz.

---

# 4. Kullanım

## 4.1 Kullanım durumları

Kapıda geçiş ve bilet sınıfının gösterilmesi. **PID istenmesi (ARB_27):** gerekmez; kapı kişinin adını, doğum tarihini ya da
iletişim bilgisini istemez. İsimli bilette kimlik ayrı bir gösterimdir. İşlem verisi (ARF Topic 20) tanımlı değildir.

## 4.2 Belge verme politikası: kim verir

| Şart | Değer |
|---|---|
| Belge veren | Bilet satıcısı ya da organizatör (ör. bilet platformu) |
| Kategori | `EVENTS` |
| Asgari akreditasyon | I2 |
| Belge türü yetkisi | Bu `vct` için izin listesi kaydı |
| Kimlik doğrulama | Gerekmez (T0) — bilet kişiye değil cihaza bağlanır |
| Cüzdan | Belge vermeden önce WIA ve KA `wallet_providers[]` listesine göre doğrulanır (RB-AP-10) |
| Gömülü açıklama politikası | Kurum isterse imzalı tanıtım bilgisinde yayımlar ([[ADR-0046]], RB-AP-26) |

Not: `EventTicket:1` tür tanımında (değişmez dosya) [[t:issuer|belge veren]] kategorisi `OTHER` yazar; kayıtlar [[ADR-0014]] ile `EVENTS`
kategorisindedir. Tanımdaki düzeltme `EventTicket:2` ile gelir (yayımlanmış dosya değişmez, RB-SCH-02).

## 4.3 Kapıda tek kullanım

1. **Kayıt:** kişi bileti bir kez kapının doğrulayıcısına gösterir (`gate.verifier_client_id`, [[t:OpenID4VP]]); [[t:verifier|doğrulayıcı]]
   bir geçiş hakkı (`pass_grant`) döner.
2. **Kapı:** cüzdan 60 saniyelik, **kişisel veri içermeyen** imzalı geçiş jetonunu karekod olarak gösterir; terminal çevrim dışı
   doğrulayabilir.
3. **Tek geçiş:** geçişte iptal listesindeki bit "kullanıldı" yapılır; iptal listesi sabit aralıkla yayımlandığından aynı
   terminal grubundaki kapılar **ortak bir "kullanıldı" listesi** tutar ve aralık içindeki ikinci geçişi bu liste keser.
4. Organizatör hem belge veren hem doğrulayıcı olduğundan ilişkilendirilemezlik bu tür için anlamsızdır; bu kabul edilmiş
   bir durumdur.
5. Terminal yalnız kayıtlı bir doğrulayıcının altında tanımlanır (`terminal_groups[]`) ve doğrulama servisine o terminal grubu
   için verilmiş terminal anahtarıyla kimlik gösterir; anahtarsız istek jetona dokunmaz ([[ADR-0065]] TK1).
6. Geçiş kartı her gösterimde PIN sormaz: bu, kişinin verdiği **süreli ve kapsamı belli** bir rızaya dayanır; rıza her an geri
   alınır ve her gösterim cüzdanda kayda geçer (Ek A §3.7; cüzdan kuralları [[SPEC-WALLET-0001]]).

## 4.4 Doğrulama politikası (doğrulayıcının yükümlülükleri)

| Politika | Gerekli |
|---|---|
| `event-ticket` (referans) | `vct = EventTicket:1`; belge veren `EVENTS` kategorisinde ve bu türe yetkili, en az I2; iptal edilmemiş ve kullanılmamış; istenen alanlar yalnız `event_id` ve `ticket_class` |

Doğrulama kanonik hattan geçer (RB-RP-03). Sonuç üç değerlidir; `INDETERMINATE` geçiş değildir.

## 4.5 Cihaza bağlılık

Bilet **cihaza bağlıdır** (ARB_34; `cnf`). `cryptographically_bound_to` kullanılmaz.

---

# 5. Güven çapaları

Nitelikli olmayan EAA için güven çapası Tamga'nın imzalı güven listelerinden alınır (ARB_26): doğrulayıcı listelerin listesini
(`https://trust.tamga.network/lotl.jws`) ve ulusal listeyi (`tl-tr.jws`) önceden çeker ve kök sertifikalara göre doğrular (kök
parmak izleri `tamga.network/trust-anchor`, RB-OP-06); belgenin `x5c` zinciri ulusal köke zincirlenir ve `issuer_id` yaprak
sertifikanın parmak izidir; `tl-tr › issuers[]` kaydı kategoriyi (`EVENTS`), sınıfı ve bu türe yetkiyi verir; tür `lotl › schemas[]`
ve `vct#integrity` ile doğrulanır. Kapı terminali listeleri ve kendi doğrulayıcısının anahtarını önceden yükler.

---

# 6. Geçerlilik, iptal ve devir

## 6.1 Geçerlilik politikası

`exp` = etkinliğin bitişi + 1 gün; en çok 400 gün (bir yıl önceden satış). Kopya: **koltuk başına bir kopya**.

## 6.2 İptal

| Konu | Kural |
|---|---|
| İptal edilebilir mi | **Evet, zorunlu** — Token Status List (AB'nin Attestation Status List'i): iptal **ve** kapıda "kullanıldı" biti |
| İptal koşulları | İade, etkinliğin iptali, hatalı satış, devir (§6.3) — ayrıntı [[FW-POL-0001]] §3 |
| Liste adresi (ARB_24a) | Belgedeki `status.status_list.uri`; ağın barındırdığı serviste `https://status.tamga.network/` altında, kendi servisini işleten satıcıda satıcının durum sunucusunda; adres opaktır |
| Yayın | Sabit aralıkla, değişiklik olmasa da (RB-AP-17) |

## 6.3 Devir

Bilet başkasına **aktarılmaz**; devir, satıcının eskisini iptal edip yeni cihaza yeniden vermesidir.

---

# 7. Uyum

- Bu rulebook AB Attestation Rulebook şablonunun (1.5) bölüm yapısını izler (ARB_29); Topic 12 eşlemesi Tamga Rulebook §11'dedir.
- Bilet Tamga Rulebook'un bütün kurallarını devralır.
- **Bilinen farklar:** öznenin kimliği (ARB_17, SHOULD) bilerek yoktur; güven çapası konumu belgede alan olarak yoktur ve eklenmez
  ([[ADR-0047]] K7); nitelikli olmayan EAA'da `category` yazılmaz, ETSI izlenir ([[ADR-0047]] K6); ETSI'nin `oneTime` kısıtı yerine kapıdaki tek kullanım "kullanıldı" bitiyle sağlanır.

---

# 8. Kaynaklar

AB Attestation Rulebook şablonu, ARF Annex 2 Topic 7 ve 12, ETSI TS 119 472-1, SD-JWT VC, HAIP 1.0, IETF Token Status List. Bu
belgenin dayandığı Tamga kararları ve şartnameleri Ek E'de listelenir.

# Durum

**Yürürlükte** — sürüm 1.0.0 (2026-10-16).
