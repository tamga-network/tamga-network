---
document_id: ADR-0054
title: "Zincirde şema ad alanı, devletler arası bağ ve kota kapsamı"
status: Active
review_status: Completed
version: 1.0.0
created: 2026-10-19
last_updated: 2026-10-19
summary: >
  Üç kontrat kuralı kesinleşir. (1) Ağ şemasıyla ulusal şemanın adları çakışamaz: ulusal şemanın `vct`'si ADR-0010'daki devlet-özel
  biçimde olmak zorundadır (`urn:tamga:<cc>:<alan>:<Tür>:<ana sürüm>`, `<cc>` kaydı yapan devletin küçük harfli kodu); ağ şeması
  bu biçimde olamaz. Böylece bir devlet, oylanmakta olan bir ağ şemasının adını kendi ulusal şeması olarak kapamaz. (2) Bir kurum
  yalnız kendi devletinin kök sertifikasına bağlanır ve yalnız kendi devletinden bir halef gösterebilir. (3) Kotalar: devlet başına
  günlük yazma tavanı her kayıt kontratında ayrı sayılır; durum listesi yayın tavanı liste başınadır ve kurum başına günlük yeni
  liste kaydı sınırlanır. SPEC-BC-0001 §2–§4, §7 ve §12.2 bu kurallara göre güncellenir. Kabul: 2026-10-19.
domain: Trust
related: ["[[ADR-0002]]", "[[ADR-0007]]", "[[ADR-0008]]", "[[ADR-0010]]", "[[ADR-0051]]", "[[SPEC-BC-0001]]", "[[SPEC-SCHEMA-0001]]", "[[SPEC-CRED-0003]]"]
---

# Kısaca

Zincir kontratlarında güvenlik turunun açık bıraktığı üç kural boşluğu kapanır. Ağ ve devlet şemalarının adları ayrı ad alanlarında
durur; bir kurum başka bir devletin kök sertifikasına ya da kurumuna bağlanamaz; kota sayaçlarının neyi saydığı şartnamede ve kodda
aynı olur.

# Bağlam

- **Şema adı kapma (F-11).** `schemaId = keccak256(vct)` tek, ortak bir ad alanıdır ([[ADR-0010]], [[SPEC-SCHEMA-0001]] §5.1).
  Bir ağ şeması Governance'ta oylanırken herhangi bir devletin delegesi aynı `vct`'yi kendi ulusal şeması olarak kaydedebilir; ağ
  şemasının yürütmesi o andan sonra hep `SchemaExists` ile düşer ve kapan devlet ağ şemasına benzeyen bir kaydın sahibi olur.
  [[ADR-0010]] bu iki ad alanını zaten ayırır: ağ türü `urn:tamga:<alan>:<Tür>:<ana sürüm>`, devlet-özel tür
  `urn:tamga:<cc>:<alan>:<Tür>:<ana sürüm>`. Kontrat bu ayrımı denetlemiyordu.
- **Devletler arası bağ (F-12).** Bir kurum başka bir devletin kök sertifikasına bağlanabiliyordu (o devletin askı ya da iptali
  kurumun doğrulamadaki ilk adımını yönetir hâle gelir) ve başka devletten bir kurum halef gösterilebiliyordu (o kurumun anahtarları
  öncülün durum listelerini yayınlayıp emekliye ayırabilir). Şartname bu konuda sessizdi.
- **Kota kapsamı (F-07 kalanı, F-10).** Şartname §12.2 "devlet başına günde 10 000 yazma" ve "kurum başına günde 48 yayın" der.
  Kod ilk sayacı her kayıt kontratında ayrı tutar; ikinci sayacı liste başına tutar ve yeni liste kaydını sınırlamaz, yani tavan yeni
  liste açarak aşılabilir. Kurum başına 48 yayın ise birden çok listesi olan büyük bir kurumu saatlik yayından alıkoyardı.
- Proje yönetimi 2026-10-19'da güvenlik turunun önerilerini onayladı.

# Karar

## K1 — Şema ad alanları ayrıdır

- **Ulusal şema** (`NATIONAL`): `vctURI` tam olarak `urn:tamga:<cc>:<alan>:<Tür>:<ana sürüm>` biçimindedir — `<cc>` kaydı yapan
  devletin kodudur (ISO 3166-1 alpha-2, küçük harf; `TR` → `tr`), ardından boş olmayan üç bölüm gelir. Biçime uymayan kayıt
  reddedilir (`NationalVctOutsideNamespace`).
- **Ağ şeması** (`NETWORK`): `vctURI` devlet-özel biçimde (herhangi bir iki harfli kodla) **olamaz** (`NetworkVctInNationalNamespace`);
  Governance bu denetimi öneri anında da yapar, biçime uymayan öneri açılmaz. Ağ şeması için başka bir biçim zorunlu tutulmaz
  (ör. AB türleri ağ şeması olarak kaydedilebilir).
- İki ad alanı ayrık olduğu için bir ulusal kayıt bir ağ şemasının adını hiçbir zaman alamaz; öneri anında ad ayırmaya (rezervasyon)
  gerek kalmaz.

## K2 — Kurum yalnız kendi devletine bağlanır

- `registerIssuer`: kurumun kök sertifikası (`parentCA`) kurumla aynı devletin kaydı olmalıdır.
- `revokeIssuer`: gösterilen halef (`successorId`) aynı devletin kurumu olmalıdır.
- İkisi de `CrossStateReference` ile reddedilir. Bir devletin kayıtlarını yalnız o devletin anahtarları etkiler ([[SPEC-BC-0001]]
  N1, [[ADR-0002]] Katman 2).

## K3 — Kotaların kapsamı

- **Devlet başına günlük yazma** (`MAX_WRITES_PER_STATE_PER_DAY = 10 000`): her kayıt kontratı kendi sayacını tutar; bir devletin bir
  gündeki toplam ulusal yazımı kayıt kontratı sayısıyla sınırlıdır (bugün beş kontrat). Kontratlar arası ortak sayaç ek çağrı ve
  ortak durum gerektirirdi; amaç olan spam sınırı kontrat başına sayaçla da doğrusal kalır.
- **Durum listesi yayını** (`MAX_PUBLISH_PER_DAY = 48`): **liste başına** günlük tavandır (24 saatlik yayın + yeniden deneme payı).
- **Yeni liste kaydı:** kurum başına günde en çok 8 (`MAX_LIST_REGISTRATIONS_PER_ISSUER_PER_DAY`). Böylece yayın tavanı yeni liste
  açarak aşılamaz; birden çok listesi olan kurum her listesini saatlik yayınlayabilir. Aşım `ListRegistrationQuotaExceeded` ile
  reddedilir.

# Değerlendirilen seçenekler

| Seçenek | Sonuç | Neden |
|---|---|---|
| Ağ şeması önerisi açılınca adını ayırmak (rezervasyon) | ret | Öneri öncesi kapmayı engellemez (iyi bilinen adlar önceden kapılabilir); süresi dolan önerinin ayrımını kaldırmak için ek durum ve temizlik gerekir |
| `schemaId`'ye katman ya da devlet kodunu katmak | ret | `schemaId = keccak256(vct)` değişmez ([[ADR-0010]]); doğrulayıcı ve katalog aynı kimliği kullanır |
| Ulusal biçimi zorlamak, ağ biçimini serbest bırakmak (ağ şemasını denetlememek) | ret | Ağ şeması devlet-özel biçimde kaydedilirse ad alanları yeniden çakışır |
| Devletler arası bağa "onaylı" istisna (karşı devletin rızası) | ret (şimdilik) | Bugün gerçek bir kullanım yok; rıza akışı yeni bir yetki yolu açar. Gerekirse ayrı ADR |
| Kurum başına 48 yayın (şartnamenin eski metni) | ret | Birden çok listesi olan kurumu saatlik yayından alıkoyar |
| Kontratlar arası ortak devlet sayacı | ret | Ek çağrı ve ortak durum; spam sınırı kontrat başına sayaçla da korunur |

# Değişmezler

| Kod | Kural |
|---|---|
| NS1 | Ulusal şemanın `vct`'si `urn:tamga:<cc>:<alan>:<Tür>:<ana sürüm>` biçimindedir ve `<cc>` kaydı yapan devletin kodudur; ağ şemasının `vct`'si bu biçimde olamaz. |
| NS2 | Kurumun kök sertifikası ve halefi kurumla aynı devlete aittir. |
| NS3 | Devlet başına günlük yazma tavanı her kayıt kontratında ayrı sayılır; durum listesi yayın tavanı liste başınadır; kurum başına günlük yeni liste kaydı sınırlıdır. |

# Sonuçlar

- `contracts/src/schema/VctNamespace.sol` (biçim denetimi, Governance ve SchemaRegistry ortak kullanır); `SchemaRegistry`,
  `Governance.proposeNetworkSchema`, `IssuerRegistry.registerIssuer` / `revokeIssuer`, `StatusListRegistry.registerList`; testler.
  Depolama düzeni yalnız sona ekleme.
- [[SPEC-BC-0001]] §3.1, §4.3, §4.4, §7, §12.2 ve §13 sürüm notuyla güncellenir.
- DECISIONS: **D-BC-9**.

# Durum

**Accepted — 2026-10-19.** Proje yönetimi onayıyla. DECISIONS: D-BC-9. NS1–NS3 bağlayıcıdır; [[ADR-0010]]'daki `vct` biçimi
kontratta zorunlu hâle gelir, hiçbir ADR kararı değişmez.
