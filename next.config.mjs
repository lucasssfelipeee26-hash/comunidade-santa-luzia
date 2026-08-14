import os from "node:os"

function getLocalDevOrigins() {
  const origins = new Set(["localhost", "127.0.0.1"])
  let interfaces = {}
  try {
    interfaces = os.networkInterfaces()
  } catch {
    // Ambientes de compilação restritos podem bloquear a leitura das
    // interfaces. Os endereços locais básicos continuam suficientes.
  }

  for (const entries of Object.values(interfaces)) {
    for (const entry of entries ?? []) {
      if (entry.family !== "IPv4" || entry.internal) continue

      const parts = entry.address.split(".")
      if (parts.length !== 4) continue

      // Em desenvolvimento, autoriza todos os endereços do mesmo /24 da
      // máquina que está executando o Next.js. Assim mudanças de DHCP como
      // 192.168.1.7 -> 192.168.1.13 não exigem editar o projeto novamente.
      const prefix = parts.slice(0, 3).join(".")
      for (let host = 1; host <= 254; host += 1) {
        origins.add(`${prefix}.${host}`)
      }
    }
  }

  return [...origins]
}

/** @type {import('next').NextConfig} */
const nextConfig = {
  allowedDevOrigins: getLocalDevOrigins(),
  images: { unoptimized: true },
  async headers() {
    return [
      {
        source: "/:path*",
        headers: [
          { key: "X-Content-Type-Options", value: "nosniff" },
          { key: "X-Frame-Options", value: "SAMEORIGIN" },
          { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
          { key: "Permissions-Policy", value: "camera=(), microphone=(), geolocation=()" },
        ],
      },
    ]
  },
}

export default nextConfig
