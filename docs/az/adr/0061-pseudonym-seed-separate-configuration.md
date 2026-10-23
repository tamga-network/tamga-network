---
document_id: ADR-0061
title: "Psevdonim toxumu ayrıca sənəd konfiqurasiyası kimi, standart sənəd sorğusu ilə"
status: Active
review_status: Completed
version: 1.0.0
created: 2026-10-22
last_updated: 2026-10-22
summary: >
  Psevdonim toxumu sənədi (`urn:tamga:id:PseudonymSeed:1`, ADR-0031 K1) şəxsiyyət sənədinin cavabına əlavə edilən qeyri-standart `pseudonym_seed` sahəsi ilə deyil, şəxsiyyət xidmətinin metadata-sında elan edilən ayrıca sənəd konfiqurasiyası kimi verilir: cüzdan şəxsiyyət sənədini aldıqdan sonra eyni giriş tokeni ilə ikinci, standart sənəd sorğusu edir (OpenID4VCI 1.0 §8; ADR-0059). Toxumun məxfilik xüsusiyyətləri dəyişmir (PS1–PS6): ayrıca və təqdim edilə bilməyən növ, şəxsiyyət sənədinin ilk nüsxəsinin açarına bağlı, ləğv siyahısı yoxdur, serverdə saxlanılmır. Yalnız çatdırılma formasını dəyişən standart uyğunluq düzəlişidir; layihə rəhbərliyinin ümumi təsdiqi çərçivəsində qəbul edildi. Qəbul: 2026-10-22.
domain: Privacy
related: ["[[ADR-0031]]", "[[ADR-0059]]", "[[SPEC-PROTO-0001]]", "[[SPEC-WALLET-0001]]"]
translation_of: ADR-0061
source_version: "1.0.0"
---

# Kontekst

- **ADR-0031 K1.** Şəxsiyyət xidməti şəxsə məxsus psevdonim toxumunu ayrıca, təqdim edilə bilməyən sənəd növü ilə
  (`urn:tamga:id:PseudonymSeed:1`) verir. İndiyədək bu sənəd şəxsiyyət sənədinin sənəd cavabına `pseudonym_seed` adlı əlavə sahə
  ilə qoyulurdu.
- **Standart.** OpenID4VCI 1.0 §8.3 sənəd cavabının sahələrini müəyyən edir (`credentials`, `transaction_id`, `notification_id`,
  `interval`); əlavə sahə qeyri-standartdır. Bir neçə sənəd növü eyni avtorizasiya ilə alınacaqsa, hər biri metadata-da ayrıca
  konfiqurasiya kimi elan edilir və ayrıca sənəd sorğusu ilə istənilir.
- **OpenID uyğunluq öz-testi (tapıntı G3).** Şəxsiyyət xidmətinin hər sənəd cavabında "naməlum sahə" xəbərdarlığı (22 test);
  alətin bu yoxlaması parametrlə söndürülə bilmir.

# Qərar

## K1 — Ayrıca konfiqurasiya
Şəxsiyyət xidmətinin metadata-sı toxum növünü `credential_configurations_supported` daxilində ayrıca `dc+sd-jwt` konfiqurasiyası
kimi elan edir (növ kataloqdadırsa və şəxsiyyət xidməti etibar siyahısında bu növə səlahiyyətlidirsə). Növ PAR ilə tək başına
istənilə bilməz.

## K2 — Eyni tokenlə ikinci sorğu
Cüzdan şəxsiyyət sənədini aldıqdan sonra **eyni giriş tokeni ilə** (ADR-0059) `credential_configuration_id =
urn:tamga:id:PseudonymSeed:1` və tək açar sübutu ilə — şəxsiyyət sənədinin ilk nüsxəsinin açarı ilə — standart sənəd sorğusu edir.
Şəxsiyyət xidməti toxumu yalnız həmin tokenlə şəxsiyyət sənədi verilibsə və bir dəfə verir; toxum sənədə bağlanır. Sənəd cavabında
qeyri-standart sahə qalmır.

## K3 — Dəyişməyənlər
ADR-0031 PS1–PS6 olduğu kimi: toxum təqdim edilə bilməyən növdədir (PS3), serverdə saxlanılmır — axın boyu yalnız yaddaşda qalır və
veriləndə və ya token bitəndə silinir (PS2); törətmə və təqdimat qaydaları dəyişmir.

# Nəzərdən keçirilmiş variantlar

- **Əlavə sahə qalsın.** Qeyri-standartdır; xəbərdarlıq hər testdə davam edir.
- **Toxum şəxsiyyət sənədinin içində sahə kimi.** Təqdim edilən sənədə daxil olur — PS3-ə ziddir.
- **Cüzdanda törətmə.** Eyni şəxs hər cihazda eyni toxumu almalıdır (ADR-0031); toxum şəxsin şəxsiyyətindən server sirri ilə
  törədilir, cüzdan tək başına törədə bilməz.
- **Seçilən:** ayrıca konfiqurasiya + eyni tokenlə ikinci sorğu — OpenID4VCI-nin bir neçə növ üçün nəzərdə tutduğu yol.

# Dəyişməzlər

| Kod | Qayda |
|---|---|
| SD1 | Psevdonim toxumu sənədi yalnız şəxsiyyət sənədini verən giriş tokeni ilə, şəxsiyyət sənədindən sonra və bir dəfə verilir. |
| SD2 | Sənəd cavabı OpenID4VCI 1.0 §8.3-də müəyyən edilməmiş yuxarı səviyyəli sahə daşımır. |

# Tətbiq

- Şəxsiyyət xidməti: metadata-da toxum konfiqurasiyası (`seedType`), credential nöqtəsində ayrıca sorğu (`seedRequest`); şəxsiyyət
  sənədinin cavabında `pseudonym_seed` yoxdur. Nüsxə haqqı dolanda token toxum sorğusu üçün ömrü bitənə qədər qalır.
- wallet-core 0.7.2: `obtainCredential` şəxsiyyət sənədindən sonra toxum konfiqurasiyası elan edilibsə, ikinci sorğunu edir
  (`RedeemOutput.pseudonymSeed`); `readPseudonymSeed` eynidir.
- Spesifikasiya: [[SPEC-PROTO-0001]] §7.5, [[SPEC-WALLET-0001]] §5.4.

# Status

**Accepted — 2026-10-22.** Layihə rəhbərliyinin ümumi təsdiqi çərçivəsində ("Aİ standartlarına uyğun olaq, çatışmazlıqlarımızı
aradan qaldıraq, olması lazım olduğu kimi edək"): bağlanmış ADR-0031 qərarının yalnız çatdırılma formasını standarta uyğunlaşdıran
düzəliş; məxfilik qaydaları dəyişmədi. DECISIONS: D-PRIV-2.
