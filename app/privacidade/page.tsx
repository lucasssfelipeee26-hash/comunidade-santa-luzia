import Link from "next/link"
import { ArrowLeft, ShieldCheck } from "lucide-react"
import { site } from "@/lib/site"

export const metadata = { title: `Política de Privacidade | ${site.comunidade}` }

export default function PrivacidadePage() {
  return (
    <main className="min-h-screen bg-[#faf7f1] px-4 py-10 text-foreground">
      <article className="mx-auto max-w-3xl rounded-3xl border border-border bg-white p-6 shadow-sm sm:p-10">
        <Link href="/visitante" className="inline-flex items-center gap-2 text-sm font-medium text-primary"><ArrowLeft className="size-4" />Voltar</Link>
        <div className="mt-5 flex items-center gap-3"><span className="flex size-12 items-center justify-center rounded-2xl bg-primary/10 text-primary"><ShieldCheck className="size-6" /></span><div><h1 className="font-serif text-3xl font-semibold text-primary">Política de Privacidade</h1><p className="text-sm text-muted-foreground">Atualizada em 13 de agosto de 2026</p></div></div>

        <div className="mt-8 space-y-7 text-sm leading-7 text-muted-foreground">
          <section><h2 className="font-serif text-xl font-semibold text-foreground">1. Responsável e finalidade</h2><p className="mt-2">O aplicativo {site.comunidade}, do grupo {site.grupo} — {site.paroquia}, organiza o serviço litúrgico da comunidade, incluindo Liturgia Diária, escalas, formação, perfis dos membros, registros administrativos, quizzes, ranking e pontualidade.</p></section>
          <section><h2 className="font-serif text-xl font-semibold text-foreground">2. Dados tratados</h2><p className="mt-2">Podemos tratar nome, nome de usuário, e-mail, senha protegida por hash, função, data de nascimento, data de votos, foto opcional, participação em escalas e formações, justificativas e registros administrativos, respostas de quizzes, pontuação, reconhecimentos e relatos de pontualidade. O aplicativo não vende dados e não utiliza publicidade comportamental.</p></section>
          <section><h2 className="font-serif text-xl font-semibold text-foreground">3. Uso e compartilhamento</h2><p className="mt-2">Os dados são usados somente para autenticação, recuperação de acesso, gestão da equipe, comunicação das escalas, formação e funcionamento das atividades descritas. Eles ficam visíveis apenas conforme a função de cada usuário e podem ser processados pelos serviços de hospedagem e e-mail necessários à operação, sem uso comercial.</p></section>
          <section><h2 className="font-serif text-xl font-semibold text-foreground">4. Dados no aparelho e funcionamento offline</h2><p className="mt-2">O aparelho pode manter a sessão segura, preferências, acervo litúrgico, última escala sincronizada e ações ainda não enviadas. A senha digitada não é salva no armazenamento local. Relatos feitos sem internet permanecem em fila no aparelho e são enviados ao servidor quando a conexão volta.</p></section>
          <section><h2 className="font-serif text-xl font-semibold text-foreground">5. Notificações e permissões</h2><p className="mt-2">A permissão de notificações é solicitada somente para lembretes escolhidos pelo usuário, como Liturgia, escala e atividades da equipe. Ela pode ser recusada ou desativada nas configurações do Android sem impedir a leitura do conteúdo.</p></section>
          <section><h2 className="font-serif text-xl font-semibold text-foreground">6. Segurança, retenção e menores</h2><p className="mt-2">São aplicadas sessão protegida, limitação de tentativas e armazenamento de senha por hash. Os dados permanecem enquanto a conta estiver ativa ou enquanto forem necessários à administração legítima da equipe. Cadastros de menores devem ocorrer com conhecimento e autorização de seus responsáveis, conforme as regras da comunidade.</p></section>
          <section id="exclusao"><h2 className="font-serif text-xl font-semibold text-foreground">7. Seus direitos e exclusão</h2><p className="mt-2">O usuário pode corrigir dados no perfil e excluir a própria conta. A exclusão remove o perfil e os dados associados às atividades do aplicativo, ressalvadas retenções estritamente exigidas por lei ou segurança.</p><Link href="/excluir-conta" className="mt-3 inline-flex rounded-xl bg-primary px-4 py-2.5 font-semibold text-white">Solicitar ou concluir a exclusão da conta</Link></section>
          <section><h2 className="font-serif text-xl font-semibold text-foreground">8. Contato</h2><p className="mt-2">Dúvidas sobre privacidade podem ser apresentadas presencialmente à administração da {site.comunidade}, em {site.endereco.rua}, {site.endereco.bairro}, {site.endereco.cidade} — {site.endereco.estado}. Para exclusão de conta, utilize o canal eletrônico acima.</p></section>
        </div>
      </article>
    </main>
  )
}
