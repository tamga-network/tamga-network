---
document_id: ADR-0006
title: Credential Formatı ve Protokoller — SD-JWT VC, OpenID4VCI/VP, ES256, Holder Binding
category: ADR
domain: Credential
status: Active
review_status: Completed
version: 1.0.0
created: 2026-09-03
last_updated: 2026-09-03
authors:
  - Tamga Network Engineering
language: tr
document_type: adr
audience:
  - engineers
  - architects
  - ai-agents
stability: Stable
maturity: Stable
tags:
  - adr
  - credential
  - sd-jwt-vc
  - openid4vci
  - openid4vp
  - holder-binding
  - wallet-attestation
keywords:
  - SD-JWT VC
  - mdoc ISO 18013-5
  - OpenID4VCI
  - OpenID4VP
  - ES256 P-256
  - holder binding cnf
  - Wallet Unit Attestation
related:
  - SPEC-CRED-0001
  - PM-ASSUR-0001
  - PM-TRUST-0001
  - SPEC-BC-0001
  - SPEC-ID-0002
  - ADR-0005
supersedes: []
summary: >
  Tamga credential formatını ve ihraç/sunum protokollerini KARAR olarak sabitler:
  birincil format SD-JWT VC, ikincil mdoc/ISO 18013-5 (2. faz); ihraç OpenID4VCI, sunum
  OpenID4VP, imza ES256 (P-256). Holder binding (`cnf` + cihaz anahtarı) İSTİSNASIZ
  ZORUNLUDUR — credential'ın başkasının cüzdanına alınması açığının (holder binding
  problemi) tek çözümü. Wallet Unit Attestation (WUA) baştan konur. Revocation Token
  Status List'e ([[SPEC-BC-0001]]) devredilir. Tam spesifikasyon → SPEC-CRED-0001.
priority: Critical
---

# ADR-0006 — Credential Formatı ve Protokoller

**Durum:** Accepted
**Tarih:** 2026-09-03
**Karar veren:** Tamga Network proje yönetimi
**Kaynak:** `tamga-guven-cercevesi-v0.1.md` (Bölüm F, G, K) — çalışma notu; tam spesifikasyon
→ [[SPEC-CRED-0001]].

---

# Bağlam

Depoda credential formatı bugüne dek "planlı" bırakılmıştı; [[SPEC-BC-0001]] SD-JWT VC ve
Token Status List'e atıfta bulunuyor ama resmî bir format kararı yoktu. Ayrıca "üniversite
fikrindeki gizli hata" (credential başkasının cüzdanına alınabilir) bir güvenlik açığı
olarak açıktı. Bu ADR ikisini de kapatır. [[ADR-0001]] (Besu/EVM) ve [[ADR-0004]] (X.509
issuer kimliği) üzerine kurulur.

---

# Karar

## Karar 1 — Format: SD-JWT VC (birincil), mdoc (ikincil, 2. faz)

SD-JWT VC birincil formattır: selective disclosure yerleşik, EUDI ARF ana formatı,
kütüphane bolluğu, JSON-LD'den basit. mdoc/ISO 18013-5 ikincildir (2. faz; çevrimdışı/
fiziksel ibraz, mDL uyumu).

## Karar 2 — Protokoller: OpenID4VCI (ihraç), OpenID4VP (sunum)

Fiili standartlar; kurumların mevcut OIDC altyapısına oturur, verifier entegrasyonu kolay.

## Karar 3 — İmza: ES256 (P-256)

Mobil secure element (Secure Enclave/StrongBox) ve HSM'lerde evrensel destek.

## Karar 4 — Holder binding istisnasız zorunlu (`cnf` + cihaz anahtarı)

Her credential, issuance anında holder'ın **cihazda üretilmiş** anahtarına `cnf` ile
bağlanır; sunumda holder nonce'u o anahtarla imzalar (KB-JWT). Bu, holder binding açığının
**tek** çözümüdür ve kapatılamaz. Anahtar donanımda üretilir, dışa aktarılamaz →
credential devredilemez.

## Karar 5 — Wallet Unit Attestation (WUA) baştan konur

Cüzdanın gerçekliğini (donanım anahtarı, PIN aktif, root/jailbreak yok, sağlayıcı kimliği)
beyan eden WUA, pilotta basit içerikle de olsa **alan ve akış olarak baştan** açılır —
sonradan eklemek tüm cüzdanların migrasyonunu gerektirir.

## Karar 6 — Revocation Token Status List'e devredilir

Ayrı bir iptal mekanizması tanımlanmaz; [[SPEC-BC-0001]] §5 Token Status List kullanılır
(off-chain liste + on-chain pointer, min 100k, rastgele index). Korelasyon karşıtı batch
issuance 2. faza ertelenir, formatta yeri açık tutulur.

---

# Gerekçe

- **EUDI uyumu:** SD-JWT VC + OpenID4VCI/VP + ES256, EUDI ARF'nin ana yığınıdır → "uyumlu
  ama bağımsız" ([[PM-PH-0001]]) ve sınır-ötesi interop.
- **Holder binding = varlık nedeni:** bu açık kapatılmazsa sistem sessizce yalan söyler;
  değeri sıfırlanır.
- **Geri döndürülemezlik:** format/binding/WUA baştan doğru kurulmazsa sonradan tüm
  cüzdan tabanının migrasyonu gerekir — [[ADR-0003]] "bugün bedava, sonra imkânsız"
  mantığıyla aynı.

---

# Sonuçlar

1. [[SPEC-CRED-0001]] tam spesifikasyondur (format yapısı, KB-JWT, WUA, akışlar).
2. `contracts/` ve `sdk/` cüzdanı **cihaz secure element** anahtarı + `cnf` üretir;
   yazılım anahtarı kabul edilmez.
3. Verifier kütüphanesi `TrustedListProvider` arayüzü üzerinden çalışır (chain-agnostic,
   Faz 0 dosya / Faz 1 zincir) — [[ARCH-0001]].
4. [[PM-ASSUR-0001]] holder assurance, WUA + binding yöntemine bağlanır.

---

# İlişkiler

- [[SPEC-CRED-0001]] — bu kararın tam spesifikasyonu.
- [[PM-ASSUR-0001]] / [[ADR-0005]] — assurance seviyeleri (formatın taşıdığı güven).
- [[SPEC-BC-0001]] — issuer registry + Token Status List (revocation).
- [[SPEC-ID-0002]] — issuer X.509 (`iss`), [[SPEC-ID-0001]] — holder pseudonym (`cnf`).
- [[PM-TRUST-0001]] — credential asla zincirde değil.

**review_status: Completed.** Format, protokoller, imza, holder binding (zorunlu) ve WUA
kabul edildi (2026-09-03). mdoc ve batch issuance sonraki fazlara havale edildi.
