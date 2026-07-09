-- ============================================================
-- GERADOR DE MODELOS — Reescreve os 9 modelos de Admissão para
-- aproximar ao máximo do conteúdo/formatação dos arquivos originais
-- em "MODELO ADMISSÃO/" (negrito em nomes/empresa, caixas com borda
-- nos documentos que tinham moldura no original, assinatura de
-- Responsável Legal, tabela "Meio de Transporte", tabela de horário
-- completa no Acordo de Compensação, "Polegar direito" no Termo de
-- Responsabilidade, tabela de dependentes no Plano de Saúde).
-- Execute no SQL Editor do Supabase (em bancos que já rodaram
-- schema-gerador-modelos-seed-admissao.sql)
-- ============================================================

UPDATE public.gm_modelos SET template = $doc$<p style="text-align:center"><strong>TERMO DE CONFIABILIDADE</strong></p>
<p>Pelo presente termo de confiabilidade, eu <strong>{{empregado.nome_empregado}}</strong>, portador do CPF {{empregado.cpf}}, funcionário da empresa <strong>{{empresa.nome_empresa}}</strong>, comprometo-me a guardar segredo das informações sigilosas obtidas nesta empresa, entendendo-se como tais as de caráter técnico, funcional ou pessoal, que porventura possam instigar ou interessar à concorrência, relacionadas ou não com o exercício de minha função.</p>
<p>Declaro, ainda, que estou ciente de que qualquer prejuízo causado à empresa, perpetrado pela quebra do sigilo acima declinado, gerará o pagamento de multa no valor de 20 (vinte) salários-mínimos atuais, além das implicações nas esferas cível, criminal e administrativa.</p>
<p>Por derradeiro, declaro que li e compreendi os termos aqui dispostos, assinando-o voluntariamente.</p>
<p style="text-align:right">{{empresa.cidade}}, {{sistema.data_atual}}.</p>
<div style="margin-top:26px;"></div>
<table style="width:100%"><tr>
<td style="text-align:center">_____________________________<br>(<strong>{{empresa.nome_empresa}}</strong>)</td>
<td style="text-align:center">_____________________________<br>(<strong>{{empregado.nome_empregado}}</strong>)</td>
</tr></table>$doc$ WHERE nome = 'Termo de Confiabilidade';

UPDATE public.gm_modelos SET template = $doc$<p style="text-align:center"><strong>TERMO DE CONSENTIMENTO PARA TRATAMENTO DE DADOS PESSOAIS</strong></p>
<p>Este documento visa registrar a manifestação livre, informada e inequívoca pela qual o Titular concorda com o tratamento de seus dados pessoais para finalidade específica, em conformidade com a Lei nº 13.709 – Lei Geral de Proteção de Dados Pessoais (LGPD).</p>
<p><strong>Titular:</strong> Pessoa a quem se referem os dados pessoais que são objeto de tratamento.<br>
<strong>Nome:</strong> <strong>{{empregado.nome_empregado}}</strong><br>
<strong>CPF:</strong> <strong>{{empregado.cpf}}</strong></p>
<p>Ao assinar o presente termo, o Titular consente e concorda que a empresa <strong>{{empresa.nome_empresa}}</strong>, C.N.P.J: <strong>{{empresa.cnpj}}</strong>, com sede na <strong>{{empresa.endereco}}, {{empresa.cidade}}</strong>, CEP: <strong>{{empresa.cep}}</strong>, telefone _____________________, e-mail _____________________, doravante denominada Controlador, tome decisões referentes ao tratamento de seus dados pessoais, bem como realize o tratamento de seus dados pessoais, envolvendo operações como as que se referem a coleta, produção, recepção, classificação, utilização, acesso, reprodução, transmissão, distribuição, processamento, arquivamento, armazenamento, eliminação, avaliação ou controle da informação, modificação, comunicação, transferência, difusão ou extração.</p>
<p><strong>Dados Pessoais</strong></p>
<p>O Controlador fica autorizado a tomar decisões referentes ao tratamento e a realizar o tratamento dos seguintes dados pessoais do Titular:</p>
<ul>
<li>Nome completo.</li>
<li>Data de nascimento.</li>
<li>Número e imagem da Carteira de Identidade (RG).</li>
<li>Número e imagem do Cadastro de Pessoas Físicas (CPF).</li>
<li>Número e imagem da Carteira Nacional de Habilitação (CNH).</li>
<li>Fotografia 3x4.</li>
<li>Estado civil.</li>
<li>Nível de instrução ou escolaridade.</li>
<li>Endereço completo.</li>
<li>Números de telefone, aplicativos de comunicação como WhatsApp, Telegram e similares e endereços de e-mail.</li>
<li>Banco, agência e número de contas bancárias.</li>
<li>Comunicação, verbal e escrita, mantida entre o Titular e o Controlador.</li>
</ul>
<p><strong>Finalidades do Tratamento dos Dados</strong></p>
<p>O tratamento dos dados pessoais listados neste termo tem as seguintes finalidades:</p>
<ul>
<li>Possibilitar que o Controlador identifique e entre em contato com o Titular para fins de relacionamento contratual.</li>
<li>Possibilitar que o Controlador cumpra com as obrigações trabalhistas e previdenciárias.</li>
<li>Possibilitar que o Controlador envie ou forneça Informações Pessoais e de seus dependentes para viabilizar implantação de benefícios, junto a novos fornecedores, caso seja necessário.</li>
</ul>
<p><strong>Confidencialidade</strong></p>
<p>Estou ciente do compromisso assumido pelo controlador de tratar os meus Dados Pessoais de forma sigilosa e confidencial, mantendo-os em ambiente seguro e não sendo utilizados para qualquer fim que não os descritos acima.</p>
<p><strong>Revogação</strong></p>
<p>Estou ciente que, a qualquer tempo, posso retirar o consentimento ora fornecido, hipótese em que as atividades desenvolvidas pelo controlador, no âmbito de nossa relação, poderão ser prejudicadas.</p>
<p>Declaro e concordo que os meus Dados Pessoais poderão ser armazenados, mesmo após o término do tratamento — inclusive após a revogação do consentimento, para cumprimento de obrigação legal ou regulatória pelo controlador ou desde que tornados anônimos.</p>
<p><strong>Canal de Comunicação</strong></p>
<p>Manifesto-me de forma informada, livre, expressa e consciente, no sentido de autorizar o controlador a realizar contato comigo através dos seguintes canais: e-mail, ligação, SMS ou App de comunicação.</p>
<p style="text-align:right">{{empresa.cidade}}, {{sistema.data_atual}}.</p>
<div style="margin-top:26px;"></div>
<p style="text-align:center"><strong>{{empregado.nome_empregado}}</strong></p>$doc$ WHERE nome = 'Termo de Consentimento LGPD';

UPDATE public.gm_modelos SET template = $doc$<p style="text-align:center"><strong>TERMO DE AUTORIZAÇÃO DE USO DE IMAGEM</strong></p>
<p>Pelo presente instrumento, eu <strong>{{empregado.nome_empregado}}</strong>, inscrito(a) no CPF/MF sob o nº {{empregado.cpf}}, autorizo, a título gratuito e a qualquer tempo, a captação e utilização de minha imagem em divulgação dos serviços pela empresa <strong>{{empresa.nome_empresa}}</strong>, inscrita no CNPJ/MF sob o nº {{empresa.cnpj}}. Declaro, em caráter irrevogável e irretratável, estar ciente e de acordo com o uso institucional e comercial do material captado. E, por ser a expressão da verdade, firmo o presente <strong>TERMO DE AUTORIZAÇÃO DE USO DE IMAGEM</strong>.</p>
<p style="text-align:right">{{empresa.cidade}}, {{sistema.data_atual_extenso}}.</p>
<div style="margin-top:26px;"></div>
<p style="text-align:center">____________________________________<br><strong>{{empregado.nome_empregado}}</strong><br><strong>CPF: {{empregado.cpf}}</strong></p>$doc$ WHERE nome = 'Termo de Autorização de Uso de Imagem';

UPDATE public.gm_modelos SET template = $doc$<div style="border:1px solid #2C3E50;padding:12px 16px;">
<p>À<br>
Empresa: <strong>{{empresa.nome_empresa}}</strong><br>
Endereço: {{empresa.endereco}} — {{empresa.cidade}} — CEP: {{empresa.cep}}</p>
<p>Empregado: <strong>{{empregado.nome_empregado}}</strong> — CPF: {{empregado.cpf}}<br>
Função: {{empregado.desc_funcao}} — CTPS: {{empregado.ctps}} - {{empregado.serie_ctps}}</p>
<p>( &nbsp;) Opto pela Utilização do Vale-Transporte &nbsp;&nbsp;&nbsp; ( &nbsp;) Não Opto pela Utilização do Vale-Transporte</p>
<p>Nos termos da legislação vigente, solicito receber o Vale-Transporte e comprometo-me:</p>
<p>a) A utilizá-lo exclusivamente para meu efetivo deslocamento residência-trabalho e vice-versa;</p>
<p>b) A renovar anualmente ou sempre que ocorrer alteração no meu endereço residencial ou dos serviços e meios de transportes mais adequados ao meu deslocamento residência-trabalho e vice-versa;</p>
<p>c) Autorizo a descontar até 6% (seis por cento) do meu salário-básico mensal para ocorrer o custeio do Vale-Transporte;</p>
<p>d) Declaro estar ciente de que a declaração falsa ou o uso indevido do Vale-Transporte constituem falta grave.</p>
<p>Minha residência atual:<br>
Endereço: _____________________________ Nº: _____<br>
Compl.: _____________________ Bairro: _____________________<br>
Cidade: _____________________ UF: _____ CEP: _____________</p>
<p><strong>Meio de Transporte</strong></p>
<table style="width:100%;border-collapse:collapse;font-size:11px" border="1">
<tr><th>Tipo</th><th>Quantidade Ida e Volta</th><th>Valor Unitário</th></tr>
<tr><td>&nbsp;</td><td>&nbsp;</td><td>&nbsp;</td></tr>
<tr><td>&nbsp;</td><td>&nbsp;</td><td>&nbsp;</td></tr>
<tr><td>&nbsp;</td><td>&nbsp;</td><td>&nbsp;</td></tr>
</table>
</div>
<p style="text-align:right;margin-top:10px;">{{empresa.cidade}}, {{sistema.data_atual}}.</p>
<div style="margin-top:22px;"></div>
<p style="text-align:center">_____________________________<br>{{empregado.nome_empregado}}</p>
<hr style="margin:16px 0 4px;border:none;border-top:1px solid #ccc;">
<p style="text-align:center;font-size:10px;color:#7F8C8D;">SOLICITAÇÃO DE VALE-TRANSPORTE</p>$doc$ WHERE nome = 'Solicitação de Vale-Transporte';

UPDATE public.gm_modelos SET template = $doc$<div style="border:1px solid #2C3E50;padding:12px 16px;">
<p style="text-align:center"><strong>OPÇÃO DE DESISTÊNCIA DE VALE-TRANSPORTE</strong></p>
<p>Via nº: _____<br>
Razão Social: <strong>{{empresa.nome_empresa}}</strong> — CNPJ: {{empresa.cnpj}}<br>
Endereço: {{empresa.endereco}} — {{empresa.cidade}} — CEP: {{empresa.cep}}</p>
<p>Prezados Senhores:</p>
<p>Pelo presente venho desistir da utilização de Vale-Transporte previsto na Lei nº 7.418, de 16/12/1985, com advento da Lei nº 7.619, de 30/09/1987 e a Nova Regulamentação pelo Decreto nº 95.247, de 17/11/1987.</p>
<p>Esta decisão é válida enquanto não necessitar deste recurso legal por tempo indeterminado, de acordo com a minha livre e espontânea vontade.</p>
<p>Empregado: <strong>{{empregado.nome_empregado}}</strong> — CPF: {{empregado.cpf}}<br>
Função: {{empregado.desc_funcao}}</p>
<p>Atenciosamente,</p>
<p style="text-align:right">{{empresa.cidade}}, {{sistema.data_atual}}.</p>
</div>
<div style="margin-top:22px;"></div>
<table style="width:100%"><tr>
<td style="text-align:center">_____________________________<br>{{empregado.nome_empregado}}</td>
<td style="text-align:center">_____________________________<br>Responsável Legal</td>
</tr></table>$doc$ WHERE nome = 'Opção de Desistência de Vale-Transporte';

UPDATE public.gm_modelos SET template = $doc$<p style="text-align:center"><strong>TERMO DE AUTORIZAÇÃO PARA DESCONTO DO PLANO DE SAÚDE EM FOLHA DE PAGAMENTO</strong></p>
<p>Eu, {{empregado.nome_empregado}}, CPF: {{empregado.cpf}}, tomei ciência dos benefícios oferecidos pela empresa {{empresa.nome_empresa}}, CNPJ {{empresa.cnpj}}, e estou marcando com X minha opção de aderir ou não aderir, conforme relacionados abaixo.</p>
<p>Estou ciente e de acordo com as condições de pagamento do referido benefício, tanto para mim como para meu(s) dependente(s) declarado(s) também como optante(s), bem como os reajustes anuais e por faixa etária, tabela de valores para quem optar pelo plano com coparticipação, prazos e carências.</p>
<p>( &nbsp;) Tenho interesse em aderir o plano<br>
( &nbsp;) Não tenho interesse em aderir o plano</p>
<table style="width:100%;border-collapse:collapse;font-size:10px" border="1">
<tr><th>Plano</th><th>Utilizado</th><th>Desconto Colaborador</th><th>Valor Colaborador</th><th>Valor Dependente</th><th>Valor Dependente</th><th>Valor Dependente</th><th>Valor Dependente</th></tr>
<tr><td>&nbsp;</td><td>&nbsp;</td><td>&nbsp;</td><td>&nbsp;</td><td>&nbsp;</td><td>&nbsp;</td><td>&nbsp;</td><td>&nbsp;</td></tr>
<tr><td>&nbsp;</td><td>&nbsp;</td><td>&nbsp;</td><td>&nbsp;</td><td>&nbsp;</td><td>&nbsp;</td><td>&nbsp;</td><td>&nbsp;</td></tr>
</table>
<p>Número de dependentes: _____ &nbsp;&nbsp; Valor com desconto colaborador: _____________________________</p>
<p>Valor total desconto em folha: _____________________________</p>
<p>Por fim, autorizo o desconto do referido benefício em folha de pagamento, conforme política de benefícios praticada pela empresa.</p>
<p style="text-align:right">{{empresa.cidade}}, {{sistema.data_atual_extenso}}.</p>
<div style="margin-top:26px;"></div>
<p style="text-align:center">_____________________________<br>Assinatura<br>CPF: {{empregado.cpf}}</p>$doc$ WHERE nome = 'Autorização de Desconto do Plano de Saúde';

UPDATE public.gm_modelos SET template = $doc$<div style="border:1px solid #2C3E50;padding:12px 16px;">
<p style="text-align:center"><strong>ACORDO DE COMPENSAÇÃO DE HORAS DE TRABALHO</strong></p>
<p>Pelo presente acordo para compensação de horas de trabalho, firmado entre a empresa <strong>{{empresa.nome_empresa}}</strong>, com estabelecimento em {{empresa.cidade}}, {{empresa.endereco}}, inscrita no CNPJ/CEI sob o nº {{empresa.cnpj}}, neste ato representada pelo(a) Sr(a): _____________________________, e seu empregado(a) <strong>{{empregado.nome_empregado}}</strong>, portador(a) da Carteira de Trabalho e Previdência Social nº/série {{empregado.ctps}} - {{empregado.serie_ctps}} - {{empregado.uf_ctps}}, fica convencionado, de acordo com as disposições legais vigentes, o seguinte horário normal de trabalho semanal:</p>
<table style="width:100%;border-collapse:collapse;font-size:11px" border="1">
<tr><th rowspan="2">Dia</th><th colspan="2">Horário de Trabalho</th><th colspan="2">Intervalo</th></tr>
<tr><th>Início</th><th>Fim</th><th>Início</th><th>Fim</th></tr>
<tr><td>Segunda</td><td>&nbsp;</td><td>&nbsp;</td><td>&nbsp;</td><td>&nbsp;</td></tr>
<tr><td>Terça</td><td>&nbsp;</td><td>&nbsp;</td><td>&nbsp;</td><td>&nbsp;</td></tr>
<tr><td>Quarta</td><td>&nbsp;</td><td>&nbsp;</td><td>&nbsp;</td><td>&nbsp;</td></tr>
<tr><td>Quinta</td><td>&nbsp;</td><td>&nbsp;</td><td>&nbsp;</td><td>&nbsp;</td></tr>
<tr><td>Sexta</td><td>&nbsp;</td><td>&nbsp;</td><td>&nbsp;</td><td>&nbsp;</td></tr>
<tr><td>Sábado</td><td>&nbsp;</td><td>&nbsp;</td><td>&nbsp;</td><td>&nbsp;</td></tr>
<tr><td>Domingo</td><td>&nbsp;</td><td>&nbsp;</td><td>&nbsp;</td><td>&nbsp;</td></tr>
</table>
<p>E, por estarem de pleno acordo, as partes contratantes assinam o presente em 2 (duas) vias, o qual vigorará por prazo indeterminado.</p>
<p style="text-align:right">{{empresa.cidade}}, {{sistema.data_atual}}.</p>
</div>
<div style="margin-top:22px;"></div>
<table style="width:100%"><tr>
<td style="text-align:center">_____________________________<br>{{empregado.nome_empregado}}</td>
<td style="text-align:center">_____________________________<br>{{empresa.nome_empresa}}</td>
</tr></table>
<div style="margin-top:12px;"></div>
<table style="width:100%"><tr>
<td style="text-align:center">Testemunha</td>
<td style="text-align:center">Testemunha</td>
</tr></table>$doc$ WHERE nome = 'Acordo de Compensação de Horas de Trabalho';

UPDATE public.gm_modelos SET template = $doc$<div style="border:1px solid #2C3E50;padding:12px 16px;">
<p style="text-align:center"><strong>ACORDO DE PRORROGAÇÃO DE HORAS</strong></p>
<p>Entre a empresa <strong>{{empresa.nome_empresa}}</strong> com estabelecimento à {{empresa.endereco}}, {{empresa.cidade}}, neste ato representada pelo(a) Sr(a): _____________________________ e seu(sua) empregado(a) <strong>{{empregado.nome_empregado}}</strong>, abaixo assinado(a), portador(a) da Carteira de Trabalho e Previdência Social nº {{empregado.ctps}} - {{empregado.serie_ctps}} - {{empregado.uf_ctps}}, fica acertado este acordo para Prorrogação da Jornada de Trabalho, que se regerá pelas cláusulas abaixo:</p>
<p>1º) A duração do trabalho diário poderá ser prorrogada por _____ (_____ HORAS), sendo considerada(s) extraordinária(s) e pagas com acréscimo abaixo as horas que ultrapassarem o horário normal de trabalho.</p>
<p>2º) A remuneração de trabalho será a seguinte:<br>
Hora normal R$ _____ (_____)<br>
Hora extra a _____% (_____) no valor de R$ _____ (_____)</p>
<p>3º) As horas extras serão feitas de acordo com as necessidades da empresa, conferindo assim com o cartão de ponto, ponto eletrônico ou livro de ponto, conforme Artigo 59 da CLT.</p>
<p>4º) Comprovada a conveniência para isso, fica facultado a qualquer das partes rescindir unilateralmente este acordo, mediante aviso escrito, a partir do qual ficará cancelada a prorrogação de horário.</p>
<p>E, por estarem de pleno acordo, as partes contratantes assinam o presente em 2 (duas) vias, o qual vigorará por prazo indeterminado.</p>
<p style="text-align:right">{{empresa.cidade}}, {{sistema.data_atual}}.</p>
</div>
<div style="margin-top:22px;"></div>
<table style="width:100%"><tr>
<td style="text-align:center">_____________________________<br>{{empregado.nome_empregado}}</td>
<td style="text-align:center">_____________________________<br>{{empresa.nome_empresa}}</td>
</tr></table>
<div style="margin-top:12px;"></div>
<table style="width:100%"><tr>
<td style="text-align:center">Testemunha</td>
<td style="text-align:center">Testemunha</td>
</tr></table>$doc$ WHERE nome = 'Acordo de Prorrogação de Horas';

UPDATE public.gm_modelos SET template = $doc$<p><strong>Empresa:</strong> {{empresa.nome_empresa}}<br>
<strong>C.N.P.J/C.E.I:</strong> {{empresa.cnpj}}</p>
<p><strong>Nome do segurado:</strong> {{empregado.nome_empregado}}<br>
<strong>Cart. Prof./Série:</strong> {{empregado.ctps}} - {{empregado.serie_ctps}}</p>
<table style="width:100%;border-collapse:collapse" border="1">
<tr><th>Nome do Dependente</th><th>Data de Nascimento</th></tr>
<tr><td>&nbsp;</td><td>&nbsp;</td></tr>
<tr><td>&nbsp;</td><td>&nbsp;</td></tr>
</table>
<p style="text-align:right">{{empresa.cidade}}, {{sistema.data_atual}}.</p>
<div style="margin-top:26px;"></div>
<p style="text-align:center"><strong>{{empregado.nome_empregado}}</strong></p>
<p style="text-align:center;font-size:11px;color:#7F8C8D;">Polegar direito<br><span style="display:inline-block;border:1px solid #999;width:60px;height:60px;margin-top:4px;"></span></p>
<hr style="margin:18px 0;border:none;border-top:1px solid #ccc;">
<p style="text-align:center"><strong>TERMO DE RESPONSABILIDADE</strong><br>(Concessão Salário Família – Portaria MPAS nº 3.040/82)</p>
<p>Pelo presente Termo de Responsabilidade declaro estar ciente de que deverei comunicar de imediato a ocorrência dos seguintes fatos ou ocorrências que determinam a perda do direito ao salário-família:</p>
<ul>
<li>Óbito de filho;</li>
<li>Cessação da invalidez de filho inválido;</li>
<li>Sentença judicial que determine o pagamento a outrem (casos de divórcio, desquite ou separação, abandono de filho ou perda do pátrio poder).</li>
</ul>
<p>Estou ciente, ainda, de que a falta de cumprimento do compromisso ora assumido, além de obrigar à devolução das importâncias recebidas indevidamente, sujeitar-me-á às penalidades previstas no art. 171 do Código Penal e à rescisão do contrato de trabalho, por justa causa, nos termos do art. 482 da Consolidação das Leis do Trabalho.</p>$doc$ WHERE nome = 'Termo de Responsabilidade (Salário Família)';
