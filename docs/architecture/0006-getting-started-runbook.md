---
document_id: ARCH-0006
title: Canlıya Alma Runbook'u — Monorepo'dan Mainnet'e, Adım Adım
category: Architecture
domain: Platform
status: Active
review_status: Draft
version: 1.0.1
created: 2026-09-11
last_updated: 2026-09-30
authors:
  - Tamga Network Engineering
language: tr
document_type: architecture
audience:
  - engineers
  - architects
  - operators
  - founder
stability: Evolutionary
maturity: Developing
tags:
  - runbook
  - getting-started
  - implementation
  - monorepo
  - sdk
  - wallet
  - deployment
keywords:
  - bring to life sequence
  - monorepo structure
  - contract compile deploy
  - sdk package publishing
  - native mobile wallet
  - testnet mainnet path
summary: >
  "Yazılı projeden çalışan ağa" tek referans. Monorepo yapısını (D-MONO),
  canlıya almanın doğru sırasını (kontrat derleme → deploy → SDK/servisler →
  native cüzdan → paket yayını → testnet → pilot → mainnet), her adımı yöneten
  dokümanı ve somut komutları toplar. Mobil cüzdanın neden native olmak
  zorunda olduğunu (SPEC-WALLET-0001/WL3) ve paket yayınının neden en son ve
  güvenlik-kapılı olduğunu (ARCH-0005 §3) açıklar. Bu doküman yeni değişmez
  tanımlamaz; bağlayıcı kuralları kaynak dokümanlardan DOC-ID/KOD ile anar.
priority: High
related:
  - ARCH-0001
  - ARCH-0002
  - ARCH-0004
  - ARCH-0005
  - SPEC-WALLET-0001
  - SPEC-BC-0001
  - ROADMAP
depends_on:
  - ARCH-0002
  - ARCH-0005
---
> **Sürüm notu 1.0.1 (2026-09-30) — ürün adı:** TamgaID → Tamga Wallet / “Tamga ile giriş yap” (proje yönetimi kararı; anlam değişmedi).

# Amaç

Bu doküman, sık sorulan "şimdi ne yapmam lazım, sıra ne" sorusunun tek
cevabıdır. Diğer dokümanlar bir bileşeni derinlemesine anlatır ([[ARCH-0002]]
Besu, [[ARCH-0004]] sunucular, [[ARCH-0005]] SDK); bu doküman onları **doğru
sıraya** dizer. Yeni bağlayıcı kural **tanımlamaz** — mevcut değişmezleri
`DOC-ID/KOD` ile anar.

---

# 1. Tek Repo — Monorepo (D-MONO)

Tüm mühendislik tek repoda yaşar; **bileşen başına ayrı repo açılmaz**
([[DECISIONS]] D-MONO). Gerekçe: kontrat ABI'si değişince SDK aynı commit'te
güncellenir; sürüm bağlaşımı ([[ARCH-0005]] §4) tek yerde yönetilir.

```
tamga-network/          ← TEK repo (GitHub'da)
├── docs/                mühendislik dokümanları
├── contracts/           Solidity güven katmanı (SPEC-BC-0001) — DOLU
├── network/             Besu genesis/QBFT config (ARCH-0002) — iskelet
├── services/            issuer / verifier / indexer backend (ARCH-0003) — iskelet
├── sdk/                 npm workspace: @tamga-network/* paketleri (ARCH-0005) — iskelet
└── shared/              ortak tipler/şemalar — iskelet

tamga-web/               ← AYRI repo (pazarlama sitesi, ayrı ürün)
```

---

# 2. Canlıya Alma Sırası

Sıra bağlayıcıdır: her adım bir öncekinin çıktısını kullanır. Paket yayını ve
mainnet **en sondadır**.

| # | Adım | Katman | Yöneten doküman | Ön koşul |
|---|------|--------|-----------------|----------|
| 1 | Kontratları derle + test | `contracts/` | [[SPEC-BC-0001]], `contracts/README` | Foundry |
| 2 | Yerel tek-node Besu + deploy | `contracts/`, `network/` | [[ARCH-0002]] §1–7 | Adım 1 |
| 3 | `@tamga-network/contracts` + `@tamga-network/core` | `sdk/` | [[ARCH-0005]] §1 | Adım 2 (ABI+adres) |
| 4 | Servisler: indexer → issuer → verifier | `services/`, `sdk/` | [[ARCH-0003]], [[SPEC-API-0001]] | Adım 3 |
| 5 | **Native mobil cüzdan (Tamga Wallet)** | `sdk/` + native | [[SPEC-WALLET-0001]] | Adım 4 |
| 6 | Paketleri npm'e yayınla (güvenlik-kapılı) | CI | [[ARCH-0005]] §3, §6 | 3–5 olgun |
| 7 | Yerel 4-node testnet → bulut testnet → pilot → mainnet | `network/` | [[ARCH-0002]] §9–10, [[PM-GTM-0001]] | hepsi |

## 2.1 Adım 1–2: kontrat (şu anki nokta)

```bash
git clone <repo-url> ~/tamga-network && cd ~/tamga-network/contracts
curl -L https://foundry.paradigm.xyz | bash && foundryup
make install && make build && make test
```
İlk beklenen hatalar (`contracts/README`): OZ v4↔v5 import yolları,
`vm.envAddress` imzası. Sonra tek-node Besu (`docker run hyperledger/besu
--network=dev --rpc-http-enabled`) + `contracts/script/Deploy.s.sol`.

## 2.2 Adım 3–4: SDK çekirdeği + servisler

Kontrat derlenince ABI ve deploy adresleri `@tamga-network/contracts`'a girer; `@tamga-network/
core` (tipler, base64url, SHA-256) tabandır. Servisler bu paketleri kullanır.
Sıra: **indexer** (zinciri okur, [[ARCH-0003]]/CMP1) → **issuer** (SD-JWT
üretimi) → **verifier** (doğrulama hattı). Verifier'ın devraldığı taahhütler
[[ARCH-0005]] §2 (T1–T8) — her biri en az bir testle.

---

# 3. Mobil Cüzdan — Neden Native Olmak Zorunda

Cüzdan bir web/PWA uygulaması **olamaz**. [[SPEC-WALLET-0001]] bağlayıcı:

- `SPEC-WALLET-0001/WL3` — **yazılım cüzdanı (güvenli bölgesiz) desteklenmez.**
- `SPEC-WALLET-0001/WL1` — holder anahtarları cihazın **güvenli bölgesinden**
  (iOS Secure Enclave / Android StrongBox) çıkmaz; seed'den türetilmez.
- `SPEC-WALLET-0001/WL11` — her sunum PIN/biyometri onayı gerektirir.
- `SPEC-WALLET-0001/WL2` — yedek anahtarları taşımaz; cihaz değişince yeniden
  ihraç gerekir.

Bunun pratik sonucu: **native iOS (Swift) + Android (Kotlin) uygulaması.**
Ortak iş mantığı `@tamga-network/wallet-core`'da (TypeScript kanonik), native kabuklar
`TamgaWallet` Swift (SPM) / Kotlin (Maven) ([[ARCH-0005]] §1). Cüzdan:

- credential **alır** → OpenID4VCI ([[SPEC-PROTO-0001]]),
- credential **sunar** → OpenID4VP ([[SPEC-PROTO-0002]]),
- SD-JWT + KB-JWT üretir ([[SPEC-CRED-0002]]),
- şemaları toplu çeker, sunum anında değil (`ARCH-0003/CMP8`, `SPEC-WALLET-0001/WL9`).

**Sıra:** Cüzdan Adım 5'tir — issuer/verifier (Adım 4) çalışmadan cüzdanın
konuşacağı bir taraf yoktur. Önce backend, sonra cüzdan.

---

# 4. Paket Yayını — En Son ve Güvenlik-Kapılı

SDK'lar `@tamga-network/*` olarak npm'e **monorepo içinden** yayınlanır, ama bu **en
son adımdır** ve gevşek yapılamaz ([[ARCH-0005]] §3):

- `@tamga-network/verifier` **ekosistemin en değerli saldırı hedefidir** — ele
  geçirilirse sahte credential'ları sessizce kabul ettirir.
- Yayın yalnızca **CI'dan, GitHub OIDC ile** (`ARCH-0005/P2`); **uzun ömürlü
  npm token yok** (§3.2 S8).
- **`postinstall` yasak** (`ARCH-0005/P1`), `--provenance` + imza zorunlu.
- **Olgunlaşmamış/boş paket yayınlama.** Bir paket ancak testleri ve tüketicisi
  varken yayınlanır.

---

# 5. Sunucular ve Maliyet

Ne zaman sunucu gerekir ve ne kadara mal olur → [[ARCH-0004]] §2 (envanter) ve
§7.4 (maliyet). Özet: **Adım 1–5 kendi bilgisayarında ($0)**; bulut ancak
herkese açık testnet (Adım 7) için gerekir (~$50–110/ay konsolide; Faz 0 tam
envanter ~$600–1.000/ay ekonomik).

---

# 6. Şu An Ne Yapmalı

**Tek açık taahhüt kontrat derlemesidir** ([[DECISIONS]] §10). Ubuntu'da:
Foundry kur → `make build` → hataları kapat → yerelde deploy. Adım 3+ ancak
bundan sonra anlamlıdır. İlerleme her oturum operatörün özel raporlarına düşülür
(`/session-report`).

---

# İlişkiler

- [[ARCH-0001]] — ağ topolojisi ve fazlar (Adım 7'nin çerçevesi).
- [[ARCH-0002]] — Besu/QBFT kurulum adımları (Adım 2, 7).
- [[ARCH-0004]] — sunucu envanteri + maliyet (Adım 7).
- [[ARCH-0005]] — SDK paket haritası + yayın güvenliği (Adım 3, 6).
- [[SPEC-WALLET-0001]] — cüzdan değişmezleri (Adım 5).
- [[SPEC-BC-0001]] — güven katmanı kontratları (Adım 1).
- [[PM-GTM-0001]] — pilot planı (Adım 7).
- [[ROADMAP]] — üst düzey faz görünümü.

# Durum

**review_status: Draft.** Canlıya alma sırası, monorepo yapısı, mobil cüzdanın
native zorunluluğu ve paket yayın güvenliği tek referansta toplandı. Yeni
değişmez tanımlanmadı; bağlayıcı kurallar kaynak dokümanlardan DOC-ID/KOD ile
anıldı. Sıra ilerledikçe (Foundry derlemesi sonrası) güncellenecek.
