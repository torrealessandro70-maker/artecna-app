'use client'
import { useState, useEffect } from 'react'

type Settings = {
  fontFamily: string
  fontSize: string
  headerTitle: string
}

const FONT_OPTIONS = [
  'Arial, Helvetica, sans-serif',
  'Roboto, sans-serif',
  'Verdana, Geneva, sans-serif',
  'Times New Roman, serif',
  'Courier New, monospace'
]

export default function SettingsMenu() {
  const [settings, setSettings] = useState<Settings>({
    fontFamily: 'Arial, Helvetica, sans-serif',
    fontSize: '16px',
    headerTitle: 'ARTECNA'
  })

  useEffect(() => {
    // Carica impostazioni salvate
    const saved = localStorage.getItem('appSettings')
    if (saved) {
      const parsed = JSON.parse(saved)
      setSettings(parsed)
      applySettings(parsed)
    } else {
      applySettings(settings)
    }
  }, [])

  const applySettings = (s: Settings) => {
    document.documentElement.style.setProperty('--app-font-family', s.fontFamily)
    document.documentElement.style.setProperty('--app-font-size', s.fontSize)
  }

  const handleChange = (key: keyof Settings, value: string) => {
    const newSettings = { ...settings, [key]: value }
    setSettings(newSettings)
    localStorage.setItem('appSettings', JSON.stringify(newSettings))
    applySettings(newSettings)
  }

  return (
    <div className="p-4 bg-gray-50 rounded shadow space-y-4">
      <h2 className="text-lg font-bold">Impostazioni</h2>

      {/* Anteprima live */}
      <div className="p-2 border rounded" style={{ fontFamily: settings.fontFamily, fontSize: settings.fontSize }}>
        Anteprima: {settings.headerTitle} – questo testo cambierà con le impostazioni
      </div>

      {/* Font */}
      <div className="space-y-1">
        <label className="block font-medium">Font</label>
        <select
          value={settings.fontFamily}
          onChange={(e) => handleChange('fontFamily', e.target.value)}
          className="border p-2 w-full"
        >
          {FONT_OPTIONS.map((font) => (
            <option key={font} value={font}>{font.split(',')[0]}</option>
          ))}
        </select>
      </div>

      {/* Dimensione */}
      <div className="space-y-1">
        <label className="block font-medium">Dimensione testo</label>
        <input
          type="number"
          value={parseInt(settings.fontSize)}
          onChange={(e) => handleChange('fontSize', e.target.value + 'px')}
          className="border p-2 w-full"
          min={10}
          max={36}
        />
      </div>

      {/* Intestazione */}
      <div className="space-y-1">
        <label className="block font-medium">Intestazione</label>
        <input
          type="text"
          value={settings.headerTitle}
          onChange={(e) => handleChange('headerTitle', e.target.value)}
          className="border p-2 w-full"
        />
      </div>
    </div>
  )
}