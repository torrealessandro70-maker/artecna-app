'use client'

import { Suspense, useEffect, useState } from 'react'
import { useSearchParams } from 'next/navigation'
import { createClient } from '@supabase/supabase-js'

const supabase = createClient(
  'https://axuiaiglbahygsmeoypy.supabase.co',
  'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImF4dWlhaWdsYmFoeWdzbWVveXB5Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzY1OTY5ODYsImV4cCI6MjA5MjE3Mjk4Nn0.UU0rZN-8utUUXiuQHfkh-Z9sbhNmfpnJBsGMBqhzSIg'
)

type Cantiere = {
  id?: string
  nome: string
}

type Operaio = {
  id?: string
  nome: string
  pin?: string
}

type Timbratura = {
  id?: string
  operaio_nome: string
  cantiere: string
  data: string
  ora_entrata?: string
  ora_uscita?: string
  stato?: string
  created_at?: string
}

function TimbraContent() {
  const [pin, setPin] = useState('')
  const [tipo, setTipo] = useState<'entrata' | 'uscita'>('entrata')
  const [cantieri, setCantieri] = useState<Cantiere[]>([])
  const [cantiere, setCantiere] = useState('')

  const searchParams = useSearchParams()

  const oggi = new Date().toISOString().slice(0, 10)

  const ora = () => {
    const now = new Date()
    return now.toLocaleTimeString('it-IT', {
      hour: '2-digit',
      minute: '2-digit',
    })
  }

 useEffect(() => {
  caricaCantieri()
}, [])

useEffect(() => {
  const cantiereDaUrl = searchParams.get('cantiere')
  if (!cantiereDaUrl || cantieri.length === 0) return

  const valoreUrl = decodeURIComponent(cantiereDaUrl).trim().toLowerCase()

  const cantiereTrovato = cantieri.find(
    (c) => c.nome.trim().toLowerCase() === valoreUrl
  )

  if (cantiereTrovato) {
    setCantiere(cantiereTrovato.nome)
  }
}, [searchParams, cantieri])
  const caricaCantieri = async () => {
    const { data, error } = await supabase.from('cantieri').select('*').order('nome')

    if (error) {
      alert('Errore caricamento cantieri: ' + error.message)
      return
    }

    setCantieri((data || []) as Cantiere[])
  }

  const timbra = async () => {
    if (!pin) {
      alert('Inserisci PIN')
      return
    }

    if (!cantiere) {
      alert('Seleziona cantiere')
      return
    }

    const { data: operai, error: erroreOperai } = await supabase
      .from('operai')
      .select('*')
      .eq('pin', pin)

    if (erroreOperai) {
      alert('Errore ricerca operaio: ' + erroreOperai.message)
      return
    }

    if (!operai || operai.length === 0) {
      alert('PIN non valido')
      return
    }

    const operaio = operai[0] as Operaio

    if (tipo === 'entrata') {
      const { data: aperte, error: errCheck } = await supabase
        .from('timbrature')
        .select('*')
        .eq('operaio_nome', operaio.nome)
        .eq('cantiere', cantiere)
        .eq('data', oggi)
        .eq('stato', 'aperto')

      if (errCheck) {
        alert('Errore controllo timbratura: ' + errCheck.message)
        return
      }

      if (aperte && aperte.length > 0) {
        alert('Esiste già una timbratura aperta per questo operaio')
        return
      }

      const { error } = await supabase.from('timbrature').insert([
        {
          operaio_nome: operaio.nome,
          cantiere,
          data: oggi,
          ora_entrata: ora(),
          stato: 'aperto',
        },
      ])

      if (error) {
        alert('Errore timbratura: ' + error.message)
        return
      }
    } else {
      const { data: aperte, error: errFind } = await supabase
        .from('timbrature')
        .select('*')
        .eq('operaio_nome', operaio.nome)
        .eq('cantiere', cantiere)
        .eq('data', oggi)
        .eq('stato', 'aperto')
        .order('created_at', { ascending: false })

      if (errFind) {
        alert('Errore ricerca timbratura aperta: ' + errFind.message)
        return
      }

      if (!aperte || aperte.length === 0) {
        alert('Nessuna entrata aperta trovata')
        return
      }

      const timbraturaAperta = aperte[0] as Timbratura

      const { error } = await supabase
        .from('timbrature')
        .update({
          ora_uscita: ora(),
          stato: 'chiuso',
        })
        .eq('id', timbraturaAperta.id)

      if (error) {
        alert('Errore timbratura: ' + error.message)
        return
      }
    }

    alert(`Timbratura ${tipo} registrata`)
    setPin('')
  }

  return (
    <div style={{ padding: 20, maxWidth: 400, margin: '0 auto' }}>
      <h2>Timbratura operai</h2>
<p style={{ fontSize: 12, color: '#666' }}>
  Parametro URL cantiere: {searchParams.get('cantiere') || 'nessuno'}
</p>
<p style={{ fontSize: 12, color: '#666' }}>
  Cantiere selezionato: {cantiere || 'nessuno'}
</p>
      <select
  value={cantiere}
  onChange={(e) => setCantiere(e.target.value)}
  style={{
    width: '100%',
    padding: 10,
    marginBottom: 10,
    background: 'white',
    color: '#0f172a',
    border: '1px solid #ccc',
    borderRadius: 6,
  }}
>
        <option value="">Seleziona cantiere</option>
        {cantieri.map((c) => (
          <option key={c.id} value={c.nome}>
            {c.nome}
          </option>
        ))}
      </select>

     <input
  placeholder="PIN operaio"
  value={pin}
  onChange={(e) => setPin(e.target.value)}
  style={{
    width: '100%',
    padding: 10,
    marginBottom: 10,
    background: 'white',
    color: '#0f172a',
    border: '1px solid #ccc',
    borderRadius: 6,
  }}
/>

      <select
  value={tipo}
  onChange={(e) => setTipo(e.target.value as 'entrata' | 'uscita')}
  style={{
    width: '100%',
    padding: 10,
    marginBottom: 10,
    background: 'white',
    color: '#0f172a',
    border: '1px solid #ccc',
    borderRadius: 6,
  }}
>
        <option value="entrata">Entrata</option>
        <option value="uscita">Uscita</option>
      </select>

      <button
        onClick={timbra}
        style={{
          width: '100%',
          padding: 12,
          backgroundColor: '#0f172a',
          color: 'white',
          border: 'none',
          borderRadius: 8,
          fontWeight: 600,
        }}
      >
        TIMBRA
      </button>
    </div>
  )
}
export default function TimbraPage() {
  return (
    <Suspense fallback={<div>Caricamento...</div>}>
      <TimbraContent />
    </Suspense>
  )
}