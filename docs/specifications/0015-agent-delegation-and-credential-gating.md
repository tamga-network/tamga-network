---
document_id: SPEC-AGENT-0001
title: Agent Delegasyonu ve Credential-Gating — Faz 0 Kapsamı ve Gelecek Açılma Yolu
category: Specification
domain: Authorization
status: Active
review_status: Draft
version: 1.0.0
created: 2026-09-10
last_updated: 2026-09-10
authors:
  - Tamga Network Engineering
language: tr
document_type: specification
audience:
  - engineers
  - architects
  - ai-agents
stability: Evolutionary
maturity: Draft
tags:
  - specification
  - authorization
  - delegation
  - agent
  - credential-gating
keywords:
  - agent delegation
  - scope-generic delegation
  - kill switch
  - credential gating
  - off-chain revocation
  - verifier attestation
  - trust shift
summary: >
  [[ADR-0003]] Karar 3 (kapsam-genel agent delegasyonu) ve Karar 4'ün
  (credential-gating) resmi yüzeyi. Bağlayıcı karar: Faz 0'da zincir üstü
  credential-gating YOKTUR — [[ADR-0008]] ile iptal listesi zincir dışına
  çıktığı için zincir bir credential'ın geçerliliğini göremez, dolayısıyla
  gating'i "credential doğrulama" olarak uygulayamaz. ADR-0003 Karar 4 bu
  yönde daraltılır. İleride ihtiyaç doğarsa açılma yolu tasarım olarak
  kaydedilir (uygulama yazılmaz): kayıtlı bir verifier off-chain doğrular ve
  imzalı beyan üretir; zincir yalnızca beyanın imzasını, tazeliğini ve tek
  kullanımlık nonce'unu kontrol eder — böylece güven "zincir credential'ı
  doğrular"dan "zincir kayıtlı bir verifier'a güvenir"e kayar.
priority: High
related:
  - ADR-0003
  - ADR-0008
  - SPEC-BC-0001
  - SPEC-CRED-0003
  - PM-AUTH-0001
depends_on:
  - ADR-0003
  - ADR-0008
  - SPEC-BC-0001
---

# 1. Amaç ve Kapsam

Bu doküman iki şeyi resmileştirir:

1. **Agent delegasyonu** — [[ADR-0003]] Karar 3'te ilkeleri sabitlenen
   kapsam-genel (scope-generic) delegasyon yüzeyi.
2. **Credential-gating** — [[ADR-0003]] Karar 4'ün **daraltılması**: Faz 0'da
   zincir üstü credential-gating yoktur; gelecekteki açılma yolu tasarım
   olarak kaydedilir.

Bu doküman [[ADR-0003]]'ün "planlı" olarak bıraktığı `SPEC-AGENT-0001`
taahhüdünü kapatır ([[DECISIONS]] D-AUTH-2 ve açık taahhüt §10.4).

**Kapsam dışı:** Ödeme/değer transferi kapsamları (`pay:*`), varlık cüzdanı
kurtarma kompozisyonu (→ PM-ID-0003), token ihracı ([[ADR-0003]] Karar 5).

---

# 2. Problem

[[ADR-0003]] Karar 4, credential-gating'i genel bir kontrat primitifi olarak
öngörüyordu:

```solidity
modifier requiresCredential(bytes32 credentialType, bytes calldata proof) { ... }
```

Bu, "bu işlemi yapmak için şu credential gerekir" kuralını zincir üstünde
uygulamayı varsayıyordu. Ancak [[ADR-0008]] (status list yerleşimi) ile
**iptal listesi zincir dışına çıkarıldı**: zincirde yalnızca bir çapa (URI +
içerik hash'i + sürüm) tutulur, iptal bitleri tutulmaz ([[SPEC-CRED-0003]]/S1).

Sonuç: **zincir bir credential'ın o an geçerli olup olmadığını göremez.**
İptal edilmiş bir credential ile geçerli bir credential, zincirin gördüğü
veride ayırt edilemez. Bir `requiresCredential` modifier'ı ya yanıltıcı
biçimde iptal edilmiş credential'ları kabul eder ya da hiçbir şey doğrulamaz.
Bu, kararlı bir primitif değildir.

---

# 3. Karar — Faz 0'da Zincir Üstü Credential-Gating Yoktur

**Faz 0'da hiçbir kontrat bir credential'ın geçerliliğini zincirde kontrol
etmez.** [[ADR-0003]] Karar 4 bu yönde **daraltılır**: credential-gating bir
zincir primitifi değildir; doğrulama tümüyle off-chain'de (verifier servisi +
[[SPEC-API-0001]] kanonik doğrulama algoritması) yapılır.

Bunun somut sonucu kod tarafında zaten görünürdür: `contracts/src/` altında
`CredentialGate.sol` **yoktur** ve hiçbir kontrat (`TrustQueries` dahil)
credential-gating'e atıf yapmaz. Bu doküman o durumu kararlı hale getirir.

**Neden bir "yokluk" karara bağlanır:** Aksi halde her yeni geliştirici
[[ADR-0003]] Karar 4'ü okuyup `requiresCredential`'ı geri getirmeye çalışır.
Bu daraltma, o yolun neden kapalı olduğunu ve doğru yolun ne olduğunu kayıt
altına alır.

---

# 4. Gelecek Açılma Yolu (Tasarım — Uygulama Yazılmaz)

İleride gerçek bir zincir-üstü kapı ihtiyacı doğarsa (ör. "bu transferi
yalnızca KYC'li hesaplar yapabilir"), aşağıdaki tasarım izlenir. **Bu bölüm
yalnızca tasarımı kaydeder; Faz 0'da hiçbir kontrat yazılmaz.**

## 4.1 Akış

1. Kayıtlı bir **verifier servisi** ([[SPEC-BC-0001]] RelyingPartyRegistry'de
   `RPStatus.ACTIVE`) doğrulamayı **off-chain** yapar ([[SPEC-API-0001]]).
2. Verifier, sonucu içeren **imzalı bir beyan** üretir:
   `ATTEST(credentialType, subject, result=ACCEPTED, issuedAt, nonce)`.
3. Zincir üstü kontrat credential'ı **doğrulamaz**; yalnızca beyanı denetler:
   - **(a) İmza:** beyan, verifier'ın RP Registry'deki kayıtlı sertifikasıyla
     (`accessCertFingerprint`) doğrulanır ve verifier `ACTIVE` olmalıdır.
   - **(b) Tazelik:** `issuedAt` azami yaşın içinde olmalıdır (ör. ≤ 15 dk).
   - **(c) Tek kullanımlık nonce:** `nonce` daha önce görülmemiş olmalıdır
     (replay engeli); tüketim atomiktir.

## 4.2 Güven Kayması (Açıkça Yazılır)

Bu tasarım gating'i şundan:

> "zincir credential'ı doğrular"

şuna dönüştürür:

> "zincir, kayıtlı bir verifier'ın imzalı beyanına güvenir."

Bu bir **güven kaymasıdır** ve gizlenmez: kapı artık credential'ın
kriptografik geçerliliğine değil, **belirli bir kurumsal verifier'a**
dayanır. Verifier ele geçirilir veya kötüye kullanılırsa kapı yanılır. Bu
yüzden açılma, verifier'ın RP Registry'de akredite, askıya alınabilir ve
denetlenebilir olmasına bağlıdır. Beyan tazeliği (b) ve nonce (c), off-chain
iptalin beyandan **sonra** gerçekleşmesi penceresini daraltır ama sıfırlamaz;
azami yaş bu artık riskin kabul edilen üst sınırıdır.

---

# 5. Agent Delegasyonu

[[ADR-0003]] Karar 3 uyarınca delegasyon kontratı bugün yazılır, kapsamlar
ödeme-dışı tutulur (`logistics:verify`, `health:read`). `scope` alanı
genişletilebilir tasarlanır; `pay:*` **Faz 0'da tanımlı değildir**.

## 5.1 İlkeler

- Agent'ın kendi kimliği yoktur; **türetilmiş** yetkisi vardır (kimlik
  anahtarından ayrı agent anahtarı, [[ADR-0003]] Karar 2).
- **Süresiz delegasyon yoktur:** her delegasyon `validUntil` taşır.
- **Anında iptal (kill switch)** koşulsuzdur; principal her an iptal eder.
  İptal ileriye dönük kesindir (geçmiş işlemleri geri almaz).
- **Sorumluluk velidedir (principal):** agent'ın kapsam içindeki her işlemi
  principal'ı bağlar.
- Her agent işlemi **delegasyon referansıyla** loglanır.
- Agent **kimlik credential'ı sunamaz**; yalnızca işlemsel yetki taşır.

## 5.2 Credential-Gating ile İlişki

Agent delegasyonu ile credential-gating ayrık kavramlardır: delegasyon "kim
kimin adına işlem yapabilir"i yönetir (zincir üstü, kapsam tabanlı);
credential-gating "bu işlem için hangi belge gerekir"i sorar (Faz 0'da
off-chain). Bir agent'ın kapsamı, off-chain bir credential kontrolüne
bağlanamaz; yalnızca statik `scope` allowlist'ine dayanır.

---

# 6. Değişmezler

| # | Değişmez |
|---|---|
| **AG1** | Agent'ın kendi kimliği yoktur; yalnızca türetilmiş işlemsel yetkisi vardır. |
| **AG2** | Süresiz delegasyon yoktur; her delegasyon `validUntil` taşır. |
| **AG3** | Delegasyon koşulsuz ve anında iptal edilebilir (kill switch); iptal ileriye dönük kesindir, geçmiş işlemleri geri almaz. |
| **AG4** | Delegasyon sorumluluğu velide (principal) kalır. |
| **AG5** | Her agent işlemi delegasyon referansıyla loglanır. |
| **AG6** | Agent kimlik credential'ı sunamaz; yalnızca işlemsel yetki taşır. |
| **AG7** | `scope` genişletilebilir tasarlanır; `pay:*` Faz 0'da tanımlı değildir. |
| **AG8** | Faz 0'da zincir üstü credential-gating yoktur; hiçbir kontrat bir credential'ın geçerliliğini zincirde kontrol etmez. |
| **AG9** | Zincir bir credential'ın iptal durumunu göremez ([[ADR-0008]], [[SPEC-CRED-0003]]/S1); gating "credential doğrulama" olarak zincirde uygulanamaz. |
| **AG10** | Gelecekte gating açılırsa zincir credential'ı doğrulamaz; yalnızca kayıtlı bir verifier'ın imzalı beyanına güvenir (güven kayması dokümante edilir). |
| **AG11** | Beyanı üreten verifier RelyingPartyRegistry'de `ACTIVE` olmalıdır; beyan verifier'ın kayıtlı sertifikasıyla (`accessCertFingerprint`) doğrulanır. |
| **AG12** | Beyan taze olmalıdır (azami yaş, ör. ≤ 15 dk) ve tek kullanımlık nonce taşır; nonce tüketimi atomiktir. |

---

# 7. İlişkiler ve Durum

- [[ADR-0003]] — Karar 3 (delegasyon) ve Karar 4 (credential-gating, bu
  dokümanla daraltıldı).
- [[ADR-0008]] — iptal listesi zincir dışına çıktı; §3'ün kökü.
- [[SPEC-CRED-0003]] — status list off-chain; `S1` (zincirde iptal biti yok).
- [[SPEC-BC-0001]] — RelyingPartyRegistry (verifier akreditasyonu, §4.1
  beyan yolunun güven çıpası).
- [[SPEC-API-0001]] — off-chain kanonik doğrulama (gating'in gerçek yeri).
- [[PM-AUTH-0001]] — değer katmanı stratejisi (delegasyonun bağlamı).
- PM-ID-0003 (planlı) — varlık cüzdanı kurtarma (bu dokümanın kapsamı dışı).

**review_status: Draft.** Faz 0 kararı sabitlendi: zincir üstü
credential-gating yok; agent delegasyonu ilkeleri [[ADR-0003]] Karar 3'ten
resmileştirildi; gelecek açılma yolu tasarım olarak kaydedildi (uygulama
yazılmadı). Delegasyon kontratının Solidity yüzeyi `contracts/src/` altında,
delegasyon kapsam sözlüğü `shared/` altında yazılacaktır.
