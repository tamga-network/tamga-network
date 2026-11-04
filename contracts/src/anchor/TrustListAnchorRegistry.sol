// SPDX-License-Identifier: Apache-2.0
pragma solidity ^0.8.24;

import {Initializable} from "@openzeppelin/contracts-upgradeable/proxy/utils/Initializable.sol";
import {UUPSUpgradeable} from "@openzeppelin/contracts-upgradeable/proxy/utils/UUPSUpgradeable.sol";

import {ITrustListAnchorRegistry} from "../interfaces/ITrustListAnchorRegistry.sol";

/**
 * @title  TrustListAnchorRegistry
 * @notice İmzalı güven listelerinin ve çapa günlüğünün ZİNCİR PROJEKSİYONU — ADR-0051, SPEC-BC-0001 §15.
 *
 * @dev    Ne tutar: liste başına (listKey) sürüm → {contentHash, previousHash, issuedAt}; günlük başına (logKey) sıra →
 *         {lineHash, ts}. Başka hiçbir şey: liste içeriği, kayıt, belge, kişisel veri YOK (CH2 / DP1 / TL11).
 *
 *         Kim yazar: `governance`'ın yetkilendirdiği yazıcılar (anchorer). Bir çapa `requiredConfirmations` kadar FARKLI yazıcı
 *         aynı veriyi gönderince onaylıdır (CH3). Üretimde eşik ≥ 2: tek işletmeci onaylı çapa üretemez — ADR-0009 K4'ün
 *         ("ikinci bağımsız işletmeci") kontrat karşılığı. Geliştirme ağında eşik 1.
 *
 *         Rakip adaylar (ADR-0053): açılmış (sürüm/sıra) için farklı veri reddedilmez, ayrı ADAY olur ve `AnchorConflict`
 *         yayar (çift konuşma alarmı). Eşik kadar farklı ve hâlâ yetkili yazıcının desteklediği İLK aday onaylanır; sürüm
 *         kapanır. Her yazıcı bir sürüm için tek aday destekler. Sürüm ve sıra liste/günlük başına monoton açılır (en yüksek
 *         ONAYLI değerin üstünde); onaylı kayıt değişmez, silinmez (CH4).
 *
 *         Çelişkide imzalı liste geçerlidir (CH1); bu kontrat doğrulamada hiçbir adımda ZORUNLU değildir.
 *
 *         ═══ DEPOLAMA DÜZENİ ═══ Yeni değişken SONA eklenir, __gap aynı sayıda azaltılır.
 */
contract TrustListAnchorRegistry is Initializable, UUPSUpgradeable, ITrustListAnchorRegistry {
    uint8 public constant MAX_REQUIRED_CONFIRMATIONS = 16;
    /// @notice Bir adayın destekçi listesinin üst sınırı (döngü sınırı; ADR-0053). Eşik ≤ 16 olduğundan pratikte erişilmez.
    uint256 public constant MAX_CANDIDATE_CONFIRMERS = 32;

    address public governance;
    uint8 private _required;
    uint32 private _anchorerCount;
    mapping(address => bool) private _anchorers;

    mapping(bytes32 => mapping(uint64 => ListAnchor)) private _lists;
    mapping(bytes32 => uint64) private _latestListVersion;
    mapping(bytes32 => mapping(uint64 => LogHead)) private _logs;
    mapping(bytes32 => uint64) private _latestLogSeq;
    /// @dev keccak256(key, versionOrSeq) → anchorer → onayladı mı
    mapping(bytes32 => mapping(address => bool)) private _confirmedBy;

    /// @dev ADR-0053: keccak256(id, keccak256(veri)) → adayı destekleyen yazıcılar (sıralı). Destek her gönderimde bugünkü
    ///      yazıcı kümesinden yeniden sayılır (AC4).
    mapping(bytes32 => address[]) private _candidateConfirmers;
    /// @dev ADR-0053: id → farklı aday sayısı (> 1 → çelişki, AC3)
    mapping(bytes32 => uint32) private _candidateCount;
    /// @dev SPEC-BC-0001 C33 (1): yetkili yazıcıların listesi (izin listesi üretimi için okunur, ADR-0052 LP2).
    address[] private _anchorerList;

    uint256[40] private __gap;

    /// @notice F-18: liste sürümü bir adımda en çok bu kadar artar (2^64-1 ile dondurma yok).
    uint64 public constant MAX_VERSION_STEP = 1_000_000;

    /// @custom:oz-upgrades-unsafe-allow constructor
    constructor() {
        _disableInitializers();
    }

    /**
     * @param governance_ Yazıcı kümesini, eşiği ve yükseltmeyi yöneten adres (Faz 0: Governance proxy'si).
     * @param anchorers_  Başlangıç yazıcıları.
     * @param required_   Onay eşiği (1..16). Üretimde ≥ 2 (ADR-0051 K3) — kontrat bunu zorlamaz, dağıtım disiplinidir;
     *                    dev ağında 1.
     */
    function initialize(address governance_, address[] calldata anchorers_, uint8 required_) external initializer {
        if (governance_ == address(0)) revert ZeroAddress();
        if (required_ == 0 || required_ > MAX_REQUIRED_CONFIRMATIONS) revert InvalidThreshold(required_);
        governance = governance_;
        for (uint256 i = 0; i < anchorers_.length; i++) _setAnchorer(anchorers_[i], true);
        // AC4: eşik yazıcı sayısını aşamaz (yazıcısız kurulumda yazıcılar sonra eklenir)
        if (anchorers_.length != 0 && required_ > _anchorerCount) revert InvalidThreshold(required_);
        _required = required_;
        emit RequiredConfirmationsSet(required_);
    }

    function _authorizeUpgrade(address) internal view override onlyGovernance {}

    // -----------------------------------------------------------------
    // Yetki
    // -----------------------------------------------------------------

    modifier onlyGovernance() {
        if (msg.sender != governance) revert NotGovernance(msg.sender);
        _;
    }

    modifier onlyAnchorer() {
        if (!_anchorers[msg.sender]) revert NotAnchorer(msg.sender);
        _;
    }

    /// @inheritdoc ITrustListAnchorRegistry
    function setAnchorer(address anchorer, bool allowed) external onlyGovernance {
        _setAnchorer(anchorer, allowed);
    }

    function _setAnchorer(address anchorer, bool allowed) private {
        if (anchorer == address(0)) revert ZeroAddress();
        if (_anchorers[anchorer] == allowed) return;
        _anchorers[anchorer] = allowed;
        if (allowed) {
            _anchorerCount++;
            _anchorerList.push(anchorer);
        } else {
            _anchorerCount--;
            for (uint256 i = 0; i < _anchorerList.length; i++) {
                if (_anchorerList[i] == anchorer) {
                    _anchorerList[i] = _anchorerList[_anchorerList.length - 1];
                    _anchorerList.pop();
                    break;
                }
            }
        }
        emit AnchorerSet(anchorer, allowed);
    }

    /// @inheritdoc ITrustListAnchorRegistry
    function setRequiredConfirmations(uint8 required_) external onlyGovernance {
        if (required_ == 0 || required_ > MAX_REQUIRED_CONFIRMATIONS) revert InvalidThreshold(required_);
        if (required_ > _anchorerCount) revert InvalidThreshold(required_); // AC4
        _required = required_;
        emit RequiredConfirmationsSet(required_);
    }

    // -----------------------------------------------------------------
    // Yazma — yalnız özet (CH2); rakip adaylar (ADR-0053)
    // -----------------------------------------------------------------

    /// @inheritdoc ITrustListAnchorRegistry
    function anchorList(bytes32 listKey, uint64 version, bytes32 contentHash, bytes32 previousHash, uint64 issuedAt)
        external
        onlyAnchorer
    {
        if (contentHash == bytes32(0)) revert EmptyContentHash();
        if (version == 0) revert VersionNotMonotonic(_latestListVersion[listKey], version);

        ListAnchor storage a = _lists[listKey][version];
        if (a.confirmed) revert AlreadyConfirmed(listKey, version);
        bytes32 id = _id(listKey, version);
        if (_candidateCount[id] == 0 && a.confirmations == 0) {
            // ilk açılış: onaylı en yüksek sürümün üstünde olmalı (CH4 — geçmiş yeniden yazılamaz). Görünüm ilk adayı gösterir.
            if (version <= _latestListVersion[listKey]) revert VersionNotMonotonic(_latestListVersion[listKey], version);
            if (version - _latestListVersion[listKey] > MAX_VERSION_STEP) {
                revert VersionStepTooLarge(_latestListVersion[listKey], version); // F-18
            }
            a.version = version;
            a.contentHash = contentHash;
            a.previousHash = previousHash;
            a.issuedAt = issuedAt;
        }

        bytes32 dataHash = keccak256(abi.encode(contentHash, previousHash, issuedAt));
        uint8 live = _support(listKey, version, id, dataHash, a.contentHash, contentHash);
        emit ListAnchorProposed(listKey, version, contentHash, msg.sender);

        bool shown = a.contentHash == contentHash && a.previousHash == previousHash && a.issuedAt == issuedAt;
        if (live >= _required) {
            // AC2: eşiği ilk dolduran aday kazanır; kayıt kazananın verisini taşır ve kapanır
            a.contentHash = contentHash;
            a.previousHash = previousHash;
            a.issuedAt = issuedAt;
            a.confirmations = live;
            a.confirmed = true;
            a.confirmedAt = uint64(block.timestamp);
            if (version > _latestListVersion[listKey]) _latestListVersion[listKey] = version;
            emit ListAnchorConfirmed(listKey, version, contentHash);
        } else if (shown) {
            a.confirmations = live;
        }
    }

    /// @inheritdoc ITrustListAnchorRegistry
    function anchorLogHead(bytes32 logKey, uint64 seq, bytes32 lineHash, uint64 ts) external onlyAnchorer {
        if (lineHash == bytes32(0)) revert EmptyContentHash();

        LogHead storage h = _logs[logKey][seq];
        if (h.confirmed) revert AlreadyConfirmed(logKey, seq);
        bytes32 id = _id(logKey, seq);
        if (_candidateCount[id] == 0 && h.confirmations == 0) {
            // seq 0 (günlüğün ilk satırı) açılabilir; sonrakiler onaylı en yüksek sıranın üstünde olmalı
            if (_latestLogSeq[logKey] != 0 || _logs[logKey][0].confirmed) {
                if (seq <= _latestLogSeq[logKey]) revert SeqNotMonotonic(_latestLogSeq[logKey], seq);
            }
            h.seq = seq;
            h.lineHash = lineHash;
            h.ts = ts;
        }

        bytes32 dataHash = keccak256(abi.encode(lineHash, ts));
        uint8 live = _support(logKey, seq, id, dataHash, h.lineHash, lineHash);
        emit LogHeadProposed(logKey, seq, lineHash, msg.sender);

        bool shown = h.lineHash == lineHash && h.ts == ts;
        if (live >= _required) {
            h.lineHash = lineHash;
            h.ts = ts;
            h.confirmations = live;
            h.confirmed = true;
            h.confirmedAt = uint64(block.timestamp);
            if (seq > _latestLogSeq[logKey]) _latestLogSeq[logKey] = seq;
            emit LogHeadConfirmed(logKey, seq, lineHash);
        } else if (shown) {
            h.confirmations = live;
        }
    }

    /**
     * @dev Çağıranın desteğini adaya yazar ve adayın GÜNCEL desteğini döndürür (ADR-0053).
     *      AC1: bir yazıcı bir sürüm için yalnız bir adayı destekler. AC3: yeni bir rakip aday çelişki olayı yayar.
     *      AC4: destek, o anki yetkili yazıcılardan yeniden sayılır (çıkarılan yazıcı sayılmaz).
     */
    function _support(
        bytes32 key,
        uint64 versionOrSeq,
        bytes32 id,
        bytes32 dataHash,
        bytes32 firstHash,
        bytes32 submittedHash
    ) private returns (uint8 live) {
        if (_confirmedBy[id][msg.sender]) revert AlreadyConfirmedBy(key, versionOrSeq, msg.sender);
        _confirmedBy[id][msg.sender] = true;

        address[] storage confirmers = _candidateConfirmers[keccak256(abi.encode(id, dataHash))];
        if (confirmers.length == 0) {
            uint32 n = ++_candidateCount[id];
            if (n > 1) emit AnchorConflict(key, versionOrSeq, firstHash, submittedHash, msg.sender);
        }
        if (confirmers.length >= MAX_CANDIDATE_CONFIRMERS) revert TooManyConfirmers(key, versionOrSeq);
        confirmers.push(msg.sender);
        return _liveCount(confirmers);
    }

    function _liveCount(address[] storage confirmers) private view returns (uint8 n) {
        uint256 len = confirmers.length;
        for (uint256 i = 0; i < len; i++) {
            if (_anchorers[confirmers[i]]) n++;
        }
    }

    // -----------------------------------------------------------------
    // Okuma — isteğe bağlı ek güvence (CH1)
    // -----------------------------------------------------------------

    /// @inheritdoc ITrustListAnchorRegistry
    function isListAnchored(bytes32 listKey, uint64 version, bytes32 contentHash) external view returns (bool) {
        ListAnchor storage a = _lists[listKey][version];
        return a.confirmed && a.contentHash == contentHash && contentHash != bytes32(0);
    }

    function listAnchor(bytes32 listKey, uint64 version) external view returns (ListAnchor memory) {
        return _lists[listKey][version];
    }

    function latestListVersion(bytes32 listKey) external view returns (uint64) {
        return _latestListVersion[listKey];
    }

    /// @inheritdoc ITrustListAnchorRegistry
    function isLogLineAnchored(bytes32 logKey, uint64 seq, bytes32 lineHash) external view returns (bool) {
        LogHead storage h = _logs[logKey][seq];
        return h.confirmed && h.lineHash == lineHash && lineHash != bytes32(0);
    }

    function logHead(bytes32 logKey, uint64 seq) external view returns (LogHead memory) {
        return _logs[logKey][seq];
    }

    function latestLogSeq(bytes32 logKey) external view returns (uint64) {
        return _latestLogSeq[logKey];
    }

    function isAnchorer(address account) external view returns (bool) {
        return _anchorers[account];
    }

    /// @notice SPEC-BC-0001 C33 (1): bugünkü yazıcılar.
    function anchorers() external view returns (address[] memory) {
        return _anchorerList;
    }

    function anchorerCount() external view returns (uint32) {
        return _anchorerCount;
    }

    function requiredConfirmations() external view returns (uint8) {
        return _required;
    }

    function hasConfirmed(bytes32 key, uint64 versionOrSeq, address anchorer) external view returns (bool) {
        return _confirmedBy[_id(key, versionOrSeq)][anchorer];
    }

    /// @inheritdoc ITrustListAnchorRegistry
    function listCandidateConfirmations(
        bytes32 listKey,
        uint64 version,
        bytes32 contentHash,
        bytes32 previousHash,
        uint64 issuedAt
    ) external view returns (uint8) {
        bytes32 dataHash = keccak256(abi.encode(contentHash, previousHash, issuedAt));
        return _liveCount(_candidateConfirmers[keccak256(abi.encode(_id(listKey, version), dataHash))]);
    }

    /// @inheritdoc ITrustListAnchorRegistry
    function logCandidateConfirmations(bytes32 logKey, uint64 seq, bytes32 lineHash, uint64 ts)
        external
        view
        returns (uint8)
    {
        bytes32 dataHash = keccak256(abi.encode(lineHash, ts));
        return _liveCount(_candidateConfirmers[keccak256(abi.encode(_id(logKey, seq), dataHash))]);
    }

    /// @inheritdoc ITrustListAnchorRegistry
    function candidateCount(bytes32 key, uint64 versionOrSeq) external view returns (uint32) {
        return _candidateCount[_id(key, versionOrSeq)];
    }

    function _id(bytes32 key, uint64 versionOrSeq) private pure returns (bytes32) {
        return keccak256(abi.encodePacked(key, versionOrSeq));
    }
}
