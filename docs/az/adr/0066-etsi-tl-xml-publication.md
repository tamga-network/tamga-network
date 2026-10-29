---
document_id: ADR-0066
title: "ETSI TS 119 612 XML siyahı görünüşü"
status: Active
review_status: Completed
version: 1.0.0
created: 2026-10-29
last_updated: 2026-10-29
summary: >
  Tamga-nın ölkə siyahıları bu gün Tamga JSON + JWS və ETSI TS 119 602 (LoTE) JSON görünüşü ilə dərc olunur; ETSI TS 119 612 XML
  (XAdES imzalı etibarlı siyahı) dərci 2026-10-13-də təxirə salınmışdı (ADR-0036 əlavəsi). Komissiyanın üçüncü ölkələr üçün açdığı
  aralıq yol (üçüncü ölkə etibarlı siyahılarının siyahısı, TC AdES LOTL) və AB-nin etibarlı siyahı ekosistemi milli siyahını 119 612
  XML formatında tələb edir; siyahının sahibi dövlətdir, şəbəkə aləti və şablonu təqdim edə bilər. Təklif: hər ölkə slotu üçün eyni
  imzalı mənbədən, eyni ardıcıllıq nömrəsi ilə, XAdES-B-B imzalı 119 612 XML görünüşü yaradılır; yaradılma bayraqla açılır (defolt
  bağlı). Bu gün yalnız Türkiyə slotu aktivdir; əvvəlcə sandbox-da açıldı (§5.7.1-ə uyğun ayrıca XML imza sertifikatı ilə), real
  şəbəkə operator və qurum poçt ünvanları tamamlandıqdan sonra layihə rəhbərliyinin təsdiqi ilə açılır. AB mənasında ixtisaslı və ya
  bildirilmiş olma iddiası daşıyan ETSI URI-ləri istifadə olunmur; URI kökü `https://trust.tamga.network/tl/…`. Qəbul: 2026-10-29
  (layihə rəhbərliyinin təsdiqi).
domain: Trust
related: ["[[ADR-0009]]", "[[ADR-0024]]", "[[ADR-0035]]", "[[ADR-0036]]", "[[ADR-0042]]", "[[SPEC-TRUST-0001]]", "[[SPEC-ID-0002]]", "[[FW-TF-0001]]"]
translation_of: ADR-0066
source_version: "1.0.0"
---

# Qısaca

Avropada etibarlı siyahılar illərdir bir XML formatında (ETSI TS 119 612) dərc olunur; AB-nin imza yoxlama alətləri bu formatı
oxuyur. AB üzvü olmayan ölkənin siyahısının Avropada tanınmasının bugünkü aralıq yolu da bu formatdan keçir. Tamga-nın siyahıları
bu gün bu formatda dərc olunmur. Bu qərar eyni siyahını ikinci formatda da, eyni imzalı mənbədən və eyni ardıcıllıq nömrəsi ilə
dərc etməyi gətirir. Əvvəlcə sınaq şəbəkəsində (sandbox) açıldı; real şəbəkədə açılması poçt ünvanlarının tamamlanmasına bağlıdır.

# Kontekst

- **Bu gün.** Ölkə siyahısı (`tl-<cc>.jws`) və LOTL Tamga JSON + JWS formatındadır ([[SPEC-TRUST-0001]]); pul kisəsi, yoxlayan
  tərəf və sənəd verən üçün ETSI TS 119 602 LoTE JSON görünüşü də var ([[SPEC-ID-0002]] §8.1.1). Tamga 119 612 XML siyahılarını
  **oxuyur** (xarici siyahılar, [[ADR-0036]] K1), lakin öz siyahısını XML kimi **dərc etmir**: [[ADR-0036]] əlavəsi (2026-10-13)
  bunu təxirə salmış, tətikləyici kimi "AB-dən ilk tərəfin istəməsi"ni qoymuşdu.
- **Üçüncü ölkə yolu.** eIDAS md. 14 üçüncü ölkə etibarlı xidmətlərinin tanınmasını sazişə və ya icra aktına bağlayır; prosedur
  hələ müəyyən edilməyib, heç bir ölkə tam tanınma almayıb. Komissiya bunun yerinə aralıq yol açdı: "Pilot for the International
  Compatibility of Trust Services" və üçüncü ölkə etibarlı siyahılarının siyahısı (TC AdES LOTL). Bu siyahıya daxil olan ölkənin
  xidmət təminatçılarının sertifikatları ilə yaradılan imza və möhürlər AB dövlət xidmətlərində təkmil imza kimi yoxlanıla bilər
  (hüquqi ekvivalentlik deyil). Ön şərtlər: ETSI TS 119 612 formatında milli etibarlı siyahı, dörd sütunlu özünüqiymətləndirmə (ETSI
  TR 103 684) və Komissiya ilə pilot. Siyahıya daxil olan ilk ölkə Ukraynadır. Dünya Bankının Qərbi Balkanlar rəqəmsal şəxsiyyət
  hesabatları (2026) namizəd ölkələr üçün eyni aralıq addımı tövsiyə edir.
- **Nə deməkdir, nə demək deyil.** TC AdES LOTL dövlətin nəzarət etdiyi **imza və möhür** sertifikatı təminatçılarını əhatə edir.
  Tamga-nın öz siyahısındakı qurumlar (ixtisaslı olmayan sənəd verənlər, pul kisəsi təminatçıları) bu siyahının mövzusu deyil və
  Tamga dövlət deyil: Tamga-nın XML siyahısı TC AdES LOTL-a **daxil olmur**. Fayda iki tərəflidir: (1) türk dünyası dövləti öz milli
  siyahısını dərc etmək istədikdə şəbəkə hazır, sınaqdan keçmiş alət və şablon təqdim edir ([[ADR-0035]]); (2) ARF-in iki formatı
  da dəstəkləmə gözləntisi (ISSU_10b, OIA_15b) və İcra Aktı (AB) 2026/1731-dəki `etsi_tl` növü üçün Tamga-nın öz siyahısı da XML
  kimi oxuna bilir.
- **Standart.** ETSI TS 119 612 V2.4.1 (2025-08): AB-dən kənar operatorlar siyahı növü, status müəyyənetmə yanaşması, qaydalar və
  xidmət statusu üçün "məqsədə görə müəyyən edilmiş" öz URI-lərini istifadə edə bilər (§5.3.3, §5.3.8, §5.3.9, §5.5.4); imza
  XAdES-B-B, zərflənmiş, Exclusive C14N, KeyInfo-da yalnız imzalayanın sertifikatı (§5.7.1, Əlavə B); `NextUpdate` ən çox 6 ay
  sonra (§5.3.15); tarixçə heç vaxt silinmir (§5.3.12); dərc ünvanının yanında `.sha2` həzm faylı (§6.1).
- **Köhnə cədvəl.** [[SPEC-ID-0002]] §8.1-dəki 119 612 uyğunlaşdırması (sənəd verən → `CA/QC`, `granted`) bugünkü qərarlarla
  uyğun gəlmir: `granted` və `…/QC` AB mənasında ixtisaslı xidmət iddiasıdır; Tamga-nın sənəd verənləri ixtisaslı deyil ([[ADR-0022]]).

# Qərar

## K1 — Eyni imzalı mənbədən, eyni versiya ilə XML görünüşü

- Siyahı dərc edən hər ölkə slotu üçün imzaladığı `tl-<cc>` obyektindən və LOTL-dan TS 119 612 XML görünüşü yaradır: `tl-<cc>.xml`,
  yanında `tl-<cc>.sha2` və arxiv nüsxəsi `archive/tl-<cc>.vNNNN.xml`.
- `TSLSequenceNumber` = Tamga siyahısının `version`-u; `ListIssueDateTime` = `issued_at`; `NextUpdate` = ən gec `next_update`, ən
  çox 6 ay. XML ayrıca siyahı deyil, eyni dərcin ikinci formatıdır.
- Səlahiyyətli mənbə Tamga JSON siyahısıdır (BT4). Ziddiyyət olarsa JSON keçərlidir.

## K2 — URI profili: iddia daşımayan Tamga kökü

- Siyahı növü `https://trust.tamga.network/tl/TSLType/<CC>list`, status müəyyənetmə `…/StatusDetn/<CC>determination`, qaydalar
  `https://arf.tamga.network/trust-framework` + `…/schemerules/<CC>`, xidmət statusu `…/Svcstatus/{active, suspended, revoked,
  retired, rollingover, deprecated}`. URI adları və kökü layihə rəhbərliyi tərəfindən təsdiqləndi
  (2026-10-29); mənaları `docs.tamga.network/az/concepts/etsi-trusted-list` səhifəsində müəyyən edilir və `trust.tamga.network/tl/`
  altındakı hər URI həmin səhifəyə yönləndirilir.
- AB-də "üzv dövlət tərəfindən bildirilmiş" və ya "ixtisaslı" mənası daşıyan ETSI URI-ləri (`EUgeneric`, `EUappropriate`,
  `granted`, `recognisedatnationallevel`, `…/QC`) istifadə olunmur.
- Xidmət növü funksiyanı birbaşa ifadə edən ETSI növü varsa ETSI-nindir (`Svctype/CA/PKC`, `Svctype/EAA`, TS 119 602
  `SvcType/WalletSolution/Issuance`); iddia daşıyacaq və ya qarşılığı olmayan növlər Tamga kökündəndir (`…/Svctype/EAA/Pub-EAA`,
  `…/Svctype/EAA/Q`, `…/Svctype/EAA/StatusList`).
- Dövlət slotu təhvil aldıqda URI çoxluğu slot üzrə dəyişdirilə bilər; qeydlər, identifikatorlar və versiya zənciri dəyişmir.

## K3 — Əhatə: etibarlı xidmət təminatçıları

- Siyahıya daxil olanlar: operatorun milli kök CA-sı; sənəd verənlər (vermə xidməti + status siyahısı imza xidməti); pul kisəsi
  təminatçıları (LOTL-dan, [[ADR-0042]]). Aktiv olmayan qeydlər silinmir, statusu və tarixçəsi ilə qalır.
- Daxil olmayanlar: `RESERVED` / `PROVISIONAL` qeydlər; yoxlayan tərəflər (etibarlı xidmət təminatçısı deyillər, [[ADR-0026]]);
  heç vaxt şəxsi məlumat.

## K4 — İmza: XAdES-B-B və ayrıca XML imza sertifikatı

- İmza TS 119 612 Əlavə B və EN 319 132-1 XAdES-B-B; ECDSA P-256 / SHA-256.
- İmzalayanın sertifikatı §5.7.1 profilinə uyğundur (C/O, keyUsage, basicConstraints CA=false, SKI, EKU `id-tsl-kp-tslSigning`).
  Bugünkü siyahı imzalayanı bu profilə uyğun gəlmədiyi üçün **ayrıca XML imza sertifikatı** (`tl-xml-signer-1`) istifadə olunur:
  şəbəkənin kök CA-sı tərəfindən verilən, yalnız XML siyahısını imzalayan yarpaq sertifikat; JSON siyahılarını `tl-signer-1`
  imzalamağa davam edir. Sandbox-da 2026-10-29-da verildi; real şəbəkədə depodan kənar istehsal PKI-sında, layihə rəhbərliyinin
  təsdiqi ilə verilir. Real şəbəkədə profilə uyğun olmayan imzalayanla XML dərc olunmur.
- XML imzalayanının barmaq izi LOTL-da müvafiq ölkə slotunun imza açarları arasında (`national_lists[].signing_keys`, yeni sahə
  yoxdur) dərc olunur, sertifikatı `keys/`-ə qoyulur.

## K5 — Dərc: defolt bağlı, əvvəlcə sandbox

- `TAMGA_TL119612` bayrağı defolt bağlıdır. Açılış ardıcıllığı: sandbox, müstəqil yoxlama (AB DSS, ETSI XSD), sonra real şəbəkə —
  hər addım layihə rəhbərliyinin təsdiqi ilə. Sandbox 2026-10-29-da açıldı.
- Server `.xml`-i `application/vnd.etsi.tsl+xml`, `.sha2`-ni `text/plain` kimi, ən çox 4 saatlıq keşlə təqdim edir (§6.1, §6.2).
- Real şəbəkədə çatışmayan dərc məlumatı (operatorun poçt ünvanı, qurum və pul kisəsi təminatçısı ünvanları — [[ADR-0024]]) dərci
  dayandırır; sandbox-da xəbərdarlıqdır. Sandbox qeydləri "Sandbox (TEST)" işarəli yer tutucu ünvan daşıyır; real şəbəkədə yer
  tutucu qəbul edilmir.

# Nəzərdən keçirilən variantlar

| Variant | Nəticə | Səbəb |
|---|---|---|
| (a) Hər ölkə slotu üçün eyni imzalı mənbədən paralel XML | **təklif (kod)** | Bir mənbə, bir versiya zənciri |
| (b) Yalnız Türkiyə slotu, indi | **təklif (dərc)** | Bu gün yeganə aktiv slot TR-dir |
| (c) Təxirə salmağa davam etmək | rədd | Üçüncü ölkə yolu və AB alətləri 119 612 tələb edir; iş kiçikdir (yazılıb) |
| ETSI `granted` / `EUgeneric` istifadə etmək | rədd | İxtisaslı və ya AB tərəfindən bildirilmiş olma iddiası |
| Yoxlayan tərəfləri də TSP kimi siyahıya salmaq | rədd | Etibarlı xidmət təminatçısı deyillər |
| Mövcud siyahı imzalayanı ilə imzalamaq | rədd (real şəbəkədə) | §5.7.1 profilinə uyğun deyil |

# Dəyişməzlər

| Kod | Qayda |
|---|---|
| TX1 | TS 119 612 XML yalnız imzalanmış Tamga ölkə siyahısından və LOTL-dan, eyni versiya ilə yaradılır; JSON-da olmayan qeyd XML-də ola bilməz; ziddiyyətdə JSON keçərlidir. |
| TX2 | XML-də AB mənasında bildirilmiş və ya ixtisaslı olma iddiası daşıyan ETSI URI-si istifadə olunmur; siyahı növü, status və qayda URI-ləri slot operatorunun köküdür. |
| TX3 | İmza XAdES-B-B, zərflənmiş, Exclusive C14N; KeyInfo-da yalnız imzalayanın sertifikatı; sertifikat §5.7.1 profilinə uyğundur. Real şəbəkədə uyğun olmayan imzalayanla və ya çatışmayan dərc məlumatı ilə XML dərc olunmur. |
| TX4 | Qeydlər silinmir; `RESERVED` / `PROVISIONAL` qeydlər, yoxlayan tərəflər və şəxsi məlumat XML-ə daxil olmur. |
| TX5 | Yaradılma bayraqla açılır (defolt bağlı); real şəbəkədə layihə rəhbərliyinin təsdiqi ilə, sandbox və müstəqil yoxlamadan sonra. |

# Nəticələr

Hazırlanıb (2026-10-29, defolt bağlı; dərc yoxdur): `apps/trust-publisher/src/tl119612.ts`; `@tamga-network/trust`-da
`canonicalizeXml`, `parseXml` (mənbə 0.7.4, npm-də dərc olunmayıb); `apps/trust-publisher/etsi/19612/` rəsmi XSD-lər; testlər (sxem,
iki müstəqil imza yoxlayıcısı, XAdES xassələri, bayraq, imzalayan profili) və sandbox nümunəsi. Nümunə AB DSS yoxlayıcısında
"XAdES-BASELINE-B, imza və istinadlar bütöv" nəticəsini verdi (imzalayan AB-də etibar lövbəri olmadığından nəticə INDETERMINATE —
gözlənilən).

Qəbulla (2026-10-29): [[SPEC-ID-0002]] §8.1 cədvəli yenidən yazıldı (köhnə `CA/QC` + `granted` uyğunlaşdırması çıxarıldı);
[[SPEC-TRUST-0001]]-ə XML görünüşü; [[ADR-0036]] əlavəsinə qeyd. Sandbox-da açıldı: `tl-xml-signer-1` (sandbox kökü ilə, §5.7.1
profili), "TEST" işarəli yer tutucu ünvanlar, `trust.sandbox.tamga.network/tl-tr.xml` + `.sha2`, URI izah səhifəsi (tr/en/az);
canlı siyahı ETSI XSD-yə və AB DSS yoxlayıcısına qarşı yoxlanıldı. Real şəbəkə üçün qalanlar: istehsal XML imza sertifikatı (depodan
kənar; əmr `ops/README.md`) və LOTL-da barmaq izi; operatorun poçt ünvanı; qurum və pul kisəsi təminatçısı ünvanları; sonra bayraq.

**Açıq məsələlər:** URI adları təsdiqləndi, sertifikat adı (`tl-xml-signer-1`) təsdiq gözləyir; `TSLSequenceNumber`-ın JSON versiyasını izləməsi; dövlət slotu TC AdES LOTL-a
müraciət etdikdə AB LOTL-a göstərici və "MRA" elementi; ETSI TR 103 684 özünüqiymətləndirməsinin qaydalar kitabı ilə uyğunlaşdırılması.

# Status

**Accepted — 2026-10-29** (layihə rəhbərliyinin təsdiqi). DECISIONS: D-TRUST-6. Sandbox-da açıqdır; real şəbəkədə poçt ünvanları və
istehsal XML imza sertifikatı hazır olduqda layihə rəhbərliyinin təsdiqi ilə açılır.
