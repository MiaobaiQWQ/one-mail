import { create } from 'zustand'

export interface NotificationItem {
  id: string
  type: 'info' | 'success' | 'warning' | 'error'
  title?: string
  message: string
}

export interface NotificationStore {
  notifications: NotificationItem[]
  actions: {
    addNotification: (notification: Omit<NotificationItem, 'id'>) => void
    removeNotification: (id: string) => void
  }
}

export const useNotificationStore = create<NotificationStore>((set) => ({
  notifications: [],
  actions: {
    addNotification: (notification) => {
      const id = Math.random().toString(36).substring(2, 9)
      set((state) => ({
        notifications: [...state.notifications, { ...notification, id }]
      }))
    },
    removeNotification: (id) => {
      set((state) => ({
        notifications: state.notifications.filter((n) => n.id !== id)
      }))
    }
  }
}))
