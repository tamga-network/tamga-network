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

| Klasör | Ne için |
|--------|--------|
| `docs/guides/` | Başlarken: adım adım rehberler (GUIDE-*) |
| `docs/concepts/` | Kavramlar: sade anlatım |
| `docs/specifications/` | Şartnameler: kesin kurallar (SPEC-*) |
| `docs/adr/` | Kararlar (ADR-*) |
| `docs/architecture/` | Bileşen mimarisi (ARCH-*) |
| `docs/framework/` | Tamga ARF ve ekleri (FW-*) |
| `docs/background/` | Gerekçe (PM-*) ve araştırma (RS-*) |
| `docs/ledger/` | Zincir aşaması (bugün kullanılmıyor) |

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

1. Sürümü ve `last_updated`'i güncelle; değişikliği `CHANGELOG.md`'ye yaz.
2. İngilizce çeviriyi (`docs/en/…`) aynı çalışmada güncelle.
3. `npm run docs:index` ve `node scripts/sync-invariants.mjs` çalıştır.

---

# Kod

Kod `packages/` (npm paketleri `@tamga-network/*`) ve `apps/` (verify, trust-publisher)
altındadır. Ağ cüzdan sağlayıcı işletmez (ADR-0042); Tamga Wallet'ın cüzdan sağlayıcısına yapılacak değişiklik cüzdanın kendi
deposuna gider. Kod, test, adlandırma, commit ve sürüm kuralları: [`CONVENTIONS.md`](CONVENTIONS.md). Değişiklikler
[`CHANGELOG.md`](CHANGELOG.md)'ye yazılır.

---

# Dil

İçerik Türkçe, dosya adları ve metadata İngilizce yazılır.
