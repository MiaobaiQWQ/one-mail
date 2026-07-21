import type {
  AttachmentDownloadResult,
  ComposeDraft as SharedComposeDraft,
  MailAddressInput,
  MailAttachmentInput,
  MailMessageDetail,
  MailMessageBody,
  MailMessageSummary,
  MailSendInput,
  MessageBulkReadStateResult,
  MessageReadStateUpdate,
  MessageFilterTag,
  MessageListQuery,
  MailboxChangedEvent,
  OutboxMessage as SharedOutboxMessage,
  AppSettings,
  SystemInfo
} from '../../../../shared/types'
import { normalizeMailBodyText, normalizeMailDisplayText } from '../../../../shared/mail-text'
import { ATTACHMENT_METADATA_PENDING_SIZE } from '@renderer/components/mail/reader/mail-display'
import type { Account, Message, MessageFolderRole } from '@renderer/components/mail/shared/types'
import { toAccountList, getDefaultSelectedAccountId } from './accounts'

export const MESSAGE_LIST_PAGE_SIZE = 100

export type ComposeKind = 'new' | 'reply' | 'reply_all' | 'forward'

export type ComposeDraftInput = {
  kind: ComposeKind
  accountId: number
  relatedMessageId?: number
}

export type ComposeDraft = {
  draftId?: number
  kind: ComposeKind
  accountId: number
  relatedMessageId?: number
  to: string[]
  cc: string[]
  bcc: string[]
  subject: string
  bodyText: string
  bodyHtml?: string
  attachments?: MailAttachmentInput[]
  forwardAttachments?: MailAttachmentInput[]
  inReplyTo?: string
  references?: string
}

export type SendMessageInput = {
  draftId?: number
  kind: ComposeKind
  accountId: number
  relatedMessageId?: number
  to: string[]
  cc?: string[]
  bcc?: string[]
  subject: string
  bodyText: string
  bodyHtml?: string
  attachments?: MailAttachmentInput[]
  attachmentPaths?: string[]
  inReplyTo?: string
  references?: string
}

export type SendMessageResult = {
  sent: boolean
  messageId?: string
  outboxId?: number
  warning?: string
}

export type DeleteMessageInput = {
  messageId: number
  permanent?: boolean
}

export type DeleteMessageResult = {
  messageId: number
  deleted: boolean
  permanent?: boolean
  hidden?: boolean
  error?: string
}

export type BulkDeleteMessagesInput = {
  messageIds: number[]
  permanent?: boolean
}

export type BulkDeleteMessagesResult = {
  succeededMessageIds: number[]
  failedItems: Array<{ messageId: number; error: string }>
  deletedCount: number
  failedCount: number
}

export type HideMessageResult = {
  messageId: number
  hidden: boolean
}

export type RestoreMessageResult = {
  messageId: number
  restored: boolean
}

export type OutboxMessage = {
  outboxId: number
  kind: ComposeKind
  accountId: number
  relatedMessageId?: number
  status: SharedOutboxMessage['status']
  to: string[]
  cc: string[]
  bcc: string[]
  subject: string
  bodyText: string
  bodyHtml?: string
  attachments: MailAttachmentInput[]
  inReplyTo?: string
  references?: string
  lastError?: string
  lastWarning?: string
  updatedAt: string
}

export async function loadInitialData(): Promise<{
  accounts: Account[]
  messages: Message[]
  settings: AppSettings
  systemInfo: SystemInfo
  selectedAccountId: string
}> {
  const [mailAccounts, accountStats, settings, systemInfo] = await Promise.all([
    window.api.accounts.list(),
    window.api.messages.stats(),
    window.api.settings.get(),
    window.api.system.info()
  ])
  const accounts = toAccountList(mailAccounts, accountStats)
  const selectedAccountId = getDefaultSelectedAccountId(accounts)
  const messages = selectedAccountId
    ? await window.api.messages.list(
        toMessageQuery(selectedAccountId, [], { limit: MESSAGE_LIST_PAGE_SIZE, offset: 0 })
      )
    : []

  return {
    accounts,
    messages: messages.map(toMessage),
    settings,
    systemInfo,
    selectedAccountId
  }
}

export function onMailboxChanged(callback: (event: MailboxChangedEvent) => void): () => void {
  const onChanged = window.api?.sync?.onMailboxChanged
  if (typeof onChanged !== 'function') return () => {}

  return onChanged(callback)
}

export async function loadMessages(query: MessageListQuery): Promise<Message[]> {
  const messages = await window.api.messages.list(query)
  return messages.map(toMessage)
}

export async function loadMessageDetail(messageId: number): Promise<Message | null> {
  const message = await window.api.messages.get(messageId)
  return message ? toMessage(message) : null
}

export async function loadMessageBody(message: Message): Promise<Message> {
  const result = await window.api.messages.loadBody(message.messageId)
  if (!result.body) {
    return {
      ...message,
      bodyStatus: result.error ? 'error' : message.bodyStatus
    }
  }

  const detail = await window.api.messages.get(message.messageId)
  if (detail) return toMessage(detail)

  return mergeMessageBody(message, result.body)
}

export async function setMessageReadState(
  messageId: number,
  isRead: boolean
): Promise<MessageReadStateUpdate> {
  if (typeof window.api.messages.setReadState === 'function') {
    return window.api.messages.setReadState(messageId, isRead)
  }

  return window.electron.ipcRenderer.invoke(
    'messages/setReadState',
    messageId,
    isRead
  ) as Promise<MessageReadStateUpdate>
}

export async function bulkSetMessageReadState(
  messageIds: number[],
  isRead: boolean
): Promise<MessageBulkReadStateResult> {
  return window.api.messages.bulkSetReadState({ messageIds, isRead })
}

export async function markAllMessagesRead(
  query: MessageListQuery
): Promise<MessageBulkReadStateResult> {
  return window.api.messages.markAllRead({ query })
}

export async function downloadAttachment(attachmentId: number): Promise<AttachmentDownloadResult> {
  return window.api.messages.downloadAttachment(attachmentId)
}

export async function createComposeDraft(input: ComposeDraftInput): Promise<ComposeDraft> {
  const compose = window.api.compose
  if (input.kind === 'reply' || input.kind === 'reply_all') {
    return toUiComposeDraft(
      await compose.createReplyDraft({
        messageId: requireRelatedMessageId(input),
        mode: input.kind
      })
    )
  }

  if (input.kind === 'forward') {
    return toUiComposeDraft(
      await compose.createForwardDraft({
        messageId: requireRelatedMessageId(input)
      })
    )
  }

  return createLocalDraft(input)
}

export async function sendComposedMessage(input: SendMessageInput): Promise<SendMessageResult> {
  const result = await window.api.compose.send(toSharedSendInput(input))
  return {
    sent: result.status === 'sent',
    messageId: result.rfc822MessageId,
    outboxId: result.outboxId,
    warning: result.warning ?? result.error
  }
}

export async function selectMailAttachments(): Promise<MailAttachmentInput[]> {
  return window.api.compose.selectAttachments()
}

export async function saveComposedDraft(input: SendMessageInput): Promise<OutboxMessage> {
  return toUiOutboxMessage(await window.api.compose.saveDraft(toSharedSendInput(input)))
}

export async function loadOutboxMessages(): Promise<OutboxMessage[]> {
  const messages = await window.api.compose.listOutbox({
    statuses: ['draft', 'failed', 'sending'],
    limit: 100
  })
  return messages.map(toUiOutboxMessage)
}

export async function retryOutboxMessage(outboxId: number): Promise<SendMessageResult> {
  const result = await window.api.compose.retry(outboxId)
  return {
    sent: result.status === 'sent',
    messageId: result.rfc822MessageId,
    outboxId: result.outboxId,
    warning: result.warning ?? result.error
  }
}

export async function deleteOutboxMessage(outboxId: number): Promise<boolean> {
  return window.api.compose.deleteOutbox(outboxId)
}

export async function deleteDraftMessage(outboxId: number): Promise<boolean> {
  return window.api.compose.deleteDraft(outboxId)
}

export async function deleteMessage(input: DeleteMessageInput): Promise<DeleteMessageResult> {
  const result = await window.api.messages.delete({
    messageId: input.messageId,
    mode: 'permanent'
  })
  return {
    messageId: result.messageId,
    deleted: result.deleted,
    permanent: result.mode === 'permanent',
    hidden: result.mode === 'local_hide',
    error: result.error
  }
}

export async function bulkDeleteMessages(
  input: BulkDeleteMessagesInput
): Promise<BulkDeleteMessagesResult> {
  return window.api.messages.bulkDelete({
    messageIds: input.messageIds,
    mode: 'permanent'
  })
}

export async function hideMessage(messageId: number): Promise<HideMessageResult> {
  const result = await window.api.messages.hideLocal(messageId)
  return {
    messageId: result.messageId,
    hidden: result.deleted || result.localOnly
  }
}

export async function restoreMessage(messageId: number): Promise<RestoreMessageResult> {
  const result = await window.api.messages.restore(messageId)
  return {
    messageId: result.messageId,
    restored: result.restored
  }
}

function toMessage(message: MailMessageSummary | MailMessageDetail): Message {
  const detailLoaded = 'attachments' in message
  const body = detailLoaded ? message.body : undefined
  const fromName = normalizeMailDisplayText(message.fromName)
  const fromEmail = normalizeMailDisplayText(message.fromEmail)
  const subject = normalizeMailDisplayText(message.subject) ?? ''
  const snippet = normalizeMailDisplayText(message.snippet) ?? ''
  const bodyText = normalizeMailBodyText(body?.bodyText)

  return {
    id: String(message.messageId),
    messageId: message.messageId,
    accountId: message.accountId,
    folderId: message.folderId,
    folderRole: readOptionalString(message, 'folderRole') as MessageFolderRole | undefined,
    folderName: readOptionalString(message, 'folderName'),
    from: fromName ?? fromEmail ?? '',
    fromAddress: fromEmail,
    to: normalizeMailDisplayText(readOptionalString(message, 'to')),
    cc: normalizeMailDisplayText(readOptionalString(message, 'cc')),
    replyTo: normalizeMailDisplayText(readOptionalString(message, 'replyTo')),
    messageRfc822Id: normalizeMailDisplayText(readOptionalString(message, 'messageRfc822Id')),
    references: normalizeMailDisplayText(readOptionalString(message, 'references')),
    subject,
    preview: snippet,
    verificationCode: normalizeMailDisplayText(message.verificationCode),
    body: bodyTextToParagraphs(bodyText),
    html: body?.bodyHtmlSanitized,
    bodyStatus: message.bodyStatus,
    bodyLoaded: detailLoaded && message.bodyStatus === 'ready',
    detailLoaded,
    externalImagesBlocked: body?.externalImagesBlocked,
    receivedAt: message.receivedAt,
    time: formatMessageTime(message.receivedAt),
    dateLabel: formatMessageDate(message.receivedAt),
    unread: !message.isRead,
    starred: message.isStarred,
    attachments:
      'attachments' in message
        ? message.attachments
            .filter((attachment) => attachment.filename.trim() && attachment.sizeBytes > 0)
            .map((attachment) => ({
              id: attachment.attachmentId,
              name: normalizeMailDisplayText(attachment.filename) ?? attachment.filename,
              size: formatBytes(attachment.sizeBytes),
              type: attachment.mimeType ?? '',
              disposition: attachment.contentDisposition
            }))
        : message.hasAttachments
          ? [{ name: '', size: ATTACHMENT_METADATA_PENDING_SIZE, type: '' }]
          : []
  }
}

function createLocalDraft(input: ComposeDraftInput): ComposeDraft {
  return {
    kind: input.kind,
    accountId: input.accountId,
    relatedMessageId: input.relatedMessageId,
    to: [],
    cc: [],
    bcc: [],
    subject: '',
    bodyText: '',
    bodyHtml: undefined
  }
}

export function toUiComposeDraft(draft: SharedComposeDraft): ComposeDraft {
  return {
    kind: draft.mode,
    accountId: draft.accountId,
    relatedMessageId: draft.relatedMessageId,
    to: draft.to.map(formatAddressInput),
    cc: draft.cc.map(formatAddressInput),
    bcc: draft.bcc.map(formatAddressInput),
    subject: draft.subject ?? '',
    bodyText: draft.bodyText ?? '',
    bodyHtml: draft.bodyHtml,
    forwardAttachments: draft.forwardAttachments?.map((attachment) => ({
      sourceMessageId: draft.relatedMessageId,
      sourceAttachmentId: attachment.attachmentId,
      filename: attachment.filename,
      mimeType: attachment.mimeType,
      sizeBytes: attachment.sizeBytes
    })),
    inReplyTo: draft.inReplyTo,
    references: draft.referencesHeader
  }
}

function toUiOutboxMessage(message: SharedOutboxMessage): OutboxMessage {
  return {
    outboxId: message.outboxId,
    kind: message.composeKind,
    accountId: message.accountId,
    relatedMessageId: message.relatedMessageId,
    status: message.status,
    to: message.to.map(formatAddressInput),
    cc: message.cc.map(formatAddressInput),
    bcc: message.bcc.map(formatAddressInput),
    subject: message.subject ?? '',
    bodyText: message.bodyText ?? '',
    bodyHtml: message.bodyHtml,
    attachments: message.attachments ?? [],
    inReplyTo: message.inReplyTo,
    references: message.referencesHeader,
    lastError: message.lastError,
    lastWarning: message.lastWarning,
    updatedAt: message.updatedAt
  }
}

export function toSharedSendInput(input: SendMessageInput): MailSendInput {
  return {
    outboxId: input.draftId,
    accountId: input.accountId,
    mode: input.kind,
    relatedMessageId: input.relatedMessageId,
    to: input.to.map(parseAddressInput),
    cc: input.cc?.map(parseAddressInput),
    bcc: input.bcc?.map(parseAddressInput),
    subject: input.subject,
    bodyText: input.bodyText,
    bodyHtml: input.bodyHtml,
    inReplyTo: input.inReplyTo,
    referencesHeader: input.references,
    attachments: input.attachments ?? input.attachmentPaths?.map((filePath) => ({ filePath }))
  }
}

function requireRelatedMessageId(input: ComposeDraftInput): number {
  if (!input.relatedMessageId) {
    throw new Error('Missing source message for reply or forward draft.')
  }

  return input.relatedMessageId
}

function formatAddressInput(address: MailAddressInput): string {
  return address.name ? `${address.name} <${address.email}>` : address.email
}

function parseAddressInput(value: string): MailAddressInput {
  const trimmed = value.trim()
  const match = /^(.*?)<([^<>]+)>$/.exec(trimmed)
  if (!match) return { email: trimmed }

  return {
    name: match[1].trim() || undefined,
    email: match[2].trim()
  }
}

function readOptionalString(source: unknown, key: string): string | undefined {
  if (!source || typeof source !== 'object') return undefined
  const value = (source as Record<string, unknown>)[key]
  return typeof value === 'string' ? value : undefined
}

function mergeMessageBody(message: Message, body: MailMessageBody): Message {
  const bodyText = normalizeMailBodyText(body.bodyText)

  return {
    ...message,
    body: bodyTextToParagraphs(bodyText),
    html: body.bodyHtmlSanitized,
    bodyStatus: 'ready',
    bodyLoaded: true,
    detailLoaded: true,
    externalImagesBlocked: body.externalImagesBlocked
  }
}

function bodyTextToParagraphs(value?: string): string[] {
  if (!value) return []
  return value
    .split(/\n{2,}/)
    .map((paragraph) => paragraph.trim())
    .filter(Boolean)
}

function formatBytes(value: number): string {
  if (!value) return ''
  if (value < 1024) return `${value} B`
  if (value < 1024 * 1024) return `${(value / 1024).toFixed(1)} KB`
  return `${(value / 1024 / 1024).toFixed(1)} MB`
}

function formatMessageTime(value?: string): string {
  if (!value) return '--:--'
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return '--:--'

  return new Intl.DateTimeFormat(undefined, {
    hour: '2-digit',
    minute: '2-digit'
  }).format(date)
}

function formatMessageDate(value?: string): string {
  if (!value) return ''
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return ''

  const today = new Date()
  if (date.toDateString() === today.toDateString()) return ''

  return new Intl.DateTimeFormat(undefined, {
    month: 'short',
    day: 'numeric'
  }).format(date)
}

export function toMessageQuery(
  selectedAccountId: string,
  filters: MessageFilterTag[],
  pagination?: Pick<MessageListQuery, 'limit' | 'offset'>,
  searchKeyword?: string
): MessageListQuery {
  const keyword = searchKeyword?.trim()

  return {
    accountId: selectedAccountId === 'all' ? undefined : Number(selectedAccountId),
    filters,
    keyword: keyword || undefined,
    limit: pagination?.limit ?? MESSAGE_LIST_PAGE_SIZE,
    offset: pagination?.offset ?? 0
  }
}
