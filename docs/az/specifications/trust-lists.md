---
document_id: SPEC-TRUST-0001
title: "Etibar siyahıları"
status: Active
version: 1.0.0
created: 2026-09-24
last_updated: 2026-10-29
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
wrprc-status.json             index and revocation record (ADR-0068; only when configured in the registry — the sandbox today)
zk/<circuit_id>.zst           ZK circuit files listed in `zk_circuits` (ADR-0032); wallets download them and check `zk_circuits[].sha256`
lote/<type>.json · .jws       ETSI TS 119 602 LoTE views (wallet-providers, wrpac-providers, eaa-providers);
                              only when LoTE publication is enabled (lote.enabled)
tl-<cc>.xml · tl-<cc>.sha2    ETSI TS 119 612 XML view (XAdES-B-B, signer keys/tl-xml-signer-1.cert.pem) and SHA-256 digest;
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
| `operator` | `{name, status: "provisional", on_behalf_of, trust_framework, transparency_report?}` | Təsisçi müvəkkil; `trust_framework` = [[FW-TF-0001]] URL-i (`https://arf.tamga.network/trust-framework`); `transparency_report` istəyə bağlıdır, dərc səhifəsi açıldıqda əlavə olunur |
| `catalogue` | `{url}` | Type Metadata həll yolu (`schemas.tamga.network/v1/catalogue.json`) |
| `anchor_signing_keys[]` | `{fingerprint_sha256, cert_ref, status}` | Lövbər jurnalının imzaçıları (≥2, rotasiyalı — TL3) |
| `national_lists[]` | `{state_code, status: ACTIVE\|RESERVED, membership, list_url, operator, roles{registrar, tlso, pid_provider, access_ca, national_root_ca}, signing_keys[], recognition{mode, recognizes[]}}` | `Governance` üzv siyahısı + `CrossRecognition` |
| `schemas[]` | `{schema_id, vct, metadata_url, content_hash, content_hashes[], layer: NETWORK, governance, status, registered_at, status_history[]}` | `SchemaRegistry` (NETWORK); `registered_at` **daimidir** (ilk lövbərləmə vaxtı); `content_hashes` = qüvvədə olan versiya xülasələri ([[ADR-0010]] K4; inkişaf mərhələsində yalnız cari xülasə, [[ADR-0029]]), hər biri bir dəfə lövbərlənir |
| `eaa_categories` | `{urn → açıklama}` | Kateqoriya namespace-i ([[ADR-0010]] K5) |
| `wallet_providers[]` | `{provider_id, legal_name, wua_signing_keys[], solutions[{solution_id, min_version, status, security_level}], status}` | WUA etibar lövbərləri (R-7; zəncirdə hələ yoxdur — ADR namizədi). `status` (qeyd və `solutions[].status`) `Status` dəstindəndir: `ACTIVE \| SUSPENDED \| REVOKED \| RETIRED \| ROLLING_OVER \| RESERVED \| PROVISIONAL \| DEPRECATED`. WUA yoxlamasında yalnız `ACTIVE` qeydin `ACTIVE` açarları istifadə olunur. `RESERVED` qeyd yer ayırır (məs. operatoru öz sertifikatını hələ verməmiş cüzdan provayderi, [[ADR-0042]]): `wua_signing_keys` boş ola bilər və WUA yoxlamasında istifadə olunmur. `security_level` rəqəmsal cüzdanın təminat səviyyəsidir ([[SPEC-WALLET-0001]] §2.2; W1 dəstəklənmir (sandbox siyahısındakı şəbəkənin öz sınaq ssenariləri üçün test açarı istisna olmaqla — [[ADR-0042]] K5)). İstəyə bağlı `identifiers[]` ([[ADR-0024]] formatı, `{scheme, value}`): provayderin rəsmi identifikasiya nömrəsi. Qeydiyyat aləti (`wallet-provider activate`) imza sertifikatını ETSI TS 119 412-6 §5 profilinə görə yoxlayır: subyekt sahəsində `organizationIdentifier` (2.5.4.97) bu identifikasiya nömrəsindən törədilən semantik identifikatorla (`VATTR-<VKN>` …) eyni olmalı və qcStatements QcType `id-etsi-qct-wal` (0.4.0.194126.1.2) daşımalıdır; identifikasiya nömrəsi olmayan qeyd aktivləşmir (istisna: sandbox-dakı "(TEST)" sertifikatları) |
| `zk_circuits[]` | `{circuit_id, system, version, attributes, sha256, status}` | Qəbul edilən ZK dövrələri ([[ADR-0032]] ZK2; zəncirdə hələ yoxdur) |
| `pid_providers[]` | boş, rezerv edilib | BT8 → TL8 |

---

# 4. `tl-<cc>` — milli siyahı

| Sahə | Məna / kontrakt qarşılığı |
|---|---|
| `state_code`, `version`, `issued_at`, `next_update`, `previous_version_hash`, `operator`, `environment` | Namespace = dövlət; imza yalnız həmin namespace-in açarı ilə (N1-in siyahı mərhələsində oxunuşu); `environment` LOTL-dakı ilə eyni qaydaya əsasən yoxlanılır |
| `root_cas[]` `{ca_id, legal_name, cert_fingerprint_sha256, cert_pem, service_type, operator, status: ACTIVE\|ROLLING_OVER\|RETIRED\|REVOKED, valid_from/until, successor_ca_id, status_history[]}` | `RootCARegistry` (CA1–CA3); `ca_id = keccak256(cc ‖ SHA-256(rootDER))` |
| `issuers[]` `{issuer_id, slug, legal_name, category, assurance: I1..I3, class: PUB\|QUALIFIED\|EAA, assurance_basis, parent_ca_id, cert_fingerprint_sha256, issuer_url, status_list_base, status, valid_from/until, successor_id, status_history[], schema_authorizations[{schema_id, vct, allowed, valid_from, valid_until}], delegate_keys[], authentic_source, test_institution?}` | `IssuerRegistry` (I1–I4, R1–R2); `issuer_id = keccak256(cc ‖ SHA-256(leafDER))`; səlahiyyət **zaman pəncərəlidir** (I3). `test_institution: true` yalnız sandbox siyahısında: sandbox-da özü tərəfindən açılmış test qurumu ([[ADR-0041]]; sertifikatı sandbox aralıq sertifikat orqanından verilir, rəqəmsal sənədləri yarpaq + aralıq zəncir daşıyır); real şəbəkə siyahısında olmur. İstəyə bağlı `revocation_policy_uri` ([[ADR-0047]] K2): qurumun şəbəkənin ümumi ləğv siyasətinə əlavə etdiyi şərtlərin səhifəsi (https); ümumi şərtləri daralda bilməz; rəqəmsal cüzdan onu qurum səhifəsində göstərir |
| `relying_parties[]` `{rp_id, client_id, dns_name, legal_name, access_cert_fingerprint_sha256, status, registered_at, scopes[{scope_id, service_id?, purpose, purpose_localized?, vct, claims[], format?, mdoc_namespace?, valid_from, valid_until}], status_history[]}` | `RelyingPartyRegistry`; `client_id` = OpenID4VP client identifier `x509_hash:` (dərcedici giriş sertifikatından hesablayır; [[ADR-0034]]), `dns_name` = daimi qeyd identifikatoru (SAN); `scopes[]` = ARF qeydiyyat sertifikatının ekvivalenti (AP6). **Qeydiyyat məlumatları ([[ADR-0024]], 2026-09-29):** istəyə bağlı `trade_name`, `identifiers[]`, `postal_address`, `info_uri`, `contact`, `service_description`, `is_public_sector_body`, `entitlements[]`, `supervisory_authority`, `uses_intermediaries[]` / `served_relying_parties[]`, `scopes[].privacy_policy_uri`; `issuers[]` eyni identifikasiya/əlaqə sahələrini və sinifdən törədilən `entitlements` dəyərini daşıyır. Dərcedici 2026-09-30 və ondan sonra qeydə alınan iştirakçı üçün məcburi sahə çatışmadıqda dərc etmir. **Qeydiyyat sertifikatları ([[ADR-0026]]):** dərcedici hər qüvvədə olan istifadə və hər sənədi verən qurum üçün `wrprc/` altında ETSI TS 119 475 `rc-wrp+jwt` yaradır (kataloq `wrprc/index.json`; qeydiyyat orqanının açarı LOTL `national_lists[].roles.registrar.signing_keys`); `sub` = `identifiers[]` sahəsindən semantik identifikator (`VATTR-`, `NTRTR-`). İstifadənin istəyə bağlı `service_id` sahəsi ([[ADR-0046]], ARF RPRC_17a) qeydiyyat sertifikatına `service_id` kimi daxil olur; yoxdursa `scope_id`. İstəyə bağlı `format` (defolt `dc+sd-jwt` · `mso_mdoc` · `mso_mdoc_zk`) və mdoc formatında məcburi `mdoc_namespace`: qeydiyyat sertifikatının `credentials` elementi istifadənin təqdimat formatında yazılır (SD-JWT VC: `vct_values` + `[sahə]`; mdoc: `doctype_value` + `[ad sahəsi, element]`, element adları CIR 2026/1731 Cədvəl 6) — AB cüzdanı sorğunu format, tip və yol ilə müqayisə edir (ETSI TS 119 475 Əlavə B.2.9, ARF RPRC_21); doğrulayıcı da istifadəni eyni formatla seçir. |
| `national_schemas[]` | `SchemaRegistry` (NATIONAL) |

Status lüğəti: `ACTIVE | SUSPENDED | REVOKED | RETIRED` (+ kök: `ROLLING_OVER`). Tarixçə silinmir; yoxlama
`status_history` sahəsinə rəqəmsal sənədin `iat` dəyəri ilə baxır (D-BC-3, [[SPEC-BC-0001]]/I2–I3). `REVOKED` qurumun siyahısını varisi
(`successor_id`) dərc edə bilər (I4). Operator aləti: `trust-publisher status <slug> <STATUS> --reason r`
(`REVOKED --invalidates-from <tarih>`: həmin andan sonra verilmiş rəqəmsal sənədlər etibarsız olur; `valid_from` = qurumun bütün rəqəmsal sənədləri),
yoxlayan tərəf üçün `rp-status <dns_name> <STATUS>`, tək istifadə və ya qapı qrupu üçün `end-use <dns_name> <id>` (bitmə tarixi).
Qeyd siyahıdan çıxarılmır (TL2); geri çəkilən qurum ETSI XML görünüşündə öz Tamga status URI-si ilə (`…/tl/Svcstatus/revoked`
və s., [[SPEC-ID-0002]] §8.1) qalır və LoTE-yə daxil edilmir.

---

# 5. `anchors.jsonl` — lövbər jurnalı

Hər sətir müstəqil JWS-dir; payload `{seq, previous_hash, ts, kind, …}`:

| `kind` | Sahələr | Kontrakt qarşılığı |
|---|---|---|
| `status_list` | `list_id, issuer_id, list_uri, content_hash, list_version, published_at` | `StatusListRegistry.publishList` (S1/S4-ün siyahı mərhələsində oxunuşu, L1) |
| `schema` | `schema_id, vct, content_hash` | `SchemaRegistry` contentHash (D8: CDN-də dərcdən **sonra**) |
| `heartbeat` | — | Saatlıq tezlik (S5 məntiqi operator tərəfində) |
| `checkpoint` | `archive: { file, sha256, seq_from, seq_to, lines }`, `state: { status_lists[], schemas[] }` | Arxiv nəzarət nöqtəsi (TL12); `state` = arxivə köçürülən sətirlərin yaratdığı son vəziyyət |

Qaydalar: saatda ≥1 sətir; `list_version` hər qurum üzrə monotondur (L1/S3); `content_hash` yoxlayan tərəf tərəfindən D5-də Status List
Token hash-i ilə müqayisə edilir; sətir silinmir; jurnal hamıya açıqdır; `list_uri` opakdır (S8).

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
`schemaContentHash`, `statusAnchor`, `relyingParty`, `issuer`, `schema`, `isWalletProviderKey`, `freshness()`.
Üçqiymətli cavab: `YES | NO | UNKNOWN`; `UNKNOWN` → INDETERMINATE (CMP4). Xidmətlər siyahını dövri olaraq yenidən yükləyir
(sənədi verən qurumun xidməti `TAMGA_TRUST_RELOAD_SEC`, yoxlayan tərəf `TAMGA_VERIFY_TRUST_RELOAD_SEC`).

---

# 7. Kontrakt uyğunlaşdırması və zəncirə keçid

| Siyahı sahəsi | Kontrakt çağırışı |
|---|---|
| `root_cas[]` | `RootCARegistry.registerRootCA / rollover / retire / revoke` |
| `issuers[]` | `IssuerRegistry.registerIssuer / suspend / revoke(revokedAt) / setSuccessor` |
| `issuers[].schema_authorizations[]` | `IssuerRegistry.setSchemaAuthorization(issuerId, schemaId, from, until)` |
| `lotl.schemas[]` | `Governance` təklifi → `SchemaRegistry.registerSchema(vct, contentHash, NETWORK)` |
| `relying_parties[]` | `RelyingPartyRegistry.register / setScope` |
| `anchors kind=status_list` | `StatusListRegistry.publishList(listId, uri, hash, version)` |
| `anchors kind=schema` | `SchemaRegistry` contentHash |
| `lotl` / `tl-<cc>` versiyası (bütün fayl) · `anchors.jsonl` son sətri | Siyahı lövbəri qeydi — `anchorList(listKey, version, sha256(jws), previousHash, issuedAt)` · `anchorLogHead(logKey, seq, sha256(satır), ts)`; yalnız xülasə (hash), məzmun yoxdur ([[ADR-0051]]; [[SPEC-BC-0001]] §15). Zəncir proyeksiyadır: ziddiyyət olduqda imzalı siyahı üstündür, zəncirin cavabı yoxlama üçün tələb olunmur. Bayraq `TAMGA_CHAIN_ENABLED`, istehsal mühitində söndürülüb |
| `wallet_providers[]` | zəncirdə hələ yoxdur — ADR namizədi |
| `zk_circuits[]` | zəncirdə hələ yoxdur — ilk mərhələdə `Governance` qeydi (ADR namizədi) |

Keçid: `archive/` versiyaları ardıcıl olaraq kontrakt çağırışlarına replay edilir; `TrustSource(list)` və `TrustSource(chain)`
`conformance/vectors/trust` sorğularına eyni cavabı verməyənədək keçid tamamlanmış sayılmır (TL10; [[ADR-0009]] K7).
Təhvil: yalnız `operator` sahəsi dəyişir.

---

# 8. İnvariantlar

| # | İnvariant |
|---|---|
| **TL1** | Hər siyahıda `operator.status` var və siyahı mərhələsi boyunca `"provisional"` olaraq qalır; `on_behalf_of` boş buraxılmır. |
| **TL2** | Siyahı və lövbər jurnalı versiyaları monoton artır; hər versiya özündən əvvəlkinin hash-ini daşıyır; heç bir sətir/qeyd silinmir (status dəyişikliyi `status_history`-ə əlavə edilir). |
| **TL3** | Siyahı və lövbər imzası ≥2 növbələşən sertifikatla həyata keçirilir; rotasiya ən azı 30 gün əvvəl elan edilir; yeni açar köhnəsi ilə imzalanır. (Demo kənarlaşması S-6 bəyan edilib.) |
| **TL4** | `TrustSource` istisna olmaqla, heç bir komponent siyahı fayllarını şərh etmir. |
| **TL5** | `next_update` keçmiş və ya əlçatmaz siyahı ilə yoxlama **INDETERMINATE** nəticəsi verir; heç vaxt ACCEPTED, heç vaxt REJECTED. |
| **TL6** | Naməlum `list_format_version` görən yükləyici dayanır və həyəcan siqnalı verir; qəbul etmir. |
| **TL7** | Milli siyahını yalnız həmin namespace-in imza açarı imzalayır; operatorun səlahiyyətləndirilməsi `operator.on_behalf_of` ilə bəyan edilir. |
| **TL8** | Tamga PID vermir; `pid_providers[]` siyahı mərhələsi boyunca boşdur. Tamga-nın müvəqqəti şəxsiyyət attestasiyası ([[ADR-0011]]) bir `issuers[]` qeydidir (`category: IDENTITY`, `class: QUALIFIED`) və dövlət PID provayderi təyin edildikdə `successor_id` ilə əvəzlənir. |
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
2. ETSI 119 612 XML/XAdES proyeksiya generatoru (`apps/trust-publisher export-etsi`) — dövlət mərhələsindən əvvəl.
3. ≥2 növbələşən sertifikat (S-6) və KMS-də imza açarı — pilotdan əvvəl.

# Əlaqəli sənədlər

[[ADR-0009]] · [[ADR-0010]] · [[SPEC-BC-0001]] · [[SPEC-ID-0002]] · [[SPEC-CRED-0003]] · [[SPEC-SCHEMA-0001]] ·
[[ARCH-0003]] · [[FW-ARF-0001]] · [[FW-RB-0001]]

# Status

**Qüvvədədir** — versiya 1.0.0 (2026-10-02).

