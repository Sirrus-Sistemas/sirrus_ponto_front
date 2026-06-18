import { useCallback, useEffect, useRef, useState } from 'react'
import {
  fetchFeriados,
  createFeriado,
  deleteFeriado,
  type Feriado,
  type FeriadoPayload,
} from '../../services/feriadosApi'
import { ApiError } from '../../lib/api'
import type { FeriadoFilters } from './types'

const ANO_ATUAL = new Date().getFullYear()

export function useFeriados() {
  const [rows, setRows] = useState<Feriado[]>([])
  const [total, setTotal] = useState(0)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [filters, setFilters] = useState<FeriadoFilters>({
    q: '',
    tipo: 'todos',
    ano: String(ANO_ATUAL),
  })

  const searchTimer = useRef<ReturnType<typeof setTimeout> | null>(null)

  const load = useCallback((f: FeriadoFilters) => {
    setLoading(true)
    setError(null)
    fetchFeriados({
      search:  f.q || undefined,
      tipo:    f.tipo !== 'todos' ? f.tipo : undefined,
      ano:     f.ano || undefined,
      limit:   200,
    })
      .then(({ rows: r, total: t }) => { setRows(r); setTotal(t) })
      .catch((err: unknown) => {
        setError(err instanceof ApiError ? err.message : 'Não foi possível carregar os feriados.')
        setRows([])
        setTotal(0)
      })
      .finally(() => setLoading(false))
  }, [])

  useEffect(() => {
    load(filters)
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [load])

  function updateFilters(partial: Partial<FeriadoFilters>) {
    const next = { ...filters, ...partial }
    setFilters(next)
    if (searchTimer.current) clearTimeout(searchTimer.current)
    if ('q' in partial) {
      searchTimer.current = setTimeout(() => load(next), 400)
    } else {
      load(next)
    }
  }

  async function add(payload: FeriadoPayload): Promise<void> {
    await createFeriado(payload)
    load(filters)
  }

  async function remove(id: number): Promise<void> {
    await deleteFeriado(id)
    load(filters)
  }

  return { rows, total, loading, error, filters, updateFilters, add, remove }
}
