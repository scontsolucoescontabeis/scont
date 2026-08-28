// ============================================================
// contabil-grupos.js — camada compartilhada de "Grupos de Empresas"
// para o módulo Departamento Contábil.
//
// Os grupos ficam nas MESMAS tabelas usadas pelo Controle de
// Frequência do Projeto RH (rh_grupos_empresas / rh_grupos_empresas_itens),
// no mesmo projeto Supabase. Criar/editar aqui reflete lá e vice-versa.
//
// contabil_grupos_config guarda, por grupo, se ele é usado como filtro
// nas ferramentas do Departamento Contábil (opt-in: sem linha = false).
// ============================================================

(function (root) {
  'use strict';

  // ─── Helpers puros (testáveis em Node) ───────────────────────

  // Junta as linhas cruas das 3 tabelas numa estrutura pronta para a UI:
  // [{ id, nome_grupo, observacoes, email_responsavel, empresas:Set<codigo>, usarContabil }]
  // ordenada por nome_grupo (locale pt-BR).
  function montarGrupos(gruposRows, itensRows, configRows) {
    const itensPorGrupo = {};
    (itensRows || []).forEach((it) => {
      (itensPorGrupo[it.grupo_id] = itensPorGrupo[it.grupo_id] || new Set()).add(it.codigo_empresa);
    });
    const usarPorGrupo = {};
    (configRows || []).forEach((c) => { usarPorGrupo[c.grupo_id] = c.usar_contabil === true; });

    return (gruposRows || [])
      .map((g) => ({
        id: g.id,
        nome_grupo: g.nome_grupo,
        observacoes: g.observacoes || '',
        email_responsavel: g.email_responsavel || '',
        empresas: itensPorGrupo[g.id] || new Set(),
        usarContabil: usarPorGrupo[g.id] === true,
      }))
      .sort((a, b) => a.nome_grupo.localeCompare(b.nome_grupo, 'pt-BR'));
  }

  // Interseção de uma lista com o conjunto de códigos de um grupo.
  // codigosSet falsy (nenhum grupo escolhido) => devolve a lista original
  // (mesma referência, sem custo).
  function filtrarPorGrupo(lista, codigosSet, getCodigo) {
    if (!codigosSet) return lista;
    return (lista || []).filter((item) => codigosSet.has(getCodigo(item)));
  }

  // ─── "Unidade contábil" (empresa avulsa OU grupo como um só) ─────
  // No módulo Departamento Contábil, um grupo marcado "usar no contábil"
  // deixa de ser filtro e vira uma UNIDADE: uma linha só, um Mapeamento,
  // uma grade, um encerramento. A chave da unidade-grupo é 'grupo-<uuid>',
  // guardada na coluna codigo_empresa (TEXT, sem FK) das tabelas do módulo.

  const PREFIXO_GRUPO = 'grupo-';

  function ehChaveGrupo(codigo) {
    return typeof codigo === 'string' && codigo.startsWith(PREFIXO_GRUPO);
  }

  function idDoGrupoNaChave(codigo) {
    return ehChaveGrupo(codigo) ? codigo.slice(PREFIXO_GRUPO.length) : null;
  }

  function chaveDoGrupo(id) {
    return PREFIXO_GRUPO + id;
  }

  // empresasComContabil: lista já filtrada (ativas + possui_contabil) —
  //   as empresas membro de um grupo contábil são REMOVIDAS daqui.
  // todasAtivas: todas as empresas ativas (para resolver o nome de membros
  //   que não têm possui_contabil mas entram no grupo mesmo assim).
  // gruposContabil: [{ id, nome_grupo, empresas: Set|Array<codigo> }] —
  //   só os grupos marcados para uso no contábil.
  function montarUnidades(empresasComContabil, todasAtivas, gruposContabil) {
    const grupos = gruposContabil || [];
    const ativas = todasAtivas || empresasComContabil || [];
    const nomePorCodigo = {};
    ativas.forEach((e) => { nomePorCodigo[e.codigo_empresa] = e.nome_empresa; });
    const ativasSet = new Set(ativas.map((e) => e.codigo_empresa));

    const membrosDeGrupo = new Set();
    grupos.forEach((g) => {
      (g.empresas instanceof Set ? Array.from(g.empresas) : (g.empresas || []))
        .forEach((codigo) => membrosDeGrupo.add(codigo));
    });

    const avulsas = (empresasComContabil || []).filter((e) => !membrosDeGrupo.has(e.codigo_empresa));

    const unidadesGrupo = grupos.map((g) => {
      const codigos = (g.empresas instanceof Set ? Array.from(g.empresas) : (g.empresas || []))
        .filter((codigo) => ativasSet.has(codigo));
      return {
        codigo_empresa: chaveDoGrupo(g.id),
        nome_empresa: g.nome_grupo,
        status_situacao: 'ativa',
        is_grupo: true,
        grupo_id: g.id,
        membros_codigos: codigos,
        membros_nomes: codigos.map((c) => nomePorCodigo[c] || c).join(', '),
      };
    });

    return [...avulsas, ...unidadesGrupo]
      .sort((a, b) => String(a.nome_empresa).localeCompare(String(b.nome_empresa), 'pt-BR'));
  }

  // Expande um Set de codigo_empresa (de contabil_empresas_responsaveis) para
  // que, se o usuário for responsável por qualquer membro OU pela própria
  // chave de um grupo contábil, ele passe a "cobrir" a chave 'grupo-<id>' E
  // todos os códigos membro. Assim podeEncerrar / escopo de Validações /
  // Histórico funcionam tanto para as linhas novas (chave do grupo) quanto
  // para as antigas (por empresa).
  function expandirResponsaveis(set, unidadesGrupo) {
    const resultado = new Set(set);
    (unidadesGrupo || []).forEach((u) => {
      if (!u.is_grupo) return;
      const cobre = resultado.has(u.codigo_empresa)
        || (u.membros_codigos || []).some((c) => resultado.has(c));
      if (cobre) {
        resultado.add(u.codigo_empresa);
        (u.membros_codigos || []).forEach((c) => resultado.add(c));
      }
    });
    return resultado;
  }

  if (typeof module !== 'undefined' && module.exports) {
    module.exports = { montarGrupos, filtrarPorGrupo, montarUnidades, expandirResponsaveis, ehChaveGrupo, idDoGrupoNaChave, chaveDoGrupo };
    return;
  }

  // ─── Camada browser: window.ContabilGrupos ───────────────────

  let _client = null;
  let _grupos = [];      // saída de montarGrupos
  let _carregado = false;

  async function carregar(supabaseClient) {
    _client = supabaseClient || _client;
    const [
      { data: gruposRows, error: errG },
      { data: itensRows, error: errI },
      { data: configRows, error: errC },
    ] = await Promise.all([
      _client.from('rh_grupos_empresas').select('id, nome_grupo, observacoes, email_responsavel'),
      _client.from('rh_grupos_empresas_itens').select('grupo_id, codigo_empresa'),
      _client.from('contabil_grupos_config').select('grupo_id, usar_contabil'),
    ]);
    if (errG) console.error('ContabilGrupos: erro ao carregar grupos', errG);
    if (errI) console.error('ContabilGrupos: erro ao carregar itens de grupos', errI);
    if (errC) console.error('ContabilGrupos: erro ao carregar contabil_grupos_config', errC);

    _grupos = montarGrupos(gruposRows, itensRows, configRows);
    _carregado = true;
    return _grupos;
  }

  function todos() {
    return _grupos.slice();
  }

  function contabil() {
    return _grupos.filter((g) => g.usarContabil);
  }

  function porId(id) {
    return _grupos.find((g) => g.id === id) || null;
  }

  function codigosDoGrupo(id) {
    const g = porId(id);
    return g ? g.empresas : new Set();
  }

  // Wrapper de conveniência: resolve o Set do grupo e delega ao helper puro.
  function filtrarLista(lista, grupoId, getCodigo) {
    if (!grupoId) return lista;
    return filtrarPorGrupo(lista, codigosDoGrupo(grupoId), getCodigo);
  }

  // <option>s prontos para um <select> de filtro (só grupos marcados p/ contábil).
  function opcoesSelectContabil(selecionadoId) {
    const esc = (s) => String(s == null ? '' : s).replace(/[&<>"]/g, (c) => (
      { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]
    ));
    const opts = ['<option value="">(todos os grupos)</option>'];
    contabil().forEach((g) => {
      opts.push(`<option value="${esc(g.id)}" ${selecionadoId === g.id ? 'selected' : ''}>${esc(g.nome_grupo)}</option>`);
    });
    return opts.join('');
  }

  // ─── CRUD (espelha o comportamento do Projeto RH/script.js) ───

  async function salvarGrupo({ id, nome_grupo, observacoes, email_responsavel, empresas }) {
    const nome = (nome_grupo || '').trim();
    const payload = {
      nome_grupo: nome,
      observacoes: (observacoes || '').trim(),
      email_responsavel: (email_responsavel || '').trim(),
    };
    let grupoId = id || null;

    if (grupoId) {
      const { error } = await _client.from('rh_grupos_empresas').update(payload).eq('id', grupoId);
      if (error) return { id: grupoId, error };
    } else {
      const { data, error } = await _client.from('rh_grupos_empresas').insert(payload).select('id').single();
      if (error) return { id: null, error };
      grupoId = data.id;
    }

    const { error: errDel } = await _client.from('rh_grupos_empresas_itens').delete().eq('grupo_id', grupoId);
    if (errDel) return { id: grupoId, error: errDel };

    const codigos = Array.from(new Set(empresas || []));
    if (codigos.length) {
      const { error: errIns } = await _client.from('rh_grupos_empresas_itens')
        .insert(codigos.map((codigo_empresa) => ({ grupo_id: grupoId, codigo_empresa })));
      if (errIns) return { id: grupoId, error: errIns };
    }

    await carregar();
    return { id: grupoId, error: null };
  }

  async function excluirGrupo(id) {
    if (!id) return { error: null };
    const { error } = await _client.from('rh_grupos_empresas').delete().eq('id', id);
    if (!error) await carregar();
    return { error };
  }

  async function definirUsarContabil(grupoId, valor) {
    const { error } = await _client
      .from('contabil_grupos_config')
      .upsert({ grupo_id: grupoId, usar_contabil: !!valor, updated_at: new Date().toISOString() }, { onConflict: 'grupo_id' });
    if (!error) {
      const g = porId(grupoId);
      if (g) g.usarContabil = !!valor;
    }
    return { error };
  }

  // Wrapper browser: monta a lista de unidades (empresas avulsas + grupos
  // contábil) a partir do cache já carregado.
  function montarUnidadesBrowser(empresasComContabil, todasAtivas) {
    return montarUnidades(empresasComContabil, todasAtivas, contabil());
  }

  // Chaves de grupo (grupo-<id>) que já existem entre outros grupos contábil
  // compartilhando alguma empresa com a lista de códigos dada — usado para
  // impedir que a mesma empresa entre em dois grupos contábil.
  function gruposContabilComConflito(codigos, ignorarGrupoId) {
    const alvo = new Set(codigos || []);
    return contabil()
      .filter((g) => g.id !== ignorarGrupoId)
      .filter((g) => Array.from(g.empresas).some((c) => alvo.has(c)));
  }

  // Como expandirResponsaveis, mas montando as "unidades de grupo" a partir
  // do cache contabil() — para chamadores que ainda não têm a lista de
  // unidades pronta (ex.: checagem de escopo antes de carregarDados).
  function expandirResponsaveisComGrupos(set) {
    const unidades = contabil().map((g) => ({
      is_grupo: true,
      codigo_empresa: chaveDoGrupo(g.id),
      membros_codigos: Array.from(g.empresas),
    }));
    return expandirResponsaveis(set, unidades);
  }

  // E-mail(is) do responsável de um grupo, a partir da chave grupo-<id>.
  function emailResponsavelPorChave(chave) {
    const g = porId(idDoGrupoNaChave(chave));
    return (g && g.email_responsavel) || '';
  }

  root.ContabilGrupos = {
    carregar,
    estaCarregado: () => _carregado,
    todos,
    contabil,
    porId,
    codigosDoGrupo,
    filtrarPorGrupo,   // helper puro (lista, Set, getCodigo)
    filtrarLista,      // wrapper (lista, grupoId, getCodigo)
    opcoesSelectContabil,
    salvarGrupo,
    excluirGrupo,
    definirUsarContabil,
    montarUnidades: montarUnidadesBrowser,
    expandirResponsaveis,
    expandirResponsaveisComGrupos,
    ehChaveGrupo,
    idDoGrupoNaChave,
    chaveDoGrupo,
    gruposContabilComConflito,
    emailResponsavelPorChave,
  };
})(typeof window !== 'undefined' ? window : this);
