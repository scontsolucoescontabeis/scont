// Projeto PDI/js/tela-admin.js — Administração: PDIs, vínculos de usuários, modelos e sócios
window.PdiAdmin = (function () {
    'use strict';
    const U = window.PdiUI, e = U.esc, Doc = window.PdiDocumento, Api = window.PdiApi;
    const fd = Doc.fmtData;

    async function render(host, ctx) {
        host.innerHTML = '<p class="muted">Carregando administração…</p>';
        const [pdis, modelos, usuarios, socios] = await Promise.all([Api.listarPdis(), Api.modelos(), Api.usuarios(), Api.socios()]);
        let rhSocios = [];
        try { rhSocios = await Api.rhSocios(); } catch (_) { /* tabela/empresa ausente: cai no fallback manual */ }
        const renovados = new Set(pdis.map(p => p.pdi_anterior_id).filter(Boolean));
        const nomeUsr = (id) => { const u = usuarios.find(x => x.id === id); return u ? (u.nome || u.email) : null; };

        host.innerHTML = `<h1>Administração do PDI</h1>
          <section class="cartao"><header class="cartao-topo"><h2>PDIs</h2>
            <button class="btn" data-a="novo-pdi">Novo PDI</button></header>
            <div class="tabela-wrap"><table class="doc-tab"><thead><tr><th>Colaborador</th><th>Cargo</th><th>Usuário do colaborador</th>
              <th>Gestor (usuário)</th><th>Início</th><th>Status</th><th></th></tr></thead><tbody>
              ${pdis.map(p => `<tr><td>${e(p.colaborador_nome)}</td><td>${e(p.cargo_setor)}</td>
                <td>${p.colaborador_user_id ? e(nomeUsr(p.colaborador_user_id) || p.colaborador_user_id) : '<span class="aviso">não vinculado</span>'}</td>
                <td>${e(p.gestor_nome || '—')}${p.gestor_user_id ? ` (${e(nomeUsr(p.gestor_user_id) || '')})` : ' <span class="aviso">sem usuário</span>'}</td>
                <td>${fd(p.data_inicio)}</td><td>${e(p.status)}</td>
                <td><button class="btn peq sec" data-a="vincular" data-id="${p.id}">Vincular usuários</button>
                    <button class="btn peq sec" data-a="status" data-id="${p.id}">Status</button>
                    ${renovados.has(p.id) ? '' : `<button class="btn peq sec" data-a="renovar" data-id="${p.id}">Renovar</button>`}
                    <button class="btn peq danger" data-a="excluir" data-id="${p.id}">Excluir</button>
                    <button class="btn peq" data-a="abrir" data-id="${p.id}">Abrir</button></td></tr>`).join('')
                || '<tr><td colspan="7" class="muted">Nenhum PDI cadastrado.</td></tr>'}
            </tbody></table></div></section>

          <section class="cartao"><header class="cartao-topo"><h2>Sócios com acesso à avaliação</h2>
            <button class="btn" data-a="novo-socio">Vincular sócio</button></header>
            <p class="muted">Sócios veem e avaliam todos os PDIs. O poder só vale para usuários vinculados aqui.
              ${rhSocios.length ? '' : ' (Não há sócios da empresa 48 em rh_socios; informe o nome manualmente.)'}</p>
            <div class="tabela-wrap"><table class="doc-tab"><thead><tr><th>Sócio</th><th>Usuário do portal</th><th></th></tr></thead><tbody>
              ${socios.map(s => `<tr><td>${e(s.nome)}</td><td>${e(nomeUsr(s.usuario_id) || s.usuario_id)}</td>
                <td><button class="btn peq sec" data-a="remover-socio" data-id="${s.id}">Remover</button></td></tr>`).join('')
                || '<tr><td colspan="3" class="muted">Nenhum sócio vinculado.</td></tr>'}
            </tbody></table></div></section>

          <section class="cartao"><header class="cartao-topo"><h2>Modelos de PDI</h2></header>
            <div class="tabela-wrap"><table class="doc-tab"><thead><tr><th>Cargo / função</th><th>Versão</th><th>Ativo</th><th></th></tr></thead><tbody>
              ${modelos.map(m => `<tr><td>${e(m.cargo_setor)}</td><td>${m.versao}</td><td>${m.ativo ? 'Sim' : 'Não'}</td>
                <td><button class="btn peq sec" data-a="editar-modelo" data-id="${m.id}">Editar conteúdo (JSON)</button></td></tr>`).join('')
                || '<tr><td colspan="4" class="muted">Nenhum modelo. Execute _sql/seed_pdi.sql.</td></tr>'}
            </tbody></table></div>
            <p class="muted">Alterar um modelo não afeta PDIs já criados: cada PDI guarda uma cópia do conteúdo.</p></section>`;

        const opUsr = usuarios.map(u => [u.id, `${u.nome || u.email} (${u.email})`]);
        const H = {
            abrir: (id) => ctx.abrirPdi(id),
            'novo-pdi': async () => {
                const r = await U.formulario('Novo PDI', [
                    { nome: 'modelo_id', rotulo: 'Modelo', tipo: 'select', vazio: false, obrigatorio: true, opcoes: modelos.filter(m => m.ativo).map(m => [m.id, m.cargo_setor]) },
                    { nome: 'colaborador_user_id', rotulo: 'Usuário do colaborador', tipo: 'select', opcoes: opUsr },
                    { nome: 'colaborador_nome', rotulo: 'Nome do colaborador', obrigatorio: true },
                    { nome: 'cargo_setor', rotulo: 'Cargo e setor (vazio = do modelo)' },
                    { nome: 'admissao', rotulo: 'Admissão', tipo: 'date' },
                    { nome: 'gestor_user_id', rotulo: 'Usuário do gestor', tipo: 'select', opcoes: opUsr },
                    { nome: 'gestor_nome', rotulo: 'Nome do gestor' },
                    { nome: 'data_inicio', rotulo: 'Início do PDI (D)', tipo: 'date', obrigatorio: true },
                ]);
                if (!r) return;
                if (!r.gestor_nome && r.gestor_user_id) r.gestor_nome = nomeUsr(r.gestor_user_id);
                await executar(() => Api.criarPdi(r), 'PDI criado.');
            },
            vincular: async (id) => {
                const p = pdis.find(x => x.id === id);
                const r = await U.formulario('Vincular usuários', [
                    { nome: 'colaborador_user_id', rotulo: 'Usuário do colaborador', tipo: 'select', opcoes: opUsr, valor: p.colaborador_user_id },
                    { nome: 'gestor_user_id', rotulo: 'Usuário do gestor', tipo: 'select', opcoes: opUsr, valor: p.gestor_user_id },
                ]);
                if (r) await executar(() => Api.atualizarSemEco('pdis', id, r), 'Vínculos salvos.');
            },
            status: async (id) => {
                const p = pdis.find(x => x.id === id);
                const r = await U.formulario('Status do PDI', [
                    { nome: 'status', rotulo: 'Status', tipo: 'select', vazio: false, valor: p.status, opcoes: [['rascunho', 'Rascunho'], ['ativo', 'Ativo'], ['encerrado', 'Encerrado']] }]);
                if (r) await executar(() => Api.atualizarSemEco('pdis', id, r), 'Status atualizado.');
            },
            renovar: async (id) => {
                const p = pdis.find(x => x.id === id);
                const sugerida = window.PdiCalculo.fimPdi(p.data_inicio, p.meses_acompanhamento);
                const r = await U.formulario(`Renovar PDI — ${p.colaborador_nome}`, [
                    { nome: 'data_inicio', rotulo: 'Início do novo PDI (D)', tipo: 'date', valor: sugerida, obrigatorio: true,
                        dica: 'Sugestão: o dia em que o PDI atual completa o período de acompanhamento.' },
                ], {
                    texto: 'Cria o PDI do próximo período com o mesmo modelo, colaborador e gestor, ligado a este. Copia o contexto e o perfil; as prioridades da última ficha concluída viram ações do ciclo 1; e a primeira ficha já abre com as notas finais deste PDI como notas iniciais.',
                    confirmar: 'Criar PDI renovado',
                });
                if (!r) return;
                await executar(() => Api.renovarPdi(id, r.data_inicio), 'PDI renovado.');
            },
            excluir: async (id) => {
                const p = pdis.find(x => x.id === id);
                const r = await U.formulario(`Excluir PDI — ${p.colaborador_nome}`, [
                    { nome: 'confirmacao', rotulo: `Para confirmar, digite o nome do colaborador: ${p.colaborador_nome}`, obrigatorio: true },
                ], {
                    texto: 'Esta ação apaga o PDI e tudo que depende dele: níveis, avaliações, fichas trimestrais, feedbacks, ciências e relatórios anexados. Não pode ser desfeita. O registro da exclusão fica na auditoria.',
                    confirmar: 'Excluir definitivamente',
                });
                if (!r) return;
                if ((r.confirmacao || '').trim().toLowerCase() !== (p.colaborador_nome || '').trim().toLowerCase()) {
                    U.toast('O nome digitado não confere. Nada foi excluído.', 'erro');
                    return;
                }
                await executar(() => Api.excluirPdi(id), 'PDI excluído.');
            },
            'novo-socio': async () => {
                const campos = [{ nome: 'usuario_id', rotulo: 'Usuário do portal', tipo: 'select', obrigatorio: true, opcoes: opUsr }];
                if (rhSocios.length) campos.unshift({ nome: 'rh_socio_id', rotulo: 'Sócio (cadastro da Scont — empresa 48)', tipo: 'select', obrigatorio: true, opcoes: rhSocios.map(s => [s.id, s.nome_socio]) });
                else campos.unshift({ nome: 'nome', rotulo: 'Nome do sócio', obrigatorio: true });
                const r = await U.formulario('Vincular sócio', campos);
                if (!r) return;
                const nome = r.nome || (rhSocios.find(s => s.id === r.rh_socio_id) || {}).nome_socio;
                await executar(() => Api.ins('pdi_socios', { usuario_id: r.usuario_id, rh_socio_id: r.rh_socio_id || null, nome }), 'Sócio vinculado.');
            },
            'remover-socio': async (id) => {
                if (await U.confirmar('Remover sócio', 'O usuário perde o acesso de sócio ao PDI.', 'Remover')) await executar(() => Api.del('pdi_socios', id), 'Removido.');
            },
            'editar-modelo': async (id) => {
                const m = modelos.find(x => x.id === id);
                const r = await U.formulario(`Modelo — ${m.cargo_setor}`, [
                    { nome: 'cargo_setor', rotulo: 'Cargo / função', obrigatorio: true, valor: m.cargo_setor },
                    { nome: 'ativo', rotulo: 'Ativo', tipo: 'checkbox', valor: m.ativo },
                    { nome: 'conteudo', rotulo: 'Conteúdo (JSON)', tipo: 'textarea', linhas: 14, valor: JSON.stringify(m.conteudo, null, 2) },
                ]);
                if (!r) return;
                let conteudo;
                try { conteudo = JSON.parse(r.conteudo); } catch (_) { U.toast('JSON inválido.', 'erro'); return; }
                await executar(() => Api.atualizarSemEco('pdi_modelos', id, { cargo_setor: r.cargo_setor, ativo: r.ativo, conteudo, versao: m.versao + 1 }), 'Modelo salvo (nova versão).');
            },
        };

        async function executar(fn, ok) {
            try { await fn(); U.toast(ok, 'ok'); await render(host, ctx); }
            catch (err) { U.toast(err.message, 'erro'); }
        }
        host.querySelectorAll('[data-a]').forEach(b => b.onclick = () => H[b.dataset.a] && H[b.dataset.a](b.dataset.id));
    }

    return { render };
})();
