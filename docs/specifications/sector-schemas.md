---
document_id: SPEC-SCHEMA-0003
title: "Sektör şemaları"
status: Active
version: 1.0.0
created: 2026-09-09
last_updated: 2026-10-02
summary: >
  Eğitim dışındaki dikeylerin şema iskeletlerini ve bir sektörün AÇILMA
  KOŞULLARINI tanımlar. Merkezî tez: eğitimde işe yarayan yaklaşım diğer
  sektörlere olduğu gibi kopyalanamaz — sağlıkta yanlış bir seçici açıklama
  kararı geri alınamaz zarar verir, ehliyette format bile farklıdır (mdoc,
  SD-JWT değil), tüzel kişilikte özne insan değildir. Bu yüzden doküman önce
  bir SEKTÖR AÇMA KONTROL LİSTESİ koyar (yedi koşul), sonra beş dikeyin
  iskeletini verir. İlk aşamada yalnızca `org` iskeleti yazılır; sağlık, ehliyet,
  seyahat ve ticaret sonraki aşamalara bırakılmıştır ve bu doküman onların erken
  kararlarını kaydeder, şemalarını yazmaz.
---

# Kısaca

Bu belge, eğitim dışındaki sektörler (tüzel kişilik, sağlık, ehliyet, seyahat, ticaret) açılmadan önce verilmesi gereken
erken kararları ve bir sektörü açmanın koşullarını toplar. Okuru yeni bir belge türü önermek isteyen kurumlar ve şema
yazarlarıdır.

**Ne zaman okunur**

- Önce [Belge biçimleri](/concepts/credential-formats) kavram sayfasını ve şema kataloğunu ([[SPEC-SCHEMA-0001]]) okuyun.
- Tam yazılmış bir örnek için eğitim şemalarına bakın: [[SPEC-SCHEMA-0002]].
- Yeni bir sektör önerirken §1'deki kontrol listesiyle başlayın.

**Sade anlatım**

Bu belge bir iskelettir: şema yazmaz. Her sektörün kendine özgü riskleri vardır; sağlık verisi diplomadan çok daha hassastır,
ehliyet farklı bir biçimle (mdoc) taşınır, ticaret belgeleri ise el değiştirebilir. Eğitimde verilen kararlar bu sektörlere
olduğu gibi kopyalanmasın diye, her sektör için referans standart, kısıtlayıcı erken kararlar ve açılma koşulu şimdiden yazılır.
Bugün yalnızca tüzel kişilik iskeleti geçerlidir.

---

# Kapsam

Bu doküman **iskelettir.** Eğitim şemaları [[SPEC-SCHEMA-0002]]'de tam olarak
yazılmıştır; buradakiler yazılmamıştır — erken kararlar, referans standartlar
ve açılma koşulları kaydedilmiştir.

**Neden şimdi yazılıyor:** Bu dikeyler yarın açıldığında, bugün eğitimde
verilmiş kararların onlara **kopyalanmaması** gerekir. Kopyalanmaması gereken
şeyleri şimdi yazmak, sonra düzeltmekten ucuzdur.

---

# 1. Sektör Açma Kontrol Listesi (Normatif)

Yeni bir `domain` ([[SPEC-SCHEMA-0001]] §1.2) açılmadan önce **yedi koşulun
hepsi** karşılanmalıdır. Eksik biri varsa domain açılmaz.

> `SG*` kodları **açılma koşullarıdır**, değişmez değildir; ama [[INVARIANTS]]
> indeksinde göründükleri için benzersiz adlandırılmışlardır.

| # | Koşul | Neden |
|---|---|---|
| **SG1** | Uluslararası referans model seçilmiş ve [[RS-SCHEMA-0001]] benzeri bir araştırmayla gerekçelendirilmiş | Sıfırdan uydurmak tanınırlığı öldürür |
| **SG2** | Taşıyıcı format kararı verilmiş (SD-JWT VC / mdoc / karma) | Format sonradan değişirse tüm şema yeniden yazılır |
| **SG3** | Türetilmiş boolean claim seti tanımlanmış | `age_over_NN` deseni sonradan eklenemez ([[RS-SCHEMA-0001]] §4) |
| **SG4** | Selective disclosure politikası (`sd: always` olacak alanlar) belirlenmiş | Yanlış `never`, `REVOKED` + yeniden belge verme gerektirir |
| **SG5** | TTL ve iptal listesi kullanımı kararlaştırılmış | [[SPEC-CRED-0003]] Alt. C — kısa ömür mü iptal mi |
| **SG6** | Asgari belge veren kategorisi ve assurance seviyesi belirlenmiş | Kategori aşımını önler ([[ADR-0007]] K6) |
| **SG7** | Sektöre özgü hukuki inceleme yapılmış | Sağlık, finans ve kimlik verisi ek mevzuata tabidir |

**Değişmez SK1:** Yedi koşuldan biri eksikken NETWORK katmanında domain
açılmaz. NATIONAL şemalar için de aynı liste, o devletin kendi yönetiminde
uygulanır.

## 1.1 Risk asimetrisi

Sektörler eşit değildir. Bir hatanın bedeli:

| Sektör | Yanlış karar örneği | Bedeli |
|---|---|---|
| Eğitim | Notun `allowed` olması | Rahatsız edici, düzeltilebilir |
| Tüzel kişilik | Yetki kapsamının geniş olması | Mali zarar, sözleşmeyle sınırlanabilir |
| **Sağlık** | Tanı alanının `sd: never` olması | **Geri alınamaz** — sağlık verisi ifşası |
| Ehliyet/kimlik | Portre alanının gereksiz açılması | Biyometrik ifşa, kalıcı |
| Ticaret | Yanlış taraf tanımlaması | Hukuki uyuşmazlık |

**Sonuç:** Kontrol listesi (§1) sektör bazında sertleşir. Sağlıkta SG4 ve SG7
bağımsız uzman incelemesi gerektirir; eğitimde iç gözden geçirme yeter.

---

# 2. `org` — Tüzel Kişilik ve Yetki (ilk aşama iskeleti)

İlk aşamada yazılacak **tek** ek dikey.

## 2.1 Referans model: GLEIF vLEI

[[RS-SCHEMA-0001]] §6 uyarınca vLEI'nin üç katmanı devralınır:

| vLEI katmanı | Tamga şeması | Ne kanıtlar |
|---|---|---|
| Legal Entity vLEI | `TamgaLegalEntityCredential` | "Bu tüzel kişi vardır ve şudur" |
| **OOR** (Official Organizational Role) | `TamgaOfficialRoleCredential` | "Bu kişi resmî yetkilidir" (imza yetkisi) |
| **ECR** (Engagement Context Role) | `TamgaContextRoleCredential` | "Bu kişi şu bağlamda yetkilidir" (satın alma müdürü) |

## 2.2 Neden bu üçlü doğru

Tek bir "çalışan kartı" şeması yazmak cazip görünür ama yanlıştır. Üç farklı
soru vardır:

- *Bu şirket gerçek mi?* → LE
- *Bu kişi şirketi bağlayabilir mi?* → OOR
- *Bu kişi bu işi yapabilir mi?* → ECR

Bir lojistik firmasının şoförü ECR'dir; imza yetkilisi OOR'dur. Aynı şemaya
sıkıştırmak, [[t:verifier|doğrulayıcının]] "bu kişi sözleşme imzalayabilir mi" sorusunu
cevaplayamaması demektir.

## 2.3 Erken kararlar

| Konu | Karar |
|---|---|
| **Özne insan değil** (LE için) | `cnf` tüzel kişinin cihaz anahtarı değil, **yetkili temsilcisinin** anahtarıdır — bu, eğitimden yapısal olarak farklıdır |
| Format | SD-JWT VC |
| Türetilmiş claim | `can_sign_contracts`, `spend_limit_above` (eşik tabanlı) |
| `sd: always` | Kişisel ad alanları, ücret/limit değerleri |
| TTL | OOR/ECR: **90 gün** (roller değişir) · LE: 1 yıl |
| İptal listesi | Üçünde de **evet** — rol iptali gerçek bir ihtiyaç |
| Kurum kategorisi | `GOVERNMENT` (ticaret sicili) veya `OTHER` (şirketin kendisi, I1) |

**Dikkat çeken nokta:** Bir şirket kendi çalışanına ECR verebilir (I1 seviye),
ama LE belgesini **kendine veremez** — onu ticaret sicili verir. Kendi
varlığını kendi beyan eden bir tüzel kişilik kaydı, kaydın kendisini anlamsız
kılar.

## 2.4 vLEI taşıyıcı farkı

vLEI, ACDC/KERI taşıyıcısını kullanır; Tamga SD-JWT VC. [[RS-SCHEMA-0001]]
§9'daki düzleştirme mantığı burada da geçerlidir: **semantik devralınır,
taşıyıcı devralınmaz**, ve iki yönlü eşleme tablosu zorunludur.

---

# 3. `health` — Sağlık (genişleme aşaması)

## 3.1 Referans: FHIR + IPS

[[RS-SCHEMA-0001]] §5. Emsal desen: **belge FHIR kaynağını taşır,
FHIR'i yeniden tanımlamaz** (SMART Health Cards, WHO GDHCN aynı deseni
kullandı).

## 3.2 Erken kararlar — hepsi kısıtlayıcı yönde

| Konu | Karar | Gerekçe |
|---|---|---|
| Selective disclosure | **Zorunlu ve varsayılan** — hemen hemen her alan `sd: always` | Sigorta "aşılı mı" sorduğunda tüm bağışıklama geçmişini görmemeli |
| Türetilmiş claim | **Birincil arayüz** — `is_vaccinated_for(X)`, `has_no_allergy_to(Y)` | Ham FHIR kaynağı istisna olmalı, kural değil |
| Ham kaynak sunumu | Yalnızca **sağlık kuruluşu** doğrulayıcılarına | RP scope'u ile zorlanır |
| Kurum güvencesi | **I3 asgari** | Sağlık belgesi veren kurum akredite olmalı |
| İptal listesi | Evet, kısa `ttl` | Test sonuçları hızla eskir |
| Zincire yansıma | **Hiçbiri** — şema kaydı bile domain adı dışında bilgi vermemeli | [[PM-TRUST-0001]] |

## 3.3 Kırmızı çizgi

**Değişmez SK2:** `health` domaininde hiçbir alan `sd: "never"` olamaz —
protokol claim'leri (`iss`, `vct`, `cnf`, `status`, `iat`) hariç.

[[SPEC-SCHEMA-0001]]/D6 zaten kişisel veride `never` ([[t:selective-disclosure]] yok) yasaklıyordu; sağlıkta
bu, istisnasız bir kurala dönüşür. Bir tanı alanının yanlışlıkla `never`
işaretlenmesi, o şemayla verilmiş **tüm** belgelerde tanının her doğrulayıcıya
gitmesi demektir ve geri alınamaz.

## 3.4 Açılma koşulu

SG7 (hukuki inceleme) sağlıkta **bağımsız** olmalıdır. KVKK özel nitelikli
kişisel veri rejimi ve ilgili sağlık mevzuatı, eğitim şemalarında olmayan
yükümlülükler getirir. Bu inceleme yapılmadan `health` domaini açılmaz.

---

# 4. `id` — Ehliyet ve Kimlik (devlet aşaması)

## 4.1 Format farkı — en önemli nokta

[[t:mDL]], **[[t:mdoc]]/CBOR/COSE** kullanır; SD-JWT değil ([[RS-SCHEMA-0001]] §4).
[[ADR-0006]] mdoc'u ikincil format olarak zaten kabul etmiştir.

**Değişmez SK3:** mDL, [[t:SD-JWT-VC]]'ye **çevrilmez.** Çevirmek onu mDL olmaktan
çıkarır ve uluslararası tanınırlığını yok eder — mDL'in tüm değeri sınır
ötesinde okunabilmesidir.

Sonuç: `id` domaini açıldığında cüzdan, doğrulayıcı ve SDK **iki formatı birden**
desteklemek zorundadır. Bu, devlet aşamasının en büyük mühendislik kalemidir.

## 4.2 Devralınan desen

`age_over_NN` ([[RS-SCHEMA-0001]] §4) zaten tüm Tamga şemalarına ilke olarak
girmiştir. `id` domaini açıldığında bu desenin **kaynağı** de devralınır:
`org.iso.18013.5.1` isim alanı ve veri elemanları aynen kullanılır.

## 4.3 Erken kararlar

| Konu | Karar |
|---|---|
| Format | mdoc (ISO/IEC 18013-5), çevrimiçi için 18013-7 |
| Portre | `sd: always`; ayrıca **ayrı onay** gerektirir (biyometrik) |
| Kurum | Yalnızca `GOVERNMENT` + `I3` |
| Yakınlık sunumu | BLE/NFC — [[SPEC-PROTO-0002]] kapsam dışıydı, ayrı profil gerekir |
| Standart maliyeti | **ISO metni ücretlidir** — bütçe kalemi ([[RS-SCHEMA-0001]] §4) |

## 4.4 PID bağlantısı

`id` domaini açıldığında [[SPEC-SCHEMA-0002]] §1.2.3'teki ilk aşama sınırlaması
kapanır: birleşik sunumla (diploma + [[t:PID]], aynı `cnf`) kimlik eşleştirmesi
kriptografik hâle gelir. Bu, `id` domaininin **eğitim için de** en önemli
kazancıdır.

---

# 5. `travel` — Seyahat (genişleme aşaması)

Referans: **ICAO DTC**. Pasaportun çipindeki mantıksal veri yapısının dijital
türevi; sanal ve fiziksel iki bileşenli.

**Erken karar:** Tamga DTC **vermez** — pasaport verme yetkisi devlet tekelidir.
Turizm modülü (`turkistantour.com` bağlamı) ve sınır geçişi senaryolarında
Tamga **doğrulayıcı** rolündedir.

Bu, diğer dikeylerden yapısal olarak farklıdır ve `id` domaini olgunlaşmadan
ele alınmamalıdır.

---

# 6. `log` — Ticaret ve Lojistik (genişleme aşaması)

Referans: **UN/CEFACT** veri modelleri + **MLETR** (elektronik devredilebilir
kayıtlar model kanunu).

## 6.1 Yapısal fark: devredilebilirlik

Bu dikey, Tamga'nın tüm tasarımına ters bir gereksinim getirir.

Konşimento gibi belgeler **devredilebilir** olmak zorundadır — mal el
değiştirdikçe belge de el değiştirir. Ama Tamga'nın temel güvenlik özelliği
belgenin **devredilemez** olmasıdır ([[SPEC-CRED-0001]] §3,
[[SPEC-WALLET-0001]]/WL1).

**Değişmez SK4:** Devredilebilir ticaret belgeleri, `TamgaBaseCredential`'dan
türeyen normal bir [[t:credential|belge]] **olamaz.** Ayrı bir ilkel gerekir — muhtemelen
zincir üstü sahiplik kaydı + belgenin yalnızca sahiplik kanıtı olarak
kullanılması.

Bu, bir şema tasarımı değil bir **mimari** tasarım sorunudur ve `log` domaini
açılmadan önce ayrı bir ADR gerektirir.

## 6.2 vLEI bağı

Ticaret belgelerinin tarafları tüzel kişilerdir; §2'deki `org` şemaları
önkoşuldur. `log`, `org` olgunlaşmadan açılamaz.

---

# 7. Sektörler Arası Kurallar

| Kural | Kapsam |
|---|---|
| Türetilmiş boolean claim'ler her domainde zorunludur | [[RS-SCHEMA-0001]] §4 |
| Çok dillilik baştan konur | [[SPEC-SCHEMA-0001]] §8 |
| İki yönlü eşleme tablosu zorunludur | [[RS-SCHEMA-0001]] §9 |
| İki seviyeden derin iç içe yapı yok | [[SPEC-CRED-0002]]/C11 |
| Kimlik numarası NETWORK şemalarında yer almaz | [[SPEC-SCHEMA-0002]] §1.2 |
| Liste URI'si opak, indeks rastgele | [[SPEC-CRED-0003]] §6 |

Son iki satır özellikle önemlidir: `health` ve `id` domainlerinde kimlik
numarası eklemek çok daha cazip olacaktır (mevzuat gerekçesiyle). Karar
gerekiyorsa NATIONAL şemayla verilir, NETWORK şemasına girmez.

---

# 8. Faz Haritası

| Domain | Faz | Önkoşul |
|---|---|---|
| `edu` | **0 — yazıldı** | — |
| `org` | **0 — iskelet** | §1 kontrol listesi (SG1–SG7) |
| `id` | 1 | Devlet katılımı + mdoc desteği + ISO metni |
| `health` | 2 | Bağımsız hukuki inceleme (§3.4) |
| `travel` | 2 | `id` olgunlaşması |
| `log` | 2 | `org` olgunlaşması + devredilebilirlik ADR'si (§6.1) |
| `fin` | 2 | Ayrı çalışma — bu dokümanda ele alınmadı |

---

# 9. Değişmezler

| # | Değişmez |
|---|---|
| **SK1** | Yedi koşullu kontrol listesi tamamlanmadan domain açılmaz. |
| **SK2** | `health` domaininde hiçbir kişisel veri alanı `sd: "never"` olamaz. |
| **SK3** | mDL, SD-JWT VC'ye çevrilmez; mdoc olarak kalır. |
| **SK4** | Devredilebilir ticaret belgeleri normal belge olamaz; ayrı ilkel gerekir. |
| **SK5** | Bir tüzel kişi kendi LE belgesini kendine veremez. |
| **SK6** | Kimlik numarası hiçbir NETWORK şemasında yer almaz — domain fark etmez. |

---

# Güvenlik ve Mahremiyet Notları

**Domain adı bile bilgi taşır.** Bir kullanıcının cüzdanında `health`
domaininden bir belge bulunması, sunulmasa bile bir sinyaldir — sunum
listesinde tip adı görünür. Cüzdan tasarımı, kullanıcının belge tiplerini
gizleyebilmesine izin vermelidir → [[SPEC-WALLET-0001]] açık konusu.

**Sektör genişlemesi doğrulayıcı tarafını zorlar.** Her yeni domain, doğrulayıcı
SDK'sında yeni format ve yeni politika demektir. `id` domaininin mdoc getirmesi
([[SPEC-CRED-0002]] tek formatlı varsayımını kıracak) en büyük kırılmadır.

**Kontrol listesi bir yavaşlatıcıdır ve öyle olmalıdır.** Yeni bir dikey
açmanın kolay olması, kötü şema yazılmasını kolaylaştırır. §1'in sürtünmesi
kasıtlıdır.

---

# Açık Konular

1. `fin` domaini bu dokümanda ele alınmadı. Finans, `org` ve `id`'nin
   kesişiminde ve muhtemelen en ağır mevzuat yüküne sahip. Ayrı araştırma
   gerekir.
2. §6.1 devredilebilirlik problemi bir ADR bekliyor. Zincir üstü sahiplik
   kaydı mı, MLETR uyumlu ayrı bir ilkel mi?
3. `id` domaini açıldığında [[SPEC-CRED-0002]] "tek format" varsayımı kırılır.
   O dokümanın mdoc bölümü ne zaman yazılacak?
4. `org` iskeleti ilk aşamada yazılacak dedik ama pilot kapsamında değil. Ne
   zaman ve hangi tetikleyiciyle tam şemaya dönüşecek? → [[PM-GTM-0001]]
5. §1 kontrol listesinin uygulanmasını kim denetler? İlk aşamada vakıf teknik
   kurulu; devlet aşamasında konsey ([[PM-GOV-0001]]).

---

# İlgili Dokümanlar

[[RS-SCHEMA-0001]] · [[SPEC-SCHEMA-0001]] · [[SPEC-SCHEMA-0002]] ·
[[SPEC-CRED-0001]] · [[SPEC-CRED-0002]] · [[SPEC-CRED-0003]] ·
[[SPEC-WALLET-0001]] · [[ADR-0006]] · [[ADR-0007]] · [[PM-TRUST-0001]] ·
[[PM-GOV-0001]] · [[PM-GTM-0001]] · [[INVARIANTS]]

---

# Durum

**Yürürlükte** — sürüm 1.0.0 (2026-10-02).

