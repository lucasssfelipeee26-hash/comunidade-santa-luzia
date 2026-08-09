"use client"

import Image from "next/image"
import Link from "next/link"
import { useState } from "react"
import { Lock, Menu, X } from "lucide-react"
import { site } from "@/lib/site"

const navLinks = [
  { href: "/#inicio", label: "Início" },
  { href: "/#comunidade", label: "A Comunidade" },
  { href: "/escala", label: "Escala do Dia" },
  { href: "/#liturgia", label: "Liturgia" },
  { href: "/formacao", label: "Formação" },
  { href: "/biblioteca", label: "Biblioteca" },
  { href: "/#contato", label: "Contato" },
]

export function SiteHeader() {
  const [open, setOpen] = useState(false)

  return (
    <header className="sticky top-0 z-50 border-b-2 border-[#d4af37]/70 bg-[#fffdf8]/97 text-[#5f1020] shadow-[0_4px_18px_rgba(89,55,12,.10)] backdrop-blur">
      <div className="mx-auto flex max-w-7xl items-center justify-between gap-5 px-4 py-3 lg:px-6">
        <Link href="/#inicio" className="flex min-w-0 items-center gap-3">
          <span className="relative size-14 shrink-0 overflow-hidden rounded-full border-2 border-[#d4af37] shadow-md sm:size-16">
            <Image src="/images/santa-luzia-logo.jpg" alt="Santa Luzia" fill className="object-cover" sizes="64px" />
          </span>
          <span className="min-w-0 leading-tight">
            <span className="block text-[10px] font-semibold uppercase tracking-[0.22em] text-[#9b7424] sm:text-xs">Comunidade</span>
            <span className="block truncate font-serif text-xl font-bold uppercase tracking-wide text-[#7b1326] sm:text-2xl">Santa Luzia</span>
            <span className="block truncate text-[10px] font-semibold uppercase text-[#4c1b24] sm:text-xs">Acólitos e Coroinhas São Padre Pio</span>
            <span className="hidden text-[9px] uppercase tracking-wide text-[#7b6b60] sm:block">{site.paroquia}</span>
          </span>
        </Link>

        <nav className="hidden items-center gap-1 xl:flex">
          {navLinks.map((link) => (
            <a key={link.href} href={link.href} className="rounded-md px-3 py-2 text-sm font-semibold text-[#5f1020] transition hover:bg-[#f6ecd1] hover:text-[#7b1326]">
              {link.label}
            </a>
          ))}
          <Link href="/area-restrita" className="ml-3 inline-flex items-center gap-2 rounded-md border border-[#c99a2e] bg-[#f6e7b7] px-4 py-2.5 text-sm font-bold uppercase tracking-wide text-[#681225] shadow-sm transition hover:bg-[#d4af37] hover:text-[#4b0b17]">
            <Lock className="size-4" /> Área Restrita
          </Link>
        </nav>

        <button type="button" onClick={() => setOpen(v => !v)} className="rounded-md border border-[#d4af37]/70 bg-white p-2 text-[#7b1326] shadow-sm xl:hidden" aria-label={open ? "Fechar menu" : "Abrir menu"}>
          {open ? <X className="size-6" /> : <Menu className="size-6" />}
        </button>
      </div>

      {open && (
        <nav className="border-t border-[#d4af37]/40 bg-[#fffaf0] px-4 py-4 shadow-inner xl:hidden">
          <div className="mx-auto flex max-w-7xl flex-col gap-1">
            {navLinks.map(link => (
              <a key={link.href} href={link.href} onClick={() => setOpen(false)} className="rounded-md px-3 py-2.5 text-sm font-semibold text-[#5f1020] hover:bg-[#f6ecd1] hover:text-[#7b1326]">{link.label}</a>
            ))}
            <Link href="/area-restrita" onClick={() => setOpen(false)} className="mt-2 inline-flex items-center justify-center gap-2 rounded-md border border-[#c99a2e] bg-[#f6e7b7] px-4 py-2.5 text-sm font-bold text-[#681225]">
              <Lock className="size-4" /> Área Restrita
            </Link>
          </div>
        </nav>
      )}
    </header>
  )
}
