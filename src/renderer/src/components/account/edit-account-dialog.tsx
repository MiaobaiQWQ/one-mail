import { zodResolver } from '@hookform/resolvers/zod'
import * as React from 'react'
import { useForm } from 'react-hook-form'
import { z } from 'zod'

import type { Account } from '@renderer/components/mail/shared/types'
import { ResponsiveDialog } from '@renderer/components/responsive-dialog'
import { Button } from '@renderer/components/ui/button'
import { FieldError, FieldGroup } from '@renderer/components/ui/field'
import { Input } from '@renderer/components/ui/input'
import { useI18n, type TranslationKey } from '@renderer/lib/i18n'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue
} from '@renderer/components/ui/select'
import { ACCOUNT_COLORS } from '@renderer/lib/api/accounts'
import { cn } from '@renderer/lib/utils'
import type { AccountUpdateInput } from '../../../../shared/types'
import { AccountFormField } from './account-form-field'
import { ImageCropDialog } from './image-crop-dialog'

import { Camera, X } from 'lucide-react'

type EditAccountValues = {
  accountLabel?: string
  password?: string
  avatarText?: string
  avatarUrl?: string
  colorKey?: string
}

type EditAccountDialogProps = {
  account: Account
  open: boolean
  onOpenChange: (open: boolean) => void
  onSubmit: (input: AccountUpdateInput) => Promise<void>
}

export function EditAccountDialog({
  account,
  open,
  onOpenChange,
  onSubmit
}: EditAccountDialogProps): React.JSX.Element {
  const { t } = useI18n()
  const editAccountSchema = React.useMemo(() => createEditAccountSchema(t), [t])
  const [pending, setPending] = React.useState(false)
  const [error, setError] = React.useState<string | null>(null)
  const isOAuthAccount = account.authType === 'oauth2'
  const form = useForm<EditAccountValues>({
    resolver: zodResolver(editAccountSchema),
    defaultValues: {
      accountLabel: getInitialLabel(account),
      password: '',
      avatarText: account.avatarText || '',
      avatarUrl: account.avatarUrl || '',
      colorKey: ACCOUNT_COLORS.includes(account.accent) ? account.accent : 'auto'
    }
  })

  React.useEffect(() => {
    if (!open) return
    form.reset({
      accountLabel: getInitialLabel(account),
      password: '',
      avatarText: account.avatarText || '',
      avatarUrl: account.avatarUrl || '',
      colorKey: ACCOUNT_COLORS.includes(account.accent) ? account.accent : 'auto'
    })
  }, [account, form, open])

  function handleOpenChange(nextOpen: boolean): void {
    if (pending && !nextOpen) return

    if (!nextOpen) {
      setError(null)
    }
    onOpenChange(nextOpen)
  }

  const avatarUrl = form.watch('avatarUrl')

  const [cropDialogOpen, setCropDialogOpen] = React.useState(false)
  const [tempImageSrc, setTempImageSrc] = React.useState('')

  const handleImageUpload = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0]
    if (!file) return

    const reader = new FileReader()
    reader.onload = (e) => {
      const result = e.target?.result
      if (typeof result === 'string') {
        setTempImageSrc(result)
        setCropDialogOpen(true)
      }
    }
    reader.readAsDataURL(file)
    event.target.value = ''
  }

  const handleCropComplete = (croppedUrl: string) => {
    form.setValue('avatarUrl', croppedUrl)
    form.setValue('avatarText', '') // clear text if image is uploaded
  }

  const handleRemoveImage = () => {
    form.setValue('avatarUrl', '')
  }

  async function handleSubmit(values: EditAccountValues): Promise<void> {
    if (!account.accountId) return

    setPending(true)
    setError(null)

    const password = optionalText(values.password)
    if (!isOAuthAccount && account.credentialState !== 'stored' && !password) {
      setError(t('account.edit.missingCredentialError'))
      setPending(false)
      return
    }

    try {
      await onSubmit({
        accountId: account.accountId,
        accountLabel: values.accountLabel?.trim() ?? '',
        password: isOAuthAccount ? undefined : password,
        avatarText: values.avatarText?.trim() || undefined,
        avatarUrl: values.avatarUrl || undefined,
        colorKey: values.colorKey === 'auto' ? undefined : values.colorKey || undefined
      })
    } catch (submitError) {
      setError(submitError instanceof Error ? submitError.message : t('account.add.saveError'))
    } finally {
      setPending(false)
    }
  }

  return (
    <ResponsiveDialog
      open={open}
      onOpenChange={handleOpenChange}
      title={t('account.edit.title')}
      description={
        isOAuthAccount
          ? t('account.edit.oauthDescription')
          : account.credentialState === 'stored'
            ? t('account.edit.storedDescription')
            : t('account.edit.missingCredentialDescription')
      }
      footer={
        <>
          <Button variant="outline" onClick={() => handleOpenChange(false)} disabled={pending}>
            {t('common.cancel')}
          </Button>
          <Button type="submit" form="edit-account-form" disabled={pending || !account.accountId}>
            {pending
              ? isOAuthAccount
                ? t('common.saving')
                : t('common.testing')
              : t('account.edit.saveChanges')}
          </Button>
        </>
      }
    >
      <form
        id="edit-account-form"
        className="flex flex-col gap-3"
        onSubmit={form.handleSubmit(handleSubmit)}
      >
        <FieldGroup className="gap-2.5">
          <AccountFormField id="edit-account-email" label={t('account.form.email')}>
            <Input id="edit-account-email" type="email" value={account.address} disabled />
          </AccountFormField>
          <AccountFormField
            id="edit-account-label"
            label={t('account.form.label')}
            error={form.formState.errors.accountLabel?.message}
          >
            <Input
              id="edit-account-label"
              placeholder={t('account.form.labelPlaceholder')}
              aria-invalid={Boolean(form.formState.errors.accountLabel)}
              {...form.register('accountLabel')}
            />
          </AccountFormField>

          <AccountFormField
            id="edit-account-avatar-text"
            label="自定义图标"
            error={
              form.formState.errors.avatarText?.message || form.formState.errors.avatarUrl?.message
            }
          >
            <div className="flex items-center gap-3">
              <div className="relative group size-10 shrink-0">
                {avatarUrl ? (
                  <>
                    <img
                      src={avatarUrl}
                      alt="Avatar"
                      className="size-full rounded-md object-cover border"
                    />
                    <button
                      type="button"
                      onClick={handleRemoveImage}
                      className="absolute -top-1.5 -right-1.5 hidden group-hover:flex size-4 items-center justify-center rounded-full bg-destructive text-destructive-foreground shadow-sm"
                    >
                      <X className="size-3" />
                    </button>
                  </>
                ) : (
                  <label className="flex size-full cursor-pointer items-center justify-center rounded-md border border-dashed hover:bg-muted transition-colors">
                    <Camera className="size-4 text-muted-foreground" />
                    <input
                      type="file"
                      accept="image/*"
                      className="hidden"
                      onChange={handleImageUpload}
                    />
                  </label>
                )}
              </div>
              <div className="flex-1">
                <Input
                  id="edit-account-avatar-text"
                  autoComplete="off"
                  maxLength={2}
                  placeholder="或者输入文字(最多2个字符)"
                  disabled={Boolean(avatarUrl)}
                  aria-invalid={Boolean(form.formState.errors.avatarText)}
                  {...form.register('avatarText')}
                />
              </div>
            </div>
          </AccountFormField>

          <AccountFormField
            id="edit-account-color"
            label="展示颜色"
            error={form.formState.errors.colorKey?.message}
          >
            <Select
              value={form.watch('colorKey') || 'auto'}
              onValueChange={(value) => form.setValue('colorKey', value)}
            >
              <SelectTrigger aria-label="展示颜色">
                <SelectValue placeholder="默认自动分配" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="auto">自动分配</SelectItem>
                {ACCOUNT_COLORS.map((color) => (
                  <SelectItem key={color} value={color}>
                    <div className="flex items-center gap-2">
                      <div className={cn('size-4 rounded-sm', color)} />
                      <span className="text-xs uppercase">
                        {color.replace('bg-', '').replace('-500', '')}
                      </span>
                    </div>
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </AccountFormField>

          {isOAuthAccount ? null : (
            <AccountFormField
              id="edit-account-password"
              label={t('account.form.passwordOrAuthCode')}
              required={account.credentialState !== 'stored'}
              error={form.formState.errors.password?.message}
            >
              <Input
                id="edit-account-password"
                type="password"
                autoComplete="current-password"
                placeholder={
                  account.credentialState === 'stored'
                    ? t('account.edit.keepSavedCredential')
                    : t('account.edit.passwordPlaceholder')
                }
                required={account.credentialState !== 'stored'}
                aria-invalid={Boolean(form.formState.errors.password)}
                {...form.register('password')}
              />
            </AccountFormField>
          )}
        </FieldGroup>

        {error ? <FieldError>{error}</FieldError> : null}
      </form>

      <ImageCropDialog
        open={cropDialogOpen}
        onOpenChange={setCropDialogOpen}
        imageSrc={tempImageSrc}
        onCropComplete={handleCropComplete}
      />
    </ResponsiveDialog>
  )
}

function createEditAccountSchema(t: (key: TranslationKey) => string) {
  return z.object({
    accountLabel: z.string().trim().max(80, t('account.form.labelMax')).optional(),
    password: z.string().trim().optional(),
    avatarText: z.string().trim().max(2, '最多2个字符').optional(),
    avatarUrl: z.string().optional(),
    colorKey: z.string().trim().optional()
  })
}

function getInitialLabel(account: Account): string {
  const suffix = `(${account.address})`
  if (!account.name.endsWith(suffix)) return ''
  return account.name.slice(0, -suffix.length)
}

function optionalText(value?: string): string | undefined {
  const text = value?.trim()
  return text ? text : undefined
}
