// SPDX-License-Identifier: Apache-2.0
pragma solidity ^0.8.24;

import {ITamgaErrors} from "./ITamgaErrors.sol";

/**
 * @title  ITrustListAnchorRegistry — ADR-0051 / SPEC-BC-0001 §15
 * @notice İmzalı güven listelerinin (lotl, tl-<cc>) sürüm özetleri ve çapa günlüğünün (anchors.jsonl) son satır özeti.
 *         Zincir bu listelerin PROJEKSİYONUDUR, kaynağı değil (CH1): çelişkide imzalı liste geçerlidir.
 *
 * @dev    Yalnız özet: bütün alanlar bytes32 ve tam sayıdır; string/bytes alanı YOKTUR (CH2, DP1, TL11).
 *         Eşikli yazıcılar (CH3): bir çapa, `requiredConfirmations` kadar FARKLI yetkili yazıcı birebir aynı veriyi
 *         gönderince onaylıdır; onaylı olmayan çapa hiçbir sorguda "evet" üretmez. Üretimde eşik ≥ 2 (ADR-0009 K4 kapısı).
 *         Rakip adaylar (ADR-0053, CH4'ü değiştirir): açılmış bir sürüm için farklı veri reddedilmez, ayrı aday olur ve
 *         `AnchorConflict` yayar; eşik kadar farklı, hâlâ yetkili yazıcının desteklediği ilk aday onaylanır.
 */
interface ITrustListAnchorRegistry is ITamgaErrors {
    struct ListAnchor {
        uint64 version;
        bytes32 contentHash; // sha256(<liste>.jws) — sonraki sürümün previous_version_hash değeri
        bytes32 previousHash; // önceki sürümün özeti (ilk sürümde 0)
        uint64 issuedAt; // listenin issued_at'i (epoch saniye)
        uint8 confirmations;
        bool confirmed;
        uint64 confirmedAt; // onaylandığı blok zamanı (0 = onaylı değil)
    }

    struct LogHead {
        uint64 seq;
        bytes32 lineHash; // sha256(satır JWS)
        uint64 ts; // satırın ts'i (epoch saniye)
        uint8 confirmations;
        bool confirmed;
        uint64 confirmedAt;
    }

    event AnchorerSet(address indexed anchorer, bool allowed);
    event RequiredConfirmationsSet(uint8 required);
    event ListAnchorProposed(bytes32 indexed listKey, uint64 indexed version, bytes32 contentHash, address anchorer);
    event ListAnchorConfirmed(bytes32 indexed listKey, uint64 indexed version, bytes32 contentHash);
    event LogHeadProposed(bytes32 indexed logKey, uint64 indexed seq, bytes32 lineHash, address anchorer);
    event LogHeadConfirmed(bytes32 indexed logKey, uint64 indexed seq, bytes32 lineHash);
    /// @dev ADR-0053 AC3: aynı (anahtar, sürüm/sıra) için ikinci ve sonraki her farklı aday — çift konuşma alarmı.
    ///      firstHash: sürümü ilk açan adayın özeti; submittedHash: yeni adayın özeti.
    event AnchorConflict(
        bytes32 indexed key,
        uint64 indexed versionOrSeq,
        bytes32 firstHash,
        bytes32 submittedHash,
        address indexed anchorer
    );

    error NotAnchorer(address caller);
    error InvalidThreshold(uint8 submitted);
    error SeqNotMonotonic(uint64 latestConfirmed, uint64 submitted);
    /// @dev ADR-0053: bir adayın destekçi listesi sınırına ulaşıldı (MAX_CANDIDATE_CONFIRMERS).
    error TooManyConfirmers(bytes32 key, uint64 versionOrSeq);
    error AlreadyConfirmedBy(bytes32 key, uint64 versionOrSeq, address anchorer);
    error AlreadyConfirmed(bytes32 key, uint64 versionOrSeq);

    // --- yönetim (governance) ---
    function setAnchorer(address anchorer, bool allowed) external;
    function setRequiredConfirmations(uint8 required) external;

    // --- yazma (anchorer) ---
    function anchorList(bytes32 listKey, uint64 version, bytes32 contentHash, bytes32 previousHash, uint64 issuedAt)
        external;
    function anchorLogHead(bytes32 logKey, uint64 seq, bytes32 lineHash, uint64 ts) external;

    // --- okuma (doğrulayıcı; CH1: isteğe bağlı ek güvence) ---
    /// @notice "Bu liste sürümü bu özetle ONAYLI çapalandı mı?" — onaysız ya da farklı özet → false.
    function isListAnchored(bytes32 listKey, uint64 version, bytes32 contentHash) external view returns (bool);
    function listAnchor(bytes32 listKey, uint64 version) external view returns (ListAnchor memory);
    /// @notice En yüksek ONAYLI sürüm (0 = yok).
    function latestListVersion(bytes32 listKey) external view returns (uint64);
    function isLogLineAnchored(bytes32 logKey, uint64 seq, bytes32 lineHash) external view returns (bool);
    function logHead(bytes32 logKey, uint64 seq) external view returns (LogHead memory);
    function latestLogSeq(bytes32 logKey) external view returns (uint64);

    function isAnchorer(address account) external view returns (bool);
    function anchorerCount() external view returns (uint32);
    function requiredConfirmations() external view returns (uint8);
    function hasConfirmed(bytes32 key, uint64 versionOrSeq, address anchorer) external view returns (bool);

    // --- adaylar (ADR-0053) ---
    /// @notice Bir liste sürümü adayının GÜNCEL desteği (bugünkü yazıcı kümesinden sayılır).
    function listCandidateConfirmations(
        bytes32 listKey,
        uint64 version,
        bytes32 contentHash,
        bytes32 previousHash,
        uint64 issuedAt
    ) external view returns (uint8);
    /// @notice Bir günlük başı adayının GÜNCEL desteği.
    function logCandidateConfirmations(bytes32 logKey, uint64 seq, bytes32 lineHash, uint64 ts)
        external
        view
        returns (uint8);
    /// @notice Bir sürüm/sıra için kaydedilmiş farklı aday sayısı (> 1 → çelişki).
    function candidateCount(bytes32 key, uint64 versionOrSeq) external view returns (uint32);
}
