// SPDX-License-Identifier: Apache-2.0
pragma solidity ^0.8.24;

/// @notice YALNIZ TEST (kontrat denetimi 2026-11-11, Y1): aynı adrese farklı kod koyan CREATE2 fabrikası. Başlangıç kodu
///         sabittir (çalışma kodunu fabrikadan okur), bu yüzden adres koda bağlı değildir; Shanghai kurallarında SELFDESTRUCT
///         kodu sildiğinden aynı tuzla yeniden dağıtım aynı adrese başka kod koyar.
contract MetamorphicFactoryMock {
    bytes public pending;

    function deploy(bytes32 salt, bytes calldata runtime) external returns (address a) {
        pending = runtime;
        a = address(new MetamorphMock{salt: salt}());
    }
}

contract MetamorphMock {
    constructor() {
        bytes memory code = MetamorphicFactoryMock(msg.sender).pending();
        // solhint-disable-next-line no-inline-assembly
        assembly {
            return(add(code, 32), mload(code))
        }
    }
}

/// @dev Kendi başına duran sahte implementasyon: UUPS'in istediği `proxiableUUID` ile Governance'ın yükseltmeden önce ve sonra
///      karşılaştırdığı `migrationState` (başlamamış kip) dışında kayıt mantığı taşımaz. OpenZeppelin'in `proxiableUUID`'si
///      kendi adresine bağlıdır (`notDelegated`), kopyalanan kodda çalışmaz; bu yüzden kalıtılmaz.
abstract contract CopiedImplMock {
    function proxiableUUID() external pure returns (bytes32) {
        return 0x360894a13ba1a3210667c828492db98dca3e2076cc3735a920a3ca505d382bbc;
    }

    function migrationState() external pure returns (uint8, uint64, uint64, bytes32, address) {
        return (0, 0, 0, bytes32(0), address(0));
    }
}

/// @notice İncelemeden geçen sürüm: zararsız görünür, ama kendini silebilir. (Derleyicinin `selfdestruct` uyarısı beklenir.)
contract ReviewedImplMock is CopiedImplMock {
    function retire() external {
        selfdestruct(payable(msg.sender));
    }
}

/// @notice Oylamadan sonra aynı adrese konan sürüm: kimsenin incelemediği bir fonksiyon taşır.
contract SwappedImplMock is CopiedImplMock {
    function backdoor() external pure returns (uint256) {
        return 0xBAD;
    }
}
