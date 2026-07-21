import { useNotificationStore } from '../stores'
import { useCallback } from 'react'

export function useNotifications() {
  const notifications = useNotificationStore((state) => state.notifications)
  const actions = useNotificationStore((state) => state.actions)

  const showSuccess = useCallback((message: string, title?: string) => {
    actions.addNotification({ type: 'success', message, title })
  }, [actions])

  const showError = useCallback((message: string, title?: string) => {
    actions.addNotification({ type: 'error', message, title })
  }, [actions])

  const showInfo = useCallback((message: string, title?: string) => {
    actions.addNotification({ type: 'info', message, title })
  }, [actions])

  const showWarning = useCallback((message: string, title?: string) => {
    actions.addNotification({ type: 'warning', message, title })
  }, [actions])

  return {
    notifications,
    ...actions,
    showSuccess,
    showError,
    showInfo,
    showWarning
  }
}
