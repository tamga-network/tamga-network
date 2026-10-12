---
document_id: FW-POL-0001
title: "İptal Politikası"
status: Active
version: 1.0.0
created: 2026-10-11
last_updated: 2026-10-12
summary: >
  Tamga ağındaki belge verenlerin (kimlik servisi ve kurumlar) verdiği belgelerin hangi koşullarda iptal edildiğini, kimin
  iptal isteyebileceğini, askıya almayı, iptal listesinin nasıl yayımlandığını ve iptalin ne kadar sürede etkili olduğunu tek
  yerde toplayan politika (AB ARF VCR_05). Belge türü rulebook'larındaki iptal kurallarını ve dayandıkları kararları derler; yeni
  kural koymaz. Cüzdan kanıtlarının (WIA, KA) iptali Cüzdan Kanıtı Politikası'ndadır.
---

# 1. Kapsam ve statü

AB ARF (VCR_05), iptal edilebilen bir belge veren her sağlayıcının, verdiği belgenin hangi koşullarda iptal edileceğini gösteren bir
politikası olmasını ister. Bu belge Tamga ağındaki bütün [[t:issuer|belge verenler]] için o politikadır: Tamga Network kimlik servisi
ve güven listesindeki her kurum. Kapsam Ek C'deki belge türleridir (Education, Identity, Event Ticket, Contact rulebook'ları).
Cüzdan sağlayıcılarının verdiği cüzdan örneği kanıtı (WIA) ve anahtar kanıtı (KA) için koşullar [[FW-POL-0002]]'dedir.

Politika karar üretmez: koşullar Tamga Rulebook'tan (Ek B), türlerin rulebook'larından ve dayandıkları kararlardan derlenmiştir;
kaynak her satırda yazılıdır. Çelişkide kaynak geçerlidir (RB-ENF-05).

# 2. Hangi belgeler iptal edilebilir

| Tür | İptal edilebilir mi | Gerekçe |
|---|---|---|
| Tamga kimlik belgesi `urn:tamga:id:IdentityAttestation:1` | **Evet** (zorunlu) | En çok 2 yıl geçerli; RB-AP-ID-04 |
| ZK kopyası `urn:tamga:id:ShortLivedIdentityAttestation:1` | Hayır | En çok 24 saat geçerli; kısa ömür iptalin yerini tutar (ARF VCR_01; [[ADR-0044]]) |
| Takma ad tohumu `urn:tamga:id:PseudonymSeed:1` | Hayır | Hiç gösterilmez; kimlik belgesiyle birlikte yenilenir ([[ADR-0031]]) |
| Sürücü belgesi bilgisi `urn:tamga:id:DrivingLicenceAttestation:1` | **Evet** (zorunlu) | [[ADR-0039]] |
| Öğrenci belgesi `urn:tamga:edu:StudentCredential:1` | Hayır | En çok 90 gün geçerli; kısa ömür iptalin yerini tutar; süresi dolmamış ama artık doğru olmayan belge kabul edilmiş bir risktir ([[FW-RB-0002]] §6) |
| Diploma `urn:tamga:edu:DiplomaCredential:1` | **Evet** (zorunlu) | Süresiz belge ([[FW-RB-0002]] §6) |
| Etkinlik bileti `urn:tamga:tkt:EventTicket:1` | **Evet** (zorunlu) | İptal ve kapıda "kullanıldı" biti ([[FW-RB-0004]] §6) |
| E-posta ve telefon belgeleri `urn:tamga:contact:*:1` | **Evet** (zorunlu) | [[ADR-0021]] |

Yeni bir belge türünün rulebook'u, türün iptal edilebilir olup olmadığını ve iptal edilebilirse koşullarını bu tabloya ekleyerek
yazar (ARF ARB_24).

# 3. İptal koşulları

## 3.1 Bütün iptal edilebilir türler

| Koşul | Sonuç | Kaynak |
|---|---|---|
| Kişi rızasını geri alır | Belge iptal edilir | RB-AP-21, RB-H-01 |
| Kişi "belgeniz bir cüzdana eklendi" bildirimine itiraz eder | Belge veren belgeyi iptal eder ve gerekiyorsa yeniden verir | RB-AP-15, RB-H-05 |
| Belge hatalı verilmiştir | İptal edilir, doğrusu yeniden verilir | Türlerin rulebook'ları |
| Aynı kişiye aynı türün yeni kopya seti verilir | Eski set iptal edilir (kişi başına tek etkin set) | RB-AP-ID-05, [[FW-RB-0002]] §4.3 |
| Belge verenin imza anahtarı sızmıştır | Belge veren askıya alınır, sertifikası iptal edilir, etkilenen belgeler iptal listesinde iptal edilir | Ek A §4.6 |
| Kurum belgesinin gömülü açıklama politikası eklenir, değişir ya da kalkar | O yapılandırmayla verilmiş geçerli belgeler iptal edilir | RB-AP-26, [[ADR-0046]] EP4 |

## 3.2 Türe özgü koşullar

| Tür | Koşullar | Kaynak |
|---|---|---|
| Kimlik belgesi | Kişinin silme talebi; aynı belgeyle yeniden doğrulama (eskisi); belgenin kaybolduğu ya da çalındığı bildirimi; hatalı belge | [[FW-RB-0003]] §6.2, RB-AP-ID-05 |
| Sürücü belgesi bilgisi | Kişinin isteği; silme isteği; aynı kartla yeniden doğrulama (eskisi); cüzdan birimi iptali; bağlı kimlik belgesinin iptali, yeniden verilmesi ya da silinmesi (zincirleme) | RB-AP-ID-10, [[ADR-0039]] |
| Diploma | Diplomanın iptali (sahtecilik, mahkeme kararı); hatalı belge; cihaz ihlali bildirimi | [[FW-RB-0002]] §6.2 |
| Etkinlik bileti | İade; etkinliğin iptali; hatalı satış; devir (eskisi iptal edilip yeni cihaza yeniden verilir); kapıda geçiş ("kullanıldı" biti) | [[FW-RB-0004]] §6 |
| E-posta ve telefon belgeleri | Aynı adres yeniden kanıtlanınca eski belge; kişinin silme talebi | [[ADR-0021]] K3, [[FW-RB-0005]] §6.2 |

**Kimlik servisinin belgeleri ve silme.** Kişi cüzdanını sıfırlayıp verilerini sildiğinde cüzdan kimlik servisinden aldığı her belge
için silme isteği gönderir; servis kaydı siler ve bütün kopyaları iptal eder ([[SPEC-WALLET-0001]] §7.6). Cüzdan birimi cüzdan
sağlayıcısınca iptal edilince kimlik servisi birimi en geç 24 saat içinde denetler ve o birimdeki kendi belgelerini iptal eder
(RB-AP-ID-12).

## 3.3 Cüzdan birimi iptal edilince kurum belgeleri

Cüzdan birimi iptali **kurum belgelerini iptal etmez** ([[ADR-0047]] K1; AB WURevocation_19 isteğe bağlıdır, Tamga kullanmaz).
Belgeler yine de kullanılamaz hâle gelir:

- Her kopya cihazdaki bir belge sahibi anahtarına bağlıdır (`cnf`); anahtar güvenli donanımda üretilir, dışa aktarılamaz (RB-WP-01)
  ve her gösterim o anahtarla imza ve PIN ya da biyometri ister (RB-WP-03). Belge başka bir cihazdan gösterilemez.
- İptal edilmiş birime hiçbir belge veren yeni belge ya da yenileme vermez ([[ADR-0025]] WIA4, [[ADR-0023]]).
- İptali gören cüzdan belgelerini ve anahtarlarını siler; kimlik servisinin belgesi iptal olur.
- Kurum belgeleri süresi dolunca biter; kısa ömürlü türlerde (öğrenci belgesi en çok 90 gün) bu kısa bir süredir.

Telefonu ve kilit açma bilgisini birlikte ele geçiren biri, telefon ağa bağlanmadıkça süresi dolmamış bir kurum belgesini
gösterebilir. Kişi bunun için kurumdan iptal ister (§4). Zincirleme iptal yapılmadığı için kurum belgelerinin süresi WIA ve KA'nın
iptal bakım süresine bağlı değildir (AB ISSU_12d uygulanmaz).

## 3.4 Kurumun ek koşulları

Bu politika bütün belge verenler için ortaktır. Kurum, kendi belgeleri için **ek** iptal koşullarını kendi sayfasında yayımlayabilir
(**MAY**); bağlantı güven listesindeki kaydında `revocation_policy_uri` alanında durur ve cüzdan kurum sayfasında gösterir
(RB-AP-27, [[ADR-0047]] K2). Ek koşullar bu politikanın koşullarını daraltamaz; çelişkide bu politika geçerlidir.

## 3.5 İptal sebebi olmayanlar

- **Belge verenin askıya alınması ya da çıkarılması** eski belgeleri geçersiz kılmaz; yalnız yeni belge verilmesi durur. Denetim
  belgenin verildiği ana (`iat`) göre yapılır (RB-REG-07, RB-ENF-02, RB-RP-03).
- **Belge verenin sertifika yenilemesi** eski belgeleri etkilemez; onlar eski `issuer_id` kaydıyla doğrulanır.
- **Belge türünün `DEPRECATED` olması** belgeleri iptal etmez; tür doğrulanabilir kalır (RB-SCH-06).

# 4. Kim iptal ister ve nasıl

| Kim | Nasıl |
|---|---|
| Kişi (belge sahibi) | Kimlik servisinin belgelerinde cüzdandaki "Cüzdanı sıfırla ve verilerimi sil" akışıyla ya da kimlik servisinin silme yoluyla; kurum belgelerinde kurumun kanalıyla (silme talebi, itiraz). Şikâyet yolu: belge veren → şema sahibi → KVKK Kurumu (RB-H-07) |
| Belge veren | Kendi kaydına dayanarak; iptal listesi eşlemesi yalnız belge verende durur (RB-AP-09, RB-AP-22). Kurumun ek koşulları `revocation_policy_uri` sayfasındadır (§3.4) |
| Şema sahibi ve işletmeci | Belge iptal etmez; belge vereni askıya alır ya da sertifikasını iptal eder (Ek A §4.5–§4.6). Acil durumda doğru araç aralık dışı yayın değil, belge verenin askıya alınmasıdır ([[SPEC-CRED-0003]] §5.3) |

# 5. Askıya alma

İptal listesi her belge için iki bit taşır (`bits = 2`): geçerli, iptal, askıda. Askı, belge veren bir iddiayı incelerken kullanılır
ve inceleme bitince ya kaldırılır ya da iptale döner; bugün diploma için tanımlıdır ([[FW-RB-0002]] §6.2). Kimlik belgesi iptal ya da
askıdaysa kimlik servisi yeni ZK kopyası vermez (RB-AP-ID-11).

# 6. Mekanizma ve yayın

| Konu | Kural | Kaynak |
|---|---|---|
| Mekanizma | IETF Token Status List (AB'nin Attestation Status List mekanizması; AB'nin sabitlediği taslak sürüm). mdoc ve SD-JWT VC kopyaları aynı biti taşır | [[SPEC-CRED-0003]] |
| Liste adresi | Belgede `status.status_list.uri`; ağın işlettiği servislerde `https://status.tamga.network/` altında, kendi servisini işleten kurumda kurumun durum sunucusunda | [[SPEC-CRED-0003]] §2 |
| Anahtar | İptal listesi imza anahtarı belge imza anahtarından ayrıdır | RB-AP-03 |
| Mahremiyet | Konum (`idx`) rastgeledir; adres opaktır (kurum, yıl, grup kodlamaz); kapasite en az 100.000, doluluk en çok %80; listeler tür dışında bir ölçüte göre bölünmez | RB-AP-18 |
| Yayın | Sabit aralıkla (bugün 2 dakika), değişiklik olmasa da; liste 6 saat geçerlidir; aralık dışı "acil" yayın yoktur; önce içerik dağıtımına, sonra çapa günlüğüne | RB-AP-17, RB-AP-19 |
| Askıdaki belge veren | İptal listesi yayımlamaz; halef yayımlayabilir | RB-AP-20, RB-REG-07 |
| Etkili olma süresi | Yayın aralığı + doğrulayıcının ön çekim aralığı (birkaç dakika); ZK sunumunda en geç 24 saat | RB-GEN-10, [[ADR-0044]] K4 |
| Doğrulayıcı | Listeleri önceden toplu çeker, her doğrulamada çekmez; liste bayat ya da erişilemezse sonuç `INDETERMINATE` olur, `REJECTED` değil | RB-RP-06, RB-GEN-03 |
| Cüzdan | "Geçersiz" ile "doğrulanamadı" farklı gösterilir | RB-WP-12 |

# 7. Kayıt ve mahremiyet

- İptal sebebi listede ve belgede yer almaz; liste kişisel veri taşımaz.
- Log ve denetim kayıtları iptal listesi konumunu (`idx`) **MUST NOT** taşımak (RB-GEN-06).
- Belge veren belge kayıtlarını ve iptal listesi eşlemesini düzenli yedekler; iptal ancak bu kayıtla yapılabilir (RB-AP-22).
- Liste aşamasında her katılımcı iptalin birkaç dakikada etkili olduğunu bilir; kişilere bu sınır yazılı bildirilir (RB-GEN-10).

# 8. Kararlar ve açık konular

| Konu | Durum |
|---|---|
| Kurum belgelerinin cüzdan birimi iptalinde zincirleme iptali | **Karar (2026-10-12, [[ADR-0047]] K1):** yapılmaz; belgeler cihaz anahtarına bağlıdır ve birim iptal edilince kullanılamaz (§3.3). Kimlik servisi kendi belgelerini iptal eder (RB-AP-ID-12) |
| Belge verenin kendi ek iptal politikası | **Karar (2026-10-12, [[ADR-0047]] K2):** kurum isterse ek koşullarını `revocation_policy_uri` ile yayımlar; ortak koşulları daraltamaz (§3.4, RB-AP-27) |
| Attestation Revocation List | AB iki mekanizmayı ister (VCR_10, VCR_12); bugün yalnız Status List yayımlanır. Revocation List desteği güven listesi biçimleri işiyle planlıdır |

# Durum

**Yürürlükte** — sürüm 1.0.0 (2026-10-11; §3.3, §3.4 ve §8 2026-10-12, [[ADR-0047]]).
