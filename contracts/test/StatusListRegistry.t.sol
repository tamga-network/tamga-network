// SPDX-License-Identifier: Apache-2.0
pragma solidity ^0.8.24;

import {TamgaTestBase} from "./helpers/TamgaTestBase.sol";
import {IStatusListRegistry} from "../src/interfaces/IStatusListRegistry.sol";
import {ITamgaErrors} from "../src/interfaces/ITamgaErrors.sol";
import {IIssuerRegistry} from "../src/interfaces/IIssuerRegistry.sol";

/// @notice SPEC-BC-0001 §7 / SPEC-CRED-0003 — L1..L5 ve capa modeli.
contract StatusListRegistryTest is TamgaTestBase {
    string constant URI = "https://status.bilgi.edu.tr/v1/sl/7f3a9c21";
    bytes32 listId;

    function setUp() public override {
        super.setUp();
        vm.prank(uniOperator);
        listId = statusLists.registerList(uniIssuer, URI, 100_000, 2);
    }

    /// L2: 100.000'in altinda liste acilamaz (surü mahremiyeti).
    function test_RevertWhen_ListTooSmall() public {
        vm.prank(uniOperator);
        vm.expectRevert(
            abi.encodeWithSelector(IStatusListRegistry.ListSizeTooSmall.selector, uint32(999), uint32(100_000))
        );
        statusLists.registerList(uniIssuer, "https://status.bilgi.edu.tr/v1/sl/kucuk", 999, 2);
    }

    /// L3: bits her zaman 2 (aski durumu icin gerekli).
    function test_RevertWhen_WrongBits() public {
        vm.prank(uniOperator);
        vm.expectRevert(abi.encodeWithSelector(IStatusListRegistry.InvalidBitsPerEntry.selector, uint8(1)));
        statusLists.registerList(uniIssuer, "https://status.bilgi.edu.tr/v1/sl/bir", 100_000, 1);
    }

    /**
     * L1 — EN ÖNEMLİ TEST.
     * Issuer, kendi sunucusundaki listeyi geri alıp iptal edilmiş bir belgeyi
     * yeniden "geçerli" gösteremez: zincirdeki sürüm monoton artar.
     */
    function test_RevertWhen_VersionGoesBackwards() public {
        vm.startPrank(uniOperator);
        statusLists.publishList(listId, keccak256("v5"), 5, uint64(block.timestamp));
        vm.expectRevert(
            abi.encodeWithSelector(IStatusListRegistry.VersionNotMonotonic.selector, uint64(5), uint64(4))
        );
        statusLists.publishList(listId, keccak256("v4"), 4, uint64(block.timestamp));
        vm.stopPrank();
    }

    function test_PublishAndMatch() public {
        bytes32 h = keccak256("token-bytes");
        vm.prank(uniOperator);
        statusLists.publishList(listId, h, 1, uint64(block.timestamp));

        assertTrue(statusLists.matchesContentHash(listId, h));
        assertFalse(statusLists.matchesContentHash(listId, keccak256("baska")));
        assertEq(statusLists.getListAnchor(listId).version, 1);
    }

    /// Hic yayinlanmamis liste eslesmez — yoksa bytes32(0) tuzagi olurdu.
    function test_UnpublishedList_MatchesNothing() public {
        assertFalse(statusLists.matchesContentHash(listId, bytes32(0)));
    }

    /// R2: askiya alinmis issuer yayin yapamaz.
    function test_RevertWhen_SuspendedIssuerPublishes() public {
        vm.prank(trDelegate);
        issuers.suspendIssuer(uniIssuer);

        vm.prank(uniOperator);
        vm.expectRevert(abi.encodeWithSelector(IStatusListRegistry.IssuerNotActive.selector, uniIssuer));
        statusLists.publishList(listId, keccak256("v1"), 1, uint64(block.timestamp));
    }

    /// Yabanci anahtar yayin yapamaz.
    function test_RevertWhen_StrangerPublishes() public {
        vm.prank(stranger);
        vm.expectRevert(
            abi.encodeWithSelector(IStatusListRegistry.NotIssuerDelegate.selector, uniIssuer, stranger)
        );
        statusLists.publishList(listId, keccak256("v1"), 1, uint64(block.timestamp));
    }

    /// Kota: gunde 48 yayin.
    function test_RevertWhen_PublishQuotaExceeded() public {
        vm.startPrank(uniOperator);
        for (uint64 v = 1; v <= 48; v++) {
            statusLists.publishList(listId, keccak256(abi.encode(v)), v, uint64(block.timestamp));
        }
        vm.expectRevert(
            abi.encodeWithSelector(IStatusListRegistry.PublishQuotaExceeded.selector, listId, uint32(48))
        );
        statusLists.publishList(listId, keccak256("49"), 49, uint64(block.timestamp));
        vm.stopPrank();
    }

    function test_RevertWhen_PublishedAtInFuture() public {
        uint64 future = uint64(block.timestamp + 1 hours);
        vm.prank(uniOperator);
        vm.expectRevert(abi.encodeWithSelector(IStatusListRegistry.PublishedAtInFuture.selector, future));
        statusLists.publishList(listId, keccak256("v1"), 1, future);
    }

    /// L1b: yeni surum eskisinden once yayinlanmis gibi gosterilemez (tazelik aldatmasi).
    function test_RevertWhen_PublishedAtGoesBackwards() public {
        vm.warp(10 days); // varsayilan block.timestamp = 1; geriye 1 saat icin yer ac
        uint64 t = uint64(block.timestamp);
        vm.startPrank(uniOperator);
        statusLists.publishList(listId, keccak256("v1"), 1, t);
        vm.expectRevert(
            abi.encodeWithSelector(IStatusListRegistry.PublishedAtNotMonotonic.selector, t, t - 1 hours)
        );
        statusLists.publishList(listId, keccak256("v2"), 2, t - 1 hours);
        statusLists.publishList(listId, keccak256("v2"), 2, t); // ayni an kabul
        vm.stopPrank();
    }

    /// R4: REVOKED issuer'in listesini HALEFI yayinlayabilir.
    function test_Successor_CanPublishPredecessorList() public {
        bytes32 yok = _registerIssuer(TR, trDelegate, trCA, keccak256("YOK-CERT"),
            IIssuerRegistry.IssuerCategory.GOVERNMENT, IIssuerRegistry.IssuerAssurance.I3);
        address yokOp = makeAddr("yokOp");
        address[] memory k = new address[](1); k[0] = yokOp;
        vm.startPrank(trDelegate);
        issuers.setIssuerDelegates(yok, k);
        issuers.revokeIssuer(uniIssuer, yok);
        vm.stopPrank();

        // Eski operator artik yayinlayamaz (issuer REVOKED, operational degil)
        vm.prank(uniOperator);
        vm.expectRevert();
        statusLists.publishList(listId, keccak256("v1"), 1, uint64(block.timestamp));

        // Halef yayinlayabilir
        vm.prank(yokOp);
        statusLists.publishList(listId, keccak256("v1"), 1, uint64(block.timestamp));
        assertEq(statusLists.getListAnchor(listId).version, 1);
    }

    /// R2: CA rotasyonu status yayinini DURDURMAZ.
    function test_RootCARetired_PublishStillWorks() public {
        vm.prank(trDelegate);
        cas.retireRootCA(trCA, bytes32(0));
        vm.prank(uniOperator);
        statusLists.publishList(listId, keccak256("v1"), 1, uint64(block.timestamp));
        assertEq(statusLists.getListAnchor(listId).version, 1);
    }

    /**
     * ADR-0008 — isRevoked ARAYÜZÜ YOKTUR.
     * Bu test derleyici seviyesinde garanti edilemez; belge niteliğindedir.
     * Zincirden iptal durumu okumaya çalışan kod DERLENMEMELIDIR.
     */
    function test_Documentation_NoRevocationQueryOnChain() public view {
        // statusLists.isRevoked(...) diye bir fonksiyon YOK — kasitli.
        // Iptal durumu SPEC-CRED-0003 §7 uyarinca off-chain token'dan okunur.
        assertEq(statusLists.getListAnchor(listId).bitsPerEntry, 2);
    }
}
