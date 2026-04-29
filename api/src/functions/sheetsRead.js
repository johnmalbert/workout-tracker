import { app } from '@azure/functions'
import { createSheetsClient, resolveSheetName } from '../shared.js'

app.http('sheetsRead', {
  methods: ['POST'],
  authLevel: 'anonymous',
  route: 'sheets/read',
  handler: async (request) => {
    const body = await request.json()
    const { spreadsheetId, sheetName, gid } = body || {}

    if (!spreadsheetId || (!sheetName && gid === undefined)) {
      return {
        status: 400,
        jsonBody: { error: { message: 'spreadsheetId and either sheetName or gid are required.' } },
      }
    }

    try {
      const sheets = createSheetsClient()
      const resolvedSheetName = await resolveSheetName(sheets, spreadsheetId, sheetName, gid)
      const range = `${resolvedSheetName}!A1:ZZ`
      const result = await sheets.spreadsheets.values.get({ spreadsheetId, range })
      return {
        jsonBody: {
          sheetName: resolvedSheetName,
          values: result.data.values || [],
        },
      }
    } catch (error) {
      return {
        status: 500,
        jsonBody: { error: { message: error?.message || 'Failed to read Google Sheet.' } },
      }
    }
  },
})
