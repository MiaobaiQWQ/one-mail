import fs from 'node:fs/promises'
import type { Contact, ContactInput } from '../../shared/types'
import { createContact, listContacts } from '../db/repositories/contact.repository'

// A simple CSV parser/generator
function parseCsvLine(line: string): string[] {
  const result: string[] = []
  let current = ''
  let inQuotes = false
  for (let i = 0; i < line.length; i++) {
    const char = line[i]
    if (char === '"') {
      if (inQuotes && line[i + 1] === '"') {
        current += '"'
        i++
      } else {
        inQuotes = !inQuotes
      }
    } else if (char === ',' && !inQuotes) {
      result.push(current)
      current = ''
    } else {
      current += char
    }
  }
  result.push(current)
  return result
}

function escapeCsvField(field: string): string {
  if (!field) return ''
  if (field.includes(',') || field.includes('"') || field.includes('\n')) {
    return `"${field.replace(/"/g, '""')}"`
  }
  return field
}

export async function importContactsCsv(
  filePath: string
): Promise<{ importedCount: number; failedCount: number; error?: string }> {
  try {
    const content = await fs.readFile(filePath, 'utf-8')
    const lines = content.split(/\r?\n/).filter((line) => line.trim().length > 0)
    if (lines.length < 2) return { importedCount: 0, failedCount: 0 }

    const headers = parseCsvLine(lines[0]).map((h) => h.toLowerCase().trim())

    let importedCount = 0
    let failedCount = 0

    for (let i = 1; i < lines.length; i++) {
      try {
        const values = parseCsvLine(lines[i])
        const contact: ContactInput = {
          name: '',
          emails: [],
          phones: [],
          groupIds: [],
          notes: ''
        }

        for (let j = 0; j < headers.length; j++) {
          const header = headers[j]
          const value = values[j]?.trim()
          if (!value) continue

          if (header === 'name' || header === '姓名') {
            contact.name = value
          } else if (header.includes('email') || header.includes('邮箱')) {
            contact.emails.push({ email: value, label: 'Work' })
          } else if (
            header.includes('phone') ||
            header.includes('电话') ||
            header.includes('手机')
          ) {
            contact.phones.push({ phone: value, label: 'Mobile' })
          } else if (header === 'notes' || header === '备注') {
            contact.notes = value
          }
        }

        if (contact.name) {
          createContact(contact)
          importedCount++
        } else {
          failedCount++
        }
      } catch (e) {
        failedCount++
      }
    }

    return { importedCount, failedCount }
  } catch (error: any) {
    return { importedCount: 0, failedCount: 0, error: error.message }
  }
}

export async function exportContactsCsv(filePath: string): Promise<boolean> {
  try {
    const contacts = listContacts()
    const lines = ['Name,Email 1,Phone 1,Notes']

    for (const contact of contacts) {
      const name = escapeCsvField(contact.name)
      const email = escapeCsvField(contact.emails[0]?.email || '')
      const phone = escapeCsvField(contact.phones[0]?.phone || '')
      const notes = escapeCsvField(contact.notes || '')
      lines.push(`${name},${email},${phone},${notes}`)
    }

    await fs.writeFile(filePath, lines.join('\n'), 'utf-8')
    return true
  } catch (error) {
    return false
  }
}

// A simple vCard parser/generator
export async function importContactsVCard(
  filePath: string
): Promise<{ importedCount: number; failedCount: number; error?: string }> {
  try {
    const content = await fs.readFile(filePath, 'utf-8')
    const cards = content.split('END:VCARD')

    let importedCount = 0
    let failedCount = 0

    for (const card of cards) {
      if (!card.includes('BEGIN:VCARD')) continue

      try {
        const lines = card.split(/\r?\n/)
        const contact: ContactInput = {
          name: '',
          emails: [],
          phones: [],
          groupIds: [],
          notes: ''
        }

        for (const line of lines) {
          if (line.startsWith('FN:')) {
            contact.name = line.substring(3).trim()
          } else if (line.startsWith('EMAIL')) {
            const emailPart = line.split(':')
            if (emailPart.length >= 2) {
              contact.emails.push({ email: emailPart.slice(1).join(':').trim(), label: 'Work' })
            }
          } else if (line.startsWith('TEL')) {
            const phonePart = line.split(':')
            if (phonePart.length >= 2) {
              contact.phones.push({ phone: phonePart.slice(1).join(':').trim(), label: 'Mobile' })
            }
          } else if (line.startsWith('NOTE:')) {
            contact.notes = line.substring(5).trim()
          }
        }

        if (contact.name) {
          createContact(contact)
          importedCount++
        } else {
          failedCount++
        }
      } catch (e) {
        failedCount++
      }
    }

    return { importedCount, failedCount }
  } catch (error: any) {
    return { importedCount: 0, failedCount: 0, error: error.message }
  }
}

export async function exportContactsVCard(filePath: string): Promise<boolean> {
  try {
    const contacts = listContacts()
    const lines: string[] = []

    for (const contact of contacts) {
      lines.push('BEGIN:VCARD')
      lines.push('VERSION:3.0')
      lines.push(`FN:${contact.name}`)
      lines.push(`N:${contact.name};;;;`)

      for (const email of contact.emails) {
        lines.push(`EMAIL;TYPE=INTERNET:${email.email}`)
      }

      for (const phone of contact.phones) {
        lines.push(`TEL;TYPE=CELL:${phone.phone}`)
      }

      if (contact.notes) {
        lines.push(`NOTE:${contact.notes.replace(/\n/g, '\\n')}`)
      }

      lines.push('END:VCARD')
    }

    await fs.writeFile(filePath, lines.join('\n'), 'utf-8')
    return true
  } catch (error) {
    return false
  }
}
