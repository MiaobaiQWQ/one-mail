import { create } from 'zustand'
import type { MessageListQuery, MessageFilterTag } from '../../../shared/types'
import type { Message } from '@renderer/components/mail/shared/types'
import * as api from '../lib/api'

export interface MailboxStore {
  messages: Message[]
  selectedMessageId: string | null
  selectedMessageDetail: Message | null
  selectedMessageIds: Set<string>
  filters: MessageFilterTag[]
  searchKeyword: string
  messagePage: { loadingMore: boolean; hasMore: boolean; offset: number }
  actions: {
    loadMessages: (query: MessageListQuery) => Promise<void>
    selectMessage: (messageId: string | null) => Promise<void>
    loadMoreMessages: () => Promise<void>
    setFilters: (filters: MessageFilterTag[]) => void
    setSearchKeyword: (keyword: string) => void
    toggleMessageSelection: (messageId: string) => void
    clearMessageSelection: () => void
  }
}

export const useMailboxStore = create<MailboxStore>((set, get) => ({
  messages: [],
  selectedMessageId: null,
  selectedMessageDetail: null,
  selectedMessageIds: new Set(),
  filters: [],
  searchKeyword: '',
  messagePage: { loadingMore: false, hasMore: true, offset: 0 },
  actions: {
    loadMessages: async (query: MessageListQuery) => {
      try {
        const result = await api.loadMessages(query)
        set({
          messages: result,
          messagePage: {
            loadingMore: false,
            hasMore: result.length === query.limit,
            offset: (query.offset || 0) + result.length
          }
        })
      } catch (err) {
        console.error('Failed to load messages:', err)
      }
    },
    selectMessage: async (messageId: string | null) => {
      set({ selectedMessageId: messageId })
      if (!messageId) {
        set({ selectedMessageDetail: null })
        return
      }
      try {
        const detail = await api.loadMessageDetail(Number(messageId))
        if (detail) {
          set({ selectedMessageDetail: detail })
        }
      } catch (err) {
        console.error('Failed to load message detail:', err)
      }
    },
    loadMoreMessages: async () => {
      const state = get()
      if (state.messagePage.loadingMore || !state.messagePage.hasMore) return

      set({ messagePage: { ...state.messagePage, loadingMore: true } })
      // Logic would go here to fetch more using offset and current query
    },
    setFilters: (filters: MessageFilterTag[]) => {
      set({ filters })
    },
    setSearchKeyword: (keyword: string) => {
      set({ searchKeyword: keyword })
    },
    toggleMessageSelection: (messageId: string) => {
      const state = get()
      const newSet = new Set(state.selectedMessageIds)
      if (newSet.has(messageId)) {
        newSet.delete(messageId)
      } else {
        newSet.add(messageId)
      }
      set({ selectedMessageIds: newSet })
    },
    clearMessageSelection: () => {
      set({ selectedMessageIds: new Set() })
    }
  }
}))
