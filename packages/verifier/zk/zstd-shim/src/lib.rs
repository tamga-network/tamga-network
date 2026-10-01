//! `zstd` 0.13 API'sinin Longfellow doğrulayıcısının kullandığı küçük parçası, saf Rust (ruzstd) ile.
//! Tamga'nın WASM doğrulayıcısı için Cargo `[patch.crates-io]` ile C kütüphanesinin yerine geçer.
use std::io::{self, Read};

pub mod stream {
    pub mod read {
        use std::io::{self, Cursor, Read};
        use std::marker::PhantomData;

        /// Girdiyi baştan tamamen açar (devre ~300 KB sıkışık) ve bellekten okutur.
        pub struct Decoder<'a, R> {
            out: Cursor<Vec<u8>>,
            _r: PhantomData<&'a R>,
        }

        impl<'a, R: Read> Decoder<'a, R> {
            pub fn new(mut reader: R) -> io::Result<Self> {
                let mut dec = ruzstd::decoding::StreamingDecoder::new(&mut reader)
                    .map_err(|e| io::Error::new(io::ErrorKind::InvalidData, e.to_string()))?;
                let mut out = Vec::new();
                dec.read_to_end(&mut out)?;
                Ok(Self { out: Cursor::new(out), _r: PhantomData })
            }
        }

        impl<R> Read for Decoder<'_, R> {
            fn read(&mut self, buf: &mut [u8]) -> io::Result<usize> {
                self.out.read(buf)
            }
        }
    }
}

/// Sıkıştırma doğrulayıcıda gerekmez (yalnız devre üretimi kullanır).
pub fn encode_all<R: Read>(_source: R, _level: i32) -> io::Result<Vec<u8>> {
    Err(io::Error::new(io::ErrorKind::Unsupported, "zstd encode not available in the WASM verifier"))
}
