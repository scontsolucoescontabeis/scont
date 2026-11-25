import { useStore } from '../store/useStore'
import { atualizarPessoa, normalizarHoras, normalizarIntervalo, resumoFerias, type EdicaoPessoa } from '../portal/equipe'
import { Dica } from './ui'

export function EquipeNominal() {
  const funcoes = useStore((s) => s.funcoes)
  const portal = useStore((s) => s.portal)
  const set = useStore((s) => s.set)

  // O App já mostra carregando, erro e "nenhum empregado"; aqui nada é editável nesses casos.
  if (!portal || portal.carregando || portal.erro || portal.nenhumEmpregado) return null

  const editar = (funcaoId: string, pessoaId: string, p: EdicaoPessoa) =>
    set({
      funcoes: atualizarPessoa(funcoes, funcaoId, pessoaId, p),
      escala: null,
      propostas: [],
    })

  const numero = (v: string) => (v === '' ? undefined : Number(v))

  return (
    <div className="space-y-4">
      {funcoes.map((f) => {
        const pessoas = f.pessoas ?? []
        return (
          <div key={f.id} className="cartao space-y-3">
            <h3 className="text-base font-bold">
              {f.nome} — {f.quantidade} de {pessoas.length} escaláveis
            </h3>
            <div className="overflow-x-auto">
              <table className="w-full min-w-[760px] text-left text-sm">
                <thead>
                  <tr className="border-b border-line text-xs text-soft">
                    <th className="py-2 pr-3 font-semibold">Nome</th>
                    <th className="px-2 py-2 font-semibold">Escalar</th>
                    <th className="px-2 py-2 font-semibold">Horas/semana</th>
                    <th className="px-2 py-2 font-semibold">Entrada</th>
                    <th className="px-2 py-2 font-semibold">Saída</th>
                    <th className="px-2 py-2 font-semibold">Intervalo (min)</th>
                    <th className="px-2 py-2 font-semibold">Férias</th>
                  </tr>
                </thead>
                <tbody>
                  {pessoas.map((p) => {
                    const ferias = resumoFerias(p.ferias)
                    return (
                      <tr key={p.id} className={`border-b border-line/60 ${p.escalar ? '' : 'opacity-50'}`}>
                        <td className="py-2 pr-3">
                          <span className="font-medium">{p.nome}</span>
                          {p.jornadaPadrao && (
                            <span className="ml-2 inline-flex items-center gap-1 rounded bg-amber-100 px-1.5 py-0.5 text-xs text-amber-900">
                              jornada padrão — confira
                              <Dica texto="Esta pessoa não tem jornada cadastrada no RH; usamos a jornada padrão (44h). Confira e ajuste se preciso." />
                            </span>
                          )}
                        </td>
                        <td className="px-2 py-2">
                          <input
                            type="checkbox"
                            aria-label={`Escalar ${p.nome}`}
                            checked={p.escalar}
                            onChange={(e) => editar(f.id, p.id, { escalar: e.target.checked })}
                          />
                        </td>
                        <td className="px-2 py-2">
                          <input
                            type="number"
                            min={1}
                            max={60}
                            className="campo w-24"
                            aria-label={`Horas por semana de ${p.nome}`}
                            value={p.horasSemanais ?? ''}
                            onChange={(e) => editar(f.id, p.id, { horasSemanais: normalizarHoras(numero(e.target.value)) })}
                          />
                        </td>
                        <td className="px-2 py-2">
                          <input
                            type="time"
                            className="campo w-28"
                            aria-label={`Entrada de ${p.nome}`}
                            value={p.entrada ?? ''}
                            onChange={(e) => editar(f.id, p.id, { entrada: e.target.value || undefined })}
                          />
                        </td>
                        <td className="px-2 py-2">
                          <input
                            type="time"
                            className="campo w-28"
                            aria-label={`Saída de ${p.nome}`}
                            value={p.saida ?? ''}
                            onChange={(e) => editar(f.id, p.id, { saida: e.target.value || undefined })}
                          />
                        </td>
                        <td className="px-2 py-2">
                          <input
                            type="number"
                            min={0}
                            max={240}
                            step={5}
                            className="campo w-28"
                            placeholder="Automático"
                            aria-label={`Intervalo em minutos de ${p.nome}`}
                            value={p.intervaloMin ?? ''}
                            onChange={(e) => editar(f.id, p.id, { intervaloMin: normalizarIntervalo(numero(e.target.value)) })}
                          />
                        </td>
                        <td className="px-2 py-2">
                          {ferias.length === 0 ? (
                            '—'
                          ) : (
                            <span className="flex flex-wrap gap-1">
                              {ferias.map((r, i) => (
                                <span key={i} className="rounded-full bg-brand-light px-2 py-0.5 text-xs">
                                  {r}
                                </span>
                              ))}
                            </span>
                          )}
                        </td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            </div>
          </div>
        )
      })}
    </div>
  )
}
