---
document_id: ADR-0034
title: "HAIP 1.0 uyğunluğu"
status: Active
version: 1.0.0
created: 2026-10-01
last_updated: 2026-10-06
summary: >
  HAIP 1.0-ın iki qaydası tətbiq olunur: yoxlayan tərəf imzalı sorğuda yalnız `x509_hash` müştəri identifikatorundan istifadə edir, rəqəmsal cüzdan isə yalnız onu qəbul edir (§5); WIA-nın `sub` dəyəri eyni cüzdan həllindən istifadə edən bütün instansiyalarda ortaq dəyərdir (§4.4.1). `x509_hash` sertifikat yenilənəndə dəyişdiyi üçün RP qeydinə daimi identifikator kimi `dns_name` əlavə edilir; nüsxələrin ayrılması, psevdonim, keçid kartı və vasitəçi əlaqələri ona bağlanır.
domain: Trust
translation_of: ADR-0034
source_version: "1.0.0"
---

# Xülasə (sadə)

- Yoxlayan tərəflər özlərini domen adı ilə deyil, **sertifikatlarının barmaq izi ilə** (`x509_hash`) təqdim edir; Aİ-nin istinad etdiyi
  HAIP 1.0 profili bunu məcburi edir. Rəqəmsal cüzdan yalnız bu formatı qəbul edir.
- Barmaq izi sertifikat yenilənəndə dəyişir. Buna görə etibar siyahısındakı hər yoxlayan tərəf qeydi əlavə olaraq **daimi domen adı**
  (`dns_name`) daşıyır; psevdonimlər, rəqəmsal sənəd nüsxələri və keçid kartları ona bağlıdır — sertifikat yenilənsə də istifadəçinin
  hesabları və kartları pozulmur.
- Cüzdan attestasiyasının "kim" sahəsi (`sub`) hər telefonda eynidir (cüzdan həllinin adı); telefona məxsus dəyər daşımır.

# Kontekst

43-cü raundda (2026-09-30) [[t:HAIP]] 1.0 bəndləri bir-bir tutuşduruldu; iki fərq açıq qaldı və artıq qəbul edilmiş qərarlara toxunduğu üçün ADR-ə
saxlanıldı:

1. **Müştəri identifikatoru prefiksi.** HAIP 1.0 §5: "For signed requests, the Verifier MUST use, and the Wallet MUST accept the Client
   Identifier Prefix `x509_hash`". [[t:OpenID4VP]] 1.0 §5.9.3: dəyər yarpaq X.509 sertifikatının DER kodlamasının SHA-256 heşinin
   base64url formasıdır; rəqəmsal cüzdan heşin yarpaq sertifikatla uyğun gəldiyini, imzanı və sertifikat zəncirini yoxlayır. Tamga
   [[t:verifier|yoxlayan tərəfi]] bu qərardan əvvəl `x509_san_dns:<alan adı>` istifadə edirdi (SPEC-PROTO-0002 §2; [[t:trust-list]] qeydi və
   [[ADR-0017]] vasitəçi əlaqələri bu sətirlə açarlanmışdı). ETSI TS 119 475 [[t:access-certificate|giriş sertifikatını]] `x509_hash` yarpağı kimi
   müəyyən edir (CIR 2026/1730).
2. **[[t:WIA]] `sub`.** HAIP 1.0 §4.4.1: "The subject claim for the Wallet Attestation MUST be a value that is shared by all Wallet
   instances using the present type of wallet implementation"; bundan əlavə, [[t:PAR|PAR-dakı]] `client_id` bu `sub` dəyəridir. Tamga
   Wallet-ın [[t:wallet-provider|cüzdan provayderi]] (o vaxt bu repozitoriyada `apps/wallet-provider`; [[ADR-0042]] ilə cüzdanın öz
   repozitoriyasına köçürüldü) `sub` kimi hər əməliyyata xas efemer açarın barmaq izini yazırdı
   ([[ADR-0025]] K2). İzlənilməzlik baxımından problem deyildi, amma qaydanın hərfinə uyğun gəlmirdi.

Layihə rəhbərliyi 2026-10-01 tarixində hər iki bənd üzrə Aİ yolunu təsdiqlədi.

# Qərar

## K1 — Yoxlayan tərəfin müştəri identifikatoru `x509_hash`

İmzalı sorğu obyektinin `client_id` dəyəri [[t:x509_hash]]`:` + base64url(SHA-256(giriş sertifikatı DER)) olur. Dəyər **əl ilə verilmir**:
`pemRpSigner(anahtar, sertifika)` onu sertifikatdan hesablayır; Tamga Verify-ın və sənədi verən qurumların təqdimat sorğuları da belədir. Konfiqurasiya
fayllarında `TAMGA_VERIFY_CLIENT_ID` və `TAMGA_ISSUER_RP_CLIENT_ID` yoxdur.

## K2 — Rəqəmsal cüzdan yalnız `x509_hash` qəbul edir

HAIP başqa prefiks tələb etmir; inkişaf mərhələsində geriyə uyğunluq yazılmır ([[ADR-0029]]). Rəqəmsal cüzdan: prefiks `x509_hash` deyilsə və ya
heş yarpaq sertifikatla uyğun gəlmirsə, sorğu rədd edilir. `x509_san_dns` qaydasının təhlükəsizlik tərəfi qorunur: cavab ünvanının
(`response_uri`) domeni sorğunu imzalayan sertifikatın SAN domen adlarından biri olmalıdır (lokal inkişaf ünvanları istisnadır).
`tamga_on_behalf_of` (vasitəçi sorğu, [[ADR-0017]] K7) də `x509_hash` formatındadır.

## K3 — RP qeydində daimi identifikator: `dns_name`

Etibar siyahısının `relying_parties[]` qeydi:

- `client_id`: dərcedici onu giriş sertifikatından hesablayır (`x509_hash:…`); qeyd mənbəyində yazılmır.
- `dns_name` (məcburi): daimi qeyd identifikatoru; giriş sertifikatının SAN-ında olmalıdır (dərcedici yoxlayır, yoxdursa dərc dayanır).
  Qeydiyyat aləti (`register rp`, `scope <dns_name>`), vasitəçi əlaqələri (`uses_intermediaries`, `served_relying_parties`) və
  [[t:registration-certificate]] yaradılması bu sahə ilə işləyir. `TrustSource.relyingPartyByDnsName()`.

## K4 — Sertifikatdan asılı olmamalı olanlar `dns_name` dəyərinə bağlanır

- **Nüsxələrin ayrılması** ([[SPEC-WALLET-0001]] WL5) və **psevdonimin törədilməsi** ([[ADR-0031]] K2): rəqəmsal cüzdan qeydi həll edib sertifikat
  uyğun gələndə `rpKey` dəyərini qeydin `dns_name` dəyərinə çevirir (`stableRpKey`). Yoxlayan tərəf psevdonimi eyni dəyərlə yoxlayır. Qeydiyyatsız
  [[t:RP|RP-də]] `client_id` qalır (psevdonim onsuz da verilmir).
- **Keçid kartı** ([[ADR-0012]] B): kart tokeninin `aud` dəyəri RP-nin `dns_name` dəyəridir (kart günlərlə etibarlıdır, QR ≤ 400 bayt;
  `x509_hash` həm uzundur, həm də yenilənəndə dəyişir).
- **Jurnal:** təqdimat qeydində RP identifikatoru `dns_name`; rəqəmsal cüzdan qeydi domen adı ilə də həll edir.
- **Bilet** (`EventTicket.gate.verifier_client_id`): sahənin adı eyni qalır (inkişaf mərhələsində sxem adı dəyişmir); dəyəri
  yoxlayan tərəfin `dns_name` dəyəridir — bilet uzunömürlüdür.

## K5 — WIA `sub` ortaq dəyərdir

Cüzdan provayderi WIA-da `sub` = cüzdan həllinin identifikatoru (`solution_id`, məs. `tamga-wallet-expo`). İnstansiyaya xas dəyər yoxdur;
instansiyaları fərqləndirən yalnız hər əməliyyatda yeni `cnf` açarı və yeni, əlaqələndirilə bilməyən [[t:status-list]] girişidir ([[ADR-0025]] K2
dəyişmir). PAR-dakı `client_id` və PoP-un `iss` dəyəri bu dəyərdir. Qurumun qeydə aldığı `wallet_sub` şəxsə deyil, həllə işarə edir
(məxfilik baxımından daha az məlumat).

# Dəyişməzlər

| Kod | Qayda |
|---|---|
| CI1 | Yoxlayan tərəf imzalı sorğuda yalnız `x509_hash` müştəri identifikatorundan istifadə edir; dəyər giriş sertifikatından hesablanır, konfiqurasiyadan oxunmur (HAIP 1.0 §5). |
| CI2 | Rəqəmsal cüzdan yalnız `x509_hash` prefiksini qəbul edir; heş yarpaq sertifikatla uyğun gəlmirsə, sorğu rədd edilir. Cavab ünvanının domeni imzalayan sertifikatın SAN-ında olmalıdır (lokal inkişaf istisnadır). |
| CI3 | Etibar siyahısının RP qeydində `client_id` dəyərini dərcedici giriş sertifikatından hesablayır; daimi qeyd identifikatoru `dns_name` dəyəridir və sertifikatın SAN-ında olmalıdır. |
| CI4 | Nüsxələrin ayrılması, psevdonimin törədilməsi, təqdimat jurnalı və vasitəçi əlaqələri `dns_name` dəyərinə bağlanır; `x509_hash` dəyərinə bağlanmır. |
| CI5 | Keçid kartı tokeninin `aud` dəyəri RP-nin `dns_name` dəyəridir. |
| CI6 | WIA `sub` eyni cüzdan həllindən istifadə edən bütün instansiyalarda ortaq dəyərdir; instansiyaya xas identifikator daşımır (HAIP 1.0 §4.4.1). |

# Əsaslandırma / alternativlər

| Variant | Nəticə | Səbəb |
|---|---|---|
| `x509_san_dns` üzərində qalmaq | rədd | HAIP 1.0 §5 yoxlayan tərəfin `x509_hash` istifadə etməsini şərt qoyur; Aİ rəqəmsal cüzdanları yalnız onu qəbul etməyə borcludur. |
| Hər iki prefiksi qəbul etmək | rədd | HAIP ikincisini tələb etmir; iki yol ikiqat təhlükəsizlik yoxlaması deməkdir. İnkişaf mərhələsi (ADR-0029). |
| Psevdonimi / nüsxələri `x509_hash` dəyərinə bağlamaq | rədd | Sertifikat yenilənəndə bütün psevdonimlər (hesablar) və keçid kartları dəyişərdi. |
| Daimi identifikator kimi `rp_id` | rədd | `rp_id` də sertifikatdan törəyir (`keccak256(ülke ‖ SHA-256(sertifika))`). |
| **`dns_name` (SAN-dakı domen adı)** | **qəbul** | Qeyddə artıq var idi (`x509_san_dns` sətri); sertifikatdan asılı deyil; dərcedici SAN ilə uyğunluğunu yoxlaya bilər. |
| WIA `sub` = efemer açarın barmaq izi | rədd | İzlənilməzdir, lakin HAIP-in hərfinə ziddir; Aİ qurumu PAR-da ortaq dəyər gözləyir. |

# Nəticələr / əməliyyat təsiri

- **Sertifikatın yenilənmə ardıcıllığı:** əvvəlcə yeni giriş sertifikatı qeyd mənbəyinə daxil edilir və siyahı yenidən dərc olunur (yeni
  `client_id` siyahıdadır), sonra yoxlayan tərəf yeni sertifikata keçir. Siyahı dərc olunmadan sertifikat dəyişərsə, rəqəmsal cüzdan sorğunu
  "qeydiyyatda deyil / saxta" kimi rədd edir. Psevdonimlər, nüsxələr və keçid kartları təsirlənmir (K4). Qeydiyyat sertifikatları
  (ADR-0026) hər dərcdə yenidən yaradılır.
- **Qeydiyyat aləti:** müraciət `client_id` daşımır, `dns_name` daşıyır; `scope <dns_name>`.
- **Uyğunluq vektorları:** RP qeydində `dns_name`, `client_id` `x509_hash`.
- **ZK eksperiment fiksturu** (`packages/verifier/src/zk/fixtures/session.json`): sessiya transkriptinə daxil olan `client_id` sətri `x509_san_dns`
  formatında qalır (sübut həmin sətirlə yaradılıb; sətrin özü yoxlanılmır).

# Status

**Accepted — 2026-10-01** (layihə rəhbərliyinin təsdiqi). Tətbiq edildi: core (`x509HashClientId`), trust (sxem + `relyingPartyByDnsName`),
trust-publisher, yoxlayan tərəf (imzalayıcı, keçid kartı), wallet-core (sorğunun yoxlanılması, `stableRpKey`, `fetchRpRecord`), rəqəmsal cüzdan,
Tamga Verify, cüzdan provayderi, platformanın sənədi verən qurumu.
