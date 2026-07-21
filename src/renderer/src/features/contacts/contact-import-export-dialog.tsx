import * as React from 'react'
import { useI18n } from '@renderer/lib/i18n'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter
} from '@renderer/components/ui/dialog'
import { Button } from '@renderer/components/ui/button'
import { toast } from 'sonner'
import * as contactsApi from '@renderer/lib/api/contacts'

export function ContactImportExportDialog({
  open,
  mode,
  onOpenChange,
  onSuccess
}: {
  open: boolean
  mode: 'import' | 'export'
  onOpenChange: (open: boolean) => void
  onSuccess: () => void
}): React.JSX.Element {
  const { t } = useI18n()
  const [loading, setLoading] = React.useState(false)

  const handleAction = async (format: 'csv' | 'vcard'): Promise<void> => {
    setLoading(true)
    try {
      if (mode === 'import') {
        const result = await contactsApi.importContacts(format)
        if (result.canceled) {
          return
        }
        if (result.error) {
          toast.error(result.error)
        } else {
          toast.success(t('contacts.importSuccess') + `: ${result.importedCount}`)
          onSuccess()
          onOpenChange(false)
        }
      } else {
        const result = await contactsApi.exportContacts(format)
        if (result.canceled) {
          return
        }
        if (result.success) {
          toast.success(t('contacts.exportSuccess'))
          onOpenChange(false)
        } else {
          toast.error('Export failed')
        }
      }
    } catch {
      toast.error('Operation failed')
    } finally {
      setLoading(false)
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[425px]">
        <DialogHeader>
          <DialogTitle>
            {mode === 'import' ? t('contacts.import') : t('contacts.export')}
          </DialogTitle>
        </DialogHeader>

        <div className="flex flex-col gap-4 py-4">
          <Button
            variant="outline"
            className="h-24 flex-col gap-2"
            onClick={() => handleAction('csv')}
            disabled={loading}
          >
            <span className="text-lg font-medium">{t('contacts.formatCsv')}</span>
            <span className="text-xs text-muted-foreground">Microsoft Excel, Google Contacts</span>
          </Button>

          <Button
            variant="outline"
            className="h-24 flex-col gap-2"
            onClick={() => handleAction('vcard')}
            disabled={loading}
          >
            <span className="text-lg font-medium">{t('contacts.formatVcard')}</span>
            <span className="text-xs text-muted-foreground">Apple Contacts, iOS, Outlook</span>
          </Button>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
