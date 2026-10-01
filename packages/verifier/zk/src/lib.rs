//! Longfellow ZK mdoc doğrulayıcısı — WebAssembly (wasm32-unknown-unknown), wasm-bindgen'siz, C ABI.
//!
//! JS tarafı (`packages/verifier/src/zk/wasm.ts`) belleği `tz_alloc` ile ayırır, girdileri tek tampona yazar ve
//! `tz_verify` çağırır. Tampon: art arda `u32 LE uzunluk + bayt` alanları:
//!   combined_hash(32) · circuit(zstd) · pkx("0x…") · pky · transcript · now · doc_type · proof · attr_count(u32 LE, 4 bayt)
//!   · her öznitelik için namespace · id · cbor_value
//! Dönüş: 0 = geçerli; 1..=11 Longfellow `MdocVerifierErrorCode`; 100 = tampon biçimi; 101 = bilinmeyen devre özeti.
use mdoc_zk_runtime::{req_attr, run_mdoc_verifier, RequestedAttribute, CURRENT_VERSION, CURRENT_ZK_SPECS};

#[no_mangle]
pub extern "C" fn tz_alloc(len: usize) -> *mut u8 {
    let mut v = Vec::<u8>::with_capacity(len);
    let p = v.as_mut_ptr();
    std::mem::forget(v);
    p
}

/// # Safety
/// `ptr`/`len` `tz_alloc`'tan gelmelidir.
#[no_mangle]
pub unsafe extern "C" fn tz_free(ptr: *mut u8, len: usize) {
    drop(Vec::from_raw_parts(ptr, 0, len));
}

/// Devre sürümü (Longfellow `CURRENT_VERSION`).
#[no_mangle]
pub extern "C" fn tz_circuit_version() -> u32 {
    CURRENT_VERSION as u32
}

#[no_mangle]
pub extern "C" fn tz_spec_count() -> u32 {
    CURRENT_ZK_SPECS.len() as u32
}

/// i. devre tanımının `combined_hash`'ini `out`'a (32 bayt) yazar; dönüş = öznitelik sayısı.
/// # Safety
/// `out` en az 32 bayt yazılabilir olmalı.
#[no_mangle]
pub unsafe extern "C" fn tz_spec(i: u32, out: *mut u8) -> u32 {
    let s = &CURRENT_ZK_SPECS[i as usize];
    std::ptr::copy_nonoverlapping(s.combined_hash.as_ptr(), out, 32);
    s.num_attributes as u32
}

struct Reader<'a> {
    b: &'a [u8],
}

impl<'a> Reader<'a> {
    fn field(&mut self) -> Option<&'a [u8]> {
        if self.b.len() < 4 {
            return None;
        }
        let n = u32::from_le_bytes(self.b[..4].try_into().ok()?) as usize;
        let rest = &self.b[4..];
        if rest.len() < n {
            return None;
        }
        let (f, r) = rest.split_at(n);
        self.b = r;
        Some(f)
    }
    fn text(&mut self) -> Option<&'a str> {
        std::str::from_utf8(self.field()?).ok()
    }
}

/// # Safety
/// `ptr`/`len` JS'in yazdığı tamponu göstermelidir.
#[no_mangle]
pub unsafe extern "C" fn tz_verify(ptr: *const u8, len: usize) -> i32 {
    let input = std::slice::from_raw_parts(ptr, len);
    match verify(input) {
        Ok(code) => code,
        Err(()) => 100,
    }
}

/// Çerçeveli tamponu doğrular (WASM `tz_verify` ve yerel `tamga-zk-verify` aynı biçimi kullanır).
/// Dönüş: 0 = geçerli; 1..=11 Longfellow hata kodu; 100 = tampon biçimi; 101 = bilinmeyen devre özeti.
pub fn verify_buffer(input: &[u8]) -> i32 {
    verify(input).unwrap_or(100)
}

fn verify(input: &[u8]) -> Result<i32, ()> {
    let mut r = Reader { b: input };
    let hash = r.field().ok_or(())?;
    let circuit = r.field().ok_or(())?;
    let pkx = r.text().ok_or(())?;
    let pky = r.text().ok_or(())?;
    let transcript = r.field().ok_or(())?;
    let now = r.text().ok_or(())?;
    let doc_type = r.text().ok_or(())?;
    let proof = r.field().ok_or(())?;
    let count = u32::from_le_bytes(r.field().ok_or(())?.try_into().map_err(|_| ())?) as usize;
    let mut attrs: Vec<RequestedAttribute> = Vec::with_capacity(count);
    for _ in 0..count {
        attrs.push(req_attr(r.field().ok_or(())?, r.field().ok_or(())?, r.field().ok_or(())?));
    }
    let Some(spec) = CURRENT_ZK_SPECS.iter().find(|s| s.combined_hash[..] == *hash && s.num_attributes == count) else {
        return Ok(101);
    };
    Ok(match run_mdoc_verifier(spec, circuit, pkx, pky, transcript, &attrs, now, doc_type, proof) {
        Ok(()) => 0,
        Err(e) => e as i32,
    })
}

/// Doğrulayıcı rastgelelik kullanmaz; getrandom'un WASM "custom" arka ucu her çağrıda hata döner.
#[cfg(target_arch = "wasm32")]
#[no_mangle]
unsafe extern "Rust" fn __getrandom_v03_custom(_dest: *mut u8, _len: usize) -> Result<(), getrandom::Error> {
    Err(getrandom::Error::UNSUPPORTED)
}
