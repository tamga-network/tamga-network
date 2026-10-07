# Security Policy

**Bildirim:** security@tamga.network — lütfen kamuya açık issue açmayın. 72 saat içinde yanıt, 90 gün koordineli ifşa.

**Kapsam:** bu depo (`@tamga-network/*` paketleri, `apps/`, güven listesi biçimi, kontratlar) ve çalışan servisler:
`trust.tamga.network`, `schemas.tamga.network`, `status.tamga.network`, `issuer.tamga.network`, `verify.tamga.network`,
`id.tamga.network`, `console.tamga.network` ve sandbox test ağı (`sandbox.tamga.network`, `*.sandbox.tamga.network`). Ağ cüzdan işletmez (ADR-0042): Tamga Wallet ve cüzdan sağlayıcısı
(`provider.tamgawallet.com`) bu politikanın kapsamında değildir; onlarla ilgili bulguyu cüzdanın işletmecisine bildirin.

## Pilottan önce kapanacak bilinen kısayollar

Bunlar bilinçli ve kayıtlı kısayollardır; açık olarak bildirmeye gerek yok, ama etkilerini gösteren bir bulgu değerlidir.

- **Kurum imza anahtarı Tamga'nın geliştirme ortamında.** Pilotta anahtar kurumun kendi anahtar kasasına (KMS / HSM) geçer;
  eski sertifika iptal edilir.
- **Cüzdan anahtarları yazılımda** (geliştirme uygulaması). Telefonun güvenli donanımı (Secure Enclave / StrongBox) ve
  cihaz kanıtı (App Attest / Play Integrity) mağaza sürümüyle zorunlu olur (cüzdan sağlayıcısı kapsam dışıdır, yukarıya bakın).
- **Güven listesi tek imza anahtarıyla** yayınlanıyor; kaydırmalı ikinci anahtar pilottan önce eklenir.
- **Bağımsız güvenlik denetimi** henüz yapılmadı.

`ops/pki/` altındaki anahtarlar **yalnızca** geliştirme içindir; hiçbir üretim sisteminde kullanılmaz.

## Tasarım sınırları

Bu aşamada güven çapası tek operatörün imzasına dayanır (herkese açık çapa günlüğü geri sarmayı gösterir, ama önlemez);
iptal en geç yaklaşık 90 dakikada her doğrulayıcıya ulaşır; aynı kurumun belgeleri, doğrulayıcılar iş birliği yaparsa
ilişkilendirilebilir (sıfır bilgi ispatı doğrulayıcıda yayında, cüzdan tarafı telefon derlemesiyle gelir). Ayrıntı: whitepaper "Bilinen sınırlar".

## Tedarik zinciri

Paketlerde `postinstall` yok; npm yayını yalnızca CI üzerinden, OIDC ve provenance ile yapılır. Bağımlılık uyarıları
`npm audit` ile izlenir ve sürüm notlarında raporlanır.
