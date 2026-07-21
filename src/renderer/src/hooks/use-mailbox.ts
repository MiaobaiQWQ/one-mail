import { useMailboxStore } from '../stores'
import { useCallback } from 'react'

export function useMailbox() {
  const messages = useMailboxStore((state) => state.messages)
  const selectedMessageId = useMailboxStore((state) => state.selectedMessageId)
  const selectedMessageDetail = useMailboxStore((state) => state.selectedMessageDetail)
  const selectedMessageIds = useMailboxStore((state) => state.selectedMessageIds)
  const filters = useMailboxStore((state) => state.filters)
  const searchKeyword = useMailboxStore((state) => state.searchKeyword)
  const messagePage = useMailboxStore((state) => state.messagePage)
  const actions = useMailboxStore((state) => state.actions)

  const isMessageSelected = useCallback(
    (id: string) => selectedMessageIds.has(id),
    [selectedMessageIds]
  )

  return {
    messages,
    selectedMessageId,
    selectedMessageDetail,
    selectedMessageIds,
    filters,
    searchKeyword,
    messagePage,
    ...actions,
    isMessageSelected
  }
}
