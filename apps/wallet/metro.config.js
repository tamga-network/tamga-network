// Metro — monorepo (npm workspaces) + TypeScript NodeNext ('./x.js' → './x.ts') çözümleme.
const { getDefaultConfig } = require("expo/metro-config");
const path = require("path");
const fs = require("fs");

const projectRoot = __dirname;
const repoRoot = path.resolve(projectRoot, "../..");
const config = getDefaultConfig(projectRoot);

config.watchFolders = [repoRoot];
config.resolver.nodeModulesPaths = [path.resolve(projectRoot, "node_modules"), path.resolve(repoRoot, "node_modules")];
config.resolver.unstable_enablePackageExports = true;

// packages/wallet-core (ve @noble) NodeNext uzantılı import kullanır: './b64.js' diskte 'b64.ts' olabilir.
const defaultResolve = config.resolver.resolveRequest;
config.resolver.resolveRequest = (context, moduleName, platform) => {
  if (moduleName.startsWith(".") && moduleName.endsWith(".js")) {
    const abs = path.resolve(path.dirname(context.originModulePath), moduleName);
    if (!fs.existsSync(abs)) {
      for (const ext of [".ts", ".tsx"]) {
        if (fs.existsSync(abs.slice(0, -3) + ext)) return context.resolveRequest(context, moduleName.slice(0, -3), platform);
      }
    }
  }
  return (defaultResolve ?? context.resolveRequest)(context, moduleName, platform);
};

module.exports = config;
