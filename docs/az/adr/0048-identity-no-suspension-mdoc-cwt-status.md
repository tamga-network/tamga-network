---
document_id: ADR-0048
title: "Şəxsiyyət xidmətinin sənədlərində dayandırma yoxdur; mdoc ləğv siyahısı CWT formatında"
status: Active
version: 1.0.0
created: 2026-10-13
last_updated: 2026-10-13
summary: >
  Avropa İttifaqı (Aİ) şəxs identifikasiyası məlumatları (PID) qaydasına uyğunlaşdırma: şəxsiyyət xidmətinin verdiyi sənəd növlərində dayandırma yoxdur, status yalnız "etibarlı / ləğv edilmiş"dir və bu növlərin ləğv siyahıları `bits = 1` ilə dərc olunur. Qurum sənədlərində dayandırma yalnız sxemi `suspension_allowed: true` göstərən növlərdə istifadə olunur. mdoc sənədinin MSO-su eyni məntiqi siyahının ayrı ünvandakı CWT təqdimatına (`application/statuslist+cwt`) istinad edir; JWT və CWT təqdimatları eyni bitləri daşıyır. SPEC-CRED-0003/S2-ni dəyişdirir. Tətbiq paketlərin 0.6.0 versiyasındadır. Qəbul: 2026-10-13.
domain: Credentials
related: ["[[ADR-0008]]", "[[ADR-0013]]", "[[ADR-0022]]", "[[ADR-0029]]", "[[ADR-0044]]", "[[SPEC-CRED-0003]]", "[[SPEC-SCHEMA-0001]]", "[[FW-RB-0001]]", "[[FW-RB-0003]]", "[[FW-POL-0001]]"]
translation_of: ADR-0048
source_version: "1.0.0"
---

# Qısaca

Şəxsiyyət xidmətinin sənədləri artıq dayandırıla bilməz: ya etibarlıdır, ya da ləğv edilib. Qurumlar dayandırmadan yalnız növün sxemi icazə
verirsə istifadə edir (məsələn, diplom). Şəxsiyyət sənədinin mdoc nüsxəsi ləğv statusunu eyni siyahının CWT formatındakı nüsxəsindən
oxuyur. Bu, ilk Aİ uyğunluq turunun (2026-10-13) təklifidir; layihə rəhbərliyi onu həmin gün qəbul etdi.

# Kontekst

- **Mövcud qayda.** Bütün Tamga ləğv siyahıları `bits = 2` ilə dərc olunur (etibarlı, ləğv edilmiş, dayandırılmış; [[SPEC-CRED-0003]] §3.3, S2).
  Identity Rulebook şəxsiyyət sənədi üçün "etibarlı, ləğv edilmiş, dayandırılmış" deyir ([[FW-RB-0003]] §6.2); RB-AP-ID-11 "əsas sənəd ləğv edilib və ya
  dayandırılıbsa" ZK nüsxəsinin verilmədiyini bildirir. Şəxsiyyət xidmətinin kodu isə heç vaxt dayandırmır, yalnız ləğv edir. Qurum Konsolu hər sənəd
  növündə dayandırmaya icazə verir.
- **Aİ qaydası.** İcra Reqlamenti (Aİ) 2024/2979, Əlavə II (2026/1731 ilə dəyişdirilmiş) ETSI TS 119 472-1-i aşağıdakı uyğunlaşdırma ilə məcburi edir: PID,
  kvalifikasiyalı EAA və dövlət qurumunun EAA-sında status yalnız "ləğv edilmiş / ləğv edilməmiş"dir, **dayandırma yoxdur**, ləğv qalıcıdır. Şəxsiyyət sənədimiz
  PID deyil ([[ADR-0022]]: kvalifikasiyalı olmayan EAA), lakin Aİ PID-inin adlarından və kodlaşdırmasından istifadə edir ([[ADR-0045]]) və dövlət
  PID-i gəldikdə onu əvəz etməyə ən yaxın növdür. Dayandırmanın şəxsiyyət kontekstində qarşılığı da yoxdur: şəxsiyyət haqqında "yoxlama müddətində
  müvəqqəti etibarsız" deyiləcək bir vəziyyət yaranmır; şübhə olduqda sənəd ləğv edilir və şəxs yenidən yoxlanılır.
- **mdoc status istinadı.** Şəxsiyyət sənədinin mdoc nüsxəsinin MSO-su bu gün SD-JWT nüsxəsi ilə eyni ünvana, yəni JWT formatındakı
  siyahıya istinad edir. ISO/IEC 18013-5 və Aİ reqlamenti mdoc üçün CBOR/COSE formatını (CWT) gözləyir; mdoc oxuyucusu JWT parserini
  daşımağa məcbur qalmamalıdır. [[SPEC-CRED-0003]] §3.2 CWT-ni "dövlət mərhələsində qiymətləndiriləcək" deyə açıq qoymuşdu.

# Qərar

## K1 — Şəxsiyyət xidmətinin növlərində dayandırma yoxdur

- Şəxsiyyət xidmətinin verdiyi və ləğv siyahısından istifadə edən hər növdə (şəxsiyyət sənədi `urn:tamga:id:IdentityAttestation:1`, sürücülük
  vəsiqəsi məlumatı `urn:tamga:id:DrivingLicenceAttestation:1`, əlaqə sənədləri `urn:tamga:contact:EmailAddress:1` və
  `urn:tamga:contact:PhoneNumber:1`) status yalnız **etibarlı (`0x00`)** və ya **ləğv edilmiş (`0x01`)** olur. Ləğv qalıcıdır.
- Bu növlərin ləğv siyahıları **`bits = 1`** ilə dərc olunur. Siyahılar hər növ üçün ayrı olduğundan (S9) bir siyahıda dayandırmalı və
  dayandırmasız növlər qarışmır.
- Şəxsiyyət xidməti sənədi dayandırmır; şübhə olduqda ləğv edir. Əsas sənəd ləğv edilibsə, ZK nüsxəsi verilmir (RB-AP-ID-11-in "və ya
  dayandırılıbsa" hissəsi çıxarılır).
- Dayandırması olmayan növün siyahısında `0x00` və `0x01` xaricindəki hər dəyər yoxlayan tərəf üçün RƏDD deməkdir (pozulmuş siyahı); `bits = 1` siyahısında onsuz da
  başqa dəyər yoxdur.

## K2 — Qurum növlərində dayandırma yalnız sxem icazə verirsə

- Sxem metaməlumatlarının `tamga` blokuna ixtiyari **`suspension_allowed`** (boolean, defolt `false`) sahəsi əlavə olunur
  ([[SPEC-SCHEMA-0001]] §2.4).
- Dayandırma (`0x02`) yalnız sxemi `suspension_allowed: true` olan növlərin sənədlərində istifadə olunur. Təhsil növlərindən diplom
  (`urn:tamga:edu:DiplomaCredential:1`) bunu daşıyır: plagiat və ya saxtakarlıq araşdırması davam edərkən sənəd dayandırılır. Digər
  növlər bu sahəni daşımır; sənədi verən qurum bu növlərdə dayandırmanı tətbiq etməməlidir (**MUST NOT**).
- Qurum siyahıları `bits = 2` olaraq qalır (dayandırması olmayan növdə də; `0x02` dəyəri yazılmır). Beləliklə, gələcəkdə bir növə dayandırma icazəsi verilərsə,
  siyahının formatı dəyişmir.
- Qurum Konsolu "Dayandır" əməliyyatını yalnız `suspension_allowed: true` növlərdə təqdim edir. Öz sənəd vermə xidmətini idarə edən qurum
  da eyni qaydaya əməl edir (RB-AP).
- Şəxsiyyət xidmətinin növləri `suspension_allowed` daşımır (K1).

## K3 — mdoc status istinadı CWT təqdimatına

- Sənədi verən qurum ləğv siyahısından istifadə edən və mdoc kimi də verilən hər növ üçün eyni məntiqi siyahını iki təqdimatda dərc edir:
  JWT (`application/statuslist+jwt`, mövcud) və CWT (`application/statuslist+cwt`; IETF Token Status List-in CWT formatı: COSE_Sign1,
  ES256, qorunan başlıqda `typ` = `application/statuslist+cwt` və `x5chain`; iddialar `sub` (2), `iat` (6), `exp` (4), `ttl`
  (65534), `status_list` (65533) `{bits, lst}`).
- İki təqdimat **ayrı ünvanlarda** yerləşir, çünki hər tokenin `sub`-ı öz ünvanı ilə tam eyni olmalıdır ([[SPEC-CRED-0003]]
  Ş4). CWT ünvanı da qeyri-şəffafdır (S8) və qurumu, ili və ya qrupu kodlaşdırmır.
- İki təqdimat **eyni bitləri** daşıyır, eyni dərc dövründə eyni açarla imzalanır (eyni `iat`, `exp`, `ttl`), eyni lövbər
  jurnalına iki ayrı sətir kimi yazılır. Bir sənədin SD-JWT və mdoc nüsxələri eyni `idx`-dən istifadə edir.
- SD-JWT VC nüsxəsi JWT ünvanına, mdoc nüsxəsinin MSO-su (`status.status_list {idx, uri}`) CWT ünvanına istinad edir. mdoc
  yoxlayan tərəfi CWT təqdimatını [[SPEC-CRED-0003]] §7-dəki addımların CBOR qarşılığı ilə yoxlayır.
- mdoc kimi verilməyən növlərdə CWT təqdimatı dərc olunmur.

## K4 — Tətbiq və keçid

- Tətbiq `@tamga-network/*` paketlərinin 0.6.0 versiyasında və şəxsiyyət xidmətindədir. İnkişaf mərhələsi qaydasına görə ([[ADR-0029]])
  keçid kodu yazılmır: şəxsiyyət xidməti yeni (`bits = 1`) siyahıları açır, rəqəmsal cüzdanlardakı şəxsiyyət sənədləri yenidən alınır.
- Qurum Konsolunun qayda mətni bu gündən bu qərara uyğun yazılır; düymənin növə görə gizlədilməsi 0.6.0-dadır.

# Nəzərdən keçirilmiş variantlar

| Variant | Nəticə | Səbəb |
|---|---|---|
| Bütün siyahılar `bits = 2` qalsın, şəxsiyyət xidməti sadəcə dayandırmadan istifadə etməsin | rədd | Siyahı formatı qaydanı ifadə etmir; yoxlayan tərəf `0x02` görərsə nə edəcəyini bilməz. Aİ PID-i kimi oxunması üçün format da "ləğv edilmiş / ləğv edilməmiş" olmalıdır |
| Dayandırmanı şəbəkənin bütün növlərində aradan qaldırmaq | rədd | Diplomda yoxlama müddətində dayandırma real ehtiyacdır ([[SPEC-CRED-0003]] §3.3); kvalifikasiyalı olmayan EAA-da Aİ bunu sərbəst buraxır |
| Dayandırma icazəsi sənədi verən qurumun qeydində (hər qurum üzrə) | rədd | Dayandırma qurumun seçiminə deyil, növün mənasına bağlıdır; sxem hamı üçün eyni qaydanı müəyyən edir |
| mdoc-da JWT ünvanında qalmaq | rədd | mdoc oxuyucusuna JWT parseri yükləyir; ISO və Aİ CWT gözləyir |
| Tək ünvanda məzmun razılaşdırması (`Accept` başlığına görə JWT və ya CWT) | rədd | Tokenin `sub`-ı ünvanla tam eyni olmalıdır; eyni ünvanda iki format əvvəlcədən yükləmə keşində qarışır |
| İdentifikator siyahısı (Attestation Revocation List) | rədd (bu gün) | Tamga-da sənədi verən qurumlar Status List dərc edir; biri kifayətdir (Aİ VCR_11); yoxlayan tərəf identifikator siyahısını yenə də oxuyur |

# Dəyişməzlər

| Kod | Qayda |
|---|---|
| SU1 | Şəxsiyyət xidmətinin növlərində sənəd dayandırılmır; status yalnız etibarlı və ya ləğv edilmişdir və bu növlərin ləğv siyahıları `bits = 1` ilə dərc olunur. |
| SU2 | Dayandırma (`0x02`) yalnız sxemi `suspension_allowed: true` olan növlərdə istifadə olunur; digər növlərdə sənədi verən qurum dayandırma dəyəri yazmır. |
| SU3 | mdoc kimi də verilən növün ləğv siyahısı JWT və CWT olaraq ayrı, qeyri-şəffaf ünvanlarda eyni bitlərlə dərc olunur; mdoc nüsxəsi CWT ünvanına, SD-JWT nüsxəsi JWT ünvanına istinad edir. |

# Nəticələr

- [[SPEC-CRED-0003]]: S2 bu qərara uyğun yenidən yazılır; §3.2 CWT təqdimatı, §3.3 hər növ üçün `bits`, §7 Ş8–Ş9.
- [[SPEC-SCHEMA-0001]] §2.4: `suspension_allowed`.
- Çərçivə: [[FW-RB-0003]] §3.1 və §6.2; [[FW-RB-0001]] RB-AP-18, RB-AP-ID-11, yeni RB-AP-28 və RB-AP-ID-13; [[FW-POL-0001]] §5;
  Education Rulebook §6.2.
- Paketlər (0.6.0): `@tamga-network/issuer` siyahı dərcedicisi (hər növ üçün `bits`, CWT təqdimatı), `@tamga-network/mdoc` (MSO status
  istinadı), `@tamga-network/verifier` və `wallet-core` (CWT oxuma), sxem kataloqu (`suspension_allowed`).
- Şəxsiyyət xidməti və Qurum Konsolu (operator repozitoriyası): yeni siyahılar; dayandırma düyməsi növə görə.

# Status

**Accepted — 2026-10-13.** Layihə rəhbərliyinin təsdiqi ilə (ilk Aİ uyğunluq turu, qərar 5). DECISIONS: D-CRED-9.
