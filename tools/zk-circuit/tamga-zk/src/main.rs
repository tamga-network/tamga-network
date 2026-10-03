//! Deney (üretimde kullanılmaz): Longfellow mdoc_zk (devre sürümü 8) ile Tamga mdoc'u üzerinde sıfır bilgi ispatı.
//!
//!   tamga-zk circuit <circuit.zst>                         devreyi üret (1 öznitelik), sıkıştırılmış yaz
//!   tamga-zk prove  <circuit.zst> <mdoc> <transcript> <meta.json> <proof.out>
//!   tamga-zk verify <circuit.zst> <transcript> <meta.json> <proof>      çıkış kodu 0 = geçerli, 1 = geçersiz
//!   tamga-zk bench  <circuit.zst> <mdoc> <transcript> <meta.json> [n]  n kez ispat + doğrulama, medyan
//!
//! meta.json: { docType, namespace, attribute, valueCborHex, now, pkx, pky } (gen-fixtures.ts üretir).
use std::time::Instant;

use mdoc_zk_runtime::{
    provider, req_attr, run_mdoc_prover, run_mdoc_verifier, RequestedAttribute, ZkSpecStruct,
    CURRENT_VERSION, CURRENT_ZK_SPECS,
};

struct Meta {
    doc_type: String,
    attrs: Vec<RequestedAttribute>,
    now: String,
    pkx: String,
    pky: String,
}

fn read(path: &str) -> Vec<u8> {
    std::fs::read(path).unwrap_or_else(|e| panic!("okunamadı {path}: {e}"))
}

fn meta(path: &str) -> Meta {
    let v: serde_json::Value = serde_json::from_slice(&read(path)).expect("meta.json");
    let s = |k: &str| v[k].as_str().unwrap_or_else(|| panic!("meta.{k}")).to_string();
    let value = (0..s("valueCborHex").len() / 2)
        .map(|i| u8::from_str_radix(&s("valueCborHex")[2 * i..2 * i + 2], 16).unwrap())
        .collect::<Vec<u8>>();
    Meta {
        doc_type: s("docType"),
        attrs: vec![req_attr(s("namespace"), s("attribute"), value)],
        now: s("now"),
        pkx: s("pkx"),
        pky: s("pky"),
    }
}

fn spec() -> &'static ZkSpecStruct {
    CURRENT_ZK_SPECS.iter().find(|s| s.num_attributes == 1).expect("1 öznitelikli devre tanımı")
}

fn prove(circ: &[u8], mdoc: &[u8], tr: &[u8], m: &Meta) -> Result<Vec<u8>, String> {
    run_mdoc_prover(spec(), circ, mdoc, &m.pkx, &m.pky, tr, &m.attrs, &m.now, &m.doc_type)
        .map_err(|e| format!("{e:?}"))
}

fn verify(circ: &[u8], tr: &[u8], m: &Meta, proof: &[u8]) -> Result<(), String> {
    run_mdoc_verifier(spec(), circ, &m.pkx, &m.pky, tr, &m.attrs, &m.now, &m.doc_type, proof)
        .map_err(|e| format!("{e:?}"))
}

fn median(mut v: Vec<f64>) -> f64 {
    v.sort_by(|a, b| a.partial_cmp(b).unwrap());
    v[v.len() / 2]
}

fn main() {
    let a: Vec<String> = std::env::args().collect();
    match a.get(1).map(String::as_str) {
        Some("circuit") => {
            let t = Instant::now();
            let p = provider::materialize(CURRENT_VERSION, 1).expect("devre üretilemedi");
            let ms = t.elapsed().as_secs_f64() * 1e3;
            std::fs::write(&a[2], &p.compressed).unwrap();
            println!(
                "{{\"version\":{},\"circuit_id\":\"{}\",\"compressed_bytes\":{},\"generate_ms\":{:.0}}}",
                CURRENT_VERSION,
                p.name,
                p.compressed.len(),
                ms
            );
        }
        Some("prove") => {
            let m = meta(&a[5]);
            let t = Instant::now();
            match prove(&read(&a[2]), &read(&a[3]), &read(&a[4]), &m) {
                Ok(proof) => {
                    std::fs::write(&a[6], &proof).unwrap();
                    println!(
                        "{{\"ok\":true,\"proof_bytes\":{},\"prove_ms\":{:.0}}}",
                        proof.len(),
                        t.elapsed().as_secs_f64() * 1e3
                    );
                }
                Err(e) => {
                    println!("{{\"ok\":false,\"error\":\"{e}\"}}");
                    std::process::exit(1);
                }
            }
        }
        Some("verify") => {
            let m = meta(&a[4]);
            let t = Instant::now();
            let r = verify(&read(&a[2]), &read(&a[3]), &m, &read(&a[5]));
            let ms = t.elapsed().as_secs_f64() * 1e3;
            match r {
                Ok(()) => println!("{{\"valid\":true,\"verify_ms\":{ms:.0}}}"),
                Err(e) => {
                    println!("{{\"valid\":false,\"error\":\"{e}\",\"verify_ms\":{ms:.0}}}");
                    std::process::exit(1);
                }
            }
        }
        Some("bench") => {
            let (circ, mdoc, tr, m) = (read(&a[2]), read(&a[3]), read(&a[4]), meta(&a[5]));
            let n: usize = a.get(6).and_then(|s| s.parse().ok()).unwrap_or(5);
            let (mut pv, mut vv, mut size) = (vec![], vec![], 0);
            for _ in 0..n {
                let t = Instant::now();
                let proof = prove(&circ, &mdoc, &tr, &m).expect("ispat");
                pv.push(t.elapsed().as_secs_f64() * 1e3);
                size = proof.len();
                let t = Instant::now();
                verify(&circ, &tr, &m, &proof).expect("doğrulama");
                vv.push(t.elapsed().as_secs_f64() * 1e3);
            }
            println!(
                "{{\"runs\":{n},\"prove_ms_median\":{:.0},\"verify_ms_median\":{:.0},\"proof_bytes\":{size},\"prove_ms\":{:?},\"verify_ms\":{:?}}}",
                median(pv.clone()),
                median(vv.clone()),
                pv.iter().map(|x| x.round()).collect::<Vec<_>>(),
                vv.iter().map(|x| x.round()).collect::<Vec<_>>()
            );
        }
        _ => {
            eprintln!("kullanım: tamga-zk circuit|prove|verify|bench …");
            std::process::exit(2);
        }
    }
}
