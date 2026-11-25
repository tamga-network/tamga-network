---
document_id: ADR-0098
title: "Ticari uzaktan kimlik doğrulama sağlayıcısı kaldırılır; gerçek ağda kimlik belgesi verilmez"
status: Active
review_status: Completed
version: 1.0.0
created: 2026-11-25
last_updated: 2026-11-25
summary: >
  Kimlik servisinin ticari uzaktan kimlik doğrulama sağlayıcısıyla (belge fotoğrafı + yüz + canlılık) çalışan yolu kaldırılır:
  gerçek ağda da sandbox'ta da. Gerçek ağda kimlik servisi kimlik belgesi, takma ad tohumu ve sürücü belgesi bilgisi vermez;
  gerçek bir kimlik yolu (devletin PID'i, nitelikli e-imza sertifikasıyla kimlik ya da kimlik kartı çipi) ayrı bir ADR ile
  açılana kadar. Sandbox'ta tek yol sahte kişidir (PID verilmiş ve kimlik doğrulanmış sayılır). İletişim belgeleri ve kurum
  belgelerinin PIN'li teklifi etkilenmez. Çip yolu kapalı kalır; açılış koşuluna yüz eşleştirme yöntemi eklenir. ADR-0040
  kaldırılır; ADR-0011, ADR-0039 ve ADR-0083'ü değiştirir. Kabul: 2026-11-25.
domain: Identity
related: ["[[ADR-0011]]", "[[ADR-0020]]", "[[ADR-0021]]", "[[ADR-0022]]", "[[ADR-0031]]", "[[ADR-0038]]", "[[ADR-0039]]", "[[ADR-0040]]", "[[ADR-0080]]", "[[ADR-0083]]", "[[ADR-0094]]", "[[SPEC-ID-0003]]"]
---

# Kısaca

Kişinin temel kimliğini (PID) AB kuralında yalnız devlet ya da devletin yetkilendirdiği kurum verir. Tamga'nın ticari bir
sağlayıcıyla belge fotoğrafı ve yüz taraması üzerinden verdiği geçici kimlik belgesi doğru yol değildir: AB'nin uzaktan kimlik
doğrulama standardına (ETSI TS 119 461) uygun sayılmıyordu ve gerçek ağda yalnız davetle açıktı. Bu yol kaldırılır. Gerçek ağda
gerçek bir kimlik yolu gelene kadar kimlik belgesi verilmez; sandbox'ta her şey sahte kişilerle denenir.

# Bağlam

- [[ADR-0011]] Tamga'yı, devletin PID sağlayıcısı yokken geçici bir kimlik belgesi veren kurum yaptı; kimlik ispatı ticari bir
  uzaktan doğrulama sağlayıcısıyla yapıldı. [[ADR-0040]] aynı sağlayıcıyı sandbox'ta isteyen herkese açtı. [[ADR-0039]] sürücü
  belgesi bilgisini aynı sağlayıcının ayrı bir akışından aldı. [[ADR-0083]] K1(a) çip yolunda yüz ve canlılık denetimini de bu
  sağlayıcıya bıraktı.
- 2026-11-24 TS 119 461 eşlemesi: fotoğraflı yol standardın uzaktan doğrulama kullanım durumlarına uymuyor; uyum hedefi çip yolu.
  Proje yönetimi aynı gün fotoğraflı yolu "standart dışı yedek yol" olarak niteledi.
- Gerçek ağda katılmış kurum yok; kimlik belgesi yalnız davetle, test amaçlı verildi.
- Proje yönetimi (2026-11-25): kimliği devletin vermesi gerekir; ticari sağlayıcı yolu kaldırılsın, doğru yola erişmeye
  çalışılsın; o güne kadar gerçek ağda kimlik belgesi verilmesin, sandbox'ta sahte kişilerle ilerlensin.

# Karar

## K1 — Sağlayıcı yolu kaldırılır

Kimlik servisinin ticari uzaktan kimlik doğrulama sağlayıcısıyla konuşan bütün kodu ve ayarları kaldırılır: oturum açma,
geri dönüş ve webhook, davet yolu, sağlayıcı kotaları, sürücü belgesi akışı, çip yolunun yüz denetimi bileşeni, inceleme kuyruğu
ve saklama işlerinin sağlayıcı tarafı. Kaynak geçmişte kalır; yeniden kullanmak yeni bir ADR ister. Sağlayıcıyla hesap ve
sözleşme ilişkisinin sonlandırılması proje yönetimindedir.

## K2 — Gerçek ağda kimlik belgesi verilmez

Gerçek ağda kimlik servisi şu türleri **vermez**: kimlik belgesi (`urn:tamga:id:IdentityAttestation:1`), takma ad tohumu
(`urn:tamga:id:PseudonymSeed:1`, [[ADR-0031]] — kişinin kimliğinden türetilir) ve sürücü belgesi bilgisi ([[ADR-0039]]). Servis
bu türlerin isteğini açık bir hatayla reddeder; cüzdan kimlik ekranında gerçek ağda "henüz verilmiyor" der. Yeniden açılış yalnız
gerçek bir kimlik yoluyla ve ayrı bir ADR ile olur. Adaylar:

1. devletin ya da yetkilendirdiği kurumun PID'i (listedeki `pid_providers[]`, bugün boş);
2. nitelikli e-imza sertifikasıyla kimlik ([[ADR-0083]] K12, [[SPEC-ID-0003]] T3): kişiyi nitelikli sertifika sağlayıcısı
   kanuna göre tespit etmiştir;
3. kimlik kartı çipi ([[ADR-0083]]), K4'teki koşullarla.

Daha önce gerçek ağda davetle verilmiş kimlik belgeleri süreleri dolana kadar geçerli kalır; yenilenmez (yenileme kimlik
doğrulamayı yeniden ister). Gerçek ağın güven listesindeki kimlik servisi kaydı yerinde kalır (iletişim belgeleri ve süresi
dolmamış belgelerin doğrulanması için); yalnız yetkili kaynak açıklaması sağlayıcı adını bırakır. Mağaza inceleme kodu yolu
([[ADR-0033]]: ayrı, sahte kayıtlı inceleme kurumu, gerçek kişi yok) bu karardan etkilenmez.

## K3 — Sandbox'ta tek yol sahte kişi

Sandbox'ta kimlik akışı yalnız sahte sağlayıcıyla çalışır ([[ADR-0038]] SB3): kişi örnek kişilerden birini seçer, PID verilmiş ve
uzaktan kimlik doğrulama yapılmış sayılır. "Gerçek kimliğinle doğrula" seçeneği ve davet kipi kaldırılır; [[ADR-0040]] kaldırılır
(Superseded). Sandbox'ın temsili PID makamları ([[ADR-0094]]), sürücü belgesi denemeleri (sahte sağlayıcının örnek verisiyle) ve
"Bu sen misin?" son onayı ([[ADR-0080]]) aynen kalır.

## K4 — Çip yolu kapalı kalır

Çip yolunun kodu ([[ADR-0083]] K11) kapalı anahtarın arkasında kalır. Çip, kartın gerçek olduğunu ve devletin imzasını taşıdığını
kanıtlar; kartı tutanın kartın sahibi olduğunu kanıtlamaz. Bu denetimi yapan sağlayıcı kaldırıldığı için açılış koşuluna bir madde
eklenir: hukuki görüşe ek olarak, yüz eşleştirme ve canlılık yöntemi (sağlayıcı ya da başka bir yol) ayrı bir ADR ile seçilir.
Yüz denetimi arayüzü yalnız sahte uygulamasıyla, yerel testler için kalır.

## K5 — Kurum belgeleri kimlik belgesi olmadan

Cüzdan kimlik belgesi olmadan kurulur ve kullanılır. Gerçek ağda kurum belgeleri bu süre içinde yalnız kimlik gerektirmeyen yollarla
verilir: PIN'li teklif ([[ADR-0020]] K3 madde 6; PIN teklif bağlantısından ayrı kanaldan gider) ve bilet. Kimliğe bağlı teklif
([[ADR-0020]] K3) ve kişinin başlattığı sorgu yolu ([[ADR-0020]] K4) kimlik belgesi ister; gerçek bir kimlik yolu açılana kadar
yalnız sandbox'ta çalışır. Kurum sorgu ucunun `fetch` işlemi değişmez.

# Gerekçe / alternatifler

| Seçenek | Karar | Neden |
|---|---|---|
| Sağlayıcı yolunu gerçek ağda davetle sürdürmek | ret | Standart dışı; PID'in yerini tutmaz; "her şey gerçek" ilkesine ters |
| Yerli bir sağlayıcıya geçmek | şimdi değil | Aynı soru (TS 119 461, biyometri hukuku) kalır; yöntem K4'teki ADR'de seçilir |
| Kodu silmeden kapatmak | ret | Kullanılmayan entegrasyon bakım ve gizli anahtar yükü taşır; geçmişte duruyor |
| Kaldırmak, gerçek yolu ayrı ADR'le açmak | **kabul** | Doğru yol devlet PID'i ya da devletin denetlediği bir tespit; sandbox denemeyi taşır |

# Değişmezler

| Kod | Kural |
|---|---|
| IDR1 | Kimlik servisi ticari bir uzaktan kimlik doğrulama sağlayıcısıyla konuşmaz; yeniden bağlamak ADR ister. |
| IDR2 | Gerçek ağda kimlik servisi `IdentityAttestation`, `PseudonymSeed` ve sürücü belgesi bilgisi vermez; açılış yalnız gerçek bir kimlik yolu ADR'siyle. |
| IDR3 | Sandbox'ta kimlik akışı yalnız sahte sağlayıcıyla çalışır; gerçek kişinin belgesi ya da yüzü işlenmez. |
| IDR4 | Çip yolu, hukuki görüş ve seçilmiş bir yüz eşleştirme yöntemi olmadan açılmaz. |

# Sonuçlar

- Kimlik servisi: sağlayıcı kodu, ayarları ve testleri silinir; gerçek ağda yukarıdaki türler reddedilir;
  sandbox sahte sağlayıcıyla aynen çalışır. Sunucudaki sağlayıcı ortam değişkenleri ve webhook adresi kaldırılır.
- Cüzdan: kimlik doğrulama web görünümünün izin listesinden sağlayıcı adresleri çıkar; gerçek ağda kimlik ekranı "henüz
  verilmiyor" der. Kimlik belgesi olmadan kurulum değişmez.
- Belgeler: [[SPEC-ID-0003]], Kimlik kural kitabı, sandbox rehberi (gerçek kimlikle deneme bölümü), kurum rehberleri, çerçeve
  belgeleri ve aydınlatma metinleri sağlayıcıdan söz etmeyecek biçimde güncellenir.
- Gerçek ağda "Tamga ile giriş" (takma ad) ve kimlik eşleştirmeli kurum belgeleri gerçek bir kimlik yolu gelene kadar yoktur.
- Değiştirilen kararlar: [[ADR-0011]] (kimlik ispatı yöntemi), [[ADR-0039]] (sürücü belgesi kaynağı), [[ADR-0040]] (kaldırılır),
  [[ADR-0083]] K1(b) fotoğraf yolu ve K11 açılış koşulu.

# Durum

Kabul: 2026-11-25, proje yönetimi.
