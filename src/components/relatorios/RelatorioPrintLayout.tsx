import React from 'react'

// ─── Helpers ─────────────────────────────────────────────────────────────────

function pad2(n: number) {
  return String(n).padStart(2, '0')
}

function nowHora(): string {
  const d = new Date()
  return `${pad2(d.getHours())}:${pad2(d.getMinutes())}:${pad2(d.getSeconds())}`
}

function nowDate(): string {
  const d = new Date()
  return `${pad2(d.getDate())}/${pad2(d.getMonth() + 1)}/${d.getFullYear()}`
}

// ─── Types ────────────────────────────────────────────────────────────────────

type Props = {
  reportNum: number
  reportTitle: string
  companyName: string
  pageNum?: number
  children: React.ReactNode
}

// ─── Component ────────────────────────────────────────────────────────────────

const hdrStyle: React.CSSProperties = {
  fontFamily: "'Courier New', Courier, monospace",
  fontSize: '6.5pt',
  color: '#000',
  lineHeight: '1.4',
  borderBottom: '1px solid #000',
  paddingBottom: '1mm',
  marginBottom: '1mm',
}

const rowStyle: React.CSSProperties = {
  display: 'flex',
  justifyContent: 'space-between',
  alignItems: 'baseline',
}

export function RelatorioPrintLayout({ reportNum, reportTitle, companyName, pageNum = 1, children }: Props) {
  const emissaoDate = nowDate()
  const emissaoHora = nowHora()

  return (
    <div
      style={{
        fontFamily: "'Courier New', Courier, monospace",
        fontSize: '6.5pt',
        color: '#000',
      }}
    >
      {/* ── Cabeçalho ─────────────────────────────────────────────── */}
      <div style={hdrStyle}>
        {/* Linha 1 */}
        <div style={rowStyle}>
          <span style={{ fontWeight: 'bold' }}>Sirrus.Ponto - Sistema Gerenciador de Ponto Eletrônico</span>
          <span>Emissão: {emissaoDate}</span>
        </div>
        {/* Linha 2 */}
        <div style={rowStyle}>
          <span>{String(reportNum).padStart(2, '0')} - {reportTitle}</span>
          <span>Página: {String(pageNum).padStart(4, '0')}</span>
        </div>
        {/* Linha 3 */}
        <div style={rowStyle}>
          <span style={{ fontWeight: 'bold', textTransform: 'uppercase' }}>{companyName}</span>
          <span>Hora: {emissaoHora}</span>
        </div>
      </div>
      <hr style={{ border: 'none', borderTop: '1px solid #000', margin: '0 0 1mm 0' }} />
      {children}
    </div>
  )
}
