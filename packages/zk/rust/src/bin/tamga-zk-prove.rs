//! Longfellow ZK mdoc ispatçısı — masaüstü alt süreç (`@tamga-network/zk/node`). Test, uyum denemesi ve geliştirme içindir;
//! telefonda aynı kod yerel kütüphane olarak çalışır (src/lib.rs, C ABI).
//!   stdin : her istek `u32 LE uzunluk + tampon` (tampon biçimi: src/lib.rs)
//!   stdout: `i32 LE kod` (0 = başarı) + başarıda `u32 LE uzunluk + ispat`
//!   tamga-zk-prove --info  → {"circuit_version":…}
use std::io::{self, Read, Write};

const MAX_REQUEST: usize = 16 * 1024 * 1024;

fn main() {
    if std::env::args().any(|a| a == "--info") {
        println!("{{\"circuit_version\":{}}}", tamga_zk_prover::tzp_circuit_version());
        return;
    }
    let (stdin, stdout) = (io::stdin(), io::stdout());
    let (mut input, mut output) = (stdin.lock(), stdout.lock());
    let mut len = [0u8; 4];
    loop {
        if input.read_exact(&mut len).is_err() {
            return;
        }
        let n = u32::from_le_bytes(len) as usize;
        if n > MAX_REQUEST {
            std::process::exit(2);
        }
        let mut buf = vec![0u8; n];
        if input.read_exact(&mut buf).is_err() {
            return;
        }
        let res = match tamga_zk_prover::prove_buffer(&buf) {
            Ok(proof) => {
                let mut o = 0i32.to_le_bytes().to_vec();
                o.extend_from_slice(&(proof.len() as u32).to_le_bytes());
                o.extend_from_slice(&proof);
                o
            }
            Err(code) => code.to_le_bytes().to_vec(),
        };
        if output.write_all(&res).and_then(|_| output.flush()).is_err() {
            return;
        }
    }
}
