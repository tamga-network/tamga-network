---
document_id: GUIDE-0013
title: "Sandbox: test ağı"
status: Active
version: 1.0.0
created: 2026-10-03
last_updated: 2026-10-03
summary: >
  Gerçek ağdan ayrı test ağı sandbox.tamga.network ile uçtan uca deneme: adresler, güven çapasını sabitlemek, cüzdanı
  sandbox'a bağlamak, örnek kişilerle belge almak, örnek doğrulayıcılarda göstermek, iptal ve askı durumlarını denemek,
  kurallar ve sıfırlama.
---

# Sandbox: test ağı

Bu rehber, Tamga'ya bağlanan bir yazılımı (özellikle bir cüzdanı, ama doğrulayıcı ya da belge veren de olabilir) gerçek ağa
dokunmadan baştan sona denemek isteyenler içindir.

**Ne zaman okunur:**
- Cüzdanınızın gerçek bir kurumdan belge almadan önce belge alma, gösterme ve iptal akışlarını denemek istediğinizde.
- Doğrulayıcınızın olumsuz sonuçları (iptal, askı, yaş şartı tutmayan kişi) doğru verdiğini görmek istediğinizde.
- [[GUIDE-0009|Uyum testlerini]] geçtikten sonra, gerçek bir telefonla uçtan uca deneme yaparken.

## Sandbox nedir?

Sandbox, Tamga Network'ün gerçek ağdan **tamamen ayrı** test ağıdır ([[ADR-0038]]). Hizmetler gerçek ağdakiyle aynı koddur;
yalnız güven kökü, anahtarlar, güven listeleri ve veriler ayrıdır ve sahtedir:

- Kendi test kök sertifikası vardır: **Tamga Sandbox Root CA (TEST)**. Gerçek ağın kökü sandbox'ta hiçbir şey imzalamaz;
  sandbox kökü gerçek ağın hiçbir listesinde yer almaz (`ADR-0038/SB1`).
- Sandbox [[t:LOTL]]'u ve ulusal listesi kendini `"environment": "sandbox"` alanıyla test olarak işaretler
  ([[SPEC-TRUST-0001]] §3). Gerçek ağ için yapılandırılmış bir cüzdan ya da doğrulayıcı bu listeyi kabul etmez
  (`ADR-0038/SB2`).
- Kişiler, etkinlikler ve belgeler örnektir; gerçek kişisel veri yoktur. Kimlik doğrulama sahte bir sağlayıcıyla yapılır
  (`ADR-0038/SB3`). Örnek kurumlar gerçek kurum adlarını taşır (aşağıdaki nota bakın).
- Her sandbox sayfası ve sandbox'a bağlı her cüzdan ekranı "SANDBOX · test" işaretini gösterir (`ADR-0038/SB4`).
- Veriler her gece ilk hâline döner (`ADR-0038/SB5`).

Sandbox belgesi gerçek bir işlemde kullanılamaz: gerçek doğrulayıcı sandbox kökünü tanımaz.

## Adresler

Sandbox, gerçek ağın adres düzenini `sandbox` alt adıyla tekrarlar. Bir cüzdan ya da doğrulayıcı yalnız adresleri ve güven
çapasını değiştirerek geçer.

| Adres | Ne | Gerçek ağdaki karşılığı |
|---|---|---|
| `https://sandbox.tamga.network` | sandbox sayfası: güven çapası, adresler, örnek kişiler, belge teklifleri, örnek doğrulayıcılar | — |
| `https://trust.sandbox.tamga.network` | test güven listeleri (`lotl.jws`, `tl-tr.jws`), çapa günlüğü (`anchors.jsonl`), `keys/` | `trust.tamga.network` |
| `https://issuer.sandbox.tamga.network/{kurum}` | örnek kurumların belge verme servisi ([[t:OpenID4VCI]]) | `issuer.tamga.network` |
| `https://status.sandbox.tamga.network` | iptal listeleri (Token Status List) | `status.tamga.network` |
| `https://verify.sandbox.tamga.network` | test doğrulayıcısı ([[t:OpenID4VP]]) | `verify.tamga.network` |
| `https://wallet.sandbox.tamga.network` | test cüzdan sağlayıcısı (Wallet Instance Attestation) | `wallet.tamga.network` |
| `https://id.sandbox.tamga.network` | kimlik ve iletişim belgeleri, yalnız sahte kimlik doğrulama | `id.tamga.network` |

Sandbox'ta kurum konsolu yoktur: örnek kurumlar, kişiler ve yetkiler tohum verisinden gelir ve her sıfırlamada ilk hâline
döner.

## 1. Güven çapasını sabitleyin

Cüzdan ve doğrulayıcı, LOTL imzasını yalnız uygulamaya gömülü parmak izleriyle kabul eder; liste sunucusuna güvenilmez.
Sandbox için **ayrı** bir sabit küme kullanın:

1. `https://sandbox.tamga.network` sayfasındaki sandbox LOTL imzacısının ve test kökünün SHA-256 parmak izlerini alın (aynı
   değerler `https://trust.sandbox.tamga.network/keys/root-fingerprints.json`'da da durur; sayfadaki değerle karşılaştırın).
2. Bu parmak izlerini gerçek ağın pinlerinden **ayrı** bir yapılandırmada tutun. İki kümeyi asla birleştirmeyin.
3. Listeyi yüklerken beklenen ağı verin. `@tamga-network/trust` ve `@tamga-network/wallet-core` bunu `environment` seçeneğiyle
   yapar:

```ts
import { fetchTrustSource } from "@tamga-network/wallet-core";

const { source } = await fetchTrustSource("https://trust.sandbox.tamga.network", http, {
  pins: { lotlSigners: [SANDBOX_LOTL_SIGNER_FINGERPRINT], environment: "sandbox" },
});
```

Kendi yükleyicinizi yazıyorsanız: imzayı doğruladıktan sonra LOTL'daki ve ulusal listedeki `environment` alanını
karşılaştırın (alan yoksa `production` sayılır); eşleşmiyorsa durun ([[SPEC-TRUST-0001]] §6).

## 2. Cüzdanı sandbox'a bağlayın

**Tamga Wallet:** Ayarlar → Geliştirici → **Ağ: Tamga Network | Sandbox**. Sandbox seçilince cüzdan sandbox güven köküne ve
yukarıdaki adreslere geçer; her ekranın üstünde "SANDBOX · test" şeridi görünür. Gerçek ağ ile sandbox güveni karışmaz.

**Başka bir cüzdan:** [[GUIDE-0005]]'teki adımları sandbox adresleriyle uygulayın:

| Ayar | Sandbox değeri |
|---|---|
| güven listeleri | `https://trust.sandbox.tamga.network` + sandbox pinleri + `environment: "sandbox"` |
| cüzdan sağlayıcısı (WIA / WUA) | `https://wallet.sandbox.tamga.network` |
| kimlik belgesi servisi | `https://id.sandbox.tamga.network` |
| belge veren dizini | sandbox ulusal listesindeki `issuers[]` (adresleri `issuer.sandbox.tamga.network`) |

Sandbox'ı ekranda belli edin (`ADR-0038/SB4`) ve sandbox'ta alınan belgeleri gerçek ağın belgeleriyle karıştırmayın.

## 3. Örnek kurumlar ve belge türleri

::: warning Kurum adları hakkında
Kurum adları yalnızca gerçekçi bir deneme ortamı için kullanılmıştır; bu kurumlarla bir ilişki ya da anlaşma yoktur. Buradaki
belgeler test anahtarıyla imzalıdır ve hiçbir yerde geçerli değildir. Kurumların logoları kullanılmaz.
:::

| Kurum | Belge türleri (`vct`) |
|---|---|
| İstanbul Bilgi Üniversitesi (TEST) — `issuer.sandbox.tamga.network/istanbul-bilgi` | `urn:tamga:edu:StudentCredential:1`, `urn:tamga:edu:DiplomaCredential:1` |
| Bubilet (TEST) — `issuer.sandbox.tamga.network/bubilet` | `urn:tamga:tkt:EventTicket:1` (kurgusal konserler) |
| Paribu Cineverse (TEST) — `issuer.sandbox.tamga.network/paribu-cineverse` | `urn:tamga:tkt:EventTicket:1` (kurgusal film seansları; sinema bileti ayrı bir tür değildir: film ve seans `event_name`, salon `venue_name` alanındadır) |
| Kimlik servisi — `id.sandbox.tamga.network` | `urn:tamga:id:IdentityAttestation:1`, takma ad tohumu (PseudonymSeed), `urn:tamga:contact:EmailAddress:1`, `urn:tamga:contact:PhoneNumber:1` |

## 4. Örnek kişiler

Sandbox sayfasındaki **örnek kişiler** listesi uydurmadır: farklı ülkelerden, farklı yaşlarda ve farklı durumlarda 13 kişi.
Kimlik numaraları 12 haneli ve `99` ile başlar; bilerek geçersizdir (`ADR-0038/SB3`). Bazı kişiler olumsuz sonuçları denemek
için hazırlanmıştır:

| Kişi | Hazır durum | Beklenen sonuç |
|---|---|---|
| Timur Rahimov | diploması verildikten hemen sonra **iptal** edilir | bir sonraki durum yayınından sonra doğrulama REJECTED |
| Gülnaz Abenova | diploması verildikten hemen sonra **askıya alınır** | askıdaki belge kabul edilmez; teklif sayfasından geri alınabilir |
| Elvin Həsənov | bileti verildikten hemen sonra **iptal** edilir (iade) | bir sonraki durum yayınından sonra kapı doğrulaması REJECTED |
| Aibek Toktogulov | kaydı dondurulmuş öğrenci (`student_status: ON_LEAVE`) | öğrenci belgesi bu durumu taşır |
| Aruzhan Seitkali | 17 yaşında | yaş kontrolü (≥ 18) olumsuz |
| Deniz Örnek | hiçbir kurumda kaydı yok | kurum belgesi alamaz |

Bir kişinin sayfası (`/people/<anahtar>`) o kişinin alabileceği belgeleri gösterir.

## 5. Belge alın

**Kurum belgeleri (öğrenci belgesi, diploma, bilet):** kişinin sayfasında belge türünü (bilet için kurumu — konser ya da
sinema —, etkinliği ve bilet sınıfını) seçin. Sayfa bir [[t:OpenID4VCI]] teklifi açar: QR kodu ve bağlantı (`openid-credential-offer://…`), ayrıca ayrı
gösterilen bir PIN (`tx_code`). Cüzdanla QR'ı okutun, PIN'i girin. Teklif sayfası belgenin verildiğini ve durumunu gösterir.

**Kimlik ve iletişim belgeleri:** bu belgeleri cüzdan başlatır (authorization code akışı). Kişinin sayfasındaki QR, kimlik
servisinin teklifidir. Sahte kimlik doğrulama ekranında, sayfada adı yazılı kişiyi seçin; gerçek belge ya da yüz taraması
istenmez.

**E-posta ve telefon belgeleri:** sandbox'ta kod hiçbir yere gönderilmez; kod girme ekranında "SANDBOX · TEST" kutusunda
gösterilir. Yalnız örnek adresler kabul edilir: `.example` ya da `.test` alan adlı bir e-posta veya +44 7700 900000 ile
+44 7700 900999 arasında bir telefon numarası (örnek kişilerin adresleri sayfalarında yazılıdır). Gerçek bir adres
reddedilir.

## 6. Belgeyi gösterin

Sandbox sayfasındaki **örnek doğrulayıcılar** test doğrulayıcısında imzalı bir [[t:OpenID4VP]] isteği açar ve QR'ını
gösterir. Cüzdanla okutun; sonuç (ACCEPTED, REJECTED ya da INDETERMINATE), yapılan denetimler ve paylaşılan alanlar aynı
sayfada görünür.

| Senaryo (`/verify/<senaryo>`) | Ne istenir |
|---|---|
| `signin` | Tamga ile giriş — yalnız takma ad |
| `signup` | siteye kayıt — ad, soyad ve takma ad |
| `age` | yaş ≥ 18 (seçici açıklama) |
| `age-zk` | yaş ≥ 18, sıfır bilgi ispatıyla (cüzdan destekliyorsa) |
| `diploma` | iş başvurusu: diploma |
| `student` | öğrenci indirimi: öğrenci belgesi |
| `ticket` | etkinlik kapısı: bilet (konser ya da sinema) |
| `identity` | kimlik belgesiyle etkinlik girişi |

Kendi doğrulayıcınızı denemek için: doğrulayıcınızı sandbox listesine ve sandbox pinlerine bağlayın, sandbox'ta alınmış
belgeleri gösterin. Kendi doğrulayıcınızı ya da kurumunuzu sandbox listesine kendiniz eklemek sonraki bir aşamadır
([[ADR-0038]] K7).

## 7. İptal ve askıyı deneyin

Diploma ve biletin teklif sayfasında **iptal et**, **askıya al** ve **geri al** düğmeleri vardır. Hazır durumlu kişilerde
(yukarıdaki tablo) bu adım belge verilir verilmez kendiliğinden yapılır. Değişiklik, belge veren bir sonraki durum listesini
yayınladığında etkili olur (sabit aralıklı yayın; anında değil). Ardından aynı belgeyi bir örnek doğrulayıcıda yeniden
gösterin: iptal edilmiş ya da askıdaki belge kabul edilmemelidir. Öğrenci belgesi kısa ömürlüdür ve durum listesi taşımaz.

## Kurallar ve sınırlar

- **Gerçek kişisel veri girmeyin.** Sandbox'a yalnız örnek kişiler ve örnek adresler girer.
- **Kalıcılık beklemeyin.** Sandbox verileri her gece 03:30'da (Türkiye saati) ilk hâline döner: verilen belgelerin kayıtları,
  iptal listeleri ve çapa günlüğü sıfırlanır. Cüzdanınızdaki sandbox belgeleri sıfırlamadan sonra doğrulanamayabilir; yeniden
  alın. Güven kökü ve listelerin imza anahtarları sıfırlanmaz; cüzdandaki sandbox pinleri değişmez.
- **Gerçek ağ ile karıştırmayın.** Sandbox pinlerini gerçek ağ yapılandırmanıza eklemeyin; sandbox belgesi gerçek
  doğrulayıcıda zaten geçmez.
- Sandbox'ta hizmet seviyesi taahhüdü yoktur; kesintiler gerçek ağın durumunu göstermez.

## İlgili

[[ADR-0038]] · [[SPEC-TRUST-0001]] · [[GUIDE-0005]] · [[GUIDE-0010]] · [[GUIDE-0009]] · [[GUIDE-0012]]
