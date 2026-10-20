---
document_id: ADR-0042
title: "Şəbəkə və rəqəmsal cüzdanlar: şəbəkə cüzdan idarə etmir"
status: Active
version: 1.0.0
created: 2026-10-06
last_updated: 2026-10-07
summary: >
  Tamga Network müstəqil bir şəbəkədir (gələcəkdə fond); heç bir rəqəmsal cüzdanın tətbiqini, cüzdan provayderini və ya saytını idarə etmir. Şəbəkə qaydaları, etibar siyahılarını, açıq paketləri və ümumi xidmətləri (yoxlayan tərəf, şəxsiyyət xidməti, sandbox) təmin edir; rəqəmsal cüzdanı yalnız etibar siyahısındakı qeydi əsasında tanıyır. Tamga Wallet ayrıca layihədir və şəbəkəyə hər bir rəqəmsal cüzdanla eyni yolla daxil olur. Şəbəkənin domen adlarında rəqəmsal cüzdana aid xidmət işləmir; əvvəllər orada işləyən `wallet.tamga.network` və `wallet.sandbox.tamga.network` 2026-10-06 tarixində şəbəkədən çıxarıldı. Tamga Wallet-ın provayderini cüzdanın operatoru `provider.tamgawallet.com` üzərində idarə edir. Sandbox yeganədir və şəbəkəyə məxsusdur: rəqəmsal cüzdan tərtibatçıları öz cüzdanlarını orada sınaqdan keçirir, cüzdanın provayderini cüzdanın özü idarə edir və sandbox siyahısında qeydiyyatdan keçir. Şəbəkənin interfeysləri və rəqəmsal sənədləri tək bir rəqəmsal cüzdanı önə çıxarmır.
domain: Governance
translation_of: ADR-0042
source_version: "1.0.0"
---

# Qısaca

Tamga Network və Tamga Wallet iki ayrı strukturdur. Şəbəkə türk dünyası üçün qaydaları və etibar siyahısını saxlayan müstəqil strukturdur
(gələcəkdə fond). Tamga Wallet həmin qaydalara uyğun gələn rəqəmsal cüzdan tətbiqidir; şəbəkənin ilk cüzdanıdır, lakin şəbəkənin hissəsi deyil. Bu qərar
onların sərhədini müəyyənləşdirir: şəbəkə cüzdan idarə etmir, cüzdanları siyahıya alır.

# Kontekst

- [[ADR-0035]]: şəbəkə rəqəmsal cüzdanları qaydalara əsasən tanıyır, rəqəmsal cüzdan şəbəkəyə bağlı deyil. [[ADR-0037]]: şəbəkə yalnız şəbəkədir; məhsullar və
  xidmətlər başqa strukturlardadır.
- Tamga Wallet şəbəkə repozitoriyasının daxilində hazırlanmağa başlandı; tətbiq 2026-10-02 tarixində öz repozitoriyasına köçürüldü. Rəqəmsal cüzdanın backend hissəsi
  olan **cüzdan provayderi** ([[t:wallet-provider]]; vahid qeydiyyatı, cihaz sübutu, cüzdan vahidi sübutu WIA və açar sübutu KA —
  [[ADR-0025]]; uzaqdan söndürmə) rəqəmsal cüzdanın öz serveri və domen adı olmadığı üçün şəbəkənin serverində, şəbəkənin domen adı altında
  işləməyə davam etdi: `wallet.tamga.network` və sandbox-da `wallet.sandbox.tamga.network` ([[ADR-0038]]).
- Aİ strukturunda hər bir rəqəmsal cüzdanı onu təqdim edən qurum idarə edir (Wallet Provider); etibar çərçivəsi cüzdan provayderlərini yalnız siyahıya alır.
- Şəbəkənin bəzi interfeyslərində və rəqəmsal sənədlərində tək bir rəqəmsal cüzdanın adı sabit yazılmışdı ("Tamga Wallet-da açın" kimi).

# Qərar

**K1 — Şəbəkə cüzdan idarə etmir.** Tamga Network heç bir cüzdanın tətbiqini, cüzdan provayderini, saytını və ya dəstək
xidmətini idarə etmir və yerləşdirmir. Şəbəkənin cüzdanlarla əlaqəsi qaydalardan ([[SPEC-WALLET-0001]], ARF), açıq paketlərdən
(`@tamga-network/wallet-core`, `@tamga-network/zk` …) və etibar siyahısındakı cüzdan provayderi qeydindən (`wallet_providers[]`:
ünvan, imza sertifikatı, həll adı) ibarətdir. Tamga Wallet siyahıya digər cüzdanlarla eyni yolla daxil olur; heç bir imtiyazı yoxdur.

**K2 — Şəbəkənin domen adları şəbəkənin xidmətləri üçündür.** `tamga.network` və onun alt domenlərində yalnız şəbəkənin xidmətləri işləyir (siyahının
yayımlanması, yoxlayan tərəf, şəxsiyyət xidməti, sənədi verən qurumun istinad xidməti, Qurum Konsolu, sandbox, dokumentasiya, sayt). Cüzdana aid xidmət
şəbəkənin domen adında işləmir. **Keçid (2026-10-06 tarixində həyata keçirildi):** sistemdən hələ istifadə edən olmadığı üçün keçid müddəti gözlənilmədi;
layihə rəhbərliyinin qərarı ilə `wallet.tamga.network` və `wallet.sandbox.tamga.network` dərhal şəbəkədən çıxarıldı, kod şəbəkə repozitoriyasından
silindi. Tamga Wallet-ın provayderini cüzdanın operatoru `https://provider.tamgawallet.com` ünvanında idarə edir (hələ canlı
deyil); etibar siyahılarındakı (real şəbəkə və sandbox) ünvan bu ünvanla yeniləndi.

**K3 — Sandbox yeganədir və şəbəkəyə məxsusdur.** Sandbox ([[ADR-0038]]) cüzdan, qurum və yoxlayan tərəf tərtibatçılarının şəbəkənin qaydalarını
sınaqdan keçirdiyi yeganə test mühitidir; ayrıca "cüzdan sandbox-u" qurulmur. Sandbox-da da cüzdan provayderini cüzdan idarə edir: cüzdan
tərtibatçısı öz provayderini sandbox siyahısında qeydiyyatdan keçirir və cüzdanını sandbox-dakı nümunə qurumlarla, şəxsiyyət xidməti və
yoxlayan tərəflə sınaqdan keçirir. Tamga Wallet-ın provayderi həm real şəbəkə, həm də sandbox siyahısında qeydiyyatdadır. Hazırda qeydiyyat layihə rəhbərliyinin
təsdiqi ilə əl ilə aparılır; cüzdan provayderlərinin özünüqeydiyyatı ([[ADR-0038]] K7-nin qalan hissəsi) ayrıca qərar tələb edir.

**K4 — Şəbəkə tək bir rəqəmsal cüzdanı önə çıxarmır.** Şəbəkənin interfeysləri, paketləri və rəqəmsal sənədləri rəqəmsal cüzdanı ümumi adla qeyd edir ("rəqəmsal cüzdanınızda açın");
rəqəmsal cüzdanın adı lazım olduqda etibar siyahısındakı qeyd məlumatlarından götürülür. Şəbəkənin saytında Tamga Wallet "şəbəkənin ilk rəqəmsal cüzdanı" kimi
qeyd oluna bilər; rəqəmsal cüzdanın təqdimatı onun öz saytındadır.

**K5 — Test sertifikatları ümumidir.** Şəbəkənin öz testləri və tərtibat PKI-si ümumi "test cüzdan provayderi"
sertifikatından istifadə edir. Real cüzdan provayderinin açarını cüzdan özü yaradır və saxlayır; şəbəkə yalnız onun sertifikatını siyahıya alır.

**K6 — Şəbəkənin ümumi xidmətləri hamı üçün açıqdır.** Şəxsiyyət xidməti ([[ADR-0011]]) və mağaza yoxlaması kodu ([[ADR-0033]]) şəbəkənin
xidmətləridir və siyahıdakı hər bir cüzdan üçün eyni şərtlərlə açıqdır.

# Dəyişməzlər

| Kod | Qayda |
|---|---|
| NW1 | Şəbəkə heç bir cüzdanın tətbiqini, cüzdan provayderini və ya saytını idarə etmir; cüzdanları yalnız etibar siyahısındakı qeydləri ilə tanıyır. |
| NW2 | Şəbəkənin domen adlarında cüzdana aid xidmət işləmir. |
| NW3 | Sandbox yeganə test mühitidir; sandbox-da cüzdan provayderini cüzdan idarə edir və o, sandbox siyahısında qeydiyyatdan keçir. |
| NW4 | Şəbəkənin interfeysləri və paketləri cüzdan adını sabit yazmır; lazım olduqda onu etibar siyahısındakı qeyd məlumatlarından götürür. |

# Əsaslandırma / alternativlər

| Seçim | Nəticə | Səbəb |
|---|---|---|
| Şəbəkə Tamga Wallet-ın provayderini idarə etməyə davam edir | rədd | Şəbəkənin neytrallığı pozulur ([[ADR-0035]]); fonda təhvil verildikdə cüzdanın xidməti şəbəkədən asılı qalır; Aİ strukturuna uyğun gəlmir. |
| Cüzdan üçün ayrıca sandbox | rədd | Eyni qurumlar, yoxlayan tərəf və qaydalar iki dəfə qurulur; cüzdan tərtibatçısı şəbəkənin real qaydalarını bir yerdə sınaqdan keçirməlidir. |
| **Şəbəkə siyahıya alır, cüzdan idarə edir; sandbox yeganədir** | **qəbul** | Aİ çərçivəsi ilə eyni rol bölgüsü; hər cüzdan eyni yolla daxil olur. |

# Nəticələr

- Cüzdan provayderinin kodu Tamga Wallet repozitoriyasına köçürüldü (`provider/`); şəbəkə repozitoriyasındakı nüsxə 2026-10-06 tarixində silindi. Şəbəkə
  serverindəki `tamga-wallet-provider` və `tamga-sandbox-wallet-provider` servisləri, nginx blokları və DNS qeydləri şəbəkədən
  çıxarılır. Etibar siyahılarındakı Tamga Wallet qeydi cüzdanın operatoru və `https://provider.tamgawallet.com` ünvanı ilə
  yeniləndi; operator canlı rejimə keçərkən öz cüzdan provayderi sertifikatını təqdim edir.
- Şəbəkənin interfeyslərindəki sabit cüzdan adları ümumi ifadə ilə əvəz olunur; siyahı naşiri cüzdan provayderinin adını qeyd məlumatlarından götürür.
- Növbəti iş (ayrıca qərar): sandbox-da cüzdan provayderlərinin özünüqeydiyyatı və cüzdan tərtibatçısının ünvanını təqdim etdiyi,
  sandbox-un cüzdanı qaydalara qarşı avtomatik yoxladığı uyğunluq testi.

# Status

**Accepted — 2026-10-06** (layihə rəhbərliyinin təsdiqi; hərfi sitat xüsusi təsdiq qeydindədir). DECISIONS: D-GOV-9. [[ADR-0038]] sənədində
sandbox-un test cüzdan provayderini şəbəkənin işlətdiyi hissə dəyişir (K3).

**Tətbiq qeydi (2026-10-07, layihə rəhbərliyi):** Tamga Wallet-ın provayderi (`TAMGA-WP-1`) həm real, həm də sandbox siyahısında
eyni qeydlə yer alır (eyni operator, eyni ünvan `https://provider.tamgawallet.com`, operator sertifikatını təqdim edənədək
`RESERVED`); ayrıca cüzdan sandbox-u və sandbox üçün xüsusi ikinci provayder qeydi yoxdur. Sandbox siyahısındakı şəbəkənin öz test açarı
(`TAMGA-SANDBOX-TEST-WP`, K5) dəyişmir. Operator sertifikatını təqdim etdikdə eyni sertifikat hər iki siyahıya daxil olur; siyahı naşirinin
"real sertifikat sandbox siyahısına daxil olmur" yoxlaması ([[ADR-0038]] SB1) həmin gün cüzdan provayderi sertifikatları üçün ayrıca nəzərdən
keçirilir.
