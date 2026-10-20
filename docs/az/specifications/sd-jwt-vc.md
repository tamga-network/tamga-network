---
document_id: SPEC-CRED-0002
title: "SD-JWT VC profili"
status: Active
version: 1.0.0
created: 2026-09-09
last_updated: 2026-10-16
summary: >
  Tamga rəqəmsal sənədinin baytlarını müəyyən edir. Disclosure necə yaradılır (salt, massiv strukturu, JSON seriyalaşdırma qaydası, base64url), _sd massivi necə doldurulur və niyə sıralanır, decoy digest siyasəti, _sd_alg, cnf və x5c yerləşməsi, ~ ayırıcılı birləşik format, KB-JWT-nin sd_hash hesablanması və on addımlı yoxlama alqoritmi. SPEC-SCHEMA-0002-dəki diplom nümunəsi əvvəldən sona qədər real baytlarla işlənir. Tamga profili normativ məhdudiyyətlər qoyur: ES256 məcburidir, _sd_alg sha-256-dır, KB-JWT istisnasız məcburidir, decoy qadağandır.
translation_of: SPEC-CRED-0002
source_version: "1.0.0"
---
**Bu spesifikasiya Tamga-nın SD-JWT VC rəqəmsal sənədini bayt səviyyəsində müəyyən edir.** Sənəd verən və ya yoxlayan kodu özü yazan
developerlər üçündür.

**Nə vaxt oxunmalıdır**

- Əvvəlcə [Sənəd formatları](/concepts/credential-formats) və [Məxfilik](/concepts/privacy) konsepsiya səhifələrini, format qərarları üçün isə [[SPEC-CRED-0001]] sənədini oxuyun.
- `@tamga-network` paketlərindən istifadə etmədən öz SD-JWT generatorunuzu və ya yoxlayıcınızı yazarkən.
- Sonra: sənədin necə verildiyi — [[SPEC-PROTO-0001]], necə təqdim edildiyi — [[SPEC-PROTO-0002]].

**Qısaca.** [[t:SD-JWT-VC]] qurumun imzaladığı JWT-dən və ayrı-ayrılıqda açıla bilən sahələrdən ibarətdir. Hər sahə təsadüfi salt ilə
hash-lənir ([[t:salted-hash]]); JWT yalnız bu hash-ləri daşıyır. Şəxs hər hansı sahəni göstərmək istədikdə həmin sahənin [[t:disclosure]] elementini əlavə edir;
yoxlayan tərəf hash-i yenidən hesablayıb JWT-dəki ilə müqayisə edir. Təqdimatın sonuna əlavə olunan qısa imza ([[t:KB-JWT]]) sənədi təqdim edənin şəxsin cihazındakı
açarı əlində saxladığını sübut edir.

---

# Əhatə dairəsi

[[SPEC-CRED-0001]] formatı **seçdi**; bu spesifikasiya formatı **yazır.** Tamga
[[t:credential|rəqəmsal sənədinin]] hər baytı burada müəyyən edilib.

**Standart əsas:** SD-JWT — **RFC 9901**. SD-JWT VC —
draft-ietf-oauth-sd-jwt-vc (Tip Metadata mexanizmi [[SPEC-SCHEMA-0001]] sənədində
nəzərdən keçirilir).

Əhatə dairəsindən kənar: sənədin verilməsi protokolu ([[SPEC-PROTO-0001]]), təqdimat protokolu
([[SPEC-PROTO-0002]]), [[t:revocation]] ([[SPEC-CRED-0003]]).

---

# 1. Tamga profili — normativ məhdudiyyətlər

Standart bir çox seçim imkanı saxlayır. Tamga onları daraldır:

| Mövzu | Standart | **Tamga** | Əsaslandırma |
|---|---|---|---|
| İmza alqoritmi | Müxtəlif | **ES256 (P-256)** | Mobil secure element və HSM-də universal dəstəklənir |
| `typ` | `dc+sd-jwt` | **`dc+sd-jwt`, `vc+sd-jwt` rədd edilir** | §5.1.1 |
| Seriyalaşdırma | Sərbəst | **Sabit konvensiya (yaradılma zamanı)** | §3.5 |
| `_sd_alg` | Müxtəlif | **`sha-256`** | Tək hash, tətbiqdə mürəkkəblik yoxdur |
| Salt uzunluğu | ≥128 bit tövsiyə olunur | **128 bit (16 bayt)** | Standartın tövsiyəsi |
| Key binding | Opsional | **İstisnasız məcburi** | [[SPEC-CRED-0001]] §3 |
| Decoy digest | İcazəlidir | **Qadağandır** | §4.4 |
| Sənədi verənin identifikatoru | `iss` / `x5c` / `kid` | **`x5c` məcburi** | [[SPEC-ID-0002]] |
| İç-içə selective disclosure | İcazəlidir | **Ən çoxu 2 səviyyə** | [[RS-SCHEMA-0001]] §9 |
| Massiv elementinin gizlədilməsi | İcazəlidir | **ilk mərhələdə istifadə olunmur** | Mürəkkəblik; ehtiyac yoxdur |

---

# 2. Anatomiya

SD-JWT VC üç hissədən ibarətdir və **tilda (`~`)** ilə ayrılır:

```
<Issuer-signed JWT>~<Disclosure 1>~<Disclosure 2>~...~<KB-JWT>
```

Qaydalar:

- Ayırıcı `~` (U+007E).
- Buraxılış anında son element **boşdur** — yəni sətir `~` ilə bitir (KB-JWT hələ
  yoxdur).
- Təqdimat anında son element KB-JWT-dir.
- Disclosure-ların sırası **mənasızdır** və yoxlayan tərəf sıraya etibar etməməlidir.

```
Issued (kept in the wallet):
  JWT~D1~D2~D3~D4~D5~D6~D7~

Presented (sent to the verifier — only 3 disclosures selected):
  JWT~D2~D5~D6~KB-JWT
```

**Kritik müşahidə:** Rəqəmsal cüzdan təqdim etmədiyi disclosure-ları **sətirdən çıxarır.** JWT
dəyişmir, imza etibarlı qalır. Gizlətmək nəyisə əlavə etmək deyil, **çıxarmaqdır.**

---

# 3. Disclosure yaradılması

## 3.1 Struktur

[[t:selective-disclosure]] ilə açıqlana bilən hər claim üçün üç elementli JSON massivi:

```json
["<salt>", "<claim name>", <claim value>]
```

Bu massiv JSON kimi seriyalaşdırılır, UTF-8-ə çevrilir, **base64url** (padding-siz)
ilə kodlaşdırılır. Nəticə disclosure sətridir.

## 3.2 Salt

- **128 bit (16 bayt)**, kriptoqrafik cəhətdən təhlükəsiz generatordan.
- Hər disclosure üçün **yeni** salt. Eyni salt iki dəfə istifadə edilə bilməz.
- Massivdə base64url (padding-siz) kimi yer alır → 22 simvol.

**Niyə salt:** Salt olmasaydı, `["given_name","Ayşe"]` massivinin hash-i
sabit olardı. [[t:verifier|Yoxlayan tərəf]] gizlədilmiş digest-i görüb lüğət hücumu ilə
"bu sahə `given_name`, dəyəri isə `Ayşe`" deyə təxmin edə bilərdi. `birth_date`
kimi aşağı entropiyalı sahələrdə bu hücumun dəyəri cüzidir.

## 3.3 Seriyalaşdırma qaydası — ən kritik tətbiq detalı

**Disclosure hash-i disclosure *sətrinin* hash-idir — massivin yenidən
seriyalaşdırılmış halının deyil.**

```
digest = base64url( SHA-256( ASCII bytes of <disclosure string> ) )
```

Yəni:

1. [[t:issuer|Sənədi verən qurum]] massivi JSON-a seriyalaşdırır → **bu baytlar artıq sabitdir**
2. base64url ilə kodlaşdırır → disclosure sətri
3. digest = SHA-256(disclosure sətrinin **ASCII baytları**)

Yoxlayan tərəf əks istiqamətdə gedir: disclosure sətrini götürür, **əvvəlcə hash-ləyir**,
sonra dekodlaşdırır. Heç vaxt dekodlaşdırıb yenidən seriyalaşdıraraq hash-ləmir.

**Niyə bu qədər vacibdir:** JSON seriyalaşdırması deterministik deyil. Boşluqlar,
Unicode escape-ləri (`\u00e7` və `ç`), açarların sırası — hamısı fərqli baytlar yaradır və
fərqli hash verir. Yenidən seriyalaşdıran tətbiq hətta özünün yaratdığı
sənədləri belə yoxlaya bilmir.

Bu, SD-JWT tətbiqlərində **ən çox yol verilən səhvdir.**

## 3.4 Nümunə — real dəyərlərlə

`given_name: "Ayşe"` sahəsini gizlədək. **Aşağıdakı dəyərlər real hesablama
nəticəsidir**, uydurma deyil; Tamga seriyalaşdırma konvensiyası (§3.5) ilə
yaradılıb.

```
1. Salt (16 bytes):
   hex        : 3af29c417b0ed5882691ff4ca307be52
   base64url  : OvKcQXsO1Ygmkf9Mowe-Ug          (22 characters)

2. JSON array (these bytes are now fixed):
   ["OvKcQXsO1Ygmkf9Mowe-Ug", "given_name", "Ayşe"]

3. UTF-8 → base64url = DISCLOSURE:
   WyJPdktjUVhzTzFZZ21rZjlNb3dlLVVnIiwgImdpdmVuX25hbWUiLCAiQXlcdTAxNWZlIl0

4. digest = base64url(SHA-256(ASCII bytes of the string in step 3)):
   nM_EESmLJt3b0fzNu1paGyiAfSLs4Npf2yEjUn0upSo   (43 characters)
```

Daha iki nümunə:

| Claim | Disclosure | Digest |
|---|---|---|
| `family_name: "Yılmaz"` | `WyJDWmNVejJVZEJpdzM5b2ZYSC1ZRmhRIiwgImZhbWlseV9uYW1lIiwgIllcdTAxMzFsbWF6Il0` | `z1_SoX1L6xCo9GKQf0f5lEdLisaiHfvejfETWcUCLNs` |
| `grade: "3.42"` | `WyIweEtpU3JVZ1RULWtYNVNsTUNnS09BIiwgImdyYWRlIiwgIjMuNDIiXQ` | `rdPfUM0_1bDXDRhvpkze7Im098NzDSfvn9tG2CMDTmM` |

Digest `_sd` massivinə daxil olur. Disclosure JWT-nin **xaricində**, `~` ilə ayrılmış
şəkildə daşınır.

## 3.5 Seriyalaşdırma konvensiyası və yenidən seriyalaşdırma tələsi

### Tələnin nümayişi

Yuxarıdakı disclosure-u dekodlaşdıraq və **yenidən seriyalaşdıraq**:

```
Decoded array:
  ["OvKcQXsO1Ygmkf9Mowe-Ug", "given_name", "Ayşe"]      ← same data

Different serialisation (no spaces, no Unicode escaping):
  ["OvKcQXsO1Ygmkf9Mowe-Ug","given_name","Ayşe"]

Digest computed from this string:
  c94D71JDfX8hzanT-ZpRWBn5oNX_RkStfSfkvTmY_kU

Original digest:
  nM_EESmLJt3b0fzNu1paGyiAfSLs4Npf2yEjUn0upSo

NO MATCH.
```

Məlumat **tamamilə eynidir.** Dəyişən yeganə şey iki boşluq və `ş` simvolunun escape
formasıdır. Digest tamamilə fərqlidir.

Buna görə yoxlayan tərəf disclosure-u **əvvəlcə hash-ləyir, sonra dekodlaşdırır** (§8, Ş5a).
Dekodlaşdırıb yenidən seriyalaşdıran tətbiq hətta özünün yaratdığı sənədi belə
yoxlaya bilmir — və simptom məhz budur.

### Tamga-da sənədi verən qurum üçün konvensiya (normativ)

Yoxlama tərəfi seriyalaşdırmadan asılı olmadan işləyir (sətir necədirsə, elə hash-lənir).
Lakin **sənədi verən tərəfdə** konvensiya sabitlənir; əks halda Tamga-da sənəd verən müxtəlif
tətbiqlər müqayisə edilə bilən test vektorları yarada bilməz:

| Qayda | Dəyər |
|---|---|
| Unicode | `ensure_ascii` — ASCII olmayan simvollar `\uXXXX` kimi escape edilir |
| Element ayırıcısı | `", "` (vergül + boşluq) |
| Obyekt dəyəri | Açar–dəyər ayırıcısı `": "`, element ayırıcısı `", "`; açarlar yaradılma sırası ilə |
| Massiv | Dəqiq 3 element, ardıcıllıqla salt, ad, dəyər |
| Tətbiq | `@tamga-network/sd-jwt` bu konvensiya ilə yaradır; §3.4-dəki dəyərlər paketin testində eynilə təkrar yaradılır |

Bu konvensiya **yalnız yaradılma üçündür.** Yoxlayan tərəf konvensiyaya uyğun olmayan
disclosure-ları da yoxlaya bilər və yoxlamalıdır — xarici ekosistemlərdən gələn
sənədlər fərqli konvensiyadan istifadə edə bilər.

---

# 4. `_sd` massivi

## 4.1 Yerləşmə

Gizlədilən claim-lərin digest-ləri həmin claim-in yerləşəcəyi JSON obyektinin
daxilindəki `_sd` massivində toplanır:

```json
{
  "iss": "https://issuer.tamga.network/example-university",
  "vct": "urn:tamga:edu:DiplomaCredential:1",
  "_sd_alg": "sha-256",
  "_sd": [
    "Kx8vNmQ2pTr7LhWc4YsAeJ1BdFgHiZoNuVxCyRmEqPk",
    "9dLpXfR3wQmKzT2vBnHsAe6YuCiJoNlPqEgWrMxZkFv",
    "..."
  ],
  "eqf_level": 6
}
```

Gizlədilməyən claim-lər (`eqf_level` kimi) birbaşa payload-da qalır.

## 4.2 Sıralama — normativ

`_sd` massivi **həmişə sıralanır** (baytlar üzrə artan sırada).

**Niyə:** Sıralanmasa, massivdəki ardıcıllıq claim-lərin ilkin sırasını üzə çıxarır.
Yoxlayan tərəf gizlədilmiş digest-lərin sxemdəki sahə sırası ilə üst-üstə düşdüyünü
görsə, hansı sahələrin gizlədildiyini müəyyən edə bilər.

Sıralama bu yan kanalı bağlayır.

## 4.3 `_sd_alg`

Payload-ın **kök səviyyəsində**, bir dəfə:

```json
"_sd_alg": "sha-256"
```

Tamga-da həmişə `sha-256` olur. Dəyər yoxdursa, defolt olaraq `sha-256` qəbul
edilir, lakin Tamga-da sənədi verən qurumlar onu **açıq şəkildə yazır.**

## 4.4 Decoy digest — Tamga-da qadağandır

Standart `_sd` massivinə heç bir disclosure-a uyğun gəlməyən saxta
("decoy") digest-lər əlavə etməyə icazə verir. Məqsəd gizlədilmiş sahələrin **sayını**
qeyri-müəyyən etməkdir.

**Tamga-da qadağandır.** Əsaslandırma:

1. **Sxem onsuz da sayı üzə çıxarır.** `vct` açıqdır; yoxlayan tərəf sxemi
   əldə edib neçə sahə olduğunu dəqiq bilir. Decoy məlum olan sayı
   gizlətməyə çalışır — qoruma təmin etmir.
2. **Yoxlanıla bilməyən asimmetriya.** Decoy sayı sənədi verən qurumun ixtiyarındadır; iki sənədi verən qurum
   fərqli sayda decoy qoysa, bu fərqin özü barmaq izinə çevrilir.
3. **Ölçü.** Hər decoy 43 simvoldur; QR kodun ölçüsünü lüzumsuz böyüdür.

Gizlədilmiş sahələrin sayının yan kanal olduğu doğrudur
([[SPEC-SCHEMA-0002]] Təhlükəsizlik qeydləri); həll yolu decoy deyil, rəqəmsal cüzdanın eyni
yoxlayan tərəfə **ardıcıl disclosure dəsti** təqdim etməsidir.

---

# 5. Issuer-signed JWT

## 5.1 Başlıq

```json
{
  "alg": "ES256",
  "typ": "dc+sd-jwt",
  "x5c": ["MIIB<issuer certificate>", "MIIC<intermediate CA>"]
}
```

| Sahə | Tamga qaydası |
|---|---|
| `alg` | `ES256` — başqa dəyər rədd edilir |
| `typ` | **`dc+sd-jwt`** — §5.1.1 |
| `x5c` | **Məcburi.** Yarpaq sertifikat birinci yerdə, kök sertifikat **daxil edilmir** |

Kök sertifikat `x5c` sahəsinə qoyulmur; zəncir `RootCARegistry` daxilindəki etibar lövbərinə bağlanır
([[SPEC-ID-0002]], [[SPEC-BC-0001]]).

### 5.1.1 `typ` dəyəri və `vc+sd-jwt` uyğunluğu

Standart sənədi verən tərəfin `typ` başlıq parametrini əlavə etməsini və onun dəyərinin
**`dc+sd-jwt`** olmasını məcburi edir. Media tipi
`application/dc+sd-jwt` şəklindədir; `dc` alt tipi "digital credential" mənasını verir.

**Tarixçə — bilmək lazımdır.** Draft 2023-cü ilin iyulunda başladığı vaxtdan 2024-cü ilin noyabrına
qədər `typ` dəyəri kimi **`vc+sd-jwt`** istifadə edib. W3C-nin
Verifiable Credentials Data Model draftının qeydiyyata aldığı `vc` media tipi adı ilə
toqquşmanın qarşısını almaq üçün `dc+sd-jwt` ilə əvəz edilib.

Bu dəyişiklikdən sonra draftlara keçid qeydi əlavə edilmişdi: yoxlayan tərəflərin və
[[t:holder|sənəd sahiblərinin]] ağlabatan keçid müddəti ərzində **hər iki dəyəri** qəbul etməsi
tövsiyə olunurdu. Lakin bu qeyd sonrakı draft redaksiyalarında **çıxarılıb** —
yəni standart keçid dövrünü bitmiş hesab edir.

**Tamga qərarı:**

| İstiqamət | Qayda |
|---|---|
| **Buraxılış** | Yalnız `dc+sd-jwt`. `vc+sd-jwt` yaradılmır. |
| **Yoxlama — Tamga-da sənədi verən qurumlar** | Yalnız `dc+sd-jwt` qəbul edilir. `vc+sd-jwt` **rədd edilir.** |
| **Yoxlama — xarici ekosistem** | **Defolt olaraq qəbul edilir** (SD-JWT VC -13 yoxlayan tərəfə buna icazə verir; Aİ ilə uyğunluq, paketlər 0.5.2). Uyğunluq bayrağı söndürülərsə, yalnız `dc+sd-jwt`. |

Əsaslandırma: Tamga-nın heç bir köhnə yükü (legacy) yoxdur — bütün sənədi verən qurumlar yenidir.
`vc+sd-jwt` yaradan tətbiq iki il geridə qalmış deməkdir və bu, digər
uyğunsuzluqların da xəbərçisidir. Bunun əksinə, xarici ekosistemdən gələn
rəqəmsal sənədi sırf `typ` səbəbindən rədd etmək interop-u lüzumsuz yerə poza bilər.

**Dəyişiklik (2026-10-13, ilk Aİ uyğunluq mərhələsi):** xarici növlərdə `vc+sd-jwt` artıq **defolt olaraq qəbul edilir** (SD-JWT VC -13
yoxlayan tərəfə köhnə dəyəri qəbul etməyə icazə verir; Aİ rəqəmsal cüzdanları və sənədi verən qurumlar arasında hələ də rast gəlinir). Tamga növlərində
(`urn:tamga:` kataloqundakı növlər) `vc+sd-jwt` **rədd edilməyə davam edir** (C13; yoxlama xəttinin B addımı). Bayraq
`acceptLegacyVcSdJwtTyp` (`@tamga-network/sd-jwt`, defolt `true`); `false` verilərsə, xarici növlərdə də yalnız `dc+sd-jwt` qəbul
edilir ([[ARCH-0005]]).

## 5.2 Gövdə — gizlədilməmiş sahələr

[[SPEC-SCHEMA-0001]] §4-ə əsasən `sd: "never"` olanlar həmişə açıqdır:

| Claim | Niyə açıqdır |
|---|---|
| `iss` | Kimin imzaladığı |
| `vct`, `vct#integrity` | Sxemin həlli ([[SPEC-SCHEMA-0001]] §7) |
| `iat` | Təzəlik |
| `cnf` | Key binding (§6) |
| `status` | Ləğv yoxlaması ([[SPEC-CRED-0003]]) |
| `_sd_alg`, `_sd` | Mexanizmin özü |
| `exp` | Varsa |
| `category` | Varsa — sənədi verən qurumun **sinfi** siqnalı ([[ADR-0010]] K5): `urn:tamga:eaa:pub` (PUB) / `urn:tamga:eaa:qualified` (QUALIFIED); I1–I2 sənədi verən qurumlar bunu əlavə etmir; yoxlayan tərəf qeydiyyatla çarpaz yoxlayır (C4). Sənəd sahibinin səviyyəsi heç vaxt ([[SPEC-PROTO-0001]]/PR7) |

## 5.3 `cnf` yerləşdirilməsi

```json
"cnf": {
  "jwk": {
    "kty": "EC",
    "crv": "P-256",
    "x": "f83OJ3D2xF1Bg8vub9tLe1gHMzV76e8Tus9uPHvRVEU",
    "y": "x_FEzRu9m36HLN_tue659LNpXW6pCyStikYjKIWI5a0"
  }
}
```

Rəqəmsal cüzdanın cihaz açarının **public** hissəsi. Şəxsi açar secure element-dən
heç vaxt çıxmır ([[SPEC-CRED-0001]] §3).

`cnf` **gizlədilə bilməz** (`sd: never`) — key binding yoxlaması üçün lazımdır.

---

# 6. KB-JWT (Key Binding JWT)

## 6.1 Struktur

Təqdimat anında rəqəmsal cüzdan tərəfindən yaradılır və birləşdirilmiş sətrin sonuna əlavə edilir.

Başlıq:

```json
{
  "alg": "ES256",
  "typ": "kb+jwt"
}
```

Gövdə:

```json
{
  "nonce": "1234567890abcdef",
  "aud": "https://verifier.example.com",
  "iat": 1789003600,
  "sd_hash": "Vx2mNqL8pRt4KzYwBhSaEc7JuFiGoNdXvCyTrMkZqPw"
}
```

| Claim | Mənası |
|---|---|
| `nonce` | Yoxlayan tərəfin verdiyi birdəfəlik dəyər — replay-in qarşısının alınması |
| `aud` | Hədəf yoxlayan tərəf — başqa yoxlayan tərəfə təkrar təqdim edilə bilməz |
| `iat` | Təqdimat anı |
| `sd_hash` | §6.2 — təqdim edilən dəstin bütövlüyü |

KB-JWT `cnf` daxilindəki açara uyğun gələn **şəxsi açarla** imzalanır.

## 6.2 `sd_hash` hesablanması

```
sd_hash = base64url( SHA-256( ASCII bytes of
    "<JWT>~<selected D1>~<selected D2>~...~"
))
```

**Diqqət edilməli məqamlar:**

- Hash-ə daxil olan sətir **KB-JWT istisna olmaqla** birləşdirilmiş təsvirdir.
- Sonuncu disclosure-dan sonrakı **`~` daxildir.**
- Yalnız **təqdim edilən** disclosure-lar daxildir; rəqəmsal cüzdanda qalanlar yox.

## 6.3 Niyə lazımdır

`sd_hash` olmasaydı, araya girən tərəf təqdim edilən disclosure-ların bəzilərini
**çıxara bilərdi** — JWT imzası və KB-JWT imzası yenə də etibarlı qalardı.

Nümunə hücum: Ayşe diplomunu `is_graduate` + `grade` ilə təqdim edir. Araya
girən tərəf `grade` disclosure-unu silir. `sd_hash` olmadan yoxlayan tərəf bunu hiss
edə bilməz və natamam təqdimatı tam hesab edir. `sd_hash` təqdim edilən dəsti **dəqiq olaraq**
olduğu kimi bağlayır.

## 6.4 Tamga-da istisnasız məcburidir

KB-JWT olmayan təqdimat **rədd edilir.** Standart bunu opsional saxlayır;
Tamga isə yox — [[SPEC-CRED-0001]] §3-dəki [[t:holder-binding]] əsaslandırması.

`cnf` əhatə həddi ([[SPEC-CRED-0001]] §3) xatırladılır: KB-JWT
**açar üzərində nəzarəti** sübut edir, **şəxsin kimliyini** yox.

---

# 7. Uçdan-uca nümunə

[[SPEC-SCHEMA-0002]] §3.6-dakı diplom, wire format səviyyəsində.

## 7.1 Rəqəmsal sənədin verilməsi — sənədi verən qurum nə yaradır

Sxemin `claims` bloku ([[SPEC-SCHEMA-0002]] §5.2) `sd` siyasətini müəyyən edir:

| Claim | `sd` | Nəticə |
|---|---|---|
| `birth_date`, `grade`, `thesis_title` | `always` | **Məcburi gizli** |
| `family_name`, `given_name`, `qualification_title`, `eqf_level`, `isced_f_code`, `awarding_date`, `awarding_body_name`, `awarding_body_id`, `awarding_body_country`, `nqf_level`, `mode_of_study`, `credit_points`, `grading_scheme`, `is_graduate`, `graduated_before` | `allowed` | Sənədi verən qurum gizlədir |
| `iss`, `vct`, `iat`, `cnf`, `status`, `_sd_alg` | `never` | Açıq |

Tamga-da sənədi verən qurum `allowed` sahələrin **hamısını** gizlədir. Əsaslandırma: gizlətməyin
xərci yoxdur, gizlətməməyin isə geri dönüşü yoxdur.

Nəticə: 18 disclosure.

```
eyJhbGciOiJFUzI1NiIsInR5cCI6ImRjK3NkLWp3dCIsIng1YyI6WyJNSUlCLi4uIl19
.eyJpc3MiOiJodHRwczovL2lzc3Vlci5iaWxnaS5lZHUudHIiLCJ2Y3QiOiJodHRwczo...
.MEUCIQDx7... 
~WyJPdktjUVhzTzFZZ21rZnhNb3dlLVVnIiwgImZhbWlseV9uYW1lIiwgIll..."
~WyJoTjJ4UjhwTHc0S3ZUeTBhIiwgImdpdmVuX25hbWUiLCAiQXlcdTAxNWZlIl0
~WyJtUTdmVjNzWnAxTndFeThiIiwgImJpcnRoX2RhdGUiLCAiMjAwMy0wNC0xNyJd
~... (15 more disclosures) ...
~
```

Sondakı boş `~` — KB-JWT yoxdur.

## 7.2 Presentation — işəgötürən ssenarisi

[[SPEC-SCHEMA-0002]] §3.7-yə əsasən 7 sahə açılır: `is_graduate`,
`qualification_title`, `eqf_level`, `isced_f_code`, `awarding_body_name`,
`awarding_date`, `family_name`, `given_name`.

Rəqəmsal cüzdan:

1. 18 disclosure-dan 8-ini seçir, 10-unu **sətirdən çıxarır.**
2. `sd_hash` dəyərini qalan sətir əsasında hesablayır (§6.2).
3. KB-JWT-ni cihaz açarı ilə imzalayır.

```
<same JWT — unchanged>~D_family~D_given~D_qual~D_eqf~D_isced~D_body~D_date~D_grad~<KB-JWT>
```

**İşəgötürənin görmədiyi:** `grade` (3.42), `thesis_title`, `birth_date`,
`credit_points`, `mode_of_study`, `grading_scheme`, `nqf_level`,
`graduated_before`, `awarding_body_id`, `awarding_body_country`.

Bunların **digest-lərini** `_sd` massivində görür, lakin digest-dən dəyəri
çıxara bilmir (salt sayəsində, §3.2).

---

# 8. Yoxlama alqoritmi

Normativdir. Bu, yoxlamanın **format** qatıdır; sxem qatı
[[SPEC-SCHEMA-0001]] §7-də, ləğv qatı [[SPEC-CRED-0003]] §7-dədir. Tam
ardıcıllıq [[SPEC-API-0001]] sənədində birləşdirilir.

```
Ş1.  Split the string on ~.
     First element = JWT. Last element = KB-JWT (if empty → REJECT, §6.4).
     The ones in between = disclosures.

Ş2.  Decode the JWT header.
     alg != "ES256" → REJECT.
     typ != "dc+sd-jwt" → REJECT.
       ("vc+sd-jwt" accepted only for an external type (not in the Tamga catalogue);
        on by default, can be turned off with the flag — §5.1.1; REJECT for a Tamga type, C13)
     No x5c → REJECT.

Ş3.  Verify the x5c chain (SPEC-ID-0002).
     Root not RootCARegistry.isChainAcceptable → REJECT  (RETIRED accepted, REVOKED rejected)
     Leaf certificate revoked in CRL/OCSP → REJECT
     Verify the JWT signature with the leaf certificate key → if invalid, REJECT.
     issuerId = keccak256(stateCode, SHA-256(x5c[0] DER))   ← NOT from the iss claim
     iss claim inconsistent with the registered issuer metadata → REJECT

Ş3b. No cnf claim → REJECT (KB-JWT mandatory without exception; an SD-JWT VC without cnf is invalid in Tamga).

Ş4.  Read _sd_alg. Not "sha-256" → REJECT.

Ş5.  For each disclosure:
       a) digest = base64url(SHA-256(ASCII bytes of the disclosure string))
          ← hash FIRST, decode AFTERWARDS (§3.3)
       b) Is the digest in the _sd array? If not → REJECT (unmatched disclosure)
       c) base64url-decode → JSON array
       d) Array does not have 3 elements → REJECT
       e) Salt < 128 bits → REJECT
       f) Claim name already present in the clear in the payload → REJECT (collision)

Ş6.  The same digest claimed by two disclosures → REJECT.

Ş7.  Place the decoded claims into the payload. Remove _sd and _sd_alg.

Ş8.  KB-JWT:
       a) typ == "kb+jwt", alg == "ES256"
       b) Verify the signature with the key in cnf → if invalid, REJECT
       c) aud == my own identifier → otherwise REJECT
       d) nonce == the one I issued → otherwise REJECT
       e) iat within the freshness window: |now - iat| ≤ 300 s → otherwise REJECT
       f) Compute sd_hash yourself and compare with the one in the KB-JWT → mismatch → REJECT

Ş9.  If exp is present, has it passed → if so, REJECT.

Ş10. Result: the verified claim set.
     Continue: schema (SPEC-SCHEMA-0001 §7), revocation (SPEC-CRED-0003 §7).
```

## 8.1 Ş5(b) niyə kritikdir

Uyğun gəlməyən disclosure-u qəbul etmək təcavüzkara rəqəmsal sənədə **sahə
əlavə etməyə** imkan verir. Digest `_sd` daxilində yoxdursa, həmin disclosure sənədi verən qurum tərəfindən
imzalanmayıb.

## 8.2 Ş5(f) — toqquşma

Disclosure payload-da artıq açıq olan claim-i daşıyırsa, rədd edilir.
Əks halda `iss` və ya `vct` kimi kritik sahələrin üzərinə yazıla bilər.

---

# 9. İnvariantlar

| # | İnvariant |
|---|---|
| **C1** | `alg` həmişə `ES256` olur. |
| **C2** | `_sd_alg` həmişə `sha-256` olur, açıq şəkildə yazılır. |
| **C3** | Salt ≥ 128 bit, hər disclosure üçün unikaldır. |
| **C4** | Digest disclosure **sətrinin** hash-idir; yenidən serializasiya edilmir. |
| **C5** | `_sd` massivi sıralanmışdır. |
| **C6** | Decoy digest istifadə edilmir. |
| **C7** | `x5c` məcburidir; kök sertifikat daxil edilmir. |
| **C8** | KB-JWT istisnasız məcburidir. |
| **C9** | `sd_hash` təqdim edilən dəst əsasında və sondakı `~` daxil olmaqla hesablanır. |
| **C10** | Uyğun gəlməyən disclosure rədd edilir. |
| **C11** | İç-içə seçici paylaşım ən çoxu 2 səviyyədir. |
| **C12** | Gizlətmək = sətirdən çıxarmaq; JWT heç vaxt yenidən imzalanmır. |
| **C13** | `typ` həmişə `dc+sd-jwt` olur; Tamga-nın sənədi verən qurumlarından `vc+sd-jwt` qəbul edilmir. |
| **C14** | Yoxlayan tərəf disclosure-u açıb yenidən serializasiya etmir (§3.5). |
| **C15** | `issuerId` yarpaq sertifikatın barmaq izindən törədilir; `iss` yalnız uzlaşma yoxlamasıdır. |
| **C16** | `cnf` claim-i olmayan SD-JWT VC rədd edilir. |
| **C17** | KB-JWT `iat` pəncərəsi ±300 saniyədir. |
| **C18** | `category` claim-i yalnız qeydiyyat sinfi PUB/QUALIFIED olan sənədi verən qurumlarda və yalnız `urn:tamga:eaa:pub|qualified` dəyərləri ilə olur; Aİ URN-ləri (`urn:etsi:esi:eaa:eu:*`) istifadə edilmir; sənəd sahibinin assurance səviyyəsi heç bir claim-də daşınmır ([[ADR-0010]] K5). |

---

# Təhlükəsizlik qeydləri

**Yenidən serializasiya (C4).** Ən çox rast gəlinən tətbiq xətası. Kitabxana
disclosure-u açıb yenidən serializasiya edərək hash-ləyərsə, Unicode escape və ya boşluq
fərqi səbəbindən hash uyğun gəlmir. Əlamət: "öz yaratdığım rəqəmsal sənədi
yoxlaya bilmirəm."

**Salt-ın təkrar istifadəsi.** Eyni salt iki rəqəmsal sənəddə eyni claim üçün
istifadə edilərsə, iki digest eyni olur və sənədlər bir-biri ilə əlaqələndirilə bilər.
Generator hər dəfə yeni salt verməlidir.

**`nonce` birdəfəlik olmalıdır.** Yoxlayan tərəf [[t:nonce]] dəyərini saxlamalı və onu təkrar
qəbul etməməlidir; əks halda qeydə alınmış təqdimat təkrar istifadə edilə bilər (replay).
`aud` ikinci müdafiə xəttidir.

**Disclosure sayı üzrə yan kanal.** §4.4-də nəzərdən keçirilib; həll yolu sabit disclosure
dəstidir, decoy deyil.

---

# Açıq məsələlər

1. ~~`typ` dəyərinin təsdiqi~~ — **BAĞLANDI** (2026-09-09). `dc+sd-jwt` təsdiqləndi,
   keçid dövrü və `vc+sd-jwt` qərarı §5.1.1-də yazıldı.
2. Massiv elementinin selective disclosure-u (transkriptdə tək sətrin gizlədilməsi) ilk mərhələdə
   istifadə edilmir. Transkript sxemi yazıldıqda lazım olacaq → [[SPEC-SCHEMA-0002]]
   əhatəsinin genişləndirilməsi.
3. ~~Sabit disclosure dəstinin əhatəsi~~ — **BAĞLANDI** ([[SPEC-WALLET-0001]]/WL6):
   **yoxlayan tərəf + `vct` üzrə**, sessiya üzrə yox. Təhdid eyni yoxlayan tərəfə
   edilən iki təqdimatın müqayisə edilməsidir.
4. ~~Toplu sənəd verilməsində `cnf` eynidir, yoxsa fərqli~~ — **BAĞLANDI** (2026-09-09,
   [[SPEC-PROTO-0001]] §8.2, PR6). Hər nüsxə **fərqli cihaz açarına** bağlanır;
   eyni `cnf` istifadə edilsəydi, nüsxələr bir-biri ilə əlaqələndirilə bilərdi və batch-in bütün
   məqsədi itərdi. Salt-lar da təbii olaraq fərqlidir (C3).

---

# Əlaqəli sənədlər

[[SPEC-CRED-0001]] · [[SPEC-CRED-0003]] · [[SPEC-SCHEMA-0001]] ·
[[SPEC-SCHEMA-0002]] · [[SPEC-ID-0002]] · [[SPEC-BC-0001]] · [[ADR-0006]] ·
[[SPEC-PROTO-0001]] · [[SPEC-PROTO-0002]] · [[SPEC-API-0001]]

---

# Status

**Qüvvədədir** — versiya 1.0.0 (2026-10-02; §5.1.1 xarici növlərdə `vc+sd-jwt` 2026-10-13).

