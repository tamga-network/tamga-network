---
document_id: ADR-0067
title: "İstek nesnesinin her çekimi ayrı dal, ret yalnız kendi dalını kapatır"
status: Active
review_status: Completed
version: 1.0.0
created: 2026-10-29
last_updated: 2026-10-29
summary: >
  OpenID4VP 1.0'da cüzdanın hata yanıtı (ret) imzasızdır ve şifresiz gönderilebilir; yanıtı sunuma bağlayan tek şey `state`'tir.
  Tamga'da `state` istek nesnesindeydi ve istek nesnesini QR'daki adresten herkes çekebiliyordu: QR'ı gören biri sahte bir ret
  gönderip gerçek kişinin sunumunu "reddedildi"ye düşürebiliyordu. Karar: `request_uri`'nin her çekimi (GET ya da POST) ayrı bir
  çekim dalı açar — taze 128 bitlik `state`, taze `nonce` ve taze efemer şifreleme anahtarıyla yeni imzalı istek nesnesi (HAIP §5
  "her yetkilendirme isteğinde efemer anahtar"ın daha sıkı karşılığı); POST çekimde `wallet_nonce` geri yazılır. Ret (şifreli ya da
  şifresiz) yalnız kendi dalını kapatır; sunum bütünüyle yalnız tek dalı varsa ve o dal kapandıysa REJECTED olur, yoksa süresi
  bitene dek açık kalır ve ilk geçerli sunum kazanır. Çözülemeyen yanıt deneme sayılmaz; sunum başına en çok 10 dal. İmzalı ret
  reddedildi (standart dışı, ARF RPA_11 gizlilik ilkesine aykırı). Kabul: 2026-10-29 (proje yönetimi onayı).
domain: Protocol
related: ["[[ADR-0017]]", "[[ADR-0034]]", "[[ADR-0012]]", "[[SPEC-PROTO-0002]]", "[[SPEC-PROTO-0001]]", "[[SPEC-API-0001]]"]
---

# Kısaca

Bir sitede "Tamga Wallet ile göster" dediğinizde ekrandaki QR, cüzdanın isteği indirdiği bir adres taşır. Bu adresi QR'ı gören
herkes açabilir. Şimdiye kadar herkes aynı isteği alıyordu; içindeki oturum kodunu (`state`) bilen biri "kişi reddetti" diye
sahte bir cevap gönderip gerçek kişinin işlemini bozabiliyordu. Artık adres her açılışta yeni bir istek üretir: her açan kendi
oturum kodunu alır. Sahte bir ret yalnız sahtecinin kendi kopyasını kapatır; gerçek kişinin cüzdanı işlemi tamamlayabilir.

# Bağlam

- **Standart.** OpenID4VP 1.0 Final hata yanıtını kimlik doğrulamaz: §8.2 yanıt ucunun cevabını, §8.3.1 `direct_post.jwt`'de hata
  yanıtının şifresiz gönderilebileceğini (MAY) söyler; §14.5 (oturum sabitleme) ve güvenlik bölümleri hata yanıtı için imza ya da
  sahiplik kanıtı tanımlamaz. Hata yanıtını sunuma bağlayan yalnız `state`'tir.
- **Tamga'daki açık.** [[SPEC-PROTO-0002]] §10.1 (2026-10-24) reddi alınca sunumu kapatıyordu. `state` imzalı istek nesnesindeydi;
  istek nesnesi QR'daki `request_uri`'den kimlik doğrulamasız çekiliyor ve her çekimde aynı nesne veriliyordu. QR'ı gören (yanındaki
  kişi, kamera, ekran paylaşımı) nesneyi çekip `error=access_denied&state=…` göndererek gerçek kişinin sunumunu REJECTED'a
  düşürebiliyordu (hizmet engelleme; kişisel veri sızıntısı yok). Aynı örüntü kurumun belge verme servisindeki satır içi kimlik
  sunumunda da vardı ([[SPEC-PROTO-0001]] §11.2). Ek olarak, sunum kimliği QR'da açık olduğundan çözülemeyen beş anlamsız yanıt da
  sunumu deneme sınırıyla kapatabiliyordu.
- **AB'de durum (2026-10).** AB referans doğrulayıcısı, Credo ve walt.id ilk gelen (sahte olabilecek) reddi kabul edip oturumu
  kalıcı kapatır. Bunun bir AB çözümü yoktur; ama standart, her yetkilendirme isteği için efemer anahtar (HAIP §5) ve `request_uri`
  POST yöntemi (`wallet_nonce`, OpenID4VP 1.0 §5.10) tanımlar.
- **Proje yönetiminin yönü.** Avrupa'daki uygulamalara ve standardın olması gerektiğini söylediği yola bakılır; önerilen tasarım
  doğru yolsa o uygulanır.

# Karar

## K1 — Her çekim bir dal
`request_uri`'nin her çekimi (GET; ya da `request_uri_method=post` ile POST) bir **çekim dalı** açar: aynı içerikle (istemci
kimliği, DCQL, kayıt sertifikası, `response_uri`, bitiş zamanı) yeni imzalanmış istek nesnesi; **taze `state`** (≥ 128 bit
rastgele, gizli: QR'da, `request_uri` yolunda ve `response_uri` yolunda yer almaz), **taze `nonce`** ve **taze efemer yanıt
şifreleme anahtarı**. Anahtar kimliği dalı adlandırır (`enc-<sunum>.<dal>`). Sunum açılırken üretilen ilk istek nesnesi hiç
verilmez. POST çekimde cüzdanın `wallet_nonce`'u istek nesnesine geri yazılır (§5.10; `wallet_metadata` okunmaz); GET çalışmaya
devam eder. Bu, HAIP §5'in "her yetkilendirme isteğinde efemer anahtar" kuralının daha sıkı karşılığıdır.

## K2 — Yumuşak ret
Cüzdanın hata yanıtı (OpenID4VP 1.0 §8.4) — şifresiz form ya da şifreli JWE (§8.3.1), ikisi aynı işlenir — `state`'i hangi dalın
ise **yalnız o dalı** kapatır. Sunum bütünüyle **yalnız tek dalı varsa ve o dal kapandıysa** REJECTED olur (neden saklanmaz,
PV5). Birden çok çekim varsa sunum süresi bitene dek açık kalır; **ilk geçerli sunum** (sahiplik kanıtı geçen yanıt, §10.1)
kazanır. Kapanmış dala gelen sunum kabul edilmez. Yanıt ucu rete 200 döner (§8.2); retin `redirect_uri`'si veriye ya da sonuca
erişim veren hiçbir şey taşımaz (durum jetonu, kontrol görünümü anahtarı, yetki kodu yok). Kurumun satır içi kimlik sunumunda
çok dallı sunumdaki ret boş gövdeyle 200 alır; tek dallıda cüzdana `access_denied` yönlendirmesi döner (bugünkü gibi).

## K3 — Denemeler dal başına; çözülemeyen yanıt sayılmaz
Sahiplik kanıtına ulaşmadan başarısız olan, ama dalın anahtarıyla çözülmüş yanıtlar (state uyuşmazlığı, boş `vp_token`, A1–A6)
o dalın denemesidir; 5'te yalnız o dal kapanır (tek dallı sunumda sunum REJECTED). Hiçbir dalın anahtarıyla çözülemeyen yanıt
(dalsız ya da bilinmeyen `kid`, bozuk gövde) sunuma dokunmaz ve deneme sayılmaz: yalnız istek nesnesini alan şifreleyebilir.

## K4 — Sınırlar
Sunum başına en çok 10 dal; sonraki çekim 429 alır, var olan dallar etkilenmez. Kapanmış ya da süresi geçmiş sunum için dal açılmaz
(404). Uç ve sunum başına hız sınırları aynen sürer. Ret sayısı dal sayısıyla sınırlıdır.

## K5 — Tarayıcı yolu (DC API) ayrıdır
Digital Credentials API yolunda (`dc_api.jwt`, ISO/IEC 18013-7 Ek C) `request_uri` yoktur; istek nesnesi sunumu açan sayfaya gider
ve cevap sayfaya döner. DC API nesnesi bir dal değildir: `state`'iyle ret gönderilemez (ret DC API'nin kendi hata yoluyla döner),
deneme sınırı bu yolda sunum başınadır. Bu yolun bağlaması değişmez (köken + `nonce` + anahtar, [[SPEC-PROTO-0002]] §7).

## K6 — Durum API'si değişmez
`GET /presentations/{id}` sözleşmesi aynıdır (`PENDING` + `attempts` + `last_attempt`; sonuç). Dal bilgisi iç durumdur (izleme
kaydında "kaçıncı çekim" görünür; `state`, `nonce` yok).

# Değerlendirilen seçenekler

| Seçenek | Sonuç | Neden |
|---|---|---|
| İlk ret sunumu kapatır (AB referans doğrulayıcısı, Credo, walt.id) | ret | QR'ı gören herkes gerçek kişinin işlemini bozabilir |
| İmzalı ret (cüzdan reddi cihaz anahtarıyla imzalar) | ret | Standart dışı; reddin kimin cihazından geldiğini doğrulayıcıya bağlar — ARF RPA_11 (kişi reddettiğinde doğrulayıcı bir şey öğrenmemeli) ve PV5 ile çelişir; ret anahtarı hangi belgeye ait olsun sorusu yanıtsız |
| Ret hiç sunumu kapatmaz | ret | Tek cüzdanlı olağan akışta kişi "vermedim" dediğinde RP süre bitene dek bekler; kötü deneyim |
| **Her çekim ayrı dal + yumuşak ret (+ dal ve hız sınırları)** | **seçildi** | Standart içinde; sahte ret yalnız sahtecinin kendi dalını kapatır; olağan akışta (tek çekim) ret hemen görünür; OpenID uyum testindeki "istek iki kez çekilir" senaryosu ikinci dalla tamamlanır |
| Ret yalnız `request_uri_method=post` + `wallet_nonce` ile | ret (tek başına) | Cüzdanların çoğu GET kullanır; `wallet_nonce` saldırganın kendi çekiminde de olur. POST desteklenir ama koruma dallardan gelir |

# Kalan risk

Saldırgan QR'ı gerçek cüzdandan **önce** çekip hemen reddederse sunumun tek dalı vardır ve sunum REJECTED olur. Bu, QR'ı gören
birinin kendi belgesiyle de yanıt verebilmesi gibi, cihazlar arası akışın bilinen sınırıdır (OpenID4VP 1.0 §14); RP yeni sunum açar.
QR yalnız kişiye gösterilmeli, sunum süresi kısa tutulmalıdır (5 dk).

# Değişmezler

| Kod | Kural |
|---|---|
| RQ1 | `request_uri`'nin her çekimi (GET ya da POST) yeni bir çekim dalı açar: taze `state` (≥ 128 bit; QR'da, `request_uri` ve `response_uri` yolunda yok), taze `nonce` ve taze efemer şifreleme anahtarıyla yeni imzalı istek nesnesi; sunum açılırken üretilen ilk nesne verilmez. POST çekimde `wallet_nonce` geri yazılır; GET desteklenir. |
| RQ2 | Cüzdanın hata yanıtı (şifresiz ya da şifreli) yalnız `state`'inin ait olduğu dalı kapatır; sunum yalnız tek dalı varsa ve o dal kapandıysa REJECTED olur, yoksa süresi bitene dek açık kalır ve ilk geçerli sunum kazanır. Kapanmış dala gelen sunum kabul edilmez. |
| RQ3 | Rete yanıt 200'dür (OpenID4VP 1.0 §8.2); retin `redirect_uri`'si durum jetonu, kontrol görünümü anahtarı, yetki kodu ya da veriye erişim veren başka bir değer taşımaz. |
| RQ4 | Hiçbir dalın anahtarıyla çözülemeyen yanıt sunuma dokunmaz ve deneme sayılmaz; çözülmüş ama sahiplik kanıtına ulaşmayan yanıt yalnız kendi dalının denemesidir (5'te dal kapanır). |
| RQ5 | Sunum başına en çok 10 çekim dalı; sonrası 429 ve var olan dallar etkilenmez; kapanmış ya da süresi geçmiş sunumda dal açılmaz. |
| RQ6 | Digital Credentials API yolunun istek nesnesi bir dal değildir: `state`'iyle ret kabul edilmez, deneme sınırı bu yolda sunum başınadır. |

# Sonuçlar

- Kod: `@tamga-network/verifier` (`createRequestBranch`, `openPresentationResponse`; `responseKidOf` dalı okur; `state` 128 bit;
  paketler kaynakta 0.7.4, npm yayını yok); Tamga Verify (`apps/verify`: `GET|POST /vp/req/{id}`, dallar, yumuşak ret);
  kurumun belge verme servisi (satır içi kimlik sunumu, `/{slug}/vp/req/{id}` GET|POST). Cüzdan çekirdeği değişmez (GET ile çeker,
  reddi şifresiz gönderir).
- Belgeler: [[SPEC-PROTO-0002]] §3, §10.1, PV15; sunucuda doğrulama rehberi (kontrol listesi).
- OpenID uyum testi: doğrulayıcı test planında "istek iki kez çekilir" ve olağan akış yeniden koşulmalı.

# Durum

**Accepted — 2026-10-29.** Proje yönetimi onayıyla. DECISIONS: D-PROTO-5.
