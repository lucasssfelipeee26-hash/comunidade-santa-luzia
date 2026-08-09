import { NextResponse } from "next/server"
import fs from "node:fs"
import path from "node:path"
import { lerSessao } from "@/lib/auth"
import {buscarFormacao, DATA_DIR} from "@/lib/db"

export const runtime = "nodejs"

export async function GET(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  const sessao = await lerSessao()
  if (!sessao) return NextResponse.json({ erro: "Faça login para baixar materiais." }, { status: 401 })
  const { id } = await params
  const row = buscarFormacao(id)
  if (!row?.arquivo) return NextResponse.json({ erro: "Arquivo não encontrado." }, { status: 404 })
  const filePath = path.join(DATA_DIR, "formacoes", path.basename(row.arquivo.nome_armazenado))
  if (!fs.existsSync(filePath)) return NextResponse.json({ erro: "Arquivo indisponível no servidor." }, { status: 404 })
  const buffer = fs.readFileSync(filePath)
  return new NextResponse(buffer, { headers: {
    "Content-Type": row.arquivo.mime,
    "Content-Length": String(buffer.length),
    "Content-Disposition": `attachment; filename*=UTF-8''${encodeURIComponent(row.arquivo.nome_original)}`,
    "Cache-Control": "private, no-store",
  } })
}
