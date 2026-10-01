# Contributing

Bu depo Tamga Network'ün açık kaynak kodunu ve kanonik belgelerini taşır. Kod ve belgeler birlikte evrilir: kararlar önce belgelenir (ADR), sonra uygulanır.

---

# Katkı Felsefesi

Tamga Network **Documentation-Driven Engineering** izler. Dokümantasyon yazılımın bir parçasıdır.

Her katkı şunlardan en az birini iyileştirmelidir:
- açıklık (clarity)
- doğruluk (correctness)
- tutarlılık (consistency)
- mühendislik kalitesi
- sürdürülebilirlik (maintainability)

---

# Doğru Katmanı Seç

| Katman | Amaç |
|--------|------|
| `docs/project-memory/` | Tarihsel mühendislik gerekçesi (neden) |
| `docs/architecture/` | Mimari vizyon ve prensipler (ne) |
| `docs/specifications/` | Teknik spesifikasyon (nasıl) |
| `docs/research/` | Dış teknoloji analizi |
| `docs/academy/` | Öğrenme materyali |
| `docs/adr/` | Kabul edilmiş kararlar |
| `docs/rfc/` | Öneriler |

Katkını doğru konuma yerleştir. Katman sınırlarını karıştırma.

---

# Yazım İlkeleri

Her doküman:
- problemi açıklar
- gerekçeyi açıklar
- alternatifleri açıklar
- desteksiz görüşten kaçınır
- mümkünse kaynak gösterir
- `DOCUMENTATION-STANDARD.md`'deki YAML front matter'ı içerir

---

# Bir Doküman Tamamlandığında

1. `review_status`'u `Completed` yap.
2. `MASTER_INDEX.md`'i güncelle.
3. İlgili dokümanlara çapraz referans ekle.

---

# Kod

Kod `packages/` (npm paketleri `@tamga-network/*`) ve `apps/` (cüzdan, verifier, wallet-provider, trust-publisher)
altındadır. Kod, test, adlandırma, commit ve sürüm kuralları: [`CONVENTIONS.md`](CONVENTIONS.md). Değişiklikler
[`CHANGELOG.md`](CHANGELOG.md)'ye yazılır.

---

# Dil

İçerik Türkçe, dosya adları ve metadata İngilizce yazılır.
