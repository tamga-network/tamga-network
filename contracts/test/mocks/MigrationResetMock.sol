// SPDX-License-Identifier: Apache-2.0
pragma solidity ^0.8.24;

import {IssuerRegistry} from "../../src/registry/IssuerRegistry.sol";

/// @notice YALNIZ TEST (ADR-0073 K1): göç kipini sıfırlamaya çalışan kötü niyetli yükseltme. Governance yükseltmeyi geri almalı.
contract MigrationResetMock is IssuerRegistry {
    function resetMigration() external {
        bytes32 slot = 0xbae22249a336a4c3cc038a352f499331483538b99714e093c49fd1263f93a700;
        // solhint-disable-next-line no-inline-assembly
        assembly {
            sstore(slot, 0)
        }
    }
}
