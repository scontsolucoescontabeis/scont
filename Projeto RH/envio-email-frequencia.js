// Resolução de destinatários de e-mail (Benefícios / Folha de Ponto) — módulo puro,
// sem dependência de DOM/Supabase, para poder ser testado isoladamente (ver
// test-envio-email-frequencia.js). Consumido por script.js.

function _dividirEmails(texto) {
    if (!texto) return [];
    const vistos = new Set();
    const resultado = [];
    String(texto).split(',').forEach(parte => {
        const email = parte.trim();
        if (email && !vistos.has(email)) {
            vistos.add(email);
            resultado.push(email);
        }
    });
    return resultado;
}

// itensPorEmpresa: [{ codigoEmpresa, nomeEmpresa, arquivos: [{nome, blob}] }]
// gruposMarcadosIds: string[] (grupos marcados no seletor da tela quando os PDFs foram gerados)
// gruposInfo: [{ id, nome_grupo, email_responsavel }]
// itensGruposCache: { [grupoId]: Set(codigoEmpresa) }
// emailPorEmpresa: { [codigoEmpresa]: email_responsavel }
function _resolverDestinatariosEnvio({ itensPorEmpresa, gruposMarcadosIds, gruposInfo, itensGruposCache, emailPorEmpresa }) {
    const gruposPorId = new Map((gruposInfo || []).map(g => [g.id, g]));
    const baldes = new Map(); // email -> destinatário
    const semEmail = [];

    (itensPorEmpresa || []).forEach(item => {
        const grupoOrigemId = (gruposMarcadosIds || []).find(
            gid => (itensGruposCache[gid] || new Set()).has(item.codigoEmpresa)
        );
        const grupo = grupoOrigemId ? gruposPorId.get(grupoOrigemId) : null;
        const emailsGrupo = grupo ? _dividirEmails(grupo.email_responsavel) : [];
        const emails = emailsGrupo.length > 0 ? emailsGrupo : _dividirEmails((emailPorEmpresa || {})[item.codigoEmpresa]);

        if (emails.length === 0) {
            semEmail.push(item.nomeEmpresa);
            return;
        }

        const origem = emailsGrupo.length > 0 ? 'grupo' : 'empresa';
        const nomeOrigem = emailsGrupo.length > 0 ? grupo.nome_grupo : item.nomeEmpresa;

        emails.forEach(email => {
            if (!baldes.has(email)) baldes.set(email, { email, origem, nomeOrigem, empresas: [], arquivos: [] });
            const balde = baldes.get(email);
            if (!balde.empresas.includes(item.nomeEmpresa)) balde.empresas.push(item.nomeEmpresa);
            balde.arquivos.push(...item.arquivos);
        });
    });

    // Para e-mail de responsável compartilhado por várias empresas (origem 'empresa'),
    // o assunto/corpo deve contemplar o nome de todas elas, não só o da primeira.
    // Baldes de grupo mantêm o nome do grupo.
    baldes.forEach(balde => {
        if (balde.origem === 'empresa') balde.nomeOrigem = balde.empresas.join(', ');
    });

    return { destinatarios: Array.from(baldes.values()), semEmail };
}

// Converte um Blob em base64 — usa Buffer quando disponível (Node), senão btoa (browser).
// Não é coberto pelos testes de node (depende de Blob real), validado manualmente na task de UI.
async function _blobParaBase64(blob) {
    const buffer = await blob.arrayBuffer();
    if (typeof Buffer !== 'undefined') return Buffer.from(buffer).toString('base64');
    let binary = '';
    const bytes = new Uint8Array(buffer);
    const chunk = 0x8000;
    for (let i = 0; i < bytes.length; i += chunk) {
        binary += String.fromCharCode.apply(null, bytes.subarray(i, i + chunk));
    }
    return btoa(binary);
}

if (typeof module !== 'undefined' && module.exports) {
    module.exports = { _dividirEmails, _resolverDestinatariosEnvio, _blobParaBase64 };
}
