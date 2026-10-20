---
document_id: GUIDE-0006
title: "Etibar siyahılarının oxunması"
status: Active
version: 1.0.0
created: 2026-09-27
last_updated: 2026-10-16
summary: >
  Tamga-nın etibar lövbərindən istifadə: imzalı etibar siyahılarının TrustSource ilə oxunması, kök barmaq izinin sabitlənməsi, təzəlik və üçqiymətli cavablar; qeydiyyatın harada izah edildiyi; zəncir mərhələsi (Besu/QBFT) açıldıqda qovşaq və validator operatorları üçün konfiqurasiya, kontraktlar və keçidin tətbiqinizə təsiri.
translation_of: GUIDE-0006
source_version: "1.0.0"
---

# Etibar siyahıları və şəbəkə

Bu bələdçi Tamga-nın [[t:trust-list|etibar siyahılarını]] öz tətbiqində oxuyan tərtibatçılar və gələcəkdə şəbəkə qovşağı
idarə edəcək operatorlar üçündür.

**Nə vaxt oxunur:** [[t:verifier|yoxlayan tərəf]], rəqəmsal cüzdan və ya [[t:issuer|sənədi verən qurum]] servisi yazarkən "bu qurum kimdir, bu rəqəmsal sənədi verməyə səlahiyyətlidirmi?"
sualına cavab verməli olduğunuz zaman. Qısa izah: [Etibar siyahıları və federasiya](/concepts/trust-lists).

## Necə işləyir?

Tamga-da üç sualın cavabı **[[t:trust-anchor|etibar lövbərindədir]]**: bu qurum kimdir, bu rəqəmsal sənədi verməyə səlahiyyətlidirmi, bu
yoxlayan tərəf nə tələb edə bilər?

- **Bu gün** lövbər Tamga operatorunun imzaladığı və hər kəsin yükləyə bildiyi **imzalı etibar siyahılarıdır**.
- **Gələcəkdə**, ən azı iki müstəqil validator operatoru qoşulduqda, eyni qeydlər icazəli Besu/QBFT reyestrinə
  köçürülür ([[ADR-0009]]).

Tətbiqiniz hər iki halda eyni interfeysdən istifadə edir: **`TrustSource`**. Keçid günü kodunuz dəyişmir.

## 1. Etibar siyahısının oxunması

```ts
import { fetchListTrustSource, verifyJws } from "@tamga-network/trust";

const { source } = await fetchListTrustSource(
  "https://trust.tamga.network",
  async (url) => {
    const r = await fetch(url);
    return { status: r.status, text: () => r.text() };
  },
  { rootFingerprints: PINNED_ROOTS, verifyJws }, // root fingerprints fixed in your configuration
);

source.issuers();                                // registered institutions
source.relyingPartyByDnsName("example.com"); // a verifier's entry (by its permanent domain name) and the fields it may ask for
source.relyingParty("x509_hash:…"); // the same entry, by the request's client_id
source.isCredentialAcceptable(issuerId, iat);    // "YES" | "NO" | "UNKNOWN" — as of the credential's issuance date
```

İşlək nümunə: [[GUIDE-0004]] §4 (`examples/04-check-institution`). React Native və ya brauzer üçün
`@tamga-network/trust/core` istifadə edin (Node API-si yoxdur, imza yoxlayıcısı kənardan ötürülür — [[ADR-0015]]).

Yoxlayan tərəf qeydinin daimi identifikatoru domen adıdır (`dns_name`); müştəri identifikatoru sertifikatdan hesablanan [[t:x509_hash]] dəyəridir
([[ADR-0034]]). Buna görə iki oxuma yolu var: `relyingPartyByDnsName()` və `relyingParty()`.

## 2. Kökün sabitlənməsi və təzəlik

- **Kökü sabitləyin.** `rootFingerprints` dəyərini `tamga.network/trust-anchor` ünvanından bir dəfə götürüb konfiqurasiyanıza yazın. Siyahını
  yüklədiyiniz ünvana etibar etmək kifayət deyil; imza sabitlədiyiniz kökə zəncirlənməlidir.
- **Təzəlik.** Siyahının `next_update` tarixi keçibsə və ya siyahı yüklənə bilmirsə, cavablar `UNKNOWN` olur və yoxlama
  `INDETERMINATE` qaytarır — heç vaxt `ACCEPTED`, heç vaxt `REJECTED`.
- **Naməlum format versiyası.** Dayanın və xəbərdarlıq siqnalı verin; qəbul etməyin.
- **Keş.** Siyahıları və [[t:status-list|ləğv siyahılarını]] əvvəlcədən yükləyin; yoxlama anında şəbəkəyə müraciət etməyin.

## 3. Dərc edilən fayllar

| Fayl | Nədir |
|---|---|
| `lotl.jws` | List of Trusted Lists: ölkə siyahıları, rəqəmsal sənəd növləri, cüzdan provayderləri, operator |
| `tl-tr.jws` | Türkiyə siyahısı: kök sertifikatlar, sənədi verən qurumlar (səlahiyyətləri ilə), yoxlayan tərəflər (əhatə dairələri ilə) |
| `anchors.jsonl` | saatlıq imzalı [[t:anchor-log|lövbər jurnalı]] (ləğv siyahısı və sxem xülasələri buraya lövbərlənir) |
| `keys/root-fingerprints.json` | kök barmaq izləri (eynisi `tamga.network/trust-anchor` səhifəsində) |
| `CHANGELOG.md` | kim, nə vaxt, nə dəyişdi |

Format: [[SPEC-TRUST-0001]]. Siyahılar versiyalıdır və əvvəlkinin xülasəsini daşıyır; sətir silinmir; ən geci 90 gündə yenidən
imzalanır.

## 4. Qeydiyyat

Sənədi verən qurumlar və yoxlayan tərəflər siyahıya qeydiyyat qurumu tərəfindən əlavə edilir (bu gün müvəqqəti olaraq Tamga); dəyişikliklər ən geci
24 saat ərzində dərc olunur. Müraciət faylı, sertifikat sorğusu və məcburi qeydiyyat məlumatları ayrıca bələdçilərdədir:

- Sənədi verən qurum kimi: [[GUIDE-0007]]
- Yoxlayan tərəf kimi: [[GUIDE-0008]]

`TrustSource` hər qeydin status tarixçəsini daşıyır; başa çatmış səlahiyyətin qeydi silinmir, beləliklə əvvəlcədən verilmiş rəqəmsal sənədlər düzgün
yoxlanılır.

## 5. Dərinlik: zəncir mərhələsi

::: warning Hələ açıq deyil
Zəncir ən azı iki müstəqil validator operatorunun yazılı razılığı ilə açılır ([[ADR-0009]] K4). Bu bölmə həmin gün üçün
konfiqurasiyanı və tətbiqinizə təsirini izah edir; bu gün bu, inkişaf konfiqurasiyasıdır.
:::

**Tətbiqiniz üçün heç nə dəyişmir.** `TrustSource`-un zəncir tətbiqi eyni suallara eyni cavabı verir; bu, uyğunluq
vektorları (`conformance/`) ilə test edilir. Qurum identifikatorları (`issuer_id`, `ca_id`) və rəqəmsal sənəd növləri (`vct`) dəyişmir.
Konfiqurasiyanıza yeni mənbə ünvanı və kontrakt ünvanları əlavə olunur.

**Şəbəkə.** Hyperledger Besu, QBFT konsensusu, icazəli şəbəkə (yalnız icazəli qovşaqlar qoşulur). Zəncirə fərdi məlumatlar, rəqəmsal sənəd və ya sənəd
xülasəsi **yazılmır**; zəncir yalnız etibar qeydlərini daşıyır. Ləğv siyahıları zəncirdən kənarda qalır ([[ADR-0008]]).

**Kontraktlar** (Solidity + Foundry; mənbə kodu zəncir mərhələsi açıldıqda dərc olunur):

| Kontrakt | Nəyi saxlayır |
|---|---|
| `Governance` | üzvlük və səsvermə (dövlətlər, 2/3) |
| `RootCARegistry` | milli kök sertifikatlar |
| `IssuerRegistry` | qurumlar, status tarixçəsi, rəqəmsal sənəd növü səlahiyyətləri |
| `RelyingPartyRegistry` | yoxlayan tərəflər və onların əhatə dairələri |
| `SchemaRegistry` | rəqəmsal sənəd növləri və məzmun xülasələri |
| `StatusListRegistry` | ləğv siyahısı nəşrlərinin lövbərləri (bitlər deyil) |
| `CrossRecognition` | ölkələrarası tanınma |
| `TrustQueries` | vahid oxuma səthi (TrustSource-un zəncir tərəfi) |

**Qovşaq və validator operatorları üçün:**

| Rol | Nə edir | Şərt |
|---|---|---|
| Validator | blok təklif edir və imzalayır | müstəqil qurum, yazılı razılıq, açar HSM-də |
| Tam qovşaq | zənciri yoxlayır, oxuyur; imzalamır | icazə siyahısında qeyd |

Quraşdırma addımları (genesis, QBFT parametrləri, icazə siyahısı, qovşaq təsvirləri) və şəbəkə topologiyası zəncir mərhələsi açıldıqda
dərc olunur. Keçid zamanı siyahı arxivi kontrakt çağırışlarına yenidən tətbiq edilir; iki tətbiq eyni uyğunluq vektorlarından keçmədən
keçid tamamlanmış sayılmır.

## Qaydalar

| Kod | Nə deyir |
|---|---|
| Vahid etibar interfeysi | etibar məlumatları yalnız `TrustSource` vasitəsilə oxunur; siyahı faylları əl ilə şərh edilmir |
| Köhnəlmiş siyahı | siyahı köhnəlibsə və ya yüklənə bilmirsə, cavab `UNKNOWN`, nəticə `INDETERMINATE` |
| [[ARCH-0003]] CMP2 | naməlum format versiyasında dayan və xəbərdarlıq siqnalı ver |
| [[SPEC-BC-0001]] DP1 | heç bir kontrakt fərdi məlumatları, rəqəmsal sənəd məzmununu və ya sənəd xülasəsini saxlamır |

## Əlaqəli

- Format: [[SPEC-TRUST-0001]] · Zəncir məlumat sxemi: [[SPEC-BC-0001]] · Qurum identifikatoru: [[SPEC-ID-0002]]
- Qaydalar: [Tamga ARF — Arxitektura §3 və §8](https://arf.tamga.network/az/architecture)
