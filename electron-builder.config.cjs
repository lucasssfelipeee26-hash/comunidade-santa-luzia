const beta = require("./config/windows-beta.json")

module.exports = {
  appId: "br.com.comunidadesantaluzia.beta",
  productName: beta.appName,
  extraMetadata: {
    main: "electron/main.cjs",
    version: beta.versionName,
  },
  directories: {
    output: "dist-windows",
  },
  files: [
    "electron/**/*",
    "config/windows-beta.json",
    "package.json",
  ],
  win: {
    target: [{ target: "portable", arch: ["x64"] }],
    icon: "public/icon-512x512.png",
    artifactName: `Santa-Luzia-Beta-Windows-${beta.versionName}-x64.\${ext}`,
  },
  portable: {
    artifactName: `Santa-Luzia-Beta-Windows-${beta.versionName}-x64.\${ext}`,
  },
}
