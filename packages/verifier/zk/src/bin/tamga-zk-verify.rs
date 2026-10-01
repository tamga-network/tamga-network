//! Longfellow ZK mdoc doğrulayıcısı — yerel (native) alt süreç (ADR-0032 Aşama 3, hızlı arka uç).
//!
//! `@tamga-network/verifier` (`NativeZkBackend`) bunu bir kez başlatır ve istekleri sırayla gönderir:
//!   stdin : her istek `u32 LE uzunluk + tampon` (tampon biçimi = WASM `tz_verify`; bkz. src/lib.rs)
//!   stdout: her isteğe `i32 LE sonuç kodu` (0 = geçerli)
//! Ağ yok, dosya yok, durum yok: yalnız stdin → stdout. stdin kapanınca çıkar.
//!   tamga-zk-verify --info  → {"circuit_version":…,"specs":…} (sağlık denetimi)
use std::io::{self, Read, Write};

// Kütüphane yalnız cdylib (WASM çıktısı bayt bayt sabit kalsın diye rlib eklenmez); aynı kaynak burada modül olarak derlenir.
#[path = "../lib.rs"]
#[allow(dead_code)]
mod lib;

const MAX_REQUEST: usize = 16 * 1024 * 1024; // devre (~300 KB) + ispat (~350 KB) için bol; aşırı büyük çerçeve = kapat

fn main() {
    if std::env::args().any(|a| a == "--info") {
        println!(
            "{{\"circuit_version\":{},\"specs\":{}}}",
            mdoc_zk_runtime::CURRENT_VERSION,
            mdoc_zk_runtime::CURRENT_ZK_SPECS.len()
        );
        return;
    }
    let stdin = io::stdin();
    let stdout = io::stdout();
    let mut input = stdin.lock();
    let mut output = stdout.lock();
    let mut len = [0u8; 4];
    loop {
        if input.read_exact(&mut len).is_err() {
            return; // stdin kapandı
        }
        let n = u32::from_le_bytes(len) as usize;
        if n > MAX_REQUEST {
            std::process::exit(2);
        }
        let mut buf = vec![0u8; n];
        if input.read_exact(&mut buf).is_err() {
            return;
        }
        let code = lib::verify_buffer(&buf);
        if output.write_all(&code.to_le_bytes()).and_then(|_| output.flush()).is_err() {
            return;
        }
    }
}
