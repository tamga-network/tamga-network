// SPDX-License-Identifier: Apache-2.0
pragma solidity ^0.8.24;

import {TamgaTestBase} from "./helpers/TamgaTestBase.sol";
import {IIssuerRegistry} from "../src/interfaces/IIssuerRegistry.sol";

/// @notice SPEC-BC-0001 §3 — allowlist (I1), yumusak iptal, kategori asimi.
contract IssuerRegistryTest is TamgaTestBase {
    string constant EDU = "https://schema.tamga.network/v1/edu/DiplomaCredential/1.0.0";
    string constant HEALTH = "https://schema.tamga.network/v1/tr/health/VaccinationCredential/1.0.0";

    /**
     * ═══ PM-SCHEMA-0001 ZAFİYET 1 ═══
     * Bu test, tüm şema kayıt defterinin var oluş sebebidir.
     * EDUCATION kategorili üniversite geçerli bir issuer'dır; imzası doğrulanır;
     * sertifikası geçerlidir. Ama sağlık şemasına YETKİLENDİRİLMEMİŞTİR.
     * Yetki adımı olmasaydı sistem bu belgeyi sessizce kabul ederdi.
     */
    function test_CategoryOverreach_IsBlocked() public {
        bytes32 eduSchema = _registerNationalSchema(TR, trDelegate, EDU, keccak256("edu"));
        bytes32 healthSchema = _registerNationalSchema(TR, trDelegate, HEALTH, keccak256("health"));

        vm.prank(trDelegate);
        issuers.setSchemaAuthorization(uniIssuer, eduSchema, true);

        assertTrue(issuers.isValidIssuer(uniIssuer), "issuer gecerli");
        assertTrue(issuers.isAuthorizedForSchema(uniIssuer, eduSchema), "diplomaya yetkili");
        assertFalse(issuers.isAuthorizedForSchema(uniIssuer, healthSchema), "asi kartina YETKILI DEGIL");
    }

    /// I1: varsayilan false — hicbir sey yapmadan hicbir semaya yetki yok.
    function test_SchemaAuthorization_DefaultsToFalse() public {
        bytes32 eduSchema = _registerNationalSchema(TR, trDelegate, EDU, keccak256("edu"));
        assertFalse(issuers.isAuthorizedForSchema(uniIssuer, eduSchema));
    }

    /// DEPRECATED sema ile YENI ihrac yapilamaz (3. kosul).
    function test_DeprecatedSchema_BlocksNewIssuance() public {
        bytes32 eduSchema = _registerNationalSchema(TR, trDelegate, EDU, keccak256("edu"));
        vm.prank(trDelegate);
        issuers.setSchemaAuthorization(uniIssuer, eduSchema, true);
        assertTrue(issuers.isAuthorizedForSchema(uniIssuer, eduSchema));

        vm.prank(trDelegate);
        schemas.deprecateSchema(eduSchema, bytes32(0));

        assertFalse(issuers.isAuthorizedForSchema(uniIssuer, eduSchema), "deprecated ile yeni ihrac yok");
    }

    /// Yetki geri alinabilir ve listeden dusmelidir.
    function test_RevokeAuthorization() public {
        bytes32 eduSchema = _registerNationalSchema(TR, trDelegate, EDU, keccak256("edu"));
        vm.startPrank(trDelegate);
        issuers.setSchemaAuthorization(uniIssuer, eduSchema, true);
        assertEq(issuers.authorizedSchemasOf(uniIssuer).length, 1);
        issuers.setSchemaAuthorization(uniIssuer, eduSchema, false);
        vm.stopPrank();
        assertEq(issuers.authorizedSchemasOf(uniIssuer).length, 0);
        assertFalse(issuers.isAuthorizedForSchema(uniIssuer, eduSchema));
    }

    /**
     * §3.3 YUMUŞAK İPTAL.
     * REVOKED issuer yeni belge veremez, ama kaydı ve halefi durur —
     * bakanlık kapanınca diplomalar çöp olmaz.
     */
    function test_SoftRevocation_KeepsRecordAndSuccessor() public {
        bytes32 successor = _registerIssuer(TR, trDelegate, trCA, keccak256("YOK-CERT"),
            IIssuerRegistry.IssuerCategory.GOVERNMENT, IIssuerRegistry.IssuerAssurance.I3);

        vm.prank(trDelegate);
        issuers.revokeIssuer(uniIssuer, successor);

        assertFalse(issuers.isValidIssuer(uniIssuer), "yeni ihrac duracak");
        IIssuerRegistry.Issuer memory i = issuers.getIssuer(uniIssuer);
        assertEq(i.successorId, successor, "halef kayitli kalmali");
        assertEq(i.certFingerprint, keccak256("BILGI-CERT"), "kayit silinmedi");
    }

    /// CA2: Root CA iptali gecmisi silmez ama YENI ihraci durdurur.
    function test_RootCARevocation_StopsNewIssuance_ButKeepsRecord() public {
        vm.prank(trDelegate);
        cas.revokeRootCA(trCA, "rotation");

        assertFalse(issuers.isValidIssuer(uniIssuer), "CA gidince yeni ihrac durur");
        assertEq(issuers.getIssuer(uniIssuer).parentCA, trCA, "issuer kaydi duruyor");
    }

    /**
     * ═══ REVIEW R1 — yumuşak iptalin gerçek testi ═══
     * REVOKED bir issuer'ın, iptalden ÖNCE verdiği credential kabul edilmeli;
     * SONRA verdiği (sahte tarihli) reddedilmeli.
     */
    function test_SoftRevocation_PastCredentialAcceptable_FutureNot() public {
        uint64 issuedBefore = uint64(block.timestamp);
        vm.warp(block.timestamp + 10 days);

        vm.prank(trDelegate);
        issuers.revokeIssuer(uniIssuer, bytes32(0));
        uint64 revokedAt = uint64(block.timestamp);

        assertFalse(issuers.isValidIssuer(uniIssuer), "yeni ihrac yok");
        assertTrue(issuers.isCredentialAcceptable(uniIssuer, issuedBefore), "eski diploma gecerli");
        assertFalse(issuers.isCredentialAcceptable(uniIssuer, revokedAt + 1), "iptal sonrasi tarihli red");
    }

    /// R1: SUSPENDED ihtiyatidir — hicbir credential kabul edilmez.
    function test_Suspended_RejectsAll() public {
        uint64 iat = uint64(block.timestamp);
        vm.prank(trDelegate);
        issuers.suspendIssuer(uniIssuer);
        assertFalse(issuers.isCredentialAcceptable(uniIssuer, iat));
    }

    /**
     * ═══ REVIEW R3 — SC3'ün yetki tarafı ═══
     * DEPRECATED şemayla iptalden önce verilmiş credential, şema yetkisi
     * açısından hâlâ kabul edilebilir olmalı.
     */
    function test_DeprecatedSchema_PastCredentialStillAcceptable() public {
        bytes32 eduSchema = _registerNationalSchema(TR, trDelegate, EDU, keccak256("edu"));
        vm.prank(trDelegate);
        issuers.setSchemaAuthorization(uniIssuer, eduSchema, true);
        uint64 iat = uint64(block.timestamp);

        vm.warp(block.timestamp + 365 days);
        vm.prank(trDelegate);
        schemas.deprecateSchema(eduSchema, bytes32(0));

        assertFalse(issuers.isAuthorizedForSchema(uniIssuer, eduSchema), "yeni ihrac yok");
        assertTrue(issuers.isCredentialSchemaAcceptable(uniIssuer, eduSchema, iat), "eski belge kabul");
    }

    /// R3: Yetki geri alindiktan SONRA verilmis credential reddedilir.
    function test_SchemaAuthWindow_AfterRevocationRejected() public {
        bytes32 eduSchema = _registerNationalSchema(TR, trDelegate, EDU, keccak256("edu"));
        vm.startPrank(trDelegate);
        issuers.setSchemaAuthorization(uniIssuer, eduSchema, true);
        vm.warp(block.timestamp + 1 days);
        issuers.setSchemaAuthorization(uniIssuer, eduSchema, false);
        vm.stopPrank();
        uint64 after = uint64(block.timestamp + 1);
        assertFalse(issuers.isCredentialSchemaAcceptable(uniIssuer, eduSchema, after));
    }

    /// R3: REVOKED sema ise eski belge de reddedilir (istisnai durum).
    function test_RevokedSchema_PastCredentialRejected() public {
        bytes32 eduSchema = _registerNationalSchema(TR, trDelegate, EDU, keccak256("edu"));
        vm.prank(trDelegate);
        issuers.setSchemaAuthorization(uniIssuer, eduSchema, true);
        uint64 iat = uint64(block.timestamp);
        vm.prank(trDelegate);
        schemas.revokeSchema(eduSchema, "yanlis sd:never");
        assertFalse(issuers.isCredentialSchemaAcceptable(uniIssuer, eduSchema, iat));
    }

    /**
     * ═══ REVIEW R2 — CA rotasyonu ═══
     * RETIRED CA: yeni issuer baglanamaz, mevcut issuer calismaya devam eder,
     * eski credential'lar kabul edilir. REVOKED CA: hepsi duser.
     */
    function test_RootCARetired_KeepsOperationsAndCredentials() public {
        uint64 iat = uint64(block.timestamp);
        vm.prank(trDelegate);
        cas.retireRootCA(trCA, bytes32(0));

        assertFalse(issuers.isValidIssuer(uniIssuer), "yeni ihrac durur");
        assertTrue(issuers.isOperational(uniIssuer), "status yayini surer");
        assertTrue(issuers.isCredentialAcceptable(uniIssuer, iat), "eski diploma kabul");
    }

    function test_RootCARevoked_RejectsCredentials() public {
        uint64 iat = uint64(block.timestamp);
        vm.prank(trDelegate);
        cas.revokeRootCA(trCA, "compromise");
        assertFalse(issuers.isCredentialAcceptable(uniIssuer, iat), "ele gecirilmis CA -> red");
        assertTrue(issuers.isOperational(uniIssuer), "ama status yayini surer (iptal yayinlayabilmeli)");
    }

    function test_RevertWhen_UnknownRootCA() public {
        IIssuerRegistry.Issuer memory i;
        i.stateCode = TR;
        i.certFingerprint = keccak256("X");
        i.parentCA = keccak256("YOK-BOYLE-CA");
        i.status = IIssuerRegistry.IssuerStatus.ACTIVE;
        i.validFrom = uint64(block.timestamp);
        i.validUntil = uint64(block.timestamp + 1 days);

        vm.prank(trDelegate);
        vm.expectRevert(abi.encodeWithSelector(IIssuerRegistry.UnknownRootCA.selector, i.parentCA));
        issuers.registerIssuer(i);
    }
}
