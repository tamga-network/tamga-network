---
document_id: GUIDE-0006
title: Güven Listeleri ve Ağ — TrustSource, Kök Sabitleme ve Zincir Aşaması
category: Guide
domain: Integration
status: Draft
review_status: Draft
version: 0.2.1
created: 2026-09-27
last_updated: 2026-10-01
authors:
  - Tamga Network Engineering
tags: [guide, trust-list, trustsource, besu, qbft, validator]
keywords: [fetchListTrustSource, TrustSource, root fingerprints, anchors.jsonl, Besu QBFT, validator, contracts]
summary: >
  Tamga'nın güven çapasını kullanmak: imzalı güven listelerini TrustSource ile okumak, kök parmak izini sabitlemek, tazelik
  ve üç değerli cevaplar; kayıt süreci; zincir aşaması (Besu/QBFT) açıldığında düğüm ve doğrulayıcı operatörleri için
  yapılandırma, kontratlar ve geçişin uygulamanıza etkisi.
priority: High
language: tr
audience: [integrators, node-operators, engineers]
related: ["[[SPEC-TRUST-0001]]", "[[ADR-0009]]", "[[ADR-0015]]", "[[SPEC-BC-0001]]", "[[ADR-0024]]", "[[ARCH-0001]]", "[[ARCH-0002]]"]
---

> **Sürüm notu 0.2.1 (2026-10-01) — [[ADR-0034]] (D-PROTO-2):** doğrulayıcı kaydı alan adı (`dns_name`) ve sertifikadan hesaplanan `x509_hash` istemci kimliğiyle; `relyingPartyByDnsName()`.

# Güven listeleri ve ağ

Tamga'da "bu kurum kim, bu belgeyi vermeye yetkili mi, bu doğrulayıcı ne isteyebilir" sorularının cevabı **güven
çapasındadır**. Bugün çapa imzalı güven listeleridir (Faz B); ≥ 2 bağımsız doğrulayıcı operatörü olduğunda Besu/QBFT zinciri
açılır ([[ADR-0009]]). Uygulamanız iki durumda da aynı arayüzü kullanır: **`TrustSource`**.

## 1. Güven listelerini okumak

```ts
import { fetchListTrustSource, verifyJws } from "@tamga-network/trust";

const { source } = await fetchListTrustSource(
  "https://trust.tamga.network",
  async (url) => {
    const r = await fetch(url);
    return { status: r.status, text: () => r.text() };
  },
  { rootFingerprints: PINNED_ROOTS, verifyJws }, // kök parmak izleri yapılandırmanızda sabit
);

source.issuers();                                // kayıtlı kurumlar
source.relyingPartyByDnsName("example.com"); // bir doğrulayıcının kaydı (kalıcı alan adıyla) ve istenebilecek alanlar
source.relyingParty("x509_hash:…"); // aynı kayıt, isteğin client_id'siyle
source.isCredentialAcceptable(issuerId, iat);    // "YES" | "NO" | "UNKNOWN" — belgenin verildiği tarihe göre
```

Çalışan örnek: [[GUIDE-0004]] §4 (`examples/04-check-institution`). React Native ya da tarayıcı için
`@tamga-network/trust/core` (Node API'si yok, imza doğrulayıcı dışarıdan verilir — [[ADR-0015]]).

## 2. Yayınlanan dosyalar

| Dosya | Ne |
|---|---|
| `lotl.jws` | listelerin listesi: ülke listeleri, belge türleri, cüzdan sağlayıcıları, operatör |
| `tl-tr.jws` | Türkiye listesi: kök sertifikalar, kurumlar (yetkileriyle), doğrulayıcılar (kapsamlarıyla) |
| `anchors.jsonl` | saatlik imzalı çapa günlüğü (iptal listesi ve şema özetleri buraya çapalanır) |
| `keys/root-fingerprints.json` | kök parmak izleri (aynısı `tamga.network/trust-anchor` sayfasında) |
| `CHANGELOG.md` | kim, ne zaman, ne değişti |

Biçim: [[SPEC-TRUST-0001]]. Listeler sürümlüdür ve bir öncekinin özetini taşır; satır silinmez; en geç 90 günde yeniden
imzalanır.

## 3. Kök sabitleme ve tazelik

- **Kökü sabitleyin:** `rootFingerprints` değerini `tamga.network/trust-anchor`'dan bir kez alıp yapılandırmanıza yazın. Listeyi
  indirdiğiniz adrese güvenmek yetmez; imza sabitlediğiniz köke zincirlenmelidir.
- **Tazelik:** liste `next_update` tarihini geçtiyse ya da indirilemiyorsa cevaplar `UNKNOWN` olur ve doğrulama
  `INDETERMINATE` döner — asla `ACCEPTED`, asla `REJECTED` (BT5).
- **Bilinmeyen biçim sürümü:** durun ve alarm verin; kabul etmeyin (CMP2).
- **Önbellek:** listeleri ve iptal listelerini önceden çekin; doğrulama anında ağa gitmeyin.

## 4. Kayıt

Kurumlar (ihraççı) ve doğrulayıcılar listeye **Tamga operatörü** tarafından eklenir (Faz B'de geçici liste operatörü). Kayıtta:
kurum için sertifika, sınıf, belge türü yetkileri; doğrulayıcı için alan adı (`dns_name`; `client_id` = `x509_hash`, sertifikadan), erişim sertifikası ve
istenebilecek alanlar. Şartlar: [Tamga ARF — Ek A §3.2](https://arf.tamga.network/tr/annex-a-trust-framework).
Değişiklikler 24 saat içinde yayınlanır.

**Başvuru.** Kurum ya da doğrulayıcı bir başvuru dosyası (JSON) ve bir sertifika isteği (CSR, P-256) gönderir; özel anahtar
başvuranda kalır. Başvuruda AB ortak kayıt veri seti alanları zorunludur ([[ADR-0024]]): ticari ad, kimlik numarası (VKN/MERSİS),
posta adresi, iletişim, veri koruma kurumu başvuru yolu; doğrulayıcı için ayrıca hizmet açıklaması, kamu kurumu olup olmadığı ve
her kullanım için gizlilik politikası adresi. Eksik alan varsa kayıt yapılmaz; operatör eksiklerin tamamını tek seferde bildirir.
Örnek başvurular: `apps/trust-publisher/registry/examples/`. Şema yetkisi sonradan verilebilir ya da bitirilebilir; bitirilen
yetkinin kaydı silinmez, böylece önceden verilmiş belgeler doğru doğrulanır.

## 5. Zincir aşaması (Faz 0+)

::: warning Henüz açık değil
Zincir, en az iki bağımsız doğrulayıcı operatörünün yazılı kabulüyle açılır ([[ADR-0009]] K4). Aşağıdaki bölüm o gün için
yapılandırmayı ve uygulamanıza etkisini anlatır; bugün geliştirme yapılandırmasıdır.
:::

**Uygulamanız için:** hiçbir şey değişmez. `TrustSource`'un zincir uygulaması aynı sorulara aynı cevabı verir; bu, uyum
vektörleriyle (`conformance/`) test edilir. Kurum kimlikleri (`issuer_id`, `ca_id`) ve belge türleri (`vct`) değişmez. Yeni bir
kaynak adresi ve kontrat adresleri yapılandırmanıza eklenir.

**Ağ:** Hyperledger Besu, QBFT uzlaşması, izinli ağ (yalnızca izinli düğümler bağlanır). Zincire kişisel veri, belge ya da belge
özeti **yazılmaz**; zincir yalnızca güven kayıtlarını taşır ([[SPEC-BC-0001]] DP1). İptal listeleri zincir dışında kalır
([[ADR-0008]]).

**Kontratlar** (`contracts/`, Solidity + Foundry):

| Kontrat | Ne tutar |
|---|---|
| `Governance` | üyelik ve oylama (devletler, 2/3) |
| `RootCARegistry` | ulusal kök sertifikalar |
| `IssuerRegistry` | kurumlar, durum geçmişi, belge türü yetkileri |
| `RelyingPartyRegistry` | doğrulayıcılar ve kapsamları |
| `SchemaRegistry` | belge türleri ve içerik özetleri |
| `StatusListRegistry` | iptal listesi yayınlarının çapaları (bitler değil) |
| `CrossRecognition` | ülkeler arası tanıma |
| `TrustQueries` | tek okuma yüzeyi (TrustSource'un zincir tarafı) |

```sh
cd contracts && forge build && forge test   # Foundry gerekir
```

**Düğüm ve doğrulayıcı operatörleri için:**

| Rol | Ne yapar | Şart |
|---|---|---|
| Doğrulayıcı (validator) | blok önerir ve imzalar | bağımsız kurum, yazılı kabul, anahtar HSM'de |
| Tam düğüm | zinciri doğrular, okur; imzalamaz | izin listesinde kayıt |

Kurulum adımları (genesis, QBFT ayarları, izin listesi, düğüm tanımları) [[ARCH-0002]]'de; ağ topolojisi ve faz modeli
[[ARCH-0001]]'de. Geçiş: liste arşivi kontrat çağrılarına yeniden oynatılır ve iki uygulama aynı uyum vektörlerini geçmeden
geçiş tamamlanmış sayılmaz (`docs/delivery/05-MIGRATION-TO-CHAIN.md`).

## 6. İlgili

- Biçim: [[SPEC-TRUST-0001]] · Zincir veri şeması: [[SPEC-BC-0001]] · Kurum kimliği: [[SPEC-ID-0002]]
- Kurallar: [Tamga ARF — Mimari §3 ve §8](https://arf.tamga.network/tr/architecture)
