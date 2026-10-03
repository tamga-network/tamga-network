---
document_id: ADR-0027
title: "İşlem günlüğünü dışa aktarma"
status: Active
version: 1.0.0
created: 2026-09-29
last_updated: 2026-10-02
summary: >
  SPEC-WALLET-0001/WL4 sunum günlüğünün cihazdan hiç çıkmamasını ister. AB (CIR 2024/2979 md. 9 ve 13, TS10) ise cüzdanın işlem
  günlüğünü ve taşıma nesnesini kişinin isteğiyle dışa aktarabilmesini zorunlu tutar. Karar: günlük yalnız kişinin kendi
  başlattığı, kendi parolasıyla şifreli (PBES2 + A128GCM) dışa aktarmada cihazdan çıkar; otomatik ya da Tamga sunucusuna asla.
  WL4 bu biçimde daraltıldı.
domain: Wallet
---

# Bağlam

SPEC-WALLET-0001 iki kural koyar:

- **WL4:** `presentation_log` cihazdan çıkmaz; yedeğe girmez.
- **WL2:** yedek belgeleri ve manifestoyu taşır, anahtarları taşımaz.

Gerekçe: hangi [[t:verifier|doğrulayıcıya]] ne gösterildiğinin kaydı kişinin davranış profilidir; bir sunucuda toplanırsa merkezî bir izleme
aracına dönüşür.

AB tarafında durum farklıdır:

- **CIR 2024/2979 md. 9 ve 13 ile [[t:ARF]] konu 34 (DASH_07, MIG_*):** cüzdan işlem günlüğünü tutar. Kişi günlüğü ve
  [[t:credential|belgelerinin]] listesini içeren bir **taşıma nesnesini** dışa aktarabilir ve yeni cüzdana aktarabilir.
- **TS10:** biçimi belirler — JSON veri modeli, parolayla şifreli JWE (`PBES2-HS256+A128KW` + `A128GCM`).

AB boşluk analizinde (H1, P5) bu eksik kaldı. Taşıma nesnesi kodu yazıldı (`wallet-core` `ts10.ts`), ancak WL4 kapalı bir karar
olduğu için günlük dosyaya **girmiyordu**; geçmiş ekranındaki günlük dışa aktarma düğmesi (DASH_07 için) de kapalıydı.

# Karar

## K1 — WL4'ün metni

Sunum günlüğü ve olay günlüğü cihazdan **yalnızca kişinin kendisinin başlattığı dışa aktarmada** çıkar:

- **TS10 taşıma dosyası:** kişinin seçtiği parolayla şifreli; en az 8 karakter; PBKDF2 en az 200 000 yineleme.
- **İşlem günlüğü dışa aktarımı:** TS10 §4.1; aynı şifreleme.

Dosya işletim sisteminin paylaşım menüsüyle kişinin seçtiği yere gider.

**Hiçbir koşulda:**
- otomatik ya da arka planda dışa aktarma yapılmaz,
- Tamga'nın ya da başka bir tarafın sunucusuna yükleme yapılmaz,
- sunucu tarafı yedek alınmaz (SPEC-WALLET-0001 §7.1 aynen kalır).

## K2 — İçerik sınırı

Dosyaya belge **değerleri**, kopyalar ve anahtarlar girmez. Günlükte yalnız şunlar bulunur:
- alan adları,
- doğrulayıcı ya da kurum bilgisi, [[t:trust-list|güven listesinden]],
- zaman ve sonuç.

Belgeler yeni cüzdanda kurumlardan yeniden alınır (WL2 aynen).

## K3 — Şifresiz dışa aktarma yok

Düz JSON günlük dışa aktarımı (`exportLog`) yoktur; günlük yalnız TS10 şifreli biçimde dışa aktarılır.

# Gerekçe / alternatifler

| Seçenek | Sonuç | Neden |
|---|---|---|
| WL4 aynen, günlük hiç dışa aktarılmaz | ret | AB zorunluluğu (CIR 2024/2979; TS10) karşılanmaz; kişi kendi verisine erişemez |
| Günlük Tamga sunucusunda şifreli yedek | ret | Merkezde davranış verisi birikir (şifreli olsa bile üst veri); WL4'ün amacına aykırı |
| **Yalnız kişinin başlattığı, kişinin parolasıyla şifreli dosya** | **kabul** | AB uyumu; veri kişinin kontrolünde, Tamga görmez |
| Düz JSON dışa aktarma | ret | Dosya paylaşım uygulamalarında açık kalır |

# Değişmezler

| Kod | Kural |
|---|---|
| LX1 | Günlük cihazdan yalnız kişinin başlattığı, kişinin parolasıyla şifreli (TS10 §5) dışa aktarmada çıkar; otomatik ya da sunucuya dışa aktarma yoktur. |
| LX2 | Dışa aktarılan günlükte ve taşıma dosyasında belge değeri, kopya ve anahtar bulunmaz. |

# Durum

**Accepted — 2026-09-29.** Proje yönetimi onayıyla (bekleyen kararlarda AB yaklaşımı). DECISIONS: D-WALLET-2.

Uygulama:
- SPEC-WALLET-0001 WL4 metni bu karara göre yazıldı,
- cüzdanda günlük dışa aktarımı açık (TS10 §4.1, parolalı),
- taşıma dosyası günlüğü içerir; içe aktarmada kişiye günlüğün geri yüklenip yüklenmeyeceği sorulur (ARF Mig_07b),
- düz JSON dışa aktarma yok.
