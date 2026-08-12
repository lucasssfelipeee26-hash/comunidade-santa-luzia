import type { MetadataRoute } from "next"

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "Comunidade Santa Luzia — Acólitos e Coroinhas São Padre Pio",
    short_name: "Santa Luzia",
    description:
      "Aplicativo da Comunidade Santa Luzia com acesso por perfil, Liturgia Diária, Escala do Dia, Biblioteca, Formação, Ranking e recursos da equipe.",
    start_url: "/",
    scope: "/",
    display: "standalone",
    orientation: "portrait-primary",
    background_color: "#fffdf8",
    theme_color: "#7b1326",
    icons: [
      {
        src: "/icon-192x192.png",
        sizes: "192x192",
        type: "image/png",
        purpose: "any",
      },
      {
        src: "/icon-512x512.png",
        sizes: "512x512",
        type: "image/png",
        purpose: "any",
      },
      {
        src: "/icon-maskable-512x512.png",
        sizes: "512x512",
        type: "image/png",
        purpose: "maskable",
      },
    ],
    shortcuts: [
      {
        name: "Escala do Dia",
        short_name: "Escala",
        url: "/escala",
      },
      {
        name: "Liturgia Diária",
        short_name: "Liturgia",
        url: "/liturgia",
      },
      {
        name: "Biblioteca",
        short_name: "Biblioteca",
        url: "/biblioteca",
      },
      {
        name: "Modo Visitante",
        short_name: "Visitante",
        url: "/visitante",
      },
    ],
  }
}
