// SPDX-License-Identifier: Apache-2.0
pragma solidity ^0.8.24;

import {Test} from "forge-std/Test.sol";
import {ERC1967Proxy} from "@openzeppelin/contracts/proxy/ERC1967/ERC1967Proxy.sol";

import {Governance} from "../../src/governance/Governance.sol";
import {RootCARegistry} from "../../src/identity/RootCARegistry.sol";
import {SchemaRegistry} from "../../src/schema/SchemaRegistry.sol";
import {IssuerRegistry} from "../../src/registry/IssuerRegistry.sol";
import {RelyingPartyRegistry} from "../../src/registry/RelyingPartyRegistry.sol";
import {CrossRecognition} from "../../src/recognition/CrossRecognition.sol";
import {StatusListRegistry} from "../../src/revocation/StatusListRegistry.sol";
import {IRootCARegistry} from "../../src/interfaces/IRootCARegistry.sol";
import {IIssuerRegistry} from "../../src/interfaces/IIssuerRegistry.sol";
import {ISchemaRegistry} from "../../src/interfaces/ISchemaRegistry.sol";

/// @notice İki devletli (TR, KZ) tam kurulum. Her test bundan türer.
abstract contract TamgaTestBase is Test {
    bytes2 internal constant TR = bytes2("TR");
    bytes2 internal constant KZ = bytes2("KZ");
    bytes2 internal constant AZ = bytes2("AZ");

    address internal trValidator = makeAddr("trValidator");
    address internal kzValidator = makeAddr("kzValidator");
    address internal azValidator = makeAddr("azValidator");
    address internal trDelegate = makeAddr("trDelegate");
    address internal kzDelegate = makeAddr("kzDelegate");
    address internal uniOperator = makeAddr("uniOperator");
    address internal stranger = makeAddr("stranger");

    Governance internal gov;
    RootCARegistry internal cas;
    SchemaRegistry internal schemas;
    IssuerRegistry internal issuers;
    RelyingPartyRegistry internal rps;
    CrossRecognition internal recognition;
    StatusListRegistry internal statusLists;

    bytes32 internal trCA;
    bytes32 internal uniIssuer;

    function setUp() public virtual {
        // --- Governance ---
        // Üç kurucu: 2/3 kuralı n<3'te dejenere olduğu için (review R6).
        bytes2[] memory founders = new bytes2[](3);
        founders[0] = TR;
        founders[1] = KZ;
        founders[2] = AZ;
        address[] memory vals = new address[](3);
        vals[0] = trValidator;
        vals[1] = kzValidator;
        vals[2] = azValidator;

        gov = Governance(_proxy(address(new Governance()),
            abi.encodeCall(Governance.initialize, (founders, vals))));

        // --- Registry'ler ---
        cas = RootCARegistry(_proxy(address(new RootCARegistry()),
            abi.encodeCall(RootCARegistry.initialize, (address(gov), address(gov)))));
        schemas = SchemaRegistry(_proxy(address(new SchemaRegistry()),
            abi.encodeCall(SchemaRegistry.initialize, (address(gov), address(gov)))));
        issuers = IssuerRegistry(_proxy(address(new IssuerRegistry()),
            abi.encodeCall(IssuerRegistry.initialize,
                (address(gov), address(gov), address(cas), address(schemas)))));
        rps = RelyingPartyRegistry(_proxy(address(new RelyingPartyRegistry()),
            abi.encodeCall(RelyingPartyRegistry.initialize, (address(gov), address(gov)))));
        recognition = CrossRecognition(_proxy(address(new CrossRecognition()),
            abi.encodeCall(CrossRecognition.initialize, (address(gov), address(gov), address(issuers)))));
        statusLists = StatusListRegistry(_proxy(address(new StatusListRegistry()),
            abi.encodeCall(StatusListRegistry.initialize, (address(issuers), address(gov)))));

        vm.prank(trValidator);
        gov.setSchemaRegistry(address(schemas));

        // --- Delege anahtarları ---
        address[] memory trKeys = new address[](1);
        trKeys[0] = trDelegate;
        vm.prank(trValidator);
        gov.setDelegateKeys(TR, trKeys);

        address[] memory kzKeys = new address[](1);
        kzKeys[0] = kzDelegate;
        vm.prank(kzValidator);
        gov.setDelegateKeys(KZ, kzKeys);

        // --- TR Root CA + üniversite ---
        trCA = _registerCA(TR, trDelegate, keccak256("TR-ROOT-CA-1"));
        uniIssuer = _registerIssuer(TR, trDelegate, trCA, keccak256("BILGI-CERT"),
            IIssuerRegistry.IssuerCategory.EDUCATION, IIssuerRegistry.IssuerAssurance.I2);

        address[] memory opKeys = new address[](1);
        opKeys[0] = uniOperator;
        vm.prank(trDelegate);
        issuers.setIssuerDelegates(uniIssuer, opKeys);
    }

    // -----------------------------------------------------------------

    function _proxy(address impl, bytes memory data) internal returns (address) {
        return address(new ERC1967Proxy(impl, data));
    }

    function _registerCA(bytes2 st, address who, bytes32 fp) internal returns (bytes32) {
        IRootCARegistry.RootCA memory ca;
        ca.stateCode = st;
        ca.certFingerprint = fp;
        ca.subjectHash = keccak256("subject");
        ca.certURI = "https://pki.example/root.der";
        ca.status = IRootCARegistry.CAStatus.ACTIVE;
        ca.validFrom = uint64(block.timestamp);
        ca.validUntil = uint64(block.timestamp + 3650 days);
        vm.prank(who);
        cas.registerRootCA(ca);
        return cas.caIdOf(st, fp);
    }

    function _registerIssuer(
        bytes2 st,
        address who,
        bytes32 caId,
        bytes32 fp,
        IIssuerRegistry.IssuerCategory cat,
        IIssuerRegistry.IssuerAssurance asr
    ) internal returns (bytes32) {
        IIssuerRegistry.Issuer memory i;
        i.stateCode = st;
        i.nameHash = keccak256("Bilgi");
        i.category = cat;
        i.assurance = asr;
        i.certFingerprint = fp;
        i.parentCA = caId;
        i.status = IIssuerRegistry.IssuerStatus.ACTIVE;
        i.validFrom = uint64(block.timestamp);
        i.validUntil = uint64(block.timestamp + 365 days);
        vm.prank(who);
        issuers.registerIssuer(i);
        return keccak256(abi.encodePacked(st, fp));
    }

    /// @dev NATIONAL şema kaydı (oy gerekmez).
    function _registerNationalSchema(bytes2 st, address who, string memory vct, bytes32 hash)
        internal returns (bytes32)
    {
        ISchemaRegistry.SchemaRecord memory r;
        r.vctURI = vct;
        r.contentHash = hash;
        r.version = "1.0.0";
        r.tier = ISchemaRegistry.SchemaTier.NATIONAL;
        r.stateCode = st;
        r.status = ISchemaRegistry.SchemaStatus.ACTIVE;
        vm.prank(who);
        schemas.registerSchema(r);
        return keccak256(bytes(vct));
    }
}
