// SPDX-License-Identifier: Apache-2.0
pragma solidity ^0.8.24;

import {TamgaTestBase} from "./helpers/TamgaTestBase.sol";
import {ISchemaRegistry} from "../src/interfaces/ISchemaRegistry.sol";
import {ITamgaErrors} from "../src/interfaces/ITamgaErrors.sol";

/// @notice SPEC-BC-0001 §4 / ADR-0007 — S1, S2, S3 ve iki katmanlı yetki.
contract SchemaRegistryTest is TamgaTestBase {
    string constant NATIONAL_VCT = "https://schema.tamga.network/v1/tr/edu/YOKDenklikCredential/1.0.0";
    string constant NETWORK_VCT = "https://schema.tamga.network/v1/edu/DiplomaCredential/1.0.0";

    function test_NationalSchema_NoVoteNeeded() public {
        bytes32 id = _registerNationalSchema(TR, trDelegate, NATIONAL_VCT, keccak256("meta"));
        assertTrue(schemas.isActiveSchema(id));
        assertEq(schemas.getSchema(id).stateCode, TR);
    }

    /// NATIONAL: baska devlet yazamaz.
    function test_RevertWhen_ForeignStateRegistersNational() public {
        ISchemaRegistry.SchemaRecord memory r = _rec(NATIONAL_VCT, ISchemaRegistry.SchemaTier.NATIONAL, TR);
        vm.prank(kzDelegate);
        vm.expectRevert(abi.encodeWithSelector(ITamgaErrors.NotOwnerState.selector, TR, kzDelegate));
        schemas.registerSchema(r);
    }

    /// NETWORK: dogrudan yazilamaz, Governance gerekir.
    function test_RevertWhen_StateRegistersNetworkDirectly() public {
        ISchemaRegistry.SchemaRecord memory r =
            _rec(NETWORK_VCT, ISchemaRegistry.SchemaTier.NETWORK, bytes2(0));
        vm.prank(trDelegate);
        vm.expectRevert(ISchemaRegistry.NetworkTierRequiresGovernance.selector);
        schemas.registerSchema(r);
    }

    /// NETWORK: 2/3 oyla gecer.
    function test_NetworkSchema_ViaGovernance() public {
        ISchemaRegistry.SchemaRecord memory r =
            _rec(NETWORK_VCT, ISchemaRegistry.SchemaTier.NETWORK, bytes2(0));

        vm.prank(trValidator);
        bytes32 pid = gov.proposeNetworkSchema(r);
        vm.prank(trValidator);
        gov.vote(pid, true);
        vm.prank(kzValidator);
        gov.vote(pid, true);
        gov.execute(pid);

        assertTrue(schemas.isActiveSchema(keccak256(bytes(NETWORK_VCT))));
    }

    /// S1: ayni vctURI iki kez kaydedilemez.
    function test_RevertWhen_DuplicateSchema() public {
        _registerNationalSchema(TR, trDelegate, NATIONAL_VCT, keccak256("meta"));
        ISchemaRegistry.SchemaRecord memory r = _rec(NATIONAL_VCT, ISchemaRegistry.SchemaTier.NATIONAL, TR);
        vm.prank(trDelegate);
        vm.expectRevert(
            abi.encodeWithSelector(ISchemaRegistry.SchemaExists.selector, keccak256(bytes(NATIONAL_VCT)))
        );
        schemas.registerSchema(r);
    }

    /**
     * S3 — EN ÖNEMLİ TEST.
     * DEPRECATED bir şema yeni ihraç için kapalıdır AMA içerik hash'i hâlâ
     * eşleşir: o şemayla verilmiş eski diplomalar doğrulanabilir kalmalıdır.
     * Bir diplomanın ömrü şema sürümünden uzundur.
     */
    function test_DeprecatedSchema_StillVerifiable() public {
        bytes32 hash = keccak256("meta-v1");
        bytes32 id = _registerNationalSchema(TR, trDelegate, NATIONAL_VCT, hash);

        vm.prank(trDelegate);
        schemas.deprecateSchema(id, bytes32(0));

        assertFalse(schemas.isActiveSchema(id), "yeni ihrac kapali olmali");
        assertTrue(schemas.matchesContentHash(id, hash), "eski belgeler dogrulanabilir kalmali");
    }

    /// REVOKED sema ise dogrulanamaz — istisnai durum.
    function test_RevokedSchema_NotVerifiable() public {
        bytes32 hash = keccak256("meta-v1");
        bytes32 id = _registerNationalSchema(TR, trDelegate, NATIONAL_VCT, hash);

        vm.prank(trDelegate);
        schemas.revokeSchema(id, "sd:never on national id number");

        assertFalse(schemas.matchesContentHash(id, hash));
    }

    function test_RevertWhen_SelfSuccession() public {
        bytes32 id = _registerNationalSchema(TR, trDelegate, NATIONAL_VCT, keccak256("m"));
        vm.prank(trDelegate);
        vm.expectRevert(ISchemaRegistry.SelfSuccession.selector);
        schemas.deprecateSchema(id, id);
    }

    function testFuzz_ContentHashMismatch(bytes32 wrong) public {
        bytes32 hash = keccak256("meta");
        vm.assume(wrong != hash);
        bytes32 id = _registerNationalSchema(TR, trDelegate, NATIONAL_VCT, hash);
        assertFalse(schemas.matchesContentHash(id, wrong));
    }

    function _rec(string memory vct, ISchemaRegistry.SchemaTier tier, bytes2 st)
        internal pure returns (ISchemaRegistry.SchemaRecord memory r)
    {
        r.vctURI = vct;
        r.contentHash = keccak256("meta");
        r.version = "1.0.0";
        r.tier = tier;
        r.stateCode = st;
        r.status = ISchemaRegistry.SchemaStatus.ACTIVE;
    }
}
