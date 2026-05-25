import type { DayRow, Employee, FichaDePontoData, MonthlySummary, FolhaStatus } from './types';

const R = 'rep' as const;
const M = 'manual' as const;
const Mb = 'mobile' as const;

function p(time: string, source: typeof R | typeof M | typeof Mb) {
  return { time, source };
}

function slots(...punches: ({ time: string; source: typeof R | typeof M | typeof Mb } | null)[]) {
  const s = [...punches];
  while (s.length < 8) s.push(null);
  return s;
}

const STD = [p('08:00', R), p('12:00', R), p('13:00', R), p('17:00', R)];
function stdSlots() {
  return slots(...STD);
}

const EMPLOYEE: Employee = {
  id: '80',
  fullName: 'Albertina Hatsue Souza Saraiva',
  matricula: '80',
  nsr: '1.247.881',
  initials: 'AS',
  lotacao: 'TI · Matriz',
  company: 'Ativa Cons. Org. Ltda',
  role: 'Operador de Teleatendimento',
  workdayDescription: '8h/dia · 44h/semana',
  baseSchedule: '08:00–12:00 / 13:00–17:00',
};

const MOCK_MONTH = 10;
const MOCK_YEAR = 2025;

const DAYS: DayRow[] = [
  { day: 1, month: MOCK_MONTH, year: MOCK_YEAR, dow: 3, status: 'ok', punches: stdSlots(), punchIds: [] },
  { day: 2, month: MOCK_MONTH, year: MOCK_YEAR, dow: 4, status: 'ok', punches: stdSlots(), punchIds: [] },
  { day: 3, month: MOCK_MONTH, year: MOCK_YEAR, dow: 5, status: 'ok', punches: slots(p('08:00', R), p('12:00', R), p('13:00', R), p('17:14', M)), punchIds: [], note: 'Ajuste manual saída' },
  { day: 4, month: MOCK_MONTH, year: MOCK_YEAR, dow: 6, status: 'folga', punches: slots(), punchIds: [] },
  { day: 5, month: MOCK_MONTH, year: MOCK_YEAR, dow: 0, status: 'folga', punches: slots(), punchIds: [] },
  { day: 6, month: MOCK_MONTH, year: MOCK_YEAR, dow: 1, status: 'ok', punches: stdSlots(), punchIds: [] },
  { day: 7, month: MOCK_MONTH, year: MOCK_YEAR, dow: 2, status: 'inconsistente', punches: slots(p('08:00', R), p('12:02', R), p('13:01', R), null), punchIds: [], note: 'S2 ausente' },
  { day: 8, month: MOCK_MONTH, year: MOCK_YEAR, dow: 3, status: 'ok', punches: stdSlots(), punchIds: [] },
  { day: 9, month: MOCK_MONTH, year: MOCK_YEAR, dow: 4, status: 'ok', punches: slots(p('08:00', R), p('12:00', R), p('13:00', R), p('17:00', Mb)), punchIds: [], note: 'Saída via app' },
  { day: 10, month: MOCK_MONTH, year: MOCK_YEAR, dow: 5, status: 'ok', punches: stdSlots(), punchIds: [] },
  { day: 11, month: MOCK_MONTH, year: MOCK_YEAR, dow: 6, status: 'folga', punches: slots(), punchIds: [] },
  { day: 12, month: MOCK_MONTH, year: MOCK_YEAR, dow: 0, status: 'feriado', punches: slots(), punchIds: [], holidayName: 'N. S. Aparecida' },
  { day: 13, month: MOCK_MONTH, year: MOCK_YEAR, dow: 1, status: 'ok', punches: slots(p('08:11', M), p('12:00', R), p('13:00', R), p('17:00', R)), punchIds: [], note: 'REP fora do ar' },
  { day: 14, month: MOCK_MONTH, year: MOCK_YEAR, dow: 2, status: 'ok', punches: slots(p('08:00', R), p('12:00', R), p('13:00', R), p('17:32', M)), punchIds: [], note: 'HE autorizada' },
  { day: 15, month: MOCK_MONTH, year: MOCK_YEAR, dow: 3, status: 'abonado', punches: slots(), punchIds: [], note: 'Atestado médico' },
  { day: 16, month: MOCK_MONTH, year: MOCK_YEAR, dow: 4, status: 'ok', punches: stdSlots(), punchIds: [] },
  {
    day: 17, month: MOCK_MONTH, year: MOCK_YEAR, dow: 5, status: 'ok', isToday: true,
    punches: slots(p('06:00', R), p('10:00', R), p('11:00', R), p('15:00', R), p('16:00', R), p('19:00', R), p('20:00', R), p('22:00', R)),
    punchIds: [],
    note: 'Jornada extemp. autorizada · 12h',
  },
  { day: 18, month: MOCK_MONTH, year: MOCK_YEAR, dow: 6, status: 'folga', punches: slots(), punchIds: [] },
  { day: 19, month: MOCK_MONTH, year: MOCK_YEAR, dow: 0, status: 'folga', punches: slots(), punchIds: [] },
  { day: 20, month: MOCK_MONTH, year: MOCK_YEAR, dow: 1, status: 'ok', punches: stdSlots(), punchIds: [] },
  { day: 21, month: MOCK_MONTH, year: MOCK_YEAR, dow: 2, status: 'ok', punches: stdSlots(), punchIds: [] },
  { day: 22, month: MOCK_MONTH, year: MOCK_YEAR, dow: 3, status: 'ok', punches: stdSlots(), punchIds: [] },
  { day: 23, month: MOCK_MONTH, year: MOCK_YEAR, dow: 4, status: 'ok', punches: stdSlots(), punchIds: [] },
  { day: 24, month: MOCK_MONTH, year: MOCK_YEAR, dow: 5, status: 'ok', punches: stdSlots(), punchIds: [] },
  { day: 25, month: MOCK_MONTH, year: MOCK_YEAR, dow: 6, status: 'folga', punches: slots(), punchIds: [] },
  { day: 26, month: MOCK_MONTH, year: MOCK_YEAR, dow: 0, status: 'folga', punches: slots(), punchIds: [] },
  { day: 27, month: MOCK_MONTH, year: MOCK_YEAR, dow: 1, status: 'ok', punches: stdSlots(), punchIds: [] },
  { day: 28, month: MOCK_MONTH, year: MOCK_YEAR, dow: 2, status: 'ok', punches: stdSlots(), punchIds: [] },
  { day: 29, month: MOCK_MONTH, year: MOCK_YEAR, dow: 3, status: 'ok', punches: stdSlots(), punchIds: [] },
  { day: 30, month: MOCK_MONTH, year: MOCK_YEAR, dow: 4, status: 'ok', punches: stdSlots(), punchIds: [] },
  { day: 31, month: MOCK_MONTH, year: MOCK_YEAR, dow: 5, status: 'ok', punches: stdSlots(), punchIds: [] },
];

const SUMMARY: MonthlySummary = {
  carga: 11040,      // 184h00
  trabalhadas: 10657, // 177h37
  extras50: 346,     // 5h46
  extras100: 0,
  debito: 11,        // 0h11
  noturno: 0,
  banco: -383,       // -6h23
  faltas: 0,
  abonos: 1,
};

export const MOCK_FICHA: FichaDePontoData = {
  employee: EMPLOYEE,
  days: DAYS,
  summary: SUMMARY,
  folhaStatus: 'aberta' as FolhaStatus,
  month: MOCK_MONTH,
  year: MOCK_YEAR,
  funcionarioId: 80,
  turnoId: null,
};
