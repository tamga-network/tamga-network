---
document_id: GLOSSARY
title: "Lüğət"
status: Active
version: 1.0.0
last_updated: 2026-10-16
created: 2026-10-02
summary: >
  Tamga Network sənədlərində keçən terminlərin sadə dildə izahları. Məcburi təriflər Tamga ARF-in D Əlavəsindədir.
translation_of: GLOSSARY
source_version: "1.0.0"
---

# Lüğət

Bu səhifə sənədlərdə keçən terminləri sadə dillə izah edir; məcburi təriflər Tamga ARF-in D Əlavəsindədir ([[FW-DEF-0001]]) və
ziddiyyət olduqda o qüvvədədir.

**Terminlər necə yazılır?** Rollar və gündəlik anlayışlar Azərbaycan dilində yazılır, ingiliscə termin ilk istifadədə mötərizədə verilir:
rəqəmsal sənəd (credential), yoxlayan tərəf (verifier), etibar siyahısı (trust list). Texniki, kriptoqrafik və protokol terminləri, eləcə də
abbreviaturalar ingiliscə qalır: salted hash, selective disclosure, holder binding, PID, QTSP. Hər terminin yanındakı ⓘ işarəsinin
üzərinə gəldikdə (telefonda toxunduqda) qısa izah açılır.

<!-- TERMS:BEGIN — docs/.vitepress/terms.json'dan üretilir (npm run docs:sync); bu işaretler arasını elle düzenlemeyin -->

## Əsas anlayışlar

**ARF** (Architecture and Reference Framework) — Rolları, arxitekturanı, etibar modelini və qaydaları təsvir edən sənədlər toplusu. Tamga ARF Avropa İttifaqının (Aİ) ARF-inin quruluşunu izləyir.

**eIDAS** (electronic IDentification, Authentication and trust Services) — Aİ-nin elektron identifikasiya və etibar xidmətləri haqqında reqlamenti; eIDAS 2.0 Avropa Rəqəmsal Şəxsiyyət Cüzdanını təqdim edir.

**EUDI Wallet** — eIDAS 2.0-ın müəyyən etdiyi Avropa Rəqəmsal Şəxsiyyət Cüzdanı; Tamga eyni formatlardan və protokollardan istifadə edir.

**Federasiya** (federation) — Hər ölkənin öz etibar siyahısını idarə etdiyi və siyahıların siyahısında birləşdiyi model; Tamga xarici siyahıları da göstərə bilər.

**Ortaq reyestr** (ledger) — Etibar qeydlərinin bir neçə müstəqil operator tərəfindən birgə saxlanıldığı reyestr (icazəli blockchain). Tamga onu ən azı iki müstəqil operator qoşulduqda əlavə edir; o vaxta qədər bu işi imzalı etibar siyahıları görür.

**OTS** (Organization of Turkic States) — Türk Dövlətləri Təşkilatı (TDT); Tamga-nın idarəetməsində üzv dövlətlərə yer ayrılır.

**Rulebook** — Məcburi qaydalar toplusu. Tamga Rulebook bütün iştirakçıların qaydalarını ehtiva edir; hər rəqəmsal sənəd növünün ondan törəyən öz rulebook-u var.

**Trust framework** — ARF-in idarəetmə bölməsi: kimin qoşula biləcəyi, qoşulmanın və uyğunluğun necə işlədiyi, müqavilələr və dövlətlərə ötürülmə.

**Uyğunluq testi** (conformance) — Tətbiqin qaydalara uyğun olduğunun dərc edilmiş test vektorlarından və yoxlamalardan keçməklə nümayiş etdirilməsi.

**Validator** — Zəncir mərhələsində planlaşdırılan icazəli reyestrdə (Besu / QBFT) blokları imzalayan operator qovşağı.

## Rollar

**Vasitəçi** (intermediary) — Relying party adından rəqəmsal sənədləri yoxlayan xidmət; rəqəmsal cüzdan həm vasitəçini, həm də onun xidmət göstərdiyi relying party-ni göstərir.

**Sənəd sahibi** (holder) — Rəqəmsal sənədi öz rəqəmsal cüzdanında saxlayan və onu kimə göstərəcəyinə qərar verən şəxs.

**Sənədi verən qurum** (issuer) — Rəqəmsal sənədi imzalayıb verən qurum: universitet, peşə təşkilatı, dövlət qurumu və ya şirkət.

**Cüzdan provayderi** (wallet provider) — Rəqəmsal cüzdanı təqdim edən, cüzdan vahidlərini qeydiyyata alan və cüzdan və açar sübutlarını imzalayan təşkilat. Hər cüzdan öz provayderini idarə edir; şəbəkə provayder kimi fəaliyyət göstərmir, onu etibar siyahısında qeyd edir.

**Yoxlayan tərəf** (verifier) — Təqdim edilən rəqəmsal sənədi yoxlayan tərəf: imza, sənədi verən qurumun etibar siyahısındakı qeydi, status və siyasət. Relying party kimi də adlandırılır.

**Qeydiyyat qurumu** (registrar) — Sənədi verən qurumları və relying party-ləri qeydiyyata alan, etibar siyahısına daxil edilməzdən əvvəl qeydiyyat məlumatlarını yoxlayan struktur.

**QTSP** (Qualified Trust Service Provider) — eIDAS çərçivəsində milli nəzarət orqanından keyfiyyətli status almış etibar xidməti provayderi.

**Relying party** — Rəqəmsal cüzdandan rəqəmsal sənəd tələb edən və onu yoxlayan qeydiyyatlı təşkilat: işəgötürən, veb-sayt, qurum.

**RP** (Relying Party) — Relying party-nin abbreviaturası: rəqəmsal sənəd tələb edən və yoxlayan təşkilat.

**TLSO** (Trusted List Scheme Operator) — Milli etibar siyahısını tərtib edən, imzalayan və dərc edən təşkilat. Hazırda Türkiyə üçün bunu dövlət adından müvəqqəti olaraq Tamga edir.

**Səlahiyyətli mənbə** (authentic source) — Rəqəmsal sənəddəki məlumatın əsl sahibi olan sistem; məsələn, universitetin tələbə məlumat sistemi.

## Rəqəmsal sənədlər

**Attestation** — Şəxs və ya obyekt haqqında imzalı bəyanat; rəqəmsal cüzdanda saxlanılır. Məsələn, tələbəlik haqqında rəqəmsal sənəd və ya diplom.

**Rəqəmsal sənəd** (credential) — Sənədi verən qurumun imzaladığı və şəxsin rəqəmsal cüzdanında saxlanılan sənəd; şəxs yalnız tələb olunan sahələri göstərir.

**Rəqəmsal sənəd təklifi** (credential offer) — Sənədi verən qurumun rəqəmsal cüzdanı rəqəmsal sənədi qəbul etməyə dəvət etdiyi mesaj; adətən QR kod və ya keçid.

**Rəqəmsal sənədin verilməsi** (issuance) — Sənədi verən qurumun rəqəmsal sənədi şəxsin rəqəmsal cüzdanına təhvil verməsi (Tamga-da OpenID4VCI ilə).

**EAA** (Electronic Attestation of Attributes) — Şəxsin hər hansı atributunu (diplom, üzvlük kimi) təsdiq edən və yoxlayan tərəfə təqdim olunan rəqəmsal sənəd üçün eIDAS-dakı ad.

**ECTS** (European Credit Transfer and Accumulation System) — Tədris yükünü ifadə edən Avropa kredit köçürmə və toplama sistemi.

**ELM** (European Learning Model) — Təlim nəticələrini, ixtisasları və kreditləri təsvir edən Aİ məlumat modeli.

**ISCED-F** (International Standard Classification of Education: Fields) — UNESCO-nun təhsil və təlim sahələri təsnifatı.

**Ləğv** (revocation) — Rəqəmsal sənədin müddəti bitməzdən əvvəl etibarsız sayılması; sənədi verən qurum bunu yoxlayan tərəflərin yoxladığı ləğv siyahısında qeyd edir.

**Ləğv siyahısı** (status list) — Hər rəqəmsal sənədin bir mövqeyə malik olduğu sıxılmış, imzalı siyahı; sənədin etibarlı, dayandırılmış və ya ləğv edilmiş olduğunu göstərir.

**mDL** (mobile Driving Licence) — Rəqəmsal cüzdanda mdoc formatında (ISO/IEC 18013-5) saxlanılan sürücülük vəsiqəsi (rəqəmsal sənəd).

**Mdoc** — ISO/IEC 18013-5 mobil sənəd formatı, CBOR ilə kodlaşdırılır; üzbəüz təqdimat və mobil sürücülük vəsiqəsi üçün istifadə olunur.

**PID** (Person Identification Data) — Dövlətin ən yüksək etibarlılıq səviyyəsində verdiyi əsas şəxsiyyət məlumatları. Tamga bu rolu öz üzərinə götürmür; Tamga-nın şəxsiyyət sənədi PID deyil.

**PuB-EAA** (Public-Body Electronic Attestation of Attributes) — Authentic source-a cavabdeh dövlət qurumunun özü və ya onun adından verilən attestation.

**QEAA** (Qualified Electronic Attestation of Attributes) — Keyfiyyətli etibar xidməti provayderinin (QTSP) verdiyi EAA; attestation-lar arasında hüquqi təsiri ən güclü olanıdır.

**Refresh token** — Şəxs bütün axını təkrarlamadan rəqəmsal cüzdanın rəqəmsal sənədin yeni nüsxələrini almasına imkan verən uzunömürlü token.

**SD-JWT VC** (Selective Disclosure JWT Verifiable Credential) — Selective disclosure dəstəkləyən JSON əsaslı rəqəmsal sənəd formatı; EUDI Wallet-da və Tamga-da onlayn təqdimat üçün istifadə olunur.

**Sxem kataloqu** (schema catalogue) — Rəqəmsal sənəd növlərinin (vct), onların sxemlərinin və bütövlük heşlərinin dərc edildiyi kataloq (schemas.tamga.network).

**Toplu vermə** (batch issuance) — Eyni rəqəmsal sənədin bir neçə birdəfəlik nüsxəsinin birlikdə verilməsi; hər yoxlayan tərəf fərqli nüsxə görür (əlaqələndirilməzlik).

**Vct** (Verifiable Credential Type) — SD-JWT VC-də rəqəmsal sənəd növünün daimi identifikatoru; Tamga-da urn:tamga:edu:Diploma:1 kimi URN-dir.

## Təqdimat və məxfilik

**Accountable disclosure** — Şəxsiyyətin yalnız müstəqil əmanətçilərin hədd qərarı və məhkəmə qərarı ilə açıla bildiyi dizayn (zəncir mərhələsi, tədqiqat).

**DCQL** (Digital Credentials Query Language) — Yoxlayan tərəfin OpenID4VP-də hansı rəqəmsal sənədləri və hansı sahələri tələb etdiyini yazdığı sorğu dili.

**Disclosure** — SD-JWT-də sahənin dəyərinin təsadüfi salt ilə paketlənmiş forması; sənəd sahibi yalnız lazım olan disclosure-ları təqdim edir.

**Yoxlama xətti** (verification pipeline) — Yoxlayan tərəfin təqdimat zamanı icra etdiyi sabit yoxlama ardıcıllığı: imza, sənədi verən qurum, etibar siyahısı, status, holder binding, siyasət.

**Holder binding** — Rəqəmsal sənədin yalnız sənəd sahibinin cihazındakı açara bağlanması; kopyalanmış sənəd təqdim edilə bilməz.

**Əməliyyat jurnalı** (transaction log) — Rəqəmsal cüzdanın cihazda saxladığı vermə və təqdimat qeydi; onu yalnız şəxsin özü ixrac edə bilər.

**KB-JWT** (Key Binding JWT) — Rəqəmsal cüzdanın təqdimat anında sənəd açarı ilə imzaladığı qısa token; açarın sənəd sahibində olduğunu sübut edir.

**Key binding** — Rəqəmsal sənədin şəxsin rəqəmsal cüzdanındakı açara bağlanması; onu yalnız həmin cüzdan təqdim edə bilər.

**Longfellow ZK** — mdoc sənədləri üçün açıq sıfır bilik sübutu sistemi; Tamga ondan doğum tarixini göstərmədən "18 yaşdan yuxarı" kimi məlumatları sübut etmək üçün istifadə edir.

**Nonce** — Bir dəfə istifadə olunan təsadüfi dəyər; yoxlayan tərəf göndərir, rəqəmsal cüzdan imzalayır və beləliklə köhnə təqdimat təkrar istifadə edilə bilməz.

**Proof of possession** — Təqdim edən şəxsin rəqəmsal sənədin bağlı olduğu şəxsi açara sahib olduğunun təzə çağırışı imzalamaqla sübut edilməsi.

**Salted hash** — Dəyərin təsadüfi salt ilə birlikdə hesablanan heşi; dəyəri heşdən təxmin etmək mümkün deyil. SD-JWT sahələri bu üsulla gizlədir.

**Selective disclosure** — Rəqəmsal sənəddən artıq məlumatın deyil, yalnız yoxlayan tərəfin tələb etdiyi sahələrin göstərilməsi.

**Psevdonim** (pseudonym) — Rəqəmsal cüzdanın hər veb-sayt üçün ayrıca törətdiyi sabit hesab identifikatoru; iki sayt eyni şəxsi uyğunlaşdıra bilməz.

**ZK** (Zero-Knowledge proof) — Məlumatın doğru olduğunu məlumatın özünü göstərmədən sübut edən sübut; məsələn, doğum tarixi olmadan "18 yaşdan yuxarı".

## Etibar

**Lövbər jurnalı** (anchor log) — İmzalı siyahıların heşlərinin əlavə edildiyi, hamıya açıq və geri qaytarılmayan qeyd; siyahının gizlicə dəyişdirilmədiyini yoxlamaq mümkündür.

**Giriş sertifikatı** (access certificate) — Relying party-nin sorğularını imzaladığı X.509 sertifikatı; client identifikatoru bu sertifikatın heşindən törədilir.

**Etibar lövbəri** (trust anchor) — Yoxlayan tərəfin ilkin olaraq etibar etdiyi kök açar və ya sertifikat; qalan hər şey ona qədər yoxlanılır.

**Etibar siyahısı** (trust list) — Ölkənin kök sertifikatlarını, sənədi verən qurumları və qeydiyyatdan keçmiş relying party-ləri ehtiva edən imzalı siyahı. Bu gün Tamga-da etibar bu siyahılara əsaslanır; ortaq reyestr sonra gələcək.

**Qeydiyyat sertifikatı** (registration certificate) — Qeydiyyat qurumunun relying party-nin hansı sahələri hansı məqsədlə tələb edə biləcəyini bildirən imzalı rəqəmsal sənədi (ən çox 12 ay).

**Şəxsiyyətin təsdiqi** (identity proofing) — Rəqəmsal sənəd verilməzdən əvvəl şəxsin həqiqətən həmin şəxs olduğunun yoxlanılması; məsələn, şəxsiyyət vəsiqəsi və canlılıq testi ilə.

**Kök sertifikat** (root CA) — Sertifikat zəncirinin əsaslandığı ən yuxarı sertifikat orqanı; Tamga-da etibar siyahısı vasitəsilə sabitlənir.

**LoA** (Level of Assurance) — Yoxlayan tərəfin şəxsiyyətə və ya rəqəmsal sənədə nə dərəcədə etibar edə biləcəyi; Tamga şəxsiyyətin autentifikasiyası (T), sənədi verən qurum (I) və rəqəmsal cüzdan (W) üçün ayrı səviyyələrdən istifadə edir.

**LoTE** (List of Trusted Entities) — ETSI TS 119 602 siyahı formatı; Tamga öz siyahılarının LoTE görünüşünü dərc edir və xarici LoTE siyahılarını oxuya bilir.

**LOTL** (List of Trusted Lists) — Ölkə etibar siyahılarının ünvanlarını, imzalayanlarını və tanınma statuslarını göstərən imzalı siyahı.

**QES** (Qualified Electronic Signature) — Kvalifikasiyalı sertifikat və kvalifikasiyalı qurğu ilə qoyulan elektron imza; Aİ-də əl ilə atılan imzaya bərabərdir.

**QSCD** (Qualified Signature Creation Device) — Kvalifikasiyalı imza açarını qoruyan sertifikatlı aparat təminatı və ya uzaq xidmət.

**Trusted List** — Aİ üzv dövlətlərinin kvalifikasiyalı etibar xidməti provayderlərini dərc etdiyi ETSI TS 119 612 formatı.

**WRPAC** (Wallet-Relying Party Access Certificate) — Relying party-nin rəqəmsal cüzdanlara göndərdiyi sorğuları imzaladığı giriş sertifikatı.

**WRPRC** (Wallet-Relying Party Registration Certificate) — Relying party-nin hansı sahələri nə üçün tələb edə biləcəyini bildirən qeydiyyat sertifikatı.

**x509_hash** — HAIP-dəki client identifikatoru formatı: identifikator relying party-nin giriş sertifikatının base64url SHA-256 heşidir.

## Rəqəmsal cüzdan

**Cihaz attestasiyası** (device attestation) — Telefonun əməliyyat sistemindən (App Attest, Play Integrity) gələn, real cihazda dəyişdirilməmiş tətbiqin işlədiyinə dair sübut.

**Key attestation** — Cüzdan provayderinin rəqəmsal sənəd açarının təhlükəsiz aparat təminatında yaradıldığını və saxlanıldığını bildirən qısamüddətli bəyanatı.

**Passkey** — İstifadəçinin cihazında saxlanılan, fişinqə davamlı giriş açarı (WebAuthn/FIDO2).

**Wallet unit** — Rəqəmsal cüzdanın müəyyən cihazdakı quraşdırılması.

**WIA** (Wallet Instance Attestation) — Cüzdan provayderinin imzaladığı, cüzdan quraşdırılmasının həqiqi olduğunu bildirən qısamüddətli bəyanat; sənədi verən qurum rəqəmsal sənədi verməzdən əvvəl onu yoxlayır.

**WUA** (Wallet Unit Attestation) — Cüzdan provayderinin cüzdan vahidi və onun açarlarının təhlükəsizliyi barədə attestation-ı; aktual Aİ mətnlərində WIA və key attestation olaraq ikiyə bölünür.

## Standartlar və protokollar

**DPoP** (Demonstrating Proof of Possession) — Giriş tokenini açara bağlama üsulu; oğurlanmış token həmin açar olmadan istifadə edilə bilməz.

**ETSI** (European Telecommunications Standards Institute) — Etibar siyahıları, imzalar və etibar xidmətləri üçün texniki standartlar hazırlayan Avropa standartlaşdırma təşkilatı.

**HAIP** (High Assurance Interoperability Profile) — Yüksək təminatlı istifadə üçün OpenID4VC seçimlərini sabitləyən profil; EUDI Wallet-da da istifadə olunur.

**OpenID4VCI** (OpenID for Verifiable Credential Issuance) — Sənədi verən qurumun rəqəmsal sənədi rəqəmsal cüzdana təhvil verdiyi protokol.

**OpenID4VP** (OpenID for Verifiable Presentations) — Yoxlayan tərəfin rəqəmsal cüzdandan rəqəmsal sənəd tələb etdiyi və təqdimatı qəbul etdiyi protokol.

**PAR** (Pushed Authorization Request) — Avtorizasiya sorğusunun əvvəlcə serverə göndərildiyi OAuth addımı; məzmun brauzerin ünvan sətrində görünmür.

<!-- TERMS:END -->
