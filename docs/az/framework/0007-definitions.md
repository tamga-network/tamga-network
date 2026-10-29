---
document_id: FW-DEF-0001
title: "Əlavə D — Təriflər"
status: Active
version: 1.0.0
created: 2026-10-01
last_updated: 2026-10-16
summary: >
  Tamga ARF-də istifadə olunan terminlərin və qısaltmaların tərifləri. Avropa İttifaqı (Aİ) ARF-inin təriflər əlavəsinin qarşılığıdır; Aİ-dəki ad ilə Tamga-dakı qarşılığı birlikdə verilir.
translation_of: FW-DEF-0001
source_version: "1.0.0"
---

# 1. Terminlər

| Termin | Tərif |
|---|---|
| Açar sübutu (Key Attestation, KA) | Cüzdan provayderinin, rəqəmsal sənədin bağlanacağı açarların cihazın təhlükəsiz aparat hissəsində yaradıldığını və qorunduğunu bəyan edən qısamüddətli imzalı sənədi; sənədi verən qurum rəqəmsal sənədi verməzdən əvvəl onu yoxlayır. |
| Vasitəçi yoxlayan tərəf (Intermediary) | Yoxlayan tərəf adından rəqəmsal cüzdandan rəqəmsal sənəd tələb edən və onu yoxlayan xidmət. Rəqəmsal cüzdan əsl yoxlayan tərəfin adını göstərir. Tamga-da bu, Tamga Verify-dır. |
| Rəqəmsal sənəd (elektron atribut sənədi, EAA) | Sənədi verən qurumun şəxs haqqında imzaladığı və şəxsin rəqəmsal cüzdanında saxlanılan sənəd: tələbə arayışı, diplom, bilet kimi. |
| Sənəd sahibi (Holder) | Rəqəmsal sənədi öz rəqəmsal cüzdanında saxlayan və onu kimə göstərəcəyinə qərar verən şəxs. |
| Rəqəmsal sənəd növü | Rəqəmsal sənədin sahələrini, görünən adlarını və seçici paylaşım siyasətini müəyyən edən, daimi identifikatoru olan tərif (`urn:tamga:…`). |
| Rəqəmsal sənəd növləri kataloqu | Sənəd növü təriflərinin və sxemlərinin dəyişməz fayllar kimi dərc edildiyi yer (`schemas.tamga.network`). |
| Sənədi verən qurum (Attestation Provider) | Rəqəmsal sənədi verən qurum: universitet, peşə təşkilatı, dövlət qurumu, şirkət. |
| Cihaz sübutu | Telefonun əməliyyat sisteminin, açarın cihazın təhlükəsiz zonasında yaradıldığını və tətbiqin dəyişdirilmədiyini təsdiqləyən imzalı bəyanatı (Apple App Attest, Android key attestation). |
| Rəqəmsal cüzdan | Şəxsin rəqəmsal sənədlərini saxlayan və göstərən tətbiq. Şəbəkənin qaydalarına uyğun hər rəqəmsal cüzdan şəbəkədə istifadə oluna bilər; Tamga Wallet şəbəkənin ilk rəqəmsal cüzdanıdır. |
| Cüzdan vahidi (Wallet unit) | Rəqəmsal cüzdanın müəyyən cihazdakı quraşdırılması. |
| Cüzdan nümunəsi sübutu (Wallet Instance Attestation, WIA) | Cüzdan provayderinin cüzdan vahidi üçün imzaladığı, ən çoxu 24 saat etibarlı bəyanat: cüzdan versiyası, açarın aparat hissəsində olması, PIN və ya biometriyanın aktiv olması. Sənədi verən qurum rəqəmsal sənədi verməzdən əvvəl onu yoxlayır. |
| Cüzdan provayderi | Rəqəmsal cüzdanı təqdim edən, cüzdan vahidlərini qeydiyyata alan və cüzdan nümunəsi sübutunu və açar sübutunu imzalayan təşkilat. |
| Lövbər jurnalı | Ləğv siyahısı dərclərini və sənəd növü təriflərinin heş dəyərlərini saatlıq imzalı qeydlərlə saxlayan, hamıya açıq jurnal. |
| Reyestr mərhələsi | Etibar qeydlərinin bir neçə müstəqil operatorun apardığı ortaq reyestrə köçürüldüyü mərhələ. Ən azı iki müstəqil operator yazılı razılıq verdikdə başlayır. |
| Yoxlama xətti | Yoxlayan tərəfin təqdimatı yoxladığı sabit addımlar: ilkin şərt, struktur, növ, etibar, status, siyasət. Nəticə qəbul, rədd və ya "hazırda yoxlanıla bilmədi" olur. |
| Yoxlayan tərəf (Relying Party) | Rəqəmsal cüzdandan rəqəmsal sənəd tələb edən və onu yoxlayan, qeydiyyatdan keçmiş təşkilat: işəgötürən, veb-sayt, qurum. |
| Giriş sertifikatı | Yoxlayan tərəfin sorğularını imzaladığı X.509 sertifikatı; müştəri identifikatoru bu sertifikatın heş dəyəridir. |
| Federasiya | Ölkə etibar siyahılarının öz sahibləri tərəfindən idarə olunduğu və siyahıların siyahısında bir araya gətirildiyi model. |
| Müvəqqəti operator | İdarəetmə qurumu yaradılana qədər şəbəkəni və şəbəkənin öz xidmətlərini idarə edən hüquqi şəxs. Bu gün: Tamga Network (yaradılacaq fond) adından müvəqqəti operator: BROS İNŞAAT SANAYİ VE DIŞ TİCARET LİMİTED ŞİRKETİ. Siyahılarda operatorun adı "Tamga Network" yazılır (`status = "provisional"`). Fond yaradıldıqda operatorluq ona ötürülür. |
| Keçid kartı | Yaxın məsafədə təqdimatın daimi həlli tətbiq olunana qədər istifadə edilən, qısamüddətli və əhatəsi məhdud rəqəmsal sənəd təqdimatı. |
| Etibar siyahısı | Bir ölkənin kök sertifikatlarını, sənədi verən qurumlarını və qeydiyyatdan keçmiş yoxlayan tərəflərini əhatə edən imzalı siyahı. |
| Etibar siyahısı operatoru (Trusted List Scheme Operator) | Milli etibar siyahısını tərtib edən, imzalayan və dərc edən təşkilat. Bu gün Türkiyə üçün dövlət adından müvəqqəti olaraq Tamga. |
| Təminat səviyyəsi | Şəxsin identifikasiyasının (T), sənədi verən qurumun akkreditasiyasının (I) və rəqəmsal cüzdanın təhlükəsizliyinin (W) səviyyəsi. |
| Qeydiyyat orqanı (Registrar) | Sənədi verən qurumları, yoxlayan tərəfləri və cüzdan provayderlərini qeydiyyata alan təşkilat; hüquqi səlahiyyət vermir. |
| Qeydiyyat sertifikatı | Qeydiyyat orqanının yoxlayan tərəfin hər istifadə halı üçün (sənədi verən qurumlarda isə qurum başına) yaratdığı, tələb oluna bilən sahələri və məqsədi əks etdirən imzalı sənəd (ən çoxu 12 ay). |
| Şəxsiyyət sənədi (Tamga) | Şəxsin identifikasiya məlumatları provayderi olmadıqda Tamga şəxsiyyət xidmətinin məsafədən identifikasiya ilə verdiyi müvəqqəti şəxsiyyət sənədi. PID deyil. |
| Şəxsin identifikasiya məlumatları (PID) | Dövlətin ən yüksək təminat səviyyəsində verdiyi şəxsin identifikasiya məlumatları. Tamga bu rolu öz üzərinə götürmür. |
| Nüsxə | Eyni rəqəmsal sənədin ayrı açarlara bağlı nüsxələrindən biri; rəqəmsal cüzdan hər yoxlayan tərəfə ayrı nüsxə göstərir. |
| Siyahı mərhələsi | Etibarın imzalı etibar siyahılarına və lövbər jurnalına əsaslandığı hazırkı mərhələ. |
| Siyahıların siyahısı (LoTL) | Ölkə etibar siyahılarının ünvanlarını, imzalayanlarını və tanınma statuslarını göstərən imzalı siyahı. |
| Ortaq reyestr | Etibar qeydlərinin bir neçə müstəqil operator tərəfindən aparıldığı reyestr (blokçeyn). Reyestr mərhələsində yaradılır. |
| Seçici paylaşım (Selective disclosure) | Şəxsin rəqəmsal sənəddən yalnız tələb olunan sahələri göstərməsi. |
| Sıfır bilik sübutu | Bir məlumatın doğru olduğunu məlumatın özünü göstərmədən təsdiqləyən sübut; məsələn, doğum tarixini göstərmədən "18 yaşdan böyüyəm". |
| Psevdonim | Rəqəmsal cüzdanın hər veb-sayt üçün ayrıca yaratdığı, sabit, lakin saytlar arasında uyğunlaşdırıla bilməyən hesab identifikatoru. |
| Psevdonim toxumu | Şəxsiyyət xidmətinin şəxsin kimliyindən onu saxlamadan törətdiyi və yalnız rəqəmsal cüzdanda qalan gizli dəyər; psevdonimlər bundan törədilir. Göstərilə bilməyən ayrıca sənəd növü ilə verilir. |
| Tamga Network | Bu çərçivənin müəyyən etdiyi etibar şəbəkəsi: qaydalar, etibar siyahıları, rəqəmsal sənəd növləri kataloqu və açıq mənbəli paketlər. Şəbəkə məhsul satmır. |
| Tamga Verify | Şəbəkənin hostinq edilən yoxlayan tərəfi (vasitəçi yoxlayan tərəf). |
| Tamga Wallet | Şəbəkənin ilk rəqəmsal cüzdanı; ayrıca məhsuldur və açıq mənbəlidir. Şəbəkənin qaydalarına hər rəqəmsal cüzdan kimi əməl edir. |
| Səlahiyyətli mənbə | Rəqəmsal sənəddəki məlumatın əsl sahibi olan sistem; məsələn, universitetin tələbə informasiya sistemi. |
| İdarəetmə qurumu | Dövlətlər qoşulduqda yaradılan şura və ya fond; siyahıları və şəbəkə qaydalarını idarə edir. |

# 2. Qısaltmalar

| Qısaltma | Açılışı |
|---|---|
| ARF | Architecture and Reference Framework — Memarlıq və İstinad Çərçivəsi |
| DCQL | Digital Credentials Query Language |
| EAA | Electronic Attestation of Attributes — elektron atribut sənədi |
| EUDI | European Digital Identity — Avropa Rəqəmsal Şəxsiyyəti |
| HAIP | OpenID4VC High Assurance Interoperability Profile |
| KA | Key Attestation — açar attestasiyası |
| KVKK | 6698 saylı Fərdi Məlumatların Qorunması Haqqında Qanun |
| LoTL | List of Trusted Lists — siyahıların siyahısı |
| mdoc | ISO/IEC 18013-5 mobil sənəd formatı |
| PID | Person Identification Data — şəxsiyyət məlumatları |
| SD-JWT VC | Selective Disclosure JWT Verifiable Credential |
| TDT | Türk Dövlətləri Təşkilatı |
| WIA | Wallet Instance Attestation — cüzdan nümunəsi attestasiyası |
| WRPAC / WRPRC | Yoxlayan tərəfin giriş sertifikatı / qeydiyyat sertifikatı |
| WSCD | Wallet Secure Cryptographic Device — rəqəmsal cüzdanın təhlükəsiz kriptoqrafik qurğusu |

# Status

**Qüvvədədir** — versiya 1.0.0 (2026-10-16).
