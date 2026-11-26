import { AlertTriangle, CheckCircle2, Info, Plus, Trash2 } from "lucide-react";
import { useMemo, useState } from "react";
import { REGRAS } from "../config/regras";
import { fmtHoras } from "../engine/conformidade";
import { calcularQuadro } from "../engine/contratacoes";
import { jornadaDaFuncao, tetoSemanalNaData } from "../engine/jornada";
import {
  DIAS_UTEIS,
  agruparDiasUteis,
  definirMinimoPorDia,
  minimoDoDia,
  minimoMaisComum,
  temMinimosPorDia,
  valoresDosDiasUteis,
} from "../engine/minimos";
import { jornadaMaisComum } from "../portal/equipe";
import { useStore } from "../store/useStore";
import type { CoberturaTurno, DiaUtil, Turno } from "../types";
import { DIAS_CURTOS } from "../utils/analise";
import {
  MODELOS_PERIODOS,
  aplicarAcaoAviso,
  avisosCobertura,
  descreverHorarios,
  descreverMinimosPorDia,
  modeloPeriodos,
  resumoEstimativa,
  type AcaoAviso,
  type ModeloPeriodosId,
} from "../utils/passo3";
import { Campo, Contador } from "./ui";

const MAX_AVISOS_VISIVEIS = 4;
const VAZIO: CoberturaTurno = { util: 0, sab: 0, dom: 0 };
const DIA_UTIL: Record<DiaUtil, { curto: string; longo: string }> = {
  1: { curto: "Seg", longo: "segunda-feira" },
  2: { curto: "Ter", longo: "terça-feira" },
  3: { curto: "Qua", longo: "quarta-feira" },
  4: { curto: "Qui", longo: "quinta-feira" },
  5: { curto: "Sex", longo: "sexta-feira" },
};

export function StepCobertura() {
  const turnos = useStore((s) => s.turnos);
  const cobertura = useStore((s) => s.cobertura);
  const set = useStore((s) => s.set);
  const empresa = useStore((s) => s.empresa);
  const dias = empresa.diasFuncionamento;
  const funcoes = useStore((s) => s.funcoes);
  const inicioEscala = useStore((s) => s.inicioEscala);
  const custo = useStore((s) => s.custo);
  const etapa = useStore((s) => s.etapaImpacto);
  const regrasPessoais = useStore((s) => s.regrasPessoais);
  // "Definir por dia" aberto/fechado pelo usuário; sem escolha, abre se já há valores por dia.
  const [porDiaAberto, setPorDiaAberto] = useState<Record<string, boolean>>({});

  // Jornada de cada função (horário do empregado, separado dos períodos abaixo).
  const teto = tetoSemanalNaData(inicioEscala);
  const jornadas = funcoes.map((f) => {
    if (!f.pessoas) return { f, j: jornadaDaFuncao(f, teto), comum: false };
    const c = jornadaMaisComum(f);
    const ef = c
      ? {
          ...f,
          horasSemanaisAtuais: c.horasSemanais,
          entrada: c.entrada,
          saida: c.saida,
          intervaloMin: c.intervaloMin,
        }
      : f;
    return { f: ef, j: jornadaDaFuncao(ef, teto), comum: c !== null };
  });
  const brutoRef = Math.max(1, ...jornadas.map((x) => x.j.bruto));

  // Coerência com o passo 1: dias em que a empresa não funciona não exigem pessoas.
  const abertosUteis = [1, 2, 3, 4, 5].filter((d) => dias[d]);
  const grupos = {
    util: {
      aberto: abertosUteis.length > 0,
      nome:
        abertosUteis.length === 5
          ? "segunda a sexta"
          : abertosUteis.map((d) => DIAS_CURTOS[d]).join(", ") ||
            "segunda a sexta",
    },
    sab: { aberto: dias[6], nome: "sábado" },
    dom: { aberto: dias[0], nome: "domingo" },
  } as const;
  const maiuscula = (s: string) => s.charAt(0).toUpperCase() + s.slice(1);

  const q = useMemo(
    () =>
      calcularQuadro(
        { empresa, funcoes, turnos, cobertura, custo },
        etapa,
        REGRAS,
        regrasPessoais,
      ),
    [empresa, funcoes, turnos, cobertura, custo, etapa, regrasPessoais],
  );
  const estimativa = resumoEstimativa(q);
  const avisos = avisosCobertura({
    empresa,
    turnos,
    cobertura,
    jornadaMin: brutoRef,
  });

  const limpar = { escala: null, propostas: [] };

  const atualizarTurno = (id: string, p: Partial<Turno>) =>
    set({
      turnos: turnos.map((t) => (t.id === id ? { ...t, ...p } : t)),
      ...limpar,
    });

  const atualizarCob = (id: string, chave: "util" | "sab" | "dom", v: number) => {
    const atual = cobertura[id] ?? VAZIO;
    set({
      cobertura: {
        ...cobertura,
        // Um número só de segunda a sexta: descarta valores por dia antigos.
        [id]:
          chave === "util"
            ? agruparDiasUteis(atual, v)
            : { ...atual, [chave]: Math.max(0, v) },
      },
      ...limpar,
    });
  };

  const atualizarCobDia = (id: string, dow: DiaUtil, v: number) =>
    set({
      cobertura: {
        ...cobertura,
        [id]: definirMinimoPorDia(cobertura[id] ?? VAZIO, dow, v),
      },
      ...limpar,
    });

  const usarMesmoNumero = (id: string) => {
    const atual = cobertura[id] ?? VAZIO;
    setPorDiaAberto((p) => ({ ...p, [id]: false }));
    set({
      cobertura: {
        ...cobertura,
        [id]: agruparDiasUteis(atual, minimoMaisComum(atual, abertosUteis)),
      },
      ...limpar,
    });
  };

  const atualizarCobFuncao = (
    id: string,
    funcaoId: string,
    chave: "util" | "sab" | "dom",
    v: number,
  ) => {
    const atual = cobertura[id] ?? VAZIO;
    const minimos = atual.porFuncao?.[funcaoId] ?? VAZIO;
    const porFuncao = {
      ...atual.porFuncao,
      [funcaoId]: { ...minimos, [chave]: Math.max(0, v) },
    };
    // Sem nenhum mínimo, remove a função para não guardar zeros.
    const m = porFuncao[funcaoId];
    const somaUteis = valoresDosDiasUteis(m).reduce((a, b) => a + b, 0);
    if (somaUteis + m.sab + m.dom === 0) delete porFuncao[funcaoId];
    set({
      cobertura: {
        ...cobertura,
        [id]: { ...atual, porFuncao },
      },
      ...limpar,
    });
  };

  const usarModelo = (id: ModeloPeriodosId) => {
    const c0 = turnos[0] ? cobertura[turnos[0].id] : undefined;
    const r = modeloPeriodos(
      empresa,
      id,
      c0
        ? { util: minimoMaisComum(c0, abertosUteis), sab: c0.sab, dom: c0.dom }
        : undefined,
    );
    set({ ...r, ...limpar });
  };

  const resolver = (acao: AcaoAviso) =>
    set({
      ...aplicarAcaoAviso({ empresa, turnos, cobertura }, acao, `turno-${Date.now()}`),
      ...limpar,
    });

  const adicionar = () => {
    const id = `turno-${Date.now()}`;
    set({
      turnos: [
        ...turnos,
        {
          id,
          nome: "Novo período",
          inicio: "13:00",
          fim: "22:00",
          intervaloMin: 60,
        },
      ],
      cobertura: { ...cobertura, [id]: { util: 1, sab: 1, dom: 0 } },
      ...limpar,
    });
  };

  const remover = (id: string) => {
    const resto = { ...cobertura };
    delete resto[id];
    set({
      turnos: turnos.filter((t) => t.id !== id),
      cobertura: resto,
      ...limpar,
    });
  };

  const abertosTodos = [1, 2, 3, 4, 5, 6, 0].filter((d) => dias[d]);
  const estiloEstimativa =
    estimativa.nivel === "ok"
      ? "border-green-300 bg-green-50 text-green-900"
      : estimativa.nivel === "atencao"
        ? "border-amber-300 bg-amber-50 text-amber-900"
        : "border-line bg-brand-light/40";
  const IconeEstimativa =
    estimativa.nivel === "ok"
      ? CheckCircle2
      : estimativa.nivel === "atencao"
        ? AlertTriangle
        : Info;

  const avisoItem = (a: (typeof avisos)[number]) => (
    <li key={a.id} className="space-y-1">
      <p>{a.texto}</p>
      {a.acao && (
        <button
          type="button"
          className="btn-sec !py-1 text-xs"
          onClick={() => resolver(a.acao!)}
        >
          {a.acao.rotulo}
        </button>
      )}
    </li>
  );

  return (
    <section className="cartao space-y-4" aria-labelledby="t-cob">
      <h2 id="t-cob" className="text-xl font-bold">
        3. Períodos e cobertura
      </h2>
      <p className="text-sm text-soft">
        Quantas pessoas, no mínimo, precisam estar na empresa em cada período
        do dia? Não é o horário de cada empregado: a ferramenta monta o horário
        de cada pessoa sozinha.
      </p>

      <div
        className={`flex items-start gap-2 rounded-lg border p-3 text-sm ${estiloEstimativa}`}
        aria-live="polite"
      >
        <IconeEstimativa size={20} aria-hidden className="mt-0.5 shrink-0" />
        <div>
          <p className="font-semibold">{estimativa.titulo}</p>
          <p>{estimativa.detalhe}</p>
        </div>
      </div>

      <div>
        <p className="mb-2 text-sm font-medium">Começar por um modelo</p>
        <div className="flex flex-wrap gap-2">
          {MODELOS_PERIODOS.map((m) => (
            <button
              key={m.id}
              type="button"
              className="btn-sec"
              onClick={() => usarModelo(m.id)}
            >
              {m.rotulo}
            </button>
          ))}
        </div>
        <p className="mt-1 text-xs text-soft">
          Substitui os períodos abaixo. Você pode ajustar depois.
        </p>
      </div>

      <p className="text-xs text-soft">
        Horário da empresa (passo 1):{" "}
        {abertosTodos.length > 0
          ? descreverHorarios(empresa, abertosTodos)
          : "nenhum dia marcado"}
        .
      </p>

      {turnos.map((t) => {
        const c = cobertura[t.id] ?? VAZIO;
        const porDia =
          grupos.util.aberto && (porDiaAberto[t.id] ?? temMinimosPorDia(c));
        const temPorFuncao = Object.keys(c.porFuncao ?? {}).length > 0;
        return (
          <div
            key={t.id}
            className="space-y-3 rounded-lg border border-line p-3"
          >
            <div className="grid gap-3 sm:grid-cols-4">
              <div className="sm:col-span-2">
                <Campo rotulo="Nome do período">
                  <input
                    className="campo"
                    value={t.nome}
                    onChange={(e) =>
                      atualizarTurno(t.id, { nome: e.target.value })
                    }
                  />
                </Campo>
              </div>
              <Campo rotulo="Início">
                <input
                  type="time"
                  className="campo"
                  value={t.inicio}
                  onChange={(e) =>
                    atualizarTurno(t.id, { inicio: e.target.value })
                  }
                />
              </Campo>
              <Campo rotulo="Fim">
                <input
                  type="time"
                  className="campo"
                  value={t.fim}
                  onChange={(e) =>
                    atualizarTurno(t.id, { fim: e.target.value })
                  }
                />
              </Campo>
            </div>
            {porDia && (
              <fieldset className="space-y-2 rounded-lg border border-line p-3">
                <legend className="px-1 text-sm font-medium">
                  Segunda a sexta, dia a dia
                </legend>
                <div className="grid grid-cols-2 gap-3 sm:grid-cols-5">
                  {DIAS_UTEIS.map((d) => (
                    <Contador
                      key={d}
                      rotulo={DIA_UTIL[d].curto}
                      descricao={`${t.nome}, ${DIA_UTIL[d].longo}`}
                      aria={`na ${DIA_UTIL[d].longo} — ${t.nome}`}
                      desabilitado={!dias[d]}
                      valor={minimoDoDia(c, d)}
                      onChange={(v) => atualizarCobDia(t.id, d, v)}
                    />
                  ))}
                </div>
                <p className="text-xs text-soft">
                  {descreverMinimosPorDia(c, dias)}
                </p>
                <button
                  type="button"
                  className="btn-sec !py-1 text-xs"
                  onClick={() => usarMesmoNumero(t.id)}
                >
                  Usar o mesmo número em todos os dias
                </button>
              </fieldset>
            )}
            <div className="grid gap-3 sm:grid-cols-3">
              {(porDia
                ? (["sab", "dom"] as const)
                : (["util", "sab", "dom"] as const)
              ).map((g) => (
                <div key={g}>
                  <Contador
                    rotulo={maiuscula(grupos[g].nome)}
                    descricao={`${t.nome}, ${grupos[g].nome}`}
                    desabilitado={!grupos[g].aberto}
                    valor={c[g]}
                    onChange={(v) => atualizarCob(t.id, g, v)}
                  />
                  {g === "util" && grupos.util.aberto && (
                    <button
                      type="button"
                      className="mt-1 text-xs font-medium underline underline-offset-2"
                      aria-label={`Definir o mínimo de pessoas por dia da semana — ${t.nome}`}
                      onClick={() =>
                        setPorDiaAberto((p) => ({ ...p, [t.id]: true }))
                      }
                    >
                      Definir por dia
                    </button>
                  )}
                </div>
              ))}
            </div>
            {funcoes.length > 1 && (
              <details
                className="rounded-lg border border-line bg-brand-light/40 p-3"
                open={temPorFuncao || undefined}
              >
                <summary className="cursor-pointer text-sm font-medium">
                  Avançado: mínimo por cargo
                </summary>
                <p className="mb-2 mt-2 text-xs text-soft">
                  Além do total acima, exija um mínimo de pessoas de um cargo
                  neste período. Deixe 0 para não exigir. Se a soma dos cargos
                  passar do total, vale a soma.
                </p>
                <div className="space-y-2">
                  {funcoes.map((fn) => {
                    const m = c.porFuncao?.[fn.id] ?? VAZIO;
                    return (
                      <div
                        key={fn.id}
                        className="grid items-end gap-3 sm:grid-cols-4"
                      >
                        <p className="text-sm font-medium sm:pb-2">
                          {fn.nome}{" "}
                          <span className="text-xs font-normal text-soft">
                            ({fn.quantidade} na equipe)
                          </span>
                        </p>
                        {(["util", "sab", "dom"] as const).map((g) => (
                          <Campo
                            key={g}
                            rotulo={`Mínimo — ${grupos[g].nome}`}
                          >
                            <input
                              type="number"
                              min={0}
                              className="campo disabled:cursor-not-allowed disabled:bg-gray-100 disabled:text-soft"
                              disabled={!grupos[g].aberto}
                              aria-label={`Mínimo de ${fn.nome} — ${grupos[g].nome} — ${t.nome}`}
                              value={grupos[g].aberto ? m[g] : 0}
                              onChange={(e) =>
                                atualizarCobFuncao(
                                  t.id,
                                  fn.id,
                                  g,
                                  Number(e.target.value),
                                )
                              }
                            />
                          </Campo>
                        ))}
                      </div>
                    );
                  })}
                </div>
                {[0, 1, 2, 3, 4, 5, 6].some((d) => {
                  const soma = funcoes.reduce((a, fn) => {
                    const mf = c.porFuncao?.[fn.id];
                    return a + (mf ? minimoDoDia(mf, d) : 0);
                  }, 0);
                  return dias[d] && soma > minimoDoDia(c, d);
                }) && (
                  <p className="mt-2 text-xs text-amber-800" role="note">
                    A soma dos cargos passa do total em algum dia; a ferramenta
                    usa a soma como mínimo.
                  </p>
                )}
              </details>
            )}
            {turnos.length > 1 && (
              <button
                type="button"
                className="btn-sec"
                onClick={() => remover(t.id)}
              >
                <Trash2 size={16} aria-hidden /> Remover período
              </button>
            )}
          </div>
        );
      })}

      <button type="button" className="btn-sec" onClick={adicionar}>
        <Plus size={16} aria-hidden /> Adicionar período
      </button>

      {avisos.length === 0 ? (
        <p
          className="flex items-center gap-2 rounded-lg border border-green-300 bg-green-50 p-3 text-sm text-green-900"
          role="status"
        >
          <CheckCircle2 size={18} aria-hidden /> Tudo certo com a cobertura.
        </p>
      ) : (
        <div
          className="rounded-lg border border-amber-300 bg-amber-50 p-3 text-sm text-amber-900"
          role="region"
          aria-labelledby="t-atencao-cob"
        >
          <p
            id="t-atencao-cob"
            className="mb-2 flex items-center gap-2 font-semibold"
          >
            <AlertTriangle size={18} aria-hidden /> Atenção
          </p>
          <ul className="space-y-3">
            {avisos.slice(0, MAX_AVISOS_VISIVEIS).map(avisoItem)}
          </ul>
          {avisos.length > MAX_AVISOS_VISIVEIS && (
            <details className="mt-3">
              <summary className="cursor-pointer text-xs font-medium">
                Ver mais {avisos.length - MAX_AVISOS_VISIVEIS}
              </summary>
              <ul className="mt-2 space-y-3">
                {avisos.slice(MAX_AVISOS_VISIVEIS).map(avisoItem)}
              </ul>
            </details>
          )}
        </div>
      )}

      <details className="rounded-lg border border-line p-3 text-sm">
        <summary className="cursor-pointer font-medium">
          Como a jornada de cada pessoa é definida
        </summary>
        <p className="mt-2 text-xs text-soft">
          A ferramenta usa a jornada de cada cargo (passo 2), com até {teto}h
          por semana, e encaixa cada pessoa dentro do horário da empresa:
        </p>
        <ul className="mt-1 list-disc pl-5 text-xs">
          {jornadas.map(({ f, j, comum }) => (
            <li key={f.id}>
              {f.nome}
              {comum ? " (jornada mais comum da equipe)" : ""}:{" "}
              {fmtHoras(j.bruto - j.intervaloMin)} de trabalho +{" "}
              {j.intervaloMin} min de intervalo
              {j.inicioFixo !== undefined
                ? `, sempre das ${f.entrada} às ${f.saida}`
                : ""}
            </li>
          ))}
        </ul>
      </details>
    </section>
  );
}
