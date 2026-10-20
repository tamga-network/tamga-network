---
document_id: GUIDE-0003
title: "Qurum kimi rəqəmsal sənəd vermək"
status: Active
version: 1.0.0
created: 2026-09-27
last_updated: 2026-10-20
summary: >
  Universitet, dövlət qurumu və ya bilet satıcısı kimi şəxslərin rəqəmsal cüzdanına rəqəmsal sənəd vermək: Tamga-nın yerləşdirdiyi sənəd vermə xidmətini `@tamga-network/issuer/client` ilə çağırmaq (təklif, bilet satışı, ləğv/müvəqqəti dayandırma) və ya öz sənəd vermə xidmətinizi `@tamga-network/issuer` kitabxanası ilə qurmaq. Xarici giriş hər qurum üçün əhatə dairəsi məhdudlaşdırılmış API açarı ilə həyata keçirilir (ADR-0016).
translation_of: GUIDE-0003
source_version: "1.0.0"
---

# Qurum kimi rəqəmsal sənəd vermək

Bu bələdçi şəxslərin rəqəmsal cüzdanına rəqəmsal sənəd vermək istəyən qurumların, yəni [[t:issuer|sənədi verən qurumların]], tərtibatçıları
üçündür: universitet (diplom, tələbə sənədi), dövlət qurumu və ya bilet satıcısı.

**Nə vaxt oxunmalıdır:** qurumunuz Tamga-ya qoşulmaq qərarına gəldikdə, inteqrasiyaya başlamazdan əvvəl. Anlayışlar üçün
[Sənəd vermə](/concepts/issuance); işlək kod üçün [[GUIDE-0004]] §3.

## Necə işləyir?

1. Qurumunuz **[[t:credential-offer|sənəd təklifi]]** yaradır: "bu şəxsə bu sənədi verəcəyik". Təklif keçid və ya QR koddur.
2. Şəxs təklifi cüzdanı ilə açır; cüzdan [[t:credential|sənədi]] [[t:OpenID4VCI]] ilə qurumdan alır.
3. Sənəd qurumunuzun açarı ilə imzalanır və şəxsin cihazındakı açara bağlanır ([[t:holder-binding]]); başqa cihazda
   işə yaramır.
4. Lazım gələrsə, sənədi [[t:revocation|ləğv]] edir və ya müvəqqəti dayandırırsınız; [[t:verifier|yoxlayan tərəflər]] bunu
   [[t:status-list|ləğv siyahısından]] görür.

İki yol var:

| | Yerləşdirilmiş xidmət (tövsiyə olunan başlanğıc) | Öz xidmətiniz |
|---|---|---|
| Kim işlədir | Tamga (`issuer.tamga.network/<kurum>`) | siz |
| Quraşdıracağınız | `@tamga-network/issuer/client` (asılılıqsız, `fetch`) | `@tamga-network/issuer` (+ trust, schemas, sd-jwt) |
| İmza açarı | sizdə: qurumunuzun HSM-i və ya uzaqdan imza xidmətiniz (CSC API v2, [[ADR-0057]]); sandbox-da test açarı | sizin |
| Etibar siyahısında qeydiyyat | Tamga operatoru: qurumun qeydiyyatı, kateqoriya (məs. `EDUCATION`, `EVENTS` — [[ADR-0014]]), sxem səlahiyyətləri | eyni |

## Yerləşdirilmiş xidmət: klient

> **Əvvəlcə sandbox-da sınayın.** Aşağıdakı nümunə test şəbəkəsindəki uydurma bilet satıcısının (`bubilet`,
> `issuer.sandbox.tamga.network`) ünvanından istifadə edir; sandbox-un ünvanları və nümunə qurumları [[GUIDE-0013]]-dədir. Real şəbəkədə
> `baseUrl` `https://issuer.tamga.network`, `slug` isə qurumunuzun qeydiyyatdakı adıdır; API açarını qurum qeydiyyatından sonra Qurum
> Konsolu verir.

```ts
import { createIssuerClient } from "@tamga-network/issuer/client";

const tamga = createIssuerClient({ baseUrl: "https://issuer.sandbox.tamga.network", slug: "bubilet", apiKey: process.env.TAMGA_API_KEY! });

// You sold a ticket → an offer to the wallet (no personal data in the ticket)
const sale = await tamga.sellTicket({ eventId: "EVT-2026-KONSER-01", ticketClass: "STANDARD" });
// sale.offer.deepLink → a QR code or an "open in wallet" link
// sale.offer.txCode   → over a SEPARATE channel (SMS, email, till screen) — NEVER over the same channel as the offer link (S5)

// A credential for a registered person — recommended: an identity-bound offer (no PIN; only the offer's owner can take it, ADR-0020)
const bound = await tamga.createBoundOffer({
  subjectId: "s-1001", // the opaque person identifier in your own system
  vct: "urn:tamga:edu:DiplomaCredential:1",
  bind: { personalAdministrativeNumber: tckn, birthDate: "2002-05-14" }, // Tamga stores only a keyed digest
});
// bound.deepLink → send it to the person over YOUR OWN channel (email, student portal); 7 days, single use

// Fallback: an offer with a PIN for a person without an identity credential
const offer = await tamga.createOffer({ subjectId: "s-1001", vct: "urn:tamga:edu:StudentCredential:1" });

// Revoke / suspend / reinstate — takes effect in the next fixed-interval publication (S6)
await tamga.revoke(credentialId, "mezuniyet iptali");
```

Xətalar `IssuerClientError` (`status` + mesaj) şəklində qaytarılır. Açar **yalnız serverdə** saxlanılır; brauzerə yerləşdirilmir.

Üç təklif növündən hansı?

- **Şəxsiyyətə bağlı təklif (tövsiyə olunan):** şəxs şəxsiyyət sənədini cüzdanda təqdim edir, Tamga onu təklifdəki heşlə uyğunlaşdırır. PIN tələb olunmur.
- **PIN-li təklif:** şəxsiyyət sənədi olmayan şəxs üçün ehtiyat yol. PIN təklif keçidi ilə eyni kanaldan göndərilmir.
- **Bilet:** fərdi məlumat daşımır; şəxsiyyət tələb olunmur.

### API açarı

Tamga operatoru qurumunuz üçün əhatə dairəsi məhdud açar yaradır (`tmg_<slug>_…`; məs. yalnız `tickets:write` + `revocations:write`)
və onu təhlükəsiz kanalla bir dəfə ötürür; serverdə yalnız onun heşi saxlanılır ([[ADR-0016]]).

- Açar 90 gün etibarlıdır. Rotasiya üçün yenisi yaradılır, siz ona keçirsiniz, köhnəsi ləğv edilir (hər ikisi bir müddət birlikdə etibarlı olur).
- Çağırışlar `https://issuer.tamga.network/{slug}/api/v1/…` ünvanına göndərilir; hər açar üçün dəqiqəlik limit var (aşıldıqda `429`).
- Əhatə dairələri: `offers:write`, `tickets:write`, `tickets:read`, `revocations:write`. Pilot qurumlarda əlavə olaraq mTLS tələb oluna bilər.

## Sənəd məlumatları sizin sisteminizdən: sorğu nöqtəsi

[[t:authentic-source|Səlahiyyətli mənbə]] sizin sisteminizdir (məs. tələbə məlumat sistemi). Tamga sənəd məlumatlarını saxlamır; sənəd verildiyi anda sisteminizin
**sorğu nöqtəsinə** imzalı sorğu ilə müraciət edir və cavabı saxlamır ([[ADR-0020]]). Müqavilə: [Qurum sorğu nöqtəsi](/api/institution-source).

- `lookup`: şəxs cüzdandan qurumunuzu seçib şəxsiyyətini təqdim etdikdə — T.C. şəxsiyyət nömrəsi + doğum tarixi ilə axtarış.
- `fetch`: şəxsiyyətə bağlı təklifdə, sənəd verilərkən və nüsxə yenilənərkən — sizin qeyri-şəffaf (opaque) şəxs identifikatorunuzla oxuma.
- Sorğu Tamga-nın [[t:trust-list|etibar siyahısındakı]] qeydində yer alan [[t:access-certificate|giriş sertifikatı ilə]]
  imzalanmış 60 saniyəlik JWT-dir; `aud`, `exp` və `jti` dəyərlərini yoxlayın.
- Hazır başlanğıc: açıq mənbəli nümunə nöqtə ([[GUIDE-0004]] §5) bu yoxlamaların hamısını aparır və yalnız lazımi sahələri qaytarır.
- Hər qeyddə proqramın 4 rəqəmli ISCED-F kodu olmalıdır (yoxdursa sənəd verilmir, təxmini kod yaradılmır — E11); diplom yalnız
  məzun olma məlumatı olan qeydə verilir. Hər ikisi çatışmırsa, təklif açılarkən rədd edilir.
- Sorğu nöqtəsi qoşulduqda Qurum Konsolunda **Sənəd ver** bölməsi açılır: əməkdaş şəxsin istinad nömrəsi ilə qəbul masasında təklif açır
  (şəxsiyyətə bağlı və ya PIN-li). Nöqtəni qoşmazdan əvvəl sənəd verməni sandbox-dakı nümunə qurumlarla sınayın ([[GUIDE-0013]]). Qurum
  Konsolunun **nümunə mənbəyi** yalnız sandbox mühitində açılır; real şəbəkədə bağlıdır və ora real şəxs məlumatları daxil edilmir.

Tamga API-sinin tam təsviri: [Sənəd vermə API-si](/api/issuer).

## Fərdi məlumatlar və şəxsiyyət

- Rəqəmsal sənəd sahələrini yalnız rəqəmsal sənəd üçün istifadə edin; onları loglara, URL-ə, ləğv siyahısına yazmayın.
- Şəxsi öz qeydinizlə uyğunlaşdırmalısınızsa (diplom, tələbə arayışı), [[t:identity-proofing|şəxsiyyətin yoxlanılması]]
  **Tamga şəxsiyyət sənədi** ilə aparılır: rəqəmsal cüzdan şəxsiyyət sənədini təqdim edir, Tamga isə yoxlayan tərəf kimi onu təklifdəki xülasə ilə və ya sorğu endpoint-iniz (`lookup`) ilə uyğunlaşdırır. Şəxsiyyət
  provayderi (Didit) ilə birbaşa əlaqə saxlamırsınız ([[ADR-0011]]).
- Bilet kimi fərdi məlumat tələb etməyən rəqəmsal sənədlərdə şəxsiyyət sənədi istəməyin.

## Paylaşım qaydası: sənəd kimlərə göstərilsin {#sharing-rules}

Sənəd növünü yalnız icazə verdiyiniz yoxlayan tərəflərə göstərilməklə məhdudlaşdıra bilərsiniz (daxili açıqlama siyasəti,
[[ADR-0046]]). Nümunə: diplom yalnız işə qəbul xidmətlərinə; peşə sənədi yalnız səhiyyə müəssisələrinə.

- **Harada saxlanılır:** qayda imzalı sənədi verən qurum məlumatlarınızda (Credential Issuer metadata) sənəd növünün
  `credential_metadata.embedded_disclosure_policy` sahəsində dəyər kimi dərc olunur. Sənədə daxil olmur, yoxlayan tərəfə göndərilmir.
- **Üç seçim:** `none` (məhdudiyyət yoxdur) · `authorized_relying_parties` (yalnız siyahıdakılar) · `specific_roots_of_trust` (yalnız
  siyahıdakı etibar köklərindən sertifikat almış yoxlayan tərəflər). İcazəli yoxlayan tərəf üç yolla göstərilə bilər: qeydiyyat identifikatoru və
  istəyə bağlı xidmət (`relying_parties: [{ "rp_id": "VATTR-…", "service_id": "hiring" }]`), giriş sertifikatının subyekt adı
  (`subject_dns`, RFC 4514) və ya səlahiyyət növü (`entitlements`). Qaydanı sadə dillə izah edən səhifəniz varsa, `info_uri` göstərin;
  cüzdan "Qaydanı oxu" keçidini göstərir.
- **Cüzdan nə edir:** qaydanı sənədi alarkən saxlayır; sənəd təqdim edilərkən onu yoxlayan tərəfin qeydiyyat sertifikatı ilə, internetə
  çıxmadan yoxlayır. Yoxlayan tərəf icazəli deyilsə və ya yoxlama mümkün deyilsə (məs. yaxın məsafədə), şəxsi xəbərdar edir, standart seçim
  "Paylaşma"dır; son qərarı şəxs verir.
- **Qayda dəyişərsə:** əlavə etmək, dəyişdirmək və ya silmək həmin növün bütün etibarlı sənədlərini ləğv edir (EP4) — cüzdanlar
  qaydanı sənədlə birlikdə alır. Şəxslər sənədi yenidən almalıdır; səssiz yeniləmə aktivdirsə, yeni nüsxələr yeni qayda ilə gəlir.
- **Yerləşdirilmiş xidmətdə:** Qurum Konsolu → **Paylaşım qaydaları** (yalnız administrator). Qayda yalnız ləğv edilə bilən qurum
  sənədlərinə (diplom, bilet) tətbiq oluna bilər; şəxsiyyət və əlaqə sənədlərinə tətbiq olunmur. Konsol tətbiq etməzdən əvvəl neçə sənədin ləğv
  ediləcəyini göstərir və təsdiq istəyir.
- **Öz xidmətinizdə:** `issuerMetadata({ authorizedVcts: [{ vct, name, display, disclosurePolicy }] })` qaydanı yoxlayıb
  dərc edir; `disclosurePolicyDigest(policy)` heşini sənəd qeydinə yazın və heş dəyişdikdə sənədləri ləğv edin.

Sınamaq üçün: [[GUIDE-0013]]-dəki nümunə universitetin diplomu yalnız nümunə yoxlayan tərəfin işə qəbul xidməti ilə
(`hiring`) məhdudlaşır; "Məzunlar şəbəkəsi" ssenarisi eyni yoxlayan tərəfin başqa xidmətidir və cüzdan orada xəbərdarlıq edir.

## Ətraflı: öz xidmətiniz

`@tamga-network/issuer` sənəd yaradılmasını, OpenID4VCI server köməkçilərini (təklif, `tx_code`, `c_nonce`,
[[t:proof-of-possession]] yoxlaması), Token Status List dərc edicisini və lövbər (anchor) sorğusunu təmin edir; protokol profili: [[SPEC-PROTO-0001]].
İstinad: Tamga-nın idarə etdiyi sənəd vermə xidməti. Başlamazdan əvvəl Tamga ilə qurum qeydiyyatı, sxem
səlahiyyətləri və açarların idarə edilməsi (KMS/HSM) müzakirə olunur.

## Qaydalar

| Kod | Nə deyir |
|---|---|
| [[SPEC-CRED-0003]] S5 | ləğv siyahısı dəyişiklik olmasa belə sabit intervalla dərc olunur |
| [[SPEC-CRED-0003]] S6 | interval xaricində ("təcili") dərc edilmir; ləğvin təsiri növbəti dərcdə görünür |
| [[SPEC-CRED-0003]] S8 | ləğv siyahısının ünvanı qeyri-şəffafdır; il, ixtisas və ya kohortu kodlaşdırmır |
| DP1 | fərdi məlumatlar və sənəd məzmunu etibar infrastrukturuna yazılmır |
