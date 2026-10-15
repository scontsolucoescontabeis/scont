// Projeto PDI/js/pdi-documento.js
/**
 * PDI — monta o documento completo (mesma ordem e textos do documento de referência)
 * como uma lista de blocos neutros. Renderizado pela tela, pelo modo Apresentar,
 * pela impressão/PDF e pelo DOCX. Módulo puro (sem DOM).
 *
 * Bloco: { t: 'secao'|'sub'|'p'|'nota'|'kv'|'tabela'|'lista'|'assinaturas', ... }
 */
(function (root, factory) {
    if (typeof module !== 'undefined' && module.exports) {
        module.exports = factory(require('./textos.js'), require('./pdi-calculo.js'));
    } else {
        root.PdiDocumento = factory(root.PdiTextos, root.PdiCalculo);
    }
})(typeof self !== 'undefined' ? self : this, function (T, C) {
    'use strict';

    function fmtData(iso) {
        if (!iso) return '__/__/____';
        const [a, m, d] = String(iso).slice(0, 10).split('-');
        return `${d}/${m}/${a}`;
    }
    function fmtPct(n) {
        return n == null ? '—' : `${String(n).replace('.', ',')}%`;
    }
    const nz = (v, alt) => (v == null || v === '' ? (alt === undefined ? '—' : alt) : v);

    function rotinasComNiveis(d) {
        return (d.tecnicas || []).map(t => ({ ...t, niveis: t.niveis || [] }));
    }

    function valorIndicador(ind, d) {
        const rot = rotinasComNiveis(d);
        if (ind.calculo_automatico === 'autonomia') return C.autonomia(rot);
        if (ind.calculo_automatico === 'pendencias') {
            const p = C.pendencias(d.sinalizacoes || []);
            if (p != null) return p;
        }
        if (ind.calculo_automatico === 'controles') {
            const prev = d.semanasPrevistas;
            const real = (d.alinhamentos || []).filter(a => a.realizado).length;
            if (prev) return C.controles(real, prev);
        }
        const ap = (ind.apuracoes || []).slice().sort((a, b) => String(a.competencia_mes).localeCompare(String(b.competencia_mes)));
        for (let i = ap.length - 1; i >= 0; i--) if (ap[i].percentual != null) return Number(ap[i].percentual);
        return null;
    }

    function metaTexto(ind) {
        if (ind.meta_texto) return ind.meta_texto;
        return ind.valor_meta != null ? `${ind.operador === '>=' ? '≥ ' : ''}${ind.valor_meta}%` : '—';
    }

    function montar(d) {
        const pdi = d.pdi;
        const cont = pdi.conteudo || {};
        const B = [];
        const tx = T.TEXTOS;
        const ciclos = (d.ciclos && d.ciclos.length) ? d.ciclos : C.ciclos(pdi.data_inicio).map(c => ({
            numero: c.numero, inicio: c.inicio, fim: c.fim,
            periodo_relativo: T.CICLOS[c.numero - 1].periodo, foco_resultado_esperado: T.CICLOS[c.numero - 1].foco,
        }));

        // Cabeçalho
        B.push({ t: 'titulo', texto: 'PLANO DE DESENVOLVIMENTO INDIVIDUAL' });
        B.push({ t: 'kv', pares: [
            ['Nome', pdi.colaborador_nome],
            ['Cargo e setor', pdi.cargo_setor],
            ['Admissão', fmtData(pdi.admissao)],
            ['Gestor responsável', nz(pdi.gestor_nome)],
            ['Início do PDI', fmtData(pdi.data_inicio)],
            ['Acompanhamento', pdi.acompanhamento_texto || T.CABECALHO_PADRAO.acompanhamento],
            ['Avaliação', pdi.avaliacao_texto || T.CABECALHO_PADRAO.avaliacao],
        ] });

        // 1
        B.push({ t: 'secao', id: 'objetivo', texto: T.SECOES[1].titulo });
        (cont.objetivo || [tx.objetivo1, tx.objetivo2]).forEach(p => B.push({ t: 'p', texto: p }));
        if (pdi.contexto_desenvolvimento) {
            B.push({ t: 'p', rotulo: 'Contexto de desenvolvimento', texto: pdi.contexto_desenvolvimento });
        }

        // 2
        B.push({ t: 'secao', id: 'perfil', texto: T.SECOES[2].titulo });
        B.push({ t: 'sub', texto: 'Perfil evidenciado' });
        const pc = pdi.perfil_comportamental || {};
        if (pc.disc) {
            B.push({ t: 'p', texto: `O relatório comportamental de ${fmtData(pc.data_relatorio)} apresenta predominância DISC ${pc.disc} — ${pc.disc_descritor || ''}.`.replace(' — .', '.') });
            if (pc.descricao) B.push({ t: 'p', texto: pc.descricao });
            if (pc.complementares) B.push({ t: 'p', texto: `${pc.complementares} ${tx.avisoPerfilEvidenciado}` });
            else B.push({ t: 'nota', texto: tx.avisoPerfilEvidenciado });
        } else {
            B.push({ t: 'p', texto: 'Perfil comportamental ainda não registrado.' });
            B.push({ t: 'nota', texto: tx.avisoPerfilEvidenciado });
        }
        B.push({ t: 'sub', texto: 'Perfil esperado para o cargo' });
        B.push({
            t: 'tabela', cab: ['Competência', 'Evidência do relatório', 'Direcionamento inicial', 'Status'],
            linhas: (cont.perfil_esperado || []).map(r => ({
                destaque: r.status === 'prioritario',
                cels: [r.competencia, r.evidencia, r.direcionamento, T.STATUS_PERFIL[r.status] || r.status],
            })),
        });
        B.push({ t: 'p', texto: tx.statusPerfilProposto });
        B.push({ t: 'nota', texto: tx.avisoPerfilEsperado });

        // 3
        B.push({ t: 'secao', id: 'pilares12', texto: T.SECOES[3].titulo });
        B.push({ t: 'sub', texto: 'PILAR 1 – COMPETÊNCIAS TÉCNICAS' });
        B.push({ t: 'p', texto: tx.pilar1Intro });
        B.push({
            t: 'tabela', cab: ['Competência', 'Prática de desenvolvimento', 'Meta no primeiro ciclo', 'Priorizada', 'Nível atual'],
            linhas: (d.tecnicas || []).map(r => {
                const n = C.nivelAtual(r.niveis || []);
                return { cels: [r.competencia, r.pratica, r.meta_ciclo1, r.priorizada ? 'Sim' : 'Não', n == null ? '—' : String(n)] };
            }),
        });
        const prog = C.progressoTecnico(rotinasComNiveis(d), 2);
        if (prog.total) B.push({ t: 'p', texto: `Progresso: ${prog.atingidas} de ${prog.total} rotinas priorizadas no nível 2 ou superior.` });
        B.push({ t: 'sub', texto: 'Escala de evolução técnica' });
        B.push({ t: 'lista', itens: T.ESCALA_TECNICA.map(e => `${e.nivel} — ${e.titulo}: ${e.descricao}`) });
        B.push({ t: 'p', texto: tx.pilar1Regra });
        B.push({ t: 'sub', texto: 'PILAR 2 – COMPETÊNCIAS COMPORTAMENTAIS' });
        B.push({
            t: 'tabela', cab: ['Competência', 'Comportamento esperado', 'Ação e evidência', 'Nota atual'],
            linhas: (d.comportamentais || []).map(r => {
                const av = (r.avaliacoes || []).slice().sort((a, b) => String(a.data).localeCompare(String(b.data)));
                return { cels: [r.competencia, r.comportamento_esperado, r.acao_evidencia, av.length ? String(av[av.length - 1].nota) : '—'] };
            }),
        });

        // 4
        B.push({ t: 'secao', id: 'plano', texto: T.SECOES[4].titulo });
        B.push({ t: 'p', texto: tx.planoIntro });
        B.push({
            t: 'tabela', cab: ['Foco e ação', 'Responsáveis', 'Prazo', 'Evidência esperada', 'Status'],
            linhas: (d.acoes || []).map(a => {
                const pr = C.prazoRelativo(pdi.data_inicio, a.prazo_dias, a.recorrencia);
                return { cels: [a.foco_acao, a.responsaveis, pr.data ? `${pr.rotulo} (${fmtData(pr.data)})` : pr.rotulo, a.evidencia_esperada, T.STATUS_ACAO[a.status] || a.status] };
            }),
        });
        B.push({ t: 'p', rotulo: 'Status inicial das ações', texto: tx.planoStatusInicial });
        B.push({ t: 'p', rotulo: 'Apoio da Scont', texto: pdi.apoio_scont || tx.apoioScont });

        // 5
        B.push({ t: 'secao', id: 'pilares34', texto: T.SECOES[5].titulo });
        B.push({ t: 'sub', texto: 'PILAR 3 — INDICADORES DE PERFORMANCE' });
        B.push({ t: 'p', texto: tx.pilar3Intro });
        B.push({
            t: 'tabela', cab: ['Indicador e cálculo', 'Meta proposta no ciclo 1', 'Evidência', 'Resultado atual'],
            linhas: (d.indicadores || []).map(i => {
                const v = valorIndicador(i, d);
                return { cels: [`${i.nome}: ${i.formula}`, metaTexto(i), i.evidencia, v == null ? 'Sem medição' : `${fmtPct(v)} — ${T.ATINGIMENTO[C.atingimento(i, v)]}`] };
            }),
        });
        B.push({ t: 'sub', texto: 'PILAR 4 — MELHORIAS APRESENTADAS' });
        B.push({ t: 'p', texto: tx.pilar4Intro });
        B.push({
            t: 'tabela', cab: tx.pilar4Colunas,
            linhas: (d.melhorias || []).map(m => ({
                cels: [`${fmtData(m.data)} — ${m.rotina}`, m.situacao_anterior, m.melhoria_evidencia,
                    m.validacao_gestor === 'validado' ? `Validado${m.comentario_gestor ? ': ' + m.comentario_gestor : ''}`
                        : m.validacao_gestor === 'nao_validado' ? `Não validado${m.comentario_gestor ? ': ' + m.comentario_gestor : ''}` : 'Pendente'],
            })),
        });
        B.push({ t: 'p', rotulo: 'Frequência', texto: tx.frequencia });

        // 6
        B.push({ t: 'secao', id: 'ficha', texto: T.SECOES[6].titulo });
        const fichas = (d.avaliacoes && d.avaliacoes.length) ? d.avaliacoes : [{ ciclo_numero: 1, pilares: [], direcionamentos: [] }];
        fichas.forEach(f => B.push(...blocosFicha(f, ciclos, pdi, d)));

        // 7
        B.push({ t: 'secao', id: 'evolucao', texto: T.SECOES[7].titulo });
        B.push({ t: 'p', texto: tx.evolucaoIntro });
        B.push({
            t: 'tabela', cab: ['Ciclo', 'Período relativo', 'Período', 'Foco e resultado esperado', 'Avaliação agendada'],
            linhas: ciclos.map(c => ({
                cels: [String(c.numero), c.periodo_relativo, `${fmtData(c.inicio)} a ${fmtData(c.fim)}`, c.foco_resultado_esperado, c.data_avaliacao_agendada ? fmtData(c.data_avaliacao_agendada) : '—'],
            })),
        });
        const nota = (pilar, k) => {
            const f = (d.avaliacoes || []).find(a => a.ciclo_numero === k);
            const p = f && (f.pilares || []).find(x => x.pilar === pilar);
            if (!p) return '';
            return p.na ? 'N/A' : (p.nota_ciclo != null ? String(p.nota_ciclo) : '');
        };
        const inicial = (pilar) => {
            const f = (d.avaliacoes || []).slice().sort((a, b) => a.ciclo_numero - b.ciclo_numero)[0];
            const p = f && (f.pilares || []).find(x => x.pilar === pilar);
            return p && p.nota_inicial != null ? String(p.nota_inicial) : '';
        };
        B.push({
            t: 'tabela', cab: ['Pilar', 'Inicial', 'Ciclo 1', 'Ciclo 2', 'Ciclo 3', 'Ciclo 4'],
            linhas: C.PILARES.map(p => ({ cels: [T.PILARES_CURTO[p], inicial(p), nota(p, 1), nota(p, 2), nota(p, 3), nota(p, 4)] })),
        });
        B.push({ t: 'p', texto: tx.evolucaoRodape });
        ciclos.filter(c => c.mudancas_escopo_apoio).forEach(c =>
            B.push({ t: 'p', rotulo: `Mudanças de escopo e apoio — ciclo ${c.numero}`, texto: c.mudancas_escopo_apoio }));

        // 8
        B.push({ t: 'secao', id: 'ciencia', texto: T.SECOES[8].titulo });
        B.push({ t: 'p', texto: tx.ciencia });
        const cs = (d.ciencias || []).filter(c => c.referencia === 'pdi');
        const reg = (papel) => cs.find(c => c.papel === papel);
        B.push({
            t: 'assinaturas',
            itens: [
                { papel: 'colaborador', rotulo: `${pdi.sexo_feminino === false ? 'Colaborador' : 'Colaboradora'}: ${pdi.colaborador_nome}`, registro: reg('colaborador') },
                { papel: 'gestor', rotulo: 'Gestor responsável', registro: reg('gestor') },
                { papel: 'diretoria', rotulo: 'Diretoria', registro: reg('diretoria') },
            ].map(i => ({
                ...i,
                texto: i.registro ? `${i.rotulo} — ${i.registro.nome}, ${fmtData(i.registro.assinado_em)}` : `${i.rotulo} — Assinatura / Data`,
            })),
        });
        return B;
    }

    function blocosFicha(f, ciclos, pdi, d) {
        const B = [];
        const c = ciclos.find(x => x.numero === f.ciclo_numero) || {};
        B.push({ t: 'sub', texto: `Ciclo: ${f.ciclo_numero} · Período: ${fmtData(c.inicio)} a ${fmtData(c.fim)} · Data da reunião: ${fmtData(f.data_reuniao)} · Gestor: ${nz(f.gestor_nome || pdi.gestor_nome, '______')}` });
        B.push({
            t: 'tabela', cab: ['Pilar', 'Nota inicial', 'Nota do ciclo', 'Evidências da avaliação'],
            linhas: C.PILARES.map(p => {
                const x = (f.pilares || []).find(q => q.pilar === p) || {};
                const ni = x.nota_inicial != null ? `${x.nota_inicial} / 4` : '__ / 4';
                const nc = x.na ? 'N/A' : (x.nota_ciclo != null ? `${x.nota_ciclo} / 4` : '__ / 4');
                const ev = x.na ? `N/A — ${x.justificativa_na || ''}` : nz(x.evidencias, '');
                return { cels: [T.PILARES_ROTULO[p], ni, nc, ev] };
            }),
        });
        B.push({ t: 'p', rotulo: 'Escala técnica', texto: T.ESCALA_TECNICA.map(e => `${e.nivel} — ${e.titulo}`).join('; ') + '.' });
        B.push({ t: 'p', rotulo: 'Critérios comportamentais', texto: T.ESCALA_COMPORTAMENTAL.map(e => `${e.nivel} — ${e.titulo}`).join('; ') + '.' });
        B.push({ t: 'p', rotulo: 'Performance', texto: T.ESCALA_PERFORMANCE.map(e => `${e.nivel} — ${e.titulo}`).join('; ') + '.' });
        B.push({ t: 'p', rotulo: 'Melhorias', texto: T.ESCALA_MELHORIAS.map(e => `${e.nivel} — ${e.titulo}`).join('; ') + '.' });
        B.push({ t: 'p', texto: T.TEXTOS.fichaNaRegra });
        B.push({ t: 'p', rotulo: 'Principais avanços do período', texto: nz(f.avancos, '') });
        B.push({ t: 'p', rotulo: 'Pontos que permanecem em desenvolvimento', texto: nz(f.pontos_desenvolvimento, '') });
        B.push({ t: 'p', rotulo: 'Prioridades para o próximo ciclo', texto: nz(f.prioridades_proximo_ciclo, '') });
        B.push({ t: 'p', rotulo: 'Considerações da colaboradora', texto: nz(f.consideracoes_colaborador, '') });
        const marca = (ok) => (ok ? '[x]' : '[ ]');
        B.push({ t: 'p', rotulo: 'Resultado do ciclo', texto: Object.keys(T.RESULTADOS).map(k => `${marca(f.resultado === k)} ${T.RESULTADOS[k]}`).join('   ') });
        B.push({ t: 'p', rotulo: 'Direcionamento', texto: Object.keys(T.DIRECIONAMENTOS).map(k => `${marca((f.direcionamentos || []).includes(k))} ${T.DIRECIONAMENTOS[k]}`).join('   ') });
        return B;
    }

    return { montar, valorIndicador, fmtData, fmtPct, blocosFicha };
});
