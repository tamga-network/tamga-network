---
document_id: SPEC-TRUST-0001
title: "Etibar siyahıları"
status: Active
version: 1.0.0
created: 2026-09-24
last_updated: 2026-11-12
summary: >
  Bugünkü (zəncirsiz) mərhələnin etibar lövbəri olan imzalı, versiyalı və hash zəncirli etibar siyahılarının (lotl.jws, tl-{cc}.jws) və saatlıq lövbər jurnalının (anchors.jsonl) normativ formatı, dərc tezliyi, açar intizamı, TDT-first slotları, qeydin həyat dövrü və zəncirlə ekvivalentlik qaydaları. Hər sahə bir SPEC-BC-0001 kontrakt qeydinə uyğunlaşdırılır; oxuma yalnız TrustSource interfeysi vasitəsilə aparılır.
translation_of: SPEC-TRUST-0001
source_version: "1.0.0"
---

# Qısaca

Bu sənəd Tamga Network-un [[t:trust-list|etibar siyahılarının]] formatını təsvir edir: hansı qurumun hansı rəqəmsal sənədi verə biləcəyini, hansı
[[t:verifier|yoxlayan tərəfin]] nəyi tələb edə biləcəyini və bunların necə imzalanıb dərc edildiyini. Oxucuları siyahıları oxuyan yoxlayan tərəflər,
rəqəmsal cüzdanlar və siyahını idarə edən operatordur.

**Nə vaxt oxunmalıdır**

- Əvvəlcə [Etibar siyahıları və federasiya](/concepts/trust-lists) konseptual səhifəsini oxuyun.
- Siyahıları kodda oxumaq üçün [[GUIDE-0006]] bələdçisinə keçin.
- Qurum sertifikatlarının strukturu burada deyil: [[SPEC-ID-0002]].

**Sadə izah**

Şəbəkənin etibarı üç faylda saxlanılır. `lotl` ([[t:LOTL]]) siyahıların siyahısıdır və digər siyahılara istinad edir; `tl-tr` kimi milli
siyahılar qurumları, yoxlayan tərəfləri və [[t:wallet-provider|cüzdan provayderlərini]] sadalayır; lövbər jurnalı (`anchors.jsonl`)
[[t:status-list|ləğv siyahılarının]] və sxemlərin dəyişikliklərini
xronoloji ardıcıllıqla qeyd edir. Hər siyahı imzalıdır, hər versiya əvvəlkinə bağlıdır və versiya nömrəsi həmişə artır; köhnə versiya
yenidən təqdim edilə bilməz. Siyahılarda fərdi məlumatlar yoxdur. Digər operatorların siyahıları da əhatə dairəsi məhdudlaşdırılmaqla tanına bilər
([[t:federation]]). Ən azı iki müstəqil operator qoşulduqda eyni məlumatlar reyestrə (zəncirə) köçürülür; rəqəmsal cüzdan və yoxlama bundan
təsirlənmir.

---

# Əhatə dairəsi

Bu spesifikasiya [[ADR-0009]] K2-nin normativ tətbiqidir: zəncir qurulana qədər (≥2 müstəqil validator
operatoru) etibar qeydlərini daşıyan **siyahı** formatını müəyyən edir. Zəncir qurulduqda eyni məlumatlar kontraktlara
replay edilir (§7); rəqəmsal sənədlər, rəqəmsal cüzdan və yoxlama xətti dəyişmir. Kanonik sahə adları [[SPEC-BC-0001]] və
[[ARCH-0003]] §2.4 SQL əksindən götürülüb. Fərdi məlumatlar heç bir siyahıda yoxdur (DP1).

---

# 1. Prinsiplər

1. **Hər sahə bir kontrakt qeydinə uyğunlaşdırılır** (§7); siyahı = zəncirin tək imzaçılı xüsusi halı.
2. **Fərdi məlumatlar yoxdur** — yalnız qurum adı, sertifikat barmaq izi, status, tarix, URI, identifikator törəmələri.
3. **Versiya + hash zənciri** — `version` monoton, `previous_version_hash = sha256(<önceki .jws>)`; silinmə yoxdur; status
   dəyişiklikləri `status_history` sahəsinə əlavə olunur.
4. **İmza** — hər siyahı JWS compact formatındadır (`.jws`; `alg: ES256`, `x5c` operator sertifikatı); `.json` yalnız insan üçündür.
   Yoxlayan tərəf yalnız `.jws` istifadə edir; `x5c[0]` barmaq izini `keys/root-fingerprints.json` (lotl) və ya
   `lotl.national_lists[].signing_keys` (tl) ilə tutuşdurur.
5. **ETSI uyğunlaşdırması** — statuslar Tamga enum-u ilə; ETSI TS 119 612 XML görünüşü (`tl-<cc>.xml`) [[SPEC-ID-0002]] §8.1
   profili ilə, eyni imzalı siyahıdan və eyni versiya ilə yaradılır; status URI-ləri Tamga kökündəndir, ixtisaslı xidmət iddiası
   yoxdur ([[ADR-0066]]).
6. **Tezlik** — `lotl`/`tl-<cc>`: `next_update` ≤ 90 gün, dəyişiklik olmasa belə yenidən imzalanır; dəyişiklik ≤ 24 saat ərzində
   dərc olunur; `anchors.jsonl` saatlıq (heartbeat daxil).
7. **Tip identifikatoru** — `vct` URN ([[ADR-0010]]); `lotl.schemas[]` kataloq girişi `metadata_url + content_hash` verir.
8. **Kateqoriya siqnalı** — qurum `class: PUB | QUALIFIED | EAA` ([[t:EAA]]; [[ADR-0010]] K5).
9. **TDT-first** — `lotl` + hər üzv dövlət üçün milli siyahı slotu, tam ARF rol dəsti, `operator.on_behalf_of`;
   təhvil yalnız `operator` sahəsini dəyişir; `ca_id`/`issuer_id`/`vct` sabitdir (D-GOV-5).

---

# 2. Fayl yerləşimi (`https://trust.tamga.network/`)

```
lotl.jws · lotl.json          list of lists + NETWORK schemas + wallet providers + categories
tl-tr.jws · tl-tr.json        TR national list (root_cas, issuers, relying_parties, national_schemas)
tl-<cc>.jws (RESERVED)        AZ/KZ/KG/UZ (members), HU/TM (observers) — slot
anchors.jsonl                 anchor log (one line = one JWS)
keys/root-fingerprints.json   LOTL signing certificate and national root fingerprints (= tamga.network/trust-anchor);
                              explanation in the note field
keys/<name>.cert.pem          only certificates the list references (operator/root/registrar/wallet-provider/rp; published)
wrprc/index.json · wrprc/…    registration certificates (ETSI TS 119 475 rc-wrp+jwt) and their index (ADR-0026)
status/wrprc/<n>              status list of the registration certificates (statuslist+jwt, 1 bit, registrar key) and
wrprc-status.json             index and revocation record (ADR-0068; only when configured in the registry — today the real network and the sandbox)
zk/<circuit_id>.zst           ZK circuit files listed in `zk_circuits` (ADR-0032); wallets download them and check `zk_circuits[].sha256`
lote/<type>.json · .jws       ETSI TS 119 602 LoTE views (wallet-providers, wrpac-providers, eaa-providers);
                              only when LoTE publication is enabled (lote.enabled)
tl-<cc>.xml · tl-<cc>.sha2    ETSI TS 119 612 XML view (XAdES-B-B, signer keys/tl-xml-signer-1.cert.pem; fingerprint
                              in the LOTL slot's xml_signing_keys) and SHA-256 digest;
                              only with TAMGA_TL119612=1 (ADR-0066; in the sandbox today)
archive/<file>.v<NNNN>.jws    immutable version archive (replay input)
CHANGELOG.md                  public change log
```

---

# 3. `lotl` — siyahıların siyahısı

| Sahə | Tip | Məna / kontrakt qarşılığı |
|---|---|---|
| `list_format_version` | string | Format versiyası; naməlum → yoxlayan tərəf **dayanır** (CMP2) |
| `list_type` | `"lotl"` | |
| `environment` | `"production"` \| `"sandbox"` (istəyə bağlı; yoxdursa `production`) | Siyahının aid olduğu şəbəkə ([[ADR-0038]]). Test şəbəkəsinin siyahısı `sandbox` daşıyır; yükləyici gözlədiyi şəbəkəyə uyğun gəlməyən siyahıda **dayanır** (`ADR-0038/SB2`) |
| `version`, `issued_at`, `next_update`, `previous_version_hash` | | Versiya/hash zənciri (§1.3, §1.6) |
| `operator` | `{name, status: "provisional", on_behalf_of, trust_framework, transparency_report?}` | Təsisçi müvəkkil. `status` dəyərləri `provisional` və `designated`-dır: siyahı mərhələsində yalnız `provisional` dərc olunur (TL1; dərcçi başqa dəyərlə dərc etmir). `designated` siyahının idarə edilməsi dövlətin təyin etdiyi quruma təhvil veriləndə istifadə olunacaq dəyərdir ([[ADR-0009]] K5; zəncirdəki operator qeydi [[ADR-0074]] K3) və həmin dəyərlə dərc ayrıca təhvil qərarı ilə açılır; yükləyici dəyəri bu gündən tanıyır ki, təhvildə siyahını oxuyanların yenilənməsi lazım olmasın. Dəyər yoxlama qərarına daxil olmur ([[ADR-0070]] tətbiq qeydi 2026-11-12). `trust_framework` = [[FW-TF-0001]] URL-i (`https://arf.tamga.network/trust-framework`); `transparency_report` istəyə bağlıdır, dərc səhifəsi açıldıqda əlavə olunur. `name`: real şəbəkədə "Tamga Network" (`ADR-0070/OP1`); `environment: "sandbox"` siyahısında ad "(TEST)" işarəsini daşımalıdır və siyahı "Tamga Network Sandbox (TEST)" adı ilə dərc olunur — əks halda dərc edən dərc etmir (`ADR-0070/OP2`, 2026-11-12) |
| `catalogue` | `{url}` | Type Metadata həll yolu (`schemas.tamga.network/v1/catalogue.json`) |
| `anchor_signing_keys[]` | `{fingerprint_sha256, cert_ref, status}` | Lövbər jurnalının imzaçıları (≥2, rotasiyalı — TL3) |
| `national_lists[]` | `{state_code, status: ACTIVE\|RESERVED, membership, list_url, operator, roles{registrar, tlso, pid_provider, access_ca, national_root_ca}, signing_keys[], xml_signing_keys[]?, recognition{mode, recognizes[]}}` | `Governance` üzv siyahısı + `CrossRecognition`. `signing_keys` yalnız JSON ölkə siyahısının (`tl-<cc>.jws`) imzalayanlarıdır; `xml_signing_keys` yalnız ETSI TS 119 612 XML görünüşünün (`tl-<cc>.xml`, EKU id-tsl-kp-tslSigning) imzalayanlarıdır — slot XML dərc edirsə olur; iki dəst ayrıdır, XML imzalayanı JSON siyahısını yoxlamır ([[ADR-0066]] 0.7.4 tətbiq qeydi) |
| `schemas[]` | `{schema_id, vct, metadata_url, content_hash, content_hashes[], layer: NETWORK, governance, status, registered_at, status_history[]}` | `SchemaRegistry` (NETWORK); `registered_at` **daimidir** (ilk lövbərləmə vaxtı); `content_hashes` = qüvvədə olan versiya xülasələri ([[ADR-0010]] K4; inkişaf mərhələsində yalnız cari xülasə, [[ADR-0029]]), hər biri bir dəfə lövbərlənir |
| `eaa_categories` | `{urn → açıklama}` | Kateqoriya namespace-i ([[ADR-0010]] K5) |
| `wallet_providers[]` | `{provider_id, legal_name, wua_signing_keys[], solutions[{solution_id, min_version, status, security_level}], status}` | WUA etibar lövbərləri (R-7; zəncirdə `NetworkRegistry`, [[ADR-0074]] K3). `status` (qeyd və `solutions[].status`) `Status` dəstindəndir: `ACTIVE \| SUSPENDED \| REVOKED \| RETIRED \| ROLLING_OVER \| RESERVED \| PROVISIONAL \| DEPRECATED`. WUA yoxlamasında yalnız `ACTIVE` qeydin `ACTIVE` açarları istifadə olunur. `RESERVED` qeyd yer ayırır (məs. operatoru öz sertifikatını hələ verməmiş cüzdan provayderi, [[ADR-0042]]): `wua_signing_keys` boş ola bilər və WUA yoxlamasında istifadə olunmur. `security_level` rəqəmsal cüzdanın təminat səviyyəsidir ([[SPEC-WALLET-0001]] §2.2; W1 dəstəklənmir (sandbox siyahısındakı şəbəkənin öz sınaq ssenariləri üçün test açarı istisna olmaqla — [[ADR-0042]] K5)). İstəyə bağlı `identifiers[]` ([[ADR-0024]] formatı, `{scheme, value}`): provayderin rəsmi identifikasiya nömrəsi. Qeydiyyat aləti (`wallet-provider activate`) imza sertifikatını ETSI TS 119 412-6 §5 profilinə görə yoxlayır: subyekt sahəsində `organizationIdentifier` (2.5.4.97) bu identifikasiya nömrəsindən törədilən semantik identifikatorla (`VATTR-<VKN>` …) eyni olmalı və qcStatements QcType `id-etsi-qct-wal` (0.4.0.194126.1.2) daşımalıdır; identifikasiya nömrəsi olmayan qeyd aktivləşmir (istisna: sandbox-dakı "(TEST)" sertifikatları) |
| `zk_circuits[]` | `{circuit_id, system, version, attributes, sha256, status}` | Qəbul edilən ZK dövrələri ([[ADR-0032]] ZK2; zəncirdə `NetworkRegistry`, `note` yazılmır) |
| `pid_providers[]` | boş, rezerv edilib | BT8 → TL8 |

---

# 4. `tl-<cc>` — milli siyahı

| Sahə | Məna / kontrakt qarşılığı |
|---|---|
| `state_code`, `version`, `issued_at`, `next_update`, `previous_version_hash`, `operator`, `environment` | Namespace = dövlət; imza yalnız həmin namespace-in açarı ilə (N1-in siyahı mərhələsində oxunuşu); `environment` LOTL-dakı ilə eyni qaydaya əsasən yoxlanılır |
| `root_cas[]` `{ca_id, legal_name, cert_fingerprint_sha256, cert_pem, service_type, operator, status: ACTIVE\|ROLLING_OVER\|RETIRED\|REVOKED, valid_from/until, successor_ca_id, status_history[]}` | `RootCARegistry` (CA1–CA3); `ca_id = keccak256(cc ‖ SHA-256(rootDER))` |
| `issuers[]` `{issuer_id, slug, legal_name, category, assurance: I1..I3, class: PUB\|QUALIFIED\|EAA, assurance_basis, parent_ca_id, cert_fingerprint_sha256, issuer_url, status_list_base, status, valid_from/until, successor_id, status_history[], schema_authorizations[{schema_id, vct, allowed, valid_from, valid_until}], delegate_keys[], authentic_source, test_institution?}` | `IssuerRegistry` (I1–I4, R1–R2); `issuer_id = keccak256(cc ‖ SHA-256(leafDER))`; səlahiyyət **zaman pəncərəlidir** (I3). `test_institution: true` yalnız sandbox siyahısında: sandbox-da özü tərəfindən açılmış test qurumu ([[ADR-0041]]; sertifikatı sandbox aralıq sertifikat orqanından verilir, rəqəmsal sənədləri yarpaq + aralıq zəncir daşıyır); real şəbəkə siyahısında olmur. İstəyə bağlı `revocation_policy_uri` ([[ADR-0047]] K2): qurumun şəbəkənin ümumi ləğv siyasətinə əlavə etdiyi şərtlərin səhifəsi (https); ümumi şərtləri daralda bilməz; rəqəmsal cüzdan onu qurum səhifəsində göstərir |
| `relying_parties[]` `{rp_id, client_id, dns_name, legal_name, access_cert_fingerprint_sha256, status, registered_at, scopes[{scope_id, service_id?, purpose, purpose_localized?, vct, claims[], format?, mdoc_namespace?, valid_from, valid_until}], status_history[]}` | `RelyingPartyRegistry`; `client_id` = OpenID4VP client identifier `x509_hash:` (dərcedici giriş sertifikatından hesablayır; [[ADR-0034]]), `dns_name` = daimi qeyd identifikatoru (SAN); `scopes[]` = ARF qeydiyyat sertifikatının ekvivalenti (AP6). **Qeydiyyat məlumatları ([[ADR-0024]], 2026-09-29):** istəyə bağlı `trade_name`, `identifiers[]`, `postal_address`, `info_uri`, `contact` (qurumun **vəzifə ünvanı**: `destek@…`, `info@…` və ya https səhifəsi — şəxs adı daşıyan poçt qutusu deyil; siyahı açıq və daimidir, şəxsi məlumat daşımır), `service_description`, `is_public_sector_body`, `entitlements[]`, `supervisory_authority`, `uses_intermediaries[]` / `served_relying_parties[]`, `scopes[].privacy_policy_uri`; `issuers[]` eyni identifikasiya/əlaqə sahələrini və sinifdən törədilən `entitlements` dəyərini daşıyır. Dərcedici 2026-09-30 və ondan sonra qeydə alınan iştirakçı üçün məcburi sahə çatışmadıqda dərc etmir. **Qeydiyyat sertifikatları ([[ADR-0026]]):** dərcedici hər qüvvədə olan istifadə və hər sənədi verən qurum üçün `wrprc/` altında ETSI TS 119 475 `rc-wrp+jwt` yaradır (kataloq `wrprc/index.json`; qeydiyyat orqanının açarı LOTL `national_lists[].roles.registrar.signing_keys`); `sub` = `identifiers[]` sahəsindən semantik identifikator (`VATTR-`, `NTRTR-`). İstifadənin istəyə bağlı `service_id` sahəsi ([[ADR-0046]], ARF RPRC_17a) qeydiyyat sertifikatına `service_id` kimi daxil olur; yoxdursa `scope_id`. İstəyə bağlı `format` (defolt `dc+sd-jwt` · `mso_mdoc` · `mso_mdoc_zk`) və mdoc formatında məcburi `mdoc_namespace`: qeydiyyat sertifikatının `credentials` elementi istifadənin təqdimat formatında yazılır (SD-JWT VC: `vct_values` + `[sahə]`; mdoc: `doctype_value` + `[ad sahəsi, element]`, element adları CIR 2026/1731 Cədvəl 6) — AB cüzdanı sorğunu format, tip və yol ilə müqayisə edir (ETSI TS 119 475 Əlavə B.2.9, ARF RPRC_21); doğrulayıcı da istifadəni eyni formatla seçir. **Giriş qrupları ([[ADR-0012]] K5, [[ADR-0069]]):** istəyə bağlı `terminal_groups[{group_id, institution_id, label?, allowed_policies[], cert_fingerprints[]?, offline_allowed?, valid_from, valid_until?}]` — `group_id` bütün siyahıda unikal; aktiv qrupda `institution_id` (eyni siyahıdakı sənəd verənin `slug`-ı və ya yoxlayan tərəfin `dns_name`-i) və ən azı bir `allowed_policies` məcburidir; dərcedici yoxlayır (TG1). Yoxlayıcı qrupun qurumunu buradan oxuyur (`TrustSource.terminalGroup`); `cert_fingerprints` sertifikatlı giriş üçündür (hazırlıq). |
| `national_schemas[]` | `SchemaRegistry` (NATIONAL) |

Status lüğəti: `ACTIVE | SUSPENDED | REVOKED | RETIRED` (+ kök: `ROLLING_OVER`). Tarixçə silinmir; yoxlama
`status_history` sahəsinə rəqəmsal sənədin `iat` dəyəri ilə baxır (D-BC-3, [[SPEC-BC-0001]]/I2–I3). `REVOKED` qurumun siyahısını varisi
(`successor_id`) dərc edə bilər (I4). Operator aləti: `trust-publisher status <slug> <STATUS> --reason r`
(`REVOKED --invalidates-from <tarih>`: həmin andan sonra verilmiş rəqəmsal sənədlər etibarsız olur; `valid_from` = qurumun bütün rəqəmsal sənədləri),
yoxlayan tərəf üçün `rp-status <dns_name> <STATUS>`, tək istifadə və ya qapı qrupu üçün `end-use <dns_name> <id>` (bitmə tarixi).
İstifadənin və qapı qrupunun başlanğıcı dəyişmir; bitməsi yalnız açıq dövrün bağlanması istiqamətində dəyişir və yeni bitmə
sətrin başlanğıcından və ya əvvəlki imzalı siyahının dərc anından əvvəl ola bilməz (əvvəlki siyahının "açıq" dediyi dövr geriyə
dönük bağlana bilməz). Dövrün açıq olub-olmadığı da əvvəlki imzalı siyahının dərc anına görə müəyyən edilir.
Nəşriyyatçı bunu yoxlayır: əvvəlki dərc olunmuş versiyadakı sənəd verən, etibar edən tərəf və ya keçid qrupu yeni siyahıda
yoxdursa, dərc dayanır. Yeganə istisna reyestrdə açıq yazılmış, sayları tam uyğun gələn təsdiqlənmiş çıxarma qeydidir
(`removals.json`; yalnız siyahı, tarix, çıxarmadan əvvəlki imzalı versiyanın nömrəsi, saylar və qısa əsas — ad və ya kimlik
daşımır; qeyd yalnız həmin versiyadan sonrakı dərcdə keçir, başqa dərcdə yenidən istifadə edilə bilməz); onda siyahı dərc olunur və açıq dəyişiklik
jurnalına adsız sətir yazılır, əvvəlki siyahı versiyaları arxivdə qalır. Bu yolun sərhədi [[ADR-0081]] ilə məcburidir (RR1–RR4):
yalnız qurumların qoşulmasından əvvəl sınaq məqsədilə daxil edilmiş, heç bir real şəxsə rəqəmsal sənəd verməmiş və heç bir real
təqdimat almamış qeyd çıxarıla bilər; ilk iştirakçı qurum real şəbəkənin siyahısına daxil olanda yol bağlanır və sınaq yalnız
sandbox-da aparılır. İndiyədək bir dəfə istifadə olunub (2026-11-11): pilotdan əvvəlki sınaq dövründən qalan, artıq `REVOKED`
olan sınaq qeydləri real şəbəkənin siyahısından çıxarıldı. Real qurumun qeydi üçün bu yol istifadə edilmir.
Qeyd siyahıdan çıxarılmır (TL2); geri çəkilən qurum ETSI XML görünüşündə öz Tamga status URI-si ilə (`…/tl/Svcstatus/revoked`
və s., [[SPEC-ID-0002]] §8.1) qalır və LoTE-yə daxil edilmir.

---

# 5. `anchors.jsonl` — lövbər jurnalı

> **Tətbiq edildi (2026-11-04), [[ADR-0074]] K4:** qeydiyyat sertifikatı status siyahısı və siyahı görünüşləri üçün iki yeni sətir növü (`registration_status`, `list_view`). Yükləyici bu növləri tanıyır; naməlum növ yenə də yükləyicini DAYANDIRIR. Buna görə dərc edən bu sətirləri yalnız zəncir proyeksiyası açıq olduqda (`TAMGA_CHAIN_ENABLED=1`; istehsalda bağlıdır) yazır. **Zəncirin açılma şərti (2026-11-05):** bu növləri tanıyan ən aşağı yükləyici versiyası `@tamga-network/trust` **0.8.1**-dir; yeni sətir növləri yalnız siyahını oxuyan istehlakçılar (yoxlayan tərəflər, rəqəmsal cüzdanlar, sənədi verən qurumların xidmətləri) ən azı bu versiyaya keçdikdən sonra yazılır — bayraq bundan əvvəl açılmır. `status_list` sətrində `bits`/`size` birlikdə gəlir, `size × bits` 8-in misli olur və `size` ≤ 2^32 − 1-dir (zəncirdəki `uint32`); `list_view` üçün monotonluq açarı (`file`, `source_file`) cütüdür; nəzarət nöqtəsindəki `list_views[]` sətirlə eyni format qaydasına tabedir.

Hər sətir müstəqil JWS-dir; payload `{seq, previous_hash, ts, kind, …}`:

| `kind` | Sahələr | Kontrakt qarşılığı |
|---|---|---|
| `status_list` | `list_id, issuer_id, list_uri, content_hash, list_version, published_at`, istəyə bağlı `bits, size` | `StatusListRegistry.publishList` (S1/S4-ün siyahı mərhələsində oxunuşu, L1); ilk sətir `registerList(…, size, bits)` |
| `schema` | `schema_id, vct, content_hash` | `SchemaRegistry` contentHash (D8: CDN-də dərcdən **sonra**) |
| `heartbeat` | — | Saatlıq tezlik (S5 məntiqi operator tərəfində) |
| `checkpoint` | `archive: { file, sha256, seq_from, seq_to, lines }`, `state: { status_lists[], schemas[], registration_status[]?, list_views[]? }` | Arxiv nəzarət nöqtəsi (TL12); `state` = arxivə köçürülən sətirlərin yaratdığı son vəziyyət |
| `registration_status` | `list_uri, content_hash, list_version, published_at` | Qeydiyyat sertifikatı status siyahısının ([[ADR-0068]]) hər dərcində; siyahı lövbəri reyestrində `anchorList`, açar `keccak256("tamga:registration-status:<mühit>:<ad>")` (`<ad>` = ünvanın `/status/`-dan sonrakı hissəsi), versiya = `list_version` |
| `list_view` | `file, format, source_file, source_version, content_hash` | Siyahı görünüşünün ([[ADR-0066]]: `tl-<cc>.xml`, `lote/<növ>.jws`) hər yaradılışında; `anchorList`, açar `keccak256("tamga:trust-list-view:<mühit>:<fayl>")`, versiya = mənbə siyahının versiyası |

Qaydalar: saatda ≥1 sətir; `list_version` hər qurum üzrə monotondur (L1/S3); `content_hash` yoxlayan tərəf tərəfindən D5-də Status List
Token hash-i ilə müqayisə edilir; sətir silinmir; jurnal hamıya açıqdır; `list_uri` opakdır (S8). Yeni sətir növlərində (PJ5)
`content_hash` faylın SHA-256-sıdır (`sha256:<hex>`; XML-də `.sha2` ilə eyni); `registration_status`-un `list_version`-u hər
siyahı üzrə, `list_view`-un `source_version`-u hər fayl üzrə yalnız artır (yükləyici geri gedəni rədd edir). Bu sətirlər yoxlama
qərarına daxil olmur; görünüş mənbə ilə ziddiyyət təşkil edərsə, mənbə (JSON siyahı) üstündür. Nəzarət nöqtəsinin `state`-i
bunların son vəziyyətini də daşıyır (köhnə nəzarət nöqtələrində bu sahələr yoxdur).

**`status_list` sətrində bit sayı və ölçü (2026-11-05).** İstəyə bağlı `bits` (Token Status List dəsti: 1, 2, 4, 8) və `size`
(indeks tutumu = açılmış `lst` bayt × 8 / `bits`) tokendən oxunur: dərc edənin `anchor --token <fayl>` əmri tokeni açır, onun
xülasəsinin `content_hash` ilə, `sub`-ının `list_uri` ilə eyni olduğunu yoxlayır və hər iki sahəni sətrə yazır. Zəncirdəki siyahı
qeydi (`StatusListRegistry.registerList`) bu iki dəyəri tələb edir; yenidən icra onları əvvəlcə sətirdən, yoxdursa (köhnə sətirlər)
siyahının ünvanındakı tokendən oxuyur; heç biri yoxdursa real şəbəkəyə yazı rədd edilir. Sahələr yoxlama qərarına daxil olmur;
nəzarət nöqtəsinin `state.status_lists[]`-i də onları daşıyır. Köhnə yükləyicilər naməlum sahəni nəzərə almır (sətir növü dəyişmədi).

**Arxivləşdirmə və nəzarət nöqtəsi (TL12).** Jurnal böyüdükcə yükləmə müddəti sətir sayına uyğun olaraq xətti artır (hər sətir bir
JWS yoxlamasıdır). Jurnal müəyyən həddi keçdikdə (standart olaraq 500 sətir) operator mövcud sətirlərin **hamısını** `archive/anchors-<from>-<to>.jsonl`
faylına köçürür (eyni adla fərqli məzmunlu arxiv artıq mövcuddursa — məs. sandbox sıfırlandıqdan sonra seq yenidən 0-dan başlayıbsa — ada zaman şəkilçisi əlavə olunur: `anchors-<from>-<to>-<epoch_ms>.jsonl`; köhnə arxivin üzərinə yazılmır) və yeni jurnalın ilk sətri kimi imzalı `checkpoint` yazır: `seq = seq_to + 1`,
`previous_hash = sha256(arşivdeki son satır)`, `archive.sha256 = sha256(arşiv dosyası)` və **`state`** — arxivə köçürülən sətirlərin yaratdığı son vəziyyət (hər siyahı üzrə ən yüksək `list_version` dəyərli status lövbəri + sxem lövbərləri). Növbəti lövbər adi qaydada nəzarət
nöqtəsinə bağlanır; zəncir fasiləsizdir, heç bir sətir silinmir (TL2). Yükləyici: ilk sətir `checkpoint` olduqda onun imzasını yoxlayır
(lövbər imza açarı), `seq` dəyərinin `seq_to + 1` olduğunu yoxlayır, **`state` dəyərini anbara tətbiq edir (yoxdursa rədd edir)** və zənciri oradan davam etdirir; `checkpoint` `TrustSource` üçün qeyd
yaratmır. Ortada rast gəlinən `checkpoint` adi sətirdir (tam tarixçə yüklənməsində). Tam tarixçə (TL10 replay,
`trust:verify --full`): nəzarət nöqtələri geriyə doğru izlənir, hər arxivin hash-i yoxlanılır, zəncir seq 0-dan yüklənir. Beləliklə, yükləmə
xərci cari hissə ilə məhdud qalır; arxivlər hamıya açıq qalır.

---

# 6. Yükləyici və `TrustSource` (yoxlayan tərəf)

`@tamga-network/trust` `loadTrustSet` ardıcıllığı: `lotl.jws` imzası (kök barmaq izləri) → `tl-<cc>.jws` imzaları
(`signing_keys`) → format (`list_format_version`) → hash zənciri → `next_update` → `anchors.jsonl` zənciri →
yaddaşdaxili əks ([[ARCH-0003]] §2.4 cədvəlləri). İmza və formatdan sonra `environment` gözlənilən şəbəkə ilə müqayisə edilir (defolt olaraq `production`); test şəbəkəsinə qoşulan rəqəmsal cüzdan və yoxlayan tərəf `sandbox` gözləyir və yalnız test şəbəkəsinin kökünə bərkidilir ([[ADR-0038]]). Sonra `ListTrustSource` [[SPEC-BC-0001]] §11.2 oxuma dəstini təqdim edir:
`isCredentialAcceptable(issuerId, iat)`, `isCredentialSchemaAcceptable(issuerId, schemaId, iat)`, `isRecognizedBy`,
`schemaContentHash`, `statusAnchor`, `relyingParty`, `relyingPartyByDnsName`, `issuer`, `schema`, `isWalletProviderKey`,
`freshness()`.
Üçqiymətli cavab: `YES | NO | UNKNOWN`; `UNKNOWN` → INDETERMINATE (CMP4). Xidmətlər siyahını dövri olaraq yenidən yükləyir
(sənədi verən qurumun xidməti `TAMGA_TRUST_RELOAD_SEC`, yoxlayan tərəf `TAMGA_VERIFY_TRUST_RELOAD_SEC`).

**Eyni `dns_name` birdən çox milli siyahıda ([[ADR-0075]]; 2026-11-05).** `relyingPartyByDnsName` (və keçid qrupu cavabları)
qeydi bu qayda ilə seçir; nəticə siyahıların yüklənmə ardıcıllığından asılı deyil:

1. Ləğv edilməmiş qeyd (`REVOKED` və ya `RETIRED` olmayan; **`SUSPENDED` ləğv edilməmiş sayılır**) yoxdursa: **statusu ən son
   dəyişən qeyd** qaytarılır (qeyri-müəyyən deyil).
2. Ləğv edilməmiş **yeganə** qeyd varsa: yalnız digər bütün qeydlərin son `REVOKED` girişi `reassigned_to` sahəsi ilə bu qeydin
   ölkəsini göstərirsə həmin qeyd götürülür. **Təhvil yalnız `reassigned_to` ilə tanınır**; səbəb mətni (`reason`) oxunmur.
3. Əks halda (ləğv edilməmiş iki qeyd, təhvil qeydi olmayan və ya başqa ölkəni göstərən ləğv) ad **qeyri-müəyyəndir**: `null`,
   keçid qrupları aktiv deyil (qapalı təhlükəsiz). Başqa ölkədə ləğvdən sonra yenidən qeydiyyat (RO2) şəbəkə səviyyəsində qeyd
   gələnə qədər buna görə qeyri-müəyyən qalır.

---

# 7. Kontrakt uyğunlaşdırması və zəncirə keçid

> **Qəbul edildi, tətbiq davam edir (2026-11-04):** [[ADR-0073]] və [[ADR-0074]] yenidən icranı və uyğunlaşdırmanı genişləndirir (miqrasiya rejimi, sərt ləğv, sxem versiya xülasələri, yoxlayan tərəfin identifikatoru, şəbəkə səviyyəli qeydlər); kontrakt tərəfi [[SPEC-BC-0001]] versiya qeydlərindədir, bu bölmə `trust:chain-replay` ilə yenilənir.

| Siyahı sahəsi | Kontrakt çağırışı |
|---|---|
| `root_cas[]` | `RootCARegistry.registerRootCA / rollover / retire / revoke` |
| `issuers[]` | `IssuerRegistry.registerIssuer / suspend / revoke(revokedAt) / setSuccessor` |
| `issuers[].schema_authorizations[]` | `IssuerRegistry.setSchemaAuthorization(issuerId, schemaId, from, until)` |
| `lotl.schemas[]` | `Governance` təklifi → `SchemaRegistry.registerSchema(vct, contentHash, NETWORK)` |
| `relying_parties[]` | `RelyingPartyRegistry.register / setScope`; dayandırma, bərpa və ləğv siyahıdakı anla (`suspendRelyingPartyAt`, `reinstateRelyingPartyAt`, `revokeRelyingPartyAt`). Ölkələr arası təhvil ([[ADR-0075]]): köhnə ölkə siyahısındakı qeyd `REVOKED` olur; tarixçə girişi strukturlaşdırılmış təhvil qeydini `reassigned_to: "<CC>"` və səbəbi (`reassignment to <CC> (approval <təsdiq>)`) daşıyır (`rp-status <dns_name> REVOKED --reassigned-to <CC> --approval <təsdiq>`). Yükləyici yeni ölkədəki qeydi yalnız bu sahə ilə götürür; təhvil qeydi yoxdursa ad qeyri-müəyyəndir (`null`; §6) |
| `anchors kind=status_list` | `StatusListRegistry.registerList(issuerId, uri, size, bits)` (ilk sətir) + `publishList(listId, hash, version, published_at)` |
| `anchors kind=schema` | `SchemaRegistry` contentHash |
| `lotl` / `tl-<cc>` versiyası (bütün fayl) · `anchors.jsonl` son sətri | Siyahı lövbəri qeydi — `anchorList(listKey, version, sha256(jws), previousHash, issuedAt)` · `anchorLogHead(logKey, seq, sha256(satır), ts)`; yalnız xülasə (hash), məzmun yoxdur ([[ADR-0051]]; [[SPEC-BC-0001]] §15). Zəncir proyeksiyadır: ziddiyyət olduqda imzalı siyahı üstündür, zəncirin cavabı yoxlama üçün tələb olunmur. Bayraq `TAMGA_CHAIN_ENABLED`, istehsal mühitində söndürülüb |
| `wallet_providers[]`, `zk_circuits[]`, `external_lists[]`, `eaa_categories`, imzalayanlar, `operator`, `national_lists[]` slotları və rolları, `catalogue` | `NetworkRegistry` şəbəkə səviyyəli qeydləri ([[ADR-0074]] K3; [[SPEC-BC-0001]] §16.5); siyahıdan çıxan qeyd `RETIRED` olur |

Keçid: `archive/` versiyaları ardıcıl olaraq kontrakt çağırışlarına replay edilir; `TrustSource(list)` və `TrustSource(chain)`
`conformance/vectors/trust` sorğularına eyni cavabı verməyənədək keçid tamamlanmış sayılmır (TL10; [[ADR-0009]] K7).
Təhvil: yalnız `operator` sahəsi dəyişir.

---

# 8. İnvariantlar

| # | İnvariant |
|---|---|
| **TL1** | Hər siyahıda `operator.status` var və siyahı mərhələsi boyunca `"provisional"` olaraq qalır; `on_behalf_of` boş buraxılmır. |
| **TL2** | Siyahı və lövbər jurnalı versiyaları monoton artır; hər versiya özündən əvvəlkinin hash-ini daşıyır; heç bir sətir/qeyd silinmir (status dəyişikliyi `status_history`-ə əlavə edilir). Yeganə istisna ilk iştirakçı qurum siyahıya daxil olmazdan əvvəl çıxarılan sınaq qeydləridir ([[ADR-0081]]). |
| **TL3** | Siyahı və lövbər imzası ≥2 növbələşən sertifikatla həyata keçirilir; rotasiya ən azı 30 gün əvvəl elan edilir; yeni açar köhnəsi ilə imzalanır. (Demo kənarlaşması S-6 bəyan edilib.) |
| **TL4** | `TrustSource` istisna olmaqla, heç bir komponent siyahı fayllarını şərh etmir. |
| **TL5** | `next_update` keçmiş və ya əlçatmaz siyahı ilə yoxlama **INDETERMINATE** nəticəsi verir; heç vaxt ACCEPTED, heç vaxt REJECTED. |
| **TL6** | Naməlum `list_format_version` görən yükləyici dayanır və həyəcan siqnalı verir; qəbul etmir. |
| **TL7** | Milli siyahını yalnız həmin namespace-in imza açarı imzalayır; operatorun səlahiyyətləndirilməsi `operator.on_behalf_of` ilə bəyan edilir. |
| **TL8** | Tamga PID vermir; `pid_providers[]` siyahı mərhələsi boyunca boşdur. Tamga-nın müvəqqəti şəxsiyyət attestasiyası ([[ADR-0011]]) bir `issuers[]` qeydidir (`category: IDENTITY`, `class: EAA`, `assurance: I2`; [[ADR-0022]]) və dövlət PID provayderi təyin edildikdə `successor_id` ilə əvəzlənir. |
| **TL9** | Sxem `registered_at` və `status_history.since` daimidir; yenidən kompilyasiya onları dəyişə bilməz (ilk lövbər vaxtı). |
| **TL10** | Zəncirə keçid siyahı arxivinin replay-i və ekvivalentlik testi uğurla keçilmədən tamamlanmış sayılmır. |
| **TL11** | Heç bir siyahı, lövbər jurnalı və ya dəyişiklik jurnalı fərdi məlumatlar, rəqəmsal sənəd və ya rəqəmsal sənəd hash-i ehtiva etmir. |
| **TL12** | Lövbər jurnalı yalnız imzalı `checkpoint` ilə arxivləşdirilir: arxivləşdirilən sətirlər `archive/` altında qalır (silinmir), nəzarət nöqtəsi `previous_hash` ilə arxivin son sətrinə, `archive.sha256` ilə arxiv faylına bağlanır və arxivə keçən sətirlərin yaratdığı **son vəziyyəti (`state`)** daşıyır; yükləyici ilk sətirdəki nəzarət nöqtəsinin imzasını, `seq = seq_to + 1` şərtini və `state`-in mövcudluğunu yoxlamadan zənciri davam etdirmir; arxivləşdirmə heç vaxt bir siyahının və ya sxemin məlumluğunu aradan qaldırmır; tam tarixçə həmişə arxivlərdən yenidən qurula bilər (TL10). |

---

# Təhlükəsizlik və məxfilik qeydləri

- Məlum zəiflik ([[ADR-0009]] K3): lövbər tək operator imzasına əsaslanır; operator və qurum birgə hərəkət etdikdə
  ikili danışıq mümkündür — açıq jurnal, `CHANGELOG`, rüblük şəffaflıq hesabatı (G8) və müstəqil audit
  bunun qarşısını alır. Pilot məhdudiyyətləri bildirişi, bənd 5–6.
- `list_uri` qeyri-şəffafdır; `status_anchors` qurumu/kohortu kodlaşdırmır (S8). IP jurnala yazılmır (G2).

# Açıq məsələlər

1. `wallet_providers[]` zəncir qarşılığı (ADR namizədi).
2. ETSI 119 612 XML/XAdES proyeksiya generatoru — **BAĞLANDI (2026-10-29, [[ADR-0066]]):** generator
   `apps/trust-publisher` daxilindədir və sandbox-da dərcdədir; real şəbəkədə fond, poçt ünvanları və imzaçı ilə açılır.
3. ≥2 növbələşən sertifikat (S-6) və KMS-də imza açarı — pilotdan əvvəl.

# Əlaqəli sənədlər

[[ADR-0009]] · [[ADR-0010]] · [[SPEC-BC-0001]] · [[SPEC-ID-0002]] · [[SPEC-CRED-0003]] · [[SPEC-SCHEMA-0001]] ·
[[ARCH-0003]] · [[FW-ARF-0001]] · [[FW-RB-0001]]

# Status

**Qüvvədədir** — versiya 1.0.0 (2026-10-02).

**Versiya qeydi (2026-11-05):** §5 zəncirin açılma şərti (ən aşağı yükləyici `@tamga-network/trust` 0.8.1; yeni sətir növləri
istehlakçılar yeniləndikdən sonra), `bits`/`size` format qaydası və `list_view` monotonluq açarı; §6 eyni `dns_name`-in birdən
çox milli siyahıda seçim qaydası və oxuma dəstində `relyingPartyByDnsName`; §7 təhvilin strukturlaşdırılmış qeydi
(`reassigned_to`). Davranış `@tamga-network/trust` 0.8.1 ilə; [[ADR-0075]] qərarının məzmunu dəyişmədi.

**Versiya qeydi (2026-11-11; tətbiq qeydləri — qaydaların məzmunu dəyişmədi).** `@tamga-network/trust` və siyahı dərcçisi
0.8.3:

- **§1.4, TL9 — əvvəlki versiya imzalı fayldan.** Dərcçi növbəti versiya nömrəsini, əvvəlki versiyanın xülasəsini və sxemlərin
  daimi `registered_at` / `status_history` dəyərlərini əvvəlki dərcin **imzalı** `.jws` faylından, imzasını mənbədə göstərilən
  siyahı imzaçılarına qarşı yoxlayaraq oxuyur. İmzasız `.json` surəti oxunmur; imzası yoxlanıla bilməyən əvvəlki siyahı ilə
  dərc dayanır.
- **TL1.** Dərcçi siyahı operatorunda (`lotl`, `tl-<cc>` və LOTL ölkə slotları) `status: "provisional"` və dolu `on_behalf_of`
  tələb edir. Yükləyici sxemi `designated` dəyərini tanımağa davam edir; həmin dəyərlə dərc təhvil qərarından sonra açılır.
- **TL2.** Qeydin silinməsi yoxlaması kök CA-nı, sxemi (ölkə siyahısı və LOTL) və siyahıda qalan qeydlərdəki istifadəni, sxem
  səlahiyyətini və `status_history` sətirlərini də sayır; təsdiqlənmiş çıxarma qeydi bunları istəyə bağlı saylarla daşıyır
  (`root_cas`, `schemas`, `scopes`, `schema_authorizations`, `status_history`; yazılmayıbsa 0). İkinci yoxlama (2026-11-12): çıxarma qeydi tək bir versiya keçidinə bağlıdır
  (`previous_version`: çıxarmadan əvvəlki imzalı versiyanın nömrəsi, məcburi; `previous_version_hash`: həmin versiyanın `.jws`
  xülasəsi, istəyə bağlı) və başqa keçiddə keçmir. Tarixçə sətirləri məzmunu ilə qorunur: `status_history` sətri olduğu kimi
  qalmalıdır (məs. `invalidates_from`-u dəyişdirilən sətir silinmiş sayılır); sxem səlahiyyəti sətrində yeganə sərbəst dəyişiklik
  açıq dövrün bağlanmasıdır (`valid_until` yox → tarix). Sayılanlara sənəd verənin `delegate_keys` sətri və LOTL-dakı
  `national_lists`, `wallet_providers`, `external_lists` qeydləri əlavə olundu (eyni adlı istəyə bağlı saylar): ləğv siyahısı
  açarı yenilənəndə köhnə açar siyahıdan atılmır, bitmə tarixi (`valid_to`) ilə qalır. Siyahıda qalan istifadə (`scopes`) və keçid
  qrupu (`terminal_groups`) sətrinin etibarlılıq sahələri də qorunur: `valid_from` dəyişmir; `valid_until` yalnız açıq dövrün
  bağlanması istiqamətində dəyişir (bitməsi olmayan və ya bitməsi hələ çatmamış sətrə daha erkən bitmə). Bağlanmış dövr
  dəyişdirilmir, heç bir bitmə irəli çəkilmir və ya silinmir: yeni dövr yeni identifikatorlu yeni sətirdir. Belə dəyişmiş sətir
  silinmiş sayılır; məqsəd mətni kimi izahedici sahələr redaktə oluna bilər. Versiya birdən çox atladıqda
  yükləyici aradakı xülasələri yoxlaya bilmir; yalnız "atlayan versiya sələfi kimi son görüləni göstərir" ziddiyyətini rədd
  edir (tam yoxlama arxivlə).
- **TL11.** Dərcçi mənbədə hər qeyd növü üçün məlum sahələrin icazə siyahısını tətbiq edir: naməlum və ya hesablanan sahə
  (`client_id`, `rp_id`, `issuer_id`, `ca_id`, barmaq izləri — [[ADR-0034]] CI3) dərci dayandırır, səssizcə atılmır. `contact`
  formatı yoxlanılır (`support_uri` https ünvanı, `email` e-poçt ünvanı, `phone` beynəlxalq formatda); ünvanın bir şəxsə aid
  olub-olmadığı maşınla yoxlanıla bilmir. Status əmrlərinin `--reason` mətni (siyahıya və dəyişiklik jurnalına daxil olur)
  ictimai mətn süzgəcindən keçir: e-poçt, uzun rəqəm ardıcıllığı, keçid və şəxs adına bənzəyən ifadə rədd edilir.
- **§4 — `dns_name` formatı.** Kiçik hərfli etiketlər, nöqtə ilə ayrılmış; sonda nöqtə yoxdur. Eyni siyahıda iki qeyddə
  görünən ad qeyri-müəyyəndir ([[ADR-0075]] tətbiq qeydi).
- **§6 — qovluq yükləyicisində lövbər aktuallığı.** `loadTrustSourceFromDir` lövbər jurnalının aktuallıq həddini verilmədikdə
  **365 gün** götürür (əsas yükləyicidə 2 saat): bu yol saatlıq heartbeat-in işləmədiyi inkişaf və test qovluqları ilə də
  istifadə olunur. Bu standart dəyərlə lövbər jurnalının dayanması aktuallığı pozmur (aktuallıq yalnız siyahıların
  `next_update`-indən gəlir); lövbər jurnalının aktuallığını da şərt etmək istəyən xidmət həddi (`anchorMaxAgeMs`, məs. 2 saat) özü verir.
  İstinad yoxlayıcısı (Tamga Verify, 2026-11-12) dərc ünvanı HTTPS olanda həddi verir: standart dəyər **3 saat**,
  `TAMGA_VERIFY_ANCHOR_MAX_AGE_SEC` ilə tənzimlənir; son lövbər bundan köhnədirsə mənbə köhnəlmiş sayılır və nəticə
  INDETERMINATE olur (REJECTED deyil). Yerli inkişafda (http) ayar verilmədikdə 365 günlük standart dəyər qüvvədədir. Xarici
  siyahılar: [[ADR-0036]] tətbiq qeydi.
- **Qeydiyyat əmrləri.** `registry.lock` altında işləyir (kilid saxlanılarkən yenilənir); siyahı yoxlaması imzalı siyahı
  yazılmadan uğursuz olarsa mənbə faylı əvvəlki vəziyyətinə qayıdır və dəyişiklik jurnalına sətir yazılmır. Müvəqqəti operator
  dəyəri yoxdursa real şəbəkədə dərc dayanır ([[ADR-0070]] tətbiq qeydi).

**Versiya qeydi (2026-11-12; layihə rəhbərliyinin təsdiqi ilə).** TL2-nin sınaq qeydləri istisnası [[ADR-0081]] ilə qərara
bağlandı (§4, TL2 sətri); dərcçinin davranışı dəyişmədi. §3 `operator` sətri `designated` dəyərinin mənasını və bu gün niyə
dərc olunmadığını yazır ([[ADR-0070]] tətbiq qeydi); yükləyicinin və dərcçinin davranışı dəyişmədi.

