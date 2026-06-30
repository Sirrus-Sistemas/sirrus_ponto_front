import { useCallback, useEffect, useMemo, useState } from 'react';
import { fetchEspelho, type EspelhoPayload, type StatusDia } from '../../services/espelhoApi';
import { fetchMe, type FuncionarioMe } from '../../services/userApi';
import { fetchFuncionarios, type FuncionarioListItem } from '../../services/funcionariosApi';
import { fetchFicha, bloquearDia, desbloquearDia, bloquearPeriodo as bloquearPeriodoApi, desbloquearPeriodo as desbloquearPeriodoApi } from '../../services/fichaPontoApi';
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

type MarcacaoItem = EspelhoPayload['dias'][0]['marcacoes'][0];

/**
 * Distribui as marcações do dia em 8 slots posicionais (índice = coluna no grid).
 * Retorna array de tamanho 8 com null nos slots vazios — posições absolutas preservadas.
 *
 * Regras:
 *  - Marcações com slot_override definido ficam fixas na posição indicada.
 *  - As demais preenchem os slots livres restantes em ordem cronológica.
 */
function buildSlots(marcacoes: MarcacaoItem[]): (MarcacaoItem | null)[] {
  // 1. Deduplica por ID — defesa contra o mesmo registro enviado duas vezes
  const seenIds = new Set<number>();
  const dedupById = marcacoes.filter(m => {
    if (seenIds.has(m.id)) return false;
    seenIds.add(m.id);
    return true;
  });

  // 2. Ordena cronologicamente antes de deduplicar por horário (mantém a mais antiga)
  const sorted = [...dedupById].sort(
    (a, b) => parseDataHoraUtc(a.data_hora).getTime() - parseDataHoraUtc(b.data_hora).getTime(),
  );

  // 3. Deduplica por HH:MM — batidas no mesmo minuto exibem apenas uma
  const seenTimes = new Set<string>();
  const deduped = sorted.filter(m => {
    const d = parseDataHoraUtc(m.data_hora);
    const key = `${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`;
    if (seenTimes.has(key)) return false;
    seenTimes.add(key);
    return true;
  });

  const slots: (MarcacaoItem | null)[] = new Array(8).fill(null);

  const overridden = deduped
    .filter(m => m.slot_override !== null && m.slot_override !== undefined)
    .sort((a, b) => (a.slot_override ?? 0) - (b.slot_override ?? 0));

  // normal já está ordenada pelo sort acima — filtra sem re-ordenar
  const normal = deduped
    .filter(m => m.slot_override === null || m.slot_override === undefined);

  // 1. Posiciona as batidas com override fixo
  for (const m of overridden) {
    const pos = m.slot_override!;
    if (pos < 8 && slots[pos] === null) slots[pos] = m;
  }

  // 2. Preenche slots livres com as demais, em ordem cronológica
  let ni = 0;
  for (let i = 0; i < 8 && ni < normal.length; i++) {
    if (slots[i] === null) slots[i] = normal[ni++];
  }

  return slots;
}

function buildDays(payload: EspelhoPayload, bloqueadoMap: Record<string, boolean> = {}): DayRow[] {
  return payload.dias.map((dia) => {
    // slots[i] = marcação que deve aparecer na coluna i (ou null se vazia)
    const slots = buildSlots(dia.marcacoes);

    const punches: (Punch | null)[] = Array(8).fill(null);
    const punchIds: number[] = [];
    const punchMotivos: (string | null)[] = [];

    slots.forEach((m, i) => {
      if (m) {
        const d = parseDataHoraUtc(m.data_hora);
        const hh = String(d.getHours()).padStart(2, '0');
        const mm = String(d.getMinutes()).padStart(2, '0');
        punches[i] = { time: `${hh}:${mm}`, source: mapTipo(m.tipo) };
        punchIds[i] = m.id;          // índice = posição no grid
        punchMotivos[i] = m.motivo_edicao ?? null;
      }
    });

    return {
      day: parseInt(dia.data.slice(8, 10), 10),
      month: parseInt(dia.data.slice(5, 7), 10),
      year: parseInt(dia.data.slice(0, 4), 10),
      dow: dia.dia_semana,
      status: mapStatus(dia.status, dia.modifiers ?? []),
      modifiers: dia.modifiers ?? [],
      punches,
      punchIds,
      punchMotivos,
      horariosPrevistos: dia.horarios_previstos ?? [],
      batidasEsperadas: dia.batidas_esperadas ?? null,
      bloqueado: bloqueadoMap[dia.data] ?? dia.bloqueado ?? false,
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
  toggleBloqueio: (row: DayRow) => Promise<void>;
  bloquearPeriodo: (params: { data_inicio: string; data_fim: string; funcionario_ids?: number[] }) => Promise<{ funcionarios: number; dias: number; total: number }>;
  desbloquearPeriodo: (params: { data_inicio: string; data_fim: string; funcionario_ids?: number[] }) => Promise<{ removidos: number }>;
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

  const makeBloqueadoMap = (dias: { data: string; bloqueado?: boolean }[]): Record<string, boolean> => {
    const map: Record<string, boolean> = {};
    dias.forEach(d => { if (d.bloqueado !== undefined) map[d.data] = d.bloqueado; });
    return map;
  };

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const isSameMonth = startMonth === endMonth && startYear === endYear;

      if (isSameMonth) {
        const [payload1, ficha1] = await Promise.all([
          fetchEspelho(startYear, startMonth, employeeId),
          fetchFicha(startYear, startMonth, employeeId),
        ]);
        const bloqueadoMap1 = makeBloqueadoMap(ficha1.dias);
        setData({
          employee: buildEmployee(payload1),
          days: buildDays(payload1, bloqueadoMap1),
          summary: buildSummary(payload1),
          folhaStatus: 'aberta',
          month: payload1.mes,
          year: payload1.ano,
          funcionarioId: payload1.meta.funcionario_id,
          turnoId: payload1.meta.turno_id ?? null,
          tzOffset: payload1.meta.tz_offset ?? null,
        });
      } else {
        const [payload1, ficha1, payload2, ficha2] = await Promise.all([
          fetchEspelho(startYear, startMonth, employeeId),
          fetchFicha(startYear, startMonth, employeeId),
          fetchEspelho(endYear, endMonth, employeeId),
          fetchFicha(endYear, endMonth, employeeId),
        ]);
        const bloqueadoMap1 = makeBloqueadoMap(ficha1.dias);
        const bloqueadoMap2 = makeBloqueadoMap(ficha2.dias);
        setData({
          employee: buildEmployee(payload1),
          days: [...buildDays(payload1, bloqueadoMap1), ...buildDays(payload2, bloqueadoMap2)],
          summary: mergeSummaries(buildSummary(payload1), buildSummary(payload2)),
          folhaStatus: 'aberta',
          month: payload1.mes,
          year: payload1.ano,
          funcionarioId: payload1.meta.funcionario_id,
          turnoId: payload1.meta.turno_id ?? null,
          tzOffset: payload1.meta.tz_offset ?? null,
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

  const desbloquearPeriodo = useCallback(async (params: {
    data_inicio: string;
    data_fim: string;
    funcionario_ids?: number[];
  }): Promise<{ removidos: number }> => {
    const result = await desbloquearPeriodoApi(params);
    void load();
    return result;
  }, [load]);

  const bloquearPeriodo = useCallback(async (params: {
    data_inicio: string;
    data_fim: string;
    funcionario_ids?: number[];
  }): Promise<{ funcionarios: number; dias: number; total: number }> => {
    const result = await bloquearPeriodoApi(params);
    void load();
    return result;
  }, [load]);

  const toggleBloqueio = useCallback(async (row: DayRow) => {
    const funcId = data?.funcionarioId;
    if (!funcId) return;
    const pad = (n: number) => String(n).padStart(2, '0');
    const dateStr = `${row.year}-${pad(row.month)}-${pad(row.day)}`;
    if (row.bloqueado) {
      await desbloquearDia(funcId, dateStr);
    } else {
      await bloquearDia({ funcionario_id: funcId, data: dateStr });
    }
    setData(prev => {
      if (!prev) return prev;
      return {
        ...prev,
        days: prev.days.map(d =>
          d.year === row.year && d.month === row.month && d.day === row.day
            ? { ...d, bloqueado: !d.bloqueado }
            : d
        ),
      };
    });
  }, [data?.funcionarioId]); // eslint-disable-line react-hooks/exhaustive-deps

  return useMemo(
    () => ({ data, loading, error, me, funcionarios, reload: load, toggleBloqueio, bloquearPeriodo, desbloquearPeriodo }),
    [data, loading, error, me, funcionarios, load, toggleBloqueio, bloquearPeriodo, desbloquearPeriodo],
  );
}
