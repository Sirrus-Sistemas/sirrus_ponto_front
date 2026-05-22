import { useState, type FormEvent } from 'react'
import { Link } from 'react-router-dom'
import { ApiError } from '../../lib/api'
import { forgotPasswordRequest } from '../../services/authApi'
import { LoginCard } from './LoginCard'
import { OutlinedInput } from './OutlinedInput'
import { PrimaryButton } from './PrimaryButton'
import { digitsOnlyCpf, formatCpf } from './cpf'
import styles from './PasswordRecoveryPage.module.css'

export function PasswordRecoveryPage() {
  const [cpf, setCpf] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [sent, setSent] = useState(false)

  function handleCpfChange(e: React.ChangeEvent<HTMLInputElement>) {
    setCpf(formatCpf(e.target.value))
  }

  async function handleSubmit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault()
    const cpfDigits = digitsOnlyCpf(cpf)
    if (cpfDigits.length !== 11) {
      return
    }
    setError(null)
    setSent(false)
    setLoading(true)
    try {
      await forgotPasswordRequest(cpfDigits)
      setSent(true)
    } catch (err) {
      const message =
        err instanceof ApiError ? err.message : 'Não foi possível enviar. Tente de novo.'
      setError(message)
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className={styles.page}>
      <LoginCard>
        <header className={styles.header}>
          <h1 className={styles.title}>Recuperar senha</h1>
          <p className={styles.subtitle}>
            Informe seu CPF cadastrado para receber as instruções.
          </p>
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

          {error ? (
            <p className={styles.feedback} role="alert">
              {error}
            </p>
          ) : null}
          {sent ? (
            <p className={styles.feedbackOk} role="status">
              Se o CPF estiver cadastrado, você receberá as instruções em breve.
            </p>
          ) : null}

          <PrimaryButton type="submit" disabled={loading}>
            {loading ? 'Enviando…' : 'Enviar instruções'}
          </PrimaryButton>
        </form>

        <Link className={styles.backLink} to="/">
          Voltar ao login
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
