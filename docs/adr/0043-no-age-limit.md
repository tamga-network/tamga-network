---
document_id: ADR-0043
title: "Yaş sınırı yok: AB yaklaşımı"
status: Active
version: 1.0.0
created: 2026-10-08
last_updated: 2026-10-08
summary: >
  Tamga Network yaş sınırı koymaz: ne ağda listelenen cüzdanlar için ne de ağın kimlik servisi (kimlik belgesi) için.
  eIDAS 2.0 Avrupa Dijital Kimlik Cüzdanı için asgari yaş öngörmez; ağ AB çerçevesine uyar. Cüzdanı ağda kullanmanın şartı
  geçerli bir kimlik belgesiyle kimlik doğrulamasıdır, yaş değil. Ağdaki cüzdanlar kendi hukukları başka türlüsünü
  gerektirmedikçe aynı yaklaşımı izler; kendi belgelerinde uygunluğu (ör. öğrenci kartı) belge veren belirler. Çocuklar için
  veli onayı akışı (GDPR m. 8, Türk hukuku) ve kimlik doğrulama sağlayıcısının sınırları sonraki iş olarak kaydedilir.
domain: Identity
---

# Kısaca

Tamga Network'te yaş sınırı yoktur. Cüzdanı kullanmak için gereken şey yaş değil, geçerli bir kimlik belgesiyle kimlik
doğrulamasıdır. Bir belgeyi kimin alabileceğine (ör. öğrenci kartı) o belgeyi veren kurum karar verir.

# Bağlam

- eIDAS 2.0 (Tüzük (AB) 2024/1183) Avrupa Dijital Kimlik Cüzdanı için asgari yaş öngörmez; üye devletler cüzdanı
  vatandaşlarına sunar. Tamga Network AB çerçevesine uyar ([[ADR-0035]]).
- Ağda bir cüzdanı kullanmak, ağın kimlik servisinde ([[ADR-0011]], [[SPEC-ID-0003]] §9) geçerli bir kimlik belgesiyle kimlik
  doğrulaması gerektirir. Kimlik belgesi küçük yaştaki kişilere de verilir.
- Ağın kurallarında, şartnamelerinde ve çerçeve belgelerinde bugüne kadar bir yaş sınırı yazılmadı; "18 yaşından büyüğüm"
  yalnızca doğrulayıcının sorabildiği bir bilgidir (`age_over_18`, [[ADR-0032]]), cüzdanı kullanma şartı değildir.

# Karar

**K1 — Ağ yaş sınırı koymaz.** Ne ağda listelenen cüzdanlar için (güven listesine kayıt şartı olarak) ne de ağın kimlik
servisi ve verdiği kimlik belgesi için asgari yaş vardır. Şart, geçerli bir kimlik belgesiyle kimlik doğrulamasıdır.

**K2 — Ağdaki cüzdanlar aynı yaklaşımı izler.** Ağda listelenen cüzdanlar, kendi hukukları başka türlüsünü gerektirmedikçe yaş
sınırı koymaz. Bir cüzdanın hukuku sınır gerektiriyorsa o sınır o cüzdanın kendi kuralıdır; ağın kuralı sayılmaz.

**K3 — Belge türüne uygunluğu belge veren belirler.** Bir kurum kendi belgesini kime vereceğini (ör. öğrenci kartı yalnız kayıtlı
öğrenciye) kendi kayıtlarına göre belirler. Yaşa bağlı bir hizmet, doğrulayıcı olarak yalnız gereken bilgiyi ister (ör.
`age_over_18`).

# Değişmezler

| Kod | Kural |
|---|---|
| YS1 | Ağ, cüzdanların güven listesine kaydı için ve kimlik servisinin kimlik belgesi vermesi için asgari yaş şartı koymaz. |
| YS2 | Bir belgeyi kimin alabileceğini o belgenin belge vereni belirler; yaşa bağlı doğrulama, doğrulayıcının yalnız gereken bilgiyi istemesiyle yapılır. |

# Gerekçe / alternatifler

| Seçenek | Sonuç | Neden |
|---|---|---|
| Ağ genelinde 18 yaş sınırı | ret | AB çerçevesinde yoktur; öğrenci, sporcu, etkinlik gibi küçük yaştakilerin de kullandığı belgeleri dışarıda bırakır. |
| Ağ genelinde 13 ya da 16 yaş sınırı | ret | GDPR m. 8 bir yaş sınırı değil, rızaya dayalı hizmette veli onayı kuralıdır; sınırı koymak ağın değil, gerekirse hukukun işidir. |
| **Yaş sınırı yok; uygunluğu belge veren belirler** | **kabul** | AB yaklaşımıyla aynı; şart kimlik doğrulamasıdır. |

# Sonuçlar ve açık konular

- Bugün kod değişikliği yoktur: kimlik servisi ve güven listesi kayıt kuralları yaş denetlemiyordu. Kimlik rulebook'u
  ([[FW-RB-0003]] §3) ve kimlik doğrulama şartnamesi ([[SPEC-ID-0003]] §9) bu kararı anar.
- **Sonraki iş — veli onayı:** GDPR m. 8, rızaya dayalı bilgi toplumu hizmetinde 16 yaş altı çocuk için veli onayı ister (üye
  devletler bu yaşı 13'e kadar indirebilir). Türk hukukunda KVKK özel bir yaş koymaz; 18 yaş altında fiil ehliyeti sınırlıdır.
  Kimlik servisinin aydınlatma ve açık rıza akışı için veli onayı akışı gerekebilir; hukuki inceleme sonrası ayrı kararla ele
  alınır, bugün uygulanmaz.
- **Sonraki iş — sağlayıcı sınırı:** uzaktan kimlik doğrulama sağlayıcısının (referans: Didit) küçük yaştaki kişiler için kendi
  sınırı ya da koşulu olup olmadığı henüz teyit edilmedi; teyit edilecek ve gerekiyorsa [[SPEC-ID-0003]]'e işlenecek.

# Durum

**Accepted — 2026-10-08** (proje yönetimi onayı; birebir alıntı özel onay kaydında). DECISIONS: D-ID-10.
