import cors from 'cors'
import dotenv from 'dotenv'
import express from 'express'
import { google } from 'googleapis'

dotenv.config()

const app = express()
const port = Number(process.env.PORT || 8787)

app.use(cors())
app.use(express.json())

function readServiceAccountCredentials() {
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

function createSheetsClient() {
  const credentials = readServiceAccountCredentials()

  const auth = new google.auth.GoogleAuth({
    credentials: typeof credentials === 'object' ? credentials : undefined,
    keyFile: typeof credentials === 'string' ? credentials : undefined,
    scopes: ['https://www.googleapis.com/auth/spreadsheets'],
  })

  return google.sheets({ version: 'v4', auth })
}

async function resolveSheetName(sheets, spreadsheetId, sheetName, gid) {
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

app.get('/api/health', (_req, res) => {
  res.json({ ok: true })
})

app.post('/api/sheets/read', async (req, res) => {
  const { spreadsheetId, sheetName, gid } = req.body || {}
  if (!spreadsheetId || (!sheetName && gid === undefined)) {
    return res.status(400).json({ error: { message: 'spreadsheetId and either sheetName or gid are required.' } })
  }

  try {
    const sheets = createSheetsClient()
    const resolvedSheetName = await resolveSheetName(sheets, spreadsheetId, sheetName, gid)
    const range = `${resolvedSheetName}!A1:ZZ`
    const result = await sheets.spreadsheets.values.get({ spreadsheetId, range })
    return res.json({
      sheetName: resolvedSheetName,
      values: result.data.values || [],
    })
  } catch (error) {
    return res.status(500).json({
      error: {
        message: error?.message || 'Failed to read Google Sheet.',
      },
    })
  }
})

app.post('/api/sheets/append', async (req, res) => {
  const { spreadsheetId, sheetName, gid, rowValues, rowValuesList } = req.body || {}
  const valuesToAppend = Array.isArray(rowValuesList)
    ? rowValuesList
    : Array.isArray(rowValues)
      ? [rowValues]
      : []

  if (!spreadsheetId || (!sheetName && gid === undefined) || !valuesToAppend.length) {
    return res
      .status(400)
      .json({
        error: {
          message:
            'spreadsheetId, (sheetName or gid), and rowValues[] or rowValuesList[][] are required.',
        },
      })
  }

  try {
    const sheets = createSheetsClient()
    const resolvedSheetName = await resolveSheetName(sheets, spreadsheetId, sheetName, gid)
    const range = `${resolvedSheetName}!A1`
    const result = await sheets.spreadsheets.values.append({
      spreadsheetId,
      range,
      valueInputOption: 'USER_ENTERED',
      insertDataOption: 'INSERT_ROWS',
      requestBody: {
        values: valuesToAppend,
      },
    })

    return res.json({
      sheetName: resolvedSheetName,
      updates: result.data.updates || {},
    })
  } catch (error) {
    return res.status(500).json({
      error: {
        message: error?.message || 'Failed to append row to Google Sheet.',
      },
    })
  }
})

app.listen(port, () => {
  console.log(`Workout Tracker API listening on http://localhost:${port}`)
})
