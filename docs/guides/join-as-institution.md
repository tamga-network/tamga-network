---
document_id: GUIDE-0007
title: "Kurum olarak ağa katılmak"
status: Active
version: 1.0.0
created: 2026-10-03
last_updated: 2026-10-03
summary: >
  Bir kurumun belge veren olarak Tamga Network'e katılması: başvuru dosyası ve AB ortak kayıt verileri, anahtar ve sertifika
  isteği (CSR), güven listesine giriş, belge türü yetkisi, ilk belge ve kayıt değişiklikleri.
---

# Kurum olarak ağa katılmak

Bu rehber, kişilere dijital belge vermek isteyen kurumlar (üniversite, meslek kuruluşu, kamu kurumu, etkinlik düzenleyicisi)
ve onların teknik ekipleri içindir.

**Ne zaman okunur:**
- Kurumunuz ilk kez belge verecekse, başvurudan önce.
- Önce: [Belge verme](/concepts/issuance) kavramı. Sonra: [[GUIDE-0003]] (belgeyi teknik olarak vermek).
- Doğrulayıcı olarak katılıyorsanız bunun yerine [[GUIDE-0008]].

## Nasıl çalışır?

Bir kurumun belgesine güvenilmesinin tek yolu, kurumun [[t:trust-list|güven listesinde]] kayıtlı olmasıdır. Doğrulayıcı
belgeyi imzalayan sertifikayı listede arar; kurum oradaysa ve o belge türünü vermeye yetkiliyse belge kabul edilir.
Katılmak, bu kaydı yaptırmak demektir:

```
Başvuru dosyası + sertifika isteği (CSR)
        │
        ▼
Kayıt kurumu denetler (eksik alan varsa tek seferde bildirir)
        │
        ▼
Kök CA kurum sertifikasını imzalar  ──▶  Kurum listeye eklenir (en geç 24 saatte yayında)
        │
        ▼
Belge türü yetkisi verilir  ──▶  İlk belge
```

Bugün kayıt kurumu ve liste işletmecisi Tamga'dır; devlet kendi listesini yayınladığında bu rol devlete geçer
([[ADR-0035]] PO3). Özel anahtarınız hiçbir aşamada sizden çıkmaz.

## 1. Rolünüzü ve sınıfınızı belirleyin

| Alan | Değerler | Ne demek |
|---|---|---|
| `category` | `EDUCATION`, `HEALTH`, `GOVERNMENT`, `FINANCE`, `LOGISTICS`, `EVENTS`, `IDENTITY`, `OTHER` | Kurumun alanı |
| `class` | `PUB`, `QUALIFIED`, `EAA` | Kamu kurumu belgesi, nitelikli belge ya da sıradan belge ([[t:EAA]]) |
| `assurance` | `I1`, `I2`, `I3` | Kurumun güvence seviyesi; dayanağı `assurance_basis` alanında yazılır ([[ADR-0005]]) |

Hangi belge türlerini (`vct`) vereceğinizi de seçin: türler [şema kataloğunda](/specifications/schema-catalog) yayınlıdır.
Yeni bir tür gerekiyorsa önce [[SPEC-SCHEMA-0001]] sürecinden geçer.

## 2. Başvuru dosyası

Başvuru bir JSON dosyasıdır. AB'nin ortak kayıt veri seti zorunludur ([[ADR-0024]]); eksik alan varsa kayıt yapılmaz.

```json
{
  "slug": "example-uni",
  "legal_name": "Example University",
  "trade_name": "Example University",
  "category": "EDUCATION",
  "class": "EAA",
  "assurance": "I2",
  "assurance_basis": "Recognised university; identity proofing by presentation of a Tamga Identity Attestation.",
  "cert": "issuer-example-uni",
  "status_cert": "issuer-example-uni-status",
  "vcts": ["urn:tamga:edu:StudentCredential:1", "urn:tamga:edu:DiplomaCredential:1"],
  "authentic_source": { "name": "Example University Student Information System", "mode": "REMOTE" },
  "identifiers": [{ "scheme": "TR-VKN", "value": "TR0000000000" }],
  "postal_address": { "street_address": "Example Street 1", "locality": "Istanbul", "postal_code": "34000", "country": "TR" },
  "contact": { "support_uri": "https://example.edu.tr/support", "email": "privacy@example.edu.tr" },
  "supervisory_authority": { "name": "Kişisel Verileri Koruma Kurumu (KVKK)", "country": "TR", "info_uri": "https://www.kvkk.gov.tr", "form_uri": "https://www.kvkk.gov.tr" }
}
```

Tam örnek: depoda `apps/trust-publisher/registry/examples/issuer-application.example.json`.

- `identifiers`: resmî kimlik numarası (VKN ya da MERSİS). Erişim ve kayıt sertifikalarına da bu numara yazılır ([[ADR-0026]]).
- `authentic_source`: belgenin bilgisinin asıl geldiği sistem, yani [[t:authentic-source|yetkili kaynak]] (öğrenci bilgi sistemi gibi).
  Tamga kişi kaydı tutmaz; bilgi belge verilirken sizin sisteminizden okunur ([[ADR-0020]]).
- `supervisory_authority`: kişilerin şikâyet edebileceği veri koruma kurumu ve başvuru yolu (form adresi, e-posta ya da telefondan
  en az biri); cüzdan bunu onay ekranında gösterir.

## 3. Anahtar ve sertifika isteği

İki anahtar çifti üretirsiniz; ikisi de P-256 (ES256) ve ikisi de sizde kalır:

| Anahtar | İmzaladığı | Başvurudaki ad |
|---|---|---|
| Belge anahtarı | Verdiğiniz belgeler | `cert` |
| İptal listesi anahtarı | [[t:status-list|İptal listeniz]] | `status_cert` |

Her biri için bir sertifika isteği (CSR) üretip başvuruyla gönderin:

```sh
openssl ecparam -name prime256v1 -genkey -noout -out issuer.key.pem
openssl req -new -key issuer.key.pem -subj "/CN=Example University/O=Example University/C=TR" -out issuer.csr.pem
```

Anahtarı donanım güvenlik modülünde (HSM) ya da bulut anahtar yönetiminde (KMS) tutmanız beklenir. Kayıt kurumu CSR'ın
imzasını doğrular, kök CA ile 2 yıllık (en çok 3) bir sertifika üretir ve size gönderir ([[SPEC-ID-0002]]).

## 4. Güven listesine giriş

Kayıt kurumu başvuruyu denetler, kurumu listeye ekler ve listeyi yeniden imzalar. Değişiklik en geç **24 saat** içinde
`trust.tamga.network` adresinde yayında olur. Kaydınız orada şu bilgileri taşır: sertifikanızın parmak izinden türetilen
`issuer_id`, sınıf, güvence seviyesi, belge türü yetkileri, durum ve durum geçmişi. Biçim: [[SPEC-TRUST-0001]].

Kayıttan sonra her [[t:registration-certificate|kayıt sertifikası]] (WRPRC) yayında da otomatik üretilir; cüzdanlar kaydınızı
bununla da denetleyebilir ([[ADR-0026]]).

## 5. Belge türü yetkisi

Yetki belge türü başına verilir. Sonradan yeni tür eklenebilir ya da bir tür bitirilebilir. Bitirilen yetkinin kaydı silinmez;
böylece bitişten önce verilmiş belgeler doğru doğrulanır ([[SPEC-API-0001]] C2).

## 6. İlk belge

İki yol vardır:

- **Barındırılan servis:** Tamga'nın işlettiği belge verme servisini API anahtarıyla kullanırsınız; belgeler yine sizin
  adınıza ve sizin anahtarınızla imzalanır. Adımlar: [[GUIDE-0003]].
- **Kendi servisiniz:** `@tamga-network/issuer` paketiyle [[t:OpenID4VCI]] servisini kendiniz işletirsiniz ([[SPEC-PROTO-0001]]).

Her belge vermeden önce kişinin kimliğini belge türünün istediği seviyede doğrularsınız: [[SPEC-ID-0003]].

## 7. Kayıt değişiklikleri

| Durum | Ne olur |
|---|---|
| `ACTIVE` | Belge verebilir; verdiği belgeler kabul edilir |
| `SUSPENDED` | Geçici olarak belge veremez; askıdayken verilen belge kabul edilmez, askıdan önce verilenler etkilenmez |
| `RETIRED` | Belge vermeyi bıraktı; önceden verdiği belgeler kabul edilmeye devam eder |
| `REVOKED` | Kayıt kapatıldı; anahtar ele geçirildiyse belirtilen tarihten (`invalidates_from`) sonra verilenler düşer. Kurumun yerini bir halef (`successor_id`) alabilir |

Kurala göre doğrulama, kurumun bugünkü durumuna değil belgenin verildiği andaki durumuna bakar ([[SPEC-API-0001]] §1.1).
Sertifika yenileme ve anahtar değişimi: [[SPEC-ID-0002]]. Uyum testleri: [[GUIDE-0009]].

## Kurallar

| Kod | Ne der |
|---|---|
| [[ADR-0024]] RPR1–RPR3 | Kayıt verisi eksiksiz olmadan kayıt yapılmaz |
| [[SPEC-ID-0002]] | Belgeler yalnız kayıtlı sertifikayla imzalanır; anahtar kurumda kalır |
| [[ADR-0020]] | Tamga kişi kaydı tutmaz; bilgi yetkili kaynaktan okunur |

Bağlayıcı kuralların tamamı: [Tamga ARF — Tamga Rulebook, RB-AP](https://arf.tamga.network/tr/rulebook) ve katılım
şartları: [Trust Framework](https://arf.tamga.network/tr/trust-framework).
