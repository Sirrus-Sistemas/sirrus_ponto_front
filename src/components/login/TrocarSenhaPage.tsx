import { useState, type FormEvent } from 'react'
import { useNavigate } from 'react-router-dom'
import { ApiError, clearStoredToken, tokenExigeTrocaSenha } from '../../lib/api'
import { changePasswordRequest, logoutRequest } from '../../services/authApi'
import { LoginCard } from './LoginCard'
import { OutlinedInput } from './OutlinedInput'
import { PrimaryButton } from './PrimaryButton'
import styles from './PasswordRecoveryPage.module.css'

/**
 * Troca de senha — obrigatória no primeiro acesso (senha provisória definida
 * pelo admin/import ou derivada do CPF); o RequireAuth manda pra cá e o
 * backend recusa as outras rotas até a troca.
 */
export function TrocarSenhaPage() {
  const navigate = useNavigate()
  const obrigatoria = tokenExigeTrocaSenha()
  const [atual, setAtual] = useState('')
  const [nova, setNova] = useState('')
  const [confirmar, setConfirmar] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  async function handleSubmit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault()
    if (!atual) { setError('Informe a senha atual.'); return }
    if (nova.length < 6) { setError('A nova senha deve ter no mínimo 6 caracteres.'); return }
    if (nova !== confirmar) { setError('A confirmação não confere com a nova senha.'); return }
    if (nova === atual) { setError('A nova senha precisa ser diferente da atual.'); return }

    setError(null)
    setLoading(true)
    try {
      await changePasswordRequest(atual, nova)
      navigate('/dashboard', { replace: true })
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Não foi possível trocar a senha. Tente de novo.')
    } finally {
      setLoading(false)
    }
  }

  async function handleSair() {
    try { await logoutRequest() } catch { /* sai mesmo assim */ }
    clearStoredToken()
    navigate('/', { replace: true })
  }

  return (
    <div className={styles.page}>
      <LoginCard>
        <header className={styles.header}>
          <h1 className={styles.title}>Trocar senha</h1>
          <p className={styles.subtitle}>
            {obrigatoria
              ? 'Sua senha atual é provisória. Escolha uma nova senha para continuar.'
              : 'Escolha uma nova senha.'}
          </p>
        </header>

        <form className={styles.form} onSubmit={handleSubmit} noValidate>
          <OutlinedInput
            label="Senha atual"
            name="current-password"
            type="password"
            autoComplete="current-password"
            value={atual}
            onChange={(e) => setAtual(e.target.value)}
            aria-label="Senha atual"
          />
          <OutlinedInput
            label="Nova senha"
            name="new-password"
            type="password"
            autoComplete="new-password"
            value={nova}
            onChange={(e) => setNova(e.target.value)}
            aria-label="Nova senha"
          />
          <OutlinedInput
            label="Confirmar nova senha"
            name="confirm-password"
            type="password"
            autoComplete="new-password"
            value={confirmar}
            onChange={(e) => setConfirmar(e.target.value)}
            aria-label="Confirmar nova senha"
          />

          <p className={styles.subtitle} style={{ fontSize: '0.8125rem' }}>
            Mínimo 6 caracteres. Não use o CPF nem parte dele.
          </p>

          {error ? (
            <p className={styles.feedback} role="alert">
              {error}
            </p>
          ) : null}

          <PrimaryButton type="submit" disabled={loading}>
            {loading ? 'Salvando…' : 'Salvar nova senha'}
          </PrimaryButton>
        </form>

        <button type="button" className={styles.backLink} onClick={() => void handleSair()}
          style={{ background: 'none', border: 0, cursor: 'pointer', width: '100%' }}>
          Sair
        </button>
      </LoginCard>
    </div>
  )
}
