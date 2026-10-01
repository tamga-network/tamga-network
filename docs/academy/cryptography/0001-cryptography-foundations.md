---
document_id: ACA-CRYPTO-0001
title: Kriptografi Temelleri — Hash, Anahtarlar ve Dijital İmza
category: Academy
domain: Cryptography
status: Draft
review_status: Draft
version: 0.1.0
created: 2026-07-29
last_updated: 2026-07-29
authors:
  - Tamga Network Engineering
language: tr
document_type: academy
audience:
  - learners
  - engineers
  - product
  - ai-agents
stability: Timeless
maturity: Foundational
tags:
  - cryptography
  - hash
  - public-key
  - digital-signature
  - pki
  - e-signature
  - education
keywords:
  - hash function
  - simetrik asimetrik şifreleme
  - açık anahtar özel anahtar
  - dijital imza
  - PKI
  - sertifika
  - X.509
  - QSCD
  - elektronik imza
  - P-256
related:
  - ACA-BC-0001
  - RS-EIDAS-0001
  - PM-TRUST-0001
see_also:
  - ACA-ID-0001
summary: >
  Kriptografiyi sıfırdan öğreten Academy dokümanı: hash fonksiyonları,
  simetrik/asimetrik şifreleme, açık/özel anahtar çiftleri, dijital imzanın
  nasıl çalıştığı (özelle imzala, açıkla doğrula), imzanın kanıtladıkları
  (bütünlük, kimlik, inkâr edilemezlik), PKI ve sertifikalar, anahtarların
  nerede saklandığı (Secure Element, HSM, QSCD) ve bunların e-imza (QES) ve
  Tamga'nın güven modeliyle ilişkisi. DID/VC (ACA-ID-0001) için ön koşuldur.
priority: High
---

# Bu Doküman Kimin İçin?

Bu doküman, kriptografiyi hiç bilmeyen birinin **hash, açık/özel anahtar ve dijital imza** kavramlarını sezgisel olarak kavraması için yazıldı. Bunlar Tamga'nın **e-imza** ve **credential** yeteneklerinin temelidir.

[[ACA-BC-0001]] "blockchain nasıl çalışır" dedi; bu doküman "onu güvenli kılan matematik nedir" der. Sonraki adım [[ACA-ID-0001]] (DID/VC) buradaki imza bilgisini kullanır.

---

# 1. Hash Fonksiyonu — Dijital Parmak İzi

Bir **hash fonksiyonu**, her boyuttaki veriyi sabit uzunlukta benzersiz bir "özet"e çevirir.

```text
"Tamga"           → a1b2c3...   (64 karakter)
"Tamga."          → 9f8e7d...   (tamamen farklı!)
10 GB'lık dosya   → 4c5d6e...   (yine 64 karakter)
```

Özellikleri:
- **Deterministik:** aynı girdi hep aynı hash'i verir.
- **Tek yönlü (one-way):** hash'ten orijinal veriye geri dönülemez.
- **Çığ etkisi (avalanche):** girdinin tek biti değişse, hash tamamen değişir.
- **Çakışma direnci:** iki farklı verinin aynı hash'i vermesi pratikte imkânsızdır.

**Ne işe yarar?** Bütünlük kontrolü. Bir belgenin hash'ini kaydedersen, sonra belge değişip değişmediğini hash'i yeniden hesaplayıp karşılaştırarak anlarsın. (Yaygın algoritma: **SHA-256**.)

> [[ACA-BC-0001]] §1: blockchain'de bloklar hash'lerle zincirlenir. [[PM-TRUST-0001]]: bir bireyin belgesinin hash'i bile zincire yazılmaz — çünkü kişiye bağlanabilir.

---

# 2. Şifreleme: Simetrik vs Asimetrik

**Şifreleme (encryption)**, veriyi yalnızca yetkilinin okuyabileceği hale getirmektir. İki tür var:

## Simetrik
- **Tek bir gizli anahtar** hem şifreler hem çözer.
- Analoji: aynı anahtarla kilitlenen ve açılan bir kasa.
- **Sorun:** anahtarı karşı tarafa güvenle nasıl iletirsin? (İnternet üzerinden gönderirsen çalınabilir.)

## Asimetrik (Açık Anahtar Kriptografisi)
- **İki anahtar** vardır ve bir **çift** oluşturur: **açık (public)** ve **özel (private)**.
- Biriyle kilitlenen yalnızca diğeriyle açılır.
- Açık anahtarı herkese verebilirsin; özel anahtarı **asla kimseyle paylaşmazsın.**

Asimetrik kriptografi, modern dijital güvenin temelidir. Devamı buna dayanır.

---

# 3. Açık/Özel Anahtar Çifti — Kalbi Burası

Analoji: **açık asma kilitler dağıtırsın, tek anahtar sende kalır.**

- **Public key (açık anahtar):** Herkese dağıtabileceğin asma kilit gibi. Herkes bununla sana kilitli mesaj gönderebilir veya senin imzanı doğrulayabilir.
- **Private key (özel anahtar):** Yalnızca sende olan anahtar. Kilidi açan (şifre çözen) veya imza atan sensin.

İki temel kullanım:

| Amaç | Kim neyi kullanır |
|------|-------------------|
| **Gizlilik (şifreleme)** | Gönderen senin **açık** anahtarınla şifreler; sadece sen **özel** anahtarınla açarsın. |
| **Kimlik/İmza** | Sen **özel** anahtarınla imzalarsın; herkes senin **açık** anahtarınla doğrular. |

Tamga ve dijital kimlik için asıl önemli olan **ikincisidir: imza.**

---

# 4. Dijital İmza — Nasıl Çalışır?

Dijital imza, bir verinin **senin tarafından** üretildiğini ve **değişmediğini** matematiksel olarak kanıtlar.

## İmzalama (özel anahtarla)
```text
1. Belgenin hash'i hesaplanır.          (§1)
2. Hash, İMZALAYANIN ÖZEL anahtarıyla şifrelenir → bu "imza"dır.
3. İmza, belgeye eklenir.
```

## Doğrulama (açık anahtarla)
```text
1. Doğrulayan, belgenin hash'ini yeniden hesaplar.
2. İmzayı, imzalayanın AÇIK anahtarıyla çözer → içindeki hash'i alır.
3. İki hash aynıysa: imza geçerli.
```

## İmza Neyi Kanıtlar? (Üç Şey)
1. **Bütünlük (integrity):** Belge değişmemiş. (Değişseydi hash'ler tutmazdı.)
2. **Kimlik/Özgünlük (authenticity):** Belgeyi bu özel anahtarın sahibi imzaladı. (Sadece o özel anahtar bu imzayı üretebilir.)
3. **İnkâr edilemezlik (non-repudiation):** İmzalayan "ben imzalamadım" diyemez. (Özel anahtar yalnızca onda.)

> **Kritik sezgi (senin sorunun cevabı):** Bir belgenin doğruluğu, zincirdeki bir kayıttan değil, **üstündeki imzadan** gelir. İmza belgeyle birlikte gezer. Doğrulayanın tek ihtiyacı, imzalayanın **açık anahtarına** güvenmektir. (Onu da zincir/registry sağlar — bkz. §6.)

---

# 5. Hash + İmza Neden Birlikte?

Tüm belgeyi doğrudan özel anahtarla şifrelemek yavaş ve verimsizdir. Onun yerine:

- Belgenin küçük, sabit boyutlu **hash'i** alınır,
- Yalnızca **hash imzalanır.**

Belge 10 GB de olsa imzalanan şey 32 baytlık hash'tir. Hız + güvenlik bir arada. Belge değişirse hash değişir, imza tutmaz — yani hash'i imzalamak tüm belgeyi imzalamaya eşdeğer güvenlik verir.

---

# 6. Bir Sorun: Açık Anahtar Gerçekten Kime Ait? — PKI ve Sertifikalar

Dijital imza harika, ama bir açık var: **Bir açık anahtarın gerçekten "Üniversite X"e ait olduğunu nereden biliyorsun?** Biri sahte bir anahtar çifti üretip "ben Üniversite X'im" diyebilir.

Çözüm: **bir güvenilir otorite** açık anahtarın kime ait olduğunu onaylar.

## Sertifika (Certificate)
Bir **sertifika**, "bu açık anahtar şu kişiye/kuruma aittir" diyen, güvenilir bir otorite tarafından **imzalanmış** bir belgedir. (Standart format: **X.509**.)

## PKI (Public Key Infrastructure)
Sertifikaları veren, yöneten ve iptal eden sistemin tamamına **PKI** denir. Zinciri şöyle işler:

```text
Kök Otorite (Root CA)  →  Ara Otorite  →  Kurumun sertifikası
     (güvenin kökü)         (aracı)          (Üniversite X'in açık anahtarı)
```

Doğrulayan, bir imzayı gördüğünde sertifika zincirini köke kadar takip eder; köke güveniyorsa imzaya güvenir.

> **Tamga/EBSI bağlantısı:** [[RS-EIDAS-0001]] §5'teki "Trusted List" ve [[RS-EBSI-0001]]'deki "Trusted Issuers Registry" tam olarak bu problemi çözer: "hangi açık anahtar hangi güvenilir kuruma ait." Tamga'da bu registry **zincirde** tutulur ([[PM-TRUST-0001]]). Yani blockchain, PKI'nin "kim güvenilir" katmanının değiştirilemez, herkese açık halidir.

---

# 7. Anahtarlar Nerede Yaşar? — Secure Element, HSM, QSCD

Özel anahtar her şeydir; çalınırsa kimliğin çalınır. Bu yüzden özel anahtarlar özel güvenli donanımda saklanır:

| Ortam | Nedir |
|-------|-------|
| **Secure Element (SE)** | Telefon/kart içindeki, anahtarı dışarı çıkarmayan küçük güvenli çip. |
| **HSM (Hardware Security Module)** | Kurumsal, yüksek güvenlikli anahtar donanımı (sunucu tarafı). |
| **QSCD (Qualified Signature Creation Device)** | eIDAS'ta **nitelikli imza (QES)** için gereken sertifikalı güvenli cihaz — SE veya HSM tabanlı olabilir. |

İyi tasarımda özel anahtar **cihazı asla terk etmez.** İmzalama "veriyi cihaza gönder, cihaz imzalasın, imzayı geri al" şeklinde olur.

> **Senin e-imza odağın:** [[RS-EIDAS-0001]] §8'deki QES tam olarak budur — kullanıcının özel anahtarı bir QSCD'de (ör. telefon SE'si veya uzak HSM) durur, imza orada üretilir. Kriptografik olarak §4'teki dijital imzanın, hukuken nitelikli (ıslak imzaya eşdeğer) halidir.

---

# 8. Eğri Ne? — P-256 ve İmza Algoritmaları

Modern imzalar **eliptik eğri kriptografisi (ECC)** kullanır — RSA'ya göre daha kısa anahtarla aynı güvenliği verir.

- **P-256 (secp256r1):** yaygın bir eliptik eğri. [[RS-EIDAS-0001]] §4: EUDI Wallet için zorunlu taban.
- **ECDSA:** bu eğriyle imza atma algoritması (Elliptic Curve Digital Signature Algorithm).
- **SHA-256:** imzalanan hash'i üreten fonksiyon.

Yani EUDI/Tamga'nın taban imza takımı: **ECDSA + P-256 + SHA-256.** (Ayrıntı seçim değil, standart uyumu meselesidir.)

---

# 9. Her Şeyi Birleştirme — Tamga'da İmza ve Güven

Diploma örneğini kriptografiyle tekrar okuyalım:

```text
1. Üniversite (issuer) diploma verisinin HASH'ini alır (§1).
2. Hash'i kendi ÖZEL anahtarıyla imzalar (§4) → imzalı Verifiable Credential.
3. Bu credential kullanıcıya (holder) verilir; cüzdanında durur.
4. Kullanıcı işverene (verifier) gösterir.
5. İşveren:
   a. İmzayı üniversitenin AÇIK anahtarıyla doğrular (§4).
   b. Bu açık anahtarın gerçekten üniversiteye ait ve güvenilir olduğunu
      Trusted Issuers Registry'den (ZİNCİRDE) kontrol eder (§6).
6. İki kontrol de geçerse: belge gerçek ve değişmemiş.
```

**Hiçbir yerde diploma veya hash'i zincirde değil.** Zincirde olan tek şey: **üniversitenin açık anahtarı + güvenilirlik durumu.** Güven, o anahtardan yayılıyor.

Bu, [[PM-TRUST-0001]] kararının kriptografik kanıtıdır.

---

# 10. Terimler (Hızlı)

- **Hash:** veriyi sabit boyutlu tek yönlü parmak izine çeviren fonksiyon.
- **Simetrik:** tek anahtarla şifrele/çöz.
- **Asimetrik:** açık + özel anahtar çifti.
- **Public key:** herkese açık; imza doğrulamak / şifrelemek için.
- **Private key:** gizli; imza atmak / şifre çözmek için.
- **Dijital imza:** özelle imzala, açıkla doğrula; bütünlük + kimlik + inkâr edilemezlik.
- **Sertifika (X.509):** açık anahtarın sahibini onaylayan imzalı belge.
- **PKI:** sertifika üreten/yöneten güven sistemi.
- **QSCD:** nitelikli imza için sertifikalı güvenli cihaz.
- **ECDSA / P-256 / SHA-256:** yaygın imza takımı.

---

# İlgili Dokümanlar

- [[ACA-BC-0001]] — Blockchain ve consensus (hash'in zincirde kullanımı).
- [[ACA-ID-0001]] (planlı) — DID ve Verifiable Credentials; bu imzayı kimlik/belgeye uygular.
- [[RS-EIDAS-0001]] — QES (§8), P-256 (§4), Trusted List (§5).
- [[RS-EBSI-0001]] — Trusted Issuers Registry, DID/anahtar kayıtları.
- [[PM-TRUST-0001]] — Neden belge değil, yalnızca anahtar/güven zincirde.

---

# Durum

**review_status: Draft.** Kriptografi temelleri (hash, asimetrik anahtarlar, dijital imza, PKI/sertifika, güvenli donanım, imza takımı) öğretici düzeyde kapsandı. İleride ayrı Academy dokümanları eklenebilir: ZKP (sıfır bilgi ispatı) derinlemesine, seçici açıklama (SD-JWT) mekaniği. Şimdilik DID/VC (ACA-ID-0001) ve e-imza için yeterli zemin hazırdır.
