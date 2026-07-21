import { BrowserWindow, Notification, nativeImage, type NativeImage } from 'electron'
import appIcon from '../../../resources/icon.png?asset'
import { getProviderLogoMetadata } from '../../shared/provider-metadata'
import { getAccount } from '../db/repositories/account.repository'
import { listRecentNotificationMessages } from '../db/repositories/message.repository'
import { getSettings } from '../db/repositories/settings.repository'
import { getLogoDataUrl } from '../ipc/logos'
import type {
  MailAccount,
  MailboxChangedEvent,
  NewMailNotification,
  NewMailNotificationMessage,
  NotificationStatus
} from '../ipc/types'

let openWindowHandler: ((route: string) => BrowserWindow | null) | null = null

export function getNotificationStatus(): NotificationStatus {
  return {
    desktopSupported: Notification.isSupported()
  }
}

export async function testNotification(): Promise<boolean> {
  try {
    const settings = await getSettings()
    const soundSetting = settings?.notificationSound || 'default'
    const silent = soundSetting === 'silent'
    const locale = settings?.locale || 'zh-CN'
    const isEn = locale === 'en-US'

    const title = isEn ? 'OneMail Test Notification' : 'OneMail 测试通知'
    const body = isEn
      ? 'You have 5 new emails from John, Alice, and others'
      : '您有 5 封新邮件，来自 张三、李四 等'

    if (process.platform === 'win32') {
      const desktopNotification = new Notification({
        title,
        body,
        icon: appIcon,
        silent: silent
      })

      desktopNotification.on('show', () => {
        console.log('Test notification shown (Win32)')
      })

      desktopNotification.on('failed', (err) => {
        console.error('Test notification failed (Win32):', err)
      })

      desktopNotification.show()
      return true
    }

    if (!Notification.isSupported()) {
      console.log('Notification is not supported')
      return false
    }

    const desktopNotification = new Notification({
      title,
      body,
      icon: appIcon,
      silent: silent
    })

    desktopNotification.on('show', () => {
      console.log('Test notification shown')
    })

    desktopNotification.on('failed', (err) => {
      console.error('Test notification failed:', err)
    })

    desktopNotification.show()
    return true
  } catch (err) {
    console.error('Error in testNotification:', err)
    return false
  }
}

export function setNotificationOpenWindowHandler(
  handler: (route: string) => BrowserWindow | null
): void {
  openWindowHandler = handler
}

export async function notifyNewMail({
  accountId,
  messageCount,
  reason
}: {
  accountId: number
  messageCount: number
  reason: MailboxChangedEvent['reason']
}): Promise<void> {
  if (messageCount <= 0) return

  const settings = await getSettings()
  if (!settings?.notificationsEnabled) return

  const account = getAccount(accountId)
  const messages = listRecentNotificationMessages(accountId, messageCount)
  const notification: NewMailNotification = {
    notificationId: `${accountId}-${Date.now()}`,
    accountId,
    accountEmail: account?.email,
    accountLabel: account?.accountLabel,
    reason,
    messageCount,
    messages,
    notifiedAt: new Date().toISOString()
  }

  // We play sound through HTML5 audio in renderer now, so don't play here
  broadcastNewMail(notification)
  void showDesktopNotifications(notification, account, settings)
}

function broadcastNewMail(notification: NewMailNotification): void {
  for (const window of BrowserWindow.getAllWindows()) {
    if (!window.isDestroyed()) {
      window.webContents.send('notifications/newMail', notification)
    }
  }
}

async function showDesktopNotifications(
  notification: NewMailNotification,
  account: MailAccount | null,
  settings: any
): Promise<void> {
  if (!Notification.isSupported()) return

  let icon: string | NativeImage = appIcon
  // Respect privacy settings for icons
  if (settings?.privacyMode !== 'strict') {
    icon = await getNotificationIcon(account, notification)
  }

  const soundSetting = settings?.notificationSound || 'default'
  const silent = soundSetting === 'silent'
  const locale = settings?.locale || 'zh-CN'

  if (notification.messageCount > 1) {
    showAggregatedNotification(notification, icon, silent, locale)
  } else {
    const messages = notification.messages.length > 0 ? notification.messages : [undefined]
    for (const message of messages) {
      showDesktopNotification(notification, message, icon, silent, locale)
    }
  }
}

function showAggregatedNotification(
  notification: NewMailNotification,
  icon: string | NativeImage,
  silent: boolean,
  locale: string
): void {
  const accountName = notification.accountLabel || notification.accountEmail || 'OneMail'

  const isEn = locale === 'en-US'
  const title = isEn
    ? `${accountName}: ${notification.messageCount} new emails`
    : `${accountName} 收到 ${notification.messageCount} 封新邮件`

  const senders = Array.from(
    new Set(notification.messages.map((m) => m.fromName || m.fromEmail).filter(Boolean))
  )
  let body = isEn
    ? `From: ${senders.slice(0, 3).join(', ')}`
    : `发件人: ${senders.slice(0, 3).join(', ')}`
  if (senders.length > 3) {
    body += isEn ? ' and others' : ' 等'
  }
  if (senders.length === 0) {
    body = isEn ? 'Check your new emails' : '点击查看新邮件'
  }

  if (process.platform === 'win32') {
    const desktopNotification = new Notification({
      title,
      body,
      icon,
      silent: silent
    })
    desktopNotification.on('click', () => {
      openNotificationTarget(notification, undefined)
    })
    desktopNotification.show()
    return
  }

  const desktopNotification = new Notification({
    title,
    body,
    icon,
    silent: silent
  })

  desktopNotification.on('click', () => {
    openNotificationTarget(notification, undefined)
  })
  desktopNotification.show()
}

function showDesktopNotification(
  notification: NewMailNotification,
  message: NewMailNotificationMessage | undefined,
  icon: string | NativeImage,
  silent: boolean,
  locale: string = 'zh-CN'
): void {
  const isEn = locale === 'en-US'
  const sender = message?.fromName ?? message?.fromEmail ?? notification.accountLabel
  const verificationCode = message?.verificationCode

  const defaultTitle = isEn ? 'New Mail' : '收到新邮件'
  const title = message?.subject || defaultTitle

  let bodyStr = ''
  if (verificationCode) {
    bodyStr = isEn ? `Code ${verificationCode}` : `验证码 ${verificationCode}`
  } else if (message?.snippet) {
    bodyStr = message.snippet
  }

  const body =
    [sender, bodyStr].filter(Boolean).join(' - ') ||
    notification.accountLabel ||
    notification.accountEmail ||
    'OneMail'

  if (process.platform === 'win32') {
    const desktopNotification = new Notification({
      title,
      body,
      icon,
      silent: silent
    })
    desktopNotification.on('click', () => {
      openNotificationTarget(notification, message)
    })
    desktopNotification.show()
    return
  }

  const desktopNotification = new Notification({
    title,
    body,
    icon,
    silent: silent
  })

  desktopNotification.on('click', () => {
    openNotificationTarget(notification, message)
  })
  desktopNotification.show()
}

function openNotificationTarget(
  notification: NewMailNotification,
  message?: NewMailNotificationMessage
): void {
  const route = toNotificationRoute(notification, message)

  const window = getOpenTargetWindow(route)
  if (!window) return

  if (window.isMinimized()) window.restore()
  if (!window.isVisible()) window.show()
  window.focus()
  navigateWindowToRoute(window, route)
}

function getOpenTargetWindow(route: string): BrowserWindow | null {
  const handledWindow = openWindowHandler?.(route)
  if (handledWindow && !handledWindow.isDestroyed()) return handledWindow

  return BrowserWindow.getAllWindows().find((window) => !window.isDestroyed()) ?? null
}

function toNotificationRoute(
  notification: NewMailNotification,
  message?: NewMailNotificationMessage
): string {
  const messageId = message?.messageId ?? getNotificationDisplayMessage(notification)?.messageId
  return messageId ? `/${notification.accountId}/${messageId}` : '/'
}

function navigateWindowToRoute(window: BrowserWindow, route: string): void {
  if (window.isDestroyed()) return

  if (window.webContents.isLoading()) {
    window.webContents.once('did-finish-load', () => navigateWindowToRoute(window, route))
    return
  }

  void window.webContents
    .executeJavaScript(`window.location.hash = ${JSON.stringify(route)}`)
    .catch(() => undefined)
}

function getNotificationDisplayMessage(
  notification: NewMailNotification
): NewMailNotificationMessage | undefined {
  return (
    notification.messages.find((message) => message.verificationCode) ?? notification.messages[0]
  )
}

async function getNotificationIcon(
  account: MailAccount | null,
  notification: NewMailNotification
): Promise<string | NativeImage> {
  const domain = getProviderLogoDomain(account, notification)
  const logo = domain ? await getLogoDataUrl(domain) : null
  if (!logo) return appIcon

  const image = nativeImage.createFromDataURL(logo)
  return image.isEmpty() ? appIcon : image
}

function getProviderLogoDomain(
  account: MailAccount | null,
  notification: NewMailNotification
): string {
  const address = account?.email ?? notification.accountEmail ?? ''
  return getProviderLogoMetadata(account?.providerKey, address).domain
}
