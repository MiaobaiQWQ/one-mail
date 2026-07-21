import { getAccount } from '../db/repositories/account.repository'
import {
  getMessageDeleteTarget,
  markMessageDeleteError,
  markMessageRemoteDeleted,
  restoreMessageLocally,
  markMessageUserHidden,
  type MessageDeleteTarget
} from '../db/repositories/message.repository'
import { authenticateImapSession } from './imap-auth'
import { SimpleImapSession } from './imap-session'
import { detectSpecialFolderRole, findFolderByRole } from './special-folders'

export type MessageDeleteResult = {
  messageId: number
  accountId: number
  folderId: number
  action: 'permanent_delete' | 'local_hide' | 'restore' | 'trash'
  localOnly?: boolean
}

export type BulkDeleteOptions = {
  localOnly?: boolean
  mode?: 'permanent' | 'local_hide' | 'trash'
}

export type BulkDeleteFailure = {
  messageId: number
  error: string
}

export type BulkDeleteResult = {
  succeededMessageIds: number[]
  failedItems: BulkDeleteFailure[]
  deletedCount: number
  failedCount: number
}

export async function permanentlyDeleteMessage(messageId: number): Promise<MessageDeleteResult> {
  const target = requireDeleteTarget(messageId)

  const account = getAccount(target.accountId)
  if (!account) throw new Error(`Account not found: ${target.accountId}`)

  const client = await SimpleImapSession.connect(account, 'P')

  try {
    await authenticateImapSession(account, client)
    await client.selectMailbox(target.folderPath)
    await client.setDeletedFlag(target.uid, true)
    await client.expunge()
    markMessageRemoteDeleted(messageId)

    return {
      messageId,
      accountId: target.accountId,
      folderId: target.folderId,
      action: 'permanent_delete'
    }
  } catch (error) {
    markMessageDeleteError(messageId, getErrorMessage(error))
    throw error
  } finally {
    await client.logout().catch(() => undefined)
  }
}

export async function trashMessage(messageId: number): Promise<MessageDeleteResult> {
  const target = requireDeleteTarget(messageId)

  if (isTrashTarget(target)) {
    return permanentlyDeleteMessage(messageId)
  }

  const trashFolder = findFolderByRole(target.accountId, 'trash')
  if (!trashFolder) {
    return permanentlyDeleteMessage(messageId)
  }

  const account = getAccount(target.accountId)
  if (!account) throw new Error(`Account not found: ${target.accountId}`)

  const client = await SimpleImapSession.connect(account, 'P')

  try {
    await authenticateImapSession(account, client)
    const capabilities = await client.capability().catch(() => new Set<string>())
    await client.selectMailbox(target.folderPath)

    if (capabilities.has('MOVE')) {
      await client.uidMove(target.uid, trashFolder.path)
    } else {
      await client.uidCopy(target.uid, trashFolder.path)
      await client.setDeletedFlag(target.uid, true)
      await client.expunge()
    }
    markMessageRemoteDeleted(messageId)

    return {
      messageId,
      accountId: target.accountId,
      folderId: target.folderId,
      action: 'trash'
    }
  } catch (error) {
    markMessageDeleteError(messageId, getErrorMessage(error))
    throw error
  } finally {
    await client.logout().catch(() => undefined)
  }
}

export function hideMessageLocally(messageId: number): MessageDeleteResult {
  const target = requireDeleteTarget(messageId)
  markMessageUserHidden(messageId)

  return {
    messageId,
    accountId: target.accountId,
    folderId: target.folderId,
    action: 'local_hide'
  }
}

export async function restoreMessage(messageId: number): Promise<MessageDeleteResult> {
  const target = requireRestoreTarget(messageId)

  if (target.userHidden) {
    restoreMessageLocally(messageId)
    return {
      messageId,
      accountId: target.accountId,
      folderId: target.folderId,
      action: 'restore',
      localOnly: true
    }
  }

  if (!isTrashTarget(target)) {
    restoreMessageLocally(messageId)
    return {
      messageId,
      accountId: target.accountId,
      folderId: target.folderId,
      action: 'restore',
      localOnly: true
    }
  }

  const inbox = findFolderByRole(target.accountId, 'inbox')
  if (!inbox) throw new Error('未找到该账号的收件箱，无法恢复邮件。')

  const account = getAccount(target.accountId)
  if (!account) throw new Error(`Account not found: ${target.accountId}`)

  const client = await SimpleImapSession.connect(account, 'R')

  try {
    await authenticateImapSession(account, client)
    const capabilities = await client.capability().catch(() => new Set<string>())
    await client.selectMailbox(target.folderPath)

    if (capabilities.has('MOVE')) {
      await client.uidMove(target.uid, inbox.path)
    } else {
      await client.uidCopy(target.uid, inbox.path)
      await client.setDeletedFlag(target.uid, true)
      await client.expunge()
    }

    restoreMessageLocally(messageId)
    return {
      messageId,
      accountId: target.accountId,
      folderId: target.folderId,
      action: 'restore',
      localOnly: false
    }
  } catch (error) {
    markMessageDeleteError(messageId, getErrorMessage(error))
    throw error
  } finally {
    await client.logout().catch(() => undefined)
  }
}

export async function bulkDelete(
  messageIds: number[],
  options: BulkDeleteOptions = {}
): Promise<BulkDeleteResult> {
  const succeededMessageIds: number[] = []
  const failedItems: BulkDeleteFailure[] = []

  if (options.localOnly || options.mode === 'local_hide') {
    for (const messageId of uniqueMessageIds(messageIds)) {
      try {
        hideMessageLocally(messageId)
        succeededMessageIds.push(messageId)
      } catch (error) {
        failedItems.push({ messageId, error: getErrorMessage(error) })
      }
    }

    return toBulkResult(succeededMessageIds, failedItems)
  }

  const isTrashMode = options.mode === 'trash'

  const targets = uniqueMessageIds(messageIds).map((messageId) => ({
    messageId,
    target: getMessageDeleteTarget(messageId)
  }))
  const groups = groupTargets(targets.filter(hasDeleteTarget).map(({ target }) => target))

  for (const { messageId, target } of targets) {
    if (!target) {
      failedItems.push({ messageId, error: '邮件不存在。' })
    }
  }

  for (const group of groups) {
    const account = getAccount(group.accountId)
    if (!account) {
      for (const target of group.targets) {
        failedItems.push({
          messageId: target.messageId,
          error: `Account not found: ${group.accountId}`
        })
      }
      continue
    }

    const trashFolder = isTrashMode ? findFolderByRole(group.accountId, 'trash') : null
    const shouldMoveToTrash = isTrashMode && trashFolder && !isTrashTarget(group.targets[0])

    const client = await SimpleImapSession.connect(account, 'X')

    try {
      await authenticateImapSession(account, client)
      const capabilities = await client.capability().catch(() => new Set<string>())
      await client.selectMailbox(group.folderPath)

      for (const target of group.targets) {
        try {
          if (shouldMoveToTrash) {
            if (capabilities.has('MOVE')) {
              await client.uidMove(target.uid, trashFolder.path)
            } else {
              await client.uidCopy(target.uid, trashFolder.path)
              await client.setDeletedFlag(target.uid, true)
              await client.expunge()
            }
          } else {
            await client.setDeletedFlag(target.uid, true)
            await client.expunge()
          }
          markMessageRemoteDeleted(target.messageId)

          succeededMessageIds.push(target.messageId)
        } catch (error) {
          const message = getErrorMessage(error)
          markMessageDeleteError(target.messageId, message)
          failedItems.push({ messageId: target.messageId, error: message })
        }
      }
    } catch (error) {
      const message = getErrorMessage(error)
      for (const target of group.targets) {
        markMessageDeleteError(target.messageId, message)
        failedItems.push({ messageId: target.messageId, error: message })
      }
    } finally {
      await client.logout().catch(() => undefined)
    }
  }

  return toBulkResult(succeededMessageIds, failedItems)
}

function requireDeleteTarget(messageId: number): MessageDeleteTarget {
  const target = getMessageDeleteTarget(messageId)
  if (!target) throw new Error('邮件不存在。')
  if (target.remoteDeleted) throw new Error('邮件已从远端删除。')
  return target
}

function requireRestoreTarget(messageId: number): MessageDeleteTarget {
  const target = getMessageDeleteTarget(messageId)
  if (!target) throw new Error('邮件不存在。')
  if (target.remoteDeleted) throw new Error('邮件已从远端删除，无法恢复。')
  return target
}

function isTrashTarget(target: MessageDeleteTarget): boolean {
  return target.folderRole === 'trash' || detectSpecialFolderRole(target.folderPath) === 'trash'
}

function groupTargets(targets: MessageDeleteTarget[]): Array<{
  accountId: number
  folderId: number
  folderPath: string
  targets: MessageDeleteTarget[]
}> {
  const groups = new Map<
    string,
    {
      accountId: number
      folderId: number
      folderPath: string
      targets: MessageDeleteTarget[]
    }
  >()

  for (const target of targets) {
    const key = `${target.accountId}:${target.folderId}`
    const group = groups.get(key) ?? {
      accountId: target.accountId,
      folderId: target.folderId,
      folderPath: target.folderPath,
      targets: []
    }
    group.targets.push(target)
    groups.set(key, group)
  }

  return Array.from(groups.values())
}

function hasDeleteTarget(item: {
  messageId: number
  target: MessageDeleteTarget | null
}): item is { messageId: number; target: MessageDeleteTarget } {
  return item.target !== null
}

function uniqueMessageIds(messageIds: number[]): number[] {
  return Array.from(
    new Set(messageIds.filter((messageId) => Number.isInteger(messageId) && messageId > 0))
  )
}

function toBulkResult(
  succeededMessageIds: number[],
  failedItems: BulkDeleteFailure[]
): BulkDeleteResult {
  return {
    succeededMessageIds,
    failedItems,
    deletedCount: succeededMessageIds.length,
    failedCount: failedItems.length
  }
}

function getErrorMessage(error: unknown): string {
  return error instanceof Error ? error.message : '删除邮件失败。'
}
