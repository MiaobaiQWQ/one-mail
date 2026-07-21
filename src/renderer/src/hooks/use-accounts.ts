import { useAccountStore } from '../stores'
import { useCallback } from 'react'

export function useAccounts() {
  const accounts = useAccountStore((state) => state.accounts)
  const selectedAccountId = useAccountStore((state) => state.selectedAccountId)
  const loading = useAccountStore((state) => state.loading)
  const error = useAccountStore((state) => state.error)
  const actions = useAccountStore((state) => state.actions)

  const getAccount = useCallback(
    (id: string) => accounts.find((a) => a.id.toString() === id),
    [accounts]
  )

  return {
    accounts,
    selectedAccountId,
    selectedAccount: selectedAccountId ? getAccount(selectedAccountId) : null,
    loading,
    error,
    ...actions,
    getAccount
  }
}
