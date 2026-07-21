import * as React from 'react'
import { X } from 'lucide-react'

import { Button } from '@renderer/components/ui/button'
import { Input } from '@renderer/components/ui/input'
import { useI18n } from '@renderer/lib/i18n'
import { cn } from '@renderer/lib/utils'

import { Popover, PopoverContent, PopoverTrigger } from '@renderer/components/ui/popover'
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandItem,
  CommandList
} from '@renderer/components/ui/command'
import type { Contact } from '../../../../../shared/types'

type AddressInputProps = {
  id: string
  value: string[]
  contacts?: Contact[]
  placeholder?: string
  disabled?: boolean
  variant?: 'default' | 'ghost'
  className?: string
  onChange: (value: string[]) => void
}

export function AddressInput({
  id,
  value,
  contacts = [],
  placeholder,
  disabled,
  variant = 'default',
  className,
  onChange
}: AddressInputProps): React.JSX.Element {
  const { t } = useI18n()
  const [draft, setDraft] = React.useState('')
  const [open, setOpen] = React.useState(false)

  const filteredContacts = React.useMemo(() => {
    if (!draft) return []
    const lowerDraft = draft.toLowerCase()
    return contacts.filter(
      (c) => c.name.toLowerCase().includes(lowerDraft) || c.email.toLowerCase().includes(lowerDraft)
    )
  }, [contacts, draft])

  function commitDraft(): void {
    const nextItems = splitAddresses(draft)
    if (nextItems.length === 0) return

    const existing = new Set(value.map((item) => item.toLowerCase()))
    const merged = [...value]
    for (const item of nextItems) {
      if (!existing.has(item.toLowerCase())) merged.push(item)
    }
    onChange(merged)
    setDraft('')
    setOpen(false)
  }

  function handleSelectContact(email: string): void {
    const existing = new Set(value.map((item) => item.toLowerCase()))
    if (!existing.has(email.toLowerCase())) {
      onChange([...value, email])
    }
    setDraft('')
    setOpen(false)
  }

  function removeAddress(address: string): void {
    onChange(value.filter((item) => item !== address))
  }

  return (
    <Popover open={open && filteredContacts.length > 0} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <div
          className={cn(
            'flex min-h-8 w-full min-w-0 flex-wrap items-center gap-1.5 px-2 py-1',
            variant === 'default'
              ? 'rounded-lg border border-input bg-background focus-within:ring-2 focus-within:ring-ring/50'
              : 'rounded-none border-0 bg-transparent px-0 py-0 focus-within:ring-0',
            className
          )}
        >
          {value.map((address) => (
            <span
              key={address}
              className="inline-flex max-w-full items-center gap-1 rounded-md bg-muted px-2 py-0.5 text-xs"
            >
              <span className="max-w-48 truncate">{address}</span>
              <Button
                type="button"
                size="icon-xs"
                variant="ghost"
                aria-label={t('common.removeAddress', { address })}
                disabled={disabled}
                onClick={() => removeAddress(address)}
              >
                <X aria-hidden="true" />
              </Button>
            </span>
          ))}
          <Input
            id={id}
            value={draft}
            disabled={disabled}
            placeholder={value.length === 0 ? placeholder : undefined}
            className="h-6 min-w-36 flex-1 border-0 bg-transparent px-0 py-0 shadow-none focus-visible:ring-0"
            onChange={(event) => {
              setDraft(event.target.value)
              setOpen(true)
            }}
            onBlur={() => {
              // Delay commit to allow clicking on Popover
              setTimeout(() => commitDraft(), 150)
            }}
            onKeyDown={(event) => {
              if (event.key === 'Enter' || event.key === ',' || event.key === ';') {
                event.preventDefault()
                commitDraft()
              }
              if (event.key === 'Backspace' && !draft && value.length > 0) {
                onChange(value.slice(0, -1))
              }
            }}
          />
        </div>
      </PopoverTrigger>
      <PopoverContent
        className="w-[--radix-popover-trigger-width] p-0"
        align="start"
        onOpenAutoFocus={(e) => e.preventDefault()}
      >
        <Command>
          <CommandList>
            <CommandEmpty>{t('common.noResults')}</CommandEmpty>
            <CommandGroup>
              {filteredContacts.map((contact) => (
                <CommandItem
                  key={contact.id}
                  value={contact.email}
                  onSelect={() => handleSelectContact(contact.email)}
                >
                  <div className="flex flex-col">
                    <span className="font-medium">{contact.name}</span>
                    <span className="text-xs text-muted-foreground">{contact.email}</span>
                  </div>
                </CommandItem>
              ))}
            </CommandGroup>
          </CommandList>
        </Command>
      </PopoverContent>
    </Popover>
  )
}

function splitAddresses(value: string): string[] {
  return value
    .split(/[;,]/)
    .map((item) => item.trim())
    .filter(Boolean)
}
