import { useStore } from '../store/useStore'
import {
  OPCOES_JORNADA_ESTAGIO,
  ROTULO_REGRA_MULHERES,
  atualizarPessoa,
  etiquetasPessoa,
  normalizarHoras,
  normalizarIntervalo,
  resumoFerias,
  rotuloSexo,
  type EdicaoPessoa,
} from '../portal/equipe'
import type { RegrasPessoais } from '../types'

export function EquipeNominal() {
  const funcoes = useStore((s) => s.funcoes)
  const portal = useStore((s) => s.portal)
  const set = useStore((s) => s.set)
  const regras = useStore((s) => s.regrasPessoais)
  const setRegras = useStore((s) => s.setRegrasPessoais)

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
      <div className="cartao space-y-3" role="group" aria-labelledby="t-regras-pessoa">
        <h3 id="t-regras-pessoa" className="text-base font-bold">
          Regras por pessoa
        </h3>
        <label className="flex items-start gap-2 text-sm">
          <input
            type="checkbox"
            className="mt-0.5"
            checked={regras.mulheresDomingoQuinzenal}
            onChange={(e) => setRegras({ mulheresDomingoQuinzenal: e.target.checked })}
          />
          <span>{ROTULO_REGRA_MULHERES}</span>
        </label>
        <label className="flex flex-wrap items-center gap-2 text-sm">
          <span>Jornada máxima do estagiário</span>
          <select
            className="campo !w-auto"
            value={regras.estagioHorasSemanais}
            onChange={(e) =>
              setRegras({ estagioHorasSemanais: Number(e.target.value) as RegrasPessoais['estagioHorasSemanais'] })
            }
          >
            {OPCOES_JORNADA_ESTAGIO.map((o) => (
              <option key={o.valor} value={o.valor}>
                {o.rotulo}
              </option>
            ))}
          </select>
        </label>
        <p className="text-xs text-soft">Valide com o DP; convenção coletiva pode ser diferente.</p>
      </div>
      {funcoes.map((f) => {
        const pessoas = f.pessoas ?? []
        return (
          <div key={f.id} className="cartao space-y-3">
            <h3 className="text-base font-bold">
              {f.nome} — {f.quantidade} de {pessoas.length} escaláveis
            </h3>
            <div className="overflow-x-auto">
              <table className="w-full min-w-[860px] text-left text-sm">
                <thead>
                  <tr className="border-b border-line text-xs text-soft">
                    <th className="py-2 pr-3 font-semibold">Nome</th>
                    <th className="px-2 py-2 font-semibold">Sexo</th>
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
                    const etiquetas = etiquetasPessoa(p, regras)
                    return (
                      <tr key={p.id} className={`border-b border-line/60 ${p.escalar ? '' : 'opacity-50'}`}>
                        <td className="py-2 pr-3">
                          <span className="font-medium">{p.nome}</span>
                          {etiquetas.map((t) => (
                            <span
                              key={t}
                              className={`ml-2 inline-block rounded px-1.5 py-0.5 text-xs ${
                                t.startsWith('domingo') ? 'border border-line text-soft' : 'bg-brand-light'
                              }`}
                            >
                              {t}
                            </span>
                          ))}
                        </td>
                        <td className="px-2 py-2 text-soft">{rotuloSexo(p.sexo)}</td>
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
