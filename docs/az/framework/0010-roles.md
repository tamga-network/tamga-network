---
document_id: FW-ROLE-0001
title: "Rollar"
status: Active
version: 1.0.0
created: 2026-10-02
last_updated: 2026-10-16
summary: >
  Tamga Network-dakı rolların təfərrüatı: operator və siyahı operatoru, qeydiyyat orqanı, sənədi verən qurum, səlahiyyətli mənbə, yoxlayan tərəf, cüzdan provayderi, şəxs, dövlət və auditor. Hər rol üçün onun nə etdiyi, bu gün onu kimin icra etdiyi, hansı qaydalara (Tamga Rulebook) tabe olduğu və qoşulmaq üçün nəyə ehtiyac duyduğu.
translation_of: FW-ROLE-0001
source_version: "1.0.0"
---

# 1. Ümumi baxış

Əsas sənədin 3-cü bölməsi rolları cədvəldə müəyyən edir; bu səhifə hər rolu ətraflı izah edir. Məcburi qaydalar Tamga
Rulebook-dadır (Əlavə B); burada hər rolun hansı qaydalar qrupuna tabe olduğu göstərilir. Bir qurum bir neçə rolu öz üzərinə götürə bilər
(məsələn, bilet satıcısı həm sənədi verən qurum, həm də yoxlayan tərəfdir); hər rol üçün ayrıca qeydiyyatdan keçir və həmin rolun qaydalarına ayrı-ayrılıqda əməl edir.

İki əsas fərq bütün rollar üçün keçərlidir:

- **Qeydiyyat səlahiyyətləndirmə deyil.** Şəbəkədə qeydiyyatdan keçmək quruma sənəd vermək səlahiyyəti vermir; hüquqi səlahiyyət şəbəkədən kənardan gəlir
  (Əlavə A §1.2, G-A).
- **İmza açarı sahibində qalır.** Tamga yerləşdirdiyi heç bir xidmətdə qurumun imza açarını saxlamır (RB-OP-08).

| Rol | Bu gün kim | Qaydalar | Qoşulma |
|---|---|---|---|
| Operator və siyahı operatoru | Tamga, müvəqqəti operator | RB-OP | — |
| Qeydiyyat orqanı | Tamga, dövlət adından müvəqqəti olaraq | RB-REG | — |
| Sənədi verən qurum | Universitetlər, bilet satıcıları; Tamga şəxsiyyət xidməti (şəxsiyyət sənədi üçün, müvəqqəti) | RB-AP, RB-AP-ID | [[FW-ONB-0001]] §2 |
| Səlahiyyətli mənbə | Qurumların qeydiyyat sistemləri | RB-AS | Sənədi verən qurumun müqaviləsi ilə |
| Yoxlayan tərəf | İşəgötürənlər, veb-saytlar, giriş qapıları | RB-RP | [[FW-ONB-0001]] §3 |
| Cüzdan provayderi | Cüzdanı təqdim edən təşkilatlar (birincisi Tamga Wallet) | RB-WP | [[FW-ONB-0001]] §4 |
| Şəxs (sənəd sahibi) | Cüzdandan istifadə edən hər kəs | RB-H | Könüllü |
| Dövlət | Hələ yoxdur; hər üzv dövlət üçün yer ayrılıb | Əlavə A §1.6, §7 | [[FW-ONB-0001]] §5 |
| Auditor | Bu gün özünüqiymətləndirmə; dövlətlər qoşulduqda müstəqil təşkilatlar | Əlavə A §4 | — |

# 2. Operator və siyahı operatoru

**Nə edir.** Şəbəkənin ümumi infrastrukturunu idarə edir: siyahılar siyahısını və milli etibar siyahılarını tərtib edir, imzalayır və dərc edir;
anker jurnalını saatlıq imzalayır; sənəd növləri kataloqunu dəyişməz fayllar kimi dərc edir; şəffaflıq hesabatını hazırlayır; açıq
mənbəli paketləri dərc edir. Aİ-dəki qarşılığı etibar siyahısı operatorudur ([[t:TLSO]]).

**Bu gün kim.** Tamga Network, müvəqqəti operator kimi və hər milli siyahı üçün həmin dövlət adından (`status = "provisional"`,
`on_behalf_of`). Tamga Network (yaradılacaq fond) adından müvəqqəti operator: BROS İNŞAAT SANAYİ VE DIŞ TİCARET LİMİTED ŞİRKETİ. Fond yaradıldıqda operatorluq ona, milli siyahılar isə dövlətlərə ötürülür (Əlavə A §7).

**Öhdəliklər.** Əlavə B §2 (RB-OP-01…18): siyahıların versiya zənciri və dərc intervalı, ən azı iki növbəli imza sertifikatı,
kök barmaq izlərinin dərci, hamıya açıq dəyişikliklər jurnalı, imza açarlarını saxlamamaq, hostinq payı həddi, ümumiləşdirilmiş və
fərdi məlumatsız statistika, rüblük şəffaflıq hesabatı, domen adının qorunması, ötürülmə zamanı identifikatorların dəyişməməsi.

**Nəyə ehtiyac duyur.** Kök sertifikat mərasimi, KMS və ya HSM-də imza açarları, dərc infrastrukturu (etibar siyahıları,
kataloq), insidentlərə cavab qaydası.

**Sərhədi.** Operator qeydiyyat orqanı rolunu da icra etsə belə, qurumun sənəd məzmununa, fərdi məlumatlarına və ya imza açarına
çıxış əldə etmir; ümumi qeydlərdə fərdi məlumatlar yoxdur (RB-GEN-01).

# 3. Qeydiyyat orqanı

**Nə edir.** Sənədi verən qurumları, yoxlayan tərəfləri və cüzdan provayderlərini qeydiyyata alır; sənəd növü səlahiyyətlərini icazə siyahısı ilə
verir; yoxlayan tərəflərin əhatə dairəsini məlumatların minimallaşdırılması prinsipi ilə yoxlayır; yoxlayan tərəflər və sənədi verən qurumlar üçün
[[t:registration-certificate|qeydiyyat sertifikatı]] yaradır. **Qeydə alır, təsdiqləmir:** hüquqi səlahiyyəti yoxlamır, qeydə alır.

**Bu gün kim.** Tamga, Türkiyə üçün dövlət adından müvəqqəti olaraq. Ötürülmə zamanı qeydiyyat səlahiyyəti dövlətə keçir və Tamga artıq qeydiyyat
aparа bilmir (Əlavə A §7, addım 2).

**Öhdəliklər.** Əlavə B §3 (RB-REG-01…09): milli reyestrə yalnız sahibinin yazması, yeni sənədi verən qurumu yalnız aktiv kök
sertifikata bağlamaq, sənəd növü səlahiyyətinin standart olaraq bağlı olması, sertifikat dəyişdikdə xələf qeydi, çıxışın köhnə qeydləri
etibarsız etməməsi, qeydiyyat dəyişikliyini ən gec 5 iş günü ərzində həyata keçirmək.

**Nəyə ehtiyac duyur.** Qeydiyyat aləti, ayrıca qeydiyyat orqanı imza açarı (siyahılar siyahısında dərc olunur), müraciətlərə
baxılma prosesi.

# 4. Sənədi verən qurum

**Nə edir.** Şəxsə öz qeydlərindəki məlumatlara əsaslanan [[t:credential|rəqəmsal sənəd]] verir və lazım olduqda onu ləğv edir: universitet
tələbə sənədi və diplom, bilet satıcısı isə tədbir bileti verir. Sənədi öz açarı ilə imzalayır və ləğv siyahısını sabit
intervalla dərc edir. Aİ-dəki qarşılığı elektron atribut sənədi provayderidir (Attestation Provider).

**Bu gün kim.** Şəbəkəyə qoşulan qurumlar. Şəxsiyyət sənədi üçün Tamga şəxsiyyət xidməti, dövlətin PID provayderi təyin olunanadək
müvəqqəti sənədi verən qurumdur (Identity Rulebook).

**Öhdəliklər.** Əlavə B §4 (RB-AP-01…25): qurum sertifikatının milli kökə zəncirlənməsi, imza açarının qurumun
nəzarətində olması, sənəd verməzdən əvvəl cüzdan nümunəsi sübutunu ([[t:WIA]]) və açar sübutunu (KA) yoxlamaq, növün
tələb etdiyi autentifikasiya səviyyəsini təmin etmək, əməliyyat kodunu ayrıca kanalla göndərmək, uyğunlaşdırmada qarşılığı olmayan məlumat üçün
sənəd verməmək, ləğv siyahısını sabit intervalla dərc etmək, şəxsə "sənədiniz cüzdana əlavə edildi" bildirişi. Sənəd növünə xas
qaydalar Əlavə C-dədir.

**Nəyə ehtiyac duyur.** Hüquqi şəxs statusu və domen adı; milli kökə zəncirlənən X.509 sertifikatı; imza açarı (I3-də HSM və ya
e-Möhür); səlahiyyətli mənbəyə bağlantı; sənəd vermə proqram təminatı (öz proqramı və ya yerləşdirilmiş sənəd vermə xidməti — bu
halda da imza açarı qurumda qalır); qoşulma müqaviləsi və KVKK əlavələri (Əlavə A §5.1).

# 5. Səlahiyyətli mənbə

**Nə edir.** Sənəddəki məlumatın əsas qeydini saxlayır: universitetin tələbə məlumat sistemi, dövlət reyestri. Sənədi verən qurum məlumatı
buradan oxuyur.

**Bu gün kim.** Sənədi verən qurumların öz qeydiyyat sistemləri.

**Öhdəliklər.** Əlavə B §5 (RB-AS-01…04): sənədi verən qurumun müqaviləsində adı çəkilmək və məlumatların emalı müqaviləsi ilə bağlanmaq,
mənbə məlumatlarının sxemə uyğunlaşdırılmasını sənədləşdirmək, milli şəxsiyyət nömrəsini ümumi sxemlərə ötürməmək.

**Nəyə ehtiyac duyur.** Sənədi verən qurumla təhlükəsiz bağlantı və uyğunlaşdırma cədvəli (məsələn, proqramın ISCED-F kodu).

# 6. Yoxlayan tərəf (relying party)

**Nə edir.** Şəxsdən əməliyyat üçün lazım olan sənədi tələb edir və yoxlayır: işə müraciətdə diplom, endirimdə tələbə sənədi,
girişdə bilet, veb-sayta daxil olarkən psevdonim. Öz proqram təminatını işlədə bilər və ya yerləşdirilmiş yoxlama xidmətindən
([[t:intermediary|alət]], Tamga Verify) istifadə edə bilər.

**Bu gün kim.** Qeydiyyatdan keçən işəgötürənlər, veb-saytlar və tədbir girişləri.

**Öhdəliklər.** Əlavə B §7 (RB-RP-01…13, RB-RP-ID-01): qeydiyyatda olmaq və əhatə dairəsindən kənar sahə tələb etməmək, imzalı sorğu və
şifrələnmiş cavab, spesifikasiyadakı yoxlama zəncirini tam tətbiq etmək, "yoxlanıla bilmədi" nəticəsini imtina kimi qəbul etməmək, sahə
dəyərlərini loglara və nəticə obyektinə yazmamaq, veb-girişdə hesab açarı kimi hər sayt üçün ayrıca psevdonimdən istifadə etmək.

**Nəyə ehtiyac duyur.** Hüquqi şəxs statusu; hər istifadə üçün məqsəd və məxfilik siyasəti; [[t:access-certificate|giriş sertifikatı]]; qeydiyyat
sertifikatı; yoxlama proqram təminatı və aktual etibar siyahıları.

# 7. Cüzdan provayderi

**Nə edir.** Şəxsin sənədlərini saxladığı və təqdim etdiyi rəqəmsal cüzdanı təqdim edir; cüzdan vahidlərini qeydiyyata alır; hər əməliyyat üçün cüzdan nümunəsi
sübutunu (WIA) və açar sübutunu (KA) imzalayır; cüzdan həllində zəiflik aşkarlanarsa, sübutları ləğv edir. Şəbəkə cüzdan seçmir, tanıyır:
qaydalara əməl edən və uyğunluq testlərindən keçən hər cüzdan şəbəkədə işləyir. Cüzdan provayderini cüzdanı təqdim edən təşkilat idarə edir; şəbəkə
heç bir cüzdan provayderini idarə etmir, yalnız etibar siyahısına daxil edir.

**Bu gün kim.** Tamga Wallet: şəbəkənin ilk cüzdanı; ayrıca məhsuldur və açıq mənbəlidir. Provayder xidmətini cüzdanın
operatoru `provider.tamgawallet.com`-da idarə edir (işləkdir; etibar siyahısında `TAMGA-WP-1`, `ACTIVE`); şəbəkə yalnız siyahıya daxil edir. Tamga Wallet şəbəkənin qaydalarına hər bir cüzdan kimi əməl edir.

**Sandbox.** Cüzdan tərtibatçısı cüzdanını şəbəkənin yeganə test şəbəkəsi olan sandbox-da sınaqdan keçirir: öz cüzdan provayderini sandbox
siyahısına qeydiyyata saldırır, cüzdanını sandbox-dakı nümunə qurumlar, şəxsiyyət xidməti və yoxlayan tərəflə sınaqdan keçirir. Ayrıca cüzdan
sandbox-u yoxdur.

**Öhdəliklər.** Əlavə B §6 (RB-WP-01…13): açarların təhlükəsiz aparat təminatında yaradılması və ixrac edilə bilməməsi, proqram açarlı
cüzdana sənəd verilməməsi, hər təqdimatda PIN və ya biometriya, sahələrin bir-bir göstərildiyi təsdiq ekranı və həddindən artıq tələb
xəbərdarlığı, hər yoxlayan tərəf üçün ayrıca nüsxə, təqdimat jurnalının cihazda qalması, bərpa açarını saxlamamaq, versiya əsasında ləğv.

**Nəyə ehtiyac duyur.** Cihaz sübutu (Apple App Attest, Android key attestation), sübut imza açarı (siyahılar siyahısında
dərc olunur), cüzdan həlli bəyannaməsi, uyğunluq testləri, cüzdan provayderi müqaviləsi.

# 8. Şəxs (sənəd sahibi)

**Nə edir.** Sənədlərini cüzdanında saxlayır və kimə hansı sahələri göstərəcəyinə özü qərar verir.

**Hüquqları və öhdəlikləri.** Əlavə B §8 (RB-H-01…07): iştirak könüllüdür və razılıq istənilən an geri götürülə bilər; hər təqdimatda tələb olunan
sahələri görür və bir-bir təsdiqləyir; təqdimat jurnalı cihazında qalır; qlobal identifikatoru yoxdur; "sənədiniz cüzdana
əlavə edildi" bildirişinə etiraz edə bilər; PIN və cihaz təhlükəsizliyinə görə məsuliyyət daşıyır; şikayət yolu sənədi verən qurum, sxem sahibi və KVKK
Qurumudur.

**Nəyə ehtiyac duyur.** Təhlükəsiz aparat təminatı olan telefon və qaydalara əməl edən cüzdan.

# 9. Dövlət

**Nə edir.** Öz milli etibar siyahısının və qeydlərinin yeganə müəllifidir; qeydiyyat qurumu və siyahı operatoru funksiyalarını öz üzərinə götürür;
milli kök sertifikatı idarə edir; PID provayderini təyin edir. Şura yaradıldıqda üzvlərin qəbulu, ümumi rəqəmsal sənəd növləri və protokol
yeniləmələri üçdə iki səs çoxluğu ilə qərara alınır. Transsərhəd tanınma birtərəflidir.

**Bu gün kimdir.** Hələ qoşulmuş dövlət yoxdur; Türk Dövlətləri Təşkilatının üzvləri və müşahidəçiləri üçün yer ayrılıb. Türkiyənin
siyahısını bu gün Tamga dövlət adından müvəqqəti olaraq idarə edir.

**Qaydalar.** Əlavə A §1.6 (idarəetmə orqanları), §3.3 (dövlətin qoşulması və çıxışı), §7 (təhvil planı); əsas sənəd §8.

**Nəyə ehtiyac duyur.** Siyahı operatoru olacaq dövlət qurumu, kök sertifikat mərasimi, imza açarları və nəşr infrastrukturu.
Təhvil heç bir rəqəmsal sənədi, qeydi və ya şəxsiyyəti etibarsız etmir.

# 10. Auditor

**Nə edir.** İştirakçıların qaydalara əməl etdiyini qiymətləndirir: uyğunluğun qiymətləndirilməsi (I3 və kvalifikasiyalı rəqəmsal sənədlər üçün
əvvəlcədən), şikayət və ya insident əsasında audit, illik müstəqil audit.

**Bu gün kim.** Bu gün uyğunluq öz bəyanı və açıq uyğunluq testləri ilə nümayiş etdirilir; sxem sahibi və müvəqqəti akkreditasiya orqanı Tamga-dır.
Dövlətlər qoşulduqda milli akkreditasiya orqanı və uyğunluğun qiymətləndirilməsi üzrə müstəqil qurumlar bu rolu üzərinə götürür (Əlavə A §4.2).

**Qaydalar.** Əlavə A §4 (uyğunluq rejimi, ISO/IEC 17000 rolları, uyğunluq testləri, nəzarət, sanksiya pillələri, insidentlərə cavab);
Əlavə B §10 (RB-ENF).

**Nəyə ehtiyac duyur.** Uyğunluq test vektorları, dəyişikliklər jurnalı, şəffaflıq hesabatları, insident qeydləri və qayda mənbələri (Əlavə E §3).

# Status

**Qüvvədədir** — versiya 1.0.0 (2026-10-16).
