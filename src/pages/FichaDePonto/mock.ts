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
const d = (day: number, dow: number, status: DayRow['status'], punches: DayRow['punches'], extra?: Partial<DayRow>): DayRow => {
  const { modifiers, ...rest } = extra ?? {};
  return { day, month: MOCK_MONTH, year: MOCK_YEAR, dow, status, punches, punchIds: [], punchMotivos: [], modifiers: modifiers ?? [], ...rest };
};

const DAYS: DayRow[] = [
  d(1, 3, 'ok', stdSlots()),
  d(2, 4, 'ok', stdSlots()),
  d(3, 5, 'ok', slots(p('08:00', R), p('12:00', R), p('13:00', R), p('17:14', M)), { note: 'Ajuste manual saída' }),
  d(4, 6, 'folga', slots()),
  d(5, 0, 'folga', slots()),
  d(6, 1, 'ok', stdSlots()),
  d(7, 2, 'inconsistente', slots(p('08:00', R), p('12:02', R), p('13:01', R), null), { note: 'S2 ausente' }),
  d(8, 3, 'ok', stdSlots()),
  d(9, 4, 'ok', slots(p('08:00', R), p('12:00', R), p('13:00', R), p('17:00', Mb)), { note: 'Saída via app' }),
  d(10, 5, 'ok', stdSlots()),
  d(11, 6, 'folga', slots()),
  d(12, 0, 'feriado', slots(), { holidayName: 'N. S. Aparecida' }),
  d(13, 1, 'ok', slots(p('08:11', M), p('12:00', R), p('13:00', R), p('17:00', R)), { note: 'REP fora do ar' }),
  d(14, 2, 'ok', slots(p('08:00', R), p('12:00', R), p('13:00', R), p('17:32', M)), { note: 'HE autorizada' }),
  d(15, 3, 'abonado', slots(), { note: 'Atestado médico' }),
  d(16, 4, 'ok', stdSlots()),
  d(17, 5, 'ok', slots(p('06:00', R), p('10:00', R), p('11:00', R), p('15:00', R), p('16:00', R), p('19:00', R), p('20:00', R), p('22:00', R)), { isToday: true, note: 'Jornada extemp. autorizada · 12h' }),
  d(18, 6, 'folga', slots()),
  d(19, 0, 'folga', slots()),
  d(20, 1, 'ok', stdSlots()),
  d(21, 2, 'ok', stdSlots()),
  d(22, 3, 'ok', stdSlots()),
  d(23, 4, 'ok', stdSlots()),
  d(24, 5, 'ok', stdSlots()),
  d(25, 6, 'folga', slots()),
  d(26, 0, 'folga', slots()),
  d(27, 1, 'ok', stdSlots()),
  d(28, 2, 'ok', stdSlots()),
  d(29, 3, 'ok', stdSlots()),
  d(30, 4, 'ok', stdSlots()),
  d(31, 5, 'ok', stdSlots()),
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
