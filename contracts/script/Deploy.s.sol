// SPDX-License-Identifier: Apache-2.0
pragma solidity ^0.8.24;

import {Script, console2} from "forge-std/Script.sol";
import {ERC1967Proxy} from "@openzeppelin/contracts/proxy/ERC1967/ERC1967Proxy.sol";

import {Governance} from "../src/governance/Governance.sol";
import {RootCARegistry} from "../src/identity/RootCARegistry.sol";
import {SchemaRegistry} from "../src/schema/SchemaRegistry.sol";
import {IssuerRegistry} from "../src/registry/IssuerRegistry.sol";
import {RelyingPartyRegistry} from "../src/registry/RelyingPartyRegistry.sol";
import {CrossRecognition} from "../src/recognition/CrossRecognition.sol";
import {StatusListRegistry} from "../src/revocation/StatusListRegistry.sol";
import {TrustQueries} from "../src/TrustQueries.sol";

/**
 * @title  Deploy
 * @notice Tam güven katmanı dağıtımı. SIRA BAĞLAYICIDIR — bağımlılık yönü
 *         SPEC-BC-0001 §8'deki topolojiyi izler.
 *
 * @dev    Kullanım:
 *           forge script script/Deploy.s.sol:Deploy \
 *             --rpc-url $BESU_RPC --broadcast --slow
 *
 *         Ortam değişkenleri:
 *           FOUNDER_CODES      virgüllü, örn. "TR,KZ"
 *           FOUNDER_VALIDATORS virgüllü adresler, aynı sırada
 */
contract Deploy is Script {
    function run() external {
        uint256 pk = vm.envUint("DEPLOYER_PK");
        bytes2[] memory founders = _codes();
        address[] memory validators = _validators();
        require(founders.length == validators.length, "founder/validator sayisi uyusmuyor");

        vm.startBroadcast(pk);

        // 1) Governance — ISovereignty'yi de uygular, herkes ona bakar.
        address gov = _deploy(address(new Governance()),
            abi.encodeCall(Governance.initialize, (founders, validators)));
        console2.log("Governance          ", gov);

        // 2) RootCARegistry — IssuerRegistry buna bagimli.
        address cas = _deploy(address(new RootCARegistry()),
            abi.encodeCall(RootCARegistry.initialize, (gov, gov)));
        console2.log("RootCARegistry      ", cas);

        // 3) SchemaRegistry — IssuerRegistry buna bagimli.
        address schemas = _deploy(address(new SchemaRegistry()),
            abi.encodeCall(SchemaRegistry.initialize, (gov, gov)));
        console2.log("SchemaRegistry      ", schemas);

        // 4) IssuerRegistry — 2 ve 3'ten sonra.
        address issuers = _deploy(address(new IssuerRegistry()),
            abi.encodeCall(IssuerRegistry.initialize, (gov, gov, cas, schemas)));
        console2.log("IssuerRegistry      ", issuers);

        // 5) Geri kalanlar
        address rps = _deploy(address(new RelyingPartyRegistry()),
            abi.encodeCall(RelyingPartyRegistry.initialize, (gov, gov)));
        console2.log("RelyingPartyRegistry", rps);

        address recognition = _deploy(address(new CrossRecognition()),
            abi.encodeCall(CrossRecognition.initialize, (gov, gov, issuers)));
        console2.log("CrossRecognition    ", recognition);

        address statusLists = _deploy(address(new StatusListRegistry()),
            abi.encodeCall(StatusListRegistry.initialize, (issuers, gov)));
        console2.log("StatusListRegistry  ", statusLists);

        // 6) Governance -> SchemaRegistry baglanti (BIR KEZ, geri alinamaz)
        //    onlyValidator (review R5): DEPLOYER_PK, FOUNDER_VALIDATORS icinden biri olmali.
        Governance(gov).setSchemaRegistry(schemas);

        // 7) Kurucular arasi FULL taniyis (ADR-0002 #3)
        CrossRecognition(recognition).bootstrapFounders(founders);

        // 8) Dogrulayici cephesi
        TrustQueries tq = new TrustQueries(issuers, schemas, recognition, statusLists);
        console2.log("TrustQueries        ", address(tq));

        vm.stopBroadcast();

        console2.log("");
        console2.log("SONRAKI ADIMLAR (zincir disi):");
        console2.log(" - Her devlet setDelegateKeys ile kendi anahtarlarini tanimlar");
        console2.log(" - Her devlet registerRootCA ile ulusal CA'sini capalar");
        console2.log(" - NETWORK semalari proposeNetworkSchema + 2/3 oy ile girer");
    }

    function _deploy(address impl, bytes memory data) internal returns (address) {
        return address(new ERC1967Proxy(impl, data));
    }

    function _codes() internal view returns (bytes2[] memory out) {
        string[] memory parts = vm.split(vm.envString("FOUNDER_CODES"), ",");
        out = new bytes2[](parts.length);
        for (uint256 i = 0; i < parts.length; i++) out[i] = bytes2(bytes(parts[i]));
    }

    function _validators() internal view returns (address[] memory) {
        return vm.envAddress("FOUNDER_VALIDATORS", ",");
    }
}
