---
document_id: GUIDE-0006
title: "Güven listelerini okumak"
status: Active
version: 1.0.0
created: 2026-09-27
last_updated: 2026-10-03
summary: >
  Tamga'nın güven çapasını kullanmak: imzalı güven listelerini TrustSource ile okumak, kök parmak izini sabitlemek, tazelik
  ve üç değerli cevaplar; kaydın nerede anlatıldığı; zincir aşaması (Besu/QBFT) açıldığında düğüm ve validator operatörleri için
  yapılandırma, kontratlar ve geçişin uygulamanıza etkisi.
---

# Güven listeleri ve ağ

Bu rehber, Tamga'nın [[t:trust-list|güven listelerini]] kendi uygulamasında okuyan geliştiriciler ve ileride ağ düğümü
çalıştıracak operatörler içindir.

**Ne zaman okunur:** [[t:verifier|doğrulayıcı]], cüzdan ya da [[t:issuer|belge veren]] servisi yazarken "bu kurum kim, bu belgeyi vermeye yetkili mi?"
sorusunu cevaplamanız gerektiğinde. Kısa anlatım: [Güven listeleri ve federasyon](/concepts/trust-lists).

## Nasıl çalışır?

Tamga'da üç sorunun cevabı **[[t:trust-anchor|güven çapasındadır]]**: bu kurum kim, bu belgeyi vermeye yetkili mi, bu
doğrulayıcı ne isteyebilir?

- **Bugün** çapa, Tamga operatörünün imzaladığı ve herkesin indirebildiği **imzalı güven listeleridir**.
- **İleride**, en az iki bağımsız validator operatörü katıldığında aynı kayıtlar izinli bir Besu/QBFT defterine
  taşınır ([[ADR-0009]]).

Uygulamanız iki durumda da aynı arayüzü kullanır: **`TrustSource`**. Geçiş günü kodunuz değişmez.

## 1. Güven listesini okumak

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
`@tamga-network/trust/core` kullanın (Node API'si yok, imza doğrulayıcı dışarıdan verilir — [[ADR-0015]]).

Doğrulayıcı kaydının kalıcı kimliği alan adıdır (`dns_name`); istemci kimliği sertifikadan hesaplanan [[t:x509_hash]] değeridir
([[ADR-0034]]). Bu yüzden iki okuma yolu vardır: `relyingPartyByDnsName()` ve `relyingParty()`.

## 2. Kök sabitleme ve tazelik

- **Kökü sabitleyin.** `rootFingerprints` değerini `tamga.network/trust-anchor`'dan bir kez alıp yapılandırmanıza yazın. Listeyi
  indirdiğiniz adrese güvenmek yetmez; imza, sabitlediğiniz köke zincirlenmelidir.
- **Tazelik.** Liste `next_update` tarihini geçtiyse ya da indirilemiyorsa cevaplar `UNKNOWN` olur ve doğrulama
  `INDETERMINATE` döner — asla `ACCEPTED`, asla `REJECTED`.
- **Bilinmeyen biçim sürümü.** Durun ve alarm verin; kabul etmeyin.
- **Önbellek.** Listeleri ve [[t:status-list|iptal listelerini]] önceden çekin; doğrulama anında ağa gitmeyin.

## 3. Yayınlanan dosyalar

| Dosya | Ne |
|---|---|
| `lotl.jws` | List of Trusted Lists: ülke listeleri, belge türleri, cüzdan sağlayıcıları, operatör |
| `tl-tr.jws` | Türkiye listesi: kök sertifikalar, belge verenler (yetkileriyle), doğrulayıcılar (kapsamlarıyla) |
| `anchors.jsonl` | saatlik imzalı [[t:anchor-log|çapa günlüğü]] (iptal listesi ve şema özetleri buraya çapalanır) |
| `keys/root-fingerprints.json` | kök parmak izleri (aynısı `tamga.network/trust-anchor` sayfasında) |
| `CHANGELOG.md` | kim, ne zaman, ne değişti |

Biçim: [[SPEC-TRUST-0001]]. Listeler sürümlüdür ve bir öncekinin özetini taşır; satır silinmez; en geç 90 günde yeniden
imzalanır.

## 4. Kayıt

Belge verenler ve doğrulayıcılar listeye kayıt kurumu tarafından eklenir (bugün Tamga, geçici olarak); değişiklikler en geç
24 saatte yayındadır. Başvuru dosyası, sertifika isteği ve zorunlu kayıt verileri ayrı rehberlerdedir:

- Belge veren olarak: [[GUIDE-0007]]
- Doğrulayıcı olarak: [[GUIDE-0008]]

`TrustSource` her kaydın durum geçmişini taşır; bitirilen bir yetkinin kaydı silinmez, böylece önceden verilmiş belgeler doğru
doğrulanır.

## 5. Derinlik: zincir aşaması

::: warning Henüz açık değil
Zincir, en az iki bağımsız validator operatörünün yazılı kabulüyle açılır ([[ADR-0009]] K4). Bu bölüm o gün için
yapılandırmayı ve uygulamanıza etkisini anlatır; bugün geliştirme yapılandırmasıdır.
:::

**Uygulamanız için hiçbir şey değişmez.** `TrustSource`'un zincir uygulaması aynı sorulara aynı cevabı verir; bu, uyum
vektörleriyle (`conformance/`) test edilir. Kurum kimlikleri (`issuer_id`, `ca_id`) ve belge türleri (`vct`) değişmez.
Yapılandırmanıza yeni bir kaynak adresi ve kontrat adresleri eklenir.

**Ağ.** Hyperledger Besu, QBFT uzlaşması, izinli ağ (yalnızca izinli düğümler bağlanır). Zincire kişisel veri, belge ya da belge
özeti **yazılmaz**; zincir yalnızca güven kayıtlarını taşır. İptal listeleri zincir dışında kalır ([[ADR-0008]]).

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

**Düğüm ve validator operatörleri için:**

| Rol | Ne yapar | Şart |
|---|---|---|
| Validator | blok önerir ve imzalar | bağımsız kurum, yazılı kabul, anahtar HSM'de |
| Tam düğüm | zinciri doğrular, okur; imzalamaz | izin listesinde kayıt |

Kurulum adımları (genesis, QBFT ayarları, izin listesi, düğüm tanımları) [[ARCH-0002]]'de; ağ topolojisi ve faz modeli
[[ARCH-0001]]'de. Geçişte liste arşivi kontrat çağrılarına yeniden oynatılır; iki uygulama aynı uyum vektörlerini geçmeden
geçiş tamamlanmış sayılmaz.

## Kurallar

| Kod | Ne der |
|---|---|
| Tek güven arayüzü | güven verisi yalnızca `TrustSource` üzerinden okunur; liste dosyaları elle yorumlanmaz |
| Bayat liste | liste bayatsa ya da indirilemiyorsa cevap `UNKNOWN`, sonuç `INDETERMINATE` |
| [[ARCH-0003]] CMP2 | bilinmeyen biçim sürümünde dur ve alarm ver |
| [[SPEC-BC-0001]] DP1 | hiçbir kontrat kişisel veri, belge içeriği ya da belge özeti saklamaz |

## İlgili

- Biçim: [[SPEC-TRUST-0001]] · Zincir veri şeması: [[SPEC-BC-0001]] · Kurum kimliği: [[SPEC-ID-0002]]
- Kurallar: [Tamga ARF — Mimari §3 ve §8](https://arf.tamga.network/tr/architecture)
