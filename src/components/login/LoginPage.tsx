import { useEffect, useState, type FormEvent } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { ApiError, getStoredToken } from '../../lib/api'
import { loginRequest } from '../../services/authApi'
import { LoginCard } from './LoginCard'
import { OutlinedInput } from './OutlinedInput'
import { PrimaryButton } from './PrimaryButton'
import { digitsOnlyCpf, formatCpf } from './cpf'
import styles from './LoginPage.module.css'

export function LoginPage() {
  const navigate = useNavigate()
  const [cpf, setCpf] = useState('')

  useEffect(() => {
    if (getStoredToken()) {
      navigate('/dashboard', { replace: true })
    }
  }, [navigate])
  const [password, setPassword] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  function handleCpfChange(e: React.ChangeEvent<HTMLInputElement>) {
    setCpf(formatCpf(e.target.value))
  }

  async function handleSubmit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault()
    const cpfDigits = digitsOnlyCpf(cpf)
    if (cpfDigits.length !== 11) {
      setError('Informe um CPF válido com 11 dígitos.')
      return
    }
    const pwd = password.trim()
    if (!pwd) {
      setError('Informe sua senha.')
      return
    }
    setError(null)
    setLoading(true)
    try {
      await loginRequest(cpfDigits, pwd)
      navigate('/dashboard', { replace: true })
    } catch (err) {
      let message =
        err instanceof ApiError
          ? err.message
          : 'Não foi possível entrar. Tente de novo.'
      if (err instanceof TypeError || (err instanceof Error && message === 'Failed to fetch')) {
        message =
          'Não foi possível conectar ao servidor. Confira se o backend está rodando e se VITE_API_URL no arquivo .env (ou .env.local) está correto — ex.: http://localhost:3000'
      }
      if (message.includes('VITE_API_URL')) {
        message =
          'Configure VITE_API_URL na raiz do projeto (por exemplo http://localhost:3000 onde o backend está ativo). Reinicie o comando npm run dev após alterar.'
      }
      setError(message)
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className={styles.page}>
      <LoginCard>
        <header className={styles.header}>
          <h1 className={styles.title}>Sirrus Ponto</h1>
          <p className={styles.subtitle}>Acesse para registrar e acompanhar seu ponto.</p>
        </header>

        <form className={styles.form} onSubmit={handleSubmit} noValidate>
          <OutlinedInput
            label="CPF"
            name="cpf"
            type="text"
            inputMode="numeric"
            autoComplete="username"
            value={cpf}
            onChange={handleCpfChange}
            maxLength={14}
            aria-label="CPF"
          />

          <OutlinedInput
            label="Senha"
            name="password"
            type="password"
            autoComplete="current-password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            aria-label="Senha"
          />

          {error ? (
            <p className={styles.feedback} role="alert">
              {error}
            </p>
          ) : null}

          <PrimaryButton type="submit" disabled={loading}>
            {loading ? 'Entrando…' : 'Entrar'}
          </PrimaryButton>
        </form>

        <Link className={styles.forgotLink} to="/recuperar-senha">
          Esqueci minha senha
        </Link>

        <a
          className={styles.copyright}
          href="https://sirrus.com.br/"
          target="_blank"
          rel="noopener noreferrer"
        >
          © 2026 Sirrus Sistemas
        </a>
      </LoginCard>
    </div>
  )
}
