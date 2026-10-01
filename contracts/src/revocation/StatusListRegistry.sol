// SPDX-License-Identifier: Apache-2.0
pragma solidity ^0.8.24;

import {Initializable} from "@openzeppelin/contracts-upgradeable/proxy/utils/Initializable.sol";
import {UUPSUpgradeable} from "@openzeppelin/contracts-upgradeable/proxy/utils/UUPSUpgradeable.sol";

import {IStatusListRegistry} from "../interfaces/IStatusListRegistry.sol";
import {IIssuerRegistry} from "../interfaces/IIssuerRegistry.sol";

/**
 * @title  StatusListRegistry
 * @notice İptal listesi ÇAPASI. Zincirde tek bir iptal biti yoktur.
 *
 * @dev    SPEC-BC-0001 §7, SPEC-CRED-0003 §4, ADR-0008.
 *
 *         ═══ 1.0.0'DAN FARK ═══
 *         Önceki sürüm bitmap'i zincirde tutuyordu (setRevoked, getChunk,
 *         _setBit). KALDIRILDI. Gerekçe (ADR-0008 §1): her iptali zincire
 *         yazmak, izinli ağda tüm validator'lara iptalin ANINI sızdırır; blok
 *         zaman damgasıyla birleşince belge sahibi daraltılabilir.
 *
 *         isRevoked() BİLEREK YOKTUR — bkz. IStatusListRegistry.
 *
 *         Değişmezler:
 *           L1  version monoton artar (issuer listeyi geri alamaz).
 *           L1b publishedAt geri gitmez: yeni sürüm eskisinden önce yayınlanmış
 *               gösterilemez (doğrulayıcının tazelik denetimi aldatılamaz).
 *           L2  listSize >= MIN_LIST_SIZE.
 *           L3  bitsPerEntry == REQUIRED_BITS.
 *           L4  listURI bir kez yazılır.
 *           L5  İndeks tahsisi, doluluk ve URI opaklığı KONTRAT DIŞIDIR —
 *               SPEC-CRED-0003 §6'da normatiftir. Kontrat bunları zorlayamaz.
 */
contract StatusListRegistry is Initializable, UUPSUpgradeable, IStatusListRegistry {
    /// @notice Sürü mahremiyeti tabanı (SPEC-CRED-0003 §6.2).
    uint32 public constant MIN_LIST_SIZE = 100_000;

    /// @notice Tamga profili her zaman 2 bit (SPEC-CRED-0003 §3.3 — askı gerekiyor).
    uint8 public constant REQUIRED_BITS = 2;

    /// @notice Günlük yayın kotası: 24 yayın + yeniden deneme payı (SPEC-BC-0001 §12.2).
    uint32 public constant MAX_PUBLISH_PER_DAY = 48;

    /// @notice publishedAt için kabul edilen ileri sapma.
    uint64 public constant MAX_CLOCK_SKEW = 300;

    IIssuerRegistry public issuerRegistry;
    address public governance;

    mapping(bytes32 => ListAnchor) private _anchors;
    mapping(bytes32 => bytes32[]) private _byIssuer;
    mapping(bytes32 => mapping(uint64 => uint32)) private _publishCount;

    uint256[45] private __gap;

    /// @custom:oz-upgrades-unsafe-allow constructor
    constructor() {
        _disableInitializers();
    }

    function initialize(address issuerRegistry_, address governance_) external initializer {
        if (issuerRegistry_ == address(0) || governance_ == address(0)) revert ZeroAddress();
        __UUPSUpgradeable_init();
        issuerRegistry = IIssuerRegistry(issuerRegistry_);
        governance = governance_;
    }

    function _authorizeUpgrade(address) internal view override {
        if (msg.sender != governance) revert NotGovernance(msg.sender);
    }

    /// @dev R2: askıya alınmış issuer yayın yapamaz. CA rotasyonu ise ENGEL DEĞİLDİR
    ///      (isOperational, CA'ya bakmaz — review bulgusu R2).
    modifier onlyIssuerDelegate(bytes32 issuerId) {
        if (!issuerRegistry.isIssuerDelegate(issuerId, msg.sender)) {
            revert NotIssuerDelegate(issuerId, msg.sender);
        }
        if (!issuerRegistry.isOperational(issuerId)) revert IssuerNotActive(issuerId);
        _;
    }

    /**
     * @dev Review bulgusu R4: REVOKED bir issuer'ın listesini HALEFİ yayınlayabilmeli.
     *      Bakanlık kapandı, diplomalar geçerli (yumuşak iptal) — ama sahte bir
     *      diplomayı kim iptal edecek? Halef. Aksi hâlde eski liste donar.
     */
    function _canOperateList(bytes32 issuerId) private view returns (bool) {
        if (issuerRegistry.isIssuerDelegate(issuerId, msg.sender) && issuerRegistry.isOperational(issuerId)) {
            return true;
        }
        bytes32 succ = issuerRegistry.getIssuer(issuerId).successorId;
        if (succ == bytes32(0)) return false;
        return issuerRegistry.isIssuerDelegate(succ, msg.sender) && issuerRegistry.isOperational(succ);
    }

    /// @inheritdoc IStatusListRegistry
    function listIdOf(bytes32 issuerId, string calldata listURI) public pure returns (bytes32) {
        return keccak256(abi.encodePacked(issuerId, bytes(listURI)));
    }

    /// @inheritdoc IStatusListRegistry
    function registerList(bytes32 issuerId, string calldata listURI, uint32 listSize, uint8 bitsPerEntry)
        external
        onlyIssuerDelegate(issuerId)
        returns (bytes32 listId)
    {
        if (bytes(listURI).length == 0) revert EmptyListURI();
        if (listSize < MIN_LIST_SIZE) revert ListSizeTooSmall(listSize, MIN_LIST_SIZE);       // L2
        if (bitsPerEntry != REQUIRED_BITS) revert InvalidBitsPerEntry(bitsPerEntry);          // L3

        listId = keccak256(abi.encodePacked(issuerId, bytes(listURI)));
        if (_anchors[listId].status != ListStatus.NONE) revert ListExists(listId);

        ListAnchor storage a = _anchors[listId];
        a.issuerId = issuerId;
        a.listURI = listURI;      // L4 — bir daha yazılmaz
        a.listSize = listSize;
        a.bitsPerEntry = bitsPerEntry;
        a.status = ListStatus.ACTIVE;
        // contentHash ve version ilk publishList ile dolar.

        _byIssuer[issuerId].push(listId);
        emit ListRegistered(listId, issuerId, listURI, listSize);
    }

    /**
     * @inheritdoc IStatusListRegistry
     * @dev SIRA KURALI (SPEC-CRED-0003 §5.2): bu çağrı, token CDN'e yazıldıktan
     *      SONRA yapılmalıdır. Ters sırada zincirde kayıtlı ama erişilemeyen bir
     *      sürüm oluşur ve tüm doğrulamalar düşer. Kontrat bunu göremez —
     *      yayın hattı disiplinidir.
     *
     *      Yayın SABİT ARALIKLI ve GÜRÜLTÜLÜ olmalıdır (§5.1): değişiklik olmasa
     *      da yayınlanır. Aksi hâlde bu işlemin varlığı iptal ANINI sızdırır.
     */
    function publishList(bytes32 listId, bytes32 contentHash, uint64 version, uint64 publishedAt) external {
        ListAnchor storage a = _require(listId);

        if (!_canOperateList(a.issuerId)) revert NotIssuerDelegate(a.issuerId, msg.sender);
        if (a.status != ListStatus.ACTIVE) revert ListNotActive(listId);
        if (contentHash == bytes32(0)) revert EmptyContentHash();
        if (version <= a.version) revert VersionNotMonotonic(a.version, version);            // L1
        if (publishedAt > uint64(block.timestamp) + MAX_CLOCK_SKEW) {
            revert PublishedAtInFuture(publishedAt);
        }

        uint64 effectiveAt = publishedAt == 0 ? uint64(block.timestamp) : publishedAt;
        if (effectiveAt < a.publishedAt) revert PublishedAtNotMonotonic(a.publishedAt, effectiveAt);     // L1b

        uint64 day = uint64(block.timestamp / 1 days);
        uint32 next = _publishCount[listId][day] + 1;
        if (next > MAX_PUBLISH_PER_DAY) revert PublishQuotaExceeded(listId, MAX_PUBLISH_PER_DAY);
        _publishCount[listId][day] = next;

        a.contentHash = contentHash;
        a.version = version;
        a.publishedAt = effectiveAt;

        emit ListPublished(listId, version, contentHash, a.publishedAt);
    }

    /// @inheritdoc IStatusListRegistry
    function retireList(bytes32 listId, string calldata reason) external {
        ListAnchor storage a = _require(listId);
        if (!_canOperateList(a.issuerId)) revert NotIssuerDelegate(a.issuerId, msg.sender);
        if (a.status != ListStatus.ACTIVE) revert ListNotActive(listId);
        a.status = ListStatus.RETIRED;
        emit ListRetired(listId, reason);
    }

    /// @inheritdoc IStatusListRegistry
    function getListAnchor(bytes32 listId) external view returns (ListAnchor memory) {
        ListAnchor memory a = _anchors[listId];
        if (a.status == ListStatus.NONE) revert UnknownList(listId);
        return a;
    }

    /**
     * @inheritdoc IStatusListRegistry
     * @dev Bu fonksiyon TAZELİĞE BAKMAZ. Doğrulayıcı ayrıca getListAnchor ile
     *      version/publishedAt tazeliğini kontrol etmelidir (SPEC-CRED-0003 §8).
     */
    function matchesContentHash(bytes32 listId, bytes32 hash) external view returns (bool) {
        ListAnchor storage a = _anchors[listId];
        if (a.status != ListStatus.ACTIVE) return false;
        if (a.version == 0) return false;
        return a.contentHash == hash;
    }

    function getListsByIssuer(bytes32 issuerId) external view returns (bytes32[] memory) {
        return _byIssuer[issuerId];
    }

    function publishCountToday(bytes32 listId) external view returns (uint32) {
        return _publishCount[listId][uint64(block.timestamp / 1 days)];
    }

    function _require(bytes32 listId) private view returns (ListAnchor storage a) {
        a = _anchors[listId];
        if (a.status == ListStatus.NONE) revert UnknownList(listId);
    }
}
