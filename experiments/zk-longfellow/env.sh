# Yalnız bu kabuk oturumu için: kullanıcı klasörüne kurulu araçlar (sistem PATH'i değişmez).
#   source experiments/zk-longfellow/env.sh
export PATH="$HOME/.cargo/bin:$PATH:$HOME/tools/w64devkit/bin"
export CC=gcc AR=ar
# Derleme çıktısı Türkçe karakterli yoldan uzakta (bazı araçlar boşluk/Unicode yolda sorun çıkarır).
export CARGO_TARGET_DIR="$HOME/tools/lf-target"
export RUSTFLAGS="-C link-self-contained=yes"
