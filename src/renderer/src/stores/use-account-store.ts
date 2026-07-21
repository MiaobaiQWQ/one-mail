import { create } from 'zustand'
import type { Account } from '@renderer/components/mail/shared/types'
import * as api from '../lib/api'

export interface AccountStore {
  accounts: Account[]
  selectedAccountId: string | null
  loading: boolean
  error: string | null
  actions: {
    loadAccounts: () => Promise<void>
    selectAccount: (accountId: string) => void
    refreshAccount: (accountId: number) => Promise<void>
  }
}

export const useAccountStore = create<AccountStore>((set) => ({
  accounts: [],
  selectedAccountId: null,
  loading: false,
  error: null,
  actions: {
    loadAccounts: async () => {
      set({ loading: true, error: null })
      try {
        const accounts = await api.loadAccounts()
        set({ accounts, loading: false })
      } catch (err) {
        set({ error: err instanceof Error ? err.message : String(err), loading: false })
      }
    },
    selectAccount: (accountId: string) => {
      set({ selectedAccountId: accountId })
    },
    refreshAccount: async (accountId: number) => {
      try {
        await api.syncAccount(accountId, 'refresh')
      } catch (err) {
        console.error('Failed to refresh account:', err)
      }
    }
  }
}))
