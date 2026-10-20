---
document_id: ADR-0010
title: "Sənəd növünün identifikatoru (URN)"
status: Active
version: 1.0.0
created: 2026-09-24
last_updated: 2026-10-07
summary: >
  D-SCHEMA-1 ("vct sabit HTTPS URL") əvəz edilir (supersede): sənəd növünün identifikatoru urn:tamga:<domain>:<Type>:<major> formatında URN olur; Type Metadata IETF SD-JWT VC §5.3.2 "registry" yolu ilə Tamga kataloqundan (metadata_url + content_hash) həll edilir; vct#integrity məcburi olaraq qalır (ETSI TS 119 472-1 EAA-5.2.1.2-03); schemaId = keccak256(vct) dəyişmir. Əsaslandırma: çoxdövlətli (TDT-first) ekosistemdə növ identifikatoru bir fondun domen adına bağlı ola bilməz; EUDI-nin PID razılaşması (urn:eudi:pid:1 + kataloq) eyni modeldir. Bundan əlavə, ETSI 119 472-1-in kontekstə xas EAA kateqoriya siqnalına icazə verməsinə əsaslanaraq Tamga öz kateqoriya URN-lərini müəyyən edir (urn:tamga:eaa:pub, urn:tamga:eaa:qualified); I1–I2 sənədi verən qurumlar kateqoriya daşımır; sənəd sahibinin LoA-sı heç vaxt rəqəmsal sənədə daxil edilmir (PR7 qorunur).
domain: Credentials
translation_of: ADR-0010
source_version: "1.0.0"
---

# ADR-0010 — Növ identifikatoru URN və EAA kateqoriya siqnalı

**Status: Accepted ✅** (2026-09-24).
Qəbul edildikdə [[DECISIONS]] D-SCHEMA-1 → **D-SCHEMA-4** (əvəzetmə), yeni **D-CRED-4**
(kateqoriya siqnalı).

---

# Kontekst

## Mövcud qərar və onun yenidən açılma səbəbi

[[ADR-0007]] Qərar 1 / [[DECISIONS]] D-SCHEMA-1: `vct` ([[t:vct]]) sabit HTTPS URL-dir
(`https://schema.tamga.network/v1/edu/DiplomaCredential/1.0.0`), Type Metadata birbaşa bu
URL-dən alınır, `vct#integrity` məcburidir və zəncirdəki `contentHash` dəyərinə bərabərdir.

2026-09-23/24 tarixli yoxlama (ilkin mətnlər) bunu göstərdi:

| Mənbə | Nə deyir |
|---|---|
| IETF draft-ietf-oauth-sd-jwt-vc-**19** §2.2.2.1 | `vct` **collision-resistant name**: HTTPS URL **və ya** URN (nümunə `urn:example:eudi:pid:…`) |
| eyni mənbə, §5.3 | Type Metadata: (1) URL-dən, (2) **etibarlı registry-dən**, (3) ekosistemin müəyyən etdiyi üsulla, (4) keşdən alına bilər |
| ETSI TS 119 472-1 V1.2.1 EAA-5.2.1.2-02/03 | `vct` Type Metadata-ya **işarə etməlidir**; `vct#integrity` **məcburidir** |
| ARF PID Rulebook v2.4.0 | PID növü `urn:eudi:pid:1`; milli `urn:eudi:pid:<cc>:1`; metadata **kataloqda** (PID_15) |
| ARF Attestation Rulebook şablonu | `vct` ekosistemdə unikal olmalıdır; format tələb olunmur |
| ETSI TS 119 472-1 §4.2.2 | EAA kateqoriyası "verilmə **kontekstində**" sinif siqnalıdır; Aİ URN-ləri (`urn:etsi:esi:eaa:eu:qualified` / `…:pub`) Aİ üçündür; "EAA kateqoriya **daxil edə bilər**" |

Yəni mövcud HTTPS qərarı standarta **uyğundur**; URN də uyğundur. Seçim texniki deyil,
**idarəetmə xarakterlidir**. Layihə rəhbərliyinin istiqaməti (2026-09-24): beta da TDT ilə
işləyirmiş kimi qurulur. Bu, açıq sualı bağlayır: çoxdövlətli konsorsiumun sənəd növü identifikatoru bir
fondun domen adına (`tamga.network`) bağlı ola bilməz. [[SPEC-SCHEMA-0001]] §10.3 "domen adı riski"
bölməsi bu asılılığı artıq "ekosistem hadisəsi" kimi qeyd etmişdi.

## İkinci məsələ: sənədi verən qurumun sinfi rəqəmsal sənəddə necə görünür?

[[t:eIDAS]] çərçivəsində [[t:QEAA]] və [[t:PuB-EAA]] [[t:credential]] **daxilində** kateqoriya siqnalı daşıyır (Annex V/VII "avtomatik
emal üçün uyğun göstərici"); qeyri-kvalifikasiyalı Aİ [[t:EAA|EAA-ları]] isə daşımır. Tamga-nın kanonik modelində
[[t:issuer]] dərəcəsi (I1–I3) yalnız reyestrdə saxlanılır; sənəddə sinif siqnalı yoxdur. TDT-first
modeldə Tamga ekosistemi eIDAS strukturunu **əks etdirməlidir**: dövlət qurumu/səlahiyyətli mənbə adından
verilən sənəd ilə Trust Framework-da akkreditə olunmuş qurumun sənədi [[t:verifier|yoxlayan tərəf üçün]] sənədin özündən
fərqləndirilə bilməlidir. [[t:holder]] [[t:LoA]] isə (PR7) sənədə **daxil edilmir** — eIDAS-da da daxil edilmir.

---

# Qərar

## Qərar 1 — `vct` URN-dir

```
urn:tamga:<domain>:<Type>:<major>
  domain ∈ {core, edu, org, health, mobility, travel, trade, …}   (SPEC-SCHEMA-0001 §1.2 domain list)
  Type   = PascalCase type name (DiplomaCredential, StudentCredential, TamgaBaseCredential)
  major  = integer; increases on breaking changes

Examples:
  urn:tamga:core:TamgaBaseCredential:1
  urn:tamga:edu:StudentCredential:1
  urn:tamga:edu:DiplomaCredential:1
Phase 1, state-specific (domestic) types:
  urn:tamga:<cc>:<domain>:<Type>:<major>        e.g. urn:tamga:tr:edu:TranscriptCredential:1
Category signals (decision 5):
  urn:tamga:eaa:pub · urn:tamga:eaa:qualified
```

`schemaId = keccak256(bytes(vct))` **dəyişmir** ([[SPEC-SCHEMA-0001]] §5.1).

## Qərar 2 — Type Metadata həlletmə yolu = kataloq (registry)

IETF §5.3.2 "trusted registry" yolu əsasdır. Reyestr (zəncir `SchemaRegistry` / Faza B
`lotl › schemas[]`) hər növ üçün aşağıdakıları saxlayır: `vct`, `metadata_url`, `content_hash`, `status`,
`status_history`. Yoxlayan tərəf/rəqəmsal cüzdan:

```
Ş1. read vct + vct#integrity (missing → REJECT)
Ş2. schemaId = keccak256(vct); is there a record, and its status (ACTIVE/DEPRECATED by iat)
Ş3. Type Metadata: cache(vct#integrity) → GET record.metadata_url → (fallback) catalogue bundle
Ş4. SHA-256(bytes) == vct#integrity == record.content_hash; document.vct == credential.vct
Ş5–Ş7 unchanged (extends, JSON Schema, authorisation)
```

`schema.tamga.network` artıq növ **identifikatoru** deyil, **kataloq və hostinq** ünvanıdır; domen adı
dəyişərsə, yalnız `metadata_url` dəyərləri dəyişir, `vct` dəyərləri və verilmiş sənədlər təsirlənmir.
Kataloq eyni zamanda ARF "Catalogue of attestation schemes"in qarşılığıdır; toplu paket
(`catalogue.jws`) rəqəmsal cüzdanın CMP8/WL9 toplu yükləməsini təmin edir.

## Qərar 3 — `vct#integrity` məcburi qalır; D1/D2 yenidən ifadə olunur

[[SPEC-SCHEMA-0001]]/D1 "dərc edilmiş `vct` URL-inin məzmunu heç vaxt dəyişmir" →
"dərc edilmiş `metadata_url` məzmunu heç vaxt dəyişmir"; D2 "`contentHash` = `vct#integrity` =
SHA-256(dərc edilən baytlar)" olduğu kimi qalır; D3 olduğu kimi qalır. `vct#integrity` sənəddə **məcburidir**
(ETSI 472-1 EAA-5.2.1.2-03; IETF-də ixtiyaridir — biz sərt yanaşmanı saxlayırıq).

## Qərar 4 — Versiyalaşdırma

- **major** URN-dədir; uyğunluğu pozan dəyişiklik = yeni URN = yeni `schemaId`; köhnə sənədlər köhnə
  URN ilə yoxlanılmağa davam edir (SC3 DEPRECATED pəncərəsi).
- **minor/patch** Type Metadata `version` sahəsindədir; hər buraxılış **yeni** `metadata_url` +
  `content_hash` deməkdir (D1-ə əsasən köhnə URL dəyişmir); reyestr "cari" olanı işarələyir; eyni URN altında
  bir neçə metadata versiyası ola bilər və sənəddəki `vct#integrity` hansının nəzərdə tutulduğunu
  dəqiqləşdirir. [[SPEC-SCHEMA-0001]] §9 semver qaydaları buna uyğun yenidən yazılır.

## Qərar 5 — Tamga EAA kateqoriya siqnalı

Sənəddə (SD-JWT VC claim, `sd: never`, seçici paylaşıma tabe deyil):

| Sənədi verən qurumun reyestr qeydi `class` | `category` claim-i | Aİ qarşılığı | Kim |
|---|---|---|---|
| `PUB` | `urn:tamga:eaa:pub` | PuB-EAA | Üzv dövlət qurumu və ya səlahiyyətli mənbə adından (NVİ, YÖK, MERSİS…) — reyestrə dövlət tərəfindən daxil edilir (`onlyOwnerState`) |
| `QUALIFIED` | `urn:tamga:eaa:qualified` | QEAA | Trust Framework-da akkreditə olunmuş **I3** sənədi verən qurum (ESHS e-Mühür/HSM/audit/sığorta) |
| `EAA` | **yoxdur** | EAA (qeyri-kvalifikasiyalı) | I1–I2 sənədi verən qurumlar |

Qaydalar: (a) sənədi verən qurum yalnız reyestrdəki `class` dəyərinə uyğun siqnalı qoya bilər; yoxlayan tərəf C-qatında
onu reyestrlə müqayisə edir, uyğunsuzluq → REJECTED (yeni addım kodu **C4**, [[SPEC-API-0001]] AP1
üzrə yeni kod); (b) sənəd sahibinin təminat səviyyəsi (T0–T3) **heç vaxt** sənədə yazılmır — PR7
qorunur, səviyyə növün ilkin şərtidir (DB-6); (c) Aİ URN-ləri (`urn:etsi:esi:eaa:eu:*`) Tamga
sənədi verən qurumları tərəfindən **istifadə edilə bilməz** (Aİ kontekstindən kənardayıq); (d) Faza 1-də bir dövlət öz
kvalifikasiyalı sinfini müəyyən edərsə, `urn:tamga:<cc>:eaa:qualified` alt-namespace-i açılır.

## Qərar 6 — `urn:tamga` ad sahəsinin idarə edilməsi

Beta-da qeyri-rəsmidir (EUDI-nin `urn:eudi` ad sahəsi kimi). Faza 1-də IANA-da formal URN NID qeydiyyatı
(RFC 8141) Trust Framework-un işidir. Alt-namespace-lərin ayrılması (`edu`, `eaa`, `<cc>`) Trust
Framework-da həyata keçirilir; Faza 0+ mərhələsində zəncirdə Governance 2/3.

## Qərar 7 — Keçid

Hələ heç bir sənəd verilməyib; **ikili dəstək yoxdur**. [[SPEC-SCHEMA-0001]] v2.0.0,
[[SPEC-SCHEMA-0002]] v2.0.0 (vct dəyərləri, Type Metadata nümunələri), [[SPEC-SCHEMA-0003]]
(skelet vct-lər), [[SPEC-CRED-0002]] v1.3.0 (`category` claim-i + yeni C), [[SPEC-API-0001]]
(C4 addımı), [[SPEC-PROTO-0001]] (PR2 mətni: "metadata-dakı hər `vct` reyestrdədir" olduğu kimi qalır).
Operatorun daxili reyestrindəki siyahı formatı artıq belədir.

---

# Əsaslandırma

1. **Domen adından asılı olmamaq = təhvildən asılı olmamaq.** Bu, TDT-first prinsipinin növ identifikatoruna tətbiqidir:
   `ca_id`, `issuer_id` operatordan necə asılı deyilsə, `vct` də elə olmalıdır. HTTPS vct
   `tamga.network` domen adını əbədi olaraq növ identifikatorunun bir hissəsinə çevirir.
2. **EUDI ilə eyni görünüş.** PID `urn:eudi:pid:1` + kataloq; ETSI kateqoriyaları URN-dir. EUDI
   yoxlayan tərəfi üçün `urn:tamga:…` + kataloq ilə `urn:eudi:…` + kataloq eyni emal yoludur.
3. **Standarta uyğunluqda itki yoxdur.** IETF §5.3.2 və ETSI 472-1-in "metadata-ya işarə" tələbi kataloq
   vasitəsilə ödənilir; `#integrity` məcburiliyi bizi ARF kataloqundan (hash tələbi yoxdur) daha
   güclü edir (R-13).
4. **Xərc indi sıfıra yaxındır.** Kod yoxdur; yalnız spec mətnləri var. Kod yazıldıqdan sonra bu
   dəyişiklik hər rəqəmsal cüzdana, yoxlayan tərəfə və sənədi verən quruma təsir edərdi.
5. **Kateqoriya siqnalı eIDAS strukturunu əks etdirir** və yoxlayan tərəfə "dövlət qurumudur, akkreditə olunub,
   yoxsa qeydiyyatdadır" sualının cavabını sənədin özündən almağa imkan verir; reyestrlə çarpaz yoxlama (C4) saxta siqnalın
   qarşısını alır.

---

# Nəzərdən keçirilmiş alternativlər

## A — HTTPS URL-də qalmaq (D-SCHEMA-1) — Rədd edildi (idarəetmə səbəbi ilə)
Standarta uyğundur, xarici yoxlayan tərəf üçün özü həll olunur (IETF §5.3.1 hər kitabxanada var),
§10.3 üzrə riskazaltma tədbirləri mövcuddur. Lakin növ identifikatoru domen adına bağlı qalır; bu, TDT-first ilə ziddiyyət təşkil edir.
Texniki baxımdan **yanlış deyildi**; bu ADR onu "səhv" kimi deyil, "modelə uyğun gəlməyən" kimi əvəz edir.

## B — `.well-known/vct` yolu — Tətbiq edilə bilməz
draft-19-da yoxdur (aralıq layihələrdə var idi). Standartdan kənar yol müəyyən etmək interop-u pozur.

## C — DID əsaslı növ identifikatoru (`did:…`) — Rədd edildi
[[ADR-0004]] DID entity profilini əvəz etdi; növ identifikatoruna DID-i geri qaytarmaq uyğunsuzluq yaradardı.

## D — Kateqoriya siqnalını qoymamaq (əvvəlki DB-15) — Rədd edildi
Aİ baxımından qeyri-kvalifikasiyalı EAA olduğumuz doğrudur; lakin ETSI 472-1 kontekstə xas kateqoriyaya icazə
verir və TDT-first model öz siniflərini tələb edir. Siqnalı qoymamaq PUB/QUALIFIED fərqini yalnız
reyestrdə saxlayır və sənədi Aİ qarşılıqlarına nisbətən özünü daha az izah edən edir.

## E — Sənəd sahibinin LoA-sını sənədə qoymaq — Rədd edildi (yenidən)
eIDAS bunu etmir; PR7 bunu etmir; PM-TRUST-0001 əsaslandırması qüvvədədir. Səviyyə növün ilkin şərtidir.

---

# Nəticələr

## Bağlayıcı müddəalar
1. [[DECISIONS]]: D-SCHEMA-1 → Dəyişdirilmiş Qərarlar cədvəli; yeni **D-SCHEMA-4** (vct URN +
   kataloq), **D-CRED-4** (kateqoriya siqnalı, sənəd sahibinin LoA-sı heç vaxt).
2. [[SPEC-SCHEMA-0001]] v2.0.0: §1 "URL sxemi" → "URN sxemi + kataloq"; §1.4 həlletmə; §7 Ş3;
   §9 versiyalaşdırma; D1 yenidən ifadə; `tamga` blokuna `category_allowed`.
3. [[SPEC-SCHEMA-0002]] v2.0.0, [[SPEC-SCHEMA-0003]] v1.1.0: vct dəyərləri.
4. [[SPEC-CRED-0002]] v1.3.0: `category` claim-i (ixtiyari, reyestrlə uyğun gəlməlidir), yeni invariant
   **C18** "`category` yalnız reyestrdəki `class` dəyərinə bərabər olduqda qəbul edilir; sənəd sahibinin təminat səviyyəsi claim-i
   yoxdur".
5. [[SPEC-API-0001]] v1.2.0: **C4** addımı (kateqoriya ↔ reyestr), nəticə obyektinə `issuer.class`.
6. [[PM-ASSUR-0001]] v1.1.0: B oxu cədvəlinə `class` sütunu; "növ × sinif" siyasət nümunəsi.
7. `/sync-index`: INVARIANTS D1 mətni, C18, C4 qeydi; MASTER_INDEX versiyaları.

## Qəbul edilmiş kompromislər
- Tamga-dan kənar yoxlayan tərəf Tamga kataloqunu bilmədən `urn:tamga:…` metadata-sını həll edə bilməz
  (HTTPS-də GET kifayət edərdi). Qarşılıq: kataloq URL-i Trust Framework-də elan olunur; SDK onu
  standart olaraq daxil edir; EUDI yoxlayan tərəfləri də Aİ URN-ləri üçün eyni şeyi edir.
- Kateqoriya claim-i daha bir iddia deməkdir; C4 çarpaz yoxlaması olmadan mənasızdır (buna görə də
  ötürülə bilməz).

---

# Əlaqələr

**Qismən əvəz edir (supersede):** [[ADR-0007]] Qərar 1 (vct HTTPS URL); D-SCHEMA-1
**Qoruyur:** [[ADR-0007]] K2–K6 (off-chain metadata + lövbər, `#integrity`, iki qat, allowlist)
**Əsaslanır:** [[ADR-0009]] Qərar 5 (TDT-first) · [[RS-EIDAS-0001]] §4.4/§5.1 · IETF SD-JWT VC-19 · ETSI TS 119 472-1
**Dəyişdirir:** [[SPEC-SCHEMA-0001]], [[SPEC-SCHEMA-0002]], [[SPEC-SCHEMA-0003]], [[SPEC-CRED-0002]], [[SPEC-API-0001]], [[PM-ASSUR-0001]]
**Təhlil mənbəyi:** operatorun daxili qeydi.

---

# Status

**Accepted ✅** — 2026-09-24. [[DECISIONS]]-a D-SCHEMA-4, D-CRED-4 kimi daxil edildi; təsirlənən SPEC versiya yeniləmələri DECISIONS §10 açıq öhdəliklər siyahısındadır.
