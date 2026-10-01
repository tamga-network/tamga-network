---
document_id: RS-EBSI-0001
title: EBSI Derin İnceleme — Mimari, Güven Modeli ve Tamga İçin Dersler
category: Research
domain: Blockchain
status: Draft
review_status: Draft
version: 0.1.2
created: 2026-07-29
last_updated: 2026-10-01
authors:
  - Tamga Network Engineering
language: tr
document_type: research
audience:
  - engineers
  - architects
  - ai-agents
tags:
  - ebsi
  - permissioned-blockchain
  - hyperledger-besu
  - ibft
  - trust-registry
  - verifiable-credentials
keywords:
  - EBSI
  - European Blockchain Services Infrastructure
  - Hyperledger Besu
  - IBFT 2.0
  - did:ebsi
  - Trusted Issuers Registry
  - Verifiable Data Registry
  - trust chain
  - EUROPEUM-EDIC
related:
  - RS-EIDAS-0001
  - PM-BC-0001
  - PM-TRUST-0001
research:
  - RS-EIDAS-0001
references:
  - EBSI Knowledge Base
  - EBSI Hub (hub.ebsi.eu)
  - Hyperledger Besu / IBFT 2.0
  - W3C Verifiable Credentials
summary: >
  EBSI'nin (European Blockchain Services Infrastructure) mimarisini, yönetişimini,
  teknik yığınını (Hyperledger Besu + IBFT 2.0, public permissioned), güven modelini
  (DID Registry, Trusted Issuers Registry, Trusted Schemas Registry, trust chain'ler)
  ve on-chain/off-chain veri sınırını inceler. EBSI, Tamga Network'ün validator ve
  güven modeli için en yakın çalışan emsaldir; bu doküman PM-BC-0001'i doğrular ve
  framework kararına (RS-FRAMEWORKS-0001) somut girdi sağlar.
priority: Critical
---

# Giriş

Bu doküman harici bir sistemi derinlemesine analiz eder: **EBSI — European Blockchain Services Infrastructure.**

EBSI, [[PM-BC-0001]] kararında "en yakın emsal" olarak işaretlenmişti. Neden önemli? Çünkü EBSI, Tamga'nın hedeflediği modelin — **kendi egemen, izinli, devletlerin eşit node çalıştırdığı, güven altyapısı olarak kullanılan bir blockchain** — Avrupa'da hâlihazırda **üretime alınmakta olan** halidir. Tamga için EBSI hem bir doğrulama (bu model çalışıyor mu?) hem bir şablon (nasıl yapılmış?) hem de bir kıyas noktasıdır.

> **Amaç:** EBSI'yi kopyalamak değil, onun mühendislik kararlarını anlamak ve Tamga'ya hangi derslerin taşınacağını belirlemek.

---

# 1. EBSI Nedir?

EBSI, **ilk AB çapında, kamu sektörü öncülüğünde blockchain altyapısıdır.** Avrupa Komisyonu ve üye devletler tarafından **European Blockchain Partnership (EBP)** aracılığıyla kurulmuştur.

Amacı yeni bir kripto para veya kamu spekülatif zinciri değildir. Amaç, **sınır ötesi kamu hizmetlerini** güvenilir biçimde yürütmektir:

- Self-Sovereign Identity (SSI) / dijital kimlik
- Diploma ve eğitim belgeleri
- Belge noterliği (notarization)
- Sosyal güvenlik
- KOBİ finansmanı
- Sağlık verisi paylaşımı

EBSI, doğrulanabilir belgeler (Verifiable Credentials) için bir **güven altyapısıdır.** Üretim lansmanı **2026 Q4** olarak planlanmıştır.

> **Tamga paraleli:** EBSI'nin "tek zincir, çok sektörel hizmet" yaklaşımı, Tamga'nın "tek güven katmanı, her sektör (eğitim, sağlık, …)" vizyonuyla birebir örtüşür.
>
> *Sürüm notu 0.1.1 (2026-09-30): eski dikey platform adları sektör anlatımıyla değişti (proje yönetimi kararı; anlam değişmedi).*

---

# 2. Yönetişim ve Katılım

Bu bölüm Tamga'nın validator/yönetişim kararı ([[PM-BC-0001]]) açısından en kritik bölümdür.

- **European Blockchain Partnership (EBP):** Komisyon + üye devletlerin oluşturduğu ortak girişim. Her EBP üyesi devlet, ulusal düzeyde EBSI node'u barındırır.
- **EUROPEUM-EDIC:** EBSI'yi işleten yönetişim gövdesi. Node operatörleri **bu gövde tarafından onaylanır.**
- **Node operatörü olma:** EUROPEUM-EDIC'e başvuru → onay (endorsement) + hukuki pakete uyum (**NOOB** — Node Operator Onboarding, ve **SLA**) gerekir.
- **Eşit yetki:** Ağ, **25–27 eşit yetkili (equally privileged) validator node**'dan oluşur. Node'lar AB/EEA devletleri ve akredite ortaklar tarafından çalıştırılır.
- **Genişleme:** EBSI-NE (Nodes Expansion) projesi 14 ülkeden 24 kuruluşla 18 node'u üretime taşımaktadır.

> **Tamga doğrulaması:** Bu, [[PM-BC-0001]]'deki üç kararı birebir doğrular:
> - "Devlet başına eşit güç" → EBSI'nin eşit yetkili node'ları.
> - "Kurucu konsorsiyum + onaya dayalı katılım" → EBP + EUROPEUM-EDIC onayı.
> - "Devletler + kurumları" → devletler ve akredite ortaklar.

---

# 3. Teknik Mimari

## Blockchain Protokolü ve Consensus
- **Ana protokol: Hyperledger Besu, IBFT 2.0 consensus ile.**
- **IBFT 2.0 (Istanbul Byzantine Fault Tolerance):** izinli Ethereum ağları için BFT tarzı consensus. Validator'lar oylama yaparak **deterministik kesinlik (finality)** sağlar; iki fazlıdır (**PREPARE / COMMIT**).
- **Pluggable protocols:** EBSI node'ları çoklu protokol destekler. Şu an Besu (IBFT 2.0) ana protokol; **Hyperledger Fabric** de desteklenir (off-chain özel koleksiyonlar, endorsement policy, Raft ordering/CFT ile).

## Erişim Modeli — Public Permissioned
- **Herkes zincir durumunu okuyabilir** (public).
- **Yalnızca izinli node'lar** blok önerebilir/imzalayabilir (permissioned).
- Üyelik değişiklikleri ve yazma izinleri **on-chain smart contract'lar** ve bir **roles/attributes registry** ile yönetilir.

## Node Modeli
- Node'lar Avrupa'ya dağıtılmış; ulusal düzeyde devletlerce barındırılır.
- Tam API seti sunar (kimlik, credential, trust registry işlemleri için).

> **Tamga için somut veri:** EBSI, "kendi egemen izinli ağ + eşit güç + anında kesinlik" gereksinimini **Hyperledger Besu + IBFT 2.0** ile çözmüştür. Bu, [[PM-BC-0001]] Katman 4 (framework seçimi) açık kararı için güçlü bir Besu/QBFT lehine veri noktasıdır. Karşılaştırma RS-FRAMEWORKS-0001'de yapılacaktır.
>
> Not: IBFT 2.0 ile QBFT yakın akrabadır (QBFT, IBFT 2.0'ın kurumsal olarak olgunlaşmış halidir). Tamga'nın consensus ailesi kararıyla (izinli BFT/PoA, eşit oy) tam uyumludur.

---

# 4. Güven Modeli ve Kayıt Defterleri (Registries)

EBSI güveni, zincir üzerinde tutulan bir dizi **kayıt defteri** ile sağlar. Bunların bütününe **Verifiable Data Registry (VDR)** denir.

## DID Yöntemleri
- **Tüzel kişiler (legal entities):** `did:ebsi` yöntemi. DID'leri **DID Registry (DIDR)**'ye kaydedilir; DID document'ları (public anahtarlar) doğrulayıcılar için zincir üzerinden erişilebilir olur.
- **Gerçek kişiler (natural persons):** `did:key` yöntemi — zincire kaydedilmez, kullanıcıda kalır.

> Kritik ayrım: **Bireyler zincire yazılmaz.** Yalnızca kurumlar (issuer'lar) zincirde DID'e sahiptir. Bu, GDPR/mahremiyet açısından bilinçli bir tasarımdır.

## Trusted Issuers Registry (TIR)
- Güvenilir issuer'ların public verisi, akreditasyonları ve ilişkilerini tutan merkeziyetsiz kayıt.
- Bilgi, smart contract içinde **"Attribute Envelope"** (VC'ye benzer yapı) olarak saklanır.

## Trusted Schemas Registry (TSR)
- Issuer'lar kendi VC şemalarını tanımlar ve buraya kaydeder.
- Bir issuer, ancak bir **Trusted Accreditation Organisation (TAO)** tarafından akredite edilince, belirli kayıtlı şemalara göre VC verebilir.

## Trust Chain (Güven Zinciri)
Yetki kökten aşağıya doğru akan bir hiyerarşi:

```text
RTAO (Root Trusted Accreditation Organisation)
   → TAO (Trusted Accreditation Organisation)
      → TI (Trusted Issuer)
         → Holder (kullanıcı — credential'ı elinde tutan)
```

Bu zincir, credential'lara **hukuki ağırlık** kazandırır: doğrulayıcı, bir belgenin kökü güvenilir bir otoriteye kadar izlenebilir olduğunu kanıtlayabilir.

---

# 5. On-Chain vs Off-Chain (Kritik)

EBSI, [[RS-EIDAS-0001]] §7'de belirlenen GDPR ilkesini somut biçimde uygular. Bu tablo Tamga'nın [[PM-TRUST-0001]] kararı için doğrudan şablondur:

| Zincirde (On-Chain) | Zincir Dışında (Off-Chain) |
|---------------------|-----------------------------|
| Kurumların DID document'ları (public anahtarlar) | Bireysel Verifiable Credential'lar |
| Trusted Issuers Registry (akreditasyonlar) | Kişisel veri (PID, belge içeriği) |
| Trusted Schemas Registry (JSON şemalar) | Gerçek kişilerin DID'leri (`did:key`) |
| Roles / attributes registry, yönetişim | Holder cüzdanındaki her şey |
| (Bazı durumlarda) iptal/durum kanıtları | Özel koleksiyonlar (Fabric) |

**Özet ilke:** Zincirde yalnızca **kişisel olmayan güven verisi** (kim güvenilir, hangi anahtar, hangi şema) bulunur. **Bireysel credential ve kişisel veri asla zincirde değildir**; kullanıcının cüzdanında (holder) tutulur.

> Bu, Tamga'nın "credentials hashleme / işlemleri ağa yazma" fikrinin **doğru versiyonudur:** zincire yazılan şey bireyin belgesi/hash'i değil, **o belgeyi verenin yetkisi ve anahtarıdır.**

---

# 6. Standartlar ve EUDI / eIDAS İlişkisi

- EBSI, **W3C Verifiable Credentials / Verifiable Presentations** çerçevesini uygular (veri modelleri, DID yöntemleri, e-imza, yaşam döngüsü).
- OpenID4VCI / OpenID4VP akışlarıyla hizalanmaktadır (bkz. [[RS-EIDAS-0001]] §4).
- EBSI, eIDAS / EUDI Wallet ekosistemiyle **hizalı** bir güven altyapısı olarak konumlanır: EUDI cüzdanı kişisel credential'ı taşırken, EBSI tarzı bir registry "bu credential'ı veren kurum güvenilir mi?" sorusunu cevaplayabilir.

> **Konumlandırma dersi:** EBSI ve EUDI **rakip değil, tamamlayıcıdır.** EUDI = kullanıcının cüzdanı (holder tarafı); EBSI = kurumsal güven kaydı (registry/anchor tarafı). Tamga tam olarak bu ikinci boşluğu (Türkiye/global güven registry'si) doldurabilir.

---

# 7. Tamga İçin Çıkarımlar

1. **Model doğrulandı.** Tamga'nın [[PM-BC-0001]] kararı (izinli, eşit güç, konsorsiyum yönetimi, BFT/PoA) teorik değil; EBSI ile üretimde kanıtlanmış bir mimaridir.
2. **Framework kararına veri.** EBSI, Besu + IBFT 2.0 (QBFT akrabası) seçmiştir. Bu, Tamga'nın framework kararında (RS-FRAMEWORKS-0001) Besu/QBFT'yi güçlü bir aday yapar. Cosmos SDK/CometBFT hâlâ karşılaştırılmalıdır (özellikle çok-zincir/egemenlik senaryoları için).
3. **On-chain sınırı netleşti.** Bölüm 5 tablosu, [[PM-TRUST-0001]] için doğrudan başlangıç noktasıdır: zincir = registry (DID/issuer/şema), credential = off-chain.
4. **Güven zinciri (trust chain) modeli.** RTAO→TAO→TI→Holder hiyerarşisi, Tamga'nın "devlet → güvendiği kurum → issuer → kullanıcı" yetkilendirme akışına doğrudan uyarlanabilir.
5. **Konumlandırma.** Tamga, EUDI'ye rakip değil; EUDI-uyumlu bir **güven registry + cüzdan** olarak, Türkiye'de EBSI'nin karşılığı olacak boşluğu hedefleyebilir.

---

# 8. Açık Sorular ve Farklar

1. **Besu mu Cosmos mu?** EBSI Besu seçti; ama Tamga'nın "tek ortak zincir" kararı Cosmos'un çok-zincir avantajını gereksiz kılabilir. Net karşılaştırma: RS-FRAMEWORKS-0001.
2. **EBSI'ye katılmak mı, benzerini kurmak mı?** Türkiye AB dışı olduğundan EBSI'ye doğrudan node olması muhtemel değil; ama **birlikte çalışabilirlik (interoperability)** hedeflenebilir. Bu stratejik bir karardır → [[PM-PH-0001]].
3. **Fabric rolü.** EBSI özel veri için Fabric de kullanıyor; Tamga'nın çok-protokol ihtiyacı var mı? Muhtemelen erken aşamada hayır.
4. **İptal/durum (revocation).** EBSI'nin iptali nasıl yaptığı (on-chain mi, status list mi) derinleştirilmeli; [[RS-EIDAS-0001]] §6 mahremiyet kaygılarıyla birlikte değerlendirilmeli.

---

# 9. Referanslar

## Web Kaynakları (2026-07-29 erişim)

> *Sürüm notu 0.1.2 (2026-10-01): taşınan AB/EBSI sayfalarının bağlantıları güncel resmî adreslerle değiştirildi; üçüncü taraf özet yerine ARF'nin kendi bölümü (anlam değişmedi).*

- EBSI Knowledge Base — "What is the technology behind EBSI" — https://ec.europa.eu/digital-building-blocks/sites/spaces/EBSIKB/pages/668536427/What+is+the+technology+behind+EBSI
- EBSI Node Operators — https://ec.europa.eu/digital-building-blocks/sites/spaces/EBSI/pages/609583364/Node+Operators
- What is EBSI — https://ec.europa.eu/digital-building-blocks/sites/spaces/EBSI/pages/590447955/What+is+EBSI
- EBSI Hub — Standards — https://hub.ebsi.eu/arch-req/standards
- EBSI Hub — W3C VCs and VPs — https://hub.ebsi.eu/vc-framework/ebsi-w3c-vc-vp
- Trusted Issuers Registry API (v5) — https://hub.ebsi.eu/apis/pilot/trusted-issuers-registry/v5/get-issuers
- EBSI Verifiable Credentials (VC çerçevesi) — https://hub.ebsi.eu/vc-framework
- EBSI-NE (Nodes Expansion) — https://smartinnovationnorway.com/en/project/ebsi-ne/

## Teknik Kavramlar
- Hyperledger Besu — IBFT 2.0 / QBFT consensus
- W3C Verifiable Credentials Data Model
- DID Methods (did:ebsi, did:key)

---

# İlgili Dokümanlar

- [[RS-EIDAS-0001]] — eIDAS/EUDI zemini; EBSI'nin tamamlayıcı rolü.
- [[PM-BC-0001]] — Blockchain ve validator modeli; EBSI onu doğrular.
- [[PM-TRUST-0001]] — On-chain/off-chain sınırı; §5 tablosu doğrudan girdi.
- RS-FRAMEWORKS-0001 (planlı) — Cosmos vs Besu; §3 ve §7 girdi.
- [[PM-PH-0001]] — EBSI'ye karşı konumlandırma stratejisi.

---

# Durum

**review_status: Draft.** EBSI'nin genel mimarisi, yönetişimi ve güven modeli derlendi. Derinleştirilecek alanlar: iptal (revocation) mekanizması, EBSI'nin tam veri modeli (VDR şeması) ve EUDI ile teknik entegrasyon noktaları. Bu doküman, PM-TRUST-0001 ve RS-FRAMEWORKS-0001 yazıldıkça çapraz referanslarla güncellenecektir.
