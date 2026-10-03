---
document_id: SPEC-CRED-0002
title: "SD-JWT VC profili"
status: Active
version: 1.0.0
created: 2026-09-09
last_updated: 2026-10-02
summary: >
  Bir Tamga belgesinin baytlarını tanımlar. Disclosure nasıl üretilir
  (salt, dizi yapısı, JSON serileştirme kuralı, base64url), _sd dizisi nasıl
  doldurulur ve neden sıralanır, decoy digest politikası, _sd_alg, cnf ve x5c
  yerleşimi, ~ ayraçlı birleşik biçim, KB-JWT'nin sd_hash hesabı, ve on adımlı
  doğrulama algoritması. SPEC-SCHEMA-0002'deki diploma örneği baştan sona
  gerçek baytlarla işlenir. Tamga profili normatif kısıtlar getirir: ES256
  zorunlu, _sd_alg sha-256, KB-JWT istisnasız zorunlu, decoy yasak.
---
**Bu şartname, Tamga'nın SD-JWT VC belgesini bayt düzeyinde tanımlar.** Belge veren ya da doğrulayan kodu kendisi yazan
geliştiriciler içindir.

**Ne zaman okunur**

- Önce [Belge biçimleri](/concepts/credential-formats) ve [Gizlilik](/concepts/privacy) kavram sayfalarını, biçim kararları için [[SPEC-CRED-0001]]'i okuyun.
- `@tamga-network` paketlerini kullanmadan kendi SD-JWT üreticinizi ya da doğrulayıcınızı yazarken.
- Sonra: belgenin nasıl verildiği [[SPEC-PROTO-0001]], nasıl gösterildiği [[SPEC-PROTO-0002]].

**Kısaca.** [[t:SD-JWT-VC]], kurumun imzaladığı bir JWT ile ayrı ayrı açılabilen alanlardan oluşur. Her alan rastgele bir salt ile
özetlenir ([[t:salted-hash]]); JWT yalnızca bu özetleri taşır. Kişi bir alanı göstermek istediğinde o alanın [[t:disclosure]]'ını ekler;
doğrulayıcı özeti yeniden hesaplayıp JWT'dekiyle karşılaştırır. Sunumun sonuna eklenen kısa bir imza ([[t:KB-JWT]]), belgeyi sunanın kişinin cihazındaki
anahtarı elinde tuttuğunu kanıtlar.

---

# Kapsam

[[SPEC-CRED-0001]] biçimi **seçti**; bu belge biçimi **yazar.** Bir Tamga
[[t:credential|belgesinin]] her baytı burada tanımlıdır.

**Standart temeli:** SD-JWT — **RFC 9901**. SD-JWT VC —
draft-ietf-oauth-sd-jwt-vc (Tip Metadata mekanizması [[SPEC-SCHEMA-0001]]'de
ele alınmıştır).

Kapsam dışı: belge verme protokolü ([[SPEC-PROTO-0001]]), sunum protokolü
([[SPEC-PROTO-0002]]), [[t:revocation]] ([[SPEC-CRED-0003]]).

---

# 1. Tamga Profili — Normatif Kısıtlar

Standart birçok seçenek bırakır. Tamga bunları daraltır:

| Konu | Standart | **Tamga** | Gerekçe |
|---|---|---|---|
| İmza algoritması | Çeşitli | **ES256 (P-256)** | Mobil secure element ve HSM'de evrensel |
| `typ` | `dc+sd-jwt` | **`dc+sd-jwt`, `vc+sd-jwt` reddedilir** | §5.1.1 |
| Serileştirme | Serbest | **Sabit sözleşme (üretimde)** | §3.5 |
| `_sd_alg` | Çeşitli | **`sha-256`** | Tek hash, uygulama karmaşıklığı yok |
| Salt uzunluğu | ≥128 bit önerilir | **128 bit (16 bayt)** | Standardın önerisi |
| Key binding | Opsiyonel | **İstisnasız zorunlu** | [[SPEC-CRED-0001]] §3 |
| Decoy digest | İzinli | **Yasak** | §4.4 |
| Belge veren kimliği | `iss` / `x5c` / `kid` | **`x5c` zorunlu** | [[SPEC-ID-0002]] |
| İç içe selective disclosure | İzinli | **En fazla 2 seviye** | [[RS-SCHEMA-0001]] §9 |
| Dizi elemanı gizleme | İzinli | **ilk aşamada kullanılmaz** | Karmaşıklık; ihtiyaç yok |

---

# 2. Anatomi

Bir SD-JWT VC üç parçadan oluşur ve **tilde (`~`)** ile ayrılır:

```
<Issuer-signed JWT>~<Disclosure 1>~<Disclosure 2>~...~<KB-JWT>
```

Kurallar:

- Ayraç `~` (U+007E).
- İhraç anında son eleman **boştur** — yani dize `~` ile biter (KB-JWT henüz
  yok).
- Sunum anında son eleman KB-JWT'dir.
- Disclosure sırası **anlamsızdır** ve doğrulayıcı sıraya güvenmemelidir.

```
İhraç edilen (cüzdanda duran):
  JWT~D1~D2~D3~D4~D5~D6~D7~

Gösterilen (doğrulayıcıya giden — yalnızca 3 disclosure seçilmiş):
  JWT~D2~D5~D6~KB-JWT
```

**Kritik gözlem:** Cüzdan, sunmadığı disclosure'ları **dizeden çıkarır.** JWT
değişmez, imza geçerli kalır. Gizlemek bir şey eklemek değil, **çıkarmaktır.**

---

# 3. Disclosure Üretimi

## 3.1 Yapı

[[t:selective-disclosure]] ile açıklanabilir her claim için üç elemanlı bir JSON dizisi:

```json
["<salt>", "<claim adı>", <claim değeri>]
```

Bu dizi JSON olarak serileştirilir, UTF-8'e çevrilir, **base64url** (padding'siz)
kodlanır. Sonuç, disclosure dizesidir.

## 3.2 Salt

- **128 bit (16 bayt)**, kriptografik olarak güvenli üreteçten.
- Her disclosure için **yeni** salt. Aynı salt iki kez kullanılamaz.
- base64url (padding'siz) olarak dizide yer alır → 22 karakter.

**Neden salt:** Salt olmasaydı, `["given_name","Ayşe"]` dizisinin hash'i
sabit olurdu. [[t:verifier|Doğrulayıcı]] gizlenmiş bir digest'i görüp sözlük saldırısıyla
"bu alan `given_name` ve değeri `Ayşe`" diye tahmin edebilirdi. `birth_date`
gibi düşük entropili alanlarda bu saldırı önemsiz maliyetlidir.

## 3.3 Serileştirme kuralı — en kritik uygulama detayı

**Disclosure'ın hash'i, disclosure *dizesinin* hash'idir — dizinin yeniden
serileştirilmiş hâlinin değil.**

```
digest = base64url( SHA-256( ASCII baytları of <disclosure dizesi> ) )
```

Yani:

1. [[t:issuer|Belge veren]] diziyi JSON'a serileştirir → **bu baytlar artık sabittir**
2. base64url ile kodlar → disclosure dizesi
3. digest = SHA-256(disclosure dizesinin **ASCII baytları**)

Doğrulayıcı ters yönde gider: disclosure dizesini alır, **önce hash'ler**,
sonra çözer. Asla çözüp yeniden serileştirip hash'lemez.

**Neden bu kadar önemli:** JSON serileştirmesi belirlenimci değildir. Boşluk,
Unicode kaçışı (`\u00e7` vs `ç`), anahtar sırası — hepsi farklı bayt üretir ve
farklı hash verir. Yeniden serileştiren bir uygulama, kendi ürettiği
belgeleri bile doğrulayamaz.

Bu, SD-JWT uygulamalarında **en sık yapılan hatadır.**

## 3.4 Örnek — gerçek değerlerle

`given_name: "Ayşe"` alanını gizleyelim. **Aşağıdaki değerler gerçek hesap
çıktısıdır**, uydurma değildir; Tamga serileştirme sözleşmesiyle (§3.5)
üretilmiştir.

```
1. Salt (16 bayt):
   hex        : 3af29c417b0ed5882691ff4ca307be52
   base64url  : OvKcQXsO1Ygmkf9Mowe-Ug          (22 karakter)

2. JSON dizisi (bu baytlar artık sabittir):
   ["OvKcQXsO1Ygmkf9Mowe-Ug", "given_name", "Ay\u015fe"]

3. UTF-8 → base64url = DISCLOSURE:
   WyJPdktjUVhzTzFZZ21rZjlNb3dlLVVnIiwgImdpdmVuX25hbWUiLCAiQXlcdTAxNWZlIl0

4. digest = base64url(SHA-256(3. adımdaki dizenin ASCII baytları)):
   nM_EESmLJt3b0fzNu1paGyiAfSLs4Npf2yEjUn0upSo   (43 karakter)
```

İki örnek daha:

| Claim | Disclosure | Digest |
|---|---|---|
| `family_name: "Yılmaz"` | `WyJDWmNVejJVZEJpdzM5b2ZYSC1ZRmhRIiwgImZhbWlseV9uYW1lIiwgIllcdTAxMzFsbWF6Il0` | `z1_SoX1L6xCo9GKQf0f5lEdLisaiHfvejfETWcUCLNs` |
| `grade: "3.42"` | `WyIweEtpU3JVZ1RULWtYNVNsTUNnS09BIiwgImdyYWRlIiwgIjMuNDIiXQ` | `rdPfUM0_1bDXDRhvpkze7Im098NzDSfvn9tG2CMDTmM` |

Digest `_sd` dizisine girer. Disclosure, JWT'nin **dışında**, `~` ile ayrılmış
olarak taşınır.

## 3.5 Serileştirme sözleşmesi ve yeniden serileştirme tuzağı

### Tuzağın gösterimi

Yukarıdaki disclosure'ı çözelim ve **yeniden serileştirelim**:

```
Çözülen dizi:
  ["OvKcQXsO1Ygmkf9Mowe-Ug", "given_name", "Ayşe"]      ← aynı veri

Farklı serileştirme (boşluksuz, Unicode kaçışsız):
  ["OvKcQXsO1Ygmkf9Mowe-Ug","given_name","Ayşe"]

Bu dizeden hesaplanan digest:
  c94D71JDfX8hzanT-ZpRWBn5oNX_RkStfSfkvTmY_kU

Orijinal digest:
  nM_EESmLJt3b0fzNu1paGyiAfSLs4Npf2yEjUn0upSo

EŞLEŞMİYOR.
```

Veri **birebir aynı.** Değişen tek şey iki boşluk ve `ş` karakterinin kaçış
biçimi. Digest tamamen farklı.

Doğrulayıcı bu yüzden disclosure'ı **önce hash'ler, sonra çözer** (§8, Ş5a).
Çözüp yeniden serileştiren bir uygulama, kendi ürettiği belgeyi bile
doğrulayamaz — ve belirti tam olarak budur.

### Tamga belge veren sözleşmesi (normatif)

Doğrulama tarafı serileştirmeden bağımsız çalışır (dize neyse o hash'lenir).
Ancak **belge veren tarafında** sözleşme sabitlenir; aksi hâlde farklı Tamga belge veren
uygulamaları karşılaştırılabilir test vektörü üretemez:

| Kural | Değer |
|---|---|
| Unicode | `ensure_ascii` — ASCII dışı karakterler `\uXXXX` olarak kaçırılır |
| Eleman ayracı | `", "` (virgül + boşluk) |
| Dizi | Tam olarak 3 eleman, sırayla salt, ad, değer |

Bu sözleşme **yalnızca üretim içindir.** Doğrulayıcı, sözleşmeye uymayan
disclosure'ları da doğrulayabilir ve doğrulamalıdır — dış ekosistemlerden gelen
belgeler farklı sözleşme kullanabilir.

---

# 4. `_sd` Dizisi

## 4.1 Yerleşim

Gizlenen claim'lerin digest'leri, o claim'in bulunacağı JSON nesnesinin
içindeki `_sd` dizisinde toplanır:

```json
{
  "iss": "https://issuer.bilgi.edu.tr",
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

Gizlenmeyen claim'ler (`eqf_level` gibi) doğrudan payload'da durur.

## 4.2 Sıralama — normatif

`_sd` dizisi **her zaman sıralanır** (baytsal artan sırada).

**Neden:** Sıralanmazsa dizideki sıra, orijinal claim sırasını ele verir.
Bir doğrulayıcı, gizlenmiş digest'lerin şemadaki alan sırasıyla eşleştiğini
görürse hangi alanların gizlendiğini çıkarabilir.

Sıralama bu yan kanalı kapatır.

## 4.3 `_sd_alg`

Payload'ın **kök seviyesinde**, bir kez:

```json
"_sd_alg": "sha-256"
```

Tamga'da her zaman `sha-256`'dır. Değer yoksa varsayılan `sha-256` kabul
edilir, ancak Tamga belge verenleri **açıkça yazar.**

## 4.4 Decoy digest — Tamga'da yasak

Standart, `_sd` dizisine hiçbir disclosure'a karşılık gelmeyen sahte
("decoy") digest'ler eklemeye izin verir. Amaç, gizlenmiş alan **sayısını**
belirsizleştirmektir.

**Tamga'da yasaktır.** Gerekçeler:

1. **Şema zaten sayıyı ele veriyor.** `vct` açıktadır; doğrulayıcı şemayı
   çözümleyip kaç alan olduğunu tam olarak bilir. Decoy, bilinen bir sayıyı
   gizlemeye çalışır — koruma sağlamaz.
2. **Doğrulanamaz asimetri.** Decoy sayısı belge verenin keyfine kalır; iki belge veren
   farklı sayıda decoy koyarsa bu farkın kendisi bir parmak izi olur.
3. **Boyut.** Her decoy 43 karakterdir; QR kodu boyutunu gereksiz büyütür.

Gizlenmiş alan sayısının bir yan kanal olduğu doğrudur
([[SPEC-SCHEMA-0002]] Güvenlik notları); çözümü decoy değil, cüzdanın aynı
doğrulayıcıya **tutarlı disclosure seti** sunmasıdır.

---

# 5. Issuer-signed JWT

## 5.1 Başlık

```json
{
  "alg": "ES256",
  "typ": "dc+sd-jwt",
  "x5c": ["MIIB<issuer sertifikası>", "MIIC<ara CA>"]
}
```

| Alan | Tamga kuralı |
|---|---|
| `alg` | `ES256` — başka değer reddedilir |
| `typ` | **`dc+sd-jwt`** — §5.1.1 |
| `x5c` | **Zorunlu.** Yaprak sertifika ilk sırada, kök **dahil edilmez** |

Kök sertifika `x5c`'ye konmaz; zincir `RootCARegistry`'deki çapaya bağlanır
([[SPEC-ID-0002]], [[SPEC-BC-0001]]).

### 5.1.1 `typ` değeri ve `vc+sd-jwt` uyumluluğu

Standart, belge verenin `typ` başlık parametresini eklemesini ve değerinin
**`dc+sd-jwt`** olmasını zorunlu kılar. Medya tipi
`application/dc+sd-jwt`'dir; `dc` alt tipi "digital credential" anlamındadır.

**Tarihçe — bilinmesi gerekir.** Taslak, Temmuz 2023'teki başlangıcından Kasım
2024'e kadar `typ` değeri olarak **`vc+sd-jwt`** kullanmıştır. W3C'nin
Verifiable Credentials Data Model taslağının kaydettiği `vc` medya tipi adıyla
çakışmayı önlemek için `dc+sd-jwt`'ye çevrilmiştir.

Bu değişikliğin ardından taslaklara bir geçiş notu eklenmişti: doğrulayıcı ve
[[t:holder|belge sahiplerinin]] makul bir geçiş süresi boyunca **her iki değeri de** kabul etmesi
öneriliyordu. Ancak bu not sonraki taslak revizyonlarında **kaldırılmıştır** —
yani geçiş dönemi standart tarafından sona ermiş sayılmaktadır.

**Tamga kararı:**

| Yön | Kural |
|---|---|
| **İhraç** | Yalnızca `dc+sd-jwt`. `vc+sd-jwt` üretilmez. |
| **Doğrulama — Tamga belge verenleri** | Yalnızca `dc+sd-jwt` kabul edilir. `vc+sd-jwt` **reddedilir.** |
| **Doğrulama — dış ekosistem** | Yapılandırılabilir uyumluluk bayrağı, **varsayılan kapalı**; açıksa kabul edilir ama denetim kaydına uyarı yazılır. |

Gerekçe: Tamga'nın hiçbir eski yükü (legacy) yoktur — tüm belge verenler yenidir.
`vc+sd-jwt` üreten bir uygulama iki yıl geride demektir ve bu, başka
uyumsuzlukların da habercisidir. Buna karşılık dış ekosistemden gelen bir
belgeyi sırf `typ` yüzünden reddetmek, interop'u gereksiz kırabilir; bu
yüzden bayrak vardır ama kapalıdır.

`@tamga-network/verifier` bu bayrağı `acceptLegacyVcSdJwtTyp: false` olarak tanımlar
([[ARCH-0005]]).

## 5.2 Gövde — gizlenmemiş alanlar

[[SPEC-SCHEMA-0001]] §4 uyarınca `sd: "never"` olanlar her zaman açıktadır:

| Claim | Neden açık |
|---|---|
| `iss` | Kimin imzaladığı |
| `vct`, `vct#integrity` | Şema çözümlemesi ([[SPEC-SCHEMA-0001]] §7) |
| `iat` | Tazelik |
| `cnf` | Key binding (§6) |
| `status` | İptal kontrolü ([[SPEC-CRED-0003]]) |
| `_sd_alg`, `_sd` | Mekanizmanın kendisi |
| `exp` | Varsa |
| `category` | Varsa — belge veren **sınıfı** sinyali ([[ADR-0010]] K5): `urn:tamga:eaa:pub` (PUB) / `urn:tamga:eaa:qualified` (QUALIFIED); I1–I2 belge verenler koymaz; doğrulayıcı kayıtla çapraz kontrol eder (C4). Belge sahibi seviyesi asla ([[SPEC-PROTO-0001]]/PR7) |

## 5.3 `cnf` yerleşimi

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

Cüzdanın cihaz anahtarının **public** kısmı. Özel anahtar secure element'ten
asla çıkmaz ([[SPEC-CRED-0001]] §3).

`cnf` **gizlenemez** (`sd: never`) — key binding doğrulaması için gerekli.

---

# 6. KB-JWT (Key Binding JWT)

## 6.1 Yapı

Sunum anında cüzdan tarafından üretilir ve birleşik dizenin sonuna eklenir.

Başlık:

```json
{
  "alg": "ES256",
  "typ": "kb+jwt"
}
```

Gövde:

```json
{
  "nonce": "1234567890abcdef",
  "aud": "https://verifier.example.com",
  "iat": 1789003600,
  "sd_hash": "Vx2mNqL8pRt4KzYwBhSaEc7JuFiGoNdXvCyTrMkZqPw"
}
```

| Claim | Anlam |
|---|---|
| `nonce` | Doğrulayıcının verdiği tek kullanımlık değer — replay önleme |
| `aud` | Hedef doğrulayıcı — başka doğrulayıcıya yeniden sunulamaz |
| `iat` | Sunum anı |
| `sd_hash` | §6.2 — sunulan setin bütünlüğü |

KB-JWT, `cnf` içindeki anahtara karşılık gelen **özel anahtarla** imzalanır.

## 6.2 `sd_hash` hesabı

```
sd_hash = base64url( SHA-256( ASCII baytları of
    "<JWT>~<seçilen D1>~<seçilen D2>~...~"
))
```

**Dikkat edilecekler:**

- Hash'e giren dize, **KB-JWT hariç** birleşik gösterimdir.
- Son disclosure'dan sonraki **`~` dahildir.**
- Yalnızca **sunulan** disclosure'lar dahildir; cüzdanda kalanlar değil.

## 6.3 Neden gerekli

`sd_hash` olmasaydı, araya giren bir taraf sunulan disclosure'lardan bazılarını
**çıkarabilirdi** — JWT imzası ve KB-JWT imzası yine geçerli kalırdı.

Örnek saldırı: Ayşe diplomasını `is_graduate` + `grade` ile sunuyor. Araya
giren taraf `grade` disclosure'ını siliyor. `sd_hash` olmadan doğrulayıcı bunu fark
edemez ve eksik bir sunumu tam sanır. `sd_hash` sunulan setin **tam olarak**
neyse onu bağlar.

## 6.4 Tamga'da istisnasız zorunlu

KB-JWT olmayan bir sunum **reddedilir.** Standart bunu opsiyonel bırakır;
Tamga bırakmaz — [[SPEC-CRED-0001]] §3'teki [[t:holder-binding]] gerekçesi.

`cnf` kapsam sınırı ([[SPEC-CRED-0001]] §3) hatırlatılır: KB-JWT
**anahtar kontrolünü** kanıtlar, **kişi kimliğini** değil.

---

# 7. Uçtan Uca Örnek

[[SPEC-SCHEMA-0002]] §3.6'daki diploma, wire format düzeyinde.

## 7.1 Belge verme — belge veren ne üretir

Şemanın `claims` bloğu ([[SPEC-SCHEMA-0002]] §5.2) `sd` politikasını verir:

| Claim | `sd` | Sonuç |
|---|---|---|
| `birth_date`, `grade`, `thesis_title` | `always` | **Zorunlu gizli** |
| `family_name`, `given_name`, `qualification_title`, `eqf_level`, `isced_f_code`, `awarding_date`, `awarding_body_name`, `awarding_body_id`, `awarding_body_country`, `nqf_level`, `mode_of_study`, `credit_points`, `grading_scheme`, `is_graduate`, `graduated_before` | `allowed` | Belge veren gizler |
| `iss`, `vct`, `iat`, `cnf`, `status`, `_sd_alg` | `never` | Açık |

Tamga'daki belge veren `allowed` alanların **tamamını** gizler. Gerekçe: gizlemenin
maliyeti yok, gizlememenin geri dönüşü yok.

Sonuç: 18 disclosure.

```
eyJhbGciOiJFUzI1NiIsInR5cCI6ImRjK3NkLWp3dCIsIng1YyI6WyJNSUlCLi4uIl19
.eyJpc3MiOiJodHRwczovL2lzc3Vlci5iaWxnaS5lZHUudHIiLCJ2Y3QiOiJodHRwczo...
.MEUCIQDx7... 
~WyJPdktjUVhzTzFZZ21rZnhNb3dlLVVnIiwgImZhbWlseV9uYW1lIiwgIll..."
~WyJoTjJ4UjhwTHc0S3ZUeTBhIiwgImdpdmVuX25hbWUiLCAiQXlcdTAxNWZlIl0
~WyJtUTdmVjNzWnAxTndFeThiIiwgImJpcnRoX2RhdGUiLCAiMjAwMy0wNC0xNyJd
~... (15 disclosure daha) ...
~
```

Sondaki boş `~` — KB-JWT yok.

## 7.2 Presentation — işveren senaryosu

[[SPEC-SCHEMA-0002]] §3.7 uyarınca 7 alan açılıyor: `is_graduate`,
`qualification_title`, `eqf_level`, `isced_f_code`, `awarding_body_name`,
`awarding_date`, `family_name`, `given_name`.

Cüzdan:

1. 18 disclosure'dan 8'ini seçer, 10'unu **dizeden çıkarır.**
2. `sd_hash`'i kalan dize üzerinden hesaplar (§6.2).
3. KB-JWT'yi cihaz anahtarıyla imzalar.

```
<aynı JWT — değişmedi>~D_family~D_given~D_qual~D_eqf~D_isced~D_body~D_date~D_grad~<KB-JWT>
```

**İşverenin göremediği:** `grade` (3.42), `thesis_title`, `birth_date`,
`credit_points`, `mode_of_study`, `grading_scheme`, `nqf_level`,
`graduated_before`, `awarding_body_id`, `awarding_body_country`.

Bunların **digest'lerini** `_sd` dizisinde görür, ama digest'ten değer
çıkaramaz (salt sayesinde, §3.2).

---

# 8. Doğrulama Algoritması

Normatif. Bu, doğrulamanın **format** katmanıdır; şema katmanı
[[SPEC-SCHEMA-0001]] §7'de, iptal katmanı [[SPEC-CRED-0003]] §7'dedir. Tam
sıralama [[SPEC-API-0001]]'de birleştirilir.

```
Ş1.  Dizeyi ~ ile böl.
     İlk eleman = JWT. Son eleman = KB-JWT (boşsa → RED, §6.4).
     Aradakiler = disclosure'lar.

Ş2.  JWT başlığını çöz.
     alg == "ES256" değilse → RED.
     typ != "dc+sd-jwt" → RED.
       ("vc+sd-jwt" yalnızca uyumluluk bayrağı açıksa ve dış ekosistem
        belgesi ise kabul; denetim kaydına uyarı — §5.1.1)
     x5c yoksa → RED.

Ş3.  x5c zincirini doğrula (SPEC-ID-0002).
     Kök RootCARegistry.isChainAcceptable değilse → RED  (RETIRED kabul, REVOKED red)
     Yaprak sertifika CRL/OCSP'de iptal edilmişse → RED
     JWT imzasını yaprak sertifikanın anahtarıyla doğrula → geçersizse RED.
     issuerId = keccak256(stateCode, SHA-256(x5c[0] DER))   ← iss claim'inden DEĞİL
     iss claim'i, kayıtlı issuer meta verisiyle tutarsızsa → RED

Ş3b. cnf claim'i yoksa → RED (KB-JWT istisnasız zorunlu; cnf'siz SD-JWT VC Tamga'da geçersiz).

Ş4.  _sd_alg'ı oku. "sha-256" değilse → RED.

Ş5.  Her disclosure için:
       a) digest = base64url(SHA-256(disclosure dizesinin ASCII baytları))
          ← ÖNCE hash'le, SONRA çöz (§3.3)
       b) digest, _sd dizisinde var mı? Yoksa → RED (eşleşmeyen disclosure)
       c) base64url çöz → JSON dizi
       d) Dizi 3 elemanlı değilse → RED
       e) Salt < 128 bit ise → RED
       f) Claim adı zaten payload'da açıkta varsa → RED (çakışma)

Ş6.  Aynı digest iki disclosure tarafından iddia ediliyorsa → RED.

Ş7.  Çözülen claim'leri payload'a yerleştir. _sd ve _sd_alg'ı kaldır.

Ş8.  KB-JWT:
       a) typ == "kb+jwt", alg == "ES256"
       b) cnf içindeki anahtarla imzayı doğrula → geçersizse RED
       c) aud == kendi tanımlayıcım → değilse RED
       d) nonce == benim verdiğim → değilse RED
       e) iat tazelik penceresinde: |now - iat| ≤ 300 sn → değilse RED
       f) sd_hash'i kendin hesapla, KB-JWT'dekiyle karşılaştır → tutmazsa RED

Ş9.  exp varsa geçmiş mi → geçmişse RED.

Ş10. Sonuç: doğrulanmış claim seti.
     Devam: şema (SPEC-SCHEMA-0001 §7), iptal (SPEC-CRED-0003 §7).
```

## 8.1 Ş5(b) neden kritik

Eşleşmeyen bir disclosure'ı kabul etmek, saldırganın belgeye **alan
eklemesine** izin verir. Digest `_sd`'de yoksa o disclosure belge veren tarafından
imzalanmamıştır.

## 8.2 Ş5(f) — çakışma

Bir disclosure, payload'da zaten açıkta duran bir claim'i taşıyorsa reddedilir.
Aksi hâlde `iss` veya `vct` gibi kritik alanlar üzerine yazılabilir.

---

# 9. Değişmezler

| # | Değişmez |
|---|---|
| **C1** | `alg` her zaman `ES256`. |
| **C2** | `_sd_alg` her zaman `sha-256`, açıkça yazılır. |
| **C3** | Salt ≥ 128 bit, her disclosure için benzersiz. |
| **C4** | Digest, disclosure **dizesinin** hash'idir; yeniden serileştirme yapılmaz. |
| **C5** | `_sd` dizisi sıralıdır. |
| **C6** | Decoy digest kullanılmaz. |
| **C7** | `x5c` zorunlu; kök sertifika dahil edilmez. |
| **C8** | KB-JWT istisnasız zorunlu. |
| **C9** | `sd_hash`, sunulan set üzerinden ve sondaki `~` dahil hesaplanır. |
| **C10** | Eşleşmeyen disclosure reddedilir. |
| **C11** | İç içe seçici açıklama en fazla 2 seviye. |
| **C12** | Gizlemek = dizeden çıkarmak; JWT hiçbir zaman yeniden imzalanmaz. |
| **C13** | `typ` her zaman `dc+sd-jwt`; Tamga belge verenlerinden `vc+sd-jwt` kabul edilmez. |
| **C14** | Doğrulayıcı disclosure'ı çözüp yeniden serileştirmez (§3.5). |
| **C15** | `issuerId` yaprak sertifika parmak izinden türetilir; `iss` yalnızca tutarlılık kontrolüdür. |
| **C16** | `cnf` claim'i olmayan SD-JWT VC reddedilir. |
| **C17** | KB-JWT `iat` penceresi ±300 saniyedir. |
| **C18** | `category` claim'i yalnızca kayıt sınıfı PUB/QUALIFIED olan belge verenlerde ve yalnızca `urn:tamga:eaa:pub|qualified` değerleriyle bulunur; AB URN'leri (`urn:etsi:esi:eaa:eu:*`) kullanılmaz; belge sahibi assurance hiçbir claim'de taşınmaz ([[ADR-0010]] K5). |

---

# Güvenlik Notları

**Yeniden serileştirme (C4).** En sık yapılan uygulama hatası. Bir kütüphane
disclosure'ı çözüp yeniden serileştirip hash'lerse, Unicode kaçışı veya boşluk
farkı yüzünden hash tutmaz. Belirti: "kendi ürettiğim belgeyi
doğrulayamıyorum."

**Salt yeniden kullanımı.** Aynı salt iki belgede aynı claim için
kullanılırsa, iki digest özdeş olur ve belgeler ilişkilendirilebilir.
Üreteç her seferinde yeni salt vermelidir.

**`nonce` tek kullanımlık olmalı.** Doğrulayıcı [[t:nonce]]'u saklamalı ve tekrar
kabul etmemelidir; aksi hâlde kaydedilmiş bir sunum yeniden oynatılabilir.
`aud` ikinci savunma hattıdır.

**Disclosure sayısı yan kanalı.** §4.4'te ele alındı; çözüm tutarlı disclosure
seti, decoy değil.

---

# Açık Konular

1. ~~`typ` değeri teyidi~~ — **KAPANDI** (2026-09-09). `dc+sd-jwt` doğrulandı,
   geçiş dönemi ve `vc+sd-jwt` kararı §5.1.1'de yazıldı.
2. Dizi elemanı selective disclosure'ı (bir transkriptte tek satırı gizleme) ilk aşamada
   kullanılmıyor. Transkript şeması yazıldığında gerekecek → [[SPEC-SCHEMA-0002]]
   kapsam genişletmesi.
3. ~~Tutarlı disclosure seti kapsamı~~ — **KAPANDI** ([[SPEC-WALLET-0001]]/WL6):
   **doğrulayıcı + `vct` başına**, oturum başına değil. Tehdit, aynı doğrulayıcıya
   yapılan iki sunumun karşılaştırılmasıdır.
4. ~~Toplu belge vermede `cnf` aynı mı farklı mı~~ — **KAPANDI** (2026-09-09,
   [[SPEC-PROTO-0001]] §8.2, PR6). Her kopya **farklı cihaz anahtarına** bağlanır;
   aynı `cnf` kullanılsaydı kopyalar birbirine bağlanabilir ve batch'in tüm
   amacı yok olurdu. Saltlar da doğal olarak farklıdır (C3).

---

# İlgili Dokümanlar

[[SPEC-CRED-0001]] · [[SPEC-CRED-0003]] · [[SPEC-SCHEMA-0001]] ·
[[SPEC-SCHEMA-0002]] · [[SPEC-ID-0002]] · [[SPEC-BC-0001]] · [[ADR-0006]] ·
[[SPEC-PROTO-0001]] · [[SPEC-PROTO-0002]] · [[SPEC-API-0001]]

---

# Durum

**Yürürlükte** — sürüm 1.0.0 (2026-10-02).

