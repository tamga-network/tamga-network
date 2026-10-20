---
document_id: SPEC-SCHEMA-0003
title: "Sektor sxemləri"
status: Active
version: 1.0.0
created: 2026-09-09
last_updated: 2026-10-16
summary: >
  Təhsildən kənar şaquli istiqamətlərin sxem skeletlərini və sektorun AÇILMA ŞƏRTLƏRİNİ müəyyən edir. Mərkəzi tezis: təhsildə işə yarayan yanaşma digər sektorlara olduğu kimi köçürülə bilməz — səhiyyədə yanlış seçici paylaşım qərarı geri qaytarıla bilməyən zərər vurur, sürücülük vəsiqəsində hətta format da fərqlidir (SD-JWT deyil, mdoc), hüquqi şəxsdə isə subyekt insan deyil. Buna görə sənəd əvvəlcə SEKTOR AÇMA YOXLAMA SİYAHISINI (yeddi şərt) təqdim edir, sonra beş şaquli istiqamətin skeletini verir. İlk mərhələdə yalnız `org` skeleti yazılır; səhiyyə, sürücülük vəsiqəsi, səyahət və ticarət sonrakı mərhələlərə saxlanılıb və bu sənəd onların erkən qərarlarını qeydə alır, sxemlərini yazmır.
translation_of: SPEC-SCHEMA-0003
source_version: "1.0.0"
---

# Qısaca

Bu sənəd təhsildən kənar sektorlar (hüquqi şəxs, səhiyyə, sürücülük vəsiqəsi, səyahət, ticarət) açılmazdan əvvəl verilməli olan
erkən qərarları və sektorun açılması şərtlərini toplayır. Oxucuları yeni rəqəmsal sənəd növü təklif etmək istəyən qurumlar və sxem
müəllifləridir.

**Nə vaxt oxunmalıdır**

- Əvvəlcə [Rəqəmsal sənəd formatları](/concepts/credential-formats) konsepsiya səhifəsini və sxem kataloqunu ([[SPEC-SCHEMA-0001]]) oxuyun.
- Tam yazılmış nümunə üçün təhsil sxemlərinə baxın: [[SPEC-SCHEMA-0002]].
- Yeni sektor təklif edərkən §1-dəki yoxlama siyahısı ilə başlayın.

**Sadə izah**

Bu sənəd skeletdir: sxem yazmır. Hər sektorun özünəməxsus riskləri var; səhiyyə məlumatları diplomdan qat-qat həssasdır,
sürücülük vəsiqəsi fərqli formatla (mdoc) daşınır, ticarət sənədləri isə sahibini dəyişə bilər. Təhsildə verilən qərarlar bu sektorlara
olduğu kimi köçürülməsin deyə, hər sektor üçün istinad standartı, məhdudlaşdırıcı erkən qərarlar və açılma şərti indidən yazılır.
Bu gün yalnız hüquqi şəxs skeleti qüvvədədir.

---

# Əhatə dairəsi

Bu sənəd **skeletdir.** Təhsil sxemləri [[SPEC-SCHEMA-0002]] sənədində tam
yazılıb; buradakılar yazılmayıb — erkən qərarlar, istinad standartları
və açılma şərtləri qeydə alınıb.

**Niyə indi yazılır:** Bu şaquli istiqamətlər sabah açıldıqda, bu gün təhsildə
verilmiş qərarlar onlara **köçürülməməlidir**. Köçürülməməli olan
şeyləri indi yazmaq sonradan düzəltməkdən ucuzdur.

---

# 1. Sektor Açma Yoxlama Siyahısı (Normativ)

Yeni `domain` ([[SPEC-SCHEMA-0001]] §1.2) açılmazdan əvvəl **yeddi şərtin
hamısı** ödənilməlidir. Biri çatışmırsa, domen açılmır.

> `SG*` kodları **açılma şərtləridir**, dəyişməz deyil; lakin [[INVARIANTS]]
> indeksində göründükləri üçün unikal adlandırılıb.

| # | Şərt | Səbəb |
|---|---|---|
| **SG1** | Beynəlxalq istinad modeli seçilib və [[RS-SCHEMA-0001]] kimi araşdırma ilə əsaslandırılıb | Sıfırdan uydurmaq tanınmanı məhv edir |
| **SG2** | Daşıyıcı format qərarı verilib (SD-JWT VC / mdoc / qarışıq) | Format sonradan dəyişərsə, bütün sxem yenidən yazılır |
| **SG3** | Törəmə boolean claim dəsti müəyyən edilib | `age_over_NN` nümunəsi sonradan əlavə edilə bilməz ([[RS-SCHEMA-0001]] §4) |
| **SG4** | Selective disclosure siyasəti (`sd: always` olacaq sahələr) müəyyən edilib | Yanlış `never`, `REVOKED` + rəqəmsal sənədin yenidən verilməsini tələb edir |
| **SG5** | TTL və ləğv siyahısının istifadəsi razılaşdırılıb | [[SPEC-CRED-0003]] Alt. C — qısa ömür, yoxsa ləğv |
| **SG6** | Minimal sənədi verən qurum kateqoriyası və assurance səviyyəsi müəyyən edilib | Kateqoriya aşımının qarşısını alır ([[ADR-0007]] K6) |
| **SG7** | Sektora xas hüquqi araşdırma aparılıb | Səhiyyə, maliyyə və şəxsiyyət məlumatları əlavə qanunvericiliyə tabedir |

**Dəyişməz SK1:** Yeddi şərtdən biri çatışmadıqda NETWORK qatında domen
açılmır. NATIONAL sxemlər üçün də eyni siyahı həmin dövlətin öz idarəetməsi çərçivəsində
tətbiq olunur.

## 1.1 Risk asimmetriyası

Sektorlar bərabər deyil. Səhvin bədəli:

| Sektor | Yanlış qərar nümunəsi | Bədəli |
|---|---|---|
| Təhsil | Qiymətin `allowed` olması | Narahatedici, düzəldilə bilər |
| Hüquqi şəxs | Səlahiyyət əhatəsinin geniş olması | Maliyyə zərəri, müqavilə ilə məhdudlaşdırıla bilər |
| **Səhiyyə** | Diaqnoz sahəsinin `sd: never` olması | **Geri qaytarıla bilməz** — səhiyyə məlumatlarının ifşası |
| Sürücülük vəsiqəsi/şəxsiyyət | Portret sahəsinin lüzumsuz açılması | Biometrik ifşa, daimi |
| Ticarət | Tərəfin yanlış müəyyən edilməsi | Hüquqi mübahisə |

**Nəticə:** Yoxlama siyahısı (§1) sektor üzrə sərtləşir. Səhiyyədə SG4 və SG7
müstəqil ekspert araşdırması tələb edir; təhsildə daxili baxış kifayətdir.

---

# 2. `org` — Hüquqi Şəxs və Səlahiyyət (ilk mərhələ skeleti)

İlk mərhələdə yazılacaq **yeganə** əlavə şaquli istiqamət.

## 2.1 İstinad modeli: GLEIF vLEI

[[RS-SCHEMA-0001]] §6 əsasında vLEI-nin üç qatı mənimsənilir:

| vLEI qatı | Tamga sxemi | Nəyi sübut edir |
|---|---|---|
| Legal Entity vLEI | `TamgaLegalEntityCredential` | "Bu hüquqi şəxs mövcuddur və budur" |
| **OOR** (Official Organizational Role) | `TamgaOfficialRoleCredential` | "Bu şəxs rəsmi səlahiyyətlidir" (imza səlahiyyəti) |
| **ECR** (Engagement Context Role) | `TamgaContextRoleCredential` | "Bu şəxs bu kontekstdə səlahiyyətlidir" (satınalma meneceri) |

## 2.2 Niyə bu üçlük düzgündür

Vahid "işçi kartı" sxemi yazmaq cəlbedici görünür, amma yanlışdır. Üç fərqli
sual var:

- *Bu şirkət realdırmı?* → LE
- *Bu şəxs şirkəti öhdəlik altına sala bilərmi?* → OOR
- *Bu şəxs bu işi görə bilərmi?* → ECR

Logistika şirkətinin sürücüsü ECR-dir; imza səlahiyyətlisi OOR-dur. Onları eyni sxemə
sıxışdırmaq [[t:verifier|yoxlayan tərəfin]] "bu şəxs müqavilə imzalaya bilərmi" sualına
cavab verə bilməməsi deməkdir.

## 2.3 Erkən qərarlar

| Mövzu | Qərar |
|---|---|
| **Subyekt insan deyil** (LE üçün) | `cnf` hüquqi şəxsin cihaz açarı deyil, **səlahiyyətli nümayəndəsinin** açarıdır — bu, təhsildən struktur baxımından fərqlidir |
| Format | SD-JWT VC |
| Törəmə claim | `can_sign_contracts`, `spend_limit_above` (hədd əsaslı) |
| `sd: always` | Şəxsi ad sahələri, əmək haqqı/limit dəyərləri |
| TTL | OOR/ECR: **90 gün** (rollar dəyişir) · LE: 1 il |
| Ləğv siyahısı | Üçündə də **bəli** — rolun ləğvi real ehtiyacdır |
| Qurum kateqoriyası | `GOVERNMENT` (ticarət reyestri) və ya `OTHER` (şirkətin özü, I1) |

**Diqqətçəkən məqam:** Şirkət öz işçisinə ECR verə bilər (I1 səviyyəsi),
lakin LE rəqəmsal sənədini **özünə verə bilməz** — onu ticarət reyestri verir. Öz
mövcudluğunu özü bəyan edən hüquqi şəxs qeydi qeydin özünü mənasız
edir.

## 2.4 vLEI daşıyıcı fərqi

vLEI ACDC/KERI daşıyıcısından istifadə edir; Tamga isə SD-JWT VC-dən. [[RS-SCHEMA-0001]]
§9-dakı düzləşdirmə məntiqi burada da keçərlidir: **semantika mənimsənilir,
daşıyıcı mənimsənilmir**, və ikitərəfli uyğunlaşdırma cədvəli məcburidir.

---

# 3. `health` — Səhiyyə (genişlənmə mərhələsi)

## 3.1 İstinad: FHIR + IPS

[[RS-SCHEMA-0001]] §5. Presedent nümunə: **rəqəmsal sənəd FHIR resursunu daşıyır,
FHIR-i yenidən müəyyən etmir** (SMART Health Cards, WHO GDHCN eyni nümunədən
istifadə edib).

## 3.2 Erkən qərarlar — hamısı məhdudlaşdırıcı istiqamətdə

| Mövzu | Qərar | Əsaslandırma |
|---|---|---|
| Selective disclosure | **Məcburi və defolt** — demək olar ki, hər sahə `sd: always` | Sığorta "peyvənd olunubmu" soruşduqda bütün immunizasiya tarixçəsini görməməlidir |
| Törəmə claim | **Əsas interfeys** — `is_vaccinated_for(X)`, `has_no_allergy_to(Y)` | Xam FHIR resursu qayda deyil, istisna olmalıdır |
| Xam resursun təqdimatı | Yalnız **səhiyyə müəssisəsi** olan yoxlayan tərəflərə | RP scope-u ilə məcburi edilir |
| Qurum təminatı | **Minimum I3** | Səhiyyə sənədini verən qurum akkreditə olunmalıdır |
| Ləğv siyahısı | Bəli, qısa `ttl` | Test nəticələri tez köhnəlir |
| Zəncirdə əks olunma | **Heç biri** — sxem qeydi belə domen adından başqa məlumat verməməlidir | [[PM-TRUST-0001]] |

## 3.3 Qırmızı xətt

**Dəyişməz SK2:** `health` domenində heç bir sahə `sd: "never"` ola bilməz —
protokol claim-ləri (`iss`, `vct`, `cnf`, `status`, `iat`) istisna olmaqla.

[[SPEC-SCHEMA-0001]]/D6 onsuz da fərdi məlumatlarda `never` ([[t:selective-disclosure]] olmadan) istifadəsini qadağan edirdi; səhiyyədə
bu, istisnasız qaydaya çevrilir. Diaqnoz sahəsinin səhvən `never`
kimi işarələnməsi həmin sxemlə verilmiş **bütün** rəqəmsal sənədlərdə diaqnozun hər yoxlayan tərəfə
getməsi deməkdir və bu geri qaytarıla bilməz.

## 3.4 Açılma şərti

SG7 (hüquqi araşdırma) səhiyyədə **müstəqil** olmalıdır. KVKK-nın xüsusi kateqoriyalı
fərdi məlumatlar rejimi və müvafiq səhiyyə qanunvericiliyi təhsil sxemlərində olmayan
öhdəliklər gətirir. Bu araşdırma aparılmadan `health` domeni açılmır.

---

# 4. `id` — Sürücülük Vəsiqəsi və Şəxsiyyət (dövlət mərhələsi)

## 4.1 Format fərqi — ən vacib məqam

[[t:mDL]] SD-JWT deyil, **[[t:mdoc]]/CBOR/COSE** istifadə edir ([[RS-SCHEMA-0001]] §4).
[[ADR-0006]] mdoc-u ikinci format kimi artıq qəbul edib.

**Dəyişməz SK3:** mDL [[t:SD-JWT-VC]] formatına **çevrilmir.** Çevirmək onu mDL olmaqdan
çıxarır və beynəlxalq tanınmasını məhv edir — mDL-in bütün dəyəri sərhədlərarası
oxuna bilməsindədir.

Nəticə: `id` domeni açıldıqda rəqəmsal cüzdan, yoxlayan tərəf və SDK **hər iki formatı birlikdə**
dəstəkləməlidir. Bu, dövlət mərhələsinin ən böyük mühəndislik bəndidir.

## 4.2 Mənimsənilən nümunə

`age_over_NN` ([[RS-SCHEMA-0001]] §4) artıq prinsip kimi bütün Tamga sxemlərinə
daxil olub. `id` domeni açıldıqda bu nümunənin **mənbəyi** də mənimsənilir:
`org.iso.18013.5.1` ad fəzası və məlumat elementləri olduğu kimi istifadə olunur.

## 4.3 Erkən qərarlar

| Mövzu | Qərar |
|---|---|
| Format | mdoc (ISO/IEC 18013-5), onlayn üçün 18013-7 |
| Portret | `sd: always`; bundan əlavə **ayrıca razılıq** tələb edir (biometrik) |
| Qurum | Yalnız `GOVERNMENT` + `I3` |
| Yaxınlıqda təqdimat | BLE/NFC — [[SPEC-PROTO-0002]] əhatə dairəsindən kənar idi, ayrıca profil lazımdır |
| Standartın xərci | **ISO mətni ödənişlidir** — büdcə bəndi ([[RS-SCHEMA-0001]] §4) |

## 4.4 PID əlaqəsi

`id` domeni açıldıqda [[SPEC-SCHEMA-0002]] §1.2.3-dəki ilk mərhələ məhdudiyyəti
aradan qalxır: birləşmiş təqdimatla (diplom + [[t:PID]], eyni `cnf`) şəxsiyyətin uyğunlaşdırılması
kriptoqrafik olur. Bu, `id` domeninin **təhsil üçün də** ən vacib
qazancıdır.

---

# 5. `travel` — Səyahət (genişlənmə mərhələsi)

İstinad: **ICAO DTC**. Pasportun çipindəki məntiqi məlumat strukturunun rəqəmsal
törəməsi; virtual və fiziki olmaqla iki komponentlidir.

**Erkən qərar:** Tamga DTC **vermir** — pasport vermə səlahiyyəti dövlət inhisarıdır.
Turizm modulu (`turkistantour.com` konteksti) və sərhədkeçmə ssenarilərində
Tamga **yoxlayan tərəf** rolundadır.

Bu, digər şaquli istiqamətlərdən struktur baxımından fərqlidir və `id` domeni yetkinləşmədən
nəzərdən keçirilməməlidir.

---

# 6. `log` — Ticarət və Logistika (genişlənmə mərhələsi)

İstinad: **UN/CEFACT** məlumat modelləri + **MLETR** (elektron ötürülə bilən
qeydlər haqqında model qanun).

## 6.1 Struktur fərq: ötürülə bilmə

Bu vertikal Tamga-nın bütün dizaynına zidd olan bir tələb gətirir.

Konosament kimi sənədlər **ötürülə bilən** olmalıdır — mal əl
dəyişdikcə sənəd də əl dəyişir. Lakin Tamga-nın əsas təhlükəsizlik xüsusiyyəti
rəqəmsal sənədin **ötürülə bilməz** olmasıdır ([[SPEC-CRED-0001]] §3,
[[SPEC-WALLET-0001]]/WL1).

**İnvariant SK4:** Ötürülə bilən ticarət sənədləri `TamgaBaseCredential`-dan
törəyən adi [[t:credential|rəqəmsal sənəd]] **ola bilməz.** Ayrıca primitiv lazımdır — ehtimal ki,
zəncirüstü sahiblik qeydi + rəqəmsal sənədin yalnız sahiblik sübutu kimi
istifadəsi.

Bu, sxem dizaynı deyil, **memarlıq** dizaynı problemidir və `log` domeni
açılmazdan əvvəl ayrıca ADR tələb edir.

## 6.2 vLEI ilə əlaqə

Ticarət sənədlərinin tərəfləri hüquqi şəxslərdir; §2-dəki `org` sxemləri
ilkin şərtdir. `log`, `org` yetkinləşmədən açıla bilməz.

---

# 7. Sektorlararası qaydalar

| Qayda | Əhatə |
|---|---|
| Törəmə boolean claim-lər hər domendə məcburidir | [[RS-SCHEMA-0001]] §4 |
| Çoxdillilik əvvəldən nəzərə alınır | [[SPEC-SCHEMA-0001]] §8 |
| İkitərəfli uyğunlaşdırma cədvəli məcburidir | [[RS-SCHEMA-0001]] §9 |
| İki səviyyədən dərin iç-içə struktur yoxdur | [[SPEC-CRED-0002]]/C11 |
| Şəxsiyyət nömrəsi NETWORK sxemlərində yer almır | [[SPEC-SCHEMA-0002]] §1.2 |
| Siyahı URI-si qeyri-şəffaf, indeks təsadüfi | [[SPEC-CRED-0003]] §6 |

Son iki sətir xüsusilə vacibdir: `health` və `id` domenlərində şəxsiyyət
nömrəsi əlavə etmək daha cəlbedici olacaq (qanunvericilik əsaslandırması ilə). Qərar
lazımdırsa, NATIONAL sxemlə verilir, NETWORK sxeminə daxil olmur.

---

# 8. Faza xəritəsi

| Domen | Faza | İlkin şərt |
|---|---|---|
| `edu` | **0 — yazılıb** | — |
| `org` | **0 — skelet** | §1 yoxlama siyahısı (SG1–SG7) |
| `id` | 1 | Dövlətin iştirakı + mdoc dəstəyi + ISO mətni |
| `health` | 2 | Müstəqil hüquqi ekspertiza (§3.4) |
| `travel` | 2 | `id`-in yetkinləşməsi |
| `log` | 2 | `org`-in yetkinləşməsi + ötürülə bilmə ADR-i (§6.1) |
| `fin` | 2 | Ayrıca iş — bu sənəddə nəzərdən keçirilməyib |

---

# 9. İnvariantlar

| # | İnvariant |
|---|---|
| **SK1** | Yeddi şərtli yoxlama siyahısı tamamlanmadan domen açılmır. |
| **SK2** | `health` domenində heç bir fərdi məlumat sahəsi `sd: "never"` ola bilməz. |
| **SK3** | mDL SD-JWT VC-yə çevrilmir; mdoc olaraq qalır. |
| **SK4** | Ötürülə bilən ticarət sənədləri adi rəqəmsal sənəd ola bilməz; ayrıca primitiv lazımdır. |
| **SK5** | Hüquqi şəxs öz LE rəqəmsal sənədini özünə verə bilməz. |
| **SK6** | Şəxsiyyət nömrəsi heç bir NETWORK sxemində yer almır — domendən asılı olmayaraq. |

---

# Təhlükəsizlik və məxfilik qeydləri

**Hətta domen adı da məlumat daşıyır.** İstifadəçinin rəqəmsal cüzdanında `health`
domenindən rəqəmsal sənədin olması, təqdim edilməsə belə, bir siqnaldır — təqdimat
siyahısında tip adı görünür. Rəqəmsal cüzdanın dizaynı istifadəçiyə rəqəmsal sənəd tiplərini
gizlətməyə imkan verməlidir → [[SPEC-WALLET-0001]] açıq məsələsi.

**Sektor genişlənməsi yoxlayan tərəfə yük yaradır.** Hər yeni domen yoxlayan tərəf
SDK-sında yeni format və yeni siyasət deməkdir. `id` domeninin mdoc gətirməsi
([[SPEC-CRED-0002]]-in təkformatlı fərziyyəsini pozacaq) ən böyük dönüş nöqtəsidir.

**Yoxlama siyahısı ləngidicidir və belə də olmalıdır.** Yeni vertikal
açmağın asan olması pis sxem yazılmasını asanlaşdırır. §1-in sürtünməsi
qəsdəndir.

---

# Açıq məsələlər

1. `fin` domeni bu sənəddə nəzərdən keçirilməyib. Maliyyə `org` və `id`-nin
   kəsişməsindədir və ehtimal ki, ən ağır tənzimləmə yükünə malikdir. Ayrıca araşdırma
   tələb olunur.
2. §6.1-dəki ötürülə bilmə problemi ADR gözləyir. Zəncirüstü sahiblik
   qeydi, yoxsa MLETR ilə uyğun ayrıca primitiv?
3. `id` domeni açıldıqda [[SPEC-CRED-0002]]-in "tək format" fərziyyəsi pozulur.
   Həmin sənədin mdoc bölməsi nə vaxt yazılacaq?
4. `org` skeletinin ilk mərhələdə yazılacağını dedik, lakin o, pilotun əhatəsinə daxil deyil. Nə
   vaxt və hansı tətiklə tam sxemə çevriləcək? → PM-GTM-0001
5. §1 yoxlama siyahısının tətbiqinə kim nəzarət edir? İlk mərhələdə fondun texniki
   şurası; dövlət mərhələsində şura ([[PM-GOV-0001]]).

---

# Əlaqəli sənədlər

[[RS-SCHEMA-0001]] · [[SPEC-SCHEMA-0001]] · [[SPEC-SCHEMA-0002]] ·
[[SPEC-CRED-0001]] · [[SPEC-CRED-0002]] · [[SPEC-CRED-0003]] ·
[[SPEC-WALLET-0001]] · [[ADR-0006]] · [[ADR-0007]] · [[PM-TRUST-0001]] ·
[[PM-GOV-0001]] · PM-GTM-0001 · [[INVARIANTS]]

---

# Status

**Qüvvədədir** — versiya 1.0.0 (2026-10-02).

