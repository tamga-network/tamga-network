---
document_id: ADR-0066
title: "ETSI TS 119 612 XML liste görünümü"
status: Active
review_status: Completed
version: 1.0.0
created: 2026-10-29
last_updated: 2026-10-29
summary: >
  Tamga'nın ülke listeleri bugün Tamga JSON + JWS ve ETSI TS 119 602 (LoTE) JSON görünümüyle yayımlanır; ETSI TS 119 612 XML
  (XAdES imzalı güven listesi) yayını 2026-10-13'te ertelenmişti (ADR-0036 eki). Komisyon'un üçüncü ülkeler için açtığı ara yol
  (üçüncü ülke güven listelerinin listesi, TC AdES LOTL) ve AB'nin güven listesi ekosistemi ulusal listeyi 119 612 XML biçiminde
  ister; liste sahibi devlettir, ağ aracı ve şablonu sağlayabilir. Öneri: her ülke slotu için aynı imzalı kaynaktan, aynı sürüm
  numarasıyla, XAdES-B-B imzalı bir 119 612 XML görünümü üretilir; üretim bayrakla açılır (varsayılan kapalı). Bugün yalnız Türkiye
  slotu etkindir; önce sandbox'ta açıldı (ayrı, §5.7.1'e uygun XML imza sertifikasıyla), gerçek ağ işletmeci ve kurum posta
  adresleri tamamlanınca proje yönetimi onayıyla açılır. AB anlamında nitelikli ya da bildirilmiş olma iddiası taşıyan ETSI
  URI'leri kullanılmaz; liste türü, durum ve kural URI'leri Tamga kökündendir (`https://trust.tamga.network/tl/…`). Kabul:
  2026-10-29 (proje yönetimi onayı).
domain: Trust
related: ["[[ADR-0009]]", "[[ADR-0024]]", "[[ADR-0035]]", "[[ADR-0036]]", "[[ADR-0042]]", "[[SPEC-TRUST-0001]]", "[[SPEC-ID-0002]]", "[[FW-TF-0001]]"]
---

# Kısaca

Avrupa'da güven listeleri yıllardır tek bir XML biçimiyle (ETSI TS 119 612) yayımlanır; AB'nin imza doğrulama araçları bu
biçimi okur. AB üyesi olmayan bir ülkenin listesinin Avrupa'da tanınmasının bugünkü ara yolu da bu biçimden geçer. Tamga'nın
listeleri bugün bu biçimde yayımlanmıyor. Bu karar, aynı listeyi ikinci bir biçimde, aynı imzalı kaynaktan ve aynı sürüm
numarasıyla da yayımlamayı getirir. Önce test ağında (sandbox) açıldı; gerçek ağda açılması posta adreslerinin tamamlanmasına bağlı.

# Bağlam

- **Bugün.** Ülke listesi (`tl-<cc>.jws`) ve LOTL Tamga JSON + JWS biçimindedir ([[SPEC-TRUST-0001]]); cüzdan, doğrulayıcı ve
  belge veren için ETSI TS 119 602 LoTE JSON görünümü de vardır ([[SPEC-ID-0002]] §8.1.1). Tamga 119 612 XML listelerini
  **okur** (dış listeler, [[ADR-0036]] K1) ama kendi listesini XML olarak **yayımlamaz**: [[ADR-0036]] eki (2026-10-13) bunu
  ertelemiş, tetikleyiciyi "AB'den ilk tarafın istemesi" koymuştu.
- **Üçüncü ülke yolu.** eIDAS md. 14 üçüncü ülke güven hizmetlerinin tanınmasını bir anlaşmaya ya da uygulama tüzüğüne bağlar;
  usul henüz tanımlanmadı, hiçbir ülke tam tanıma almadı. Komisyon bunun yerine bir ara yol açtı: "Pilot for the International
  Compatibility of Trust Services" ve üçüncü ülke güven listelerinin listesi (TC AdES LOTL). Bu listeye giren ülkenin güven
  hizmeti sağlayıcılarının sertifikalarıyla atılan imza ve mühürler AB kamu hizmetlerinde gelişmiş imza olarak doğrulanabilir
  (hukuki eşdeğerlik değildir). Ön koşul: ETSI TS 119 612 biçiminde ulusal güven listesi, dört ayaklı öz-değerlendirme (ETSI
  TR 103 684) ve Komisyon'la pilot. Listeye giren ilk ülke Ukrayna'dır; Ukrayna'nın listesi (`TSLVersionIdentifier` 6, kendi URI
  kökü, AB LOTL'una işaretçi) bu yolun çalışan örneğidir. Dünya Bankası'nın Batı Balkanlar dijital kimlik raporları (2026) aynı
  ara adımı aday ülkeler için öneriyor.
- **Ne anlama gelir, ne anlama gelmez.** TC AdES LOTL, devletin denetlediği **imza ve mühür** sertifikası sağlayıcılarını kapsar.
  Tamga'nın kendi listesindeki kurumlar (nitelikli olmayan belge verenler, cüzdan sağlayıcılar) bu listenin konusu değildir ve
  Tamga devlet değildir: Tamga'nın XML listesi TC AdES LOTL'a **girmez**. Kazanç iki yönlüdür: (1) bir Türk dünyası devleti kendi
  ulusal listesini yayımlamak istediğinde ağ hazır, denenmiş bir araç ve şablon sunar ([[ADR-0035]] federasyon; ağ araç sağlar,
  liste sahibi devlettir); (2) ARF'ın iki biçimi de destekleme beklentisi (ISSU_10b, OIA_15b) ve Uygulama Tüzüğü (AB) 2026/1731'deki
  `etsi_tl` güven otoritesi türü için Tamga'nın kendi listesi de XML olarak okunabilir olur.
- **Standart.** ETSI TS 119 612 V2.4.1 (2025-08): AB dışı işletmeciler liste türü, durum belirleme yaklaşımı, kural ve hizmet
  durumu için "amaca göre tanımlanmış" kendi URI'lerini kullanabilir (§5.3.3, §5.3.8, §5.3.9, §5.5.4); imza XAdES-B-B, zarflanmış,
  Exclusive C14N, KeyInfo'da yalnız imzacı sertifikası (§5.7.1, Ek B); `NextUpdate` en çok 6 ay sonrası (§5.3.15); geçmiş hiç
  silinmez (`HistoricalInformationPeriod` 65535, §5.3.12); yayın adresinin yanında `.sha2` özet dosyası (§6.1). TS 119 602 (LoTE)
  aynı veri modelini JSON'da taşır; Tamga ikisini de aynı kaynaktan üretir.
- **Eski tablo.** [[SPEC-ID-0002]] §8.1'deki 119 612 eşlemesi (belge veren → `CA/QC`, `granted`) bugünkü kararlarla uyuşmaz:
  `granted` ve `…/QC` AB anlamında nitelikli hizmet iddiasıdır; Tamga'nın belge verenleri nitelikli değildir ([[ADR-0022]]).

# Karar

## K1 — Aynı imzalı kaynaktan, aynı sürümle XML görünümü

- Liste yayıncısı her ülke slotu için imzaladığı `tl-<cc>` nesnesinden ve LOTL'dan bir TS 119 612 XML görünümü üretir:
  `tl-<cc>.xml`, yanında `tl-<cc>.sha2` (ikili dosyanın SHA-256 özeti) ve arşiv kopyası `archive/tl-<cc>.vNNNN.xml`.
- `TSLSequenceNumber` = Tamga listesinin `version`'ı; `ListIssueDateTime` = `issued_at`; `NextUpdate` = en geç `next_update`, en
  çok 6 ay. XML ayrı bir liste değil, aynı yayının ikinci biçimidir; ayrı sayaç tutulmaz (bkz. açık konular).
- Yetkili kaynak Tamga JSON listesidir (BT4). XML ile JSON çelişirse JSON geçerlidir; XML'de JSON'da olmayan kayıt bulunamaz.

## K2 — URI profili: iddia taşımayan Tamga kökü

- Liste türü `https://trust.tamga.network/tl/TSLType/<CC>list`, durum belirleme `…/StatusDetn/<CC>determination`, kurallar
  `https://arf.tamga.network/trust-framework` + `…/schemerules/<CC>`, hizmet durumu `…/Svcstatus/{active, suspended, revoked,
  retired, rollingover, deprecated}` (Tamga durum kümesiyle birebir). URI adları ve kökü proje yönetimince onaylandı
  (2026-10-29); anlamları `docs.tamga.network/concepts/etsi-trusted-list` sayfasında tanımlıdır ve `trust.tamga.network/tl/`
  altındaki her URI o sayfaya yönlenir (§5.3.7, §5.5.4).
- AB'de "üye devletçe bildirilmiş" ya da "nitelikli" anlamı taşıyan ETSI URI'leri (`EUgeneric`, `EUappropriate`, `granted`,
  `recognisedatnationallevel`, `…/QC`) kullanılmaz. Bu URI'leri tanımayan bir okuyucu hizmeti etkin saymaz (güvenli taraf).
- Hizmet türü, işlevi birebir anlatan bir ETSI türü varsa ETSI'nindir: ulusal kök CA → `Svctype/CA/PKC`, nitelikli olmayan belge
  veren → `Svctype/EAA`, cüzdan çözümü → TS 119 602 `SvcType/WalletSolution/Issuance` (LoTE ile aynı). ETSI karşılığı iddia
  taşıyacak ya da hiç olmayan türler Tamga kökündendir: PuB-EAA karşılığı → `…/Svctype/EAA/Pub-EAA`, Tamga'da akredite (QEAA
  karşılığı) → `…/Svctype/EAA/Q`, belge verenin iptal listesi imzası → `…/Svctype/EAA/StatusList`.
- Bir devlet slotu devraldığında URI kümesi slot başına değiştirilebilir (ör. ETSI `TSLType/<CC>list`); kayıtlar, kimlikler ve
  sürüm zinciri değişmez ([[ADR-0009]], D-GOV-5).

## K3 — Kapsam: güven hizmeti sağlayıcıları

- Listeye girenler: işletmecinin ulusal kök CA'sı; belge verenler (verme hizmeti + iptal listesi imza hizmeti); cüzdan
  sağlayıcılar (LOTL'dan, ağ cüzdan işletmez — [[ADR-0042]]). Etkin olmayan kayıtlar silinmez: Tamga durum URI'siyle ve geçmişiyle
  kalır (TL2, §5.5.10; geçmişte sertifika değil SKI).
- Girmeyenler: `RESERVED` / `PROVISIONAL` kayıtlar; doğrulayıcılar (güven hizmeti sağlayıcısı değildir — kayıtları JSON listesinde ve
  kayıt sertifikalarında, [[ADR-0026]]). Kişisel veri hiçbir zaman (D-TRUST-0, DP1).
- Hukuki uyarı her XML'de: "Tamga listesinin görünümüdür; 910/2014 kapsamında bildirilmiş liste değildir; listede nitelikli güven
  hizmeti yoktur."

## K4 — İmza: XAdES-B-B ve ayrı XML imza sertifikası

- İmza TS 119 612 Ek B ve EN 319 132-1 XAdES-B-B: zarflanmış, `URI=""` + enveloped-signature + Exclusive C14N, SignedProperties
  (SigningTime, SigningCertificateV2, DataObjectFormat `text/xml`), KeyInfo'da yalnız imzacı sertifikası; ECDSA P-256 / SHA-256.
- İmzacı sertifikası §5.7.1 profiline uyar: konu `C` = slot ülke kodu, `O` = `SchemeOperatorName`; keyUsage yalnız
  digitalSignature (ve/veya nonRepudiation); basicConstraints CA=false; SKI; extendedKeyUsage `id-tsl-kp-tslSigning`
  (0.4.0.2231.3.0). Bugünkü liste imzacısı (`tl-signer-1`) basicConstraints ve EKU taşımadığından **ayrı bir XML imza sertifikası**
  (`tl-xml-signer-1`) kullanılır: ağın kök CA'sınca verilen yaprak, yalnız XML listesini imzalar; JSON listeleri `tl-signer-1`
  imzalamaya devam eder. Sandbox'ta 2026-10-29'da verildi; gerçek ağda sertifika depo dışındaki üretim PKI'sında, proje yönetimi
  onayıyla verilir. Gerçek ağda profile uymayan imzacıyla XML yayınlanmaz; yayıncı durur.
- XML imzacısının parmak izi LOTL'da ilgili ülke slotunun imza anahtarları arasında (`national_lists[].signing_keys`, yeni alan
  yok) yayımlanır ve sertifikası `keys/`'e konur (imzacıyı doğrulamanın Tamga yolu LOTL'dur).

## K5 — Yayın: varsayılan kapalı, sandbox önce

- Üretim bayrağı `TAMGA_TL119612` varsayılan kapalıdır. Açılış sırası: sandbox (`trust.sandbox.tamga.network/tl-tr.xml`), bağımsız
  doğrulama (AB DSS doğrulayıcısı, ETSI XSD), sonra gerçek ağ (`trust.tamga.network/tl-<cc>.xml`) — her adım proje yönetimi
  onayıyla. Sandbox 2026-10-29'da açıldı.
- Sunucu `.xml`'i `application/vnd.etsi.tsl+xml`, `.sha2`'yi `text/plain` olarak ve en çok 4 saatlik önbellekle sunar (§6.1, §6.2).
- Gerçek ağda eksik yayın verisi (işletmeci posta adresi, kurum ve cüzdan sağlayıcı adresleri — [[ADR-0024]]) yayını durdurur;
  sandbox'ta uyarıdır. Sandbox kayıtları "Sandbox (TEST)" işaretli yer tutucu adres taşır; gerçek ağda yer tutucu kabul edilmez.
- Bayrak açılınca bile 119 612 XML'i yalnız `etkin` ülke slotları için üretilir (bugün TR); rezerve slotlar (AZ, KZ, KG, UZ, …)
  için üretim, o slotun ilk listesiyle aynı anda başlar.

# Değerlendirilen seçenekler

| Seçenek | Sonuç | Neden |
|---|---|---|
| (a) Her ülke slotu için aynı imzalı kaynaktan paralel XML | **önerilen (kod)** | Tek kaynak, tek sürüm zinciri; devlet slotu devraldığında araç hazır; LoTE ile aynı ilke |
| (b) Yalnız Türkiye slotu, şimdi | **önerilen (yayın)** | Bugün etkin tek slot TR; (a)'nın kodu ile (b)'nin yayını aynı şey — rezerve slotlar boş |
| (c) Ertelemeyi sürdür (ADR-0036 eki) | ret | Üçüncü ülke yolu ve AB araçları 119 612 istiyor; araç yokken devlete destek sözü boş kalır; iş küçük (yazıldı) |
| XML'i elle ya da ayrı kayıt defterinden üretmek | ret | İki kaynak birbirinden kayar; JSON ile çelişki riski (BT4) |
| ETSI `granted` / `recognisedatnationallevel` / `EUgeneric` kullanmak | ret | Nitelikli ya da AB'ce bildirilmiş olma iddiası; Tamga devlet değil, hizmetler nitelikli değil |
| Doğrulayıcıları da TSP olarak listelemek | ret | Güven hizmeti sağlayıcısı değiller; AB'de de güvenen taraf kaydı listede değil kayıt kurumunda |
| Mevcut liste imzacısıyla imzalamak | ret (gerçek ağda) | §5.7.1 profiline uymuyor (basicConstraints, EKU); sandbox ve testte uyarıyla kabul |
| XML için ayrı sıra numarası (1'den) | ret (bugün) | §5.3.2 "ilk yayın 1" der, ama ayrı sayaç JSON ile XML'i eşlemeyi zorlaştırır; açık konu |

# Değişmezler

| Kod | Kural |
|---|---|
| TX1 | TS 119 612 XML, yalnız imzalanmış Tamga ülke listesinden ve LOTL'dan, aynı sürümle (`TSLSequenceNumber` = `version`) üretilir; XML'de JSON listesinde olmayan kayıt bulunamaz; çelişkide JSON geçerlidir. |
| TX2 | XML'de AB anlamında bildirilmiş ya da nitelikli olma iddiası taşıyan ETSI URI'si (`EUgeneric`, `EUappropriate`, `granted`, `recognisedatnationallevel`, `…/QC`) kullanılmaz; liste türü, durum ve kural URI'leri slot işletmecisinin köküdür. |
| TX3 | İmza XAdES-B-B, zarflanmış, Exclusive C14N; KeyInfo'da yalnız imzacı sertifikası; imzacı sertifikası TS 119 612 §5.7.1 profiline uyar. Gerçek ağda profile uymayan imzacıyla ya da eksik yayın verisiyle XML yayınlanmaz. |
| TX4 | Kayıt silinmez: etkin olmayan hizmet durumuyla ve geçmişiyle listede kalır; `RESERVED` / `PROVISIONAL` kayıt, doğrulayıcı ve kişisel veri XML'e girmez. |
| TX5 | Üretim bayrakla açılır (varsayılan kapalı); gerçek ağda açılış proje yönetimi onayıyla, sandbox ve bağımsız doğrulamadan sonra. |

# Sonuçlar

Hazırlandı (2026-10-29, varsayılan kapalı; yayın yok):

- `apps/trust-publisher/src/tl119612.ts`: model, XML yazımı, XAdES-B-B imzası, §5.7.1 imzacı denetimi; `build` bayrakla
  (`TAMGA_TL119612=1`, imzacı `TAMGA_TL119612_SIGNER`) `tl-<cc>.xml`, `.sha2`, arşiv kopyası yazar.
- `@tamga-network/trust`: XML kanonikleştirmesi ve ayrıştırıcısı dışa açıldı (`canonicalizeXml`, `parseXml`; kaynak 0.7.4, npm'e
  yayımlanmadı) — imza ve doğrulama aynı kanonikleştirmeyi kullanır.
- `apps/trust-publisher/etsi/19612/`: ETSI'nin resmî XSD'leri (TS 119 612 V2.4.1 Ek C) ve içe aktardıkları W3C/ETSI şemaları; testler
  her üretilen listeyi bunlara karşı denetler.
- Testler: şema (libxml2), imza (paketin doğrulayıcısı ve ondan bağımsız bir XML imza kütüphanesi), XAdES nitelikleri, kurcalama,
  bayrak, imzacı profili; sandbox örneği `test/fixtures/tl119612/`. Örnek, AB'nin DSS doğrulayıcısında "XAdES-BASELINE-B, imza ve
  başvurular sağlam" sonucunu verdi (imzacı AB'de güven çapası olmadığından sonuç INDETERMINATE — beklenen).

Kabulle (2026-10-29):

- [[SPEC-ID-0002]] §8.1 tablosu bu profile göre yeniden yazıldı (eski `CA/QC` + `granted` eşlemesi kalktı); [[SPEC-TRUST-0001]]
  yayın bölümüne XML görünümü; [[ADR-0036]] ekine "kaldırıldı — ADR-0066" notu.
- Sandbox'ta açıldı: `tl-xml-signer-1` (sandbox kökünce, §5.7.1 profili), sandbox kayıtlarında "TEST" işaretli yer tutucu
  adresler, `trust.sandbox.tamga.network/tl-tr.xml` + `.sha2`, URI açıklama sayfası (`docs.tamga.network/concepts/etsi-trusted-list`,
  tr/en/az). Canlı liste ETSI XSD'sine ve AB DSS doğrulayıcısına karşı doğrulandı.
- Gerçek ağ için kalanlar: üretim XML imza sertifikası (gerçek ağ PKI'sı, depo dışında; komut `ops/README.md`) ve LOTL'da
  parmak izi; işletmeci posta adresi; kurum ve cüzdan sağlayıcı adres verisi; sonra bayrak (proje yönetimi onayıyla).
- Okuyucu tarafı (ayrı iş): `@tamga-network/trust` 119 612 okuyucusu bugün yalnız ETSI etkin durumlarını tanır; Tamga kökündeki
  durumları tanıması, LOTL'da sabitlenmiş bir Tamga XML listesi okunacağı zaman ayrı kararla.

**Açık konular:** (1) URI adları onaylandı; XML imza sertifikasının adı (`tl-xml-signer-1`, konu adı "Tamga Sandbox Trusted List
Signer (TEST)" / gerçek ağda "Tamga Network Trusted List Signer 1") teyit bekliyor; (2) `TSLSequenceNumber`'ın JSON sürümünü mü
izleyeceği, ayrı sayaçla 1'den mi başlayacağı; (3) bir devlet slotu TC AdES LOTL'a başvurduğunda o listede AB LOTL'una işaretçi
ve Komisyon'un üçüncü ülke eşleme ("MRA") öğesi — yayıncı işaretçiyi destekler, içerik devletin işidir; (4) ETSI TR 103 684
öz-değerlendirmesinin ağın kural kitabıyla eşlenmesi (ayrı araştırma).

# Durum

**Accepted — 2026-10-29.** Proje yönetimi onayıyla. DECISIONS: D-TRUST-6. Sandbox'ta açık; gerçek ağda posta adresleri ve üretim
XML imza sertifikası tamamlanınca proje yönetimi onayıyla açılır.
