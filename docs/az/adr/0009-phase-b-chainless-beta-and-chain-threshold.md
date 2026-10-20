---
document_id: ADR-0009
title: "Zəncirsiz beta və zəncir həddi"
status: Active
version: 1.0.0
created: 2026-09-24
last_updated: 2026-10-07
summary: >
  Pilotu zəncirə bağlayan ilkin şərtlər (PM-GTM-0001 Ö1/Ö2) aradan qaldırılır; Faza 0-dan əvvəl "Faza B — zəncirsiz beta" əlavə olunur. Betada etibar lövbəri Tamga-nın müvəqqəti operator kimi imzaladığı, versiyalı və hash-zəncirli etibar siyahıları (LOTL + milli siyahı) və saatlıq lövbər jurnalıdır — ETSI TS 119 612 / EUDI modeli. Zəncir (D-BC-0 Besu/QBFT, invariant) yalnız ən azı iki müstəqil validator operatoru olduqda qurulur; tək operatorun idarə etdiyi dörd validator imzalı siyahıdan artıq etibar yaratmır. Betanın hər bir məlumat strukturu çoxdövlətli (TDT) quruluşu bu gündən daşıyır; Tamga hər yerdə "vəkalətən, müvəqqəti" operatordur və təhvil yalnız operator sahəsini dəyişir. Keçid = siyahı tarixçəsinin kontraktlarda yenidən oynadılması + ekvivalentlik testi.
domain: Trust
translation_of: ADR-0009
source_version: "1.0.0"
---

# ADR-0009 — Faza B: Zəncirsiz beta

**Status: Accepted ✅** (2026-09-24).
Qəbul edildikdə [[DECISIONS]]-a **D-BC-6**, **D-GTM-2**, **D-GOV-5** kimi daxil edilir.

---

# Kontekst

## Problem

Tamga-nın kanonik yol xəritəsi pilotu zəncirə bağlayır: PM-GTM-0001 §2 ilkin şərtləri
**Ö1** "kontraktlar kompilyasiya olunur və testlərdən keçir", **Ö2** "testnet işləkdir, kontraktlar yerləşdirilib"
tamamlanmadan real məzun məlumatları emal edilə bilməz (GT1). [[ARCH-0001]] §3 Faza 0-ı "4 fond
validatoru" kimi müəyyən edir. Kontraktlar bu günə qədər heç vaxt kompilyasiya olunmayıb (Foundry yoxdur; DECISIONS
§10.5). Bu, universitet pilotunu və deməli, universitetlə razılaşmanı və investor görüşlərini
zəncir infrastrukturunun arxasında kilidləyir.

## Müşahidə: Faza 0 zənciri etibar yaratmır (F1)

Faza 0-dakı dörd validatorun **hamısı Tamga fonduna məxsusdur**. Tək operatorun idarə etdiyi dörd QBFT
node-u Bizans xətalarına davamlılığın fərz etdiyi **müstəqilliyi** təmin etmir: dördü də eyni əlin
altındadırsa, "Tamga yalan demir" fərziyyəsi həm zəncirdə, həm də imzalı siyahıda eyni şəkildə
tələb olunur. Fərq yalnız əməliyyat xarakterlidir (fasilələrə davamlılıq) və gələcək çoxtərəfliliyə
hazırlıqdır; **etibar baxımından** tək operatorlu zəncir = tək operatorun imzaladığı,
hash-zəncirli jurnal. Buna görə də zənciri Faza 0-da **məcburi şərt etmək** pilotun xərcini
artırır, təminatını artırmır.

Zəncir imzaçıların sayı 1-dən çox olduqda dəyər yaradır. [[DECISIONS]] D-GOV-2 təhvil
hədlərini (≥3 dövlət, ≥4 dövlət + 12 ay) müəyyən edir, lakin **başlanğıc həddi** heç müəyyən edilməyib.

## Avropa nə edir

[[t:EUDI-Wallet]] ekosistemində etibar lövbəri ([[t:trust-anchor]]) zəncir deyil, hər üzv dövlətin imzaladığı **Trusted
List** ([[t:ETSI]] TS 119 612) + Komissiyanın [[t:LOTL]] siyahısıdır; digest Rəsmi Qəzetdə dərc edilir.
EBSI eyni qeydləri zəncirdə saxlayır. Tamga-nın kanonik dizaynı EBSI modelini EUDI/ETSI məlumat
semantikası ilə istifadə edir ([[SPEC-ID-0002]] §8.1). Beta üçün EUDI-nin öz modelinə (imzalı siyahı)
keçmək arxitekturadan kənarlaşma deyil, eyni semantikanın tək imzaçılı xüsusi halıdır. Təhlil:
operatorun daxili qeydi.

## Layihə idarəetməsinin istiqaməti (2026-09-23/24)

Zəncir gözlənilmədən pilot başladılır; arxitektura qərarları dəyişmir. Beta da dövlətlər və TDT qoşulmuş kimi qurulur;
bu quruluş sonra zəncirə köçürülür.

---

# Qərar

## Qərar 1 — Faza B əlavə edilir

Fazaların ardıcıllığı **Faza B → Faza 0 → Faza 1 → Faza 2** olur. Faza B = zəncirsiz beta: universitet pilotu,
[[t:verifier|yoxlayan tərəflər]], Trust Framework, ölçülmüş nəticə. Tətbiqin kod bazası `tamga (bu depo, `packages/` + `apps/`)`
(tamga-network-dan kənarda, lakin tamga-network sənədləri mötəbər mənbədir).

## Qərar 2 — Betanın etibar lövbəri: imzalı, versiyalı, hash-zəncirli siyahılar + lövbər jurnalı

`trust.tamga.network` altında:

| Fayl | Zəncirdəki qarşılığı | Qayda |
|---|---|---|
| `lotl.jws` | `Governance` üzv siyahısı + `SchemaRegistry` (NETWORK) + cüzdan provayderi lövbəri | `version` monoton, `previous_version_hash`, `next_update` ≤ 90 gün, dəyişiklik olmasa belə yenidən imza |
| `tl-<cc>.jws` | `RootCARegistry` + `IssuerRegistry` (+ `SchemaAuth`) + `RelyingPartyRegistry` + `CrossRecognition` | eyni; milli namespace yalnız həmin dövlətin (beta: Tamga vəkalətən) açarı ilə imzalanır (N1-in beta oxunuşu) |
| `anchors.jsonl` | `StatusListRegistry.publishList` + sxem `contentHash` lövbərləri | append-only; **saatlıq** imza (heartbeat daxil); sətir silinmir; `previous_hash` |
| `keys/` + daimi veb səhifə | Rəsmi Qəzetdə elan | LOTL imza sertifikatlarının barmaq izləri; ≥2 növbəli əvəzlənən sertifikat (ETSI 119 612 Annex A.2); rotasiya ≥30 gün əvvəl, yeni açar köhnəsi ilə imzalanır |

Kanonik sahə adları və nümunələr: operatorun daxili qeydi (qəbulla birlikdə
**SPEC-TRUST-0001** kimi rəsmiləşir — DB-11).

## Qərar 3 — Lövbərin əvəzlənməsi: "zəncirə qeyd edilir" ifadələrinin beta oxunuşu

Aşağıdakı invariantların **mənası qorunur**, daşıyıcısı dəyişir:

| İnvariant | Kanonik ifadə | Faza B oxunuşu |
|---|---|---|
| [[SPEC-CRED-0003]]/S1 | Zəncirdə ləğv biti yoxdur; yalnız lövbər | Siyahıda/jurnalda ləğv biti yoxdur; yalnız lövbər |
| [[SPEC-CRED-0003]]/S4 | Nəşr CDN-ə yazıldıqdan **sonra** zəncirə qeyd edilir | … sonra **lövbər jurnalına** qeyd edilir (ardıcıllıq eynən) |
| [[SPEC-SCHEMA-0001]]/D8 | Zəncir qeydi CDN nəşrindən sonra | Lövbər jurnalı qeydi CDN nəşrindən sonra |
| [[SPEC-BC-0001]]/DP1 | Heç bir kontrakt fərdi məlumat… saxlamır | Heç bir siyahı/jurnal/log fərdi məlumat… saxlamır |
| [[SPEC-BC-0001]]/N1 | Namespace sahibindən başqa heç kim yaza bilməz | Milli siyahını yalnız həmin namespace-in imza açarı imzalayır |
| [[SPEC-BC-0001]]/GV2 | NETWORK sxemi yalnız Governance ilə | NETWORK sxemi yalnız `lotl.jws` daxilində, operator imzası ilə (**dayandırılıb**: tək üzv) |
| [[ARCH-0003]]/CMP1 | Yoxlayan tərəf zənciri birbaşa sorğulamır; indeksləyicidən oxuyur | Yoxlayan tərəf siyahı fayllarını birbaşa şərh etmir; `TrustSource` keşindən oxuyur |
| [[ARCH-0003]]/CMP2 | Naməlum implementasiya versiyası → dayan | Naməlum `list_format_version` → dayan |
| [[ARCH-0003]]/CMP4 | Köhnəlmiş indeksləyici → INDETERMINATE | `next_update` keçmiş/əlçatmaz siyahı → INDETERMINATE |

Bu oxunuşlar müvafiq spesifikasiyalara **versiya qeydi** kimi əlavə edilir; invariant mətnləri dəyişmir.
[[ADR-0007]] və [[ADR-0008]]-in "məzmun off-chain, lövbər on-chain" prinsipi "məzmun off-chain,
lövbər **kanonik qeyddə** (zəncir və ya Faza B siyahısı)" kimi oxunur.

**Məlum zəifləmə (dürüst qeyd):** Zəncirdəki lövbər [[t:issuer|sənədi verən qurumun]] ikili danışığını (iki yoxlayan tərəfə
iki fərqli siyahı) konsensus vasitəsilə qeyri-mümkün edir. Faza B-də lövbər operator imzasına əsaslanır; operator
ilə sənədi verən qurum birlikdə hərəkət edərsə, ikili danışıq **mümkündür**; hamıya açıq jurnal, rüblük
şəffaflıq hesabatı (G8) və müstəqil audit bundan **çəkindirir**, lakin qeyri-mümkün etmir. Bu, Faza 0
məhdudiyyətlər bildirişinə **6-cı bənd** kimi daxil edilir (Qərar 6).

## Qərar 4 — Zəncirin başlanğıc həddi

Besu/QBFT zənciri ([[ADR-0001]], invariant) **yalnız** aşağıdakı şərt ödənildikdə qurulur:

> **Ən azı iki müstəqil validator operatoru** (Tamga + Tamga-dan hüquqi və əməliyyat baxımından
> müstəqil ≥1 qurum: ikinci universitet, ticarət/sənaye palatası və ya dövlət qurumu) validator
> idarə etməyi **yazılı** şəkildə qəbul etmiş olmalıdır.

Bu sətir [[DECISIONS]] D-GOV-2 hədlər cədvəlinə "başlanğıc" sətri kimi əlavə edilir. Şərt
ödənilmədən zəncir qurmaq tək operatorlu zənciri "çoxtərəfli" kimi təqdim etmək deməkdir və
[[PM-GOV-0001]] G6-nın (hər yumşaq səlahiyyət üçün tripwire) ruhuna ziddir.

## Qərar 5 — TDT-first prinsipi

Faza B-nin **heç bir identifikatoru, rol adı və ya məlumat strukturu "Tamga tək operatordur" fərziyyəsini
ehtiva etmir.** Konkret qaydalar:

1. `lotl` + **hər TDT üzv dövləti üçün milli siyahı slotu** (TR `ACTIVE`; AZ, KZ, KG, UZ
   `RESERVED`; müşahidəçilər HU, TM ayrıca `membership` sahəsi ilə).
2. Hər milli siyahıda slot kimi **tam ARF rol dəsti**: Registrar, TLSO, PID Provider (boş),
   Access CA, National Root CA, Wallet Provider; hər slotda `status` + `operated_by`.
3. Hər siyahıda `operator: { name: "Tamga Network", status: "provisional", on_behalf_of: "<cc>
   national authority (to be designated)" }`.
4. Kök və qeyd adları dövlətə məxsusdur: "TR National Root CA (provisional operator: Tamga)";
   `ca_id`, `issuer_id`, `vct` təhvil zamanı **dəyişmir**, yalnız `operator` sahəsi dəyişir.
5. Tamga Trust Framework TDT üzvlüyü fərz edilərək yazılır: üzvlük, qeydiyyat vahidinin təyini, kökün təhvili,
   mübahisələr, çıxış; Tamga-nın bugünkü rolu sənəddə "təsisçi vəkil" kimi müəyyən edilib; 2/3
   qaydası ([[ADR-0002]]) sənəddə yazılıb, kodda yox.
6. Cross-recognition sahəsi hər siyahıda mövcuddur (beta: TR → TR).

## Qərar 6 — Pilotun ilkin şərtləri və məhdudiyyətlər bildirişi yenidən müəyyən edilir

PM-GTM-0001 v2.0.0: **Ö1'** siyahı öhdəlik testləri keçir, imzalı və hash-zəncirlidir;
**Ö2'** `trust.tamga.network` + `schema.tamga.network` yayımdadır, kök barmaq izi səhifəsi açıqdır;
**Ö5'** məhdudiyyətlər bildirişi **v2** (8 bənd: 5-ci bənd "blockchain yoxdur, qeydlər imzalı və hamıya
açıqdır", 6-cı bənd "lövbər tək operatorun imzasına əsaslanır", 7-ci bənd "[[t:revocation]] ≤ 90 dəq"); **Ö7'** bu ADR-in
qəbulu; **Ö8'** sənədi verən qurumun imza açarı universitetin nəzarətindədir (G1 eynən). GT1–GT7 eynən.
**B10** (ləğvin qüvvəyə minməsi ≤ 90 dəq) və **B11** (T0 INDETERMINATE nisbəti ≤ 0,5%) meyarları əlavə edilir.

## Qərar 7 — Keçid = replay + ekvivalentlik testi

Faza B → Faza 0 keçidi siyahı versiyaları arxivinin kontrakt çağırışlarında **yenidən oynadılmasıdır**
(operatorun daxili qeydi); status tarixçəsindəki `since` vaxtları
`revokedAt`/`validFrom` sahələrinə yazılır ki, `isCredentialAcceptable(issuerId, iat)` beta
dövrünün rəqəmsal sənədləri üçün eyni cavabı versin (D-BC-3). **Qəbul meyarı:** pilot boyu qeydə alınan
hər `(issuer_id, schema_id, iat, list_id, version)` sorğusu üçün `TrustSource(list)` və
`TrustSource(chain)` eyni C1/C2/C3/D5 cavabını verməlidir; ACCEPTED/REJECTED fərqi = keçid
tamamlanmayıb. Verilmiş [[t:credential|rəqəmsal sənədlər]] yenidən verilmir; rəqəmsal cüzdan və sənədi verən qurumun xidməti dəyişmir.

---

# Əsaslandırma

1. **Etibar ekvivalentliyi (F1).** Tək operatorlu zəncir ilə tək operatorun imzaladığı siyahı eyni
   etibar fərziyyəsinə əsaslanır; ikincisi ucuz, standart (ETSI 119 612) və EUDI-nin öz modelidir.
2. **Arxitektura qorunur.** Oxuma interfeysi (`TrustSource` = [[SPEC-BC-0001]] §11.2 oxuma dəsti),
   A–E [[t:verification-pipeline]], [[t:SD-JWT-VC]] profili, [[t:status-list]], sxem reyestri, rəqəmsal cüzdan, protokollar
   hər iki fazada eynidir. Beta bir "hack" deyil, kanonik arxitekturanın tək imzaçılı xüsusi halıdır.
3. **Geri qayıdıla bilmə.** Siyahı → zəncir keçidi replay ilə olur; zəncir → siyahı (ARCH-0004 SEV1-də)
   indeksləyici proyeksiyası ilə geri qayıda bilər. Hər iki istiqamət eyni formatdan istifadə edir.
4. **Dürüstlük.** Faz 0 məhdudiyyətləri bildirişi onsuz da "Tamga həm operator, həm də tənzimləyicidir" deyirdi;
   Faz B bunu daha da açıq yazır və zəncirin nə vaxt dəyər yaratdığını müəyyən edir.
5. **TDT-first** təhvil xərcini sıfıra endirir və "dövlətlərlə işləyən infrastruktur" ideyasını
   məlumat strukturunda sübut edir (rezerv edilmiş slotlar, müvəqqəti operator).

---

# Nəzərdən keçirilmiş alternativlər

## A — Zənciri gözləmək (mövcud plan) — Rədd edildi
Pilot Foundry quraşdırılmasından + kompilyasiyadan + testnet-dən + auditdən asılı qalır (aylar). Təminat baxımından heç bir qazanc yoxdur
(F1). Universitet və investor görüşləri gecikir.

## B — Tək node-lu / dörd node-lu "inkişaf zənciri" ilə pilot — Rədd edildi
Zəncir görüntüsü yaradır, etibar yaratmır; üstəlik zəncirin istismar xərclərini (node-lar, RPC təhlükəsizliyi
O1, indeksləyici) betaya daşıyır. "Blockchain-li pilot" marketinqi yanıltıcı olar (D-GTM-1/5:
"blockchain" deyil, "yoxlanıla bilən qeydiyyat infrastrukturu").

## C — Web2 demo (tamga-demo üslubunda) ilə pilot — Rədd edildi
[[t:trust-list|Etibar siyahısı]], X.509, SD-JWT VC və ləğv siyahısı olmadan hazırlanan demo "eyni arxitektura" deyil;
zəncirə keçiddə hər şey yenidən yazılır; kriptoqrafik iddialar nümayiş etdirilə bilmir. tamga-demo yalnız
ekran/təqdimat istinadıdır (BIP39 seed cüzdanı WL1-i pozur).

## D — 1-ci gündən çoxtərəfli zəncir (ikinci qurumla) — Təxirə salındı
Doğru hədəfdir, lakin ikinci müstəqil operator **bu gün yoxdur**; onu tapmağın yolu pilotu göstərməkdir.
Qərar 4 məhz bu həddi müəyyən edir.

---

# Nəticələr

## Bağlayıcı
1. [[DECISIONS]]: **D-BC-6** (Faz B + zəncirin başlanğıc həddi), **D-GTM-2** (Ö'/bildiriş v2),
   **D-GOV-5** (TDT-first); D-GOV-2 cədvəlinə başlanğıc sətri. Dəyişdirilən qərarlar cədvəlinə:
   PM-GTM Ö1/Ö2 → Ö1'/Ö2'.
2. [[ARCH-0001]] §3: Faz B sətri; Faz 0 tərifi "≥2 müstəqil validator operatoru".
3. PM-GTM-0001 v2.0.0 (Qərar 6).
4. [[SPEC-CRED-0003]], [[SPEC-SCHEMA-0001]], [[SPEC-BC-0001]], [[ARCH-0003]]: Qərar 3 versiya qeydləri.
5. [[SPEC-ID-0002]] §8.1: proyeksiya mənbəyi "kanonik qeyd (zəncir və ya Faz B siyahısı)".
6. Yeni sənəd **SPEC-TRUST-0001** (siyahı formatı) `/new-doc` ilə; **PM-TRUST-0002 / Tamga
   Trust Framework** (WB 5 qat) `/new-doc` ilə.
7. `(bu depo) ` kod bazası bu ADR-ə bağlıdır; `TrustSource` xaricində siyahını şərh edən biznes
   məntiqi yazıla bilməz (BT4).

## Dəyişməyən qərarlar
D-BC-0 (Besu/QBFT), D-GOV-0, D-ID-1, D-CRED-1, D-ASSUR-1, D-SCHEMA-1/2/3 (ADR-0010 ayrıca
nəzərdən keçirir), D-REV-1/2/3, D-TRUST-0, D-AUTH-5, D-STR-1..4, D-GTM-1. Bu ADR yalnız zəncirin **nə
vaxt** qurulacağını və o günə qədər lövbərin **kimin imzası** olduğunu müəyyən edir.

## Qəbul edilən kompromislər
- İkili danışıqdan (equivocation) qoruma zəifləyir (Qərar 3, bildirişin 6-cı bəndi).
- Tamga operator komponenti (`trust-publisher`) tək nasazlıq nöqtəsidir: siyahının müddəti bitənə qədər
  yoxlama keşdən davam edir, sonra INDETERMINATE; runbook + iki nəfərlik giriş məcburidir.
- GV3/GV4 (səsvermə qaydaları) Faz B-də dayandırılıb; idarəetmə kodda deyil, sənəddə yaşayır.

---

# Əlaqələr

**Əlavələr:** [[ARCH-0001]] Faz B · PM-GTM-0001 v2 · D-GOV-2 başlanğıc həddi
**Şərhlər (versiya qeydi):** [[ADR-0007]], [[ADR-0008]], [[SPEC-CRED-0003]], [[SPEC-SCHEMA-0001]], [[SPEC-BC-0001]], [[ARCH-0003]]
**Əsaslanır:** [[ADR-0001]] (dəyişməz), [[ADR-0002]] (suverenlik, cross-recognition), [[PM-ASSUR-0001]] (dövlətsiz bootstrap)
**Yaradır:** SPEC-TRUST-0001, Tamga Trust Framework, `(bu depo) `
**Qardaş sənəd:** [[ADR-0010]] (vct URN + kateqoriya — TDT-first-ün tip identifikatoruna tətbiqi)
**Təhlil mənbəyi:** operatorun daxili qeydi.

---

# Status

**Accepted ✅** — 2026-09-24. [[DECISIONS]]-a D-BC-6, D-GTM-2, D-GOV-5 kimi daxil edildi; təsirlənən SPEC versiya yeniləmələri DECISIONS §10 açıq öhdəliklər siyahısındadır.
