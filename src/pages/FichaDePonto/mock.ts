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

const DAYS: DayRow[] = [
  { day: 1, dow: 3, status: 'ok', punches: stdSlots() },
  { day: 2, dow: 4, status: 'ok', punches: stdSlots() },
  { day: 3, dow: 5, status: 'ok', punches: slots(p('08:00', R), p('12:00', R), p('13:00', R), p('17:14', M)), note: 'Ajuste manual saída' },
  { day: 4, dow: 6, status: 'folga', punches: slots() },
  { day: 5, dow: 0, status: 'folga', punches: slots() },
  { day: 6, dow: 1, status: 'ok', punches: stdSlots() },
  { day: 7, dow: 2, status: 'inconsistente', punches: slots(p('08:00', R), p('12:02', R), p('13:01', R), null), note: 'S2 ausente' },
  { day: 8, dow: 3, status: 'ok', punches: stdSlots() },
  { day: 9, dow: 4, status: 'ok', punches: slots(p('08:00', R), p('12:00', R), p('13:00', R), p('17:00', Mb)), note: 'Saída via app' },
  { day: 10, dow: 5, status: 'ok', punches: stdSlots() },
  { day: 11, dow: 6, status: 'folga', punches: slots() },
  { day: 12, dow: 0, status: 'feriado', punches: slots(), holidayName: 'N. S. Aparecida' },
  { day: 13, dow: 1, status: 'ok', punches: slots(p('08:11', M), p('12:00', R), p('13:00', R), p('17:00', R)), note: 'REP fora do ar' },
  { day: 14, dow: 2, status: 'ok', punches: slots(p('08:00', R), p('12:00', R), p('13:00', R), p('17:32', M)), note: 'HE autorizada' },
  { day: 15, dow: 3, status: 'abonado', punches: slots(), note: 'Atestado médico' },
  { day: 16, dow: 4, status: 'ok', punches: stdSlots() },
  {
    day: 17, dow: 5, status: 'ok', isToday: true,
    punches: slots(p('06:00', R), p('10:00', R), p('11:00', R), p('15:00', R), p('16:00', R), p('19:00', R), p('20:00', R), p('22:00', R)),
    note: 'Jornada extemp. autorizada · 12h',
  },
  { day: 18, dow: 6, status: 'folga', punches: slots() },
  { day: 19, dow: 0, status: 'folga', punches: slots() },
  { day: 20, dow: 1, status: 'ok', punches: stdSlots() },
  { day: 21, dow: 2, status: 'ok', punches: stdSlots() },
  { day: 22, dow: 3, status: 'ok', punches: stdSlots() },
  { day: 23, dow: 4, status: 'ok', punches: stdSlots() },
  { day: 24, dow: 5, status: 'ok', punches: stdSlots() },
  { day: 25, dow: 6, status: 'folga', punches: slots() },
  { day: 26, dow: 0, status: 'folga', punches: slots() },
  { day: 27, dow: 1, status: 'ok', punches: stdSlots() },
  { day: 28, dow: 2, status: 'ok', punches: stdSlots() },
  { day: 29, dow: 3, status: 'ok', punches: stdSlots() },
  { day: 30, dow: 4, status: 'ok', punches: stdSlots() },
  { day: 31, dow: 5, status: 'ok', punches: stdSlots() },
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
  month: 10,
  year: 2025,
};
