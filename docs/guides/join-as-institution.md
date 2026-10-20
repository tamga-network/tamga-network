---
document_id: GUIDE-0007
title: "Kurum olarak ağa katılmak"
status: Active
version: 1.0.0
created: 2026-10-03
last_updated: 2026-10-20
summary: >
  Bir kurumun belge veren olarak Tamga Network'e katılması, ilk temastan canlıya adım adım: sandbox denemesi, başvuru
  dosyası ve AB ortak kayıt verileri (kontrol listesi), anahtarlar ve sertifika isteği (CSR), kurumun sorgu ucu, güven
  listesine giriş ve belge türü yetkisi, Kurum Konsolu hesabı, ilk belge, iptal ve kayıt değişiklikleri.
---

# Kurum olarak ağa katılmak

Bu rehber, kişilere dijital belge vermek isteyen kurumlar (üniversite, meslek kuruluşu, kamu kurumu, etkinlik düzenleyicisi)
ve onların teknik ekipleri içindir. Örnekler bir üniversitenin öğrenci belgesi ve diploma vermesi üzerinedir.

**Ne zaman okunur:**
- Kurumunuz ilk kez belge verecekse, başvurudan önce.
- Önce: [Belge verme](/concepts/issuance) kavramı. Sonra: [[GUIDE-0003]] (belgeyi teknik olarak vermek).
- Doğrulayıcı olarak katılıyorsanız (belge isteyen site, otel, işveren) bunun yerine [[GUIDE-0008]].

## Nasıl çalışır?

Bir kurumun belgesine güvenilmesinin tek yolu, kurumun [[t:trust-list|güven listesinde]] kayıtlı olmasıdır. Doğrulayıcı
belgeyi imzalayan sertifikayı listede arar; kurum oradaysa ve o belge türünü vermeye yetkiliyse belge kabul edilir.
Katılmak, bu kaydı yaptırmak ve belge vermeye başlamaktır. Bugün kayıt kurumu ve liste işletmecisi Tamga'dır; devlet kendi
listesini yayınladığında bu rol devlete geçer ([[ADR-0035]] PO3). Özel anahtarınız hiçbir aşamada sizden çıkmaz.

## Adım adım: ilk temastan canlıya

| # | Adım | Kim | Nerede | Ayrıntı |
|---|---|---|---|---|
| 0 | Sandbox'ta deneyin | Kurumun ekibi | sandbox.tamga.network → "Kurumunu dene" | §1 |
| 1 | Başvuru dosyasını ve belgeleri hazırlayın | Hukuk, öğrenci işleri, bilgi işlem | aşağıdaki kontrol listesi | §2 |
| 2 | Anahtarları üretin, sertifika isteği (CSR) gönderin | Bilgi işlem / güvenlik | kurumun HSM'i ya da uzaktan imza hizmeti | §3 |
| 3 | Sorgu ucunu kurun | Bilgi işlem | öğrenci bilgi sisteminin önünde | §4 |
| 4 | İnceleme, sertifikalar, listeye giriş | Kayıt kurumu | trust.tamga.network (en geç 24 saat) | §5 |
| 5 | Kurum Konsolu hesabı | Kurumun yöneticisi | davet bağlantısı + passkey | §6 |
| 6 | İlk belge | Öğrenci işleri | Kurum Konsolu → Belge ver, ya da API | §7 |
| 7 | İptal, askı, kayıt değişikliği, çıkış | Öğrenci işleri / kayıt kurumu | Kurum Konsolu → Belgeler | §8 |

## 1. Sandbox'ta deneyin (başvuru gerekmez)

`sandbox.tamga.network` ağın ayrı test ağıdır: kendi test kökü, test olarak işaretli listeleri vardır; oradaki belgeler hiçbir
yerde geçerli değildir ([[GUIDE-0013]]).

1. **Test kurumu açın** — "Kurumunu dene"; uydurma bir ad yazın, sonuna "(TEST)" eklenir. Gerçek kurum adları ve resmî
   sözcükler ("Üniversitesi", "Bakanlığı" gibi) kabul edilmez.
2. **Kurum Konsolu'na girin** — tek kullanımlık davet bağlantısıyla passkey oluşturun.
3. **Kayıt ekleyin** — tek tek ya da CSV ile (en çok 200 satır), yalnız uydurma veriyle. Diploma için kaydın mezuniyet
   alanlarını (yeterlilik, EQF düzeyi, tarih) ve programın 4 haneli ISCED-F kodunu doldurun.
4. **Masada belge verin** — QR'ı sandbox'a bağlı bir cüzdanla okutun, PIN'i girin.
5. **Doğrulayın** — sandbox sayfasındaki örnek doğrulayıcılara gösterin ("Öğrenci indirimi", "Diploma kontrolü"); Konsol'dan
   iptal edip aynı belgenin bir sonraki yayından sonra reddedildiğini görün.

Her şey her gece 03:30'da (Türkiye saati) silinir; sandbox kurumu gerçek ağa taşınmaz.

## 2. Başvuru dosyası ve kontrol listesi

Başvuru bir JSON dosyasıdır. AB'nin ortak kayıt veri seti zorunludur ([[ADR-0024]]); eksik alan varsa kayıt yapılmaz ve kayıt
kurumu eksiklerin tamamını bir kerede bildirir.

**Kurumun vereceği bilgiler**

| Bilgi | Başvurudaki alan | Not |
|---|---|---|
| Resmî ad ve görünen ad | `legal_name`, `trade_name` | Resmî ad sertifikaya da yazılır (Latin harfle) |
| Resmî kimlik numarası | `identifiers` | VKN (`TR-VKN`) ya da MERSİS (`TR-MERSIS`); sertifikalara ve kayıt sertifikasına girer |
| Posta adresi | `postal_address` | |
| İletişim | `contact` | Destek adresi ve kişisel veri başvuruları için e-posta |
| Veri koruma kurumu ve başvuru yolu | `supervisory_authority` | Türkiye'de KVKK; form adresi, e-posta ya da telefondan en az biri |
| Kurumun alanı, sınıfı, güvence seviyesi | `category`, `class`, `assurance`, `assurance_basis` | Aşağıdaki tablo |
| Belge türleri | `vcts` | [Şema kataloğundan](/specifications/schema-catalog); yeni tür önce [[SPEC-SCHEMA-0001]] sürecinden geçer |
| Yetkili kaynak | `authentic_source` | Bilginin geldiği sistemin adı; kip `REMOTE` (§4) |
| Ek iptal koşulları sayfası (varsa) | `revocation_policy_uri` | İsteğe bağlı, https |
| Sorgu ucunun adresi | — (barındırılan servis yapılandırması) | §4 |
| Kimlik eşleştirme için alan adı ve gizlilik politikası | — (ayrı kayıt, §5) | Kurumunuza ait bir alan adı; politika sayfası cüzdanda gösterilir |
| Kurum Konsolu'nun ilk yöneticisi | — | Ad ve kurumsal e-posta; davet bağlantısı ona gider |

**Gereken belgeler** (seviyeye göre; [Katılım süreci](https://arf.tamga.network/tr/onboarding))

| Belge | I1 | I2 | I3 |
|---|---|---|---|
| Alan adı sahipliği (DNS doğrulaması) ve iletişim bilgisi | ✓ | ✓ | ✓ |
| AB ortak kayıt verileri (yukarıdaki tablo) | ✓ | ✓ | ✓ |
| Tüzel kişilik kanıtı (MERSİS ve Ticaret Sicil Gazetesi ya da kuruluş kanunu) ve imza yetkilisinin teyidi | — | ✓ | ✓ |
| İmzalı katılım sözleşmesi ve KVKK ekleri (barındırılan servis kullanılıyorsa veri işleme sözleşmesi) | — | ✓ | ✓ |
| Anahtarların HSM'de olduğunun ya da nitelikli e-Mühür kullanıldığının kanıtı | — | — | ✓ |

| Alan | Değerler | Ne demek |
|---|---|---|
| `category` | `EDUCATION`, `HEALTH`, `GOVERNMENT`, `FINANCE`, `LOGISTICS`, `EVENTS`, `IDENTITY`, `OTHER` | Kurumun alanı |
| `class` | `PUB`, `QUALIFIED`, `EAA` | Kamu kurumu belgesi, nitelikli belge ya da sıradan belge ([[t:EAA]]) |
| `assurance` | `I1`, `I2`, `I3` | Kurumun güvence seviyesi; dayanağı `assurance_basis` alanında yazılır ([[ADR-0005]]). Diploma için asgari I2 |

```json
{
  "slug": "example-uni",
  "legal_name": "Example University",
  "trade_name": "Example University",
  "category": "EDUCATION",
  "class": "EAA",
  "assurance": "I2",
  "assurance_basis": "Recognised university; identity proofing by presentation of a Tamga Identity Attestation.",
  "cert": "issuer-example-uni",
  "status_cert": "issuer-example-uni-status",
  "vcts": ["urn:tamga:edu:StudentCredential:1", "urn:tamga:edu:DiplomaCredential:1"],
  "authentic_source": { "name": "Example University Student Information System", "mode": "REMOTE" },
  "identifiers": [{ "scheme": "TR-VKN", "value": "TR0000000000" }],
  "postal_address": { "street_address": "Example Street 1", "locality": "Istanbul", "postal_code": "34000", "country": "TR" },
  "contact": { "support_uri": "https://example.edu.tr/support", "email": "privacy@example.edu.tr" },
  "supervisory_authority": { "name": "Kişisel Verileri Koruma Kurumu (KVKK)", "country": "TR", "info_uri": "https://www.kvkk.gov.tr", "form_uri": "https://www.kvkk.gov.tr" }
}
```

Tam örnek: depoda `apps/trust-publisher/registry/examples/issuer-application.example.json`. `slug` kurumun kalıcı kısa adıdır
(barındırılan servisin adresi `issuer.tamga.network/<slug>`); kayıt kurumuyla birlikte seçilir ve bir kez kullanılan ad, kayıt
kapansa da yeniden verilmez.

## 3. Anahtarlar ve sertifika isteği

İki anahtar çifti üretirsiniz; ikisi de P-256 (ES256) ve ikisi de sizde kalır:

| Anahtar | İmzaladığı | Başvurudaki ad |
|---|---|---|
| Belge anahtarı | Verdiğiniz belgeler | `cert` |
| İptal listesi anahtarı | [[t:status-list|İptal listeniz]] | `status_cert` |

Her biri için bir sertifika isteği (CSR) üretip başvuruyla gönderin:

```sh
openssl ecparam -name prime256v1 -genkey -noout -out issuer.key.pem
openssl req -new -key issuer.key.pem -subj "/CN=Example University/O=Example University/C=TR" -out issuer.csr.pem
```

Kayıt kurumu CSR'ın imzasını doğrular ve kök sertifika makamıyla 2 yıllık (en çok 3) bir sertifika verir; sertifikanın konu
alanına kurum kimlik numaranız (`organizationIdentifier`, ör. `VATTR-…`), resmî adınız ve ülkeniz yazılır ([[ADR-0050]],
[[SPEC-ID-0002]]).

Anahtarın nerede durduğu belge verme yolunuza göre değişir:

- **Kendi belge verme servisiniz:** anahtar sizin HSM'inizde ya da bulut anahtar yönetiminizdedir; servisi siz işletirsiniz.
- **Barındırılan servis:** anahtar yine sizdedir — kurumunuzun HSM'inde ya da sözleşme yaptığınız güven hizmeti sağlayıcısında.
  Servis her imzayı uzaktan imza arayüzüyle (Cloud Signature Consortium API v2) ister ve yalnız imzalanacak verinin özetini
  gönderir; belge içeriği ve kişisel veri gitmez. Uzaktan imza hizmetinizin adresini ve servise verdiğiniz istemci kimliğini
  kayıt kurumuna bildirirsiniz ([[ADR-0057]]). Gerçek ağda kurum anahtarı barındırılan servisin sunucusunda dosya olarak
  tutulmaz.

## 4. Sorgu ucu: belge bilgisi sizin sisteminizden

[[t:authentic-source|Yetkili kaynak]] sizin sisteminizdir. Tamga kişi kaydı tutmaz; belge verildiği anda sisteminizin **sorgu
ucuna** imzalı bir istekle sorar, tek kaydı alır ve saklamaz ([[ADR-0020]]). Sözleşme: [Kurum sorgu ucu](/api/institution-source).

- Başlamanın en kısa yolu, açık kaynak örnek uçtur ([[GUIDE-0004]] §5): öğrenci bilgi sisteminizin önüne ya da düzenli
  güncellenen bir dışa aktarımın önüne konur; isteği güven listesine karşı denetler ve yalnız belge türünün gerektirdiği
  alanları döndürür. T.C. kimlik numarası hiçbir zaman döndürülmez.
- Her kayıtta programın **4 haneli ISCED-F 2013 kodu** bulunmalıdır; kod yoksa belge verilmez ve tahmini kod üretilmez (eğitim
  kuralı E11). Diploma yalnız mezuniyet bilgisi (yeterlilik, EQF düzeyi, tarih) olan kayıtlara verilir.
- Uç yalnız TLS üzerinden ve yalnız barındırılan servisin kurumunuz için kullandığı kaydı arayan olarak kabul eder (§5).

## 5. İnceleme ve güven listesine giriş

Kayıt kurumu başvuruyu denetler, sertifikaları verir, kurumu listeye ekler ve listeyi yeniden imzalar. Değişiklik en geç
**24 saat** içinde `trust.tamga.network` adresinde yayındadır. Kaydınız orada şunları taşır: sertifikanızın parmak izinden
türetilen `issuer_id`, sınıf, güvence seviyesi, belge türü yetkileri (her tür için ayrı), durum ve durum geçmişi. Biçim:
[[SPEC-TRUST-0001]].

Barındırılan servisi kullanıyorsanız kayıt kurumu kurumunuz için bir **kimlik eşleştirme kaydı** da açar: öğrenci belgeyi
cüzdandan istediğinde servisin kimlik belgesini istemesi ve sorgu ucunuza sorması bu kayıtla imzalanır. Kayıt kurumunuzun adını
ve kimlik numarasını taşır, kalıcı adı kurumunuza ait bir alan adıdır (ör. `tamga.example.edu.tr`), amacı ve gizlilik politikası
adresi cüzdanda gösterilir; istenen alanlar yalnız T.C. kimlik numarası ve doğum tarihidir. Sorgu ucunuz bu kaydın alan adını
"izinli arayan" olarak tanır.

Her yayında kayıtlarınız için [[t:registration-certificate|kayıt sertifikaları]] (WRPRC) de otomatik üretilir; cüzdanlar kaydı
bunlarla da denetler ([[ADR-0026]]).

## 6. Kurum Konsolu hesabı

Kayıttan sonra kayıt kurumu, kurumunuzun ilk yöneticisine tek kullanımlık bir davet bağlantısı gönderir. Yönetici bağlantıyı açar
ve cihazında bir passkey oluşturur (parola yoktur). Ardından Konsol'dan diğer personeli davet eder (yönetici ya da personel
rolüyle), API anahtarı üretir ([[ADR-0016]]) ve paylaşım kurallarını yönetir.

## 7. İlk belge

- **Kurum Konsolu → Belge ver:** öğrencinin sisteminizdeki referansını yazın, belge türünü seçin. T.C. kimlik numarası ve doğum
  tarihi de yazılırsa teklif kişinin kimliğine bağlanır: belgeyi yalnız o kişi alabilir, cüzdanı Tamga kimlik belgesini gösterir,
  PIN gerekmez. Kimlik belgesi olmayan kişi için PIN'li teklif açılır (PIN ekranda, QR'dan ayrı gösterilir). Kayıt sorgu ucunuzdan
  okunur; bulunamazsa ya da ISCED-F kodu eksikse teklif açılmaz ve neden ekranda yazar.
- **API:** öğrenci portalınız ya da sisteminiz `@tamga-network/issuer/client` ile teklif açar ve bağlantıyı kendi kanalınızla
  iletir (Tamga kişinin iletişim adresini görmez). Adımlar: [[GUIDE-0003]].
- **Öğrenci başlatır:** öğrenci cüzdanında kurumunuzu seçip kimlik belgesini gösterir; servis sorgu ucunuza `lookup` ile sorar.

Her belge, kişinin cihazındaki anahtara bağlı 10 kopyalık bir paket olarak verilir. Kendi belge verme servisinizi işletiyorsanız
aynı adımları `@tamga-network/issuer` paketiyle kendiniz yaparsınız ([[SPEC-PROTO-0001]]).

## 8. İptal, askı ve kayıt değişiklikleri

Belgeyi Kurum Konsolu'nun **Belgeler** sekmesinden ya da API'den iptal edersiniz (kalıcı) ya da askıya alırsınız (yalnız diploma
gibi askıya izin veren türlerde). Etki bir sonraki sabit aralıklı iptal listesi yayınındadır; doğrulayıcılar belgeyi o andan
sonra reddeder.

| Kurum kaydının durumu | Ne olur |
|---|---|
| `ACTIVE` | Belge verebilir; verdiği belgeler kabul edilir |
| `SUSPENDED` | Geçici olarak belge veremez; askıdayken verilen belge kabul edilmez, askıdan önce verilenler etkilenmez. Sorun giderilince yeniden etkinleşir |
| `RETIRED` | Belge vermeyi bıraktı (gönüllü çıkış); önceden verdiği belgeler kabul edilmeye devam eder |
| `REVOKED` | Kayıt kapandı; anahtar ele geçirildiyse belirtilen tarihten (`invalidates_from`) sonra verilenler düşer. Kurumun yerini bir halef (`successor_id`) alabilir |

Geri çekilmiş (`REVOKED`) ya da çıkmış (`RETIRED`) bir kayıt yeniden etkinleşmez; dönmek isteyen kurum yeni kayıtla katılır.
Doğrulama, kurumun bugünkü durumuna değil belgenin verildiği andaki durumuna bakar ([[SPEC-API-0001]] §1.1). Sertifika
yenileme ve anahtar değişimi: [[SPEC-ID-0002]]. Uyum testleri: [[GUIDE-0009]].

## Kurallar

| Kod | Ne der |
|---|---|
| [[ADR-0024]] RPR1–RPR3 | Kayıt verisi eksiksiz olmadan kayıt yapılmaz |
| [[SPEC-ID-0002]] | Belgeler yalnız kayıtlı sertifikayla imzalanır; anahtar kurumda kalır |
| [[ADR-0020]] | Tamga kişi kaydı tutmaz; bilgi yetkili kaynaktan okunur |
| [[ADR-0050]] | Kurum sertifikası kurum kimlik numarasını, resmî adı ve ülkeyi taşır |

Bağlayıcı kuralların tamamı: [Tamga ARF — Tamga Rulebook, RB-AP](https://arf.tamga.network/tr/rulebook) ve katılım
şartları: [Trust Framework](https://arf.tamga.network/tr/trust-framework).
