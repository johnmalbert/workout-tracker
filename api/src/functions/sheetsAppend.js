import { app } from '@azure/functions'
import { createSheetsClient, resolveSheetName } from '../shared.js'

app.http('sheetsAppend', {
  methods: ['POST'],
  authLevel: 'anonymous',
  route: 'sheets/append',
  handler: async (request) => {
    const body = await request.json()
    const { spreadsheetId, sheetName, gid, rowValues, rowValuesList } = body || {}
    const valuesToAppend = Array.isArray(rowValuesList)
      ? rowValuesList
      : Array.isArray(rowValues)
        ? [rowValues]
        : []

    if (!spreadsheetId || (!sheetName && gid === undefined) || !valuesToAppend.length) {
      return {
        status: 400,
        jsonBody: {
          error: {
            message:
              'spreadsheetId, (sheetName or gid), and rowValues[] or rowValuesList[][] are required.',
          },
        },
      }
    }

    try {
      const sheets = createSheetsClient()
      const resolvedSheetName = await resolveSheetName(sheets, spreadsheetId, sheetName, gid)

      // Find the true last row so we always append at the bottom,
      // regardless of blank rows separating sections.
      const existing = await sheets.spreadsheets.values.get({
        spreadsheetId,
        range: `${resolvedSheetName}!A:A`,
      })
      const lastRow = (existing.data.values || []).length
      const appendRange = `${resolvedSheetName}!A${lastRow + 1}`

      const result = await sheets.spreadsheets.values.update({
        spreadsheetId,
        range: appendRange,
        valueInputOption: 'USER_ENTERED',
        requestBody: { values: valuesToAppend },
      })
      return {
        jsonBody: {
          sheetName: resolvedSheetName,
          updates: result.data || {},
        },
      }
    } catch (error) {
      return {
        status: 500,
        jsonBody: { error: { message: error?.message || 'Failed to append row to Google Sheet.' } },
      }
    }
  },
})
