/**
 * Feriados nacionais de 2026–2027 (lista inicial, EDITÁVEL na interface).
 * `facultativo`: ponto facultativo (ex.: Corpus Christi) — só vale como feriado
 * se o usuário mantiver na lista.
 * Feriados estaduais/municipais (ex.: DF) devem ser adicionados pelo usuário.
 */
export interface Feriado {
  data: string // YYYY-MM-DD
  nome: string
  facultativo?: boolean
}

export const FERIADOS_PADRAO: Feriado[] = [
  { data: '2026-12-25', nome: 'Natal' },
  { data: '2027-01-01', nome: 'Confraternização Universal' },
  { data: '2027-03-26', nome: 'Sexta-feira Santa' },
  { data: '2027-04-21', nome: 'Tiradentes' },
  { data: '2027-05-01', nome: 'Dia do Trabalho' },
  { data: '2027-05-27', nome: 'Corpus Christi', facultativo: true },
  { data: '2027-09-07', nome: 'Independência do Brasil' },
  { data: '2027-10-12', nome: 'Nossa Senhora Aparecida' },
  { data: '2027-11-02', nome: 'Finados' },
  { data: '2027-11-15', nome: 'Proclamação da República' },
  { data: '2027-11-20', nome: 'Consciência Negra' },
  { data: '2027-12-25', nome: 'Natal' },
  { data: '2026-01-01', nome: 'Confraternização Universal' },
  { data: '2026-04-03', nome: 'Sexta-feira Santa' },
  { data: '2026-04-21', nome: 'Tiradentes' },
  { data: '2026-05-01', nome: 'Dia do Trabalho' },
  { data: '2026-06-04', nome: 'Corpus Christi', facultativo: true },
  { data: '2026-09-07', nome: 'Independência do Brasil' },
  { data: '2026-10-12', nome: 'Nossa Senhora Aparecida' },
  { data: '2026-11-02', nome: 'Finados' },
  { data: '2026-11-15', nome: 'Proclamação da República' },
  { data: '2026-11-20', nome: 'Consciência Negra' },
].sort((a, b) => a.data.localeCompare(b.data))
