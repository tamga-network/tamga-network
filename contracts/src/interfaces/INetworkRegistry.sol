// SPDX-License-Identifier: Apache-2.0
pragma solidity ^0.8.24;

import {ITamgaErrors} from "./ITamgaErrors.sol";
import {StatusHistory} from "../base/StatusHistory.sol";

/**
 * @title  INetworkRegistry — ağ düzeyi kayıtlar (ADR-0074 K3, PJ1–PJ3)
 * @notice LOTL'un hiçbir devlete ait olmayan, ağın kendi güven kayıtları: cüzdan sağlayıcılar ve WUA anahtarları, ZK devreleri,
 *         dış listeler, belge kategorileri, liste imzacıları, liste işletmecileri, devlet ve rol slotları, katalog bilgisi.
 * @dev    Yazım yalnız Governance'ın türü belli önerisiyle (önce `stageRecord` ile içerik sabitlenir, öneri bu içeriğin
 *         özetini taşır, 2/3 oyla `commitStaged`) ya da göç kipinde tek göç yürütücüsüyle (`writeRecord`, ADR-0073 K1).
 *         Zincire yalnız tanımlayıcı özetleri, parmak izleri, kapalı küme değerleri, sayılar, tarihler, bölge kodları yazılır;
 *         ad, açıklama, not, adres ve diğer serbest metin yalnız `detailsHash` (RFC 8785 kanonik JSON + SHA-256) olarak (PJ2).
 */
interface INetworkRegistry is ITamgaErrors {
    /// @dev Değer yalnız SONA eklenir.
    enum RecordKind {
        NONE,
        WALLET_PROVIDER, // recordId = keccak256(provider_id)
        WALLET_PROVIDER_KEY, // recordId = WUA imza anahtarı parmak izi; parentId = sağlayıcı
        ZK_CIRCUIT, // recordId = keccak256(circuit_id); fingerprint = devre dosyası SHA-256; subtype = sistem
        EXTERNAL_LIST, // recordId = keccak256(list_id); region = ülke kodu ya da "EU"; subtype = biçim; digests = imzacı + tür özetleri
        EAA_CATEGORY, // recordId = keccak256(kod)
        LIST_SIGNER, // recordId = imzacı parmak izi; parentId = listKey; subtype = amaç (çapa, JSON liste, XML liste)
        LIST_OPERATOR, // recordId = listKey; status PROVISIONAL / DESIGNATED; detailsHash = ad + on_behalf_of özeti
        STATE_SLOT, // recordId = keccak256("tamga:slot:" ‖ devlet kodu); region = devlet kodu; subtype = üyelik türü
        ROLE_SLOT, // recordId = keccak256(rol); parentId = devlet slotu
        CATALOGUE // recordId = keccak256("catalogue"); detailsHash = katalog adresi bloğu
    }

    /// @dev İmzalı listedeki durumların kapalı kümesi + işletmecinin `designated` değeri; yalnız SONA eklenir (ADR-0073 K5).
    enum RecordStatus {
        NONE,
        ACTIVE,
        SUSPENDED,
        REVOKED,
        RETIRED,
        RESERVED,
        PROVISIONAL,
        DEPRECATED,
        DESIGNATED
    }

    struct NetworkRecord {
        RecordKind kind;
        bytes32 recordId;
        bytes32 parentId; // türüne göre üst kayıt (sağlayıcı, liste anahtarı, devlet slotu) ya da 0
        bytes2 region; // devlet kodu / "EU" / 0
        uint8 subtype; // türüne özgü kapalı küme (biçim, amaç, üyelik, ispat sistemi)
        RecordStatus status;
        uint64 validFrom;
        uint64 validUntil; // 0 = açık uçlu; yarı açık [validFrom, validUntil)
        bytes32 fingerprint; // anahtar / sertifika / dosya SHA-256'sı ya da 0
        bytes32 detailsHash; // listedeki kayıt bloğunun RFC 8785 + SHA-256'sı
        uint256 flags; // türüne özgü sayı ya da bit maskesi (rol maskesi, öznitelik sayısı, sürüm, en az anahtar deposu …)
        bytes32[] digests; // türüne özgü özet kümesi (tür özetleri, sabit imzacı parmak izleri, tanıyan devletler)
    }

    event RecordStaged(bytes32 indexed stageId, RecordKind indexed kind, bytes32 indexed recordId);
    event RecordWritten(RecordKind indexed kind, bytes32 indexed recordId, RecordStatus status, uint64 since);

    error InvalidRecord(RecordKind kind, bytes32 recordId);
    error UnknownStage(bytes32 stageId);
    error UnknownParent(bytes32 parentId);
    error TooManyDigests(uint256 count, uint256 max);
    error NotMigrationWriter(address caller);

    /// @notice İçeriği sabitler; herkes okuyup doğrulayabilir. Etkisi yalnız Governance kabul edince (`commitStaged`).
    function stageRecord(NetworkRecord calldata rec) external returns (bytes32 stageId);
    /// @notice Yalnız Governance (türü belli öneri, 2/3).
    function commitStaged(bytes32 stageId) external;
    /// @notice Yalnız göç kipinde tek göç yürütücüsü; `at` = 0 → blok zamanı (ADR-0073 K1).
    function writeRecord(NetworkRecord calldata rec, uint64 at) external;

    function stagedRecord(bytes32 stageId) external view returns (NetworkRecord memory);
    function stageIdOf(NetworkRecord calldata rec) external pure returns (bytes32);
    function exists(RecordKind kind, bytes32 recordId) external view returns (bool);
    function getRecord(RecordKind kind, bytes32 recordId) external view returns (NetworkRecord memory);
    function recordIdsOf(RecordKind kind) external view returns (bytes32[] memory);
    function recordStatusAt(RecordKind kind, bytes32 recordId, uint64 t) external view returns (RecordStatus);
    function recordStatusHistoryOf(RecordKind kind, bytes32 recordId)
        external
        view
        returns (StatusHistory.Change[] memory);
    /// @notice Kayıt şu anda etkin mi: durum ACTIVE (işletmecide DESIGNATED ya da PROVISIONAL) ve geçerlilik aralığında.
    function isActiveRecord(RecordKind kind, bytes32 recordId) external view returns (bool);
    /// @notice "Bu parmak izi şu anda listeli bir cüzdan sağlayıcının WUA anahtarı mı?" (ADR-0074 K3)
    function isListedProviderKey(bytes32 fingerprint) external view returns (bool);
}
