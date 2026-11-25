import { Plus, Trash2 } from "lucide-react";
import { useStore } from "../store/useStore";
import { DIAS_CURTOS, horarioDoDia } from "../utils/analise";
import type { Turno } from "../types";
import { fmtHoras } from "../engine/conformidade";
import { minutosDe } from "../engine/datas";
import { jornadaDaFuncao, tetoSemanalNaData } from "../engine/jornada";
import { jornadaMaisComum } from "../portal/equipe";
import { Campo } from "./ui";

export function StepCobertura() {
  const turnos = useStore((s) => s.turnos);
  const cobertura = useStore((s) => s.cobertura);
  const set = useStore((s) => s.set);
  const empresa = useStore((s) => s.empresa);
  const dias = empresa.diasFuncionamento;
  const funcoes = useStore((s) => s.funcoes);
  const inicioEscala = useStore((s) => s.inicioEscala);

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
  // Dias em que o horário de funcionamento é menor que a jornada: a entrada–saída não cabe.
  const naoCabe = [1, 2, 3, 4, 5, 6, 0]
    .filter((d) => dias[d])
    .filter((d) => {
      const h = horarioDoDia(empresa, d);
      return minutosDe(h.fecha) - minutosDe(h.abre) < brutoRef;
    })
    .map((d) => DIAS_CURTOS[d]);

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
  const fechados = (["util", "sab", "dom"] as const).filter(
    (g) => !grupos[g].aberto,
  );

  // Avisa quando o turno começa antes de abrir ou termina depois de fechar em algum dia exigido.
  const foraDoHorario = (
    t: Turno,
    c: { util: number; sab: number; dom: number },
  ) => {
    const out: string[] = [];
    for (const d of [1, 2, 3, 4, 5, 6, 0]) {
      if (!dias[d]) continue;
      const exigido = d === 0 ? c.dom : d === 6 ? c.sab : c.util;
      if (exigido <= 0) continue;
      const h = horarioDoDia(empresa, d);
      if (t.inicio < h.abre || t.fim > h.fecha)
        out.push(`${DIAS_CURTOS[d]} (${h.abre}–${h.fecha})`);
    }
    return out;
  };

  // Dias com cobertura exigida cujo horário de funcionamento não é totalmente coberto pelos períodos.
  const lacunas: string[] = [];
  for (const d of [1, 2, 3, 4, 5, 6, 0]) {
    if (!dias[d]) continue;
    const h = horarioDoDia(empresa, d);
    const faixas = turnos
      .filter(
        (t) =>
          (cobertura[t.id]?.[d === 0 ? "dom" : d === 6 ? "sab" : "util"] ?? 0) >
          0,
      )
      .map((t) => [t.inicio, t.fim] as const)
      .sort((a, b) => (a[0] < b[0] ? -1 : 1));
    let ate = h.abre;
    for (const [i, f] of faixas) {
      if (i <= ate && f > ate) ate = f;
    }
    if (faixas.length > 0 && ate < h.fecha)
      lacunas.push(`${DIAS_CURTOS[d]} (${h.abre}–${h.fecha})`);
  }

  const limpar = { escala: null, propostas: [] };

  const atualizarTurno = (id: string, p: Partial<Turno>) =>
    set({
      turnos: turnos.map((t) => (t.id === id ? { ...t, ...p } : t)),
      ...limpar,
    });

  const atualizarCob = (id: string, chave: "util" | "sab" | "dom", v: number) =>
    set({
      cobertura: {
        ...cobertura,
        [id]: { ...cobertura[id], [chave]: Math.max(0, v) },
      },
      ...limpar,
    });

  const atualizarCobFuncao = (
    id: string,
    funcaoId: string,
    chave: "util" | "sab" | "dom",
    v: number,
  ) => {
    const atual = cobertura[id] ?? { util: 0, sab: 0, dom: 0 };
    const minimos = atual.porFuncao?.[funcaoId] ?? { util: 0, sab: 0, dom: 0 };
    const porFuncao = {
      ...atual.porFuncao,
      [funcaoId]: { ...minimos, [chave]: Math.max(0, v) },
    };
    // Sem nenhum mínimo, remove a função para não guardar zeros.
    const m = porFuncao[funcaoId];
    if (m.util + m.sab + m.dom === 0) delete porFuncao[funcaoId];
    set({
      cobertura: {
        ...cobertura,
        [id]: { ...atual, porFuncao },
      },
      ...limpar,
    });
  };

  const ajustarAoHorario = (
    id: string,
    c: { util: number; sab: number; dom: number },
  ) => {
    const exigidos = [1, 2, 3, 4, 5, 6, 0].filter(
      (d) => dias[d] && (d === 0 ? c.dom : d === 6 ? c.sab : c.util) > 0,
    );
    if (exigidos.length === 0) return;
    const hs = exigidos.map((d) => horarioDoDia(empresa, d));
    atualizarTurno(id, {
      inicio: hs.map((h) => h.abre).reduce((a, b) => (a > b ? a : b)),
      fim: hs.map((h) => h.fecha).reduce((a, b) => (a < b ? a : b)),
    });
  };

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

  return (
    <section className="cartao space-y-4" aria-labelledby="t-cob">
      <h2 id="t-cob" className="text-xl font-bold">
        3. Períodos e cobertura
      </h2>
      <p className="text-sm text-soft">
        Defina os períodos do dia do estabelecimento e quantas pessoas, no
        mínimo, precisam estar presentes durante cada um. Isto NÃO é o horário
        do empregado: a ferramenta monta o horário de cada pessoa respeitando a
        jornada diária, o intervalo e o descanso entre jornadas. Os dias seguem
        o que você informou no passo 1: onde a empresa não funciona, não se
        exige ninguém.
      </p>
      {fechados.length > 0 && (
        <p
          className="rounded-lg border border-line bg-brand-light p-2 text-xs"
          role="note"
        >
          Empresa fechada em:{" "}
          {fechados
            .map((g) => (g === "util" ? "dias úteis" : grupos[g].nome))
            .join(", ")}{" "}
          (passo 1).
        </p>
      )}

      <div className="rounded-lg border border-line p-3">
        <p className="mb-1 text-sm font-medium">
          Horário de funcionamento (passo 1)
        </p>
        <ul className="flex flex-wrap gap-x-4 gap-y-1 text-sm">
          {[1, 2, 3, 4, 5, 6, 0].map((d) => (
            <li key={d} className={dias[d] ? "" : "text-soft"}>
              <strong>{DIAS_CURTOS[d]}</strong>{" "}
              {dias[d]
                ? `${horarioDoDia(empresa, d).abre}–${horarioDoDia(empresa, d).fecha}`
                : "fechado"}
            </li>
          ))}
        </ul>
        {lacunas.length > 0 && (
          <p
            className="mt-2 rounded-lg border border-amber-300 bg-amber-50 p-2 text-xs"
            role="note"
          >
            Os períodos não cobrem todo o horário de funcionamento em:{" "}
            {lacunas.join("; ")}. Ajuste os períodos ou inclua outro.
          </p>
        )}
      </div>

      <div className="rounded-lg border border-line p-3 text-sm">
        <p className="mb-1 font-medium">
          Jornada dos empregados (gerada pela ferramenta; limite semanal da
          etapa: {teto}h)
        </p>
        <ul className="list-disc pl-5 text-xs">
          {jornadas.map(({ f, j, comum }) => (
            <li key={f.id}>
              {f.nome}
              {comum ? " (jornada mais comum da equipe)" : ""}:{" "}
              {fmtHoras(j.bruto - j.intervaloMin)} líquidas +{" "}
              {j.intervaloMin} min de intervalo = {fmtHoras(j.bruto)} entre
              entrada e saída
              {j.inicioFixo !== undefined
                ? ` (horário fixo ${f.entrada}–${f.saida})`
                : ""}
            </li>
          ))}
        </ul>
        {naoCabe.length > 0 && (
          <p
            className="mt-2 rounded-lg border border-amber-300 bg-amber-50 p-2 text-xs"
            role="note"
          >
            O horário de funcionamento é menor que a jornada de{" "}
            {fmtHoras(brutoRef)} em: {naoCabe.join(", ")}. A entrada–saída
            passará do fechamento; amplie o horário no passo 1 ou defina uma
            entrada/saída fixa menor para a função no passo 2.
          </p>
        )}
      </div>

      {turnos.map((t) => {
        const c = cobertura[t.id] ?? { util: 0, sab: 0, dom: 0 };
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
            <p className="text-xs text-soft">
              Duração do período:{" "}
              {fmtHoras((minutosDe(t.fim) - minutosDe(t.inicio) + 1440) % 1440 || 1440)}
              . Com jornadas de {fmtHoras(brutoRef)}, manter o mínimo exige
              cerca de{" "}
              {Math.ceil(
                (c.util *
                  ((minutosDe(t.fim) - minutosDe(t.inicio) + 1440) % 1440 || 1440)) /
                  brutoRef,
              )}{" "}
              jornada(s) por dia útil.
            </p>
            {foraDoHorario(t, c).length > 0 && (
              <p
                className="rounded-lg border border-amber-300 bg-amber-50 p-2 text-xs"
                role="note"
              >
                Atenção: este período ({t.inicio}–{t.fim}) passa do horário de
                funcionamento em: {foraDoHorario(t, c).join("; ")}. Ajuste o
                período ou o horário do dia (passo 1).
              </p>
            )}
            <div className="grid gap-3 sm:grid-cols-3">
              {(["util", "sab", "dom"] as const).map((g) => (
                <Campo
                  key={g}
                  rotulo={`Mínimo de pessoas presentes — ${grupos[g].nome}`}
                  ajuda={
                    grupos[g].aberto
                      ? undefined
                      : "A empresa não funciona nesse(s) dia(s) (passo 1), então não se exige ninguém."
                  }
                >
                  <input
                    type="number"
                    min={0}
                    className="campo disabled:cursor-not-allowed disabled:bg-gray-100 disabled:text-soft"
                    disabled={!grupos[g].aberto}
                    value={grupos[g].aberto ? c[g] : 0}
                    onChange={(e) =>
                      atualizarCob(t.id, g, Number(e.target.value))
                    }
                  />
                </Campo>
              ))}
            </div>
            {funcoes.length > 1 && (
              <div className="rounded-lg border border-line bg-brand-light/40 p-3">
                <p className="text-sm font-medium">
                  Mínimo por função (opcional)
                </p>
                <p className="mb-2 text-xs text-soft">
                  Além do total acima, exija um mínimo de pessoas de uma função
                  neste período. Deixe 0 para não exigir. Se a soma dos mínimos
                  por função passar do total, vale a soma.
                </p>
                <div className="space-y-2">
                  {funcoes.map((fn) => {
                    const m = c.porFuncao?.[fn.id] ?? { util: 0, sab: 0, dom: 0 };
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
                {(["util", "sab", "dom"] as const).some((g) => {
                  const soma = funcoes.reduce(
                    (a, fn) => a + (c.porFuncao?.[fn.id]?.[g] ?? 0),
                    0,
                  );
                  return grupos[g].aberto && soma > c[g];
                }) && (
                  <p className="mt-2 text-xs text-amber-800" role="note">
                    A soma dos mínimos por função passa do total em algum grupo
                    de dias; a ferramenta considera a soma como o mínimo real.
                  </p>
                )}
              </div>
            )}
            <button
              type="button"
              className="btn-sec"
              onClick={() => ajustarAoHorario(t.id, c)}
            >
              Usar todo o horário de funcionamento neste período
            </button>
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
    </section>
  );
}
