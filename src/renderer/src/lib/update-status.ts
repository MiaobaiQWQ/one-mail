import type { AppUpdateStatus } from '../../../shared/types'

export const ONEMAIL_RELEASES_URL = 'https://github.com/zhihui-hu/one-mail/releases'

export function hasAvailableUpdate(status: AppUpdateStatus | null): boolean {
  return (
    status?.state === 'available' ||
    status?.state === 'downloading' ||
    status?.state === 'downloaded'
  )
}
