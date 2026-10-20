---
document_id: GUIDE-0009
title: "Uyğunluq testləri"
status: Active
version: 1.0.0
created: 2026-10-03
last_updated: 2026-10-16
summary: >
  Tətbiqin Tamga qaydalarına uyğun olduğunu göstərmək: açıq uyğunluq test vektorları (etibar siyahısı sorğuları, SD-JWT yoxlaması, müsbət və mənfi hallar), icraçını işə salmaq, başqa dildə yazılmış kitabxananı vektorlarla sınamaq və qoşulma zamanı tələb olunan sübut.
translation_of: GUIDE-0009
source_version: "1.0.0"
---

# Uyğunluq testləri

Bu bələdçi Tamga-ya qoşulan proqram təminatını (yoxlayan tərəf, rəqəmsal cüzdan, rəqəmsal sənəd vermə xidməti və ya başqa dildə yazılmış kitabxana)
hazırlayanlar üçündür.

**Nə vaxt oxunmalıdır:**
- Öz kodunuzun Tamga qaydalarına görə düzgün cavab verdiyini göstərmək istədikdə.
- Qoşulma müraciətindən əvvəl: siyahı və reyestr mərhələlərində **yüngül uyğunluq yoxlaması** tətbiq olunur; açıq uyğunluq vektorlarından keçmək
  qoşulmanın texniki şərtidir ([Tamga ARF — Trust Framework §2.4](https://arf.tamga.network/az/trust-framework)).

## Necə işləyir?

[[t:conformance|Uyğunluq]] testi iki hissədən ibarətdir:

| Hissə | Nədir | Harada |
|---|---|---|
| **Test vektorları** | Dondurulmuş giriş + gözlənilən çıxış (JSON) | `conformance/vectors/` |
| **İcraçı** | Vektorları oxuyub `@tamga-network/*` ilə işə salan və nəticəni gözləntiylə müqayisə edən test dəsti | `conformance/runner/` |

Vektorlar eyni zamanda iki tətbiqin eyni cavabı verdiyinin sübutudur: bugünkü imzalı siyahı ilə gələcəkdə açılacaq
ortaq reyestr ([[t:ledger]]) eyni sorğulara eyni cavabı verməlidir; vektorlar həmin sorğuların dondurulmuş formasıdır
([[ADR-0009]] K7).

## 1. Vektorlar

```
conformance/vectors/
├── VERSION              version of the vector set (any change = version bump)
├── trust/basic.json     signed list set (LOTL, national list, anchor log, roots) + query → expected answer
└── sd-jwt/diploma-basic.json   an issued diploma, its presentation, the root certificate + verification expectations
```

**`trust/basic.json`** etibar sorğularını sınayır. Hər hal bir sorğudan və gözlənilən üçdəyərli cavabdan ibarətdir:

```json
{
  "name": "issuer ACTIVE, iat geçerlilik içinde",
  "q": { "op": "isCredentialAcceptable", "issuer_id": "0x8d10…3b64", "iat": 1790812800 },
  "expect": "YES"
}
```

Sınanan sorğular: `isCredentialAcceptable`, `isCredentialSchemaAcceptable`, `isRecognizedBy`, `schemaContentHash`,
`isWalletProviderKey`. Siyahı dəstinin yüklənmə hesabatı da (`healthy`, siyahı versiyası) gözləntiylə müqayisə edilir.

**`sd-jwt/diploma-basic.json`** təqdimatın yoxlanmasını sınayır: hansı sahələrin açıldığı, hansıların gizli qaldığı,
`issuer_id` və keçilən addımlar ([[SPEC-API-0001]] A1–A7). Mənfi hallar da var və onların hər biri **rədd edilməlidir**:

| Mənfi hal | Gözlənilən |
|---|---|
| KB-JWT yoxdur | Rədd — sənəd sahibinə bağlılıq sübutu məcburidir |
| Yanlış `nonce` | Rədd — təkrar oynatma |
| `iat` pəncərəsindən kənar (+301 s) | Rədd — zaman pəncərəsi |
| Təqdim olunmamış disclosure əlavə edilib | Rədd — uyğun gəlməyən digest |
| Müddəti bitmiş rəqəmsal sənəd (`exp` < `now`) | Rədd — A7, müddət |

Hər vektor sabit `now` sahəsi daşıyır; zamandan asılı addımlar hər maşında eyni nəticəni verir.

## 2. İcraçını işə salmaq

```sh
git clone https://github.com/tamga-network/tamga-network && cd tamga-network
npm install
npm run conformance        # generates the vectors and runs all the tests
```

Yalnız işə salmaq üçün `npm test` kifayətdir (icraçı avtomatik daxildir). Vektorlar `npm run conformance:gen` ilə
yenidən yaradılır; deterministik sahələr sabit `now` ilə yaradıldığı üçün çıxış yalnız imzalarda dəyişir.

## 3. Öz kitabxananızı sınamaq

TypeScript kodu kanonikdir; digər dillərdəki tətbiqlər (Java, Python, Go…) eyni vektorlarla yoxlanılır ([[ARCH-0005]] P9).

1. `vectors/` qovluğunu olduğu kimi götürün; `VERSION` dəyərini qeyd edin.
2. `trust/basic.json`: `input` sahəsindəki siyahıları öz kodunuzla yükləyin, kökləri `input.root_fingerprints` ilə sabitləyin,
   `now` anında hər `cases[].q` sorğusunu icra edin, nəticəni `expect` ilə müqayisə edin.
3. `sd-jwt/diploma-basic.json`: `presentation` dəyərini `aud`, `nonce` və `root_cert_pem` ilə yoxlayın; nəticə `expect`
   ilə eyni olmalıdır. `negative[]` hallarının hər biri rədd edilməlidir.
4. Hər hansı halda `UNKNOWN` gözlənildiyi halda siz `NO` qaytarırsınızsa, uyğun deyilsiniz: "yoxlanıla bilmədi" ilə "etibarsız" eyni şey deyil
   ([[SPEC-API-0001]] AP2).

## 4. Qoşulma zamanı tələb olunan sübut

Uyğunluğu öz proqram təminatınızla göstərirsiniz; nəticə hesabatı qeydiyyat müraciətinə əlavə olunur və qeydiyyat qurumu lazım gəldikdə testləri yenidən
icra edir ([Tamga ARF — Trust Framework §4.3](https://arf.tamga.network/az/trust-framework)).

| Rol | Nə test edilir | Necə göstərilir |
|---|---|---|
| Sənədi verən qurum | Növ təsvirinə uyğun rəqəmsal sənəd, imza və sertifikat zənciri, ləğv siyahısının dərci, rəqəmsal cüzdan sübutlarının yoxlanması | Vektorlarla sınaq rəqəmsal sənədi + nəticə hesabatı |
| Yoxlayan tərəf | İmzalı sorğu, yoxlama addımları, köhnəlmiş siyahıda "yoxlanıla bilmədi", əhatə dairəsindən kənar sahə tələb etməmək | Vektorlar + öhdəlik testləri + nəticə hesabatı |
| Cüzdan provayderi | Rəqəmsal cüzdan qaydaları (açarın qorunması, təsdiq ekranı, tarixçə, silmə), cüzdan və açar sübutu, təqdimat protokolu | Vektorlar + öhdəlik testləri + cihaz üzərində nümayiş |

**Öhdəlik testləri** ən azı bunları əhatə edir: köhnəlmiş siyahı "yoxlanıla bilmədi" nəticəsini verir; naməlum format versiyasında əməliyyat dayanır;
imza xətasında əməliyyat dayanır. Hesabatda proqram təminatınızın versiyasını və keçdiyiniz vektor dəstinin versiyasını (`VERSION`) göstərin.

Vektorlar qaydaları ayrı-ayrılıqda sınayır; bütün axını (rəqəmsal sənədin alınması, təqdimat, ləğv və dayandırılma) real telefonla test şəbəkəsində yoxlayın
([[GUIDE-0013]]).

## Qaydalar

| Kod | Nə deyir |
|---|---|
| Vektorlarda fərdi məlumatlar yoxdur | Adlar uydurmadır; şəxsi açar yoxdur (yalnız sertifikat və sənəd sahibinin açıq açarı) |
| Versiya | Vektor dəyişikliyi = `VERSION` artımı |
| [[ADR-0009]] K7 | Siyahı və reyestr tətbiqləri eyni vektorlardan keçmədən keçid tamamlanmış sayılmır |
| [[SPEC-API-0001]] AP2 | `INDETERMINATE` `REJECTED` ilə eyni kateqoriyaya salınmır |
