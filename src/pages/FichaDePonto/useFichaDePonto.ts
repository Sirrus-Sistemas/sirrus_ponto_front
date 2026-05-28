import { useCallback, useEffect, useMemo, useState } from 'react';
import { fetchEspelho, type EspelhoPayload, type StatusDia } from '../../services/espelhoApi';
import { fetchMe, type FuncionarioMe } from '../../services/userApi';
import { fetchFuncionarios, type FuncionarioListItem } from '../../services/funcionariosApi';
import { ApiError } from '../../lib/api';
import { parseDataHoraUtc } from '../../lib/parseDataHora';
import type { DayRow, DayStatus, Employee, FichaDePontoData, MonthlySummary, Punch, PunchSource } from './types';

function mapStatus(s: StatusDia, modifiers: string[]): DayStatus {
  switch (s) {
    case 'presente':
      return modifiers.includes('incompleto') ? 'inconsistente' : 'ok';
    case 'falta': return 'falta';
    case 'folga': return 'folga';
    case 'sem_escala': return 'folga';
    case 'ocorrencia': return 'abonado';
    case 'futuro': return 'ok';
    default: return 'ok';
  }
}

function mapTipo(tipo: string): PunchSource {
  if (tipo === 'rep') return 'rep';
  if (tipo === 'manual') return 'manual';
  return 'mobile'; // geo, online
}

function initials(nome: string): string {
  const parts = nome.trim().split(/\s+/);
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
  return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
}

function buildEmployee(payload: EspelhoPayload): Employee {
  const m = payload.meta;
  return {
    id: String(m.funcionario_id),
    fullName: m.funcionario_nome ?? '—',
    matricula: m.funcionario_matricula ?? '—',
    nsr: m.funcionario_pis ?? '—',
    initials: initials(m.funcionario_nome ?? '?'),
    lotacao: '—',
    company: m.empresa_razao_social ?? '—',
    role: m.funcionario_cargo ?? '—',
    workdayDescription: m.minutos_previsto_dia_referencia
      ? `${Math.floor(m.minutos_previsto_dia_referencia / 60)}h/dia`
      : '—',
    baseSchedule: m.turno_horario ?? '—',
  };
}

function buildDays(payload: EspelhoPayload): DayRow[] {
  return payload.dias.map((dia) => {
    const sorted = [...dia.marcacoes].sort((a, b) =>
      parseDataHoraUtc(a.data_hora).getTime() - parseDataHoraUtc(b.data_hora).getTime()
    );

    const punches: (Punch | null)[] = Array(8).fill(null);
    sorted.slice(0, 8).forEach((m, i) => {
      const d = parseDataHoraUtc(m.data_hora);
      const hh = String(d.getHours()).padStart(2, '0');
      const mm = String(d.getMinutes()).padStart(2, '0');
      punches[i] = { time: `${hh}:${mm}`, source: mapTipo(m.tipo) };
    });

    return {
      day: parseInt(dia.data.slice(8, 10), 10),
      month: parseInt(dia.data.slice(5, 7), 10),
      year: parseInt(dia.data.slice(0, 4), 10),
      dow: dia.dia_semana,
      status: mapStatus(dia.status, dia.modifiers ?? []),
      modifiers: dia.modifiers ?? [],
      punches,
      punchIds: sorted.map((m) => m.id),
      punchMotivos: sorted.map((m) => m.motivo_edicao ?? null),
      ocorrenciaId: dia.ocorrencia?.id,
      holidayName: dia.feriado?.descricao,
    };
  });
}

function buildSummary(payload: EspelhoPayload): MonthlySummary {
  const r = payload.resumo;
  const carga = payload.dias.reduce((acc, d) => acc + (d.minutos_previstos ?? 0), 0);
  const banco = r.saldo_mes_minutos ?? 0;
  return {
    carga,
    trabalhadas: r.minutos_trabalhados_mes,
    extras50: r.total_extras_50pct_minutos,
    extras100: r.total_extras_100pct_minutos,
    debito: banco < 0 ? Math.abs(banco) : 0,
    noturno: r.total_minutos_noturno,
    banco,
    faltas: r.dias_falta,
    abonos: r.dias_ocorrencia,
  };
}

interface Params {
  employeeId?: number;
  startMonth: number;
  startYear: number;
  endMonth: number;
  endYear: number;
}

function mergeSummaries(a: MonthlySummary, b: MonthlySummary): MonthlySummary {
  return {
    carga:      a.carga      + b.carga,
    trabalhadas: a.trabalhadas + b.trabalhadas,
    extras50:   a.extras50   + b.extras50,
    extras100:  a.extras100  + b.extras100,
    debito:     a.debito     + b.debito,
    noturno:    a.noturno    + b.noturno,
    banco:      a.banco      + b.banco,
    faltas:     a.faltas     + b.faltas,
    abonos:     a.abonos     + b.abonos,
  };
}

export interface UseFichaDePontoResult {
  data: FichaDePontoData | null;
  loading: boolean;
  error: string | null;
  me: FuncionarioMe | null;
  funcionarios: FuncionarioListItem[];
  reload: () => void;
}

export function useFichaDePonto(params: Params): UseFichaDePontoResult {
  const { employeeId, startMonth, startYear, endMonth, endYear } = params;
  const [data, setData] = useState<FichaDePontoData | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [me, setMe] = useState<FuncionarioMe | null>(null);
  const [funcionarios, setFuncionarios] = useState<FuncionarioListItem[]>([]);

  useEffect(() => {
    fetchMe()
      .then((m) => {
        setMe(m);
        if (m.role === 'admin' || m.role === 'gestor') {
          return fetchFuncionarios({ limit: 500, ativo: 1 });
        }
      })
      .then((res) => { if (res) setFuncionarios(res.data); })
      .catch(() => {});
  }, []);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const payload1 = await fetchEspelho(startYear, startMonth, employeeId);
      const isSameMonth = startMonth === endMonth && startYear === endYear;

      if (isSameMonth) {
        setData({
          employee: buildEmployee(payload1),
          days: buildDays(payload1),
          summary: buildSummary(payload1),
          folhaStatus: 'aberta',
          month: payload1.mes,
          year: payload1.ano,
          funcionarioId: payload1.meta.funcionario_id,
          turnoId: payload1.meta.turno_id ?? null,
        });
      } else {
        const payload2 = await fetchEspelho(endYear, endMonth, employeeId);
        setData({
          employee: buildEmployee(payload1),
          days: [...buildDays(payload1), ...buildDays(payload2)],
          summary: mergeSummaries(buildSummary(payload1), buildSummary(payload2)),
          folhaStatus: 'aberta',
          month: payload1.mes,
          year: payload1.ano,
          funcionarioId: payload1.meta.funcionario_id,
          turnoId: payload1.meta.turno_id ?? null,
        });
      }
    } catch (e) {
      setData(null);
      setError(e instanceof ApiError ? e.message : 'Não foi possível carregar a ficha.');
    } finally {
      setLoading(false);
    }
  }, [startYear, startMonth, endYear, endMonth, employeeId]);

  useEffect(() => { void load(); }, [load]);

  return useMemo(() => ({ data, loading, error, me, funcionarios, reload: load }), [data, loading, error, me, funcionarios, load]);
}
