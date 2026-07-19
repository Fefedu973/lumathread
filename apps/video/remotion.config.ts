import path from "node:path";
import { Config } from "@remotion/cli/config";

Config.setVideoImageFormat("jpeg");
Config.setOverwriteOutput(true);
Config.overrideWebpackConfig((configuration) => ({
  ...configuration,
  resolve: {
    ...configuration.resolve,
    alias: {
      ...configuration.resolve?.alias,
      "@video": path.resolve(process.cwd(), "src"),
      "@lumathread": path.resolve(process.cwd(), "../../src"),
    },
  },
}));
