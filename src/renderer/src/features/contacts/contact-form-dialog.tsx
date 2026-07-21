import * as React from 'react'
import { Plus, Trash2 } from 'lucide-react'
import { useI18n } from '@renderer/lib/i18n'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter
} from '@renderer/components/ui/dialog'
import { Button } from '@renderer/components/ui/button'
import { Input } from '@renderer/components/ui/input'
import { Label } from '@renderer/components/ui/label'
import { Textarea } from '@renderer/components/ui/textarea'
import { toast } from 'sonner'
import * as contactsApi from '@renderer/lib/api/contacts'
import type { Contact, ContactInput } from '../../../../shared/types'

export function ContactFormDialog({
  open,
  contact,
  onOpenChange,
  onSaved
}: {
  open: boolean
  contact: Contact | null
  onOpenChange: (open: boolean) => void
  onSaved: () => void
}): React.JSX.Element {
  const { t } = useI18n()
  const [name, setName] = React.useState('')
  const [notes, setNotes] = React.useState('')
  const [emails, setEmails] = React.useState([{ email: '', label: 'Work' }])
  const [phones, setPhones] = React.useState([{ phone: '', label: 'Mobile' }])

  React.useEffect(() => {
    if (open) {
      if (contact) {
        setName(contact.name)
        setNotes(contact.notes || '')
        setEmails(
          contact.emails.length
            ? contact.emails.map((e) => ({ email: e.email, label: e.label || 'Work' }))
            : [{ email: '', label: 'Work' }]
        )
        setPhones(
          contact.phones.length
            ? contact.phones.map((p) => ({ phone: p.phone, label: p.label || 'Mobile' }))
            : [{ phone: '', label: 'Mobile' }]
        )
      } else {
        setName('')
        setNotes('')
        setEmails([{ email: '', label: 'Work' }])
        setPhones([{ phone: '', label: 'Mobile' }])
      }
    }
  }, [open, contact])

  const handleSave = async (): Promise<void> => {
    if (!name.trim()) {
      toast.error('Name is required')
      return
    }

    const input: ContactInput = {
      name: name.trim(),
      notes: notes.trim(),
      emails: emails.filter((e) => e.email.trim()),
      phones: phones.filter((p) => p.phone.trim()),
      groupIds: [] // Group support can be expanded later
    }

    try {
      if (contact) {
        await contactsApi.updateContact(contact.id, input)
      } else {
        await contactsApi.createContact(input)
      }
      onSaved()
      onOpenChange(false)
    } catch {
      toast.error('Failed to save contact')
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[425px]">
        <DialogHeader>
          <DialogTitle>{contact ? t('contacts.edit') : t('contacts.add')}</DialogTitle>
        </DialogHeader>

        <div className="grid gap-4 py-4 max-h-[60vh] overflow-y-auto px-1">
          <div className="grid gap-2">
            <Label htmlFor="name">{t('contacts.name')}</Label>
            <Input id="name" value={name} onChange={(e) => setName(e.target.value)} />
          </div>

          <div className="grid gap-2">
            <Label>{t('contacts.emails')}</Label>
            {emails.map((e, i) => (
              <div key={i} className="flex gap-2">
                <Input
                  placeholder="Email address"
                  value={e.email}
                  onChange={(ev) => {
                    const newEmails = [...emails]
                    newEmails[i].email = ev.target.value
                    setEmails(newEmails)
                  }}
                />
                <Button
                  variant="ghost"
                  size="icon"
                  onClick={() => setEmails(emails.filter((_, idx) => idx !== i))}
                >
                  <Trash2 className="size-4" />
                </Button>
              </div>
            ))}
            <Button
              variant="outline"
              size="sm"
              className="w-fit"
              onClick={() => setEmails([...emails, { email: '', label: 'Work' }])}
            >
              <Plus className="mr-2 size-4" /> Add Email
            </Button>
          </div>

          <div className="grid gap-2">
            <Label>{t('contacts.phones')}</Label>
            {phones.map((p, i) => (
              <div key={i} className="flex gap-2">
                <Input
                  placeholder="Phone number"
                  value={p.phone}
                  onChange={(ev) => {
                    const newPhones = [...phones]
                    newPhones[i].phone = ev.target.value
                    setPhones(newPhones)
                  }}
                />
                <Button
                  variant="ghost"
                  size="icon"
                  onClick={() => setPhones(phones.filter((_, idx) => idx !== i))}
                >
                  <Trash2 className="size-4" />
                </Button>
              </div>
            ))}
            <Button
              variant="outline"
              size="sm"
              className="w-fit"
              onClick={() => setPhones([...phones, { phone: '', label: 'Mobile' }])}
            >
              <Plus className="mr-2 size-4" /> Add Phone
            </Button>
          </div>

          <div className="grid gap-2">
            <Label htmlFor="notes">{t('contacts.notes')}</Label>
            <Textarea id="notes" value={notes} onChange={(e) => setNotes(e.target.value)} />
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button onClick={handleSave}>Save</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
