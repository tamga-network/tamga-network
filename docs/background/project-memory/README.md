# Project Memory

**Cevapladığı soru:** *Neden bu kararı verdik?*

Bu katman Tamga Network'ün mühendislik gerekçesini korur. Kararların sonuçlarını değil, **arkasındaki düşünceyi, alternatifleri ve ödünleşimleri** kaydeder.

---

# İçerik

Project Memory bir spesifikasyon değildir. Şunları içerir:
- problemin tanımı
- değerlendirilen alternatifler
- neden bazı yaklaşımların reddedildiği
- seçilen yönün gerekçesi
- kararın gelecekte nasıl evrilebileceği

Sistemin *nasıl* çalıştığı buraya değil, `docs/specifications/`'a yazılır.

---

# Document ID

```text
PM-<DOMAIN>-<NUMBER>
```

Örnek: `PM-PH-0001`, `PM-ID-0001`, `PM-TRUST-0001`

---

# Domainler (Planlı)

| Domain | Klasör | Durum |
|--------|--------|-------|
| Philosophy | `philosophy/` | In Progress (PM-PH-0001 draft) |
| Identity | `identity/` | In Progress (PM-ID-0001 draft) |
| Trust | `trust/` | In Progress (PM-TRUST-0001 draft) |
| Blockchain | `blockchain/` | In Progress (PM-BC-0001 draft) |
| Governance | `governance/` | Not Started |

---

# Kararlı Başlık Yapısı

```text
Giriş · Problem · Evrim · Mimari · İlişkiler · Araştırma · Gelecek · Sonuç · İlgili Dokümanlar · Durum
```

Bkz. `CONTRIBUTING.md` (Belgeler).
