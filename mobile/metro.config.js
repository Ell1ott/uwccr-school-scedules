const path = require("path");
const { getDefaultConfig } = require("expo/metro-config");
const { withNativeWind } = require("nativewind/metro");

const projectRoot = __dirname;
const workspaceRoot = path.resolve(projectRoot, "..");

const replacements = {
  supabase: path.join(projectRoot, "src/lib/supabase.ts"),
  storage: path.join(projectRoot, "src/lib/storage.ts"),
  auth: path.join(projectRoot, "src/lib/auth.tsx"),
  analytics: path.join(projectRoot, "src/lib/analytics.ts"),
  push: path.join(projectRoot, "src/lib/push.ts"),
  icons: path.join(projectRoot, "src/lib/icons.tsx"),
  device: path.join(projectRoot, "src/lib/device.ts"),
};

const singletons = ["react", "react-dom", "react-native"];

const config = getDefaultConfig(projectRoot);
config.watchFolders = [workspaceRoot];
// Expo's monorepo default skips per-package node_modules, so nested deps
// like Reanimated's semver@7 never resolve. React is still pinned below.
config.resolver.disableHierarchicalLookup = false;
config.resolver.nodeModulesPaths = [
  path.resolve(projectRoot, "node_modules"),
  path.resolve(workspaceRoot, "node_modules"),
];
config.resolver.extraNodeModules = {
  "@shared": path.resolve(workspaceRoot, "src"),
  react: path.resolve(projectRoot, "node_modules/react"),
  "react-dom": path.resolve(projectRoot, "node_modules/react-dom"),
  "react-native": path.resolve(projectRoot, "node_modules/react-native"),
};

const defaultResolve = config.resolver.resolveRequest;
config.resolver.resolveRequest = (context, moduleName, platform) => {
  const origin = (context.originModulePath || "").replace(/\\/g, "/");
  const fromWebsite =
    (origin.includes("/src/lib/") || origin.includes("/src/hooks/")) &&
    !origin.includes("/mobile/");
  if (fromWebsite) {
    const name = moduleName.replace(/\\/g, "/").split("/").pop();
    if (name && replacements[name]) {
      return { type: "sourceFile", filePath: replacements[name] };
    }
  }
  const root = moduleName.split("/")[0];
  if (singletons.includes(root) || singletons.includes(moduleName)) {
    return {
      type: "sourceFile",
      filePath: require.resolve(moduleName, { paths: [projectRoot] }),
    };
  }
  try {
    if (defaultResolve) {
      return defaultResolve(context, moduleName, platform);
    }
    return context.resolveRequest(context, moduleName, platform);
  } catch (error) {
    try {
      return {
        type: "sourceFile",
        filePath: require.resolve(moduleName, {
          paths: [path.dirname(context.originModulePath), projectRoot],
        }),
      };
    } catch {
      throw error;
    }
  }
};

module.exports = withNativeWind(config, { input: "./global.css" });
