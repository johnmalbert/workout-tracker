import { useCallback, useEffect, useMemo, useState } from 'react'
import './App.css'

const SPREADSHEET_ID = '1Mrj-_hF3wIvlNWAR7uYbHKVADL1lHwcQjA3Nrw1ZO3s'

const TARGET_SHEET_NAME = 'Organized'

function parseDateLike(value) {
  const raw = String(value || '').trim()
  if (!raw) {
    return null
  }

  const date = new Date(raw)
  return Number.isNaN(date.getTime()) ? null : date
}

function isExerciseHeaderRow(row) {
  const a = String(row?.[0] || '').trim().toLowerCase()
  const b = String(row?.[1] || '').trim().toLowerCase()
  const c = String(row?.[2] || '').trim().toLowerCase()
  return a === 'exercise' && b === 'reps' && c === 'weight'
}

function parseOrganizedValues(values) {
  const sessions = []
  const rows = []
  let index = 0

  while (index < values.length) {
    const currentRow = values[index] || []
    const firstCell = String(currentRow[0] || '').trim()
    const nextRow = values[index + 1] || []

    const sectionMatch = firstCell.match(/^(.*)\s-\s(.+)$/)
    if (!sectionMatch || !isExerciseHeaderRow(nextRow)) {
      index += 1
      continue
    }

    const workout = sectionMatch[1].trim()
    const date = sectionMatch[2].trim()
    const entries = []
    index += 2

    while (index < values.length) {
      const entryRow = values[index] || []
      const exercise = String(entryRow[0] || '').trim()
      const reps = String(entryRow[1] || '').trim()
      const weight = String(entryRow[2] || '').trim()

      if (!exercise) {
        index += 1
        break
      }

      const potentialSection = exercise.match(/^(.*)\s-\s(.+)$/)
      if (potentialSection && isExerciseHeaderRow(values[index + 1] || [])) {
        break
      }

      entries.push({ exercise, reps, weight })
      rows.push({ workout, exercise, date, reps, weight })
      index += 1
    }

    sessions.push({ workout, date, entries })
  }

  return { sessions, rows }
}

function toSectionDate(inputDate) {
  const parsed = new Date(`${inputDate}T00:00:00`)
  if (Number.isNaN(parsed.getTime())) {
    return inputDate
  }
  return parsed.toLocaleDateString('en-US')
}

function estimateTotalWeight(rows) {
  return rows.reduce((sum, row) => {
    const weightText = String(row.weight || '')
    const numbers = weightText.match(/\d+(?:\.\d+)?/g) || []
    const rowTotal = numbers.reduce((rowSum, value) => rowSum + Number(value), 0)
    return sum + rowTotal
  }, 0)
}

function App() {
  const [sheetName, setSheetName] = useState(TARGET_SHEET_NAME)
  const [rows, setRows] = useState([])
  const [selectedWorkout, setSelectedWorkout] = useState('')
  const [entryDate, setEntryDate] = useState(new Date().toISOString().slice(0, 10))
  const [selectedEntryExercise, setSelectedEntryExercise] = useState('')
  const [newExerciseName, setNewExerciseName] = useState('')
  const [addedExercises, setAddedExercises] = useState([])
  const [currentInputReps, setCurrentInputReps] = useState('')
  const [currentInputWeight, setCurrentInputWeight] = useState('')
  const [draftEntries, setDraftEntries] = useState({})
  const [status, setStatus] = useState('Loading workouts...')

  const workouts = useMemo(() => {
    return [...new Set(rows.map((row) => String(row.workout || '').trim()).filter(Boolean))].sort()
  }, [rows])

  const exercises = useMemo(() => {
    if (!selectedWorkout) {
      return []
    }

    return [
      ...new Set(
        rows
          .filter((row) => String(row.workout || '').trim().toLowerCase() === selectedWorkout.toLowerCase())
          .map((row) => String(row.exercise || '').trim())
          .filter(Boolean),
      ),
    ]
  }, [rows, selectedWorkout])

  const entryExercises = useMemo(() => {
    const seen = new Set()
    return [...exercises, ...addedExercises].filter((exercise) => {
      const key = exercise.toLowerCase()
      if (seen.has(key)) {
        return false
      }
      seen.add(key)
      return true
    })
  }, [addedExercises, exercises])

  const latestPerExercise = useMemo(() => {
    if (!selectedWorkout) {
      return {}
    }

    const filtered = rows.filter(
      (row) => String(row.workout || '').trim().toLowerCase() === selectedWorkout.toLowerCase(),
    )

    const latest = {}
    exercises.forEach((exercise) => {
      const options = filtered
        .filter((row) => String(row.exercise || '').trim().toLowerCase() === exercise.toLowerCase())
        .map((row) => ({
          dateText: String(row.date || '').trim(),
          repsText: String(row.reps || '').trim(),
          weightText: String(row.weight || '').trim(),
          parsedDate: parseDateLike(row.date),
        }))
        .sort((a, b) => {
          if (a.parsedDate && b.parsedDate) {
            return b.parsedDate.getTime() - a.parsedDate.getTime()
          }
          return b.dateText.localeCompare(a.dateText)
        })

      latest[exercise] = options[0] || { dateText: '-', repsText: '-', weightText: '-' }
    })

    return latest
  }, [exercises, rows, selectedWorkout])

  const activeExercise = selectedEntryExercise

  const loadSheet = useCallback(async () => {
    try {
      const response = await fetch('/api/sheets/read', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ spreadsheetId: SPREADSHEET_ID, sheetName: TARGET_SHEET_NAME }),
      })

      const payload = await response.json()
      if (!response.ok) {
        setStatus(payload?.error?.message || 'Failed to read Google Sheet.')
        return
      }

      const parsed = parseOrganizedValues(payload.values || [])
      setSheetName(payload.sheetName || TARGET_SHEET_NAME)
      setRows(parsed.rows)
      setSelectedWorkout('')
      setSelectedEntryExercise('')
      setAddedExercises([])
      setNewExerciseName('')
      setDraftEntries({})
      setCurrentInputReps('')
      setCurrentInputWeight('')
      const totalWeight = Math.round(estimateTotalWeight(parsed.rows))
      setStatus(
        `Momentum looks great: ${parsed.sessions.length} sessions, ~${totalWeight.toLocaleString()} lbs logged so far.`,
      )
    } catch {
      setStatus('Could not reach API. Start backend with npm run server or npm run dev:all.')
    }
  }, [])

  useEffect(() => {
    const timer = setTimeout(() => {
      loadSheet()
    }, 0)

    return () => clearTimeout(timer)
  }, [loadSheet])

  const startEntry = () => {
    if (!selectedWorkout || !entryDate) {
      setStatus('Select a workout and date first.')
      return
    }
    if (!entryExercises.length) {
      setStatus('No exercises found for selected workout.')
      return
    }

    setDraftEntries({})
    if (!selectedEntryExercise && entryExercises.length) {
      setSelectedEntryExercise(entryExercises[0])
    }
    setCurrentInputReps('')
    setCurrentInputWeight('')
    setStatus(`Now entering ${selectedWorkout} for ${entryDate}.`)
  }

  const saveAndNext = () => {
    if (!activeExercise) {
      setStatus('Start an entry first.')
      return
    }
    if (!currentInputReps.trim() && !currentInputWeight.trim()) {
      setStatus('Enter at least Reps or Weight before moving next.')
      return
    }

    setDraftEntries((previous) => ({
      ...previous,
      [activeExercise]: {
        reps: currentInputReps.trim(),
        weight: currentInputWeight.trim(),
      },
    }))
    setCurrentInputReps('')
    setCurrentInputWeight('')
    setStatus(`Saved entry for ${activeExercise}.`)
  }

  const addNewExercise = () => {
    const candidate = newExerciseName.trim()
    if (!selectedWorkout) {
      setStatus('Select a workout first, then add a new exercise.')
      return
    }
    if (!candidate) {
      setStatus('Type an exercise name to add it.')
      return
    }

    const exists = entryExercises.some((exercise) => exercise.toLowerCase() === candidate.toLowerCase())
    if (exists) {
      setStatus('That exercise already exists in this workout.')
      return
    }

    setAddedExercises((previous) => [...previous, candidate])
    if (!selectedEntryExercise) {
      setSelectedEntryExercise(candidate)
    }
    setNewExerciseName('')
    setStatus(`Added new exercise: ${candidate}`)
  }

  const saveWorkout = async () => {
    const entryRows = entryExercises
      .filter((exercise) => draftEntries[exercise])
      .map((exercise) => [exercise, draftEntries[exercise].reps, draftEntries[exercise].weight])

    if (!entryRows.length) {
      setStatus('No exercise values entered yet.')
      return
    }

    const sectionDate = toSectionDate(entryDate)
    const sectionRows = [[''], [`${selectedWorkout} - ${sectionDate}`], ['Exercise', 'Reps', 'Weight'], ...entryRows]

    try {
      const response = await fetch('/api/sheets/append', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ spreadsheetId: SPREADSHEET_ID, sheetName: TARGET_SHEET_NAME, rowValuesList: sectionRows }),
      })
      const payload = await response.json()
      if (!response.ok) {
        setStatus(payload?.error?.message || 'Failed to save workout.')
        return
      }

      setStatus(
        `Saved session ${selectedWorkout} - ${sectionDate} with ${entryRows.length} exercise rows to ${payload.sheetName || sheetName}.`,
      )
      await loadSheet()
    } catch {
      setStatus('Could not save workout to Google Sheet.')
    }
  }

  return (
    <main className="app-shell">
      <section className="hero">
        <p className="badge">Workout Tracker</p>
        <h1>Workout Log</h1>
        <p className="hero-copy">
          <a
            href={`https://docs.google.com/spreadsheets/d/${SPREADSHEET_ID}/edit`}
            target="_blank"
            rel="noreferrer"
          >
            Open Spreadsheet
          </a>
        </p>
        <p className="status">{status}</p>
      </section>

      <section className="panel grid-two">
        <div className="card">
          <h2>1) Select Workout</h2>
          <p className="hint">Each workout contains a set of exercises. Select one below to log today&apos;s session.</p>
          <label className="field">
            Workout
            <select
              value={selectedWorkout}
              onChange={(event) => {
                setSelectedWorkout(event.target.value)
                setSelectedEntryExercise('')
                setAddedExercises([])
                setNewExerciseName('')
                setCurrentInputReps('')
                setCurrentInputWeight('')
                setDraftEntries({})
              }}
              disabled={!workouts.length}
            >
              <option value="">Select workout</option>
              {workouts.map((workout) => (
                <option key={workout} value={workout}>
                  {workout}
                </option>
              ))}
            </select>
          </label>

          <label className="field">
            New Date
            <input type="date" value={entryDate} onChange={(event) => setEntryDate(event.target.value)} />
          </label>

          <button type="button" className="action" onClick={startEntry}>
            Begin Workout
          </button>

          <label className="field">
            Add New Exercise
            <input
              value={newExerciseName}
              onChange={(event) => setNewExerciseName(event.target.value)}
              placeholder="ex: Incline Bench Press"
            />
          </label>
          <button type="button" className="action" onClick={addNewExercise}>
            Add Exercise to Workout
          </button>
        </div>

        <div className="card">
          <h2>Exercises + Latest</h2>
          <ul className="type-list latest-list">
            {entryExercises.map((exercise) => (
              <li key={exercise}>
                <span className="exercise-name">{exercise}</span>
                <span className="latest-data">
                  {latestPerExercise[exercise]?.dateText || '-'} | Reps: {latestPerExercise[exercise]?.repsText || '-'} | Weight: {latestPerExercise[exercise]?.weightText || '-'}
                </span>
              </li>
            ))}
            {!exercises.length && <li>No exercises found.</li>}
          </ul>
        </div>
      </section>

      <section className="panel grid-two">
        <div className="card">
          <h2>2) One-by-One Entry</h2>
          <label className="field">
            Current Exercise
            <select
              value={selectedEntryExercise}
              onChange={(event) => setSelectedEntryExercise(event.target.value)}
              disabled={!entryExercises.length}
            >
              <option value="">Select exercise</option>
              {entryExercises.map((exercise) => (
                <option key={exercise} value={exercise}>
                  {exercise}
                </option>
              ))}
            </select>
          </label>
          <label className="field">
            Reps
            <input
              value={currentInputReps}
              onChange={(event) => setCurrentInputReps(event.target.value)}
              placeholder="ex: 10"
            />
          </label>
          <label className="field">
            Weight
            <input
              value={currentInputWeight}
              onChange={(event) => setCurrentInputWeight(event.target.value)}
              placeholder="ex: 185"
            />
          </label>
          <button type="button" className="action" onClick={saveAndNext}>
            Save Entry
          </button>
        </div>

        <div className="card table-card">
          <h2>Current Workout - Click Save when Finished</h2>
          <div className="table-wrap">
            <table>
              <thead>
                <tr>
                  <th>Exercise</th>
                  <th>Reps</th>
                  <th>Weight</th>
                </tr>
              </thead>
              <tbody>
                {Object.entries(draftEntries).map(([exercise, values]) => (
                  <tr key={exercise}>
                    <td>{exercise}</td>
                    <td>{values.reps}</td>
                    <td>{values.weight}</td>
                  </tr>
                ))}
                {!Object.keys(draftEntries).length && (
                  <tr>
                    <td colSpan="3">No values captured yet.</td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
          <button type="button" className="action" onClick={saveWorkout}>
            Save Workout To Sheet
          </button>
        </div>
      </section>
    </main>
  )
}

export default App
