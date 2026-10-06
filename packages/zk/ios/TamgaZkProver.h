// @tamga-network/zk — Rust ispatçısının C ABI'si (packages/zk/rust/src/lib.rs ile aynı imzalar).
#pragma once
#include <stddef.h>
#include <stdint.h>

uint32_t tzp_circuit_version(void);
/// 0 = başarı; `*out`/`*out_len` ispat tamponu (tzp_free ile bırakılır). Diğer kodlar: lib.rs.
int32_t tzp_prove(const uint8_t *input, size_t input_len, uint8_t **out, size_t *out_len);
void tzp_free(uint8_t *ptr, size_t len);
