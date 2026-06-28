import { createHash, createHmac } from 'node:crypto'
import type {
  BackupSyncDownloadResult,
  BackupSyncSettings,
  BackupSyncTransferResult
} from '../ipc/types'
import { getBackupSyncSettingsForMain } from '../db/repositories/settings.repository'
import { createDatabaseSqlBackup, importDatabaseSqlBackupContent } from './database-backup'

type ConfiguredBackupSyncSettings = Exclude<BackupSyncSettings, { provider: 'none' }>

type RemoteDownload = {
  sql: string
  remotePath: string
  sourceName: string
}

const EMPTY_SHA256 = sha256('')

export async function uploadBackupSync(): Promise<BackupSyncTransferResult> {
  const settings = requireBackupSyncSettings()
  const backup = createDatabaseSqlBackup()
  const remotePath =
    settings.provider === 'webdav'
      ? await uploadWebDavBackup(settings, backup.sql)
      : await uploadS3Backup(settings, backup.sql)

  return {
    provider: settings.provider,
    remotePath,
    fileName: backup.fileName,
    exportedAt: backup.exportedAt,
    transferredAt: new Date().toISOString()
  }
}

export async function downloadBackupSync(): Promise<BackupSyncDownloadResult> {
  const settings = requireBackupSyncSettings()
  const remote =
    settings.provider === 'webdav'
      ? await downloadWebDavBackup(settings)
      : await downloadS3Backup(settings)
  const imported = importDatabaseSqlBackupContent(remote.sql, remote.sourceName)

  return {
    ...imported,
    provider: settings.provider,
    remotePath: remote.remotePath
  }
}

function requireBackupSyncSettings(): ConfiguredBackupSyncSettings {
  const settings = getBackupSyncSettingsForMain()
  if (settings.provider === 'none') {
    throw new Error('请先配置 WebDAV 或 S3 远端同步。')
  }

  return settings
}

async function uploadWebDavBackup(
  settings: Extract<BackupSyncSettings, { provider: 'webdav' }>,
  sql: string
): Promise<string> {
  const response = await fetch(settings.remoteUrl, {
    method: 'PUT',
    headers: buildWebDavHeaders(settings, {
      'content-type': 'application/sql; charset=utf-8'
    }),
    body: sql
  })

  if (!response.ok) {
    throw new Error(`WebDAV 上传失败：HTTP ${response.status}`)
  }

  return settings.remoteUrl
}

async function downloadWebDavBackup(
  settings: Extract<BackupSyncSettings, { provider: 'webdav' }>
): Promise<RemoteDownload> {
  const response = await fetch(settings.remoteUrl, {
    method: 'GET',
    headers: buildWebDavHeaders(settings)
  })

  if (!response.ok) {
    throw new Error(`WebDAV 下载失败：HTTP ${response.status}`)
  }

  return {
    sql: await response.text(),
    remotePath: settings.remoteUrl,
    sourceName: new URL(settings.remoteUrl).pathname.split('/').at(-1) ?? 'onemail-backup.sql'
  }
}

function buildWebDavHeaders(
  settings: Extract<BackupSyncSettings, { provider: 'webdav' }>,
  headers: Record<string, string> = {}
): Record<string, string> {
  const nextHeaders = { ...headers }

  if (settings.username || settings.password) {
    nextHeaders.authorization = `Basic ${Buffer.from(
      `${settings.username ?? ''}:${settings.password ?? ''}`,
      'utf8'
    ).toString('base64')}`
  }

  return nextHeaders
}

async function uploadS3Backup(
  settings: Extract<BackupSyncSettings, { provider: 's3' }>,
  sql: string
): Promise<string> {
  const response = await signedS3Request(settings, 'PUT', sql)

  if (!response.ok) {
    throw new Error(`S3 上传失败：HTTP ${response.status}`)
  }

  return buildS3ObjectUrl(settings).toString()
}

async function downloadS3Backup(
  settings: Extract<BackupSyncSettings, { provider: 's3' }>
): Promise<RemoteDownload> {
  const response = await signedS3Request(settings, 'GET')

  if (!response.ok) {
    throw new Error(`S3 下载失败：HTTP ${response.status}`)
  }

  return {
    sql: await response.text(),
    remotePath: buildS3ObjectUrl(settings).toString(),
    sourceName: settings.key.split('/').at(-1) ?? 'onemail-backup.sql'
  }
}

async function signedS3Request(
  settings: Extract<BackupSyncSettings, { provider: 's3' }>,
  method: 'GET' | 'PUT',
  body = ''
): Promise<Response> {
  const url = buildS3ObjectUrl(settings)
  const now = new Date()
  const amzDate = formatAmzDate(now)
  const dateStamp = amzDate.slice(0, 8)
  const payloadHash = method === 'GET' ? EMPTY_SHA256 : sha256(body)
  const headers: Record<string, string> = {
    host: url.host,
    'x-amz-content-sha256': payloadHash,
    'x-amz-date': amzDate
  }

  if (method === 'PUT') {
    headers['content-type'] = 'application/sql; charset=utf-8'
  }

  headers.authorization = createS3Authorization({
    settings,
    method,
    url,
    headers,
    payloadHash,
    dateStamp,
    amzDate
  })

  return fetch(url, {
    method,
    headers,
    body: method === 'PUT' ? body : undefined
  })
}

function createS3Authorization({
  settings,
  method,
  url,
  headers,
  payloadHash,
  dateStamp,
  amzDate
}: {
  settings: Extract<BackupSyncSettings, { provider: 's3' }>
  method: 'GET' | 'PUT'
  url: URL
  headers: Record<string, string>
  payloadHash: string
  dateStamp: string
  amzDate: string
}): string {
  const region = settings.region || 'us-east-1'
  const credentialScope = `${dateStamp}/${region}/s3/aws4_request`
  const signedHeaderNames = Object.keys(headers)
    .map((header) => header.toLowerCase())
    .sort()
  const canonicalHeaders = signedHeaderNames
    .map((header) => `${header}:${headers[header].trim().replace(/\s+/g, ' ')}`)
    .join('\n')
  const signedHeaders = signedHeaderNames.join(';')
  const canonicalRequest = [
    method,
    url.pathname || '/',
    url.searchParams.toString(),
    `${canonicalHeaders}\n`,
    signedHeaders,
    payloadHash
  ].join('\n')
  const stringToSign = [
    'AWS4-HMAC-SHA256',
    amzDate,
    credentialScope,
    sha256(canonicalRequest)
  ].join('\n')
  const signature = hmacHex(
    deriveS3SigningKey(settings.secretAccessKey ?? '', dateStamp, region),
    stringToSign
  )

  return `AWS4-HMAC-SHA256 Credential=${settings.accessKeyId}/${credentialScope}, SignedHeaders=${signedHeaders}, Signature=${signature}`
}

function deriveS3SigningKey(secretAccessKey: string, dateStamp: string, region: string): Buffer {
  const dateKey = hmacBuffer(`AWS4${secretAccessKey}`, dateStamp)
  const regionKey = hmacBuffer(dateKey, region)
  const serviceKey = hmacBuffer(regionKey, 's3')
  return hmacBuffer(serviceKey, 'aws4_request')
}

function buildS3ObjectUrl(settings: Extract<BackupSyncSettings, { provider: 's3' }>): URL {
  const keyPath = encodeS3Path(settings.key)

  if (settings.endpoint) {
    const endpoint = new URL(settings.endpoint)
    endpoint.pathname = joinUrlPath(endpoint.pathname, settings.bucket, keyPath)
    endpoint.search = ''
    return endpoint
  }

  return new URL(
    `https://${settings.bucket}.s3.${settings.region || 'us-east-1'}.amazonaws.com/${keyPath}`
  )
}

function encodeS3Path(value: string): string {
  return value
    .split('/')
    .filter(Boolean)
    .map((part) => encodeURIComponent(part))
    .join('/')
}

function joinUrlPath(...parts: string[]): string {
  const joined = parts
    .flatMap((part) => part.split('/'))
    .filter(Boolean)
    .join('/')

  return `/${joined}`
}

function formatAmzDate(date: Date): string {
  return date.toISOString().replace(/[:-]|\.\d{3}/g, '')
}

function sha256(value: string): string {
  return createHash('sha256').update(value, 'utf8').digest('hex')
}

function hmacBuffer(key: string | Buffer, value: string): Buffer {
  return createHmac('sha256', key).update(value, 'utf8').digest()
}

function hmacHex(key: string | Buffer, value: string): string {
  return createHmac('sha256', key).update(value, 'utf8').digest('hex')
}
