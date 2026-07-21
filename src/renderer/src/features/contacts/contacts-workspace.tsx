import * as React from 'react'
import { Plus, Download, Upload, Search, Trash2, Edit } from 'lucide-react'
import { useI18n } from '@renderer/lib/i18n'
import { Button } from '@renderer/components/ui/button'
import { Input } from '@renderer/components/ui/input'
import { ScrollArea } from '@renderer/components/ui/scroll-area'
import { toast } from 'sonner'
import * as contactsApi from '@renderer/lib/api/contacts'
import type { Contact } from '../../../../shared/types'
import { ContactFormDialog } from './contact-form-dialog'
import { ContactImportExportDialog } from './contact-import-export-dialog'
import { Avatar, AvatarFallback, AvatarImage } from '@renderer/components/ui/avatar'

export function ContactsWorkspace(): React.JSX.Element {
  const { t } = useI18n()
  const [contacts, setContacts] = React.useState<Contact[]>([])
  const [search, setSearch] = React.useState('')
  const [formOpen, setFormOpen] = React.useState(false)
  const [editingContact, setEditingContact] = React.useState<Contact | null>(null)
  const [importExportOpen, setImportExportOpen] = React.useState(false)
  const [importExportMode, setImportExportMode] = React.useState<'import' | 'export'>('import')

  const loadContacts = React.useCallback(async (): Promise<void> => {
    try {
      const data = await contactsApi.listContacts()
      setContacts(data)
    } catch {
      toast.error('Failed to load contacts')
    }
  }, [])

  React.useEffect(() => {
    void loadContacts()
  }, [loadContacts])

  const filteredContacts = contacts.filter(
    (c) =>
      c.name.toLowerCase().includes(search.toLowerCase()) ||
      c.emails.some((e) => e.email.toLowerCase().includes(search.toLowerCase())) ||
      c.phones.some((p) => p.phone.includes(search))
  )

  const handleDelete = async (id: number): Promise<void> => {
    if (!confirm(t('contacts.deleteConfirm'))) return
    try {
      await contactsApi.deleteContact(id)
      void loadContacts()
    } catch {
      toast.error('Failed to delete contact')
    }
  }

  const handleEdit = (contact: Contact): void => {
    setEditingContact(contact)
    setFormOpen(true)
  }

  const handleAdd = (): void => {
    setEditingContact(null)
    setFormOpen(true)
  }

  const handleImport = (): void => {
    setImportExportMode('import')
    setImportExportOpen(true)
  }

  const handleExport = (): void => {
    setImportExportMode('export')
    setImportExportOpen(true)
  }

  return (
    <div className="flex h-full flex-col bg-background">
      <header className="flex h-14 shrink-0 items-center justify-between border-b px-4">
        <h1 className="text-lg font-semibold">{t('contacts.title')}</h1>
        <div className="flex items-center gap-2">
          <Button variant="outline" size="sm" onClick={handleImport}>
            <Download className="mr-2 size-4" />
            {t('contacts.import')}
          </Button>
          <Button variant="outline" size="sm" onClick={handleExport}>
            <Upload className="mr-2 size-4" />
            {t('contacts.export')}
          </Button>
          <Button size="sm" onClick={handleAdd}>
            <Plus className="mr-2 size-4" />
            {t('contacts.add')}
          </Button>
        </div>
      </header>

      <div className="p-4">
        <div className="relative">
          <Search className="absolute left-2.5 top-2.5 size-4 text-muted-foreground" />
          <Input
            placeholder={t('mail.search.placeholder')}
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="pl-9"
          />
        </div>
      </div>

      <ScrollArea className="flex-1">
        {filteredContacts.length === 0 ? (
          <div className="flex flex-col items-center justify-center p-8 text-muted-foreground">
            <Users className="mb-2 size-8 opacity-20" />
            <p>{t('contacts.noContacts')}</p>
          </div>
        ) : (
          <div className="divide-y">
            {filteredContacts.map((contact) => (
              <div
                key={contact.id}
                className="flex items-center justify-between p-4 hover:bg-muted/50 transition-colors"
              >
                <div className="flex items-center gap-4">
                  <Avatar>
                    <AvatarImage src={contact.avatarUrl || undefined} />
                    <AvatarFallback>{contact.name.slice(0, 2).toUpperCase()}</AvatarFallback>
                  </Avatar>
                  <div>
                    <h3 className="font-medium">{contact.name}</h3>
                    <div className="text-sm text-muted-foreground">
                      {contact.emails[0]?.email}
                      {contact.phones[0]?.phone ? ` · ${contact.phones[0].phone}` : ''}
                    </div>
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  <Button variant="ghost" size="icon" onClick={() => handleEdit(contact)}>
                    <Edit className="size-4" />
                  </Button>
                  <Button
                    variant="ghost"
                    size="icon"
                    className="text-destructive"
                    onClick={() => handleDelete(contact.id)}
                  >
                    <Trash2 className="size-4" />
                  </Button>
                </div>
              </div>
            ))}
          </div>
        )}
      </ScrollArea>

      <ContactFormDialog
        open={formOpen}
        contact={editingContact}
        onOpenChange={setFormOpen}
        onSaved={loadContacts}
      />

      <ContactImportExportDialog
        open={importExportOpen}
        mode={importExportMode}
        onOpenChange={setImportExportOpen}
        onSuccess={loadContacts}
      />
    </div>
  )
}

function Users(props: React.SVGProps<SVGSVGElement>): React.JSX.Element {
  return (
    <svg
      {...props}
      xmlns="http://www.w3.org/2000/svg"
      width="24"
      height="24"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2" />
      <circle cx="9" cy="7" r="4" />
      <path d="M22 21v-2a4 4 0 0 0-3-3.87" />
      <path d="M16 3.13a4 4 0 0 1 0 7.75" />
    </svg>
  )
}
