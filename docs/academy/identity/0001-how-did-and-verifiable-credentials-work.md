---
document_id: ACA-ID-0001
title: DID ve Verifiable Credentials Nasıl Çalışır
category: Academy
domain: Identity
status: Draft
review_status: Draft
version: 0.1.1
created: 2026-07-29
last_updated: 2026-09-30
authors:
  - Tamga Network Engineering
language: tr
document_type: academy
audience:
  - learners
  - engineers
  - product
  - ai-agents
stability: Stable
maturity: Foundational
tags:
  - did
  - verifiable-credentials
  - ssi
  - selective-disclosure
  - zkp
  - identity
  - education
keywords:
  - decentralized identifier
  - verifiable credential
  - verifiable presentation
  - self-sovereign identity
  - issuer holder verifier
  - selective disclosure
  - SD-JWT
  - zero knowledge proof
  - OpenID4VCI
  - OpenID4VP
related:
  - ACA-CRYPTO-0001
  - RS-EIDAS-0001
  - RS-EBSI-0001
  - PM-PH-0001
see_also:
  - PM-TRUST-0001
summary: >
  DID (merkeziyetsiz kimlik) ve Verifiable Credentials'ı sıfırdan öğreten Academy
  dokümanı. SSI üçgeni (Issuer–Holder–Verifier), DID ve DID Document, VC/VP yapısı,
  issuance→holding→presentation→verification akışı (OpenID4VCI/VP), seçici açıklama
  ve ZKP ("istersek açarız"), iptal, ve doğrulayanın issuer'a nasıl güvendiği.
  ACA-CRYPTO-0001'in imza bilgisini kimliğe uygular; Tamga Wallet'ın nasıl çalışacağını
  anlaşılır kılar.
priority: High
---
> **Sürüm notu 0.1.1 (2026-09-30) — ürün adı:** TamgaID → Tamga Wallet / “Tamga ile giriş yap” (proje yönetimi kararı; anlam değişmedi).

# Bu Doküman Kimin İçin?

Bu doküman, [[ACA-CRYPTO-0001]]'deki dijital imzayı **dijital kimliğe** uygular. Sonunda **Tamga Wallet'ın nasıl çalışacağını** — kimlik nasıl temsil edilir, belge nasıl verilir, nasıl gösterilir, nasıl doğrulanır — kavramış olacaksın.

Ön koşul: [[ACA-CRYPTO-0001]] (hash, açık/özel anahtar, imza).

---

# 1. Problem: Bugünkü Kimlik Kırık

Bugün kimliğin platformlarda dağınık ve onların kontrolünde:
- Her siteye ayrı hesap açarsın.
- Kimliğini kanıtlamak için belgenin **aslını/fotokopisini** verirsin (gereğinden fazla bilgi paylaşırsın).
- Verini platform tutar; sen kontrol edemezsin.

**Self-Sovereign Identity (SSI)** bu modeli tersine çevirir: **kimlik ve belgeler kullanıcının elinde (cüzdanında) durur**, kullanıcı neyi kime göstereceğine kendisi karar verir.

Tamga ([[PM-PH-0001]]) tam olarak bu holder-centric modeli benimser.

---

# 2. SSI Üçgeni: Issuer – Holder – Verifier

Tüm sistem üç rol arasındaki bir üçgendir:

```text
        (imzalı belge verir)
   ISSUER ───────────────────► HOLDER
   (veren)                     (taşıyan/kullanıcı)
      ▲                            │
      │                            │ (belgeyi sunar)
      │ (issuer güvenilir mi?)     ▼
      └──────────────────────  VERIFIER
                                (doğrulayan)
```

- **Issuer (veren):** belgeyi imzalayıp veren kurum (üniversite, devlet, banka).
- **Holder (taşıyan):** belgeyi cüzdanında tutan kullanıcı (sen).
- **Verifier (doğrulayan):** belgeyi kontrol eden taraf (işveren, web sitesi).

> **Senin ifadenle:** "Holder–Issuer–Verifier (işveren vb.) şeklinde ilerliyoruz." Bu üçgen SSI'nin tamamıdır. Tamga Wallet = **Holder** cüzdanı.

---

# 3. DID — Merkeziyetsiz Kimlik (Decentralized Identifier)

Bir **DID**, bir varlığın (kişi, kurum, nesne) **kimseye bağlı olmadan sahip olduğu benzersiz kimliktir.** E-posta gibi bir sağlayıcıya (Gmail) muhtaç değildir; kullanıcı onu kendi üretir ve kontrol eder.

## Yapısı
```text
did:ebsi:zabc123...
 │    │      │
 │    │      └── benzersiz kimlik
 │    └───────── yöntem (method): DID'in nerede/nasıl çözüldüğü
 └────────────── sabit önek
```

## DID Document
Her DID'in bir **DID Document**'i vardır. İçinde en önemli şey: o kimliğe ait **açık anahtar(lar).** Yani "bu DID'in imzasını şu açık anahtarla doğrula" bilgisi.

## İki Önemli Yöntem (EBSI örneği)
- **`did:ebsi`** — tüzel kişiler (kurumlar) için; DID Document'i **zincirde** (registry) tutulur, herkes erişir.
- **`did:key`** — gerçek kişiler için; zincire yazılmaz, DID doğrudan anahtardan türer, **kullanıcıda kalır.**

> [[PM-TRUST-0001]] & [[RS-EBSI-0001]]: Kurumlar zincirde (did:ebsi), bireyler zincirde değil (did:key). Mahremiyetin kriptografik uygulaması budur.

---

# 4. Verifiable Credential (VC) — Dijital İmzalı Belge

Bir **Verifiable Credential**, fiziksel bir belgenin (diploma, kimlik kartı) kriptografik olarak imzalı dijital halidir.

## İçinde Ne Var?
```text
{
  "issuer":  did:ebsi:üniversite...        (kim verdi)
  "subject": did:key:z6Mk...              (kime ait)
  "claims":  { "derece": "Bilgisayar Müh.", "yıl": 2025 }   (iddialar)
  "proof":   <üniversitenin özel anahtarıyla İMZA>          (ACA-CRYPTO §4)
}
```

Kilit nokta: **proof** alanı, issuer'ın imzasıdır. Bu imza sayesinde belge:
- değiştirilemez (bütünlük),
- sahte üretilemez (kimlik),
- inkâr edilemez.

Belge kullanıcının cüzdanında durur — zincirde değil.

---

# 5. Verifiable Presentation (VP) — Belgeyi Sunmak

Kullanıcı bir belgeyi doğrulayana gösterirken, onu doğrudan vermez; bir **Verifiable Presentation** oluşturur:

- Bir veya birden çok VC'yi bir araya getirir,
- **Kendi** özel anahtarıyla imzalar (böylece "bu belgeleri sunan gerçekten benim, holder benim" kanıtlanır),
- İsteğe göre **sadece gerekli kısmı** açar (bkz. §7).

---

# 6. Tam Akış: Verme → Taşıma → Sunma → Doğrulama

```text
1. ISSUANCE (verme)      — Issuer, VC'yi imzalar ve kullanıcıya verir.
                           Protokol: OpenID4VCI.
2. HOLDING (taşıma)      — VC, kullanıcının cüzdanında (Tamga Wallet) durur.
3. PRESENTATION (sunma)  — Kullanıcı, Verifier'a bir VP sunar.
                           Protokol: OpenID4VP.
4. VERIFICATION (doğrulama) — Verifier iki şeyi kontrol eder:
     a. İmzalar geçerli mi?         (ACA-CRYPTO §4)
     b. Issuer güvenilir mi?         (registry/trusted list — §8)
```

> Protokoller [[RS-EIDAS-0001]] §4'te tanımlı: OpenID4VCI (issuance), OpenID4VP (presentation). Tamga "uyumlu ama bağımsız" olarak bunları kullanır ([[PM-PH-0001]]).

---

# 7. Seçici Açıklama ve ZKP — "İstersek Açarız"

Fiziksel dünyada yaşını kanıtlamak için kimliğini gösterirsin ve **adres, TC no dahil her şeyi** ifşa edersin. SSI bunu çözer:

## Seçici Açıklama (Selective Disclosure — SD-JWT)
Belge, alanları tek tek açılabilecek şekilde imzalanır. Kullanıcı yalnızca **istediği alanı** gösterir. Örn. diplomadan sadece "derece"yi göster, "not ortalaması"nı gizle.

## Sıfır Bilgi İspatı (Zero-Knowledge Proof — ZKP)
Daha da güçlüsü: bir bilgiyi **hiç ifşa etmeden** onunla ilgili bir önermeyi kanıtlamak. Örn. doğum tarihini **hiç göstermeden** "18'den büyüğüm" ispatı.

> **Senin ifadenle:** "Bilgilerimizi istersek açıyoruz, yani ZKP olacak bizde de." Doğru — iki mekanizma var: SD-JWT (alan gizle) ve ZKP (önerme kanıtla). Hangisi/ikisi de → ileride spec kararı. EUDI ağırlıkla SD-JWT kullanır, ZKP gelişmekte.

---

# 8. Doğrulayan Issuer'a Nasıl Güvenir?

Bir imzanın geçerli olması yetmez; **imzalayan issuer'ın güvenilir olması** gerekir. (Sahte bir "üniversite" de teknik olarak geçerli imza atabilir.)

Çözüm — [[ACA-CRYPTO-0001]] §6 (PKI) + blockchain:
- Issuer'ın DID'i ve açık anahtarı bir **güven registry'sinde** (Trusted Issuers Registry) kayıtlıdır.
- Bu registry Tamga'da **zincirdedir** ([[PM-TRUST-0001]]): değiştirilemez, herkese açık.
- Doğrulayan, "bu issuer bu şemayı vermeye yetkili ve güvenilir mi?" sorusunu buradan yanıtlar.

Güven zinciri ([[RS-EBSI-0001]] §4): **Kök otorite → akredite kurum → issuer → kullanıcı.**

---

# 9. İptal (Revocation)

Bir belge geçerliliğini yitirebilir (diploma iptali, ehliyet askıya alma). Doğrulayan, belgenin **hâlâ geçerli mi** olduğunu kontrol etmelidir.

- Yöntem: **status list** — her belgenin durumunu tutan, mahremiyet korumalı bir yapı.
- **Dikkat:** naif iptal listesi izlenebilirlik yaratır ([[RS-EIDAS-0001]] §6). Bu yüzden unlinkable tasarım gerekir → RS-REVOCATION-0001 (planlı).

---

# 10. Her Şeyi Birleştirme — Tamga Wallet Nasıl Çalışacak

```text
• Devlet/kurum (ISSUER): did:ebsi benzeri kimlikle zincirde kayıtlı;
  vatandaşa imzalı VC verir (OpenID4VCI).
• Vatandaş (HOLDER): Tamga Wallet'ta VC'lerini + kendi did:key'ini tutar;
  özel anahtarı cihazın Secure Element'inde (ACA-CRYPTO §7).
• İşveren/kurum (VERIFIER): VP ister (OpenID4VP); imzayı ve issuer güvenini
  (zincirdeki registry) doğrular.
• Kullanıcı seçici açıklama/ZKP ile yalnızca gerekeni gösterir.
• E-imza: kullanıcı kendi özel anahtarıyla belge imzalar (QES — ACA-CRYPTO §7).
```

Zincir yalnızca **kurum kimliklerini, anahtarları ve güven kayıtlarını** tutar; bireysel belgeler ve kişisel veri hep cüzdanda kalır.

---

# 11. Terimler (Hızlı)

- **SSI:** kullanıcının kendi kimliğini kontrol ettiği model.
- **DID:** sağlayıcıya bağlı olmayan, kullanıcı kontrollü kimlik.
- **DID Document:** DID'e ait açık anahtarları içeren belge.
- **VC (Verifiable Credential):** issuer'ın imzaladığı dijital belge.
- **VP (Verifiable Presentation):** holder'ın sunmak için oluşturduğu, imzalı belge paketi.
- **Issuer / Holder / Verifier:** veren / taşıyan / doğrulayan.
- **Selective Disclosure:** belgenin yalnızca bir kısmını açma.
- **ZKP:** bilgiyi ifşa etmeden önerme kanıtlama.
- **OpenID4VCI / OpenID4VP:** belge verme / sunma protokolleri.

---

# İlgili Dokümanlar

- [[ACA-CRYPTO-0001]] — İmza, açık/özel anahtar, PKI (bu dokümanın temeli).
- [[ACA-BC-0001]] — Blockchain/consensus (registry'nin durduğu yer).
- [[RS-EIDAS-0001]] — SD-JWT VC, mdoc, OpenID4VCI/VP, QES.
- [[RS-EBSI-0001]] — did:ebsi/did:key, Trusted Issuers Registry, trust chain.
- [[PM-PH-0001]] — Tamga Wallet vizyonu; holder-centric felsefe.
- [[PM-TRUST-0001]] — Neyin zincirde olduğu / olmadığı.

---

# Durum

**review_status: Draft.** SSI üçgeni, DID/DID Document, VC/VP, tam yaşam döngüsü, seçici açıklama/ZKP, iptal ve güven modeli öğretici düzeyde kapsandı. Bu doküman ile [[ACA-CRYPTO-0001]] ve [[ACA-BC-0001]] birlikte, teknik framework kararı ([[RS-FRAMEWORKS-0001]]) ve Tamga Wallet mimarisi için gerekli öğrenme zeminini tamamlar.
