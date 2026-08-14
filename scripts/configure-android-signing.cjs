const fs = require("node:fs")
const path = require("node:path")

const obrigatorias = ["ANDROID_KEYSTORE_PATH", "ANDROID_KEYSTORE_PASSWORD", "ANDROID_KEY_ALIAS", "ANDROID_KEY_PASSWORD"]
for (const chave of obrigatorias) {
  if (!process.env[chave]) throw new Error(`${chave} não configurada.`)
}

const gradlePath = path.resolve(__dirname, "..", "android", "app", "build.gradle")
if (!fs.existsSync(gradlePath)) throw new Error("android/app/build.gradle não encontrado.")

let gradle = fs.readFileSync(gradlePath, "utf8")
if (!gradle.includes("SANTA_LUZIA_RELEASE_SIGNING")) {
  gradle += `

// SANTA_LUZIA_RELEASE_SIGNING — gerado somente no ambiente seguro de compilação.
android {
    signingConfigs {
        santaLuziaRelease {
            storeFile file(System.getenv("ANDROID_KEYSTORE_PATH"))
            storePassword System.getenv("ANDROID_KEYSTORE_PASSWORD")
            keyAlias System.getenv("ANDROID_KEY_ALIAS")
            keyPassword System.getenv("ANDROID_KEY_PASSWORD")
        }
    }
    buildTypes {
        release {
            signingConfig signingConfigs.santaLuziaRelease
        }
    }
}
`
  fs.writeFileSync(gradlePath, gradle)
}

console.log("Assinatura de release configurada sem gravar credenciais no repositório.")
