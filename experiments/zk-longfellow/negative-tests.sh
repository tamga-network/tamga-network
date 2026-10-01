#!/usr/bin/env bash
# Deney: negatif testler (gen-fixtures.ts + tamga-zk prove sonrası). Her satır: beklenen ve gerçek sonuç.
set -u
cd "$(dirname "$0")/out"
Z=${TAMGA_ZK_BIN:-$HOME/tools/lf-target-native/release/tamga-zk.exe}; C=circuit-v8-1.zst; T=tamga
python - <<'PY'
import json
m=json.load(open("tamga/meta.json"))
json.dump({**m,"valueCborHex":"f4"},open("tamga/meta-claimfalse.json","w"))
json.dump({**m,"docType":"org.iso.18013.5.1.mDL"},open("tamga/meta-otherdoctype.json","w"))
json.dump({**m,"namespace":"org.iso.18013.5.1"},open("tamga/meta-otherns.json","w"))
p=bytearray(open("tamga/proof.bin","rb").read()); p[len(p)//2]^=1; open("tamga/proof-flipped.bin","wb").write(p)
PY
t(){ want=$1; label=$2; shift 2; "$@" >/dev/null 2>&1; got=$([ $? -eq 0 ] && echo KABUL || echo RED); mark=$([ "$got" = "$want" ] && echo ✓ || echo ✗); printf "%s %-55s beklenen %-5s gerçek %s\n" "$mark" "$label" "$want" "$got"; }
t KABUL "geçerli ispat"                                   $Z verify $C $T/transcript.bin $T/meta.json $T/proof.bin
t RED   "değeri kurcalanmış mdoc ile ispat üretimi"      $Z prove  $C $T/tampered.bin $T/transcript.bin $T/meta.json $T/x.bin
t RED   "yanlış issuer anahtarıyla doğrulama"            $Z verify $C $T/transcript.bin $T/meta-wrongkey.json $T/proof.bin
t RED   "yanlış issuer anahtarıyla ispat üretimi"        $Z prove  $C $T/mdoc.bin $T/transcript.bin $T/meta-wrongkey.json $T/x.bin
t RED   "başka oturumun transcript'iyle doğrulama"       $Z verify $C $T/transcript-other.bin $T/meta.json $T/proof.bin
t RED   "başka transcript ile ispat (cihaz imzası tutmaz)" $Z prove $C $T/mdoc.bin $T/transcript-other.bin $T/meta.json $T/x.bin
t RED   "age_over_18=false belgeden 'true' ispatı"       $Z prove  $C tamga-false/mdoc.bin tamga-false/transcript.bin tamga-false/meta.json $T/x.bin
t RED   "geçerli ispatı 'false' iddiasıyla doğrulama"    $Z verify $C $T/transcript.bin $T/meta-claimfalse.json $T/proof.bin
t RED   "başka docType ile doğrulama"                    $Z verify $C $T/transcript.bin $T/meta-otherdoctype.json $T/proof.bin
t KABUL "başka namespace ile doğrulama (namespace bağlı DEĞİL)" $Z verify $C $T/transcript.bin $T/meta-otherns.json $T/proof.bin
t RED   "tek biti bozulmuş ispat"                        $Z verify $C $T/transcript.bin $T/meta.json $T/proof-flipped.bin
