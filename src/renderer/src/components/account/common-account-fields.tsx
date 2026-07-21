import * as React from 'react'
import type { UseFormReturn } from 'react-hook-form'

import { Input } from '@renderer/components/ui/input'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue
} from '@renderer/components/ui/select'
import { useI18n } from '@renderer/lib/i18n'
import type { AccountFormValues } from './account-form-types'
import { AccountFormField } from './account-form-field'
import { ACCOUNT_COLORS } from '@renderer/lib/api/accounts'
import { cn } from '@renderer/lib/utils'
import { Camera, X } from 'lucide-react'
import { ImageCropDialog } from './image-crop-dialog'

type CommonAccountFieldsProps = {
  form: UseFormReturn<AccountFormValues>
  passwordLabel: string
  passwordPlaceholder: string
}

export function CommonAccountFields({
  form,
  passwordLabel,
  passwordPlaceholder
}: CommonAccountFieldsProps): React.JSX.Element {
  const { t } = useI18n()
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
    // Clear the input value so the same file can be selected again if needed
    event.target.value = ''
  }

  const handleCropComplete = (croppedUrl: string) => {
    form.setValue('avatarUrl', croppedUrl)
    form.setValue('avatarText', '') // clear text if image is uploaded
  }

  const handleRemoveImage = () => {
    form.setValue('avatarUrl', '')
  }

  return (
    <>
      <AccountFormField
        id="account-email"
        label={t('account.form.email')}
        required
        error={form.formState.errors.email?.message}
      >
        <Input
          id="account-email"
          type="email"
          autoComplete="email"
          placeholder="name@example.com"
          required
          aria-invalid={Boolean(form.formState.errors.email)}
          {...form.register('email')}
        />
      </AccountFormField>

      <AccountFormField
        id="account-password"
        label={passwordLabel}
        required
        error={form.formState.errors.password?.message}
      >
        <Input
          id="account-password"
          type="password"
          autoComplete="current-password"
          placeholder={passwordPlaceholder}
          required
          aria-invalid={Boolean(form.formState.errors.password)}
          {...form.register('password')}
        />
      </AccountFormField>

      <AccountFormField
        id="account-label"
        label={t('account.form.label')}
        error={form.formState.errors.accountLabel?.message}
      >
        <Input
          id="account-label"
          autoComplete="off"
          placeholder={t('account.form.labelPlaceholder')}
          aria-invalid={Boolean(form.formState.errors.accountLabel)}
          {...form.register('accountLabel')}
        />
      </AccountFormField>

      <AccountFormField
        id="account-avatar-text"
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
              id="account-avatar-text"
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
        id="account-color"
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

      <ImageCropDialog
        open={cropDialogOpen}
        onOpenChange={setCropDialogOpen}
        imageSrc={tempImageSrc}
        onCropComplete={handleCropComplete}
      />
    </>
  )
}
