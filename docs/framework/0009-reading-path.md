---
document_id: FW-READ-0001
title: "Okuma yolu"
status: Active
version: 1.0.0
created: 2026-10-02
last_updated: 2026-10-02
summary: >
  Tamga ARF'yi rolünüze göre hangi sırayla okuyacağınızı gösteren tek tablo: belge veren kurum, doğrulayıcı, cüzdan
  sağlayıcısı, devlet ve düzenleyici, denetçi, yazılım geliştirici ve kişi için önce ARF'nin hangi bölümleri, sonra hangi
  geliştirici belgeleri.
---

# 1. Nasıl kullanılır

Tamga ARF bir ana belge ve beş ekten oluşur. Her şeyi baştan sona okumanız gerekmez: aşağıdaki tablo rolünüze göre önce
çerçevenin hangi bölümlerini, sonra hangi uygulama belgelerini okuyacağınızı sırasıyla gösterir. Uygulama belgeleri
geliştirici sitesindedir (docs.tamga.network); orada adımlar, kod örnekleri ve şartnameler bulunur.

Bir rolün ne yaptığını ve hangi kurallara bağlı olduğunu bilmiyorsanız önce **Roller** sayfasına ([[FW-ROLE-0001]]), ağa
katılmaya hazırsanız **Katılım süreci** sayfasına ([[FW-ONB-0001]]) bakın.

# 2. Rol başına okuma sırası

| Rol | 1. Çerçeve (ARF) | 2. Uygulama (geliştirici belgeleri) |
|---|---|---|
| **Belge veren kurum** (üniversite, bilet satıcısı, meslek kuruluşu) | Ana belge §2–§6 → [[FW-ROLE-0001]] "Belge veren" → Ek A §3.2 (katılım kapıları) ve §5.1 (sözleşmeler) → Ek B §4 (RB-AP) → belge türünüzün rulebook'u (Ek C) | [[GUIDE-0007]] → [[GUIDE-0003]] → [[GUIDE-0009]] |
| **Doğrulayıcı** (işveren, banka, web sitesi, kapı) | Ana belge §2 ve §6 → [[FW-ROLE-0001]] "Doğrulayıcı" → Ek A §3.2 (doğrulayıcı kaydı) → Ek B §7 (RB-RP) → belge türünün rulebook'unda doğrulama politikası | [[GUIDE-0008]] → [[GUIDE-0002]] ya da [[GUIDE-0001]] → [[GUIDE-0006]] |
| **Cüzdan sağlayıcısı** | Ana belge §2, §5, §6 ve §7 → [[FW-ROLE-0001]] "Cüzdan sağlayıcısı" → Ek A §3.2 ve §4.3 (uyum testleri) → Ek B §6 (RB-WP) | [[GUIDE-0005]] → [[GUIDE-0010]] → [[GUIDE-0009]] → [[SPEC-WALLET-0001]] |
| **Devlet ya da düzenleyici** | Ek A (bütünü; özellikle §1.6 yönetişim ve §7 devir planı) → ana belge §6 (güven modeli) ve §8 (yönetişim ve devir) → [[FW-ROLE-0001]] "Devlet" | [[GUIDE-0011]] → [[SPEC-TRUST-0001]] |
| **Yetkili kaynak** (öğrenci bilgi sistemi, kamu kaydı) | [[FW-ROLE-0001]] "Yetkili kaynak" → Ek B §5 (RB-AS) → Ek A §3.6 (veri koruma) | Belge türünün şeması (ör. [[SPEC-SCHEMA-0002]]) |
| **Denetçi** (uygunluk değerlendirmesi, iç denetim) | Ek A §4 (uyum: rejim, roller, testler, gözetim, yaptırım, olaylar) → Ek B (bütünü) → Ek E §3 (kural kaynakları) | [[GUIDE-0009]] → değişmezler ([[INVARIANTS]]) |
| **Yazılım geliştirici ya da entegratör** | Ana belge §4–§6 → Ek B'de rolünüzün bölümü | Geliştirici belgelerinin başlangıç rehberleri ([[GUIDE-0000]]) → [[GUIDE-0004]] → şartnameler |
| **Kişi** (belge sahibi) ya da genel okur | Ana belge §1 ve §2 → Ek B §8 (RB-H: haklarınız) → Ek D (tanımlar) | tamga.network'teki öğrenme yolu |

# 3. Hızlı başvuru

| Soru | Nerede |
|---|---|
| Ağda kim ne yapar? | [[FW-ROLE-0001]] |
| Ağa nasıl katılırım, hangi belgeler gerekir? | [[FW-ONB-0001]], Ek A §3.2 |
| Hangi kurala uymam gerekiyor? | Ek B (rol başına), Ek C (belge türü başına) |
| Bir kural nereden geliyor? | Ek E §3 |
| Bir terim ne demek? | Ek D |
| Ağı kim yönetiyor, nasıl devredilecek? | Ana belge §8, Ek A §1.6 ve §7 |

# Durum

**Yürürlükte** — sürüm 1.0.0 (2026-10-02).
