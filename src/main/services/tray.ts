import { app, BrowserWindow, Menu, Tray } from 'electron'

type TrayActions = {
  showWindow: () => BrowserWindow
  syncNow: () => void
}

let tray: Tray | null = null
let quitRequested = false

export function initializeTray(iconPath: string, actions: TrayActions): void {
  if (tray) return

  tray = new Tray(iconPath)
  tray.setToolTip('OneMail 正在后台运行')
  tray.on('click', () => {
    actions.showWindow()
  })
  tray.setContextMenu(createTrayMenu(actions))
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
}

function createTrayMenu(actions: TrayActions): Electron.Menu {
  return Menu.buildFromTemplate([
    {
      label: 'OneMail 正在运行',
      enabled: false
    },
    { type: 'separator' },
    {
      label: '显示主窗口',
      click: () => {
        actions.showWindow()
      }
    },
    {
      label: '立即同步',
      click: () => {
        actions.syncNow()
      }
    },
    { type: 'separator' },
    {
      label: '退出 OneMail',
      click: () => {
        requestQuitFromTray()
      }
    }
  ])
}
