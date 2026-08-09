import { NextResponse } from "next/server"
import { lerSessao } from "@/lib/auth"
import { excluirEscala } from "@/lib/db"
export async function DELETE(_r:Request,{params}:{params:Promise<{id:string}>}){ const s=await lerSessao(); if(!s||s.tipo!=="moderador") return NextResponse.json({ok:false,erro:"Não autorizado."},{status:403}); const {id}=await params; return NextResponse.json({ok:excluirEscala(id)}) }
