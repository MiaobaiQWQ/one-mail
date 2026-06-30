import {
  app,
  BrowserWindow,
  Menu,
  nativeImage,
  Tray,
  type MenuItemConstructorOptions,
  type NativeImage
} from 'electron'

type TrayActions = {
  showWindow: () => BrowserWindow
  syncNow: () => Promise<void> | void
}

type TrayLabels = {
  open: string
  sync: string
  syncing: string
  quit: string
}

let tray: Tray | null = null
let trayActions: TrayActions | null = null
let syncing = false
let quitRequested = false

export function initializeTray(iconPath: string, actions: TrayActions): void {
  if (tray) return

  trayActions = actions
  tray = new Tray(createTrayIcon(iconPath))
  tray.setToolTip('OneMail')

  if (process.platform !== 'darwin') {
    tray.on('click', () => {
      actions.showWindow()
    })
  }

  updateTrayMenu()
}

export function shouldHideWindowToTray(): boolean {
  return !quitRequested && process.platform !== 'darwin' && tray !== null
}

export function requestQuitFromTray(): void {
  quitRequested = true
  app.quit()
}

export function markAppQuitRequested(): void {
  quitRequested = true
}

export function destroyTray(): void {
  tray?.destroy()
  tray = null
  trayActions = null
  syncing = false
}

function updateTrayMenu(): void {
  if (!tray || !trayActions) return

  tray.setContextMenu(createTrayMenu(trayActions))
}

function createTrayMenu(actions: TrayActions): Electron.Menu {
  const labels = getTrayLabels()
  const template: MenuItemConstructorOptions[] = [
    {
      label: labels.open,
      click: () => {
        actions.showWindow()
      }
    },
    {
      label: syncing ? labels.syncing : labels.sync,
      enabled: !syncing,
      click: () => {
        runTraySync(actions)
      }
    },
    { type: 'separator' },
    {
      label: labels.quit,
      click: () => {
        requestQuitFromTray()
      }
    }
  ]

  return Menu.buildFromTemplate(template)
}

function runTraySync(actions: TrayActions): void {
  if (syncing) return

  syncing = true
  updateTrayMenu()

  void Promise.resolve()
    .then(() => actions.syncNow())
    .catch((error: unknown) => {
      const message = error instanceof Error ? error.message : String(error)
      console.warn(`[tray] manual sync failed: ${message}`)
    })
    .finally(() => {
      syncing = false
      updateTrayMenu()
    })
}

function getTrayLabels(): TrayLabels {
  const isChinese = app.getLocale().toLowerCase().startsWith('zh')

  return isChinese
    ? {
        open: '打开 OneMail',
        sync: '同步邮件',
        syncing: '正在同步…',
        quit: '退出 OneMail'
      }
    : {
        open: 'Open OneMail',
        sync: 'Sync Mail',
        syncing: 'Syncing…',
        quit: 'Quit OneMail'
      }
}

function createTrayIcon(iconPath: string): string | NativeImage {
  if (process.platform !== 'darwin') return iconPath

  const templateIcon = nativeImage.createFromBitmap(createMacosTrayIconBitmap(), {
    width: MACOS_TRAY_ICON_PIXEL_SIZE,
    height: MACOS_TRAY_ICON_PIXEL_SIZE,
    scaleFactor: 2
  })
  templateIcon.setTemplateImage(true)
  return templateIcon
}

const MACOS_TRAY_ICON_PIXEL_SIZE = 36

function createMacosTrayIconBitmap(): Buffer {
  const bitmap = Buffer.alloc(MACOS_TRAY_ICON_PIXEL_SIZE * MACOS_TRAY_ICON_PIXEL_SIZE * 4)
  const strokeWidth = 4

  drawLine(bitmap, 3, 8, 33, 8, strokeWidth)
  drawLine(bitmap, 3, 8, 3, 28, strokeWidth)
  drawLine(bitmap, 33, 8, 33, 28, strokeWidth)
  drawLine(bitmap, 3, 28, 33, 28, strokeWidth)
  drawLine(bitmap, 4, 9, 18, 21, strokeWidth)
  drawLine(bitmap, 32, 9, 18, 21, strokeWidth)
  drawLine(bitmap, 4, 27, 15, 17, strokeWidth)
  drawLine(bitmap, 32, 27, 21, 17, strokeWidth)

  return bitmap
}

function drawLine(
  bitmap: Buffer,
  startX: number,
  startY: number,
  endX: number,
  endY: number,
  width: number
): void {
  const distance = Math.hypot(endX - startX, endY - startY)
  const steps = Math.max(1, Math.ceil(distance * 2))

  for (let step = 0; step <= steps; step += 1) {
    const progress = step / steps
    drawDot(
      bitmap,
      startX + (endX - startX) * progress,
      startY + (endY - startY) * progress,
      width / 2
    )
  }
}

function drawDot(bitmap: Buffer, centerX: number, centerY: number, radius: number): void {
  const minX = Math.floor(centerX - radius)
  const maxX = Math.ceil(centerX + radius)
  const minY = Math.floor(centerY - radius)
  const maxY = Math.ceil(centerY + radius)

  for (let y = minY; y <= maxY; y += 1) {
    for (let x = minX; x <= maxX; x += 1) {
      if (x < 0 || y < 0 || x >= MACOS_TRAY_ICON_PIXEL_SIZE || y >= MACOS_TRAY_ICON_PIXEL_SIZE) {
        continue
      }
      if (Math.hypot(x - centerX, y - centerY) > radius) continue
      setBitmapAlpha(bitmap, x, y, 255)
    }
  }
}

function setBitmapAlpha(bitmap: Buffer, x: number, y: number, alpha: number): void {
  const offset = (y * MACOS_TRAY_ICON_PIXEL_SIZE + x) * 4
  bitmap[offset] = 0
  bitmap[offset + 1] = 0
  bitmap[offset + 2] = 0
  bitmap[offset + 3] = Math.max(bitmap[offset + 3], alpha)
}
