---
title: ETSI XML güven listesi
---

# ETSI XML güven listesi

Avrupa'da güven listeleri yıllardır tek bir XML biçimiyle yayımlanır: **ETSI TS 119 612**. AB'nin imza doğrulama araçları bu
biçimi okur. Tamga'nın ülke listesi, imzalı Tamga listesinin ([[SPEC-TRUST-0001]]) yanında bu biçimde de yayımlanır: aynı
kayıtlar, aynı sürüm numarası, XAdES imzası. Yetkili kaynak her zaman Tamga JSON listesidir; XML onun ikinci görünümüdür
([[ADR-0066]]).

Bu sayfa aynı zamanda XML listesindeki Tamga URI'lerinin **tanım sayfasıdır**: `https://trust.tamga.network/tl/…` altındaki her
adres buraya gelir.

## Nerede

| Ortam | Liste | Özet | İmzacı sertifikası |
|---|---|---|---|
| Sandbox (test ağı) | `https://trust.sandbox.tamga.network/tl-tr.xml` | `…/tl-tr.sha2` | `…/keys/tl-xml-signer-1.cert.pem` |
| Gerçek ağ | `https://trust.tamga.network/tl-tr.xml` — **henüz yayında değil** (işletmeci ve kurum posta adresleri tamamlanınca) | | |

- Eski sürümler: `archive/tl-tr.v<NNNN>.xml` (aynı alan adında).
- `.sha2` dosyası XML dosyasının SHA-256 özetidir (onaltılık). Liste değişti mi diye bakmak içindir, kimlik doğrulamaz (TS 119 612
  §6.1). Sunucu önbelleği en çok 4 saattir.
- Sandbox listesi test anahtarlarıyla imzalıdır ve gerçek ağda geçmez; içindeki adresler "Sandbox (TEST)" yer tutucusudur.

## Ne değildir

- Tamga'nın XML listesi, AB Tüzüğü 910/2014 kapsamında **bildirilmiş bir liste değildir** ve listede **nitelikli güven hizmeti
  yoktur**. Her XML'in hukuki uyarısında bu yazar.
- Bu liste AB'nin üçüncü ülke güven listeleri listesine (TC AdES LOTL) **girmez**: orası bir devletin denetlediği imza ve mühür
  sertifikası sağlayıcıları içindir. Bir Türk dünyası devleti kendi ulusal listesini yayımlamak istediğinde aynı araç ve şablon
  hazırdır.
- AB'nin "üye devletçe bildirilmiş" ya da "nitelikli" anlamı taşıyan URI'leri (`EUgeneric`, `granted`,
  `recognisedatnationallevel`, `…/QC`) kullanılmaz. Bu yüzden aşağıdaki URI'leri tanımayan bir okuyucu hizmetleri **etkin
  saymaz** — bu bilinçli, güvenli taraftır.

## Listede ne var

| Kim | Hizmet türü (`ServiceTypeIdentifier`) |
|---|---|
| Ulusal kök sertifika (işletmeci) | `http://uri.etsi.org/TrstSvc/Svctype/CA/PKC` |
| Belge veren kurum | `http://uri.etsi.org/TrstSvc/Svctype/EAA` ya da aşağıdaki Tamga türleri |
| Belge verenin iptal listesi imzası | `https://trust.tamga.network/tl/Svctype/EAA/StatusList` |
| Cüzdan sağlayıcı | `http://uri.etsi.org/19602/SvcType/WalletSolution/Issuance` |

Doğrulayıcılar listede **yoktur** (güven hizmeti sağlayıcısı değildirler; kayıtları JSON listesinde ve kayıt sertifikalarındadır).
Kişisel veri hiçbir zaman yoktur. Kayıt silinmez: geri çekilen bir hizmet durumuyla ve geçmişiyle listede kalır.

## URI tanımları {#uris}

Kök: `https://trust.tamga.network/tl/`. `<CC>` ülke kodudur (bugün `TR`).

### Liste türü {#tsltype}

`https://trust.tamga.network/tl/TSLType/<CC>list` — Tamga Güven Çerçevesi altında `<CC>` ülke slotu için yayımlanan güven
hizmeti durum listesi. Liste, Tamga'nın imzalı ülke listesinin (`tl-<cc>.jws`) aynı sürümlü görünümüdür. AB üye devleti listesi
(`EUgeneric`) değildir.

### Durum belirleme yaklaşımı {#statusdetn}

`https://trust.tamga.network/tl/StatusDetn/<CC>determination` — hizmet durumları Tamga Güven Çerçevesi'nin kayıt ve onay
süreciyle belirlenir: işletmeci kurumu kayıt verisi ([[ADR-0024]]) ve yetkili belge türleriyle kaydeder, durum değişikliklerini
imzalı listede yayımlar. AB anlamında denetim organı kararı ya da nitelikli statü yoktur.

### Kurallar {#schemerules}

`https://arf.tamga.network/trust-framework` — Tamga Güven Çerçevesi (ağın kural kitabı).
`https://trust.tamga.network/tl/schemerules/<CC>` — `<CC>` slotunun kuralları; bugün Tamga Güven Çerçevesi'nin kendisidir (slot
bir devlete geçtiğinde o devletin kurallarına işaret eder).

### Hizmet durumları {#svcstatus}

Tamga durumu ile birebir:

| URI (`…/tl/Svcstatus/…`) | Tamga durumu | Anlamı |
|---|---|---|
| `active` | `ACTIVE` | Hizmet kayıtlı ve geçerli; imzaladığı belgeler kabul edilir. |
| `suspended` | `SUSPENDED` | Geçici olarak askıda; askı süresince hizmetin imzası güvenilir sayılmaz. |
| `revoked` | `REVOKED` | Geri çekildi; geri çekilmenin geçerli olduğu andan sonra verilen belgeler kabul edilmez. |
| `retired` | `RETIRED` | Olağan biçimde emekliye ayrıldı (ör. halefe devir sonrası); geçmiş belgeler durumu tarihine göre değerlendirilir. |
| `rollingover` | `ROLLING_OVER` | Anahtar ya da kök yenileme dönemi; eski ve yeni sertifika birlikte geçerli. |
| `deprecated` | `DEPRECATED` | Kullanımdan kalkıyor; yeni kullanım önerilmez. |

Önceki durumlar `ServiceHistory` içinde, yeniden eskiye ve sertifika yerine anahtar kimliğiyle (SKI) durur.

### Tamga hizmet türleri {#svctype}

| URI (`…/tl/Svctype/…`) | Anlamı |
|---|---|
| `EAA/Pub-EAA` | Kamu kaynağından ya da onun adına belge veren kurum (AB PuB-EAA karşılığı, ama AB anlamında değil). |
| `EAA/Q` | Tamga Güven Çerçevesi'nde akredite belge veren (AB QEAA karşılığı, ama **nitelikli değil**). |
| `EAA/StatusList` | Belge verenin iptal listesini (Token Status List) imzalayan ayrı hizmet. |

## İmza ve imzacı

- İmza: XAdES-B-B (EN 319 132-1), zarflanmış, Exclusive C14N; ECDSA P-256 / SHA-256; KeyInfo'da yalnız imzacı sertifikası.
- İmzacı: ayrı XML imza sertifikası `tl-xml-signer-1`, ağın kök sertifikasınca verilmiş; TS 119 612 §5.7.1 profili — konu `C` =
  ülke kodu, `O` = işletmeci adı (`SchemeOperatorName`), basicConstraints CA=false, keyUsage digitalSignature + nonRepudiation,
  extendedKeyUsage `id-tsl-kp-tslSigning` (0.4.0.2231.3.0).
- İmzacıyı Tamga yolundan doğrulamak: parmak izi LOTL'da (`lotl.jws`) ülke slotunun `signing_keys` listesindedir; LOTL'un kendisi
  [güven çapasıyla](/concepts/trust-lists) doğrulanır.

Sandbox XML imzacısı (2026-10-29): `CN=Tamga Sandbox Trusted List Signer (TEST), O=Tamga Network Sandbox (TEST), C=TR`, SHA-256
`5576ff2bf0380b32e21a1859c267e6b0031d3c2bbc935adacb7d129eb6dac9c9`.

## AB DSS ile doğrulamak

AB'nin açık kaynak imza doğrulama aracı **DSS**'in (Digital Signature Service) Komisyon tarafından işletilen demo doğrulayıcısını
kullanabilirsiniz:

1. Listeyi indirin: `curl -O https://trust.sandbox.tamga.network/tl-tr.xml`
2. Özeti denetleyin: `sha256sum tl-tr.xml` çıktısı `tl-tr.sha2` ile aynı olmalı.
3. DSS demo doğrulayıcısında ("Validate a signature") `tl-tr.xml`'i yükleyin; doğrulama politikası varsayılan kalsın.
4. Beklenen sonuç: imza biçimi **XAdES-BASELINE-B**; "reference data intact", "signature intact"; imza zamanı ve imzacı
   sertifikası nitelikleri geçerli. Genel sonuç **INDETERMINATE / NO_CERTIFICATE_CHAIN_FOUND** olur: imzacı AB'nin güven
   listelerinde bir güven çapası değildir — beklenen ve doğrudur. Zinciri Tamga yolundan (LOTL) doğrularsınız.

Şemayı denetlemek için ETSI'nin resmî XSD'leri (TS 119 612 V2.4.1 Ek C) kullanılır; Tamga'nın testleri her üretilen listeyi bunlara
karşı denetler.

Kod ile okumak: `@tamga-network/trust` paketindeki `readTrustedListXml(xml, sabitParmakIzleri)` imzayı ve biçimi denetler. Paket
bugün yalnız ETSI'nin etkin durumlarını tanır; Tamga kökündeki durumları etkin saymaz (güvenli taraf).

## Ayrıntı

- Karar: [[ADR-0066]]
- Eşleme tabloları: [[SPEC-ID-0002]] §8.1
- Liste biçimi ve yayın yerleri: [[SPEC-TRUST-0001]]
- Güven listeleri: [Güven listeleri ve federasyon](/concepts/trust-lists)
