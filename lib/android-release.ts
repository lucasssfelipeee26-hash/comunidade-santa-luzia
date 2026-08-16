import "server-only"
import releaseConfig from "@/config/android-release.json"

const REPOSITORIO = "lucasssfelipeee26-hash/comunidade-santa-luzia"
const APK_PADRAO = `https://github.com/${REPOSITORIO}/releases/latest/download/santa-luzia.apk`
const SITE_PADRAO = "https://comunidade-santa-luzia-production.up.railway.app"

function inteiroPositivo(valor: string | undefined, padrao: number) {
  const numero = Number(valor)
  return Number.isInteger(numero) && numero > 0 ? numero : padrao
}

function booleano(valor: string | undefined, padrao: boolean) {
  if (valor === undefined || valor === "") return padrao
  return valor === "1" || valor.toLowerCase() === "true"
}

function destaquesConfigurados() {
  const valor = process.env.ANDROID_UPDATE_HIGHLIGHTS?.trim()
  return valor ? valor.split("|").map((item) => item.trim()).filter(Boolean) : releaseConfig.highlights
}

function urlPublica(caminho: string) {
  return new URL(caminho, `${SITE_PADRAO}/`).toString()
}

export function obterReleaseAndroid() {
  const versaoAmbiente = inteiroPositivo(process.env.ANDROID_LATEST_VERSION_CODE, releaseConfig.versionCode)
  const versionCode = Math.max(releaseConfig.versionCode, versaoAmbiente)
  const versionName = versionCode === releaseConfig.versionCode
    ? releaseConfig.versionName
    : process.env.ANDROID_LATEST_VERSION_NAME?.trim() || releaseConfig.versionName

  return {
    available: booleano(process.env.ANDROID_APK_AVAILABLE, true),
    versionCode,
    versionName,
    publishedAt: process.env.ANDROID_RELEASE_PUBLISHED_AT?.trim() || releaseConfig.publishedAt,
    required: booleano(process.env.ANDROID_UPDATE_REQUIRED, releaseConfig.required),
    highlights: destaquesConfigurados(),
    downloadUrl: urlPublica(`/api/app/android/download?version=${versionCode}`),
    apkSize: releaseConfig.apkSize,
    apkSha256: releaseConfig.apkSha256,
    releasePageUrl: `https://github.com/${REPOSITORIO}/releases/latest`,
  }
}

export function obterUrlApkAndroid() {
  return process.env.ANDROID_APK_URL?.trim() || APK_PADRAO
}
