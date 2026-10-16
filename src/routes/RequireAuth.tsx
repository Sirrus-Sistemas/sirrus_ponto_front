import { Navigate, Outlet, useLocation } from 'react-router-dom'
import { getStoredToken, tokenExigeTrocaSenha, TROCAR_SENHA_PATH } from '../lib/api'

export function RequireAuth() {
  const { pathname } = useLocation()
  if (!getStoredToken()) {
    return <Navigate to="/" replace />
  }
  if (tokenExigeTrocaSenha() && pathname !== TROCAR_SENHA_PATH) {
    return <Navigate to={TROCAR_SENHA_PATH} replace />
  }
  return <Outlet />
}
