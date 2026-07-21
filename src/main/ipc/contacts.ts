import { ipcMain, dialog } from 'electron'
import type { ContactInput } from '../../shared/types'
import {
  listContacts,
  getContact,
  createContact,
  updateContact,
  deleteContact,
  listContactGroups,
  createContactGroup,
  deleteContactGroup
} from '../db/repositories/contact.repository'
import {
  importContactsCsv,
  importContactsVCard,
  exportContactsCsv,
  exportContactsVCard
} from '../services/contacts-sync'

export function registerContactsHandlers(): void {
  ipcMain.handle('contacts/list', () => {
    return listContacts()
  })

  ipcMain.handle('contacts/get', (_event, id: number) => {
    return getContact(id)
  })

  ipcMain.handle('contacts/create', (_event, input: ContactInput) => {
    return createContact(input)
  })

  ipcMain.handle('contacts/update', (_event, id: number, input: ContactInput) => {
    return updateContact(id, input)
  })

  ipcMain.handle('contacts/delete', (_event, id: number) => {
    return deleteContact(id)
  })

  ipcMain.handle('contacts/getGroups', () => {
    return listContactGroups()
  })

  ipcMain.handle('contacts/createGroup', (_event, name: string) => {
    return createContactGroup(name)
  })

  ipcMain.handle('contacts/deleteGroup', (_event, id: number) => {
    return deleteContactGroup(id)
  })

  ipcMain.handle('contacts/importContacts', async (_event, format: 'csv' | 'vcard') => {
    const { canceled, filePaths } = await dialog.showOpenDialog({
      properties: ['openFile'],
      filters:
        format === 'csv'
          ? [{ name: 'CSV', extensions: ['csv'] }]
          : [{ name: 'vCard', extensions: ['vcf', 'vcard'] }]
    })

    if (canceled || filePaths.length === 0) {
      return { importedCount: 0, failedCount: 0, canceled: true }
    }

    if (format === 'csv') {
      return importContactsCsv(filePaths[0])
    } else {
      return importContactsVCard(filePaths[0])
    }
  })

  ipcMain.handle('contacts/exportContacts', async (_event, format: 'csv' | 'vcard') => {
    const { canceled, filePath } = await dialog.showSaveDialog({
      defaultPath: format === 'csv' ? 'contacts.csv' : 'contacts.vcf',
      filters:
        format === 'csv'
          ? [{ name: 'CSV', extensions: ['csv'] }]
          : [{ name: 'vCard', extensions: ['vcf', 'vcard'] }]
    })

    if (canceled || !filePath) {
      return { canceled: true, success: false }
    }

    if (format === 'csv') {
      return { success: await exportContactsCsv(filePath), canceled: false }
    } else {
      return { success: await exportContactsVCard(filePath), canceled: false }
    }
  })
}
