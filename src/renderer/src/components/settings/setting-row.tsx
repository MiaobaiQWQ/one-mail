import * as React from 'react'
import {
  Field,
  FieldContent,
  FieldDescription,
  FieldError,
  FieldLabel
} from '@renderer/components/ui/field'

export function SettingRow({
  icon: Icon,
  title,
  description,
  control,
  error,
  invalid = false,
  className
}: {
  icon: React.ComponentType<React.SVGProps<SVGSVGElement>>
  title: string
  description: React.ReactNode
  control?: React.ReactNode
  error?: string
  invalid?: boolean
  className?: string
}): React.JSX.Element {
  return (
    <Field data-invalid={invalid || undefined} className={className}>
      <div className="grid gap-2 rounded-md border bg-card p-3 sm:grid-cols-[minmax(0,1fr)_auto] sm:items-center">
        <div className="flex min-w-0 gap-2.5">
          <div className="mt-px flex size-6 shrink-0 items-center justify-center rounded-md bg-muted text-muted-foreground [&_svg]:size-3.5">
            <Icon aria-hidden="true" />
          </div>
          <FieldContent>
            <FieldLabel className="text-xs">{title}</FieldLabel>
            <FieldDescription className="text-xs leading-snug">{description}</FieldDescription>
            <FieldError className="text-xs">{error}</FieldError>
          </FieldContent>
        </div>
        {control ? <div className="flex justify-start sm:justify-end">{control}</div> : null}
      </div>
    </Field>
  )
}
