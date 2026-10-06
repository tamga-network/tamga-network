//! Longfellow ZK mdoc ispatçısı — C ABI (ADR-0032 Aşama 2). Mobil yerel modül ve masaüstü ikilisi aynı girdi biçimini kullanır.
//!
//! Girdi tamponu: art arda `u32 LE uzunluk + bayt` alanları
//!   combined_hash(32) · circuit(zstd) · device_response(CBOR) · transcript · pkx("0x…") · pky · now · doc_type
//!   · attr_count(u32 LE, 4 bayt) · her öznitelik için namespace · id · cbor_value
//! Çıktı: ispat baytları. Hata kodları: 1..=99 Longfellow ispatçı hatası (ayrıntı verilmez), 100 = tampon biçimi,
//! 101 = bilinmeyen devre özeti (combined_hash + öznitelik sayısı), 102 = devre sürümü uyumsuz.
//! İspatçı yalnız cihazda çalışır: belge, cihaz imzası ve kişi verisi girdidir ve hiçbir yere yazılmaz (log yok).
use mdoc_zk_runtime::{req_attr, run_mdoc_prover, RequestedAttribute, CURRENT_VERSION, CURRENT_ZK_SPECS};

pub const ERR_FORMAT: i32 = 100;
pub const ERR_UNKNOWN_CIRCUIT: i32 = 101;

struct Reader<'a> {
    b: &'a [u8],
    at: usize,
}
impl<'a> Reader<'a> {
    fn field(&mut self) -> Option<&'a [u8]> {
        let n = u32::from_le_bytes(self.b.get(self.at..self.at + 4)?.try_into().ok()?) as usize;
        self.at += 4;
        let f = self.b.get(self.at..self.at + n)?;
        self.at += n;
        Some(f)
    }
    fn str(&mut self) -> Option<&'a str> {
        std::str::from_utf8(self.field()?).ok()
    }
}

/// Tampondaki isteği ispatlar. `Ok(proof)` ya da `Err(kod)`.
pub fn prove_buffer(input: &[u8]) -> Result<Vec<u8>, i32> {
    let mut r = Reader { b: input, at: 0 };
    let mut go = || -> Option<(&[u8], &[u8], &[u8], &[u8], &str, &str, &str, &str, Vec<RequestedAttribute>)> {
        let hash = r.field()?;
        let circuit = r.field()?;
        let dr = r.field()?;
        let transcript = r.field()?;
        let (pkx, pky, now, doc_type) = (r.str()?, r.str()?, r.str()?, r.str()?);
        let count = u32::from_le_bytes(r.field()?.try_into().ok()?) as usize;
        if count == 0 || count > 8 {
            return None;
        }
        let mut attrs = Vec::with_capacity(count);
        for _ in 0..count {
            let ns = r.str()?.to_string();
            let id = r.str()?.to_string();
            attrs.push(req_attr(ns, id, r.field()?.to_vec()));
        }
        Some((hash, circuit, dr, transcript, pkx, pky, now, doc_type, attrs))
    };
    let (hash, circuit, dr, transcript, pkx, pky, now, doc_type, attrs) = go().ok_or(ERR_FORMAT)?;
    let spec = CURRENT_ZK_SPECS
        .iter()
        .find(|s| s.combined_hash[..] == *hash && s.num_attributes == attrs.len())
        .ok_or(ERR_UNKNOWN_CIRCUIT)?;
    run_mdoc_prover(spec, circuit, dr, pkx, pky, transcript, &attrs, now, doc_type).map_err(|_| 1)
}

/// Longfellow devre sürümü (güven listesindeki `zk_circuits[].version` ile karşılaştırılır).
#[no_mangle]
pub extern "C" fn tzp_circuit_version() -> u32 {
    CURRENT_VERSION as u32
}

/// İspat üretir. Başarıda 0 döner, `*out`/`*out_len` Rust'ın ayırdığı ispat tamponudur (`tzp_free` ile bırakılır).
/// # Safety
/// `input` `input_len` bayt okunabilir; `out` ve `out_len` yazılabilir olmalı.
#[no_mangle]
pub unsafe extern "C" fn tzp_prove(input: *const u8, input_len: usize, out: *mut *mut u8, out_len: *mut usize) -> i32 {
    let buf = std::slice::from_raw_parts(input, input_len);
    match prove_buffer(buf) {
        Ok(proof) => {
            let mut b = proof.into_boxed_slice();
            *out_len = b.len();
            *out = b.as_mut_ptr();
            std::mem::forget(b);
            0
        }
        Err(code) => code,
    }
}

/// `tzp_prove`'un döndürdüğü tamponu bırakır.
/// # Safety
/// `ptr`/`len` `tzp_prove`'dan gelmelidir.
#[no_mangle]
pub unsafe extern "C" fn tzp_free(ptr: *mut u8, len: usize) {
    if !ptr.is_null() {
        drop(Box::from_raw(std::ptr::slice_from_raw_parts_mut(ptr, len)));
    }
}

/// Android JNI köprüsü: `network.tamga.zk.ZkNative` (packages/zk/android). Hata ayrıntısı Kotlin'e geçmez (kişi verisi içerebilir).
#[cfg(target_os = "android")]
mod android {
    use jni::objects::{JByteArray, JClass};
    use jni::sys::{jbyteArray, jint};
    use jni::JNIEnv;

    #[no_mangle]
    pub extern "system" fn Java_network_tamga_zk_ZkNative_circuitVersion(_env: JNIEnv, _class: JClass) -> jint {
        super::tzp_circuit_version() as jint
    }

    #[no_mangle]
    pub extern "system" fn Java_network_tamga_zk_ZkNative_prove(mut env: JNIEnv, _class: JClass, input: JByteArray) -> jbyteArray {
        let Ok(buf) = env.convert_byte_array(&input) else {
            return std::ptr::null_mut();
        };
        match super::prove_buffer(&buf) {
            Ok(proof) => env.byte_array_from_slice(&proof).map(|a| a.into_raw()).unwrap_or(std::ptr::null_mut()),
            Err(_) => std::ptr::null_mut(),
        }
    }
}
