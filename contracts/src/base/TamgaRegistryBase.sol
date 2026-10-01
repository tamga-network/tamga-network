// SPDX-License-Identifier: Apache-2.0
pragma solidity ^0.8.24;

import {Initializable} from "@openzeppelin/contracts-upgradeable/proxy/utils/Initializable.sol";
import {UUPSUpgradeable} from "@openzeppelin/contracts-upgradeable/proxy/utils/UUPSUpgradeable.sol";

import {ISovereignty} from "../interfaces/ISovereignty.sol";
import {ITamgaErrors} from "../interfaces/ITamgaErrors.sol";

/**
 * @title  TamgaRegistryBase
 * @notice Tüm ulusal kayıt kontratlarının ortak tabanı: egemenlik kontrolü,
 *         günlük yazma kotası ve UUPS yükseltme yetkisi.
 *
 * @dev    SPEC-BC-0001 §0 (egemenlik), §9 (UUPS), §10 (roller), §12 (kota).
 *
 *         ═══ YÜKSELTME UYARISI — UUPS BRICK ═══
 *         `_authorizeUpgrade` bu tabanda tanımlıdır. Türeyen bir kontrat onu
 *         override edip yetkiyi gevşetirse veya yeni implementasyon bu tabanı
 *         kalıtmazsa, proxy KALICI OLARAK KİLİTLENİR.
 *         Azaltma zorunludur: script/check-upgrade-safety.sh CI'da çalışır.
 *
 *         ═══ DEPOLAMA DÜZENİ ═══
 *         Bu tabana yeni değişken eklerken __gap'i AYNI SAYIDA azalt.
 *         Sıra asla değiştirilmez, ara değişken silinmez.
 */
abstract contract TamgaRegistryBase is Initializable, UUPSUpgradeable, ITamgaErrors {
    /// @notice SPEC-BC-0001 §12.2 — devlet başına günlük yazma tavanı.
    uint32 public constant MAX_WRITES_PER_STATE_PER_DAY = 10_000;

    ISovereignty public sovereignty;
    address public governance;

    /// @dev stateCode => (UTC gün => o gün yapılan yazma sayısı)
    mapping(bytes2 => mapping(uint64 => uint32)) private _writeCount;

    uint256[46] private __gap;

    // -----------------------------------------------------------------
    // Kurulum
    // -----------------------------------------------------------------

    /// @custom:oz-upgrades-unsafe-allow constructor
    constructor() {
        _disableInitializers();
    }

    function __TamgaRegistryBase_init(address sovereignty_, address governance_)
        internal
        onlyInitializing
    {
        if (sovereignty_ == address(0) || governance_ == address(0)) revert ZeroAddress();
        __UUPSUpgradeable_init();
        sovereignty = ISovereignty(sovereignty_);
        governance = governance_;
    }

    // -----------------------------------------------------------------
    // Yetki
    // -----------------------------------------------------------------

    /// @dev SPEC-BC-0001 §0 / Değişmez N1.
    modifier onlyOwnerState(bytes2 stateCode) {
        if (!sovereignty.isDelegateOf(msg.sender, stateCode)) {
            revert NotOwnerState(stateCode, msg.sender);
        }
        _countWrite(stateCode);
        _;
    }

    modifier onlyGovernance() {
        if (msg.sender != governance) revert NotGovernance(msg.sender);
        _;
    }

    /// @dev SPEC-BC-0001 §9. Yalnızca Governance 2/3 oyla yükseltebilir.
    function _authorizeUpgrade(address) internal view override onlyGovernance {}

    // -----------------------------------------------------------------
    // Kota
    // -----------------------------------------------------------------

    function _countWrite(bytes2 stateCode) private {
        uint64 day = uint64(block.timestamp / 1 days);
        uint32 next = _writeCount[stateCode][day] + 1;
        if (next > MAX_WRITES_PER_STATE_PER_DAY) {
            revert QuotaExceeded(stateCode, MAX_WRITES_PER_STATE_PER_DAY);
        }
        _writeCount[stateCode][day] = next;
    }

    function writeCountToday(bytes2 stateCode) external view returns (uint32) {
        return _writeCount[stateCode][uint64(block.timestamp / 1 days)];
    }
}
