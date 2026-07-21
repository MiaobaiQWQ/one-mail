import * as React from 'react'
import { ReactCrop, type Crop, type PixelCrop, centerCrop, makeAspectCrop } from 'react-image-crop'
import 'react-image-crop/dist/ReactCrop.css'

import { ResponsiveDialog } from '@renderer/components/responsive-dialog'
import { Button } from '@renderer/components/ui/button'
import { useI18n } from '@renderer/lib/i18n'

type ImageCropDialogProps = {
  open: boolean
  onOpenChange: (open: boolean) => void
  imageSrc: string
  onCropComplete: (croppedImageUrl: string) => void
}

function centerAspectCrop(mediaWidth: number, mediaHeight: number, aspect: number): Crop {
  return centerCrop(
    makeAspectCrop(
      {
        unit: '%',
        width: 90
      },
      aspect,
      mediaWidth,
      mediaHeight
    ),
    mediaWidth,
    mediaHeight
  )
}

export function ImageCropDialog({
  open,
  onOpenChange,
  imageSrc,
  onCropComplete
}: ImageCropDialogProps): React.JSX.Element {
  const { t } = useI18n()
  const [crop, setCrop] = React.useState<Crop>()
  const [completedCrop, setCompletedCrop] = React.useState<PixelCrop | null>(null)
  const imgRef = React.useRef<HTMLImageElement | null>(null)

  function onImageLoad(e: React.SyntheticEvent<HTMLImageElement>) {
    const { width, height } = e.currentTarget
    setCrop(centerAspectCrop(width, height, 1))
  }

  async function handleCrop() {
    if (!completedCrop || !imgRef.current) {
      onOpenChange(false)
      return
    }

    try {
      const image = imgRef.current
      const canvas = document.createElement('canvas')
      const ctx = canvas.getContext('2d')

      if (!ctx) {
        throw new Error('No 2d context')
      }

      const scaleX = image.naturalWidth / image.width
      const scaleY = image.naturalHeight / image.height

      const cropWidth = completedCrop.width * scaleX
      const cropHeight = completedCrop.height * scaleY

      // Max dimension 256 for avatar to save space
      const MAX_DIMENSION = 256
      let finalWidth = cropWidth
      let finalHeight = cropHeight
      
      if (cropWidth > MAX_DIMENSION || cropHeight > MAX_DIMENSION) {
        if (cropWidth > cropHeight) {
          finalWidth = MAX_DIMENSION
          finalHeight = (cropHeight / cropWidth) * MAX_DIMENSION
        } else {
          finalHeight = MAX_DIMENSION
          finalWidth = (cropWidth / cropHeight) * MAX_DIMENSION
        }
      }

      canvas.width = finalWidth
      canvas.height = finalHeight

      ctx.drawImage(
        image,
        completedCrop.x * scaleX,
        completedCrop.y * scaleY,
        cropWidth,
        cropHeight,
        0,
        0,
        finalWidth,
        finalHeight
      )

      const croppedImageUrl = canvas.toDataURL('image/jpeg', 0.9)
      onCropComplete(croppedImageUrl)
      onOpenChange(false)
    } catch (e) {
      console.error('Failed to crop image', e)
      onOpenChange(false)
    }
  }

  return (
    <ResponsiveDialog
      open={open}
      onOpenChange={onOpenChange}
      title="裁剪图标"
      contentClassName="sm:w-[440px]"
      footer={
        <>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            {t('common.cancel')}
          </Button>
          <Button onClick={handleCrop}>确定</Button>
        </>
      }
    >
      <div className="flex flex-col items-center justify-center p-4">
        {imageSrc ? (
          <ReactCrop
            crop={crop}
            onChange={(_, percentCrop) => setCrop(percentCrop)}
            onComplete={(c) => setCompletedCrop(c)}
            aspect={1}
            circularCrop
          >
            <img
              ref={imgRef}
              src={imageSrc}
              alt="Crop me"
              className="max-h-[300px] w-auto object-contain"
              onLoad={onImageLoad}
            />
          </ReactCrop>
        ) : null}
      </div>
    </ResponsiveDialog>
  )
}
