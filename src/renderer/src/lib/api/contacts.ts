import type {
  Contact,
  ContactInput,
  ContactGroup,
  ContactImportResult,
  ContactExportResult
} from '../../../../shared/types'

export async function listContacts(): Promise<Contact[]> {
  return window.electron.ipcRenderer.invoke('contacts/list')
}

export async function getContact(id: number): Promise<Contact | null> {
  return window.electron.ipcRenderer.invoke('contacts/get', id)
}

export async function createContact(input: ContactInput): Promise<Contact> {
  return window.electron.ipcRenderer.invoke('contacts/create', input)
}

export async function updateContact(id: number, input: ContactInput): Promise<Contact> {
  return window.electron.ipcRenderer.invoke('contacts/update', id, input)
}

export async function deleteContact(id: number): Promise<boolean> {
  return window.electron.ipcRenderer.invoke('contacts/delete', id)
}

export async function listContactGroups(): Promise<ContactGroup[]> {
  return window.electron.ipcRenderer.invoke('contacts/getGroups')
}

export async function createContactGroup(name: string): Promise<ContactGroup> {
  return window.electron.ipcRenderer.invoke('contacts/createGroup', name)
}

export async function deleteContactGroup(id: number): Promise<boolean> {
  return window.electron.ipcRenderer.invoke('contacts/deleteGroup', id)
}

export async function importContacts(format: 'csv' | 'vcard'): Promise<ContactImportResult> {
  return window.electron.ipcRenderer.invoke('contacts/importContacts', format)
}

export async function exportContacts(format: 'csv' | 'vcard'): Promise<ContactExportResult> {
  return window.electron.ipcRenderer.invoke('contacts/exportContacts', format)
}
