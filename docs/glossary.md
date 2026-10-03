---
document_id: GLOSSARY
title: "Sözlük"
status: Active
version: 1.0.0
last_updated: 2026-10-02
created: 2026-10-02
summary: >
  Tamga Network belgelerinde geçen terimlerin sade Türkçe açıklamaları. Bağlayıcı tanımlar Tamga ARF Ek D'dedir.
---

# Sözlük

Bu sayfa belgelerde geçen terimleri sade dille açıklar; bağlayıcı tanımlar Tamga ARF Ek D'dedir ([[FW-DEF-0001]]) ve
çelişkide o geçerlidir.

**Terimler nasıl yazılır?** Rol ve gündelik kavramlar Türkçe yazılır, İngilizce terim ilk kullanımda parantezde verilir:
belge (credential), doğrulayıcı (verifier), güven listesi (trust list). Teknik, kriptografik ve protokol terimleri ile
kısaltmalar İngilizce kalır: salted hash, selective disclosure, holder binding, PID, QTSP. Her terimin yanındaki ⓘ simgesine
gelince (telefonda dokununca) kısa bir açıklama açılır.

<!-- TERMS:BEGIN — docs/.vitepress/terms.json'dan üretilir (npm run docs:sync); bu işaretler arasını elle düzenlemeyin -->

## Temel kavramlar

**ARF** (Architecture and Reference Framework) — Rolleri, mimariyi, güven modelini ve kuralları anlatan belge seti. Tamga ARF, AB ARF'sinin düzenini izler.

**eIDAS** (electronic IDentification, Authentication and trust Services) — AB'nin elektronik kimlik ve güven hizmetleri tüzüğü; eIDAS 2.0 Avrupa Dijital Kimlik Cüzdanı'nı getirir.

**EUDI Wallet** — eIDAS 2.0'ın tanımladığı Avrupa Dijital Kimlik Cüzdanı; Tamga aynı biçim ve protokolleri kullanır.

**Federasyon** (federation) — Her ülkenin kendi güven listesini işlettiği ve listelerin listesinde birleştiği model; Tamga dış listeleri de gösterebilir.

**Ortak defter** (ledger) — Güven kayıtlarının birden çok bağımsız işletmeci tarafından birlikte tutulduğu kayıt (izinli bir blockchain). Tamga onu en az iki bağımsız işletmeci katıldığında ekler; o güne kadar işi imzalı güven listeleri görür.

**OTS** (Organization of Turkic States) — Türk Devletleri Teşkilatı (TDT); Tamga yönetişimi üye devletlere yer ayırır.

**Rulebook** — Bağlayıcı kurallar seti. Tamga Rulebook tüm katılımcıların kurallarını taşır; her belge türünün ondan dallanan kendi rulebook'u vardır.

**Trust framework** — ARF'nin yönetişim bölümü: kimin katılabileceği, katılım ve uyumun nasıl işlediği, sözleşmeler ve devletlere devir.

**Uyum testi** (conformance) — Bir uygulamanın kurallara uyduğunun, yayınlanan test vektörlerini ve denetimleri geçerek gösterilmesi.

**Validator** — Zincir aşamasında planlanan izinli defterde (Besu / QBFT) blok imzalayan işletmeci düğümü.

## Roller

**Aracı** (intermediary) — Bir relying party adına belge doğrulayan hizmet; cüzdan hem aracıyı hem de hizmet verdiği relying party'yi gösterir.

**Belge sahibi** (holder) — Belgeyi cüzdanında tutan ve kime göstereceğine karar veren kişi.

**Belge veren** (issuer) — Belgeyi imzalayıp veren kurum: üniversite, meslek kuruluşu, kamu kurumu ya da şirket.

**Cüzdan sağlayıcısı** (wallet provider) — Cüzdanı sunan ve cüzdan ile anahtar kanıtlarını imzalayan kuruluş. Tamga Wallet ağın ilk cüzdanıdır.

**Doğrulayıcı** (verifier) — Gösterilen belgeyi denetleyen taraf: imza, belge verenin güven listesindeki kaydı, durum ve politika. Relying party diye de anılır.

**Kayıt kurumu** (registrar) — Belge verenleri ve relying party'leri kaydeden, güven listesine girmeden önce kayıt verilerini denetleyen birim.

**QTSP** (Qualified Trust Service Provider) — eIDAS kapsamında ulusal denetim kurumundan nitelikli statü almış güven hizmeti sağlayıcısı.

**Relying party** — Cüzdandan belge isteyen ve doğrulayan kayıtlı kuruluş: işveren, web sitesi, kurum.

**RP** (Relying Party) — Relying party'nin kısaltması: belge isteyen ve doğrulayan kuruluş.

**TLSO** (Trusted List Scheme Operator) — Ulusal güven listesini derleyen, imzalayan ve yayınlayan kuruluş. Bugün Türkiye için bunu Tamga, devlet adına geçici olarak yapar.

**Yetkili kaynak** (authentic source) — Belgedeki bilginin asıl sahibi olan sistem; örneğin üniversitenin öğrenci bilgi sistemi.

## Belgeler

**Attestation** — Bir kişi ya da şey hakkında imzalı beyan; cüzdanda taşınır. Öğrenci belgesi ya da diploma gibi.

**Belge** (credential) — Belge verenin imzaladığı ve kişinin cüzdanında duran dijital belge; kişi yalnız istenen alanları gösterir.

**Belge teklifi** (credential offer) — Belge verenin cüzdanı bir belgeyi almaya çağırdığı ileti; genelde QR kod ya da bağlantı.

**Belge verme** (issuance) — Belge verenin belgeyi kişinin cüzdanına teslim etmesi (Tamga'da OpenID4VCI ile).

**EAA** (Electronic Attestation of Attributes) — Kişinin bir özniteliğini (diploma, üyelik gibi) doğrulayan belge için eIDAS'taki ad.

**ECTS** (European Credit Transfer and Accumulation System) — Ders yükünü anlatan Avrupa kredi transfer ve biriktirme sistemi.

**ELM** (European Learning Model) — Öğrenme kazanımlarını, nitelikleri ve kredileri tanımlayan AB veri modeli.

**ISCED-F** (International Standard Classification of Education: Fields) — UNESCO'nun eğitim ve öğretim alanları sınıflandırması.

**İptal** (revocation) — Bir belgenin süresi dolmadan geçersiz kılınması; belge veren bunu doğrulayıcıların denetlediği iptal listesinde işaretler.

**İptal listesi** (status list) — Her belgenin tek bir konumu olduğu sıkıştırılmış, imzalı liste; geçerli, askıda ya da iptal olduğunu söyler.

**mDL** (mobile Driving Licence) — Cüzdanda mdoc biçiminde (ISO/IEC 18013-5) tutulan sürücü belgesi.

**Mdoc** — ISO/IEC 18013-5 mobil belge biçimi, CBOR ile kodlanır; yüz yüze gösterme ve mobil ehliyet için kullanılır.

**PID** (Person Identification Data) — Devletin en yüksek güvence seviyesinde verdiği temel kimlik verisi. Tamga bu rolü üstlenmez; Tamga'nın kimlik belgesi PID değildir.

**PuB-EAA** (Public-Body Electronic Attestation of Attributes) — Bir authentic source'tan sorumlu kamu kurumunun ya da onun adına verilen attestation.

**QEAA** (Qualified Electronic Attestation of Attributes) — Nitelikli güven hizmeti sağlayıcısının (QTSP) verdiği EAA; attestation'lar arasında hukuki etkisi en güçlü olandır.

**Refresh token** — Cüzdanın, kişi bütün akışı tekrarlamadan yeni belge kopyaları almasını sağlayan uzun ömürlü jeton.

**SD-JWT VC** (Selective Disclosure JWT Verifiable Credential) — Selective disclosure destekli JSON tabanlı belge biçimi; EUDI Wallet'ta ve Tamga'da çevrimiçi gösterme için kullanılır.

**Şema kataloğu** (schema catalogue) — Belge türlerinin (vct), şemalarının ve bütünlük özetlerinin yayımlandığı katalog (schemas.tamga.network).

**Toplu belge verme** (batch issuance) — Aynı belgenin birden çok tek kullanımlık kopyasının birlikte verilmesi; her doğrulayıcı farklı kopya görür (ilişkilendirilemezlik).

**Vct** (Verifiable Credential Type) — SD-JWT VC'de belge türünün kalıcı kimliği; Tamga'da urn:tamga:edu:Diploma:1 gibi bir URN'dir.

## Gösterme ve gizlilik

**Accountable disclosure** — Kimliğin yalnız bağımsız emanetçilerin eşik kararıyla ve hukuki emirle açılabildiği tasarım (zincir aşaması, araştırma).

**DCQL** (Digital Credentials Query Language) — Doğrulayıcının OpenID4VP'de hangi belgeleri ve hangi alanları istediğini yazdığı sorgu dili.

**Disclosure** — SD-JWT'de bir alanın değeri, rastgele bir salt ile paketlenmiş hâli; belge sahibi yalnız gereken disclosure'ları verir.

**Doğrulama hattı** (verification pipeline) — Doğrulayıcının bir gösterimde yaptığı sabit denetim sırası: imza, belge veren, güven listesi, status, holder binding, politika.

**Holder binding** — Belgeyi yalnız belge sahibinin cihazındaki bir anahtara bağlamak; kopyalanan belge gösterilemez.

**İşlem günlüğü** (transaction log) — Cüzdanın cihazda tuttuğu verme ve gösterme kaydı; yalnız kişi dışa aktarabilir.

**KB-JWT** (Key Binding JWT) — Cüzdanın gösterme anında belge anahtarıyla imzaladığı kısa belirteç; anahtarın belge sahibinde olduğunu kanıtlar.

**Key binding** — Belgeyin kişinin cüzdanındaki bir anahtara bağlanması; yalnız o cüzdan gösterebilir.

**Longfellow ZK** — mdoc belgeleri için açık bir sıfır bilgi ispatı sistemi; Tamga doğum tarihini göstermeden "18 yaşından büyük" gibi bilgileri kanıtlamak için kullanır.

**Nonce** — Bir kez kullanılan rastgele değer; doğrulayıcı gönderir, cüzdan imzalar, böylece eski bir gösterme yeniden kullanılamaz.

**Proof of possession** — Gösteren kişinin, belgenin bağlı olduğu özel anahtarı elinde tuttuğunun taze bir meydan okumayı imzalayarak kanıtlanması.

**Salted hash** — Bir değerin rastgele bir salt ile birlikte alınan özeti; değer özetten tahmin edilemez. SD-JWT alanları bu yolla gizler.

**Selective disclosure** — Bir belgeden yalnız doğrulayıcının istediği alanların gösterilmesi, fazlasının değil.

**Takma ad** (pseudonym) — Cüzdanın her web sitesi için ayrı türettiği kararlı hesap kimliği; iki site aynı kişiyi eşleştiremez.

**ZK** (Zero-Knowledge proof) — Bir bilginin doğru olduğunu, bilginin kendisini göstermeden kanıtlayan ispat; örneğin doğum tarihi olmadan "18 yaşından büyük".

## Güven

**Çapa günlüğü** (anchor log) — İmzalı listelerin özetlerinin eklendiği, herkese açık ve geri alınamaz kayıt; bir listenin sessizce değiştirilmediği denetlenebilir.

**Erişim sertifikası** (access certificate) — Relying party'nin isteklerini imzaladığı X.509 sertifikası; client kimliği bu sertifikanın özetinden türetilir.

**Güven çapası** (trust anchor) — Doğrulayıcının ilk güvendiği kök anahtar ya da sertifika; geri kalan her şey ona kadar denetlenir.

**Güven listesi** (trust list) — Bir ülkenin kök sertifikalarını, belge verenlerini ve kayıtlı relying party'lerini taşıyan imzalı liste. Bugün Tamga'da güven bu listelere dayanır; ortak defter sonra gelir.

**Kayıt sertifikası** (registration certificate) — Kayıt kurumunun, bir relying party'nin hangi alanları hangi amaçla isteyebileceğini bildiren imzalı belgesi (en çok 12 ay).

**Kimlik doğrulama** (identity proofing) — Belge verilmeden önce kişinin gerçekten o kişi olduğunun doğrulanması; örneğin kimlik kartı ve canlılık testiyle.

**Kök sertifika** (root CA) — Bir sertifika zincirinin dayandığı en üst sertifika otoritesi; Tamga'da güven listesi üzerinden sabitlenir.

**LoA** (Level of Assurance) — Bir kimliğe ya da belgeye ne kadar güvenilebileceği; Tamga kimlik doğrulama (T), belge veren (I) ve cüzdan (W) için ayrı seviyeler kullanır.

**LoTE** (List of Trusted Entities) — ETSI TS 119 602 liste biçimi; Tamga listelerinin LoTE görünümünü yayınlar ve dış LoTE listelerini okuyabilir.

**LOTL** (List of Trusted Lists) — Ülke güven listelerinin adreslerini, imzacılarını ve tanınma durumlarını gösteren imzalı liste.

**QES** (Qualified Electronic Signature) — Nitelikli sertifika ve nitelikli cihazla atılan elektronik imza; AB'de ıslak imzayla eşdeğerdir.

**QSCD** (Qualified Signature Creation Device) — Nitelikli imza anahtarını koruyan sertifikalı donanım ya da uzak hizmet.

**Trusted List** — AB üye devletlerinin nitelikli güven hizmeti sağlayıcılarını yayımladığı ETSI TS 119 612 biçimi.

**WRPAC** (Wallet-Relying Party Access Certificate) — Relying party'nin cüzdanlara gönderdiği istekleri imzaladığı erişim sertifikası.

**WRPRC** (Wallet-Relying Party Registration Certificate) — Relying party'nin hangi alanları neden isteyebileceğini bildiren kayıt sertifikası.

**x509_hash** — HAIP'teki client kimliği biçimi: kimlik, relying party'nin erişim sertifikasının base64url SHA-256 özetidir.

## Cüzdan

**Cihaz kanıtı** (device attestation) — Telefonun işletim sisteminden (App Attest, Play Integrity) gelen, gerçek cihazda değiştirilmemiş uygulamanın çalıştığına dair kanıt.

**Key attestation** — Cüzdan sağlayıcısının, belge anahtarının güvenli donanımda üretildiğini ve tutulduğunu bildiren kısa ömürlü beyanı.

**Passkey** — Kullanıcının cihazında duran, oltalamaya dayanıklı oturum açma anahtarı (WebAuthn/FIDO2).

**Wallet unit** — Bir cüzdanın belirli bir cihazdaki kurulumu.

**WIA** (Wallet Instance Attestation) — Cüzdan sağlayıcısının imzaladığı, cüzdan kurulumunun gerçek olduğunu bildiren kısa ömürlü beyan; belge veren, belgeyi vermeden önce denetler.

**WUA** (Wallet Unit Attestation) — Cüzdan sağlayıcısının bir cüzdan birimi ve anahtarlarının güvenliği hakkındaki attestation'ı; güncel AB metinlerinde WIA ve key attestation olarak ikiye ayrılır.

## Standartlar ve protokoller

**DPoP** (Demonstrating Proof of Possession) — Erişim belirtecini bir anahtara bağlama yöntemi; çalınan belirteç o anahtar olmadan kullanılamaz.

**ETSI** (European Telecommunications Standards Institute) — Güven listeleri, imzalar ve güven hizmetleri için teknik standartları yazan Avrupa standart kuruluşu.

**HAIP** (High Assurance Interoperability Profile) — Yüksek güvenceli kullanım için OpenID4VC seçeneklerini sabitleyen profil; EUDI Wallet'ta da kullanılır.

**OpenID4VCI** (OpenID for Verifiable Credential Issuance) — Belge verenin belgeyi cüzdana teslim ettiği protokol.

**OpenID4VP** (OpenID for Verifiable Presentations) — Doğrulayıcının cüzdandan belge istediği ve gösterimi aldığı protokol.

**PAR** (Pushed Authorization Request) — Yetkilendirme isteğinin önce sunucuya gönderildiği OAuth adımı; içerik tarayıcı adresinde görünmez.

<!-- TERMS:END -->
