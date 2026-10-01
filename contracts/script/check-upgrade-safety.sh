#!/usr/bin/env bash
# SPEC-BC-0001 §9 — UUPS brick koruması, CI zorunlu adımı.
#
# UUPS'te yükseltme mantığı IMPLEMENTASYONDADIR. _authorizeUpgrade içermeyen
# bir implementasyona yükseltirsen proxy KALICI OLARAK KİLİTLENİR ve geri
# dönüşü yoktur. Bu script o hatayı merge'den önce yakalar.
set -euo pipefail

echo "==> UUPS güvenlik denetimi"
fail=0

# Yükseltilebilir olması gereken kontratlar
UPGRADEABLE=(
  "src/governance/Governance.sol"
  "src/identity/RootCARegistry.sol"
  "src/schema/SchemaRegistry.sol"
  "src/registry/IssuerRegistry.sol"
  "src/registry/RelyingPartyRegistry.sol"
  "src/recognition/CrossRecognition.sol"
  "src/revocation/StatusListRegistry.sol"
)

for f in "${UPGRADEABLE[@]}"; do
  # 1) _authorizeUpgrade doğrudan ya da TamgaRegistryBase üzerinden gelmeli
  if grep -q "_authorizeUpgrade" "$f" || grep -q "TamgaRegistryBase" "$f"; then
    echo "  ✓ $f — yükseltme yetkisi tanımlı"
  else
    echo "  ✗ $f — _authorizeUpgrade YOK. Yükseltirsen proxy kilitlenir."
    fail=1
  fi

  # 2) constructor'da _disableInitializers olmalı (implementasyon ele geçirilemesin)
  if grep -q "_disableInitializers" "$f" || grep -q "TamgaRegistryBase" "$f"; then
    :
  else
    echo "  ✗ $f — _disableInitializers YOK. Implementasyon dogrudan initialize edilebilir."
    fail=1
  fi

  # 3) __gap olmalı (depolama düzeni genişletilebilir kalsın)
  if ! grep -q "__gap" "$f"; then
    echo "  ✗ $f — __gap YOK. Sonraki surumde yeni degisken eklenemez."
    fail=1
  fi
done

echo "==> Depolama düzeni anlık görüntüsü"
mkdir -p .storage
for f in "${UPGRADEABLE[@]}"; do
  name=$(basename "$f" .sol)
  forge inspect "$name" storageLayout > ".storage/$name.json" 2>/dev/null || true
done
echo "  .storage/ altına yazıldı — bir önceki sürümle karşılaştır (git diff)."
echo "  KURAL: mevcut slot'lar ASLA değişmez; yeni değişken SONA eklenir ve __gap azaltılır."

exit $fail
