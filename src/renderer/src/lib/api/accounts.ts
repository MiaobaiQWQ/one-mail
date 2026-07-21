import type {
  AccountMailboxStats,
  AccountSyncRunResult,
  AccountCreatedEvent,
  AccountCreateInput,
  AccountUpdateInput,
  MailAccount,
  SyncMode,
  SyncStatus
} from '../../../../shared/types'
import type { Account } from '@renderer/components/mail/shared/types'
import { getStaticTranslation } from './common'

export async function createAccount(input: AccountCreateInput): Promise<MailAccount> {
  return window.api.accounts.create(input)
}

export async function openAddAccountWindow(): Promise<boolean> {
  return window.api.accounts.openAddWindow()
}

export function onAccountCreated(callback: (event: AccountCreatedEvent) => void): () => void {
  const onCreated = window.api?.accounts?.onCreated
  if (typeof onCreated !== 'function') return () => {}

  return onCreated(callback)
}

export async function updateAccount(input: AccountUpdateInput): Promise<MailAccount> {
  return window.api.accounts.update(input)
}

export async function reauthorizeAccount(accountId: number): Promise<MailAccount> {
  return window.api.accounts.reauthorize(accountId)
}

export async function removeAccount(accountId: number): Promise<boolean> {
  return window.api.accounts.remove(accountId)
}

export async function syncAccount(
  accountId: number,
  mode: SyncMode = 'refresh'
): Promise<AccountSyncRunResult> {
  const startAccount = window.api?.sync?.startAccount
  if (typeof startAccount !== 'function') {
    throw new Error(getStaticTranslation('sync.serviceUnavailable'))
  }

  return startAccount(accountId, mode)
}

export async function syncAllAccounts(mode: SyncMode = 'refresh'): Promise<SyncStatus> {
  const startAll = window.api?.sync?.startAll
  if (typeof startAll !== 'function') {
    throw new Error(getStaticTranslation('sync.serviceUnavailable'))
  }

  return startAll(mode)
}

export async function loadAccounts(): Promise<Account[]> {
  const [accounts, accountStats] = await Promise.all([
    window.api.accounts.list(),
    window.api.messages.stats()
  ])

  return toAccountList(accounts, accountStats)
}

export function toAccountList(accounts: MailAccount[], accountStats: AccountMailboxStats[]): Account[] {
  const statsByAccount = new Map(accountStats.map((stats) => [stats.accountId, stats]))
  const totalUnread = accountStats.reduce((sum, stats) => sum + stats.unreadCount, 0)
  const totalMessages = accountStats.reduce((sum, stats) => sum + stats.totalCount, 0)

  const accountItems = accounts.map((account) => {
    const stats = statsByAccount.get(account.accountId)

    return {
      id: String(account.accountId),
      accountId: account.accountId,
      providerKey: account.providerKey,
      authType: account.authType,
      name: formatAccountName(account),
      address: account.email,
      unread: stats?.unreadCount ?? 0,
      messageCount: stats?.totalCount ?? 0,
      credentialState: account.credentialState,
      status: account.status,
      lastError: account.lastError,
      accent: account.syncEnabled ? 'bg-muted-foreground' : 'bg-muted'
    }
  })

  if (accounts.length <= 2) {
    return accountItems
  }

  return [
    {
      id: 'all',
      providerKey: 'all',
      authType: 'manual',
      name: '',
      address: '',
      unread: totalUnread,
      messageCount: totalMessages,
      status: accounts.length > 0 ? 'active' : 'empty',
      accent: 'bg-primary'
    },
    ...accountItems
  ]
}

export function getDefaultSelectedAccountId(accounts: Account[]): string {
  return accounts.find((account) => account.id === 'all')?.id ?? accounts[0]?.id ?? ''
}

function formatAccountName(account: MailAccount): string {
  const label = account.accountLabel?.trim()
  if (!label || label === account.email) return account.email
  return `${label}(${account.email})`
}
