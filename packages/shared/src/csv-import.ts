/**
 * Parses a Chrome password export CSV (chrome://password-manager/passwords
 * → "Export passwords") into plain login records ready to be encrypted and
 * saved as vault items. Runs entirely client-side — the plaintext CSV
 * (Chrome only ever exports plaintext, there's no other option) never
 * leaves the browser; only the encrypted result of importing it does.
 */

export interface ImportedLogin {
  name: string
  username: string
  password: string
  website: string
  notes: string
}

/** Minimal RFC 4126-style CSV parser: handles quoted fields, embedded commas, and escaped ("") quotes — enough for Chrome's export format without pulling in a CSV library for one file shape. */
function parseCsvRows(text: string): string[][] {
  const rows: string[][] = []
  let row: string[] = []
  let field = ''
  let inQuotes = false

  for (let i = 0; i < text.length; i++) {
    const char = text[i]

    if (inQuotes) {
      if (char === '"') {
        if (text[i + 1] === '"') {
          field += '"'
          i++
        } else {
          inQuotes = false
        }
      } else {
        field += char
      }
      continue
    }

    if (char === '"') {
      inQuotes = true
    } else if (char === ',') {
      row.push(field)
      field = ''
    } else if (char === '\r') {
      // skip — \n (below) ends the row
    } else if (char === '\n') {
      row.push(field)
      rows.push(row)
      row = []
      field = ''
    } else {
      field += char
    }
  }

  if (field.length > 0 || row.length > 0) {
    row.push(field)
    rows.push(row)
  }

  return rows.filter((r) => !(r.length === 1 && r[0] === ''))
}

function hostnameOrRaw(url: string): string {
  try {
    return new URL(url).hostname || url
  } catch {
    return url
  }
}

export class CsvImportError extends Error {}

export function parseChromePasswordsCsv(csvText: string): ImportedLogin[] {
  const rows = parseCsvRows(csvText.trim())
  if (rows.length === 0) {
    return []
  }

  const header = rows[0].map((h) => h.trim().toLowerCase())
  const nameIdx = header.indexOf('name')
  const urlIdx = header.indexOf('url')
  const userIdx = header.indexOf('username')
  const passIdx = header.indexOf('password')
  const noteIdx = header.indexOf('note')

  if (userIdx === -1 || passIdx === -1) {
    throw new CsvImportError(
      'This doesn\'t look like a Chrome password export — expected "username" and "password" columns.',
    )
  }

  const items: ImportedLogin[] = []
  for (let i = 1; i < rows.length; i++) {
    const row = rows[i]
    if (row.every((c) => c.trim() === '')) {
      continue // blank line
    }

    const password = row[passIdx]?.trim() ?? ''
    if (!password) {
      continue // nothing usable to import
    }

    const website = urlIdx >= 0 ? (row[urlIdx]?.trim() ?? '') : ''
    const name = (nameIdx >= 0 ? row[nameIdx]?.trim() : '') || (website && hostnameOrRaw(website)) || 'Imported login'

    items.push({
      name,
      username: userIdx >= 0 ? (row[userIdx]?.trim() ?? '') : '',
      password,
      website,
      notes: noteIdx >= 0 ? (row[noteIdx]?.trim() ?? '') : '',
    })
  }

  return items
}
