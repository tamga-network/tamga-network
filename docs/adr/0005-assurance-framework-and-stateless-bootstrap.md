---
document_id: ADR-0005
title: "Güvence modeli ve devletsiz başlangıç"
status: Active
version: 1.0.0
created: 2026-09-03
last_updated: 2026-10-02
summary: >
  Tamga'nın güven seviyesi modelini KARAR olarak sabitler: güven iki bağımsız eksende
  ölçülür — Holder/Wallet Assurance (T0–T3) ve Issuer Assurance (I1–I3) — ve doğrulayıcı
  kararı ikisinin ÇARPIMIDIR. Ayrıca devletsiz bootstrap benimsenir: devletler ağa
  katılana kadar güven, mevcut Türk kurumlarından (e-imza/NES=T3, banka/GSM=T1, KYC/kurum
  masası=T2) DEVRALINARAK üretilir. Kendi seviyelerimiz eIDAS LoA'ya 1:1 eşlenir. Detay
  gerekçe → PM-ASSUR-0001.
domain: Identity
---

# ADR-0005 — İki Eksenli Assurance Modeli ve Devletsiz Bootstrap

**Durum:** Accepted
**Tarih:** 2026-09-03
**Karar veren:** Tamga Network proje yönetimi
**Kaynak:** `tamga-guven-cercevesi-v0.1.md` (Bölüm B, D) — çalışma notu; strateji gerekçesi
ve tam model → [[PM-ASSUR-0001]].

---

# Bağlam

[[PM-ID-0001]] §6.2 assurance seviyelerinin var olacağını ve [[t:eIDAS]] [[t:LoA]]'ya eşleneceğini
söyledi ama seviyeleri tanımlamadı. [[PM-PH-0001]] (§Gelecek md.5) "altyapı devlet olmadan
da çalışabilmeli" dedi ama bunun *nasıl* olacağını açık bıraktı. Bu iki boşluk, ağın
devletler katılmadan önce (Faz 0, [[ARCH-0001]]) çalışmasını engelliyordu.

Karar, bu boşlukları kapatır ve güven ölçümünü uygulanabilir hale getirir.

---

# Karar

## Karar 1 — Güven iki eksende ölçülür (tek sayı değil)

- **Eksen A — Holder/Wallet Assurance: T0 (anonim) → T1 (düşük) → T2 (önemli) → T3 (yüksek).**
- **Eksen B — Issuer Assurance: I1 (kayıtlı) → I2 (sözleşmeli) → I3 (akredite).**
- **[[t:verifier]] kararı = Eksen A × Eksen B (çarpım, toplam değil).** Yüksek [[t:holder]] + akredite
  olmayan [[t:issuer]] = değersiz; akredite belge veren + T0 belge sahibi = değersiz.
- **IssuerCategory ≠ Issuer Assurance:** [[SPEC-BC-0001]] kategorisi sektörü, I1–I3
  akreditasyon derecesini söyler; diktirler.

## Karar 2 — Devletsiz bootstrap benimsenir

Devletler ağa katılana kadar güven, mevcut Türk kurumlarından **devralınır** (derived
assurance). Hiçbir seviye devlet anlaşması gerektirmez:

- **T3** ← e-imza/NES/Mobil İmza ile challenge ([[t:nonce]]) imzalatma (BTK ESHS kök doğrulaması).
- **T2** ← uzaktan KYC / NFC pasaport / **kurum kayıt masası** (üniversite/oda = Kayıt Otoritesi).
- **T1** ← banka mikro-transfer / GSM hat sahipliği.
- **Issuer Assurance I1–I3** ← Tamga geçici olarak Root TAO rolünde akredite eder.

Devlet katıldığında (Faz 1) bu yok olmaz; **PID Provider** T3'ün yanına daha geniş taban
ve yüksek kayıt kalitesi ekleyerek ([[t:PID]]) varsayılan yüksek-LoA kaynağı olur.

## Karar 3 — Kendi seviyelerimiz eIDAS LoA'ya 1:1 eşlenir

T1≈Low, T2≈Substantial, T3≈High. İçeride kayıt/authenticator/doğrulama boyutlarını ayrı
ele alma opsiyonu (NIST 800-63 tarzı) korunur; dışarıya tek eIDAS LoA olarak sunulur →
EUDI/EBSI interop kaybı yok ("uyumlu ama bağımsız", [[PM-PH-0001]]).

## Karar 4 — Assurance decay ve kullanıcıya sayı göstermeme

- Seviye zamanla/olayla **düşürülür** (cihaz değişimi → T1, atıl kalma, kaynak [[t:credential]]
  süresi dolması, anomali).
- Son kullanıcıya **sayı gösterilmez** (durum gösterilir); sayılar doğrulayıcı politika
  motoruna aittir.

---

# Gerekçe

- **eIDAS/EBSI emsali:** iki eksen, eIDAS belge sahibi LoA'sı + EBSI belge veren akreditasyon
  zincirinin birleşimidir — kanıtlanmış model.
- **Devletsiz çalışabilirlik:** "devlet anlaşmam yok → kimseyi doğrulayamam" yanlıştır;
  derived assurance ile bugün T3'e kadar üretilebilir. Bu, projeyi devlet-öncesi dönemde
  yaşayabilir kılan tek kaldıraçtır.
- **Enflasyon riski:** seviye kriterleri gevşetilirse sistem anlamsızlaşır → kriterler
  resmî Trust Framework'e yazılır, değişimi prosedürel zorlaştırılır (PM-GOV-0001).

---

# Sonuçlar

1. [[PM-ASSUR-0001]] bu modelin tam project-memory kaydıdır (yeni `assurance/` domaini).
2. Doğrulayıcı politika motoru belge sahibi **ve** belge veren eşiğini birlikte uygular → [[ADR-0003]]
   `requiresCredential` primitifinin parametreleri.
3. [[SPEC-BC-0001]] `Issuer` struct'ına **belge veren güvence seviyesi (Issuer Assurance)** alanı eklenir
   (belge sahibinin güvence seviyesi zincire yazılmaz — kişisel veri, [[PM-TRUST-0001]]).
4. [[SPEC-CRED-0001]] [[t:holder-binding]] + [[t:WUA]], belge sahibi güvencesinin teknik önkoşuludur.
5. [[ARCH-0001]] Faz 0 = devletsiz bootstrap katmanı olarak netleşir.

---

# İlişkiler

- [[PM-ASSUR-0001]] — tam model ve gerekçe.
- [[PM-ID-0001]] — §6.2 burada somutlaşır; PID Provider = Faz 1 T3.
- [[PM-PH-0001]] — devletsiz çalışabilirlik ilkesinin karşılığı.
- [[SPEC-CRED-0001]] / [[SPEC-BC-0001]] — teknik taşıyıcı ve zincir temsili.
- [[ADR-0006]] — belge formatı (bu kararın taşıyıcısı).
- PM-GOV-0001 (planlı) — seviye kriter metni + TAO akreditasyon yönetişimi.

İki eksenli model + devletsiz bootstrap + eIDAS eşleme +
decay + sunum ilkesi kabul edildi (2026-09-03).
