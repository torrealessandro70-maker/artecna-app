'use client'

import { getRuntimeState } from '../engines/runtime'

export default function RuntimeInspector() {
  const runtime = getRuntimeState()

  return (
    <div
      style={{
        marginTop: 12,
        padding: 12,
        border: '1px solid #e2e8f0',
        borderRadius: 10,
        background: '#f8fafc',
        fontSize: 13,
      }}
    >
      <div style={{ fontWeight: 800, marginBottom: 8 }}>
        ⚙️ Runtime Inspector
      </div>

      <div>
        <strong>State:</strong> {runtime.state}
      </div>

      <div>
        <strong>Updated:</strong> {runtime.updatedAt}
      </div>
    </div>
  )
}