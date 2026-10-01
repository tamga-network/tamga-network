# Glossary

Tamga Network ekosisteminde kullanılan temel terminoloji. Bu doküman yaşayan bir sözlüktür; yeni kavramlar öğrenildikçe ve tartışıldıkça genişletilir.

> Terimler İngilizce başlıkla, Türkçe açıklamayla verilir. Terimler alfabetik değil, kavramsal öbekler hâlinde gruplanmıştır.

> **Geniş çalışma sözlüğü (eIDAS 2.0 / ETSI / EUDI / EBSI / kriptografi / OpenID4VC / beta
> terimleri, ~120 madde):** `docs/beta/07-terimler-sozlugu.md` (2026-09-24, kanonik değil).
> Buradaki kısa sözlük kanonik çekirdektir; oradaki maddeler karar kesinleştikçe buraya taşınır.

---

## Temel Kavramlar

### Tamga Network
Dijital kimlik, doğrulanabilir belgeler, yetkilendirme ve değiştirilemez işlem kayıtlarını tek bir mimari altında birleştiren **Digital Trust Infrastructure**. Bir blockchain ağı değildir; blockchain onun bir bileşenidir.

### Digital Trust Infrastructure
Dijital ortamda güveni ortak bir altyapı hizmeti olarak sunan katman. Her uygulamanın kimlik/güven problemini ayrı ayrı çözmesi yerine ortak bir güven katmanı sağlar.

### Tamga Wallet
Tamga'nın cüzdan uygulaması; Tamga Network'ün son kullanıcıya açılan ilk ürünü. Kişinin belgelerini telefonunda tutar ve yalnızca onayladığı alanları paylaşır; web sitelerine "Tamga ile giriş yap" da bu uygulamayla olur. Tamga Wallet, Tamga Network'ün kendisi değildir.

### Tamga Verify
Tamga'nın barındırılan doğrulayıcısı (`verify.tamga.network`; paket `@tamga-network/verifier`). Kendi doğrulayıcısını
çalıştırmayan bir kurum adına Tamga Wallet'tan belge ister ve doğrular; sonucu yalnız o kuruma ve bir kez verir (EUDI'deki
"aracı doğrulayıcı" rolü, [[ADR-0017]]).

---

## Kimlik ve Güven

### Digital Identity (Dijital Kimlik)
Ağ üzerindeki bir varlığın (birey, kurum veya nesne) doğrulanabilir temsili. Ekosistemin başlangıç noktasıdır.

### Organization Identity
Bir şirket, üniversite, hastane, banka veya kamu kurumunun dijital kimliği.

### Asset Identity
Araç, konteyner, makine, IoT cihazı gibi dijital varlıkların kimliği.

### Trust (Güven)
Kimlik ilişkileri üzerinden üretilen ve blockchain ile kalıcı hâle getirilen temel değer. "Kimlik güveni oluşturur, yetki işlemi sınırlar, blockchain güven ilişkisini kalıcı hale getirir."

---

## Assurance (Güven Seviyesi) — [[PM-ASSUR-0001]]

### Level of Assurance (LoA)
Bir kimliğin/belgenin ne kadar güçlü doğrulandığının ölçüsü. Tamga güveni **iki bağımsız
eksende** ölçer ve verifier kararı bu ikisinin **çarpımıdır**.

### Holder Assurance (T0–T3)
Kişinin kimliğinin ne kadar güçlü doğrulandığı + anahtarlarının ne kadar güvenli
saklandığı. T0 anonim → T1 düşük → T2 önemli → T3 yüksek. eIDAS LoA'ya 1:1 eşlenir.

### Issuer Assurance (I1–I3)
Belgeyi veren kurumun akreditasyon derecesi. I1 kayıtlı → I2 sözleşmeli → I3 akredite.
IssuerCategory (sektör) ile diktir.

### Derived Assurance (Devralınan Güven)
Başka bir kurumun yaptığı kimlik doğrulamasının devralınması. Tamga kimliği sıfırdan
doğrulamaz; mevcut doğrulamayı taşınabilir/doğrulanabilir kılar.

### Devletsiz Bootstrap
Devletler ağa katılmadan önce (Faz 0) güvenin mevcut kurumlardan devralınarak üretildiği
katman: e-imza/NES=T3, banka/GSM=T1, uzaktan KYC / kurum kayıt masası=T2.

### Assurance Decay
Assurance'ın zamanla/olayla değer kaybetmesi (cihaz değişimi, atıl kalma, kaynak
credential süresinin dolması) → seviye düşürme.

---

## Standart Terimler

### DID
Decentralized Identifier — Merkeziyetsiz Tanımlayıcı (W3C standardı).

### VC — Verifiable Credential
Doğrulanabilir Kimlik Bilgisi / Belge.

### SD-JWT VC
Selective Disclosure JWT Verifiable Credential — Tamga'nın birincil credential formatı
([[SPEC-CRED-0001]], [[ADR-0006]]). Seçici açıklama yerleşiktir.

### Holder Binding
Credential'ın belirli bir cüzdanın cihaz anahtarına (`cnf` + KB-JWT) bağlanması. Belgenin
başkasının cüzdanına alınmasını önleyen zorunlu güvenlik mekanizması.

### WUA — Wallet Unit Attestation
Cüzdanın gerçekliğini (donanım anahtarı, PIN, root/jailbreak yok, sağlayıcı) beyan eden
credential.

### SSI
Self-Sovereign Identity — Öz-egemen kimlik.

### ZKP
Zero-Knowledge Proof — Sıfır Bilgi İspatı.

### Consent
Kullanıcının veri veya işlem üzerindeki açık onayı.

### Authorization
Bir kimliğin hangi yetki kapsamında işlem yapabileceğini belirleyen katman.

---

## Mimari ve Kayıt

### On-Chain
Blockchain üzerinde tutulan, doğrulanabilir kanıtlar (verifiable proofs).

### Off-Chain
Blockchain dışında tutulan operasyonel veriler.

### Trust Protocol (TTP — Tamga Trust Protocol)
Platformlar arası güven iletişim modeli.

### Trust Envelope
Güven olaylarını taşıyan standart veri yapısı (spesifikasyonu sonra tanımlanacaktır).

---

## Süreç Terimleri

### ADR
Architecture Decision Record — Kabul edilmiş mimari karar.

### RFC
Request For Comments — Önerilen değişiklik.

### DDE
Documentation-Driven Engineering — Dokümantasyon öncelikli mühendislik.

### Project Memory
Kararların **neden** verildiğini koruyan mühendislik gerekçesi katmanı.
