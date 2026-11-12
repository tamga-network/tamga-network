---
document_id: ADR-0078
title: "Cüzdan yedeği yok: taşınan tek şey taşıma dosyası"
status: Active
review_status: Completed
version: 1.0.0
created: 2026-11-12
last_updated: 2026-11-12
summary: >
  SPEC-WALLET-0001/WL2 "yedek belgeleri ve manifestoyu taşır" diyordu ve şartname, tohumdan türeyen bir anahtarla şifrelenip
  Tamga barındırmalı bir depoya yüklenebilen bir yedek tarif ediyordu. Böyle bir yedek hiç yapılmadı; ADR-0027 de sunucu tarafı
  yedeği yasaklıyor. Karar: yedek yapılmaz, şartname gerçeğe göre düzeltilir. Belgeler cihazdaki donanım anahtarına bağlıdır ve
  taşınmaz; yeni cihazda belgeler yeniden verilir. Cüzdanın taşıdığı tek şey, kişinin kendi başlattığı ve kendi parolasıyla
  şifrelediği AB TS10 taşıma dosyasıdır; dosya belge değeri ve anahtar içermez.
domain: Wallet
related: ["[[SPEC-WALLET-0001]]", "[[ADR-0027]]", "[[ADR-0031]]", "[[GUIDE-0005]]"]
---

# Kısaca

Cüzdandaki her belge, o telefonun güvenli donanımında üretilmiş ve oradan çıkamayan bir anahtara bağlıdır. Bu yüzden belge başka
bir telefona taşınamaz: taşınsa bile gösterilemez. Şartname yine de belgelerin bir "yedeğinden" söz ediyordu. Bu karar o yedeği
şartnameden çıkarır. Telefon değişince kişi belgelerini kurumlardan yeniden alır; cüzdan bunu kolaylaştırmak için yalnız "hangi
belgeleri yeniden almalıyım" listesini taşıyan şifreli bir dosya üretir.

# Bağlam

- [[SPEC-WALLET-0001]] §1.3 (WL1, WL2): belge sahibi anahtarları güvenli donanımdan çıkmaz; "yedek belgeleri ve manifestoyu
  taşır, anahtarları taşımaz". §1.4, §7.1 ve §7.2 bu yedeği tarif ediyordu: 24 kelimelik tohumdan türeyen anahtarla şifreli,
  belgelerin kendisini içeren ve Tamga barındırmalı bir depoya yüklenebilen bir dosya.
- Bu yedek yapılmadı. Referans cüzdanda tohum sözcükleri, yedek dosyası ve yedek sunucusu yoktur; ağ da cüzdan servisi işletmez.
- [[ADR-0027]] K1 "sunucu tarafı yedek alınmaz" der ve LX2 taşıma dosyasına belge değeri, kopya ve anahtar girmesini yasaklar.
  Şartnamenin §7.2'si ("barındırmalı depoya yüklenebilir") bu kararla çelişiyordu.
- Yedeğin faydası da sınırlıydı: geri yüklenen belge okunabilir ama gösterilemez (anahtarı yok). Karşılığında belge değerlerinin
  cihaz dışında bir kopyası oluşur: şifreli olsa bile sızıntı yüzeyidir ve boyutundan kaç belge olduğu anlaşılır.

# Karar

- **K1 — Yedek yok.** Cüzdan belgelerin, kopyaların ya da anahtarların yedeğini almaz; ne cihaz dışına ne bir sunucuya. Tohum
  sözcükleriyle kurtarma yoktur.
- **K2 — Belgeler taşınmaz, yeniden verilir.** Belgeler cihazdaki donanım anahtarına bağlıdır. Yeni cihazda her belge kurumundan
  yeniden alınır (yeni anahtarlar, yeni kopyalar).
- **K3 — Taşınan tek şey taşıma dosyasıdır.** Cüzdanın cihaz dışına çıkardığı tek kalıcı veri, AB TS10 taşıma dosyasıdır
  ([[SPEC-WALLET-0001]] §7.5): yeniden alınacak belgelerin listesi ve, kişi isterse, işlem günlüğü. Dosyayı kişi başlatır,
  kişinin parolasıyla şifrelenir ve kişinin seçtiği yere gider ([[ADR-0027]] LX1). Belge değeri, kopya ve anahtar içermez (LX2).
- **K4 — Değişen kural.** WL2'nin metni aşağıdaki gibi olur; WL4'ün "sunucu yedeğine girmez" ibaresi, artık var olmayan bir
  yedeğe atıf yaptığı için kaldırılır (kuralın kendisi değişmez).

| Kural | Eski metin | Yeni metin |
|---|---|---|
| SPEC-WALLET-0001/WL2 | Yedek belgeleri ve manifestoyu taşır; anahtarları taşımaz — cihaz değişiminde belgelerin yeniden verilmesi gerekir. | Cüzdan belgelerin yedeğini almaz: belgeler cihazdaki donanım anahtarına bağlıdır ve taşınmaz; cihaz değişiminde belgeler yeniden verilir. Cüzdanın cihaz dışına taşıdığı tek şey kişinin başlattığı taşıma dosyasıdır (AB TS10); dosya belge değeri, kopya ve anahtar içermez. |

# Değerlendirilen seçenekler

| Seçenek | Sonuç | Neden |
|---|---|---|
| Şartnamedeki yedeği yazmak (tohum + şifreli yedek + barındırmalı depo) | ret | Geri yüklenen belge gösterilemez; belge değerlerinin cihaz dışında kopyası oluşur; ağ cüzdan servisi işletmez; [[ADR-0027]] K1 ile çelişir |
| Yalnız cihazda kalan yerel yedek | ret | Aynı fayda taşıma dosyasıyla, belge değeri taşımadan sağlanıyor |
| **Yedek yok; taşıma dosyası** | **kabul** | Uygulanan durum; AB taşıma kuralıyla (TS10) uyumlu; cihaz dışına belge değeri çıkmaz |

# Sonuçlar

- [[SPEC-WALLET-0001]]: özet, §1.3 (WL2), §1.4, §2.1, §7.1–§7.4, §8 (WL2, WL4 ibaresi), güvenlik notları ve açık konular
  düzeltildi. WL10 (Tamga kurtarma anahtarı tutmaz) aynen kalır.
- Kod değişikliği yok: `@tamga-network/wallet-core` yedek üretmez; taşıma dosyası `ts10.ts` ile üretilir.
- Uyumlu cüzdanlar için kural aynıdır: belge değerini cihaz dışına çıkaran bir yedek özelliği WL2'ye aykırıdır.
- Site takma ad tohumu ([[ADR-0031]]) bu kararın konusu değildir: cihazın güvenli deposunda kalır, taşıma dosyasına girmez
  (WL15) ve kimlik yeniden doğrulanınca aynı değer yeniden türer.

# Durum

**Accepted — 2026-11-12.** Proje yönetiminin onayıyla (2026-11-12). DECISIONS: D-WALLET-4. Değişen kural: SPEC-WALLET-0001/WL2.
