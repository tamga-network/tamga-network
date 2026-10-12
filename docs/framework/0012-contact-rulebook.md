---
document_id: FW-RB-0005
title: "Contact Rulebook"
status: Active
version: 1.0.0
created: 2026-10-11
last_updated: 2026-10-11
summary: >
  Kimlik servisinin verdiği iki iletişim belgesinin (doğrulanmış e-posta adresi `urn:tamga:contact:EmailAddress:1`, doğrulanmış
  telefon numarası `urn:tamga:contact:PhoneNumber:1`) rulebook'u, AB Attestation Rulebook şablonunun bölüm yapısıyla: öznitelikler
  ve üst veri, hukuki kategori, SD-JWT VC kodlaması, sahiplik kanıtı, kullanım, güven çapaları, geçerlilik ve iptal. Tamga
  Rulebook'tan dallanır; kaynak ADR-0021'dir.
---

| Sürüm | Tarih | Açıklama |
|---|---|---|
| 1.0.0 | 2026-10-11 | İlk yayın (Tamga ARF 1.0 içinde). İletişim belgelerinin kuralları [[ADR-0021]]'den AB Attestation Rulebook şablonunun (sürüm 1.5) yapısıyla derlendi; yeni kural yok. |

**Şema sahibi:** Tamga Network (bugün geçici işletmeci). **Geri bildirim:** <https://github.com/tamga-network/tamga-network/issues>

---

# 1. Giriş

## 1.1 Kapsam ve amaç

| Tür | `vct` | Katalog |
|---|---|---|
| Doğrulanmış e-posta adresi | `urn:tamga:contact:EmailAddress:1` | `schemas.tamga.network/v1/contact/EmailAddress/1.0.0` |
| Doğrulanmış telefon numarası | `urn:tamga:contact:PhoneNumber:1` | `schemas.tamga.network/v1/contact/PhoneNumber/1.0.0` |

**Amaç:** siteler ve kurumlar kişinin e-posta adresini ya da telefon numarasını her seferinde kendi kodlarını göndererek doğrulamak
yerine bu belgeyi ister; kanıt bir kez alınır, cüzdanda saklanır ([[ADR-0021]]). Belge yalnız "bu adres bu cüzdanın elindeydi" der,
kişinin kim olduğunu söylemez. İki tür de AB gözünde nitelikli olmayan **[[t:EAA]]**'dır; eIDAS 2.0 ve EUDI ARF e-posta ya da
telefon için ayrı bir PID alanı ya da tanımlı bir tür öngörmez.

## 1.2 Belge yapısı

Bölüm 2 öznitelikler ve üst veri; Bölüm 3 kodlama; Bölüm 4 kullanım ve belge verme; Bölüm 5 güven çapaları; Bölüm 6 geçerlilik
ve iptal; Bölüm 7 AB uyumu.

## 1.3 Anahtar kelimeler

**MUST**, **MUST NOT**, **SHOULD** ve **MAY** RFC 2119 anlamındadır (Tamga Rulebook §0).

## 1.4 Terimler

Terimler Ek D'dedir; AB terimleri ARF Annex 1 anlamındadır.

---

# 2. Öznitelikler ve üst veri

## 2.0 AB şartları ve bu belgedeki karşılıkları

| Şart | Karşılık |
|---|---|
| EAA olduğunun göstergesi (ARB_12) | §2.1 — `category` yok |
| Belge verenin kimliği, Ek V b (ARB_15) | `iss` (kimlik servisi) ve `x5c` yaprak sertifikası |
| Öznenin kimliği, Ek V c (ARB_17) | Bilerek yoktur: belge kimlik bilgisi (ad, kimlik numarası, doğum tarihi) taşımaz (CT3); konusu adres ya da numaradır |
| Geçerlilik başlangıcı ve sonu, Ek V e (ARB_19) | `iat`, `exp` |
| Güven çapasının konumu, Ek V h (ARB_21) | Belgede ayrı alan yoktur; konum §5'teki listelerdir |

## 2.1 Giriş ve hukuki kategori

Her adres ya da numara ayrı bir belgedir; bir kişi birden çok adres ekleyebilir. **Hukuki kategori:** iletişim belgesi `category`
**MUST NOT** taşımak (CT3; [[ADR-0021]] K4): belge nitelikli değildir ve kamu kurumu belgesi değildir. Bu yokluk ETSI TS 119 472-1
kuralına uygun göstergedir (AB şablonundaki `category`; ARF metninde eski adı `attestation_legal_category`, ARB_25).

## 2.2 Zorunlu öznitelikler

| Tür | Veri tanımlayıcısı | Tanım | Veri türü | Örnek değer |
|---|---|---|---|---|
| E-posta | `email` | Sahipliği kanıtlanmış e-posta adresi, küçük harfe indirilmiş | metin (e-posta) | `ayse@example.org` |
| Telefon | `phone_number` | Sahipliği kanıtlanmış telefon numarası, E.164 | metin (`+` ve 7–15 hane) | `+905321234567` |

## 2.3 İsteğe bağlı öznitelikler

Yok.

## 2.4 Koşullu öznitelikler

Yok.

## 2.5 Zorunlu üst veri

| Veri tanımlayıcısı | Tanım | Veri türü | Örnek değer |
|---|---|---|---|
| `iss` | Belge verenin adresi (kimlik servisi) | URI | `https://id.tamga.network` |
| `vct`, `vct#integrity` | Tür ve tür tanımının özeti | URN, `sha256-…` | `urn:tamga:contact:EmailAddress:1` |
| `iat`, `exp` | Verildiği an ve geçerliliğin sonu (≤ 1 yıl) | NumericDate | — |
| `cnf` | Cüzdanın cihaz anahtarı | JWK | — |
| `status` | İptal listesi atfı | nesne | `{"status_list":{"idx":3307,"uri":"https://status.tamga.network/90ad5e2c"}}` |

## 2.6 İsteğe bağlı üst veri

Yok.

## 2.7 Koşullu üst veri

Yok (`category` yoktur).

---

# 3. Kodlama

## 3.1 ISO/IEC 18013-5 (mdoc)

**Yakın alan analizi (ARB_02).** İletişim bilgisinin internetsiz, yüz yüze gösterilmesi için bir kullanım durumu yoktur; belge
yalnız SD-JWT VC olarak verilir, mdoc temsili yoktur ([[ADR-0021]] K4).

## 3.2 SD-JWT VC

HAIP 1.0'ın SD-JWT VC profiline uygun (ARB_01b): `alg` ES256, `typ` `dc+sd-jwt`, `x5c`, `vct#integrity` zorunlu. Claim adları IANA
kayıtlı adlardır (ARB_06b, ARB_08).

| Veri tanımlayıcısı | Claim adı | Kodlama | Kaynak | Seçici açıklama |
|---|---|---|---|---|
| `email` | `email` | string | OpenID Connect Core §5.1 (IANA) | MUST |
| `phone_number` | `phone_number` | string (E.164) | OpenID Connect Core §5.1 (IANA) | MUST |
| `iss`, `vct`, `vct#integrity`, `iat`, `exp`, `cnf`, `status` | aynı | — | taşıma profili | MUST NOT |

AB PID'de aynı bilgiler isteğe bağlı `email` ve `phone_number` adlarıyla geçer (mdoc'ta `email_address`, `mobile_phone_number`);
Tamga'nın iletişim belgesi PID'in parçası değildir, ayrı bir EAA'dır.

**Örnek (e-posta; JWT claim kümesi, açıklama çözülmüş hâliyle):**

```json
{
  "iss": "https://id.tamga.network",
  "vct": "urn:tamga:contact:EmailAddress:1",
  "vct#integrity": "sha256-…",
  "iat": 1791763200,
  "exp": 1823299200,
  "cnf": { "jwk": { "kty": "EC", "crv": "P-256", "x": "…", "y": "…" } },
  "status": { "status_list": { "idx": 3307, "uri": "https://status.tamga.network/90ad5e2c" } },
  "email": "ayse@example.org"
}
```

## 3.3 W3C VCDM

Kullanılmaz.

---

# 4. Kullanım

## 4.1 Kullanım durumları

Sitede kayıt ya da iletişim bilgisi güncellemesi, kurumun kişiye ulaşacağı adresi kişinin kendisinin sunması. Adres siteler arası
bir tanımlayıcıdır; yalnız kişinin onayıyla açılır. **PID istenmesi (ARB_27):** gerekmez. İşlem verisi (ARF Topic 20) tanımlı
değildir. Doğrulayıcı kanonik hattı uygular (RB-RP-03); sonuç üç değerlidir.

## 4.2 Belge verme politikası

| Şart | Değer |
|---|---|
| Belge veren | Yalnız Tamga Network kimlik servisi (`IDENTITY` · `EAA` · I2) |
| Kimlik doğrulama | Gerekmez (T0): belge yalnız sahipliği kanıtlar |
| Sahiplik kanıtı | Tek kullanımlık 6 haneli kod e-postayla ya da SMS ile gider; doğru kod girilince belge verilir (CT1). Kod 10 dakika geçerli, en çok 5 deneme; akış başına en çok 3, adres başına saatte en çok 5 gönderim; kod yalnız özet olarak bellekte tutulur |
| Akış | Kimlik belgesiyle aynı: [[t:OpenID4VCI]] yetkilendirme kodu + [[t:PAR]] + PKCE + cüzdan kanıtı (WIA, KA; RB-AP-10) |
| Veri | Adres yalnız akış süresince bellekte; belge verildikten sonra silinir; veritabanında yalnız anahtarlı özet. Adres, numara ve kod günlüğe yazılmaz, ekranda maskeli gösterilir (CT2) |
| Gönderim sağlayıcısı | Ayarla seçilir; hiçbiri ayarlı değilse tür tanıtım bilgisinde ilan edilmez. Test yolları gerçek kullanıcıya açık ortamda kullanılmaz (CT4) |
| Gömülü açıklama politikası | Taşımaz ([[ADR-0046]] K1) |

## 4.3 Cihaza bağlılık

İki tür de **cihaza bağlıdır** (ARB_34; `cnf`). `cryptographically_bound_to` kullanılmaz.

---

# 5. Güven çapaları

Nitelikli olmayan EAA için güven çapası Tamga'nın imzalı güven listelerinden alınır (ARB_26): listelerin listesi
(`https://trust.tamga.network/lotl.jws`) ve ulusal liste (`tl-tr.jws`) kök sertifikalara göre doğrulanır (kök parmak izleri
`tamga.network/trust-anchor`, RB-OP-06); belgenin `x5c` zinciri ulusal köke zincirlenir; `tl-tr › issuers[]` kaydı kimlik servisinin
bu iki türe yetkisini verir; tür `lotl › schemas[]` ve `vct#integrity` ile doğrulanır.

---

# 6. Geçerlilik ve iptal

## 6.1 Geçerlilik politikası

`exp` = verildiği an + 365 gün. Numara ve adresler başkasına geçebildiği için geçerlilik en çok bir yıldır; kanıt yalnız belge
verildiği andaki sahipliği gösterir.

## 6.2 İptal

| Konu | Kural |
|---|---|
| İptal edilebilir mi | **Evet, zorunlu** — Token Status List (AB'nin Attestation Status List'i) |
| İptal koşulları | Aynı adres yeniden kanıtlanınca eski belge; kişinin silme talebi (kimlik servisinden alınmış bütün belgeler); rızanın geri alınması (RB-AP-21) — ayrıntı [[FW-POL-0001]] §3 |
| Liste adresi (ARB_24a) | Belgedeki `status.status_list.uri`; kimlik servisinin listeleri `https://status.tamga.network/` altında; adres opaktır |
| Yayın | Sabit aralıkla (bugün 2 dakika), değişiklik olmasa da (RB-AP-17) |

---

# 7. Uyum

- Bu rulebook AB Attestation Rulebook şablonunun (1.5) bölüm yapısını izler (ARB_29); Topic 12 eşlemesi Tamga Rulebook §11'dedir.
- İki tür Tamga Rulebook'un bütün kurallarını devralır; türe özgü değişmezler [[ADR-0021]] CT1–CT4'tür.
- **Bilinen farklar:** öznenin kimliği (ARB_17, SHOULD) bilerek yoktur; güven çapası konumu belgede alan olarak yoktur ve nitelikli
  olmayan EAA göstergesinde AB şablonu ile ETSI arasındaki fark çözülmemiştir (Identity Rulebook §7.2 ile aynı; **karar
  bekliyor**).

---

# 8. Kaynaklar

AB Attestation Rulebook şablonu, ARF Annex 2 Topic 7 ve 12, ETSI TS 119 472-1, SD-JWT VC, HAIP 1.0, OpenID Connect Core 1.0, IETF
Token Status List. Bu belgenin dayandığı Tamga kararları ve şartnameleri Ek E'de listelenir.

# Durum

**Yürürlükte** — sürüm 1.0.0 (2026-10-11).
