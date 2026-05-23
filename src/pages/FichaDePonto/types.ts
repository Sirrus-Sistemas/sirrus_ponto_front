export type PunchSource = 'rep' | 'mobile' | 'manual';

export interface Punch {
  time: string; // HH:MM
  source: PunchSource;
}

export type DayStatus =
  | 'ok'
  | 'inconsistente'
  | 'falta'
  | 'abonado'
  | 'justificado'
  | 'pendente'
  | 'feriado'
  | 'folga';

export interface DayRow {
  day: number;
  month: number;
  year: number;
  dow: number; // 0=Dom..6=Sáb
  status: DayStatus;
  punches: (Punch | null)[]; // always length 8: E1 S1 E2 S2 E3 S3 E4 S4
  punchIds: number[];        // IDs das marcações existentes (ordem asc)
  note?: string;
  isToday?: boolean;
  holidayName?: string;
}

export interface MonthlySummary {
  carga: number;
  trabalhadas: number;
  extras50: number;
  extras100: number;
  debito: number;
  noturno: number;
  banco: number; // can be negative
  faltas: number;
  abonos: number;
}

export interface Employee {
  id: string;
  fullName: string;
  matricula: string;
  nsr: string;
  initials: string;
  lotacao: string;
  company: string;
  role: string;
  workdayDescription: string;
  baseSchedule: string;
}

export type FolhaStatus = 'aberta' | 'calculada' | 'fechada';

export interface FichaDePontoData {
  employee: Employee;
  days: DayRow[];
  summary: MonthlySummary;
  folhaStatus: FolhaStatus;
  month: number;
  year: number;
  funcionarioId: number;
  turnoId: number | null;
}
