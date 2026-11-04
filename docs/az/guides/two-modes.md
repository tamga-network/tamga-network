---
document_id: GUIDE-0016
title: "İki rejim: imzalanmış siyahılar və ortaq reyestr"
status: Active
version: 1.0.0
created: 2026-11-05
last_updated: 2026-11-05
summary: >
  Tamga Network-un iki rejimini yan-yana izah edən ümumi baxış: bu gün işləyən zəncirsiz rejim (Aİ modelində olduğu kimi
  imzalanmış etibar siyahıları: LOTL → milli siyahılar → qurumlar, oflayn yoxlama) və gələcəkdə açılacaq zəncirli rejim
  (Hyperledger Besu, QBFT). Zəncirin nə əlavə etdiyi, iki rejimin necə sinxron qaldığı (lövbər jurnalı, siyahı lövbəri, təkrar
  oynatma, ekvivalentlik testi), mənbəyin hansı olduğu, qurum və dövlət üçün nəyin dəyişdiyi, hansı bələdçinin kimə aid olduğu
  və terminlər lüğəti.
translation_of: GUIDE-0016
source_version: "1.0.0"
---

# İki rejim: imzalanmış siyahılar və ortaq reyestr

Tamga Network iki rejimdə işləmək üçün layihələndirilib. **Zəncirsiz rejim** bu gün canlıdır: etibar, Aİ-nin rəqəmsal şəxsiyyət
cüzdanında olduğu kimi, imzalanmış [[t:trust-list|etibar siyahılarına]] əsaslanır. **Zəncirli rejim** bu siyahıların yanına
dövlətlərin birlikdə işlətdiyi icazəli [[t:ledger|ortaq reyestr]] (Hyperledger Besu) əlavə edir. Hər iki rejim eyni
identifikatorlardan, eyni qaydalardan və eyni suallardan istifadə edir; biri digərini əvəz etmir, ikisi sinxron irəliləyir.

Bu səhifə iki rejimi yan-yana izah edir və sizi uyğun quraşdırma bələdçisinə yönləndirir.

**Nə vaxt oxunur:**
- Qurumunuz, şirkətiniz və ya dövlətiniz Tamga-ya qoşulmağı düşünürsə, hansı hissəni quracağınıza qərar verməzdən əvvəl.
- "Zəncir gələndə bizim üçün nə dəyişir?" sualına qısa cavab üçün.
- Əvvəl (istəyə bağlı): [Etibar siyahıları](/concepts/trust-lists) və [Ortaq reyestr (zəncir)](/concepts/ledger).

Bu sənəddə adı və ya kodu çəkilən dövlətlər üçün yer ayrılıb; bu, razılaşma və ya danışıqlar barədə bildiriş deyil.

## Qısaca

| | Zəncirsiz rejim (bu gün) | Zəncirli rejim (gələcəkdə) |
|---|---|---|
| Etibarın əsası | İmzalanmış siyahılar: [[t:LOTL]] → milli siyahılar → qurumlar | Eyni imzalanmış siyahılar + ortaq reyestrdə onların proyeksiyası |
| Kim imzalayır | Siyahı operatoru (bu gün müvəqqəti olaraq Tamga Network) | Siyahı operatoru; əlavə olaraq müstəqil operatorlar siyahının həşinə şahidlik edir |
| Yoxlama | Oflayn: əvvəlcədən endirilmiş siyahı və status siyahıları ilə | Eyni; zəncir yoxlaması istəyə bağlı əlavədir |
| Mənbə | Siyahı | Yenə siyahı; ziddiyyətdə siyahı üstündür |
| Vəziyyət | Real şəbəkədə canlı | Kod yazılıb və sınaqdan keçib; istehsalda söndürülüb |

## Zəncirsiz rejim: imzalanmış siyahılar

Bu rejim Aİ-nin etibar siyahısı modelinin (ETSI TS 119 612 və TS 119 602) eynisidir.

```text
Tamga LOTL  (kök açarı hamı bir dəfə sabitləyir)
├── tl-tr.jws          Türkiyə siyahısı (bu gün Tamga Network vəkalətən idarə edir)
│   ├── milli kök sertifikat(lar)
│   ├── sənədi verən qurumlar   + hansı sənəd növlərini verə bildikləri
│   └── yoxlayan tərəflər       + hansı sahələri istəyə bildikləri
├── tl-<cc>.jws        digər ölkələrin siyahıları (yer ayrılıb)
└── cüzdan provayderləri, sənəd növləri kataloqu, xarici siyahılar
```

1. **LOTL** (siyahılar siyahısı) hər ölkə siyahısının ünvanını, imzalayanını və nəyə zəmanət verə biləcəyini göstərir.
2. **Milli siyahı** həmin ölkənin kök sertifikatlarını, [[t:issuer|sənədi verən qurumlarını]] və
   [[t:verifier|yoxlayan tərəflərini]] daşıyır.
3. **Qurum** (universitet, xəstəxana, bilet satıcısı) siyahıdakı sertifikatı ilə sənəd imzalayır.

Rəqəmsal cüzdan və yoxlayan tərəf siyahıları və status siyahılarını **əvvəlcədən** endirir. Sənəd gəldikdə quruma və ya Tamga-ya
sorğu göndərmir: imzanı, qurumun siyahıdakı qeydini və ləğv vəziyyətini öz əlindəki nüsxə ilə yoxlayır. Siyahı `next_update`
tarixinədək etibarlıdır; bu tarix keçərsə və ya siyahı endirilə bilməzsə nəticə `INDETERMINATE` (hazırda yoxlanıla bilmir) olur,
heç vaxt səhv "qəbul" və ya "rədd" olmur.

Hər siyahı versiyası əvvəlkinin həşini daşıyır; sətir silinmir, yalnız vəziyyət dəyişir. Siyahı operatoru həmçinin saatlıq
imzalanan [[t:anchor-log|lövbər jurnalı]] dərc edir: status siyahısı nəşrlərinin və sənəd növlərinin həşləri ardıcıllıqla buraya
yazılır.

**Zəif tərəfi:** siyahını tək bir operator imzalayır. Açıq jurnal və auditlər operatorun iki yoxlayan tərəfə iki fərqli siyahı
göstərməsini (ikili danışıq) çəkindirir, amma onu qeyri-mümkün etmir.

## Zəncirli rejim: ortaq reyestr

Ortaq reyestr dövlətlərin və müstəqil operatorların birlikdə işlətdiyi icazəli blokçeyndir: Hyperledger Besu, QBFT konsensusu.
İki şey əlavə edir ([[ADR-0051]], [[ADR-0053]], [[ADR-0055]]):

- **Müstəqil şahidlik.** Siyahı versiyasının həşi yalnız hədd sayda müstəqil operator eyni həşi göndərdikdə "təsdiqlənmiş" olur.
  Tək operator təsdiqlənmiş həş yarada bilməz; iki fərqli həş zəncirdə hamının gözü önündə ziddiyyət hadisəsi kimi görünür.
- **Kodda idarəetmə.** Üzvlük, ortaq sənəd növləri və yeniləmələr dövlətlərin 2/3 səsi ilə; yeniləmədə 7 gün gözləmə.

Zəncirə **yalnız həşlər və qapalı çoxluq dəyərləri** yazılır: siyahı versiyasının həşi, qeydlərin həşləri, barmaq izləri,
tarixlər, vəziyyətlər. Şəxsi məlumat, sənəd, sənədin həşi, ləğv biti və sərbəst mətn zəncirə heç vaxt düşmür; status siyahıları
zəncirdən kənarda qalır ([[ADR-0008]], [[ADR-0074]]).

**Nə vaxt açılır?** Ən azı iki müstəqil operator validator işlətməyi yazılı şəkildə qəbul etdikdə və dizayn müstəqil təhlükəsizlik
auditindən keçdikdə ([[ADR-0009]] K4). Bir operatorun zənciri bir operatorun imzaladığı siyahıdan artıq etibar yaratmır.

## İki rejim necə sinxron qalır?

İki rejimin eyni şeyi deməsi dörd mexanizmə əsaslanır.

```text
qeyd reyestri ──trust:build──▶ imzalanmış siyahılar (lotl, tl-<cc>) ──▶ açıq nəşr
                                   │
                                   ├──▶ lövbər jurnalı (saatlıq imzalanmış sətir, həşlər)
                                   │
                                   └──trust:chain-submit──▶ siyahı lövbəri reyestri (zəncir; yalnız həş)
                                                            hədd sayda müstəqil operator eyni həşi göndərdikdə "təsdiqlənmiş"
```

### 1. Tək mənbə: siyahı

Bütün dəyişikliklər əvvəlcə imzalanmış siyahıya daxil olur. Zəncir siyahının **proyeksiyasıdır**, mənbəyi deyil: ziddiyyətdə
siyahı üstündür və zəncirin cavabı yoxlama üçün heç vaxt tələb olunmur ([[ADR-0051]] CH1). Zəncir açıldıqdan və keçid
tamamlandıqdan sonra da bu qayda qüvvədədir; zənciri bir gün mənbə etmək ayrıca qərar tələb edir ([[ADR-0073]] K6).

### 2. Eyni identifikatorlar

İdentifikatorlar əvvəldən zəncir düsturu ilə hesablanır; buna görə siyahıda və zəncirdə eynidir ([[ADR-0009]], [[ADR-0073]] K4):

| İdentifikator | Düstur |
|---|---|
| Qurum (`issuer_id`) | `keccak256(ölkə kodu, sha256(sertifikat))` |
| Sənəd növü (`schema_id`) | `keccak256(vct)` |
| Yoxlayan tərəf (`rpId`) | `keccak256(dns_name)` |

Zəncir açıldıqda heç bir qurumun identifikatoru dəyişmir, heç bir sənəd yenidən verilmir.

### 3. Hər nəşrdə lövbər

Siyahı nəşriyyatçısı hər yeni siyahı versiyasının həşini (versiya, məzmun həşi, əvvəlki həş, nəşr vaxtı) və lövbər jurnalının son
sətrinin həşini zəncirdəki siyahı lövbəri reyestrinə yazır (`trust:chain-submit`). Eyni versiya üçün eyni həş ikinci dəfə
yazılmır; təsdiqlənmiş versiya üçün fərqli həş gələrsə yazılmır və operatora ziddiyyət bildirilir. Siyahıdakı hər etibar qeydinin
(qurum, yoxlayan tərəf, sənəd növü, cüzdan provayderi, keçid qrupu…) zəncirdə qarşılığı var; yalnız həş və qapalı çoxluq dəyəri
kimi ([[ADR-0074]]).

Yoxlayan tərəfdə `trust:chain-check` siyahının həşinin zəncirdə təsdiqlənib-təsdiqlənmədiyini soruşur: **bəli**, **xeyr**
(fərqli həş: ikili danışıq əlaməti, həyəcan siqnalı) və ya **naməlum** (zəncir söndürülüb, əlçatmazdır və ya hədd dolmayıb). Bu
yoxlama yoxlama nəticəsini pisləşdirmir.

### 4. Keçiddə təkrar oynatma və ekvivalentlik testi

Zəncir açıldıqda siyahıların bütün tarixçəsi kontraktlara **bir dəfə** təkrar oynadılır (`trust:chain-replay`), siyahıdakı
tarixlərlə ([[ADR-0073]]):

- Dövlətlər 2/3 səslə **miqrasiya pəncərəsi** açır. Təklif açıq arxivdən yaradılan oynatma planının həşini daşıyır; hər kəs planı
  yenidən yaradıb müqayisə edə bilər.
- Pəncərə ən çox 30 gün açıq qalır və bağlandıqdan sonra bir daha açıla bilməz.
- Oynatmanın sonunda **ekvivalentlik testi** işləyir: eyni suallar həm siyahıya, həm zəncirə verilir. Suallar bunlardır: bu qurum
  həmin tarixdə etibarlı idimi, bu sənəd növünü həmin tarixdə verə bilərdimi, bu ölkə həmin qurumu tanıyırmı, bu siyahı
  versiyasının həşi nədir? Hər qeydə alınmış an və hər sərhəd anı (bir saniyə əvvəl, tam həmin an, bir saniyə sonra) soruşulur.
- **Qəbul və rədd cavablarında tək bir fərq belə olarsa miqrasiya bağlanmır.**

Sandbox (test şəbəkəsi) zəncirə yazılmır və təkrar oynadılmır ([[ADR-0074]] K7).

## Kim üçün nə dəyişir?

| Kim | Zəncirsiz rejim (bu gün) | Zəncir açılanda |
|---|---|---|
| **Sənədi verən qurum** | Siyahıya qeyd, qurum sertifikatı, sənəd vermə | **Heç nə.** Eyni identifikator, eyni sertifikat, eyni xidmət; verilmiş sənədlər etibarlı qalır |
| **Yoxlayan tərəf** | Etibar məlumatını `TrustSource` ilə siyahıdan oxuyur, kökü sabitləyir | **Məcburi heç nə yoxdur.** İstəsəniz zəncir yoxlaması əlavə olunur; nəticə pisləşmir |
| **Rəqəmsal cüzdan** | Siyahını və status siyahılarını əvvəlcədən endirir | **Heç nə** |
| **Dövlət** | Öz milli siyahısını idarə edir və ya Tamga-nın vəkalətən idarə etdiyi siyahını təhvil alır | Siyahını idarə etməyə **davam edir** (mənbə siyahı qalır). Əlavə olaraq validator qovşağı işlədir, milli qeydlərinin zəncirdəki qarşılığını öz açarları ilə yazır, idarəetmədə səs verir |
| **Şəbəkə operatoru** | LOTL-u imzalayır, lövbər jurnalını və siyahıları dərc edir | Əlavə olaraq siyahı həşlərini zəncirə yazır, şəbəkə səviyyəli qeydləri idarəetmə təklifi ilə yazır |

Qısaca: **qurum, yoxlayan tərəf və rəqəmsal cüzdan üçün iki rejim eynidir.** Dəyişən dövlətin və operatorların işidir: milli
siyahı bu gün də idarə olunur; zəncir açılanda yanına bir qovşaq əlavə olunur.

## Hansı bələdçi kimə?

| Nə edirsiniz? | Zəncirsiz rejim (bu gün) | Zəncirli rejim |
|---|---|---|
| Saytınıza "Tamga ilə daxil ol" əlavə etmək | [[GUIDE-0001]] | eyni |
| Öz serverinizdə sənəd yoxlamaq | [[GUIDE-0002]] | eyni; zəncir yoxlaması istəyə bağlı ([[GUIDE-0006]] §5) |
| Qurumunuzu şəbəkədə qeydiyyatdan keçirmək (İT addımları daxil) | [[GUIDE-0007]], [[GUIDE-0014]] | eyni |
| Host edilən xidmətlə sənəd vermək | [[GUIDE-0003]] | eyni |
| Öz sənəd vermə serverinizi qurmaq | [[GUIDE-0003]] § Ətraflı: öz xidmətiniz, işlək kod [[GUIDE-0004]], protokol [[SPEC-PROTO-0001]]; qeydiyyat və açar idarəetməsi şəbəkə operatoru ilə razılaşdırılır | eyni |
| Yoxlayan tərəf kimi qeydiyyatdan keçmək | [[GUIDE-0008]] | eyni |
| Etibar siyahılarını oxumaq, öz nüsxənizi saxlamaq | [[GUIDE-0006]] | [[GUIDE-0006]] §5 |
| Ölkənizin siyahısını şəbəkəyə qoşmaq (LOTL qeydi) | [[GUIDE-0011]] | eyni; siyahı mənbə qalır |
| Milli etibar siyahısını idarə etmək (quraşdırma) | [[GUIDE-0017]] | [[GUIDE-0017]] § Zəncir açıq olduqda |
| Qovşaq və ya validator işlətmək | — | [[GUIDE-0015]] (təlimat); test şəbəkəsinin quraşdırılması: `guides/chain-testnet.md` |
| Başdan sona sınamaq | [[GUIDE-0013]] (sandbox) | sandbox zəncirə yazılmır; yerli inkişaf zənciri: [[GUIDE-0015]] § Yerli sınaq |

## Terminlər

| Termin | Mənası |
|---|---|
| [[t:LOTL]] (List of Trusted Lists) | Siyahılar siyahısı: hər ölkə siyahısının ünvanını, imzalayanını və əhatəsini daşıyır. Tamga-da `lotl.jws` |
| [[t:trust-list]] (trust list) | Ölkənin kök sertifikatlarını, sənədi verən qurumlarını və yoxlayan tərəflərini daşıyan imzalanmış siyahı. Tamga-da `tl-<cc>.jws` |
| [[t:issuer]] (issuer) | Şəxsə rəqəmsal sənəd verən qurum: universitet, xəstəxana, bilet satıcısı |
| [[t:verifier]] (verifier) | Sənədi şəxsdən istəyən və yoxlayan tərəf: işəgötürən, veb-sayt, tədbir keçidi |
| Cüzdan vahidi ([[t:wallet-unit]]) | Şəxsin cihazındakı tək cüzdan quraşdırması; cüzdan provayderi ona attestasiya verir |
| [[t:anchor-log]] | Siyahı operatorunun saatlıq imzaladığı, yalnız həş daşıyan, yalnız əlavə edilə bilən açıq jurnal |
| Lövbər (anchor) | Bir məlumatın həşinin dəyişdirilə bilməyən qeydə yazılması; məlumatın sonradan dəyişmədiyi bu həşlə göstərilir |
| [[t:ledger]] (ledger) | Bir neçə müstəqil operatorun birlikdə saxladığı qeyd; Tamga-da icazəli Besu zənciri |
| Qovşaq (node) | Ortaq reyestrin nüsxəsini işlədən server. Tam qovşaq zənciri yoxlayır və oxuyur, imzalamır |
| [[t:validator]] | Blok təklif edən və imzalayan qovşaq; Tamga-da hər üzv dövlətin bir validatoru olur |
| enode | Besu qovşağının şəbəkə ünvanı: qovşağın açıq açarı + IP ünvanı + port (`enode://<açıq açar>@<ip>:30303`) |
| QBFT | Besu-nun konsensus üsulu: validatorlar hər bloka səs verir; n validatorda ən çox ⌊(n−1)/3⌋ nasazlığa davam gətirir |
| Genesis | Zəncirin ilk bloku və başlanğıc parametrləri (zəncir identifikatoru, ilk validatorlar); bütün qovşaqlarda eyni olmalıdır |
| Bootnode | Yeni qovşağın şəbəkəyə ilk qoşulduğu, həmyaşıdlarının ünvanlarını öyrəndiyi qovşaq |
| İcazəli şəbəkə (permissioned) | Yalnız icazə siyahısındakı qovşaqların qoşula bildiyi, yalnız icazəli hesabların əməliyyat göndərə bildiyi şəbəkə |
| İdarəetmə (governance) | Şəbəkə qərarlarının (üzvlük, ortaq sənəd növləri, yeniləmə, miqrasiya pəncərəsi) necə qəbul edildiyi; zəncirdə dövlətlərin 2/3 səsi ilə |
| Proyeksiya | Zəncirdəki qeydlərin imzalanmış siyahılardan törədilməsi; mənbə siyahı qalır |
| Ekvivalentlik testi | Eyni sualların siyahıya və zəncirə verilib cavabların müqayisə edilməsi; fərq olarsa keçid tamamlanmır |

## Qaydalar

| Kod | Nə deyir |
|---|---|
| [[ADR-0009]] K4 | Ortaq reyestr ən azı iki müstəqil operatorun yazılı razılığı olmadan qurulmur |
| [[ADR-0051]] CH1 | Zəncir siyahının proyeksiyasıdır; ziddiyyətdə siyahı üstündür; zəncirin cavabı yoxlama üçün lazım deyil |
| [[ADR-0051]] CH2 | Siyahı lövbərinə yalnız həş yazılır; məzmun, sənəd və ya şəxsi məlumat yazılmır |
| [[ADR-0051]] CH3 | Lövbər yalnız hədd sayda müstəqil yazıcı eyni məlumatı göndərdikdə təsdiqlənir; istehsalda hədd ən azı 2-dir |
| [[ADR-0073]] CE6 | Ekvivalentlik testində qəbul/rədd fərqi qalmayınca miqrasiya bağlanmır |
| [[ADR-0074]] PJ4 | Sandbox siyahıları istehsal zəncirinə yazılmır |

Siyahı operatoru və ortaq reyestr qaydaları: [Tamga ARF — Tamga Rulebook, RB-OP](https://arf.tamga.network/az/rulebook).
