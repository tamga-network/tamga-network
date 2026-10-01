// SPDX-License-Identifier: Apache-2.0
pragma solidity ^0.8.24;

import {TamgaTestBase} from "./helpers/TamgaTestBase.sol";
import {ITamgaErrors} from "../src/interfaces/ITamgaErrors.sol";
import {IIssuerRegistry} from "../src/interfaces/IIssuerRegistry.sol";

/// @notice SPEC-BC-0001 §0 / Değişmez N1 — egemenlik koda gömülüdür.
contract SovereigntyTest is TamgaTestBase {
    /// Türkiye'nin anahtarı Kazakistan namespace'ine yazamaz.
    function test_RevertWhen_ForeignStateWrites() public {
        vm.prank(trDelegate);
        vm.expectRevert(abi.encodeWithSelector(ITamgaErrors.NotOwnerState.selector, KZ, trDelegate));
        _kzIssuerAttempt();
    }

    function _kzIssuerAttempt() internal {
        IIssuerRegistry.Issuer memory i;
        i.stateCode = KZ;
        i.certFingerprint = keccak256("KZ-UNI");
        i.parentCA = trCA;
        i.status = IIssuerRegistry.IssuerStatus.ACTIVE;
        i.validFrom = uint64(block.timestamp);
        i.validUntil = uint64(block.timestamp + 365 days);
        issuers.registerIssuer(i);
    }

    /// Delege olmayan hiç kimse yazamaz.
    function test_RevertWhen_StrangerWrites() public {
        vm.prank(stranger);
        vm.expectRevert(abi.encodeWithSelector(ITamgaErrors.NotOwnerState.selector, TR, stranger));
        issuers.suspendIssuer(uniIssuer);
    }

    /// R1: issuer operasyon anahtarı ULUSAL kayda yazamaz.
    function test_RevertWhen_IssuerDelegateWritesNationalRecord() public {
        vm.prank(uniOperator);
        vm.expectRevert(abi.encodeWithSelector(ITamgaErrors.NotOwnerState.selector, TR, uniOperator));
        issuers.suspendIssuer(uniIssuer);
    }

    /// Devlet çıkarıldığında delege anahtarı yetkisini kaybeder — ama kayıtlar durur (G1).
    function test_RemovedState_LosesWriteAccess_ButRecordsSurvive() public {
        assertTrue(issuers.isValidIssuer(uniIssuer), "issuer bastan gecerli olmali");

        bytes32 pid = _removeTR();
        gov.execute(pid);

        assertFalse(gov.isActiveMember(TR), "TR artik aktif uye degil");
        assertFalse(gov.isDelegateOf(trDelegate, TR), "delege yetkisi dusmeli");

        // G1: kayit SILINMEDI.
        assertEq(issuers.getIssuer(uniIssuer).certFingerprint, keccak256("BILGI-CERT"));
    }

    function _removeTR() internal returns (bytes32 pid) {
        vm.prank(kzValidator);
        pid = gov.proposeStateRemoval(TR, "test");
        vm.prank(kzValidator);
        gov.vote(pid, true);
        vm.prank(azValidator);
        gov.vote(pid, true);
    }

    /// R6: tek oy yetmez — KZ tek başına TR'yi atamaz.
    function test_RevertWhen_SingleVoteRemoval() public {
        vm.prank(kzValidator);
        bytes32 pid = gov.proposeStateRemoval(TR, "test");
        vm.prank(kzValidator);
        gov.vote(pid, true);
        vm.expectRevert();
        gov.execute(pid);
    }

    /// R7: çıkarılan devlet yeniden kabul edilebilir.
    function test_RemovedState_CanBeReadmitted() public {
        gov.execute(_removeTR());
        address newTrValidator = makeAddr("trValidator2");

        vm.prank(kzValidator);
        bytes32 pid = gov.proposeStateAdmission(TR, newTrValidator);
        vm.prank(kzValidator);
        gov.vote(pid, true);
        vm.prank(azValidator);
        gov.vote(pid, true);
        gov.execute(pid);

        assertTrue(gov.isActiveMember(TR));
        assertEq(gov.getMember(TR).validatorAddress, newTrValidator);
        assertFalse(gov.isDelegateOf(trDelegate, TR), "eski delege dusmus olmali");
    }

    /// ADR-0002: cikarma oylamasinda cikarilanin oyu SAYILMAZ.
    function test_RevertWhen_RemovalTargetVotes() public {
        vm.prank(kzValidator);
        bytes32 pid = gov.proposeStateRemoval(TR, "test");
        vm.prank(trValidator);
        vm.expectRevert();
        gov.vote(pid, false);
    }
}
