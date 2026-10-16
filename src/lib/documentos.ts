/**
 * Validação de documentos e senha — mesmas regras do backend
 * (sirrus-ponto-backend: utils/cpf.js e motivoSenhaFraca em authService.js).
 * O servidor valida de novo; aqui é só para o erro aparecer antes do envio.
 */

const digitos = (v: string | null | undefined) => String(v ?? '').replace(/\D/g, '')

/** CPF com dígitos verificadores corretos (recusa sequências como 111.111.111-11). */
export function cpfValido(value: string | null | undefined): boolean {
  const c = digitos(value)
  if (c.length !== 11 || /^(\d)\1{10}$/.test(c)) return false
  for (const t of [9, 10]) {
    let soma = 0
    for (let i = 0; i < t; i++) soma += Number(c[i]) * (t + 1 - i)
    if (((soma * 10) % 11) % 10 !== Number(c[t])) return false
  }
  return true
}

/**
 * Campo PIS: PIS/PASEP/NIT válido OU o próprio CPF (Portaria 671 — o REP
 * identifica pelo CPF). Aceita zeros à esquerda (formato de 12 dígitos do relógio).
 */
export function pisValido(value: string | null | undefined, cpf?: string | null): boolean {
  const d = digitos(value)
  if (d.length < 11 || d.length > 12) return false
  const p = d.replace(/^0+(?=\d{11}$)/, '')
  if (p.length !== 11) return false
  if (cpf && p === digitos(cpf)) return cpfValido(p)
  if (/^(\d)\1{10}$/.test(p)) return false
  const pesos = [3, 2, 9, 8, 7, 6, 5, 4, 3, 2]
  let soma = 0
  for (let i = 0; i < 10; i++) soma += Number(p[i]) * pesos[i]
  const dv = 11 - (soma % 11)
  return (dv >= 10 ? 0 : dv) === Number(p[10])
}

const SENHAS_COMUNS = new Set([
  'senha', 'senha1', 'senha12', 'senha123', 'senha1234', 'password', 'qwerty', 'qwerty123',
  'abc123', 'abc1234', 'mudar123', 'mudar@123', 'admin', 'admin123', 'sirrus', 'sirrus123',
])

/** Motivo pelo qual a senha é fraca, ou null se ela serve. */
export function motivoSenhaFraca(senha: string, cpf?: string | null): string | null {
  if (senha.length < 6) return 'A senha deve ter pelo menos 6 caracteres.'
  const cpfD = digitos(cpf)
  if (cpfD.length === 11 && /^[\d.\-\s]+$/.test(senha)) {
    const s = digitos(senha)
    if (s.length >= 4 && cpfD.includes(s)) return 'A senha não pode ser o CPF nem parte dele.'
  }
  const lower = senha.toLowerCase()
  if (/^(.)\1+$/.test(lower)) return 'A senha não pode ser um mesmo caractere repetido.'
  const codes = [...lower].map((ch) => ch.charCodeAt(0))
  const passo = codes[1] - codes[0]
  if (Math.abs(passo) === 1 && codes.every((c, i) => i === 0 || c - codes[i - 1] === passo)) {
    return 'A senha não pode ser uma sequência (ex.: 123456, abcdef).'
  }
  if (SENHAS_COMUNS.has(lower)) return 'Essa senha é muito comum. Escolha outra.'
  return null
}
