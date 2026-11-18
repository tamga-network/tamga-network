---
document_id: ADR-0091
title: "AB uyum eşlemesi 2026-11: kural kitabı bağlantısı, uzun ömürlü anahtarla şifreleme, PID alanları, işlem verisi"
status: Active
review_status: Completed
version: 1.0.0
created: 2026-11-18
last_updated: 2026-11-18
summary: >
  AB teknik şartnameleri (TS3, TS7, TS8, TS10, TS11), ARF 3.0.0 §4.4.3 ve ECCG Agreed Cryptographic Mechanisms v2 ile madde madde
  eşlemenin karar gerektiren dört sonucu. K1: şema kataloğu girdisi insan okunur kural kitabına AB TS11 adıyla (`rulebookURI`) bağlanır;
  tür metadata'sı ve özetleri değişmez. K2: aynı anahtarın tekrar tekrar kullanıldığı iki AES-GCM yerinde her şifreleme tek kullanımlık
  anahtarla yapılır (cüzdan deposu `tws2`, kimlik servisinin ZK yenileme belirteci `A256KW`). K3: kimlik belgesi AB PID'in
  `place_of_birth` (yalnız kaynak belge taşıyorsa) ve `issuing_authority` alanlarını taşır. K4: OpenID4VP 1.0 işlem verisi
  (`transaction_data`) mekanizması paketlere girer; ağ bir işlem türü tanımlamaz, cüzdanın tanıdığı tür listesi boş başlar ve işlem
  verisi taşıyan istek reddedilir. Kabul: 2026-11-18.
domain: Protocol
related: ["[[ADR-0010]]", "[[ADR-0011]]", "[[ADR-0029]]", "[[ADR-0044]]", "[[ADR-0045]]", "[[ADR-0089]]", "[[SPEC-PROTO-0002]]", "[[SPEC-SCHEMA-0001]]", "[[SPEC-WALLET-0001]]", "[[FW-RB-0003]]"]
---

# Kısaca

AB'nin teknik şartnamelerini ve algoritma listesini madde madde kodla karşılaştırdık. Kodla düzelen eksikler (silme talebinde
istenen alanların günlüğe yazılması, aracı doğrulayıcının günlükte ve şikâyet dosyasında görünmesi, e-posta konuları) karar
gerektirmedi. Dört sonuç kapalı kararlara dokunduğu ya da yeni kural getirdiği için bu kayıtta toplandı.

# Bağlam

- **AB TS11** (katalog) her belge türü için insan okunur kural kitabının adresini `rulebookURI` adıyla ister; ARF R27 aynı bağı
  istemektedir. Tamga kataloğunda bu bağ yoktu.
- **ECCG ACM v2** (Nisan 2025, yürürlükteki sürüm) §3.5 Note 23/25: AES-GCM'de 96 bitlik IV, 128 bitlik etiket ve NIST SP 800-38D
  §8.2.1 belirlenimci IV yapısı. Tamga'da iki yerde aynı anahtarla tekrar tekrar ve rastgele IV ile şifreleniyordu: cüzdan deposu
  (`tws1`) ve kimlik servisinin ZK yenileme belirteci (JWE `dir` + A256GCM, [[ADR-0044]]). Kurumlara giden şifreli yanıtlar, TS10
  taşıma dosyası ve yakın alan oturumu her seferinde yeni anahtar ya da sayaç kullanır; sorun yalnız bu iki yerdedir.
- **CIR 2026/1731** PID kuralı `place_of_birth` alanını (`country`, `region`, `locality`; en az biri) ve `issuing_authority` üst
  verisini zorunlu tutar. Tamga kimlik belgesi PID değildir ([[ADR-0011]]) ve [[ADR-0045]] bu iki alanı ele almamıştı; devlet PID
  sağlayıcısına devirde alan kümesi farkı açık kalıyordu.
- **OpenID4VP 1.0 §5.1, §8.4, Ek B.3.3**: doğrulayıcı isteğe işlem verisi koyabilir; desteklemeyen cüzdan isteği reddetmek
  zorundadır. Tamga cüzdan çekirdeği alanı sessizce yok sayıyordu. ARF R36 ödeme onayı ve nitelikli imza için bu mekanizmayı ister.
- Proje yönetimi 2026-11-18'de dört maddenin yönünü seçti: alt anahtar türetmek, iki PID alanını eklemek, işlem verisini şimdi
  pakete koymak, kural kitabı bağlantısını AB adıyla eklemek.

# Karar

## K1 — Katalog girdisinde `rulebookURI`

- `catalogue.json` girdisi `rulebookURI` taşır: Tamga ARF sitesindeki kural kitabının adresi (`https://arf.tamga.network/...`).
  Kendi kural kitabı olmayan tür ana Tamga Rulebook'a bağlanır; eşlemesi olmayan tür katalog üretimini durdurur.
- Alan adı AB TS11'den alınır (yeni ad değildir). Yalnız katalog girdisindedir: tür metadata'sına ve imzalı listeye (`lotl.schemas[]`)
  girmez; `content_hash` değerleri değişmez.

## K2 — Uzun ömürlü anahtarla AES-GCM: her şifreleme tek kullanımlık anahtarla

- **Cüzdan deposu (`tws2`):** her yazımda 32 baytlık rastgele tuzla ana anahtardan HKDF-SHA-256 ile o yazıma özel alt anahtar türetilir;
  alt anahtar bir kez kullanıldığı için IV sabittir (12 sıfır bayt). Biçim `tws2.` + base64url(tuz ‖ şifreli metin ‖ etiket). Eski
  `tws1.` kayıtları yalnız okunur (telefonlardaki mevcut veri); bir sonraki yazımda `tws2`'ye geçer.
- **ZK yenileme belirteci:** JWE `A256KW` + A256GCM; her belirteç kendi rastgele içerik anahtarıyla şifrelenir ve o anahtar kimlik
  servisinin anahtarından HKDF ile ayrı türetilen sarma anahtarıyla sarılır (AES-KW, ACM §3.6). Belirteç başına IV yine rastgeledir; anahtar tek kullanımlık olduğu için IV tekrarı
  aynı anahtar altında oluşmaz. Bu karardan önce verilen `dir` belirteçleri yalnız açılır; belirteç her kullanımda yenilendiği için bu
  okuma yolu en geç eski belirteçlerin ömrü dolunca (2028-11-18) kaldırılır. Depoda tuz yazımdan önce uzunluk ve sıfır denetiminden geçer
  (sabit IV'nin güvenliği tuzun tekliğine bağlıdır).
- Kullanılan bütün yapı taşları (HKDF-SHA-256, AES-256-GCM, AES-KW) ACM v2'de "recommended"dır.

## K3 — Kimlik belgesinde `place_of_birth` ve `issuing_authority`

- `place_of_birth`: AB PID yapısı `{country?, region?, locality?}` (en az biri; metin ≤ 150 karakter, ülke ISO 3166-1 alpha-2). Yalnız
  kaynak belge doğum yerini taşıyorsa yazılır: kimlik doğrulama sağlayıcısının ya da çipin (ICAO 9303 DG11 `5F11`) verdiği serbest metin
  `locality` olarak; denetim ve biçim karakterleri (yön denetimi, sıfır genişlik) temizlenir, kesim kod noktasıyla yapılır. Çipte bu alan
  okunamazsa yalnız alan atlanır. Kaynakta yoksa alan yazılmaz ve belge yine verilir (Türkiye kimlik kartında çoğu zaman yoktur).
- `issuing_authority`: belgeyi veren geçici işletmecinin adı, `Tamga Network (provisional)`. Her ihraçta ve her kopya yenilemesinde
  yazılır; alandan önce verilmiş kopyalar yenilenince alır.
- İkisi de seçici açıklamalıdır; mdoc kopyasında aynı adla taşınır ([[ADR-0089]]). ZK kopyasının asgari öğelerine, eşleştirme
  anahtarlarına ve kayıtlara girmez.
- Şema geliştirme evresi kuralıyla yerinde düzeltilir ([[ADR-0029]]); iki alan da şemada isteğe bağlıdır. Tür metadata'sı değiştiği
  için `vct#integrity` özeti değişir: eski kopyalar doğrulayıcının katalog adımında yenilenene kadar reddedilir (kopyalar kısa ömürlüdür
  ve yenileme bu adımı kullanmaz). Dağıtım sırası: şema kataloğu → imzalı liste (`lotl.schemas[]`) → kimlik servisi; sıra tersse cüzdan
  yeni kopyayı katalog adımında reddeder. mdoc'ta yer bir CBOR haritasıdır; okuyucular onu düz nesneye çevirir ve iki kopyayı anahtar
  sırasından bağımsız karşılaştırır.

## K4 — İşlem verisi (`transaction_data`)

- **Cüzdan çekirdeği:** her öğe base64url JSON nesnesi olarak denetlenir: `type` ve boş olmayan `credential_ids` zorunlu; her kimlik
  istekteki bir `dc+sd-jwt` sorgusuna ait olmalı ve o sorgu kriptografik sahip bağını kapatamaz; `transaction_data_hashes_alg`
  verilmişse `sha-256` içermeli. Tanınmayan tek bir tür bile isteği reddeder (`invalid_transaction_data`). Tanınan türler çağıranın
  verdiği listedir ve **varsayılanı boştur**.
- Kişiye gösterilmemiş işlem verisi imzalanmaz: sunum ancak çağıran, kişiye gösterdiği öğelerle onayı kaydederse
  (`confirmTransactionData`) ve bu öğeler istekteki öğelerle aynıysa üretilir. Her öğe seçilen ilk uygun SD-JWT VC sunumuna bağlanır
  (OpenID4VP §5.1: birden çok `credential_ids` varsa yalnız biri kullanılır); bağlanamayan öğe varsa sunum yapılmaz. Boyut sınırları:
  en çok 10 öğe, öğe başına 8 KB, tekrar eden öğe reddedilir. Bir tür eklenirken türün kural belgesi "ekranda gösterilmeyen alan varsa
  reddet" kuralını taşır.
- **KB-JWT:** `transaction_data_hashes` = istekte gelen dizgilerin (base64url çözülmeden) SHA-256 özetleri; istek
  `transaction_data_hashes_alg` verdiyse KB-JWT `transaction_data_hashes_alg: "sha-256"` taşır (doğrulayıcı bu durumda alanı zorunlu
  tutar).
- **Doğrulayıcı:** istek oluşturucu `transaction_data` koyabilir; doğrulamada aynı dizgiler verilir, özetler eksiksiz ve fazlasız
  eşleşmelidir. Beklenmeyen özet de reddedilir; işlem verisi beklenip KB-JWT yoksa sunum reddedilir. Tamga profilinde mdoc sunumuna
  işlem verisi bağlanmaz (OpenID4VP mdoc için ayrı bir yol tanımlar; Tamga onu kullanmaz). Yanıt düzeyinde "her öğe en az bir sunuma
  bağlandı" denetimi ve DC API yolunda tür listesi ilk tür eklenirken yazılır.
- Ağ bir işlem türü tanımlamaz. Bir tür (ör. AB'nin ödeme ya da nitelikli imza türleri) ayrı kararla ve proje yönetiminin ad onayıyla
  eklenir.

# Değerlendirilen seçenekler

| Seçenek | Neden seçilmedi |
|---|---|
| Kural kitabı bağlantısını tür metadata'sına koymak | Bütün `content_hash` değerleri değişirdi; TS11 alanı katalog girdisinde tanımlar. |
| Rastgele IV'yi olduğu gibi bırakmak | Pratikte güvenli, ama ACM v2 Note 23/25'e harfiyen uymaz. |
| Depo için sayaçlı IV | Sayacın her yazımda kalıcı tutulması gerekirdi; yedekten dönüşte tekrar riski. |
| `place_of_birth`'ü zorunlu yapmak | Kaynak belgede yoksa kimlik belgesi hiç verilemezdi. |
| İşlem verisini e-imza işiyle birlikte yapmak | Proje yönetimi şimdi pakete koymayı seçti; ayrıca bugünkü "sessizce yok sayma" davranışı OpenID4VP'ye aykırıydı. |

# Değişmezler

| Kod | Kural |
|---|---|
| EA1 | Katalogdaki her türün `rulebookURI`'si vardır; alan tür metadata'sına girmez. |
| EA2 | Aynı uzun ömürlü anahtarla AES-GCM şifrelemesi yapılmaz: her şifreleme tek kullanımlık (türetilmiş ya da sarılmış) anahtarla yapılır. |
| EA3 | `place_of_birth` yalnız kaynak belgeden gelir, tahmin edilmez; `issuing_authority` her kimlik belgesi kopyasında bulunur. |
| EA4 | İşlem verisi taşıyan istekte cüzdan tanımadığı türü reddeder; kişiye gösterilmemiş işlem verisi imzalanmaz; ağ işlem türü tanımlamaz. |

# Sonuçlar

- Paketler (`schemas`, `sd-jwt`, `verifier`, `wallet-core`) ve kimlik servisi güncellenir. Tamga Wallet yeni davranışları bir sonraki
  paket sürümüyle alır.
- [[SPEC-SCHEMA-0001]] katalog alanı, [[SPEC-PROTO-0002]] işlem verisi bölümü, [[FW-RB-0003]] §4.6 eşleme tablosu ve [[ADR-0044]]
  belirteç tanımı bu karara atıf alır.
- Gizlilik metinlerinde kimlik belgesinin veri kategorilerine "doğum yeri (belgede varsa)" eklenir.

# Durum

**Accepted — 2026-11-18.** DECISIONS: D-ID-18, D-PROTO-6.
