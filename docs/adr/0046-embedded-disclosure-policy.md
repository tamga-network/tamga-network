---
document_id: ADR-0046
title: "Gömülü açıklama politikası"
status: Proposed
version: 1.0.0
created: 2026-10-09
last_updated: 2026-10-09
summary: >
  Belge veren kurum, bir belge türünün yalnız belirli doğrulayıcılara (ya da belirli bir yetkiye sahip olanlara, ya da belirli bir
  güven kökünden sertifika almış olanlara) gösterilmesini isteyebilir. Kurum bu kuralı imzalı Credential Issuer metadata'sında,
  belge yapılandırmasının içinde değer olarak yayımlar; belgenin biçimi değişmez. Cüzdan kuralı belge alırken saklar, gösterimde
  doğrulayıcının kayıt sertifikası (WRPRC) ve erişim sertifikasıyla karşılaştırır; tutmazsa onay ekranında uyarır, kararı kişiye
  bırakır (varsayılan "paylaşma"). Politika eklenir, değişir ya da kalkarsa kurum o türdeki belgeleri iptal eder. AB ARF 3.0
  Konu 43'ün 10 maddesini karşılar. Yeni alan adları onay bekler. Paketler 0.5.0.
domain: Trust
related: ["[[ADR-0026]]", "[[ADR-0024]]", "[[ADR-0028]]", "[[ADR-0023]]", "[[ADR-0029]]", "[[ADR-0042]]", "[[SPEC-PROTO-0001]]", "[[SPEC-WALLET-0001]]", "[[FW-RB-0001]]"]
---

# Kısaca

Bugün bir diploma ya da üyelik belgesi, kişi onaylarsa güven listesindeki her doğrulayıcıya gösterilebilir. Cüzdan yalnız
doğrulayıcının kayıtlı olduğundan fazlasını isteyip istemediğine bakar ([[ADR-0026]] K5, fazla istek uyarısı). AB, belge verenin
"bu belge yalnız şu doğrulayıcılara gösterilsin" diyebilmesini ve cüzdanın bunu denetlemesini ister. Bu karar o kuralın nerede
taşınacağını, cüzdanın nasıl değerlendireceğini ve kişiye ne gösterileceğini önerir.

# Bağlam

**AB ne istiyor** (ARF 3.0, Ek 2, Konu 43; ana metin §6.6.2.8, §6.6.3.4; Uygulama Tüzüğü (AB) 2024/2979 Ek III; ETSI TS 119 472-3
§4.2.5):

| Madde | Özet |
|---|---|
| EDP_01 | Cüzdan, belge verenin bir EAA için (QEAA, PuB-EAA, nitelikli olmayan EAA) isteğe bağlı bir gömülü açıklama politikası koymasına olanak tanır. PID için şart yok. |
| EDP_02 | "Yalnız yetkili doğrulayıcılar" politikası: (doğrulayıcı kimliği, hizmet kimliği) ikilileri listesi. Cüzdan ikiliyi doğrulayıcının **kayıt sertifikasından** alır (erişim sertifikasından değil; aracı durumunda erişim sertifikası aracıyı gösterir); listede yoksa değerlendirme başarısızdır, kişiye söylenir. |
| EDP_03 | "Belirli güven kökü" politikası: kök ya da ara sertifikalar listesi. Cüzdan kayıt sertifikasını imzalayan zincirdeki sertifikaları listeyle karşılaştırır; hiçbiri yoksa başarısız, kişiye söylenir. |
| EDP_05 (SHOULD + SHALL) | Politika, kuralı sade dille anlatan bir sayfaya bağlantı içermeli; varsa cüzdan bağlantıyı gösterir ve açtırır. |
| EDP_06 | Cüzdan politikayı kayıt sertifikasındaki bilgilerle birlikte, ETSI TS 119 472-3'ün değerlendirme kurallarıyla değerlendirir. |
| EDP_07 | Cüzdan, değerlendirmenin sonucuna göre kişinin gösterimi reddetmesine ya da izin vermesine olanak tanır. |
| EDP_08 | Biçim ETSI TS 119 472-3'e uyar. |
| EDP_09 | Belge veren politikayı (varsa) OpenID4VCI Credential Issuer metadata'sında **değer olarak** yayımlar. |
| EDP_10 | Cüzdan politikayı belge alırken alır ve saklar (gösterimde, özellikle yakın alanda, yeniden sormadan değerlendirebilmek için). |
| EDP_11 | Belge veren, politika eklenir, değişir ya da silinirse belgeyi iptal eder. |

EDP_04 boştur; toplam 10 madde.

**Tüzük Ek III'ün üç ortak politikası:** (1) politika yok (varsayılan), (2) yalnız yetkili doğrulayıcılar, (3) belirli güven kökü.
Politikalar belge düzeyindedir, alan düzeyinde değildir.

**ETSI TS 119 472-3 §4.2.5.2 veri modeli** (ISS-MDATA-EBD-01…13): benzersiz URI ile tanımlanır; isteğe bağlı açıklama ve sorumlu
makam; "kısıt yok" diyebilir; yetkili doğrulayıcı listesi (a) erişim sertifikasının konu ayırt edici adı (RFC 4514 LDAP dizgesi;
tüzel kişide `commonName`, `organizationName`, `organizationIdentifier`, `countryName`) ve/veya (b) kayıt sertifikasındaki TS 119 475
yetki (entitlement) URI'leri; güven kökü listesi (her öğe: verenin ayırt edici adı + sertifika seri numarası); uzantılar (cüzdan
yok sayabilir); sade dil sayfası bağlantısı. Politika doğrulayıcıya açılmaz. **ETSI JSON üye adlarını tanımlamaz.**

**ARF ile ETSI arasındaki fark:** ARF yetkili doğrulayıcıyı kayıt sertifikasındaki (kimlik, hizmet) ikilisiyle ve güven kökünü kayıt
sertifikası zinciriyle; ETSI ve Tüzük ise konu adıyla ya da yetkiyle ve erişim sertifikası köküyle tarif eder. Öneri ikisini de kabul
eder (K3).

**Tamga'da bugün:**
- Doğrulayıcı kayıt sertifikası (WRPRC, `rc-wrp+jwt`) her kullanım için üretilir, OpenID4VP isteğinde `verifier_info` ile gelir;
  cüzdan imzayı, süreyi ve erişim sertifikasındaki `organizationIdentifier` ile `sub` eşleşmesini denetler ([[ADR-0026]] K5).
  Ayrı bir hizmet kimliği taşımaz (ARF RPRC_17a kısmen); kullanım kimliği `intended_use_id` vardır.
- Belge verenin Credential Issuer metadata'sı imzalıdır ve kurum WRPRC'sini `issuer_info` ile taşır.
- Belge yapılandırmasında `credential_metadata` altında `display` ve `credential_reuse_policy` var.
- Kodda gömülü açıklama politikası yok. EDP_02 "kısmen" sayılıyor, çünkü fazla istek denetimi benzer bir koruma sağlıyor.
- Yakın alanda (ISO 18013-5) ve cüzdandan cüzdana istekte kayıt sertifikası yoktur.
- Önerilen [[ADR-0028]] K5, meslek icra belgesi için yetkiye dayalı bir politika örneği verir ("yalnız kayıt sertifikasında sağlık
  hizmeti sunucusu yetkisi olan doğrulayıcılara") ve JSON adlarını bu karara bırakır.

# Değerlendirilen seçenekler

## 1. Politikanın yeri

| Seçenek | Sonuç | Neden |
|---|---|---|
| **İmzalı Credential Issuer metadata'sında, belge yapılandırmasının `credential_metadata` nesnesinde, değer olarak** | **öneri** | EDP_09'un kendisi; belge biçimi değişmez; metadata zaten imzalı ve cüzdan belge alırken okuyor. |
| Belgenin içinde (SD-JWT claim'i ya da mdoc öğesi) | ret | Politika doğrulayıcıya açılmamalı (ETSI §4.2.5.1); belge biçimi değişir; ARF "belge biçiminde değişiklik gerekmez" der. |
| URL ile bağlantı, cüzdan gösterimde indirir | ret | ARF "bağlantı değil değer" der (§6.6.2.8.3); yakın alanda ve çevrimdışı çalışmaz; belge verene gösterim zamanını sızdırır. |
| Güven listesindeki kurum kaydında | ret | AB yolu değil; AB cüzdanları okumaz. |

## 2. Değerlendirme başarısız olunca

| Seçenek | Sonuç | Neden |
|---|---|---|
| **Uyar, kararı kişiye bırak (varsayılan düğme "Paylaşma")** | **öneri** | EDP_07 kişiye "reddet ya da izin ver" seçimini verir; [[ADR-0026]]'nın fazla istek uyarısıyla aynı desen (WL8). |
| Kesin engelle | ret (soru 3) | EDP_07 ile çelişir; Tamga'ya özgü daha sıkı bir kural olur; AB cüzdanları uyarıyla yetinir. |
| Belge veren "uyar / engelle" seçsin | ret (soru 3) | Yeni ve AB'de karşılığı olmayan bir alan; aynı belge AB cüzdanında farklı davranır. |

## 3. Yetkili doğrulayıcının nasıl tanımlandığı

| Seçenek | Sonuç | Neden |
|---|---|---|
| **ARF ikilisi + ETSI konu adı + ETSI yetki URI'si; listelenen herhangi biri tutarsa geçer** | **öneri** | ARF ve ETSI'nin ikisine de uyar; kurum kendi işine uygun olanı kullanır ("şu üç doğrulayıcı" ya da "şu yetkiye sahip herkes"). |
| Yalnız ARF ikilisi | ret | ETSI biçiminde yazılmış AB politikalarını okuyamaz; yetkiye dayalı "kategori" kuralı kurulamaz. |
| Yalnız ETSI | ret | ARF'nin aracı notunu (kayıt sertifikasındaki kimlik esas) karşılamaz. |

# Önerilen karar

## K1 — Politikanın yeri ve biçimi

Belge veren, politikası olan her belge yapılandırması için imzalı Credential Issuer metadata'sında şu nesneyi yayımlar (ad ve
üye adları **onay bekliyor**; ETSI JSON adı tanımlamadığı için Tamga'nın önerisidir; AB ya da ETSI bir JSON kodlaması yayımlarsa ona
geçilir, [[ADR-0029]]):

```json
"credential_configurations_supported": {
  "<yapılandırma>": {
    "credential_metadata": {
      "embedded_disclosure_policy": {
        "id": "https://kurum.example/politika/diploma-1",
        "type": "authorized_relying_parties",
        "relying_parties": [{ "rp_id": "VATTR-1234567890", "service_id": "isealim" }],
        "subject_dns": ["ORGID=VATTR-1234567890,O=Örnek A.Ş.,C=TR"],
        "entitlements": ["<TS 119 475 yetki URI'si>"],
        "info_uri": "https://kurum.example/politika/diploma"
      }
    }
  }
}
```

- `id` (zorunlu): politikanın benzersiz URI'si (ETSI -01).
- `type` (zorunlu): `none` · `authorized_relying_parties` · `specific_roots_of_trust` (Tüzük Ek III'ün üç politikası).
- `authorized_relying_parties` için en az biri: `relying_parties` (ARF ikilisi; `rp_id` kayıt sertifikasındaki `sub`, `service_id`
  isteğe bağlı), `subject_dns` (ETSI -07a), `entitlements` (ETSI -07b).
- `specific_roots_of_trust` için `roots_of_trust`: `[{ "issuer_dn": "<RFC 4514>", "serial_number": "<onaltılı>" }]` (ETSI -09).
- İsteğe bağlı: `info_uri` (EDP_05, ETSI -13), `authority` (ETSI -05), `description` (ETSI -04).
- Bilinmeyen üyeler ve uzantılar yok sayılır (ETSI -10/-11). Alan düzeyinde politika uzantısı (ETSI -12) desteklenmez.
- Politika belgeye girmez; doğrulayıcıya gitmez.
- Kapsam: kurum belgeleri (EAA). Tamga kimlik belgesi ve iletişim belgeleri politika taşımaz.

## K2 — Cüzdan: belge alırken saklama (EDP_10)

Cüzdan, belgeyi alırken imzası doğrulanmış metadata'dan politikayı okur, biçimini denetler ve belge kaydının yanında saklar
(politika + özeti). Gösterimde belge verene ya da başka bir sunucuya istek yapılmaz (WL9 ile aynı ilke). Biçimi bozuk politika
belgeyi almayı durdurmaz, ama "değerlendirilemez" diye saklanır ve gösterimde K4'teki uyarıyı üretir.

## K3 — Cüzdan: değerlendirme (EDP_02, EDP_03, EDP_06)

Gösterim isteği geldiğinde istenen her belge için, kayıt sertifikası [[ADR-0026]] K5'e göre doğrulandıktan sonra:

| Politika | Geçer, eğer |
|---|---|
| yok ya da `none` | her zaman |
| `authorized_relying_parties` | (a) kayıt sertifikasının `sub`'ı bir `relying_parties` öğesinin `rp_id`'sine eşit ve öğede `service_id` varsa kayıt sertifikasının hizmet kimliği de eşit; **ya da** (b) isteği imzalayan erişim sertifikasının konu adı bir `subject_dns` öğesine eşit (RFC 4514 normalleştirilmiş karşılaştırma); **ya da** (c) kayıt sertifikasının `entitlements` listesi bir `entitlements` öğesini içeriyor |
| `specific_roots_of_trust` | kayıt sertifikasını imzalayan zincirdeki (ARF EDP_03) ya da erişim sertifikası zincirindeki (Tüzük Ek III, ETSI -08) bir sertifikanın (veren adı, seri numarası) çifti listede |

- Kayıt sertifikası yoksa (istekte gelmediyse; yakın alanda; cüzdandan cüzdana) değerlendirme **yapılamaz** ve başarısız sayılır.
- Aracılı istekte kayıt sertifikasındaki aracılanan doğrulayıcı esas alınır (ARF EDP_02 notu).
- Kayıt sertifikasının hizmet kimliği bugün yoktur (RPRC_17a kısmen). Hizmet kimliği eklenene kadar `service_id` içeren bir öğe
  eşleşmez; `service_id`'siz öğe doğrulayıcının bütün kullanımlarını kapsar. Hizmet kimliğinin WRPRC'ye eklenmesi bu kararın ön
  koşuludur ve aynı turda yapılır.

## K4 — Onay ekranı (EDP_05, EDP_07)

- Değerlendirme başarılıysa ekran değişmez.
- Başarısız ya da yapılamazsa: ayrı bir uyarı bloğu — "**<Belge veren>** bu belgenin yalnız izin verdiği kurumlara gösterilmesini
  istiyor. **<Doğrulayıcı>** bu izinli kurumlar arasında değil." (yapılamadıysa: "...izinli olup olmadığı denetlenemedi.").
  `info_uri` varsa "Kuralı oku" bağlantısı. Varsayılan düğme **"Paylaşma"**; "Yine de paylaş" kısa bir gecikmeyle açılır
  (WL8 deseni).
- Birden çok belge isteniyorsa uyarı ilgili belgenin satırında; kişi o belgeyi çıkarıp kalanını paylaşabilir.

## K5 — Belge veren: iptal (EDP_11)

- Bir yapılandırmanın politikası eklenir, değişir ya da kalkarsa belge veren o yapılandırmayla verilmiş, hâlâ geçerli bütün
  belgeleri iptal eder. Belge kaydı ihraç anındaki politika özetini tutar; iptal özete göre yapılır.
- Kurum Konsolu, politikayı değiştirmeden önce kaç belgenin iptal edileceğini gösterir ve onay ister. Kişiler belgeyi yeniden alır;
  otomatik yenileme koşulları ([[ADR-0023]]) izin veriyorsa yeni kopyalar yeni politikayla gelir.

# Önerilen kurallar (kabul edilirse bağlayıcı tabloya taşınır)

| Kod | Kural |
|---|---|
| EP1 | Gömülü açıklama politikası yalnız imzalı Credential Issuer metadata'sında, belge yapılandırmasında değer olarak taşınır; belgeye girmez ve doğrulayıcıya gönderilmez. |
| EP2 | Cüzdan politikayı belge alırken saklar ve gösterimde ağ isteği yapmadan, kayıt sertifikası ve erişim sertifikasıyla değerlendirir. |
| EP3 | Değerlendirme başarısızsa ya da yapılamıyorsa cüzdan onay ekranında ayrı bir uyarı gösterir; varsayılan seçim paylaşmamaktır, son karar kişinindir. |
| EP4 | Politika eklenen, değişen ya da kaldırılan yapılandırmanın geçerli belgeleri iptal edilir. |

# ARF eşlemesi (10 madde)

| Madde | Nasıl karşılanır |
|---|---|
| EDP_01 | K1: kurum belgeleri için isteğe bağlı politika |
| EDP_02 | K3 (a): kayıt sertifikasındaki (kimlik, hizmet) ikilisi; aracılı istekte aracılanan doğrulayıcı; hizmet kimliği WRPRC'ye eklenir |
| EDP_03 | K3: kayıt sertifikası zinciri (ve erişim sertifikası zinciri) |
| EDP_05 | K1 `info_uri`, K4 "Kuralı oku" |
| EDP_06 | K3: kayıt sertifikasıyla birlikte, ETSI veri modeline göre |
| EDP_07 | K4: uyarı + "Paylaşma" / "Yine de paylaş" |
| EDP_08 | K1: ETSI TS 119 472-3 §4.2.5.2 veri modeli; JSON adları ETSI kodlaması çıkınca ona uyarlanır |
| EDP_09 | K1: imzalı Credential Issuer metadata'sında değer olarak |
| EDP_10 | K2 |
| EDP_11 | K5 |

# Etkilenen paketler ve sürüm

Paketler **0.5.0** ile (yeni alan ve işlev = minör):

| Paket | Değişiklik |
|---|---|
| `@tamga-network/schemas` | Politika nesnesinin JSON Schema'sı ve denetleyicisi |
| `@tamga-network/issuer` | Metadata üreticisine yapılandırma başına politika; politika özeti; biçim denetimi |
| `@tamga-network/trust` | RFC 4514 ayırt edici ad ayrıştırma ve normalleştirme; sertifikadan (veren adı, seri numarası) çıkarma |
| `@tamga-network/wallet-core` | Belge alırken saklama; `evaluateDisclosurePolicy` (sonuç: geçti / başarısız / yapılamadı + neden + bağlantı); onay görünümüne sonuç |
| `@tamga-network/verifier` | Değişiklik yok (politika doğrulayıcıya açılmaz) |

Paketlerin dışında: kayıt sertifikasına hizmet kimliği (liste yayıncısı, RPRC_17a), barındırılan belge verme servisinde belge kaydına
politika özeti ve değişiklikte toplu iptal, Kurum Konsolu'nda politika düzenleyici (operatör deposu), cüzdan uygulamalarında onay
ekranı uyarısı.

# Sonuçlar

- Şartnameler (kabulde): [[SPEC-PROTO-0001]] metadata alanı; [[SPEC-WALLET-0001]] değerlendirme ve onay ekranı kuralı;
  [[FW-RB-0001]] rulebook'ta "erişim kısıtı" bölümü (ARF notu: kısıt rulebook'ta da doğrulayıcılara duyurulur); Tamga ARF'de güven
  modeli ve gizlilik önlemleri satırları.
- Cüzdandan cüzdana ve yakın alan gösteriminde politika değerlendirilemez; politikası olan belge bu yollarda uyarıyla (yakın alan)
  gösterilir ya da hiç gösterilmez (cüzdandan cüzdana; cüzdanın kendi kararı).
- Politikayı değiştiren kurum, belgelerinin yeniden verilmesini göze alır; Kurum Konsolu bunu açıkça gösterir.

# Plan ve tahmin

| # | İş | Tahmin (mühendis-günü) |
|---|---|---|
| 1 | schemas: politika şeması + testler | 0,5 |
| 2 | issuer: metadata, politika özeti, biçim denetimi + testler | 1 |
| 3 | trust: RFC 4514 normalleştirme, (veren adı, seri numarası) + testler | 1 |
| 4 | Kayıt sertifikasına hizmet kimliği (liste yayıncısı + cüzdan denetimi, RPRC_17a) | 1 |
| 5 | wallet-core: saklama + değerlendirme + onay görünümü; politika türleri × kayıt sertifikası var/yok × aracılı istek test matrisi | 2 |
| 6 | Barındırılan belge verme: belge kaydında politika özeti, değişiklikte toplu iptal; Kurum Konsolu düzenleyici | 2 |
| 7 | Cüzdan uygulaması: onay ekranı uyarı bloğu, "Kuralı oku", i18n | 1 |
| 8 | Sandbox'ta uçtan uca sahne (politikalı bir deneme belgesi; izinli ve izinsiz doğrulayıcı) | 0,5 |
| 9 | Şartnameler, rulebook, Tamga ARF | 1 |
| | **Toplam** | **≈ 10 gün** |

Bütün işler kod ve belge işidir; cihaz ya da sertifika gerekmez.

# Kararı bekleyen sorular (proje yönetimi)

1. **Ad onayı:** metadata alanı `embedded_disclosure_policy`, türler `none` / `authorized_relying_parties` / `specific_roots_of_trust`, üye adları (`relying_parties`, `rp_id`, `service_id`, `subject_dns`, `entitlements`, `roots_of_trust`, `issuer_dn`, `serial_number`, `info_uri`, `authority`, `description`) uygun mu? Bunlar kamuya açık yeni adlardır.
2. **Kapsam:** politika yalnız kurum belgelerinde olsun, Tamga kimlik ve iletişim belgelerinde olmasın (öneri) — uygun mu?
3. **Uyarı mı engel mi:** politika tutmazsa cüzdan uyarıp kararı kişiye bıraksın mı (öneri, AB'nin yolu), yoksa kesin engellesin mi?
4. **Toplu iptal:** kurum politikayı değiştirirse o türdeki bütün geçerli belgeler iptal edilir ve kişiler yeniden alır. Bu bedel kabul mü?
5. **Hizmet kimliği:** kayıt sertifikasına ayrı bir "hizmet kimliği" eklenmesi (AB'nin istediği) bu işle aynı turda yapılsın mı (öneri)?

# Durum

**Proposed — 2026-10-09.** AB uyum boşluk sayımındaki (2026-10-09) "Konu 43" maddesi için tasarım önerisi; adlar ve sorular kararda.
