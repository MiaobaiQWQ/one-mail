import { getDatabase, toNumber, toOptionalString, type SqliteRow } from '../connection'
import type {
  Contact,
  ContactInput,
  ContactGroup,
  ContactEmail,
  ContactPhone
} from '../../../shared/types'

type ContactRow = SqliteRow & {
  id: number
  name: string
  avatar_url: string | null
  notes: string | null
  created_at: string
  updated_at: string
}

type ContactGroupRow = SqliteRow & {
  id: number
  name: string
  created_at: string
  updated_at: string
}

type ContactEmailRow = SqliteRow & {
  id: number
  contact_id: number
  email: string
  label: string | null
}

type ContactPhoneRow = SqliteRow & {
  id: number
  contact_id: number
  phone: string
  label: string | null
}

export function listContacts(): Contact[] {
  const db = getDatabase()
  const rows = db.prepare<ContactRow>('SELECT * FROM onemail_contacts ORDER BY name ASC').all()

  return rows.map((row) => getContactDetails(toNumber(row.id), row))
}

export function getContact(id: number): Contact | null {
  const db = getDatabase()
  const row = db.prepare<ContactRow>('SELECT * FROM onemail_contacts WHERE id = ?').get(id)

  if (!row) return null
  return getContactDetails(id, row)
}

function getContactDetails(id: number, row: ContactRow): Contact {
  const db = getDatabase()

  const emails = db
    .prepare<ContactEmailRow>('SELECT * FROM onemail_contact_emails WHERE contact_id = ?')
    .all(id)
    .map((e) => ({
      id: toNumber(e.id),
      email: e.email,
      label: toOptionalString(e.label)
    }))

  const phones = db
    .prepare<ContactPhoneRow>('SELECT * FROM onemail_contact_phones WHERE contact_id = ?')
    .all(id)
    .map((p) => ({
      id: toNumber(p.id),
      phone: p.phone,
      label: toOptionalString(p.label)
    }))

  const groupIds = db
    .prepare<SqliteRow & { group_id: number }>(
      'SELECT group_id FROM onemail_contact_group_members WHERE contact_id = ?'
    )
    .all(id)
    .map((g) => toNumber(g.group_id))

  return {
    id: toNumber(row.id),
    name: row.name,
    avatarUrl: toOptionalString(row.avatar_url),
    notes: toOptionalString(row.notes),
    createdAt: row.created_at,
    updatedAt: row.updated_at,
    emails,
    phones,
    groupIds
  }
}

export function createContact(input: ContactInput): Contact {
  const db = getDatabase()
  let contactId = 0

  db.exec('BEGIN TRANSACTION')
  try {
    const result = db
      .prepare(
        `
      INSERT INTO onemail_contacts (name, avatar_url, notes)
      VALUES (:name, :avatarUrl, :notes)
    `
      )
      .run({
        name: input.name,
        avatarUrl: input.avatarUrl || null,
        notes: input.notes || null
      })

    contactId = Number(result.lastInsertRowid)

    insertContactRelations(contactId, input)

    db.exec('COMMIT')
  } catch (error) {
    db.exec('ROLLBACK')
    throw error
  }

  return getContact(contactId)!
}

export function updateContact(id: number, input: ContactInput): Contact {
  const db = getDatabase()

  db.exec('BEGIN TRANSACTION')
  try {
    db.prepare(
      `
      UPDATE onemail_contacts
      SET name = :name, avatar_url = :avatarUrl, notes = :notes, updated_at = strftime('%Y-%m-%dT%H:%M:%fZ', 'now')
      WHERE id = :id
    `
    ).run({
      id,
      name: input.name,
      avatarUrl: input.avatarUrl || null,
      notes: input.notes || null
    })

    db.prepare('DELETE FROM onemail_contact_emails WHERE contact_id = ?').run(id)
    db.prepare('DELETE FROM onemail_contact_phones WHERE contact_id = ?').run(id)
    db.prepare('DELETE FROM onemail_contact_group_members WHERE contact_id = ?').run(id)

    insertContactRelations(id, input)

    db.exec('COMMIT')
  } catch (error) {
    db.exec('ROLLBACK')
    throw error
  }

  return getContact(id)!
}

function insertContactRelations(contactId: number, input: ContactInput) {
  const db = getDatabase()

  const insertEmail = db.prepare(
    'INSERT INTO onemail_contact_emails (contact_id, email, label) VALUES (?, ?, ?)'
  )
  for (const email of input.emails) {
    insertEmail.run(contactId, email.email, email.label || null)
  }

  const insertPhone = db.prepare(
    'INSERT INTO onemail_contact_phones (contact_id, phone, label) VALUES (?, ?, ?)'
  )
  for (const phone of input.phones) {
    insertPhone.run(contactId, phone.phone, phone.label || null)
  }

  const insertGroup = db.prepare(
    'INSERT INTO onemail_contact_group_members (contact_id, group_id) VALUES (?, ?)'
  )
  for (const groupId of input.groupIds) {
    insertGroup.run(contactId, groupId)
  }
}

export function deleteContact(id: number): boolean {
  const db = getDatabase()
  const result = db.prepare('DELETE FROM onemail_contacts WHERE id = ?').run(id)
  return result.changes > 0
}

export function listContactGroups(): ContactGroup[] {
  const db = getDatabase()
  const rows = db
    .prepare<ContactGroupRow>('SELECT * FROM onemail_contact_groups ORDER BY name ASC')
    .all()
  return rows.map((row) => ({
    id: toNumber(row.id),
    name: row.name,
    createdAt: row.created_at,
    updatedAt: row.updated_at
  }))
}

export function createContactGroup(name: string): ContactGroup {
  const db = getDatabase()
  const result = db.prepare('INSERT INTO onemail_contact_groups (name) VALUES (?)').run(name)
  const id = Number(result.lastInsertRowid)
  const row = db
    .prepare<ContactGroupRow>('SELECT * FROM onemail_contact_groups WHERE id = ?')
    .get(id)!
  return {
    id: toNumber(row.id),
    name: row.name,
    createdAt: row.created_at,
    updatedAt: row.updated_at
  }
}

export function deleteContactGroup(id: number): boolean {
  const db = getDatabase()
  const result = db.prepare('DELETE FROM onemail_contact_groups WHERE id = ?').run(id)
  return result.changes > 0
}
