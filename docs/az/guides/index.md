---
document_id: GUIDE-0000
title: "Başlanğıc"
status: Active
version: 1.0.0
created: 2026-09-27
last_updated: 2026-10-16
summary: >
  Tərtibatçılar üçün giriş: Tamga-da dörd yol (yoxlayan tərəf, sənədi verən qurum, rəqəmsal cüzdan tərtibatçısı, şəbəkə/qovşaq operatoru), hansı paketi quraşdıracağınız, hansı ünvanlardan istifadə edəcəyiniz, lokal tərtibat mühitinin qurulması və bu gün nəyin hazır olduğu.
translation_of: GUIDE-0000
source_version: "1.0.0"
---

# Başlanğıc

Bu səhifə Tamga ilə nəsə hazırlamaq istəyən hər kəs üçün ilk dayanacaqdır: hansı yolun Sizə uyğun olduğunu, hansı paketi
quraşdıracağınızı və lokal olaraq necə sınayacağınızı izah edir.

**Nə vaxt oxunur:** ilk gün, kod yazmazdan əvvəl. Buradan öz rolunuzun bələdçisinə keçirsiniz. Əvvəlcə anlayışlarla tanış olmaq
istəsəniz, [Anlayışlar](/concepts/) bölməsi qısa və sadədir.

## Tamga nə edir?

Qurumlar şəxslərə rəqəmsal sənədlər verir: diplom, tələbə arayışı, şəxsiyyət vəsiqəsi, bilet. Tamga bu sənədləri şəxsin telefonundakı rəqəmsal cüzdana yerləşdirir.
Sənədi görmək istəyən tərəf (işəgötürən, veb-sayt, tədbirin giriş qapısı) onu quruma müraciət etmədən, bir neçə saniyə ərzində yoxlayır.
Şəxs hər dəfə yalnız tələb olunan sahələri paylaşır.

İstifadə olunan standartlar Avropa İttifaqının (Aİ) rəqəmsal şəxsiyyət cüzdanında istifadə olunanlarla eynidir: [[t:SD-JWT-VC]] və ISO [[t:mdoc]] [[t:credential|rəqəmsal sənədləri]],
sənəd vermək üçün [[t:OpenID4VCI]], sənəd təqdim etmək üçün [[t:OpenID4VP]], qurum kimliyi üçün X.509 və imzalı
[[t:trust-list|etibar siyahıları]].

Bu sayt **tərtibatçılar** üçündür. Rollar, qaydalar və iştirak şərtləri [Tamga ARF](https://arf.tamga.network/az/)-də;
ümumi təsvir isə [tamga.network](https://tamga.network/az/learn)-dadır.

## Hansı yol Sizinkidir?

| Nə etmək istəyirsiniz? | Bələdçi | Paket |
|---|---|---|
| Veb-saytınıza "Tamga ilə daxil ol" əlavə etmək | [[GUIDE-0001]] | `@tamga-network/verifier` (+ `/web`) |
| Serverinizdə rəqəmsal sənədləri yoxlamaq (işə qəbul, kampus, yaş, bilet qapısı) | [[GUIDE-0002]] | `@tamga-network/verifier`, `@tamga-network/trust` |
| Qurumunuzu sənədi verən qurum kimi şəbəkədə qeydiyyatdan keçirmək | [[GUIDE-0007]] | — |
| Saytınızı yoxlayan tərəf kimi qeydiyyatdan keçirmək | [[GUIDE-0008]] | — |
| Qurumunuzun rəqəmsal sənədlərini şəxslərin rəqəmsal cüzdanına vermək | [[GUIDE-0003]] | `@tamga-network/issuer` (+ `/client`) |
| Tamga ilə uyğun rəqəmsal cüzdan hazırlamaq | [[GUIDE-0005]], yoxlama siyahısı [[GUIDE-0010]] | `@tamga-network/wallet-core` |
| Etibar siyahılarını oxumaq, gələcəkdə şəbəkə qovşağı işlətmək | [[GUIDE-0006]] | `@tamga-network/trust` |
| Ölkənizin etibar siyahısını şəbəkəyə qoşmaq | [[GUIDE-0011]] | `apps/trust-publisher` |
| Tətbiqinizin qaydalara uyğun olduğunu göstərmək | [[GUIDE-0009]] | `conformance/` |
| Real şəbəkəyə toxunmadan başdan-başa sınamaq (test şəbəkəsi) | [[GUIDE-0013]] | `sandbox.tamga.network` |
| Hamısının işləyən, testli kodunu görmək | [[GUIDE-0004]] | — |
| Nəsə yolunda getmədikdə | [[GUIDE-0012]] | — |

## Lokal olaraq sınamaq

Tələb olunur: Node.js 22 və Git. Deponu klonlayın və tərtibat mühitini qurun:

```sh
git clone https://github.com/tamga-network/tamga-network && cd tamga-network
npm install
npm run setup            # development PKI → schema catalogue → trust lists → verification
npm run check            # tests + type check
npx vitest run examples   # four examples, with the real packages
```

`npm run setup` lokal kök sertifikat, nümunə qurum sertifikatları və imzalı etibar siyahıları yaradır (`ops/pki/`; gizli açarlar
depoya düşmür). Kodunuzu bu lokal siyahılara qarşı sınaya bilərsiniz. Uyğunluq vektorları üçün: `npm run conformance` (`conformance/`).

## Paketlər

| Paket | Nəyə xidmət edir | Kim istifadə edir |
|---|---|---|
| `@tamga-network/core` | heşlər, identifikator törətmə (`issuer_id`, `schema_id`), sertifikat köməkçiləri | hamı (dolayı yolla) |
| `@tamga-network/trust` (+ `/core`) | imzalı etibar siyahılarını yükləyir və yoxlayır; vahid oxuma interfeysi `TrustSource` | yoxlayan tərəf, rəqəmsal cüzdan, sənədi verən qurum |
| `@tamga-network/schemas` | sənəd növləri kataloqu: növün tərifi, JSON Schema, məzmun heşləri | sənədi verən qurum, yoxlayan tərəf |
| `@tamga-network/sd-jwt` | SD-JWT VC: selective disclosure, holder binding, ləğv siyahısı | sənədi verən qurum, yoxlayan tərəf |
| `@tamga-network/mdoc` | ISO 18013-5 mdoc: CBOR, COSE, vermə və yoxlama | şəxsiyyət sənədini verən qurum, yoxlayan tərəf |
| `@tamga-network/issuer` (+ `/client`) | sənəd yaradılması, OpenID4VCI; `/client` hostinq edilən xidmət üçün | sənədi verən qurum |
| `@tamga-network/verifier` (+ `/web`, `/zk`) | yoxlama axını, üçqiymətli nəticə, OpenID4VP; `/web` səhifə dəsti, `/zk` sıfır biliyə əsaslanan sübut | yoxlayan tərəf, veb-sayt |
| `@tamga-network/wallet-core` | rəqəmsal cüzdan nüvəsi: açarlar, sənədin alınması, lokal yoxlama, təqdimat (Node + React Native) | rəqəmsal cüzdan tərtibatçısı |
| `@tamga-network/zk` (+ `/node`, `/react-native`) | rəqəmsal cüzdan tərəfində sıfır biliyə əsaslanan sübut generatoru (mdoc, Longfellow); `/react-native` telefonda lokal sübut generatoru, `/node` masaüstündə | rəqəmsal cüzdan tərtibatçısı |

Hər paketin öz səhifəsi **SDK-lar** bölməsindədir. Paketlər npm-də **0.7.1** sınaq versiyası ilə dərc olunur; sabit 1.0.0
hazır olduqda gələcək. Sınaq versiyasında interfeys dəyişə bilər. Hər versiya bu depodan GitHub Actions ilə yaradılır və mənşə sübutu (provenance) daşıyır.

## Ünvanlar

| Ünvan | Nə | Kim istifadə edir |
|---|---|---|
| `https://trust.tamga.network` | imzalı etibar siyahıları (`lotl.jws`, `tl-tr.jws`), lövbər jurnalı, `keys/` | hamı — `TrustSource` vasitəsilə |
| `https://tamga.network/trust-anchor` | kök barmaq izləri (konfiqurasiyanızda sabitləyirsiniz) | hamı |
| `https://schemas.tamga.network/v1/catalogue.json` | sənəd növləri kataloqu | sənədi verən qurum, yoxlayan tərəf, rəqəmsal cüzdan |
| `https://issuer.tamga.network/{kurum}` | hostinq edilən sənəd vermə xidməti (OpenID4VCI + `/api/v1`) | sənədi verən qurum, rəqəmsal cüzdan |
| `https://status.tamga.network/{opak}` | ləğv siyahıları (Token Status List) | yoxlayan tərəf |
| `https://verify.tamga.network` | Tamga Verify: hostinq edilən yoxlayan tərəf + səhifə dəsti (`/tamga-verifier.js`) | veb-sayt, yoxlayan tərəf |
| `https://id.tamga.network` | müvəqqəti şəxsiyyət sənədi xidməti | rəqəmsal cüzdan |

## Bu gün nə hazırdır?

| Hissə | Status |
|---|---|
| Paketlər | npm-də 0.7.1 sınaq versiyası; sabit 1.0.0 hazır olduqda gələcək (sınaq versiyasında interfeys dəyişə bilər) |
| Hostinq edilən yoxlayan tərəf | işləyir: təqdimatı saytın serveri imzalı bəyanla açır, dəyərlər yalnız ona və yalnız bir dəfə verilir ([[ADR-0017]]); siyasətlər hazırda sabitdir |
| Hostinq edilən sənəd vermə | işləyir: hər qurum üçün əhatə dairəsi məhdud API açarı ([[ADR-0016]]) |
| Etibar lövbəri | imzalı etibar siyahıları ([[ADR-0009]]); sənədi verən qurumların və yoxlayan tərəflərin qeydiyyatını Tamga operatoru aparır |
| Rəqəmsal cüzdanlar | şəbəkə rəqəmsal cüzdan işlətmir, qaydalara uyğun cüzdan provayderlərini siyahıya alır ([[ADR-0042]]); ilk rəqəmsal cüzdan — Tamga Wallet-ın provayderi (`TAMGA-WP-1`) real və sandbox siyahılarında `ACTIVE` |
| Məxfilik | hər sayt üçün psevdonim ([[ADR-0031]]); sıfır biliyə əsaslanan sübutla (ZK) yaşın yoxlanılması — yoxlayan tərəf hissəsi istifadədədir; rəqəmsal cüzdan hissəsi `@tamga-network/zk` ilə qoşulub, Android lokal kitabxanası hazırdır, iOS gözləmədədir ([[ADR-0032]]) |
| Sandbox | istifadədədir: real şəbəkə ilə eyni qaydalara malik vahid test şəbəkəsi, hamı üçün açıqdır; real şəxsiyyət yoxlaması gündəlik/aylıq limitlə məhdudlaşır ([[GUIDE-0013]]) |
| Zəncir (Besu/QBFT) | layihələndirilib, kontraktlar yazılıb; ən azı iki müstəqil validator operatoru ilə işə salınır ([[GUIDE-0006]]) |

## Hər inteqrasiyada ümumi qaydalar

- **Fərdi məlumatları loglamayın.** Sənəd sahələrinin dəyərləri və ləğv indeksi loglara və audit qeydlərinə düşmür ([[SPEC-API-0001]] AP3–AP4).
- **Yalnız lazım olan sahəni tələb edin.** Sorğunuz etibar siyahısındakı qeydinizin əhatə dairəsini aşa bilməz (AP6).
- **Nəticə üçqiymətlidir:** `ACCEPTED`, `REJECTED`, `INDETERMINATE`. "Hazırda yoxlanıla bilmədi" sənədin pis olduğu anlamına gəlmir (AP2).
- **Etibar məlumatlarını yalnız `TrustSource` vasitəsilə oxuyun;** siyahı fayllarını özünüz şərh etməyin.
- Rolunuza görə bütün məcburi qaydalar: [Tamga ARF — Əlavə B, Tamga Rulebook](https://arf.tamga.network/az/rulebook).
