---
document_id: ADR-0017
title: "Yoxlama nəticəsinə giriş"
status: Active
version: 1.0.0
created: 2026-09-27
last_updated: 2026-10-07
summary: >
  Host edilən yoxlayan tərəfin (`verify.tamga.network`) təsdiqlənmiş sahələri qaytaran son nöqtəsi (`GET /presentations/:id/claims`) bu gün təqdimat identifikatorunu bilən hər kəsə cavab verir (imkan URL-i). Real saytlar üçün açılmazdan əvvəl təqdimatı açan yoxlayan tərəf (RP) etibar siyahısında qeydiyyatda olan açarı ilə imzalanmış qısamüddətli bəyanla öz kimliyini sübut edir; sahələr yalnız həmin RP-yə və yalnız bir dəfə verilir. Yeni sirr və ya yeni infrastruktur tələb olunmur.
domain: Services
translation_of: ADR-0017
source_version: "1.0.0"
---

# Kontekst

Daxili baxış Y8 (2026-09-27): `apps/verify/src/routes/presentations.ts`

- `POST /presentations` [[t:identity-proofing|autentifikasiya]] tələb etmir; hər kəs yoxlayan tərəf kimi istənilən siyasətlə təqdimat aça bilər.
- `GET /presentations/:id` nəticəni (sahə **adlarını**, AP3), `GET /presentations/:id/claims` isə təsdiqlənmiş **dəyərləri** qaytarır.
  Hər ikisi yalnız təqdimat identifikatorunu (72 bit təsadüfi) bilməyi tələb edir. İdentifikator həmçinin `/p/:id` səhifə ünvanında görünür
  (brauzer tarixçəsi, ekran paylaşımı, jurnallar).
- Dəyərlər istənilən qədər oxuna bilər; vaxt məhdudiyyəti yalnız yaddaşdakı qeydin ömrüdür.

Demo üçün qəbul ediləndir (saxta məlumatlar, tək sayt). Real sayt `verify.tamga.network` ilə işləməyə başladıqda,
identifikatoru ələ keçirən istənilən şəxs fərdin adını və ya [[t:credential]] sahələrini oxuya bilər. İnteqrasiya təlimatı
([[GUIDE-0001]] §4, [[GUIDE-0002]]) bunu "planlaşdırılır" kimi qeyd edir; bu ADR dizaynı təklif edir.

Əhatə dairəsi: yalnız **host edilən** [[t:verifier]]. Öz serverində `@tamga-network/verifier` işlədən [[t:RP]] üçün təsiri yoxdur
(dəyərlər onsuz da onun öz serverində həll olunur).

# Qərar

**K1 — RP kimliyi [[t:trust-list|etibar siyahısındakı]] açarla sübut olunur.** Nəticə və dəyər son nöqtələrinə hər çağırış `Authorization:
Bearer <rp-assertion>` taşır. `rp-assertion`: RP'nin güven listesinde kayıtlı erişim sertifikasına (`relying_parties[].
access_cert_fingerprint_sha256`) karşılık gelen özel anahtarla imzalı JWS; başlıkta `x5c`; faydalı yük
`{iss: client_id, aud: <verifier tabanı>, iat, exp ≤ iat+60, jti}`. Yoxlayan tərəf imzanı, sertifikat barmaq izini `TrustSource.relyingParty(client_id)`
qeydi ilə, `aud`/`exp` sahələrini və `jti` təkrarını yoxlayır. Yeni sirr, yeni qeydiyyat və ya yeni server tələb olunmur: RP onsuz da imzalı
[[t:OpenID4VP]] sorğuları üçün bu açardan istifadə edir ([[SPEC-PROTO-0002]]).

**K2 — Təqdimat onu açan RP-yə bağlanır.** `POST /presentations` eyni bəyanı tələb edir; siyasət RP-nin qeydiyyatdakı əhatə dairəsini aşa bilməz
(AP6 — bu gün siyasət cədvəli ilə, bundan sonra RP-yə görə). Təqdimat qeydi `client_id` daşıyır; nəticə və dəyərlər yalnız eyni
`client_id` üçün verilir, başqasına isə `404` qaytarılır (mövcudluğu sızdırmır).

**K3 — Dəyərlər bir dəfə və qısa müddətdə oxunur.** `GET /presentations/:id/claims` ilk uğurlu oxumada dəyərləri yaddaşdan silir
(növbəti çağırış `410 Gone`); oxunmamış dəyərlər nəticədən ən gec 5 dəqiqə sonra silinir. Nəticə obyekti (sahə adları, addımlar)
audit üçün daha uzun saxlanıla bilər; dəyər ehtiva etmir (AP3).

**K4 — Brauzer sorğulaması dəyərləri görmür.** Səhifə dəsti (`@tamga-network/verifier/web`) və `/p/:id` yalnız statusu
(`PENDING | ACCEPTED | REJECTED | INDETERMINATE`) oxuyur; bunun üçün təqdimata məxsus, yalnız statusu oxuya bilən ayrıca qısamüddətli
token (`status_token`, yaratma cavabında) istifadə olunur. Dəyərlər yalnız RP serverinə, K1 ilə ötürülür.

**K5 — Demo sayt qaydaya əməl edir.** `verify…/demo-site` öz RP qeydi ilə eyni yoldan istifadə edir (proses daxilində); xüsusi istisna yoxdur.

**K7 — Rəqəmsal cüzdan əsl RP-ni göstərir (ARF vasitəçi modeli).** Host edilən yoxlayan tərəf bir RP adından sorğu açdıqda imzalı sorğu
obyekti `tamga_on_behalf_of: <RP client_id>` daşıyır. Rəqəmsal cüzdan həmin RP-nin etibar siyahısı qeydini həll edir; təsdiq ekranında **əsl RP-nin
qeydiyyatdakı adını** və "[[t:intermediary]]: `<verifier>`" məlumatını göstərir; əhatə dairəsinin yoxlanılması (AP6) əsl RP-nin qeydinə görə aparılır. Qeydiyyatda
olmayan və ya vasitəçinin öz qeydi ilə uyğun gəlməyən `tamga_on_behalf_of` sorğusu rədd edilir.

**K6 — Keçid.** Bir buraxılış ərzində köhnə son nöqtələr `Deprecation` başlığı ilə işləyir; demo siyasətləri (`site-signup`, `site-signin`,
`age-over-18-mdoc`) ilk qeydiyyatdan keçmiş demo RP-yə bağlanır. İstehsal mühitində K1–K4 məcburidir.

# Əsaslandırma / alternativlər

| Variant | Niyə seçilmədi |
|---|---|
| Sayt başına statik API açarı | Yeni sirrin paylanması və saxlanması; etibar siyahısı ilə əlaqəsi yoxdur; sızma halında ləğv axını ayrıca qurulmalıdır |
| OAuth 2.0 client credentials serveri | Əlavə infrastruktur və vəziyyət; eyni təminatı K1 mövcud açarla verir |
| mTLS | Paylaşılan hostinqdə nginx/sertifikat idarəsi ağırdır; brauzer tərəfi üçün mənasızdır |
| Yalnız identifikatoru uzatmaq (məs. 128 bit) | İmkan URL-inin sızma yollarını (tarixçə, ekran, jurnal) bağlamır |
| Dəyərləri ümumiyyətlə saxlamamaq, yalnız RP-yə push (webhook) | RP-dən açıq son nöqtə və imza yoxlaması qurmağı tələb edir; gələcəkdə variant kimi əlavə edilə bilər |

# Dəyişməzlər

| Kod | Qayda |
|---|---|
| HV1 | Host edilən yoxlayan tərəf dəyər qaytaran hər son nöqtəni yalnız K1 bəyanı yoxlanılmış RP-yə açır. |
| HV2 | Təqdimatı yaradan `client_id` xaricində heç bir RP nəticə və ya dəyər ala bilməz; cavab mövcudluğu sızdırmır (`404`). |
| HV3 | Dəyərlər ən çoxu bir dəfə oxunur və nəticədən ən gec 5 dəqiqə sonra yaddaşdan silinir. |
| HV4 | Brauzerə gedən heç bir token və ya ünvan dəyər oxuma səlahiyyəti daşımır. |
| HV6 | Vasitəçi yoxlayan tərəf üzərindən gələn sorğuda rəqəmsal cüzdan əsl RP-nin qeydiyyatdakı adını göstərir və əhatə dairəsini onun qeydinə görə yoxlayır. |
| HV5 | RP bəyanı: `exp − iat ≤ 60 s`, `jti` təkrarının rəddi, imzalayan sertifikatın barmaq izi etibar siyahısındakı RP qeydi ilə üst-üstə düşür. |

# Təsir
- `apps/verify` (marşrutlar + kiçik `rpAuth` köməkçisi), `@tamga-network/verifier/web` (yalnız `status_token` istifadəsi),
  [[GUIDE-0001]] / [[GUIDE-0002]] (server nümunəsi bəyan yaradır), [[SPEC-API-0001]] §4 (buraxılış qeydi).
- Fərdi məlumatlar axını daralır; yeni fərdi məlumatlar saxlanılmır.

# Status

**Accepted — 2026-09-27.** DECISIONS: D-API-2. K7 (əsl RP-nin göstərilməsi) qəbul təklifi ilə əlavə edildi.

Tətbiq: `apps/verify` (rpAuth, təqdimat sahibi, tək oxuma, status_token), `@tamga-network/verifier/web`, rəqəmsal cüzdanın təsdiq ekranı (K7),
təlimatlar GUIDE-0001/0002.

Tətbiq qeydi (K7, 2026-10-07): vasitəçi əlaqəsi hər iki qeyddə yazılı olmalıdır — əsl RP vasitəçini `uses_intermediaries` sahəsində,
vasitəçi isə əsl RP-ni `served_relying_parties` sahəsində sadalayır. Birtərəfli bəyan olduqda rəqəmsal cüzdan sorğunu rədd edir (`@tamga-network/wallet-core`;
[[SPEC-PROTO-0002]]/PV14).

**Tətbiq qeydi.** K5 nümunəsi yoxlayan tərəfin öz axınlarına da tətbiq olunur: sərt rejimdə bəyansız `POST /presentations`
(əsas səhifədəki "QR yarat"; rəqəmsal cüzdanın başlatdığı yoxlama və keçid kartı axınları, [[ADR-0012]] B/C) təqdimatı yoxlayan tərəfin **öz**
RP qeydinə bağlayır. Belə təqdimatın nəticəsi və dəyərləri heç bir xarici çağırana verilmir (HV1/HV2 eynilə qüvvədədir); şəxs dəyərləri
yalnız özünün seçdiyi yoxlama keçidi ilə göstərir. Başqa RP adından təqdimat açmaq K1 bəyanını tələb edir.
