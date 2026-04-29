import { google } from 'googleapis'
import { readFileSync } from 'node:fs'

export function readServiceAccountCredentials() {
  if (process.env.GOOGLE_SERVICE_ACCOUNT_JSON) {
    try {
      return JSON.parse(process.env.GOOGLE_SERVICE_ACCOUNT_JSON)
    } catch {
      throw new Error('GOOGLE_SERVICE_ACCOUNT_JSON is not valid JSON.')
    }
  }

  if (process.env.GOOGLE_SERVICE_ACCOUNT_KEY_FILE) {
    return process.env.GOOGLE_SERVICE_ACCOUNT_KEY_FILE
  }

  if (process.env.GOOGLE_APPLICATION_CREDENTIALS) {
    return process.env.GOOGLE_APPLICATION_CREDENTIALS
  }

  throw new Error(
    'Missing service account credentials. Set GOOGLE_SERVICE_ACCOUNT_JSON or GOOGLE_SERVICE_ACCOUNT_KEY_FILE.',
  )
}

export function createSheetsClient() {
  const credentials = readServiceAccountCredentials()

  const auth = new google.auth.GoogleAuth({
    credentials: typeof credentials === 'object' ? credentials : undefined,
    keyFile: typeof credentials === 'string' ? credentials : undefined,
    scopes: ['https://www.googleapis.com/auth/spreadsheets'],
  })

  return google.sheets({ version: 'v4', auth })
}

export async function resolveSheetName(sheets, spreadsheetId, sheetName, gid) {
  if (sheetName) {
    return sheetName
  }

  if (!gid && gid !== 0) {
    throw new Error('sheetName or gid is required.')
  }

  const metadata = await sheets.spreadsheets.get({
    spreadsheetId,
    fields: 'sheets(properties(sheetId,title))',
  })

  const target = (metadata.data.sheets || []).find(
    (sheet) => String(sheet.properties?.sheetId) === String(gid),
  )

  if (!target?.properties?.title) {
    throw new Error(`Could not resolve sheet name from gid ${gid}.`)
  }

  return target.properties.title
}
