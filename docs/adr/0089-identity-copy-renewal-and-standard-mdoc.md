---
document_id: ADR-0089
title: "Kimlik belgesi: standart mdoc yapılandırması, kopyaların düzenli yenilenmesi, cüzdan sağlayıcısı askısı"
status: Active
review_status: Completed
version: 1.0.0
created: 2026-11-16
last_updated: 2026-11-24
summary: >
  Kimlik servisinin kimlik belgesi için üç değişiklik. (1) Belgenin mdoc kopyası artık metadata'da ilan edilen ayrı bir `mso_mdoc`
  yapılandırmasıyla, standart belge isteğinden verilir; aynı yetki ve aynı erişim belirteci iki biçimi kapsar, belge yanıtındaki
  standart dışı `mso_mdoc` alanı kalkar. (2) Mantıksal belge ile teknik kopya ayrılır: kaydın bitişi idari geçerliliktir ve her
  kopyada `date_of_expiry` olarak taşınır; kopyaların teknik geçerliliği en çok 30 gündür ve cüzdan kopyaları sessizce yeniler.
  Kimlik servisi kişi alanlarını saklamadığı için yenileme, cüzdanın bu kayda ait bir kopyayı bütün alanlarıyla ve belge sahibi
  anahtarıyla sunmasıyla yapılır; yenileme belirteci ZK kopyası belirtecinin genişletilmişidir. (3) Kimlik servisi, kayıtlarına
  bağlı cüzdan sağlayıcısının güven listesindeki durumunu düzenli denetler: iptal edilmiş ya da listeden çıkmış sağlayıcının
  birimlerine verilen kayıtları iptal eder, askıdaki sağlayıcınınkileri askıya alır (yenileme durur; askı kalkınca sürer);
  "liste okunamıyor" ile "sağlayıcı askıda" ayrıdır. Kabul: 2026-11-16.
domain: Identity
related: ["[[ADR-0011]]", "[[ADR-0013]]", "[[ADR-0023]]", "[[ADR-0029]]", "[[ADR-0044]]", "[[ADR-0045]]", "[[ADR-0047]]", "[[ADR-0048]]", "[[ADR-0059]]", "[[ADR-0060]]", "[[ADR-0062]]", "[[ADR-0064]]", "[[SPEC-PROTO-0001]]", "[[SPEC-ID-0003]]", "[[SPEC-WALLET-0001]]", "[[FW-RB-0003]]"]
---

# Kısaca

Kimlik belgesinin iki biçimi (SD-JWT VC ve mdoc) bugüne kadar tek bir isteğin yanıtında, standart dışı bir alanla birlikte
veriliyordu; Tamga Wallet ikisini de alıyor, başka bir cüzdan yalnız SD-JWT'yi alabiliyordu. Kopyalar 2 yıl geçerliydi ve
yenilenmiyordu: on doğrulayıcıdan sonra cüzdan aynı kopyayı başka doğrulayıcılara da göstermek zorunda kalıyordu. Bu kararla
mdoc kopyası standart yoldan istenir, kopyalar en çok 30 gün geçerli olur ve cüzdan onları kendiliğinden yeniler; kimlik
servisi ise cüzdan sağlayıcısı listede askıya alınınca ya da iptal edilince o sağlayıcının birimlerindeki belgeler için gereğini
yapar.

# Bağlam

- **Standart dışı alan (R41).** OpenID4VCI 1.0 §8.3 `credentials[]` nesnesinde yalnız `credential` tanımlar. Kimlik servisi mdoc'u
  her nesneye ek bir `mso_mdoc` alanıyla koyuyordu ([[ADR-0013]], [[SPEC-PROTO-0001]] PR16); metadata'da kimlik için `mso_mdoc`
  yapılandırması yoktu (yalnız ZK kopyası için). Gerekçe, kişi alanlarının ilk ihraçtan hemen sonra silinmesiydi. [[ADR-0059]]'dan
  beri erişim belirteci ömrü içinde birden çok belge isteği yapılabildiği için bu gerekçe kalktı. OpenID4VCI 1.0 §12.2.4 aynı
  `scope` değerinin birden çok yapılandırmada kullanılmasına izin verir; AB'de PID iki biçimde, iki ayrı yapılandırmayla verilir.
- **Mantıksal ve teknik belge (ARF 3.0 §5.3, §6.6.6.2; PID Kural Kitabı).** Bir mantıksal belge birden çok teknik kopyayla
  temsil edilir; kopyaların teknik geçerliliği kısadır (günler, haftalar) ve mantıksal belgenin ömrü boyunca düzenli yeniden
  verilir; idari geçerlilik ayrı bir alandır (PID `date_of_expiry` / mdoc `expiry_date`). Bizde kopyalar 730 gün geçerliydi, idari
  ve teknik süre aynıydı ve kimlik belgesi yenilenmiyordu (yalnız 24 saatlik ZK kopyaları, [[ADR-0044]]). 10 kopya bitince cüzdan
  en az kullanılan kopyayı uyarıyla yeniden kullanıyor, bu da doğrulayıcıların kişiyi eşleyebilmesi demek.
- **Kişi alanları saklanmaz.** Kimlik servisi ihraçtan sonra kişi alanlarını tutmaz ([[ADR-0011]] K4, IDP9). [[ADR-0023]] AR4 bu
  yüzden kimlik belgesinin sessiz yenilenmesini dışarıda bırakmıştı. Alanların tek kaynağı cüzdandaki, servisin kendi imzasını
  taşıyan kopyadır.
- **Cüzdan sağlayıcısı geçersiz olunca (ARF 6.6.2.5-c, CIR 2024/2977).** PID sağlayıcısı, cüzdan sağlayıcısının listede askıya
  alınıp alınmadığını da düzenli denetler. Bugün sağlayıcı `ACTIVE` değilse anahtarı güvenilmez sayılıyor, iptal listesi
  doğrulanamıyor ve sonuç "bilinmiyor" oluyordu: hiçbir şey değişmiyordu.
- **Proje yönetiminin yönü (2026-11-16, ARF 3.0.0 okuma kararları):** kimlik belgesinin mdoc kopyası standart yoldan ve kimlik
  kopyalarının düzenli yenilenmesi şimdi; askı AB gibi ve geri alınabilir.

# Karar

## K1 — mdoc kopyası standart yapılandırmayla

- Kimlik servisinin metadata'sı kimlik belgesi için ikinci bir yapılandırma ilan eder: `format: mso_mdoc`, `doctype` ve ad alanı
  değişmez ([[ADR-0013]] K2: `urn:tamga:id:IdentityAttestation:1`, `tamga.id.1`), `scope` SD-JWT yapılandırmasınınkiyle aynıdır
  (`urn:tamga:id:IdentityAttestation:1`). Yapılandırma kimliği `urn:tamga:id:IdentityAttestation:1:mso_mdoc` (kodda tek sabit;
  kamuya açık ad onayı bekliyor, değişirse yalnız sabit değişir).
- Tek yetki iki biçimi kapsar. Cüzdan aynı erişim belirteciyle iki standart belge isteği yapar ([[ADR-0059]]); sıra serbesttir.
  mdoc yanıtı standarttır: `credentials[i].credential` = base64url IssuerSigned.
- Kopya hakkı yapılandırma başınadır: bir belirteçle her biçimde en çok 10 kopya ([[ADR-0059]] AT2 yapılandırma başına okunur).
- İki biçimin kopyaları aynı kayda girer (aynı iptal izleme), `iat`/`exp` aynıdır ([[ADR-0013]] MD1). Aynı belirteçle aynı
  anahtara verilen iki biçimin kopyası aynı iptal indeksini taşır; eşleşme yalnız belirtecin ömrü içinde, bellekte yapılır,
  anahtar parmak izi kalıcı yazılmaz (ISSU_35b). Başka anahtarla istenen kopya yeni indeks alır.
- [[ADR-0013]] MD2 ("mdoc `deviceKey` = SD-JWT `cnf`") cüzdan kuralı olur: Tamga Wallet mdoc isteğinde SD-JWT kopyalarının
  anahtarlarını aynı sırayla kullanır; servis anahtar saklamadığı için bunu zorlamaz.
- Belge yanıtındaki standart dışı `mso_mdoc` alanı kalkar ([[SPEC-PROTO-0001]] PR16). Geliştirme evresi olduğu için geçiş yolu
  yazılmaz ([[ADR-0029]]).
- Kişi alanları iki yapılandırmanın da kopya hakkı dolunca ya da belirtecin ömrü bitince silinir ([[ADR-0059]] AT5).

## K2 — Mantıksal belge ve teknik kopya: idari ve teknik geçerlilik

- Kimlik servisindeki kayıt mantıksal belgedir. Kaydın bitişi **idari geçerliliktir**: bugünkü kural aynen (730 gün, WIA ve KA
  iptal bakım süresiyle sınırlı — [[ADR-0047]] K1, ISSU_12c).
- İdari bitiş her kopyada ayrı alan olarak taşınır: SD-JWT `date_of_expiry`, mdoc `expiry_date` (AB PID adları, `full-date`; değer
  kaydın bitişinin UTC günü), seçici açıklamalıdır (`sd: always`). Kimlik şemasına isteğe bağlı alan olarak eklenir.
- Her kopyanın **teknik geçerliliği** (`exp` / `validUntil`) en çok 30 gündür (ayar `TAMGA_ID_COPY_TTL_DAYS`, varsayılan 30; idari
  süreyi aşamaz) ve kaydın bitişini geçmez. Zaman alanları bugünkü gibi saat başına yuvarlanır.
- Kapsam: yalnız yenileme belirteciyle verilen kimlik belgesi. Mağaza incelemesi DEMO belgesi ([[ADR-0033]]), iletişim belgeleri ve
  sürücü belgesi bilgisi yenilenmez; onların kopyaları bugünkü gibi idari süre kadar geçerlidir.
- 30 gün, ARF'nin "kısa teknik geçerlilik" ilkesi ile iki gerçek arasındaki dengedir: telefonu bir süre ağa bağlanmayan kişi
  (çevrim dışı) ve her yenilemenin iptal listesinde yeni indeks tüketmesi. 24 saat yalnız ZK kopyası içindir (iptal listesi
  olmadan, [[ADR-0044]]).

## K3 — Yenileme yolu (kişi alanları saklanmadan)

- Kimlik belgesi verilirken token yanıtı her zaman bir yenileme belirteci taşır (yalnız ZK kopyası kapsamı istendiğinde değil —
  [[ADR-0062]] ZS1 genişler). Belirteç [[ADR-0044]]'teki biçimdedir: yalnız kimlik servisinin açabileceği şifreli içerik (bağlı
  kayıt, kuşak, istemci örneği anahtarı — [[ADR-0060]], bitiş, verilen kapsamlar, ZK kopyasının asgari öğeleri), tek kullanımlık
  ve her kullanımda döner. Kişi alanları belirtece girmez.
- Yenileme isteği: `grant_type=refresh_token` + DPoP + aynı istemci örneği anahtarına verilmiş geçerli WIA + `identity_presentation`
  (cüzdandaki bu kayda ait bir kopyanın **bütün alanları açık** sunumu: SD-JWT VC + KB-JWT, `aud` = kimlik servisi, `nonce` =
  servisin `/nonce` ucundan, tek kullanımlık). Parametre adı mevcuttur ([[ADR-0039]]).
- Kimlik servisi sırayla denetler: belirteç (açılıyor, süresi dolmamış, örnek anahtarı aynı, kuşak geçerli); sunum (kendi imzası,
  KB-JWT ve belge sahibi anahtarı, tür, iptal listesi adresi, indeks bu kayda ait, açılmamış alan yok); kayıt (var, iptal
  edilmemiş, idari süresi dolmamış, bütün iptal bitleri 0, sağlayıcısı askıda değil — K5). Yeni kopyaların anahtarları credential
  ucunda yeni anahtar kanıtıyla (KA) bugünkü gibi denetlenir.
- Teknik süresi dolmuş kopya yenilemede kabul edilir (kayıt idari olarak geçerliyse): telefonu bir aydan uzun ağa bağlanmayan kişi
  yeniden kimlik doğrulaması yapmadan belgesini yeniler. Belge sahibi anahtarı ve WIA bu durumda da şarttır.
- Yeni kopyaların alanları sunulan kopyadakiyle aynıdır; tek fark: yaş alanları (`age_over_18`, `age_over_15`, [[ADR-0064]])
  doğum tarihinden yenileme anında yeniden hesaplanır, `date_of_expiry` kayıttan yazılır. Sunumdan okunan alanlar yalnız yeni
  erişim belirtecinin ömrü içinde bellektedir ([[ADR-0059]] AT5); diske, günlüğe ve belirtece yazılmaz.
- Yeni kopyalar aynı kayda eklenir; eski kopyalar iptal edilmez, teknik süreleri dolunca biter. Kaydın WIA ve KA iptal girişleri en
  son ihraçtakilerle yenilenir (zincirleme iptal en yeni birim kanıtını izler).
- Hata kodları cüzdanın ne yapacağını belirler: belirteç geçersiz, kayıt iptal edilmiş ya da süresi dolmuş → `invalid_grant`
  (yenileme bağı kalkar); sunum kusurlu (nonce, alan eksik) → `invalid_request` (bağ kalır, cüzdan yeniden dener); sağlayıcı askıda
  → `temporarily_unavailable` (bağ kalır, askı kalkınca sürer).
- ZK kopyası aynı belirteçle alınır, yalnız ZK kopyası kapsamı verilmişse ([[ADR-0062]]); ZK isteği sunum taşımaz.

## K4 — Ne zaman yenilenir

- Cüzdan, servisin ilan ettiği kopya politikasının eşiklerinde yeniler (ETSI TS 119 472-3 `credential_reuse_policy`: kullanılmamış
  kopya ≤ 2 ya da teknik bitişe ≤ 7 gün) — [[ADR-0023]] K1'in koşullarıyla: kullanıcıya sormadan, rastgele gecikmeyle (en çok
  6 saat, bitişten önce bitecek biçimde), ayar ("kopyaları otomatik yenile") açıkken.
- Ayar kapalıysa ya da kopyaların hepsinin süresi dolmuşsa cüzdan kişiye "kimlik belgesini yenile" seçeneğini gösterir; yenileme
  aynı yoldan kişinin dokunuşuyla yapılır.
- Kayıt iptal edilmişse ya da idari süresi dolmuşsa yenileme yoktur; kişi yeniden kimlik doğrulaması yapar.

> **Ek (2026-11-24) — kopya kullanım yöntemi (ARF ISSU_37):** Cüzdan, belge verenin `credential_reuse_policy`'sinde
> (`id: "arf_annex_ii"`) `details` dizisinde ilk gelen ve desteklediği yöntemi uygular (ETSI TS 119 472-3 §4.2.4.2 -05/-06).
> Desteklenenler: **A** `once_only` — her kopya bir kez gösterilir (aynı doğrulayıcıya da yeni kopya); kullanılmamış kopya eşiğe
> inince yeni paket istenir; istenemiyorsa (çevrimdışı) kişi uyarılır; kopyalar tükenince kullanılmış bir kopya yeniden gösterilir
> (yöntem B'ye düşüş, ISSU_47) ve çevrimiçi olunca A'ya dönülür. **B** `limited_time` — tek kopya istenir, her doğrulayıcıya o
> gösterilir, yenileme yalnız süreye bağlıdır (ISSU_48–50; kopya eşiği uygulanmaz). **D** `per-relying-party` — her doğrulayıcıya
> kendi kopyası, aynı doğrulayıcıya hep aynısı (bugünkü davranış). C `rotating-batch` desteklenmez. Politika yoksa ya da desteklenen
> yöntem yoksa D sürer. Tamga belge verenleri D'yi ilk sırada ilan etmeyi sürdürür (`["per-relying-party", "once_only"]`); bu
> yüzden Tamga belgelerinde davranış değişmez. Kod: `wallet-core` `reuseMethodOf`, `selectCopy` / `planCopy` / `copiesLow`.
> Proje yönetimi onayıyla.

## K5 — Cüzdan sağlayıcısı listede askıda ya da iptal edilmiş

- Kimlik servisi her kayda, ihraçtaki WIA'yı imzalayan cüzdan sağlayıcısının güven listesindeki kimliğini yazar (kurum kimliği,
  kişisel veri değil); yenilemede en son WIA'nınkiyle günceller.
- 6 saatlik birim denetiminde (açılışta da, [[ADR-0047]] K1) her kayıt için önce sağlayıcının imzalı listedeki durumuna bakılır:

  | Liste ne diyor | Kimlik servisi ne yapar |
  |---|---|
  | Liste okunamıyor ya da bayat | Hiçbir şey değişmez (bilinmiyor); sonraki turda yeniden bakılır |
  | Sağlayıcı `ACTIVE` (ya da `ROLLING_OVER`) | Olağan WIA ve KA denetimi; askı işareti varsa kalkar |
  | Sağlayıcı `SUSPENDED` | Kayıt **askıya alınır**: yeni kopya, yenileme ve ZK kopyası verilmez; var olan kopyalar teknik süreleri dolunca (en geç 30 gün; ZK kopyası 24 saat) kullanılamaz olur |
  | Sağlayıcı `REVOKED`, `RETIRED` ya da listede yok | Kayıt **iptal edilir** (neden `wallet-provider-invalid`); bağlı sürücü belgesi bilgisi de |
  | Başka bir durum | Bilinmiyor; hiçbir şey değişmez |

- Askı geri alınabilir: sağlayıcı yeniden `ACTIVE` olunca işaret kalkar ve yenileme kendiliğinden sürer; kişi yeniden kimlik
  doğrulaması yapmaz. Kimlik servisinin iptal listesinde askı biti yoktur ([[ADR-0048]]); askı, kısa teknik geçerlilikle ve
  yenilemenin durmasıyla sağlanır. Ağın askıdaki kurum kararıyla ([[ADR-0088]]) aynı ilke: askıdayken kullanılmaz, askı kalkınca
  döner.
- Sağlayıcı kimliği olmayan eski kayıtlar ve dış listedeki (federasyon) sağlayıcılar bu denetime girmez; olağan WIA/KA denetimi
  sürer.

# Değerlendirilen seçenekler

| Seçenek | Sonuç | Neden |
|---|---|---|
| mdoc standart dışı alanla kalsın (PR16) | ret | Başka cüzdan kimliğin mdoc'unu alamaz; iPhone tarayıcısı ve yakın alan yalnız mdoc konuşur |
| mdoc'a ayrı yetki (ayrı `scope`) | ret | Kişi iki kez kimlik doğrulaması yapardı; AB'de PID'in iki biçimi tek yetkiyle alınır |
| Kopyalar 2 yıl kalsın, gerekçe yazılsın | ret | 10 doğrulayıcıdan sonra kopya yeniden kullanılır; ARF §5.3'e ters |
| Kişi alanlarını şifreli olarak yenileme belirtecine koymak | ret | Kişi alanlarının sunucunun anahtarıyla açılabilen bir kopyası cüzdanda dolaşırdı; [[ADR-0044]] belirtece yalnız asgari öğeleri koydu. Alanların kaynağı zaten cüzdandaki imzalı kopyadır |
| Kişi alanlarını kimlik servisinde saklamak | ret | [[ADR-0011]] K4, IDP9 |
| Her yenilemede yeniden kimlik doğrulaması | ret | Kişiye ayda bir yüz taraması; AB'de yeniden verme kullanıcı eylemi gerektirmez (ISSU_42) |
| 7 günlük kopyalar | ret | İptal listesi indeksleri dört kat hızlı tükenir |
| Sağlayıcı askısında kayıtları hemen iptal etmek | ret | Askı geri alınamaz olurdu; kişi yeniden kimlik doğrulaması yapmak zorunda kalırdı. Ciddi durumda sağlayıcı `REVOKED` yapılır |
| Kimlik listesine askı biti (`bits = 2`) | ret | [[ADR-0048]]: kimlikte askı yok (PID kuralı); kısa teknik süre aynı sonucu iptal listesine durum eklemeden verir |

# Değişmezler

| Kod | Kural |
|---|---|
| IR1 | Kimlik belgesinin mdoc kopyası metadata'da ilan edilen ayrı `mso_mdoc` yapılandırmasıyla standart belge isteğinden verilir; belge yanıtında standart dışı alan yoktur; tek yetki iki biçimi kapsar ve kopya hakkı yapılandırma başınadır. |
| IR2 | Yenileme belirteciyle verilen kimlik belgesinde her kopyanın teknik geçerliliği en çok 30 gündür ve kaydın idari bitişini aşmaz; idari bitiş her kopyada `date_of_expiry` (mdoc `expiry_date`) olarak taşınır. |
| IR3 | Kimlik belgesinin yenilenmesi kişi alanlarını sunucuda saklamadan yapılır: alanlar cüzdanın bu kayda ait, bütün alanları açık ve belge sahibi anahtarıyla bağlı kopya sunumundan okunur ve yalnız erişim belirtecinin ömrü içinde bellekte durur. |
| IR4 | Yenileme yalnız kayıt iptal edilmemiş, idari süresi dolmamış, bütün iptal bitleri 0 ve sağlayıcısı askıda değilken; aynı istemci örneği anahtarına verilmiş geçerli WIA ve tek kullanımlık, döndürülen yenileme belirteciyle yapılır. |
| IR5 | Yenilenen kopyada yaş alanları doğum tarihinden yenileme anında yeniden hesaplanır; öteki kişi alanları sunulan kopyadakiyle aynıdır. |
| IR6 | Cüzdan sağlayıcısı güven listesinde `REVOKED`, `RETIRED` ya da listede yoksa kimlik servisi o sağlayıcının birimlerine bağlı kayıtları iptal eder; `SUSPENDED` ise kayıtları askıya alır (yeni kopya, yenileme ve ZK kopyası yok) ve askı kalkınca yenileme sürer; liste okunamıyorsa hiçbir şey değişmez. |
| IR7 | Aynı erişim belirteciyle aynı anahtara verilen iki biçimin kopyası aynı iptal indeksini taşır; eşleşme yalnız belirtecin ömrü içinde bellekte yapılır, anahtar parmak izi kalıcı yazılmaz. |

# Sonuçlar

- Değişen kararlar: [[ADR-0013]] K1 ve MD2 (K1), [[ADR-0023]] AR4 ve [[ADR-0044]] K3 (kimlik belgesi artık sunumla yenilenir —
  kişi alanları yine saklanmaz), [[ADR-0059]] AT2 (yapılandırma başına), [[ADR-0062]] ZS1 (yenileme belirteci her kimlik
  yetkisinde). Her birine "Değişti" notu.
- Şartnameler: [[SPEC-PROTO-0001]] (PR16 kalkar; kimlik mdoc yapılandırması, yenileme isteği), [[SPEC-ID-0003]] (teknik ve idari
  geçerlilik, sağlayıcı denetimi), [[SPEC-WALLET-0001]] (kimlik yenilemesi). Çerçeve: [[FW-RB-0003]] §6.1 (geçerlilik).
- Şema: kimlik türüne isteğe bağlı `date_of_expiry` (tür metadata'sı ve `vct#integrity` değişir; güven listeleri yeniden yayımlanır).
- Kod: kimlik servisi (operatör deposu: metadata, belge ucu, belirteç ucu, birim denetimi); `@tamga-network/issuer` (mdoc
  yapılandırmasında kapsam ve kopya politikası), `@tamga-network/trust` (`walletProviderOfKey`), `@tamga-network/mdoc`
  (`expiry_date` full-date), `@tamga-network/wallet-core` (standart mdoc isteği, `renewIdentityCredential`,
  `scheduleIdentityRenewals`); Tamga Wallet uygulaması yeni işlevleri çağırır.
- Kalan risk ve açık iş: her yenileme iptal listesinde 10 yeni indeks tüketir (iki biçim aynı indeksi paylaşır). Kimlik servisinin
  tek listesi 100.000 indeksli ve %80'de doluyor; liste dolunca yeni liste açma ([[SPEC-CRED-0003]] §6) kimlik servisinde henüz
  yok ve ölçek öncesi yapılmalıdır. Kimlik servisi yenileme sıklığından cüzdanın etkin olduğunu öğrenir (ayda bir), hangi
  doğrulayıcıya ne gösterildiğini öğrenmez ([[ADR-0044]] ile aynı denge).

# Durum

**Accepted — 2026-11-16** (proje yönetimi onayı; ARF 3.0.0 okuma kararları, birebir alıntı özel onay kaydında). DECISIONS: D-ID-17.
IR1–IR7 bağlayıcıdır. Yapılandırma kimliği `urn:tamga:id:IdentityAttestation:1:mso_mdoc` ve iptal nedeni `wallet-provider-invalid`
kamuya açık ad onayı bekler.
