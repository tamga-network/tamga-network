---
document_id: ARCH-0003
title: "Komponent arxitekturası"
status: Active
version: 1.0.0
created: 2026-09-09
last_updated: 2026-10-16
summary: >
  Zəncirin üzərində işləyən tətbiq komponentlərini təsvir edir. Əsas nəticə: yoxlama üçün oxuma dəsti 3-dən 5-ə qalxdığı üçün indeksləyici artıq opsional optimallaşdırma deyil, MƏCBURİ komponentdir; QBFT-nin ani yekunluğu sayəsində reorg məntiqinə ehtiyac yoxdur və bu, onu köklü şəkildə sadələşdirir. Bundan əlavə, sənədi verən qurumun servisi (OBS adapteri, HSM ilə imzalama, status dərc işi), yoxlayan tərəfin servisi (vahid yoxlama xətti, məcburi əvvəlcədən yükləmə), sxem və statusun paylanması, rəqəmsal cüzdan, komponentlər arası etibar sərhədləri, hansı açarın harada saxlandığının inventarı və DEQRADASİYA MATRİSİ — hansı komponent sıradan çıxdıqda nəyin işləməyə davam etdiyi.
translation_of: ARCH-0003
source_version: "1.0.0"
---

# Əhatə dairəsi

> **Bu gün:** Tamga Network zəncirsiz işləyir; etibar məlumatları imzalı [[t:trust-list|etibar siyahılarından]] və lövbər jurnalından gəlir
> ([[ADR-0009]], [[SPEC-TRUST-0001]]). Bu sənəd zəncir mərhələsinin komponentlərini də təsvir edir; siyahı mərhələsində indeksləyicinin
> yerini `TrustSource` tutur ([[ADR-0015]]), yoxlama xətti ([[SPEC-API-0001]]) isə eynidir.

[[ARCH-0001]] zəncirin **topologiyasını**, [[ARCH-0002]] isə **quraşdırılmasını** təsvir edir.
Bu sənəd zəncirin **üzərində** işləyən tətbiq komponentlərini təsvir edir: nə
edirlər, bir-birinə necə qoşulurlar, hansı açarı saxlayırlar və biri
sıradan çıxdıqda nə baş verir.

Fiziki yerləşmə, avadanlıq və istismar [[ARCH-0004]] sənədində təsvir olunub. SDK paketləri
[[ARCH-0005]] sənədindədir.

---

# 1. Komponent xəritəsi

```
┌──────────────────────────────────────────────────────────────────┐
│                        LEDGER (ARCH-0001)                        │
│   Governance · RootCA · Schema · Issuer · Recognition · Status   │
└───────────────────────────┬──────────────────────────────────────┘
                            │ event stream (read only)
                            ▼
                  ┌──────────────────────┐
                  │       INDEXER        │  ← MANDATORY (§2)
                  │  event → local view  │
                  └──────┬───────────┬───┘
                         │           │
        ┌────────────────┘           └────────────────┐
        ▼                                             ▼
┌───────────────────┐                       ┌────────────────────┐
│  ISSUER SERVICE   │                       │  VERIFIER SERVICE  │
│  (university)     │                       │  (employer)        │
└────┬─────────┬────┘                       └─────────┬──────────┘
     │         │                                      │
     │         │ publish                        fetch │
     ▼         ▼                                      ▼
 ┌───────┐ ┌────────────────┐            ┌────────────────────────┐
 │  SIS  │ │ status.<issuer>│◀───────────│    prefetch cache      │
 │adapter│ │  (CDN)         │            └────────────────────────┘
 └───────┘ └────────────────┘                         ▲
                                                      │
                            ┌─────────────────────────┘
                            │
                  ┌─────────────────────┐
                  │ schemas.tamga.network│  (static + CDN)
                  └─────────────────────┘

        OpenID4VCI ▲                    ▼ OpenID4VP
               ┌────────────────────────────┐
               │ WALLET (e.g. Tamga Wallet) │
               └────────────────────────────┘
```

**İstiqamət qaydası:** Heç bir tətbiq komponenti zəncirə **yazmağa məcbur deyil**
— yeganə istisna sənədi verən qurumun servisindəki status dərc işi (`publishList`) və
operator panelinin milli reyestr əməliyyatlarıdır. Oxuma **həmişə**
indeksləyicidən aparılır, RPC-dən yox.

---

# 2. İndeksləyici — məcburi komponent

## 2.1 Niyə məcburidir

[[SPEC-BC-0001]] §11.2-yə əsasən tək bir [[t:credential|rəqəmsal sənədi]] yoxlamaq **beş zəncir
oxuması** tələb edir:

1. `isCredentialAcceptable(issuerId, iat)` — `isValidIssuer` olduqda, bu, sənəd vermə sualıdır
2. `isCredentialSchemaAcceptable(issuerId, schemaId, iat)`
3. `schemaRegistry.matchesContentHash`
4. `isRecognizedBy`
5. `statusListRegistry.matchesContentHash`

`TrustQueries.verifyAll()` beşini bir çağırışda birləşdirir, amma bu, yenə də bir RPC dövriyyəsi deməkdir.

Bir işəgötürən gündə 500 müraciəti yoxlayırsa, bu, 500 sinxron RPC çağırışı deməkdir və
hər biri yoxlama gecikməsinə birbaşa əlavə olunur. Daha pisi: RPC node-dan
asılılıq yoxlamanı zəncirin əlçatanlığından asılı edir.

**Qərar:** İndeksləyici opsional optimallaşdırma deyil. Uyğun
[[t:verifier]] servisi zənciri **birbaşa sorğulamır.**

## 2.2 QBFT-nin ani yekunluğu — indeksləyicini sadələşdirən amil

Bu, dizaynın ən mühüm rahatlığıdır və asanlıqla diqqətdən qaçır.

QBFT-də blok imzalandığı anda **yekundur** ([[ADR-0001]]). Nakamoto
konsensusundakı kimi ehtimali yekunluq və zəncirin yenidən təşkili
(reorg) **yoxdur.**

Nəticələri:

| Nakamoto zəncirində lazımdır | Tamga-da lazım deyil |
|---|---|
| N təsdiqi gözləmək | Blok gələn kimi tətbiq olunur |
| Reorg aşkarlanması və geri qaytarma | Yoxdur |
| Fork seçimi | Yoxdur |
| "Tərəddüdlü" məlumat üçün müvəqqəti vəziyyət | Yoxdur |

Beləliklə, indeksləyici **sadə, irəliyə yönəlik proyektor** olur: hadisəni al,
yerli cədvəli yenilə, irəli get. Geri qaytarma məntiqi yazılmır.

**Amma:** Kontraktlar yenilənə bilir (UUPS). Yeniləmə hadisə sxemini
dəyişə bilər. İndeksləyici `Upgraded(address)` hadisəsini dinləməli və naməlum
implementasiya gördükdə **dayanıb həyəcan siqnalı verməlidir** — səssizcə səhv
əks etdirməkdənsə dayanmaq yaxşıdır.

## 2.3 Dinlənilən hadisələr

| Kontrakt | Hadisə | Əks etdirilən cədvəl |
|---|---|---|
| Governance | `StateAdmitted`, `StateRemoved`, `StateWithdrawn`, `DelegateKeysSet` | `states`, `delegates` |
| RootCARegistry | `RootCARegistered`, `RootCASuspended`, `RootCARevoked` | `root_cas` |
| IssuerRegistry | `IssuerRegistered`, `IssuerSuspended`, `IssuerRevoked`, `IssuerRenewed` | `issuers` |
| IssuerRegistry | `SchemaAuthorizationSet` | `issuer_schema_auth` |
| SchemaRegistry | `SchemaRegistered`, `SchemaDeprecated`, `SchemaRevoked` | `schemas` |
| CrossRecognition | `RecognitionSet`, `IssuerBlocklisted` | `recognition`, `blocklist` |
| StatusListRegistry | `ListRegistered`, `ListPublished`, `ListRetired` | `status_anchors` |
| (hamısı) | `Upgraded` | `contract_versions` + **həyəcan siqnalı** |

## 2.4 Məlumat modeli (xülasə)

```sql
CREATE TABLE issuers (
  issuer_id        BYTEA PRIMARY KEY,
  state_code       CHAR(2)   NOT NULL,
  category         SMALLINT  NOT NULL,
  assurance        SMALLINT  NOT NULL,
  parent_ca        BYTEA     NOT NULL,
  status           SMALLINT  NOT NULL,
  valid_from       TIMESTAMPTZ NOT NULL,
  valid_until      TIMESTAMPTZ NOT NULL,
  successor_id     BYTEA,
  last_block       BIGINT    NOT NULL
);

CREATE TABLE issuer_schema_auth (
  issuer_id  BYTEA NOT NULL,
  schema_id  BYTEA NOT NULL,
  allowed    BOOLEAN NOT NULL,
  last_block BIGINT NOT NULL,
  PRIMARY KEY (issuer_id, schema_id)
);

CREATE TABLE status_anchors (
  list_id      BYTEA PRIMARY KEY,
  issuer_id    BYTEA NOT NULL,
  list_uri     TEXT  NOT NULL,
  content_hash BYTEA,
  version      BIGINT NOT NULL,
  published_at TIMESTAMPTZ,
  status       SMALLINT NOT NULL,
  last_block   BIGINT NOT NULL
);

-- Single-row progress record
CREATE TABLE sync_state (
  id            SMALLINT PRIMARY KEY DEFAULT 1,
  last_block    BIGINT NOT NULL,
  last_block_at TIMESTAMPTZ NOT NULL,
  healthy       BOOLEAN NOT NULL DEFAULT TRUE,
  halt_reason   TEXT
);
```

**Fərdi məlumatlar yoxdur.** İndeksləyici zəncirin güzgüsüdür; zəncir fərdi məlumat
saxlamır ([[PM-TRUST-0001]]), deməli, güzgü də saxlamır.

## 2.5 Təzəlik və köhnəlmə

İndeksləyici **keşdir**, buna görə də köhnələ bilər.

| Qayda | Dəyər |
|---|---|
| Qəbul edilən gecikmə | ≤ 3 blok |
| Köhnə sayılma həddi | `now - last_block_at > 60 sn` |
| Köhnə olduqda davranış | Yoxlayan tərəf "YOXLANILA BİLMƏDİ" qaytarır, "etibarsız" yox |

Son sətir [[SPEC-CRED-0003]] §7.1 və [[SPEC-SCHEMA-0001]] §7-dəki eyni fərqin
burada tətbiqidir: *"bu diplom saxtadır"* ilə *"hazırda yoxlaya bilmirəm"*
arasındakı fərq bir insanın işə götürülüb-götürülməməsidir.

**Yüksək riskli yoxlamalar** (rəsmi əməliyyat) indeksləyicini keçərək birbaşa
`TrustQueries.verifyAll()` çağıra bilməlidir. Bu, ehtiyat çıxış yoludur, standart
seçim deyil.

---

# 3. Sənədi verən qurumun servisi

## 3.1 Qatlar

```
┌─────────────────────────────────────────────┐
│  Operator panel (web)                       │  institution staff
├─────────────────────────────────────────────┤
│  API layer — OpenID4VCI endpoints           │  wallets
├─────────────────────────────────────────────┤
│  Credential factory                         │  SD-JWT VC production
│    · disclosure generation (SPEC-CRED-0002) │
│    · schema validation (SPEC-SCHEMA-0001)   │
│    · derived claim computation              │
├──────────────┬──────────────┬───────────────┤
│ SIS adapter  │ Signing      │ Status        │
│ (source data)│ (HSM/KMS)    │ publisher     │
│              │              │ (cron, 1 h)   │
└──────────────┴──────────────┴───────────────┘
```

## 3.2 OBS adapteri

Universitetin tələbə məlumat sisteminə qoşulan yeganə nöqtə. Üç rejim:

| Rejim | Nə zaman | Qeyd |
|---|---|---|
| **Toplu CSV** | Pilotun başlanğıcı | Ən aşağı inteqrasiya riski, **tövsiyə olunur** |
| REST sorğusu | OBS API təqdim edirsə | Autentifikasiya (OBS tərəfində yoxlayan tərəf) və sürət limiti tələb olunur |
| Yalnız oxunan DB view | Qurum icazə verərsə | Ən təzə məlumat, lakin ən müdaxiləçi üsul |

**Kritik qayda:** Adapter [[SPEC-SCHEMA-0002]] §6-dakı sahə uyğunlaşdırmasını tətbiq edir
və **uyğunlaşdırmada qarşılığı olmayan proqram üçün sənəd verməyi dayandırır** — təxmini
ISCED-F kodu yaratmır. Səhv kod imzalanmış və qırx il qüvvədə qalan rəqəmsal sənəddə
düzəldilə bilməz.

## 3.3 İmza modulu

- Rəqəmsal sənədin imzalanma açarı **HSM/KMS-dədir**, xaricə çıxmır.
- [[t:status-list]] imzalanma açarı **ayrıdır** ([[SPEC-CRED-0003]] §3.4) —
  hər dərc intervalında imza atdığı üçün onlayn qalmalıdır.
- Hər ikisi eyni X.509 zəncirinə bağlıdır ([[SPEC-ID-0002]]).

## 3.4 Status dərcedici

Sabit intervallı iş ([[SPEC-CRED-0003]] §5.2). Altı addım, ardıcıllıq məcburidir:
gözləyən dəyişiklikləri götür → bitstring-i yenilə → sıxışdır → imzala →
**CDN-ə yaz** → `publishList` (zəncir).

**Dəyişiklik olmasa da işləyir.** Bu, ixtiyari deyil; şərti dərc
zəncirə yazma anının özü vasitəsilə ləğvin vaxtını sızdırır.

## 3.5 Operator paneli

Qurum əməkdaşlarının istifadə etdiyi interfeys. Minimal ekranlar: məzun siyahısı və sənəd
vermə növbəsi, ayrıca sənədin yenidən verilməsi, ləğv/dayandırma əməliyyatları, sxem səlahiyyətinin
görünüşü (yalnız oxunur — səlahiyyəti dövlət verir, [[SPEC-BC-0001]] §3.4), audit
jurnalı.

---

# 4. Yoxlayan tərəfin servisi

## 4.1 Vahid yoxlama xətti

> **Kanonik reyestr [[SPEC-API-0001]] §1-dədir.** Aşağıdakı siyahı xülasə
> görünüşüdür; `A7` və `A8` orada əlavə olunub. Kodların mənaları sabitdir
> ([[SPEC-API-0001]]/AP1).

Dörd spesifikasiyadakı addımlar vahid ardıcıllıqda. İstənilən addımın uğursuzluğu
rəqəmsal sənədin rədd edilməsi deməkdir; **qeyri-müəyyənlik rədd deyil** (§2.5).

```
 A. FORMAT LAYER            → SPEC-CRED-0002 §8
    A1 split on ~, is there a KB-JWT
    A2 alg=ES256, typ=dc+sd-jwt, x5c present
    A3 x5c chain + JWT signature
    A4 _sd_alg = sha-256
    A5 each disclosure: hash FIRST, THEN decode; does it match in _sd
    A6 KB-JWT: signature, aud, nonce, iat, sd_hash

 B. SCHEMA LAYER            → SPEC-SCHEMA-0001 §7
    B1 read vct + vct#integrity
    B2 schemaId = keccak256(vct); registered in the indexer?
    B3 fetch Type Metadata (cache → URL → registry)
    B4 integrity: hash == vct#integrity == ledger contentHash
    B5 extends chain
    B6 JSON Schema conformance

 C. TRUST LAYER             → SPEC-BC-0001 §11.2
    C1 isCredentialAcceptable(issuerId, iat)
    C2 isCredentialSchemaAcceptable(issuerId, schemaId, iat)   ← cannot be skipped
    C3 isRecognizedBy(my state, issuer)

 D. REVOCATION LAYER        → SPEC-CRED-0003 §7
    D1 read status.status_list
    D2 take the Status List Token from the prefetch cache
    D3 token signature + sub match
    D4 freshness (exp / ttl)
    D5 ledger anchor: hash + version
    D6 read idx with bits=2 → anything other than 0x00 is REJECTED

 E. POLICY LAYER            → local
    E1 assurance threshold (e.g. category=EDUCATION && assurance>=I2)
    E2 are the requested claims disclosed
    E3 no RP scope overreach
    E4 audit record
```

## 4.2 Məcburi əvvəlcədən yükləmə

[[SPEC-CRED-0003]] §9.1: yoxlayan tərəf **hər yoxlamada** ləğv siyahısı Token-ini
yükləmir. Planlaşdırılmış toplu əvvəlcədən yükləmədən istifadə edir.

Səbəb: hər yoxlamada `GET <status uri>` edilərsə, universitet mənbə IP ünvanından
məzunlarının hansı işəgötürənlərə müraciət etdiyini öyrənir — kağız diplomda olmayan
yeni izləmə kanalı.

`@tamga-network/verifier` bunu **standart davranışa** çevirir ([[ARCH-0005]]).

## 4.3 Siyasət mühərriki

Yoxlamanın nəticəsi boolean deyil, **qərar obyektidir**:

```json
{
  "outcome": "ACCEPTED | REJECTED | INDETERMINATE",
  "failed_step": "C2",
  "issuer": { "id": "0x…", "category": "EDUCATION", "assurance": "I2" },
  "schema": { "id": "0x…", "version": "1.0.0" },
  "disclosed_claims": ["is_graduate", "eqf_level", "…"],
  "status": { "value": "VALID", "list_version": 8412, "token_age_sec": 1830 },
  "chain_freshness": { "last_block": 918273, "age_sec": 4 },
  "evaluated_at": "2026-09-09T09:12:44Z"
}
```

`INDETERMINATE` `REJECTED`-dən **ayrı** nəticədir və istifadəçi interfeysində
ayrıca göstərilməlidir.

---

# 5. Sxem və statusun paylanması

Hər ikisi eyni modeldədir: **statik fayl + CDN + zəncir lövbəri.**

| | `schemas.tamga.network` | `status.<issuer-domain>` |
|---|---|---|
| Kim idarə edir | Fond (ilk mərhələ) | Hər sənədi verən qurum ayrıca |
| Məzmun | Type Metadata + JSON Schema | İmzalı ləğv siyahısı Token-i |
| Dəyişmə | Yalnız yeni versiya (dəyişməz URL) | Hər dərc intervalında yeni versiya (2 dəqiqə) |
| Keş | `immutable`, müddətsiz | `ttl`/`exp` claim-ləri müəyyənedicidir |
| Tətbiq serveri | Xeyr | Xeyr (dərc işi ayrıdır) |
| Fasilənin təsiri | Yeni tip öyrənilə bilməz | 6 saata qədər keşdən davam (`exp`) |

**Ümumi prinsip:** Hər ikisi yoxlamanın **kritik yolunda deyil** — çünki
bütövlük hash-i sayəsində müddətsiz keşlənə bilirlər. Bu, onların SLO-larını xeyli
ucuzlaşdırır ([[ARCH-0004]]).

---

# 6. Rəqəmsal cüzdan

Şəbəkənin qaydalarına uyğun hər rəqəmsal cüzdan bu qatları daşıyır. Nümunə: Tamga Wallet — şəbəkənin ilk rəqəmsal cüzdanı; bir şirkətin ayrıca məhsuludur
([[ADR-0042]]).

| Qat | Məsuliyyət |
|---|---|
| Açar | Cihazın təhlükəsiz zonası (Secure Enclave / StrongBox), xaricə çıxmır |
| Saxlama | Yerli şifrələnmiş verilənlər bazası — rəqəmsal sənədlər cihazdadır |
| Protokol | OpenID4VCI (alma), OpenID4VP (təqdim etmə) |
| Təsdiq ekranı | İstifadəçi **nəyi paylaşdığını sahə-sahə görür** |
| Sxem keşi | Quraşdırma zamanı və tip əlavə edildikdə **toplu** yüklənir, istifadə anında yox |
| Ehtiyat nüsxə | Serverdə şifrələnmiş; server deşifrə edə bilmir |

**Niyə toplu sxem yükləməsi:** Rəqəmsal cüzdan hər təqdimatda sxemi serverdən yükləsə,
`schemas.tamga.network` "kim hansı tip rəqəmsal sənədi nə vaxt istifadə etdi" məlumatını
toplayar ([[SPEC-SCHEMA-0001]] Təhlükəsizlik qeydləri). Eyni məntiq yoxlayan tərəfin əvvəlcədən
yükləməsi (§4.2) ilə simmetrikdir.

---

# 7. Etibar sərhədləri

```
    ┌ TRUSTED ──────────────────────────────────┐
    │  ledger · indexer · issuer HSM            │
    └───────────────────────────────────────────┘
              ▲                    ▲
    ══════════╪════════════════════╪══════════════  trust boundary
              │                    │
    ┌ SEMI-TRUSTED ────────┐  ┌ UNTRUSTED ───────┐
    │ CDN (schema, status) │  │ wallet client    │
    │ → verified with the  │  │ verifier input   │
    │   integrity hash     │  │ raw SIS data     │
    └──────────────────────┘  └──────────────────┘
```

| Sərhəd | Necə keçilir | Nəzarət |
|---|---|---|
| CDN → yoxlayan tərəf | HTTPS + `vct#integrity` / `contentHash` | Hash uyğun gəlmirsə RƏDD |
| Rəqəmsal cüzdan → yoxlayan tərəf | SD-JWT + KB-JWT | İmza və `sd_hash` |
| OBS → sənədi verən qurum | Qurumdaxili şəbəkə | Sxem yoxlaması + uyğunlaşdırma cədvəli |
| İndeksləyici → yoxlayan tərəf | Yerli/etibarlı şəbəkə | Təzəlik möhürü |

**CDN niyə yalnız yarımetibarlıdır:** Məzmunu dəyişə bilər, lakin bu aşkar
edilir — hash rəqəmsal sənədin imzasının içindədir. Edə biləcəyi yeganə şey
**girişi bloklamaqdır**, bu da saxta qəbul deyil, `INDETERMINATE` yaradır.

---

# 8. Açar inventarı

Hansı komponent hansı açarı saxlayır — [[ARCH-0004]] §4-ün məntiqi qarşılığı.

| Açar | Sahibi | Harada | İstifadə | Rotasiya |
|---|---|---|---|---|
| Validator | Üzv dövlət | Node HSM | Blokların imzalanması | Nadir hallarda, planlı |
| State delegate | Üzv dövlət | Dövlət KMS | Milli reyestrə yazma | İllik |
| Sənədi verən qurum (sənəd imzası) | Sənədi verən qurum | HSM, **oflayn** | Rəqəmsal sənədin imzalanması | Ağır — keçmişə təsir edir |
| Sənədi verən qurum (ləğv siyahısı) | Sənədi verən qurum | KMS, **onlayn** | Hər dərc intervalında (2 dəqiqə) token imzalanması | İllik, ucuz |
| Sənədi verən qurumun delegate-i (EOA) | Sənədi verən qurum | KMS | `publishList` əməliyyatı | İllik |
| Kök sertifikat | Üzv dövlət | Oflayn HSM, mərasim | Alt CA-nın imzalanması | Çox nadir hallarda |
| Rəqəmsal cüzdanın cihaz açarı | İstifadəçi | Secure Enclave | KB-JWT | Cihaz dəyişdirildikdə |
| TLS | Hər xidmət | ACME/avtomatlaşdırma | HTTPS | 90 gün |

**İnvariant K1:** Sənəd imzalama açarı ilə status imzalama açarı
**heç vaxt eyni ola bilməz.** Eyni olsaydı, hər dərc intervalında imza atmaq üçün HSM-dəki
diplom açarını daim onlayn xidmətə açıq saxlamaq lazım gələrdi.

---

# 9. Deqradasiya matrisi

Bu cədvəl dizaynın dayanıqlığının xülasəsidir.

| Sıradan çıxan komponent | Buraxılış | Yoxlama | Nəticə |
|---|---|---|---|
| **RPC node** | ✗ status dərci dayanır | ✓ indeksləyicidən davam edir | Aşağı |
| **İndeksləyici** | ✓ | ⚠ `INDETERMINATE` və ya birbaşa RPC | Orta |
| **Zəncir (bütün validatorlar)** | ✗ | ⚠ keşdən məhdud | **Kritik** |
| **`schemas.tamga.network`** | ✓ (sxem lokalda) | ✓ məlum tiplər; ✗ yeni tip | Aşağı |
| **`status.<issuer>`** | ✓ | ✓ 6 saata qədər (`exp`) | Aşağı |
| **Sənədi verən qurumun xidməti** | ✗ həmin qurum | ✓ verilmiş rəqəmsal sənədlər | Orta (lokal) |
| **Yoxlayan tərəfin xidməti** | ✓ | ✗ həmin yoxlayan tərəf | Aşağı (lokal) |
| **Sənədi verən qurumun HSM-i** | ✗ həmin qurum | ✓ | Orta |
| **Rəqəmsal cüzdan (cihaz itkisi)** | — | ✗ həmin istifadəçi | Bərpa: [[SPEC-CRED-0001]] |

**Çıxarılmalı nəticə:** Yeganə real tək nöqtəli nasazlıq zəncirin özüdür və
o da QBFT sayəsində 1 (4 validator) və ya 2 (7 validator) node nasazlığına davamlıdır.
Digər istənilən komponent sıradan çıxdıqda sistem **qismən xidmət** rejiminə keçir, səssizcə yanlış
cavab vermir.

Bu, [[ADR-0007]] və [[ADR-0008]]-də təsvir olunan "məzmun off-chain, lövbər on-chain"
modelinin qazandırdığı üstünlükdür: məzmunun paylanması kəsildikdə bütövlük zəmanəti
itmir, yalnız aktuallıq azalır.

---

# 10. İnvariantlar

> **Kod fərqi:** `CMP*` bu sənədin **invariantlarıdır**. §4.1-dəki `A1…E4`
> isə yoxlama xəttinin **addım kodlarıdır** və kanonikdir — [[ARCH-0004]] §5.2
> və [[SPEC-API-0001]] `failed_step` sahəsində eynilə istifadə olunur. Bu ikisi
> qarışdırılmamalıdır.

| # | İnvariant |
|---|---|
| **CMP1** | Yoxlayan tərəfin xidməti zəncirə birbaşa sorğu göndərmir; indeksləyicidən oxuyur (§2.1). |
| **CMP2** | İndeksləyici naməlum implementasiya versiyası gördükdə **dayanır və həyəcan siqnalı verir** (§2.2). |
| **CMP3** | İndeksləyici fərdi məlumatları saxlamır (§2.4). |
| **CMP4** | Köhnəlmiş indeksləyici `REJECTED` deyil, `INDETERMINATE` qaytarır (§2.5). |
| **CMP5** | OBS adapteri uyğunlaşdırmada qarşılığı olmayan məlumat üçün rəqəmsal sənəd verilməsini dayandırır; təxmin yaratmır (§3.2). |
| **CMP6** | Status dərci dəyişiklik olmasa belə sabit intervalla işləyir (§3.4). |
| **CMP7** | Yoxlayan tərəf statusu hər yoxlama üçün ayrıca çəkmir; əvvəlcədən yükləmədən istifadə edir (§4.2). |
| **CMP8** | Rəqəmsal cüzdan sxemləri istifadə anında deyil, toplu şəkildə yükləyir (§6). |
| **K1** | Sənəd və status imzalama açarları ayrıdır (§8). |
| **CMP9** | Yoxlama nəticəsi üç dəyərlidir: ACCEPTED / REJECTED / INDETERMINATE. |

---

# Açıq məsələlər

1. ~~İndeksləyicini kim idarə edir~~ — **BAĞLANDI** (2026-09-09, [[PM-GOV-0001]]
   Qərar P3). Hər yoxlayan tərəf öz nüsxəsini işlədir; fond **hostinqli
   indeksləyici təqdim etmir**, yalnız istinad paylanmasını dərc edir. Yoxlama trafiki
   ləğv məlumatlarından daha intensiv olduğu üçün bu, status hostinqindən daha sərt qaydadır.
2. Yüksək riskli yoxlamada indeksləyicini keçmə həddini kim müəyyən edir —
   yoxlayan tərəf, yoxsa sxem (`tamga` bloku)?
3. Rəqəmsal cüzdanın ehtiyat nüsxəsinin server tərəfi hansı komponentə aiddir? Hazırda xəritədə yoxdur;
   [[SPEC-WALLET-0001]]-də müəyyən ediləcək.
4. Operator panelinin milli reyestr əməliyyatları (`registerIssuer`) sənədi verən qurumun
   xidmətində olmalıdır, yoxsa dövlətin ayrıca konsolunda? İkincisi daha
   səliqəlidir, lakin ilk mərhələdə əlavə komponent deməkdir.

---

# Əlaqəli sənədlər

[[ARCH-0001]] · [[ARCH-0002]] · [[ARCH-0004]] · [[ARCH-0005]] ·
[[SPEC-BC-0001]] · [[SPEC-CRED-0001]] · [[SPEC-CRED-0002]] · [[SPEC-CRED-0003]] ·
[[SPEC-SCHEMA-0001]] · [[SPEC-SCHEMA-0002]] · [[SPEC-ID-0002]] ·
[[PM-TRUST-0001]] · [[ADR-0001]] · [[ADR-0007]] · [[ADR-0008]]

---

# Status

**Qüvvədədir** — versiya 1.0.0 (2026-10-02).

