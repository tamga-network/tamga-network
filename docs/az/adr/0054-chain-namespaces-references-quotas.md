---
document_id: ADR-0054
title: "Zəncirdə sxem ad sahəsi, dövlətlərarası bağlantı və kvota əhatəsi"
status: Active
review_status: Completed
version: 1.0.0
created: 2026-10-19
last_updated: 2026-10-19
summary: >
  Üç kontrakt qaydası qətiləşir. (1) Şəbəkə sxeminin və milli sxemin adları üst-üstə düşə bilməz: milli sxemin `vct` dəyəri ADR-0010-dakı dövlətə xas formatda olmalıdır (`urn:tamga:<cc>:<alan>:<Tür>:<ana sürüm>`, `<cc>` qeydiyyatı aparan dövlətin kiçik hərflə yazılmış kodudur); şəbəkə sxemi bu formatda ola bilməz. Beləliklə, heç bir dövlət səsverməyə qoyulmuş şəbəkə sxeminin adını öz milli sxemi kimi ələ keçirə bilməz. (2) Qurum yalnız öz dövlətinin kök sertifikatına bağlanır və yalnız öz dövlətindən xələf göstərə bilər. (3) Kvotalar: dövlət üzrə gündəlik yazma limiti hər reyestr kontraktında ayrıca hesablanır; status siyahısının dərc limiti hər siyahı üzrədir, qurum üzrə gündəlik yeni siyahı qeydiyyatı isə məhdudlaşdırılır. SPEC-BC-0001 §2–§4, §7 və §12.2 bu qaydalara uyğun yenilənir. Qəbul: 2026-10-19.
domain: Trust
related: ["[[ADR-0002]]", "[[ADR-0007]]", "[[ADR-0008]]", "[[ADR-0010]]", "[[ADR-0051]]", "[[SPEC-BC-0001]]", "[[SPEC-SCHEMA-0001]]", "[[SPEC-CRED-0003]]"]
translation_of: ADR-0054
source_version: "1.0.0"
---

# Qısaca

Zəncir kontraktlarında təhlükəsizlik yoxlamasının açıq qoyduğu üç qayda boşluğu aradan qaldırılır. Şəbəkə və dövlət sxemlərinin adları ayrı ad sahələrində
yerləşir; qurum başqa dövlətin kök sertifikatına və ya qurumuna bağlana bilməz; kvota sayğaclarının nəyi saydığı spesifikasiyada və kodda
eyni olur.

# Kontekst

- **Sxem adının ələ keçirilməsi (F-11).** `schemaId = keccak256(vct)` vahid, ortaq ad sahəsidir ([[ADR-0010]], [[SPEC-SCHEMA-0001]] §5.1).
  Şəbəkə sxemi Governance-da səsə qoyularkən istənilən dövlətin nümayəndəsi eyni `vct` dəyərini öz milli sxemi kimi qeydiyyata ala bilər; şəbəkə
  sxeminin icrası bundan sonra həmişə `SchemaExists` ilə uğursuz olur və adı ələ keçirən dövlət şəbəkə sxeminə bənzəyən qeydin sahibinə çevrilir.
  [[ADR-0010]] bu iki ad sahəsini artıq ayırır: şəbəkə tipi `urn:tamga:<alan>:<Tür>:<ana sürüm>`, dövlətə xas tip
  `urn:tamga:<cc>:<alan>:<Tür>:<ana sürüm>`. Kontrakt bu ayrımı yoxlamırdı.
- **Dövlətlərarası bağlantı (F-12).** Qurum başqa dövlətin kök sertifikatına bağlana bilirdi (həmin dövlətin dayandırılması və ya ləğvi
  qurumun yoxlamadakı ilk addımını idarə edən amilə çevrilir) və başqa dövlətdən olan qurum xələf kimi göstərilə bilirdi (həmin qurumun açarları
  sələfin status siyahılarını dərc edə və istismardan çıxara bilər). Spesifikasiya bu barədə heç nə demirdi.
- **Kvota əhatəsi (F-07-nin qalan hissəsi, F-10).** Spesifikasiyanın §12.2 bəndində "dövlət üzrə gündə 10 000 yazma" və "qurum üzrə gündə 48 dərc" deyilir.
  Kod birinci sayğacı hər reyestr kontraktında ayrıca saxlayır; ikinci sayğacı hər siyahı üzrə saxlayır və yeni siyahı qeydiyyatını məhdudlaşdırmır, yəni limit yeni
  siyahı açmaqla aşıla bilər. Qurum üzrə 48 dərc isə bir neçə siyahısı olan böyük qurumun saatlıq dərc etməsinə mane olardı.
- Layihə rəhbərliyi 2026-10-19 tarixində təhlükəsizlik yoxlamasının tövsiyələrini təsdiqlədi.

# Qərar

## K1 — Sxem ad sahələri ayrıdır

- **Milli sxem** (`NATIONAL`): `vctURI` dəqiq olaraq `urn:tamga:<cc>:<alan>:<Tür>:<ana sürüm>` formatındadır — `<cc>` qeydiyyatı aparan
  dövlətin kodudur (ISO 3166-1 alpha-2, kiçik hərf; `TR` → `tr`), ardınca boş olmayan üç hissə gəlir. Formata uyğun gəlməyən qeyd
  rədd edilir (`NationalVctOutsideNamespace`).
- **Şəbəkə sxemi** (`NETWORK`): `vctURI` dövlətə xas formatda (istənilən iki hərfli kodla) **ola bilməz** (`NetworkVctInNationalNamespace`);
  Governance bu yoxlamanı təklif zamanı da aparır, formata uyğun gəlməyən təklif açılmır. Şəbəkə sxemi üçün başqa format məcburi edilmir
  (məs., Aİ tipləri şəbəkə sxemi kimi qeydiyyata alına bilər).
- İki ad sahəsi bir-birindən ayrı olduğu üçün milli qeyd heç vaxt şəbəkə sxeminin adını tuta bilməz; təklif zamanı adın ehtiyata götürülməsinə (rezervasiya)
  ehtiyac qalmır.

## K2 — Qurum yalnız öz dövlətinə bağlanır

- `registerIssuer`: qurumun kök sertifikatı (`parentCA`) qurumla eyni dövlətin qeydi olmalıdır.
- `revokeIssuer`: göstərilən xələf (`successorId`) eyni dövlətin qurumu olmalıdır.
- Hər ikisi `CrossStateReference` ilə rədd edilir. Dövlətin qeydlərinə yalnız həmin dövlətin açarları təsir edir ([[SPEC-BC-0001]]
  N1, [[ADR-0002]] Qat 2).

## K3 — Kvotaların əhatəsi

- **Dövlət üzrə gündəlik yazma** (`MAX_WRITES_PER_STATE_PER_DAY = 10 000`): hər reyestr kontraktı öz sayğacını saxlayır; dövlətin bir
  gündəki ümumi milli yazma həcmi reyestr kontraktlarının sayı ilə məhdudlaşır (hazırda beş kontrakt). Kontraktlararası ortaq sayğac əlavə çağırış və
  ortaq vəziyyət tələb edərdi; məqsəd olan spam limiti kontrakt üzrə sayğacla da xətti qalır.
- **Status siyahısının dərci** (`MAX_PUBLISH_PER_DAY = 48`): **hər siyahı üzrə** gündəlik limitdir (24 saatlıq dərc + təkrar cəhd ehtiyatı).
- **Yeni siyahı qeydiyyatı:** qurum üzrə gündə ən çox 8 (`MAX_LIST_REGISTRATIONS_PER_ISSUER_PER_DAY`). Beləliklə, dərc limiti yeni siyahı
  açmaqla aşıla bilməz; bir neçə siyahısı olan qurum hər siyahısını saatlıq dərc edə bilər. Limitin aşılması `ListRegistrationQuotaExceeded` ilə
  rədd edilir.

# Nəzərdən keçirilmiş variantlar

| Variant | Nəticə | Səbəb |
|---|---|---|
| Şəbəkə sxemi təklifi açılanda adını ehtiyata götürmək (rezervasiya) | rədd | Təklifdən əvvəl adın ələ keçirilməsinə mane olmur (tanınmış adlar əvvəlcədən tutula bilər); müddəti bitən təklifin rezervasiyasını götürmək üçün əlavə vəziyyət və təmizləmə lazımdır |
| `schemaId` dəyərinə qat və ya dövlət kodunu əlavə etmək | rədd | `schemaId = keccak256(vct)` dəyişmir ([[ADR-0010]]); yoxlayan tərəf və kataloq eyni identifikatordan istifadə edir |
| Milli formatı məcburi etmək, şəbəkə formatını sərbəst buraxmaq (şəbəkə sxemini yoxlamamaq) | rədd | Şəbəkə sxemi dövlətə xas formatda qeydiyyata alınarsa, ad sahələri yenidən üst-üstə düşür |
| Dövlətlərarası bağlantıya "təsdiqli" istisna (qarşı dövlətin razılığı) | rədd (hələlik) | Hazırda real istifadə halı yoxdur; razılıq axını yeni səlahiyyət yolu açır. Lazım olarsa, ayrıca ADR |
| Qurum üzrə 48 dərc (spesifikasiyanın köhnə mətni) | rədd | Bir neçə siyahısı olan qurumun saatlıq dərc etməsinə mane olur |
| Kontraktlararası ortaq dövlət sayğacı | rədd | Əlavə çağırış və ortaq vəziyyət; spam limiti kontrakt üzrə sayğacla da qorunur |

# Dəyişməzlər

| Kod | Qayda |
|---|---|
| NS1 | Milli sxemin `vct` dəyəri `urn:tamga:<cc>:<alan>:<Tür>:<ana sürüm>` formatındadır və `<cc>` qeydiyyatı aparan dövlətin kodudur; şəbəkə sxeminin `vct` dəyəri bu formatda ola bilməz. |
| NS2 | Qurumun kök sertifikatı və xələfi qurumla eyni dövlətə aiddir. |
| NS3 | Dövlət üzrə gündəlik yazma limiti hər reyestr kontraktında ayrıca hesablanır; status siyahısının dərc limiti hər siyahı üzrədir; qurum üzrə gündəlik yeni siyahı qeydiyyatı məhdudlaşdırılır. |

# Nəticələr

- `contracts/src/schema/VctNamespace.sol` (format yoxlaması, Governance və SchemaRegistry birgə istifadə edir); `SchemaRegistry`,
  `Governance.proposeNetworkSchema`, `IssuerRegistry.registerIssuer` / `revokeIssuer`, `StatusListRegistry.registerList`; testlər.
  Yaddaş strukturu yalnız sona əlavə etməklə dəyişir.
- [[SPEC-BC-0001]] §3.1, §4.3, §4.4, §7, §12.2 və §13 versiya qeydi ilə yenilənir.
- DECISIONS: **D-BC-9**.

# Status

**Accepted — 2026-10-19.** Layihə rəhbərliyinin təsdiqi ilə. DECISIONS: D-BC-9. NS1–NS3 məcburi qüvvəyə malikdir; [[ADR-0010]] sənədindəki `vct` formatı
kontraktda məcburi olur, heç bir ADR qərarı dəyişmir.
