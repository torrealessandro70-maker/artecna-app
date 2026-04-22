'use client'

import { useEffect, useState, type CSSProperties } from 'react'
import { createClient } from '@supabase/supabase-js'
import jsPDF from 'jspdf'

const emptyStorage = {
  getItem: (_key: string) => null,
  setItem: (_key: string, _value: string) => {},
  removeItem: (_key: string) => {},
}

const supabase = createClient(
  'https://axuiaiglbahygsmeoypy.supabase.co',
  'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImF4dWlhaWdsYmFoeWdzbWVveXB5Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzY1OTY5ODYsImV4cCI6MjA5MjE3Mjk4Nn0.UU0rZN-8utUUXiuQHfkh-Z9sbhNmfpnJBsGMBqhzSIg',
  {
    auth: {
      persistSession: false,
      autoRefreshToken: false,
      detectSessionInUrl: false,
      storage: emptyStorage,
    },
  }
)

type Cantiere = {
  id?: string
  nome: string
}

type Rapportino = {
  id?: string
  cantiere: string
  data: string
  ore: string
  note: string
  operai?: string
  numero_presenti?: string
  ore_per_operaio?: string
  materiali?: string
  quantita_materiali?: string
  costo_materiali?: string
}

type FotoCantiere = {
  id?: string
  cantiere: string
  nota: string
  immagine_base64: string
  data_foto?: string
  geolocalizzazione?: string
  created_at?: string
}

type Operaio = {
  id?: string
  nome: string
  telefono?: string
  qualifica?: string
  pin?: string
  nota?: string
  stato?: string
  costo_orario?: number
  created_at?: string
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

export default function Home() {
  const [cantieri, setCantieri] = useState<Cantiere[]>([])
  const [rapportini, setRapportini] = useState<Rapportino[]>([])
  const [fotoCantiere, setFotoCantiere] = useState<FotoCantiere[]>([])
  const [operaiAnagrafica, setOperaiAnagrafica] = useState<Operaio[]>([])
  const [timbrature, setTimbrature] = useState<Timbratura[]>([])

  const [nomeCantiere, setNomeCantiere] = useState('')
  const [cantiereDaModificare, setCantiereDaModificare] = useState('')
  const [nuovoNomeCantiere, setNuovoNomeCantiere] = useState('')

  const [rapportinoInModifica, setRapportinoInModifica] = useState<string | null>(null)
  const [cantiereRapporto, setCantiereRapporto] = useState('')
  const [data, setData] = useState('')
  const [ore, setOre] = useState('')
  const [note, setNote] = useState('')
  const [operai, setOperai] = useState('')
  const [numeroPresenti, setNumeroPresenti] = useState('')
  const [orePerOperaio, setOrePerOperaio] = useState('')
  const [materiali, setMateriali] = useState('')
  const [quantitaMateriali, setQuantitaMateriali] = useState('')
  const [costoMateriali, setCostoMateriali] = useState('')

  const [fotoInModifica, setFotoInModifica] = useState<string | null>(null)
  const [cantiereFoto, setCantiereFoto] = useState('')
  const [notaFoto, setNotaFoto] = useState('')
  const [immagineBase64, setImmagineBase64] = useState('')
  const [dataFoto, setDataFoto] = useState('')
  const [geolocalizzazione, setGeolocalizzazione] = useState('')

  const [nomeOperaio, setNomeOperaio] = useState('')
  const [telefonoOperaio, setTelefonoOperaio] = useState('')
  const [qualificaOperaio, setQualificaOperaio] = useState('')
  const [pinOperaio, setPinOperaio] = useState('')
  const [notaOperaio, setNotaOperaio] = useState('')
  const [statoOperaio, setStatoOperaio] = useState('attivo')
  const [costoOrarioOperaio, setCostoOrarioOperaio] = useState('')
  const [ricercaOperaio, setRicercaOperaio] = useState('')

  const [operaioInModifica, setOperaioInModifica] = useState<string | null>(null)
  const [nomeOperaioModifica, setNomeOperaioModifica] = useState('')
  const [telefonoOperaioModifica, setTelefonoOperaioModifica] = useState('')
  const [qualificaOperaioModifica, setQualificaOperaioModifica] = useState('')
  const [pinOperaioModifica, setPinOperaioModifica] = useState('')
  const [notaOperaioModifica, setNotaOperaioModifica] = useState('')
  const [statoOperaioModifica, setStatoOperaioModifica] = useState('attivo')
  const [costoOrarioOperaioModifica, setCostoOrarioOperaioModifica] = useState('')

  const [operaioTimbratura, setOperaioTimbratura] = useState('')
  const [cantiereTimbratura, setCantiereTimbratura] = useState('')
  const [pinTimbratura, setPinTimbratura] = useState('')

  const [ultimoRapportino, setUltimoRapportino] = useState<Rapportino | null>(null)

  const [filtroCantiere, setFiltroCantiere] = useState('')
  const [cantiereScheda, setCantiereScheda] = useState('')

  const oggi = new Date().toISOString().slice(0, 10)

  useEffect(() => {
    try {
      localStorage.clear()
      sessionStorage.clear()
    } catch {}

    caricaCantieri()
    caricaRapportini()
    caricaFotoCantiere()
    caricaOperai()
    caricaTimbrature()
  }, [])

  const oraAttuale = () => {
    const now = new Date()
    return now.toLocaleTimeString('it-IT', {
      hour: '2-digit',
      minute: '2-digit',
    })
  }

  const parseOra = (ora?: string) => {
    if (!ora) return null
    const parti = ora.split(':')
    if (parti.length < 2) return null

    const h = Number(parti[0])
    const m = Number(parti[1])

    if (isNaN(h) || isNaN(m)) return null
    return h * 60 + m
  }

  const formatMoney = (value: number) => `€ ${value.toFixed(2)}`

  const caricaCantieri = async () => {
    const { data, error } = await supabase
      .from('cantieri')
      .select('*')
      .order('created_at', { ascending: false })

    if (error) {
      alert('Errore caricamento cantieri: ' + error.message)
      return
    }

    setCantieri((data || []) as Cantiere[])
  }

  const caricaRapportini = async () => {
    const { data, error } = await supabase
      .from('rapportini')
      .select('*')
      .order('created_at', { ascending: false })

    if (error) {
      alert('Errore caricamento rapportini: ' + error.message)
      return
    }

    const lista = (data || []) as Rapportino[]
    setRapportini(lista)
    setUltimoRapportino(lista.length > 0 ? lista[0] : null)
  }

  const caricaFotoCantiere = async () => {
    const { data, error } = await supabase
      .from('foto_cantiere')
      .select('*')
      .order('created_at', { ascending: false })

    if (error) {
      alert('Errore caricamento foto: ' + error.message)
      return
    }

    setFotoCantiere((data || []) as FotoCantiere[])
  }

  const caricaOperai = async () => {
    const { data, error } = await supabase
      .from('operai')
      .select('*')
      .order('created_at', { ascending: false })

    if (error) {
      alert('Errore caricamento operai: ' + error.message)
      return
    }

    setOperaiAnagrafica((data || []) as Operaio[])
  }

  const caricaTimbrature = async () => {
    const { data, error } = await supabase
      .from('timbrature')
      .select('*')
      .order('created_at', { ascending: false })

    if (error) {
      alert('Errore caricamento timbrature: ' + error.message)
      return
    }

    setTimbrature((data || []) as Timbratura[])
  }

  const resetFormRapportino = () => {
    setRapportinoInModifica(null)
    setCantiereRapporto('')
    setData('')
    setOre('')
    setNote('')
    setOperai('')
    setNumeroPresenti('')
    setOrePerOperaio('')
    setMateriali('')
    setQuantitaMateriali('')
    setCostoMateriali('')
  }

  const resetFormFoto = () => {
    setFotoInModifica(null)
    setCantiereFoto('')
    setNotaFoto('')
    setImmagineBase64('')
    setDataFoto('')
    setGeolocalizzazione('')
  }

  const aggiungiCantiere = async () => {
    if (!nomeCantiere.trim()) return

    const { error } = await supabase
      .from('cantieri')
      .insert([{ nome: nomeCantiere.trim() }])

    if (error) {
      alert('Errore salvataggio cantiere: ' + error.message)
      return
    }

    setNomeCantiere('')
    await caricaCantieri()
  }

  const aggiungiOperaio = async () => {
    if (!nomeOperaio.trim()) {
      alert('Inserisci il nome dell’operaio')
      return
    }

    if (!pinOperaio.trim()) {
      alert('Inserisci un PIN per l’operaio')
      return
    }

    const { data: esistente, error: erroreCheck } = await supabase
      .from('operai')
      .select('*')
      .eq('pin', pinOperaio.trim())

    if (erroreCheck) {
      alert('Errore controllo PIN: ' + erroreCheck.message)
      return
    }

    if (esistente && esistente.length > 0) {
      alert('Questo PIN è già usato da un altro operaio')
      return
    }

    const costo = parseFloat(String(costoOrarioOperaio).replace(',', '.'))
    const costoPulito = isNaN(costo) ? 0 : costo

    const { error } = await supabase
      .from('operai')
      .insert([
        {
          nome: nomeOperaio.trim(),
          telefono: telefonoOperaio.trim(),
          qualifica: qualificaOperaio.trim(),
          pin: pinOperaio.trim(),
          nota: notaOperaio.trim(),
          stato: statoOperaio,
          costo_orario: costoPulito,
        },
      ])

    if (error) {
      alert('Errore salvataggio operaio: ' + error.message)
      return
    }

    setNomeOperaio('')
    setTelefonoOperaio('')
    setQualificaOperaio('')
    setPinOperaio('')
    setNotaOperaio('')
    setStatoOperaio('attivo')
    setCostoOrarioOperaio('')
    await caricaOperai()
    alert('Operaio salvato')
  }

  const preparaModificaOperaio = (operaio: Operaio) => {
    setOperaioInModifica(operaio.id || null)
    setNomeOperaioModifica(operaio.nome || '')
    setTelefonoOperaioModifica(operaio.telefono || '')
    setQualificaOperaioModifica(operaio.qualifica || '')
    setPinOperaioModifica(operaio.pin || '')
    setNotaOperaioModifica(operaio.nota || '')
    setStatoOperaioModifica(operaio.stato || 'attivo')
    setCostoOrarioOperaioModifica(
      operaio.costo_orario !== undefined && operaio.costo_orario !== null
        ? String(operaio.costo_orario)
        : ''
    )
    window.scrollTo({ top: 0, behavior: 'smooth' })
  }

  const annullaModificaOperaio = () => {
    setOperaioInModifica(null)
    setNomeOperaioModifica('')
    setTelefonoOperaioModifica('')
    setQualificaOperaioModifica('')
    setPinOperaioModifica('')
    setNotaOperaioModifica('')
    setStatoOperaioModifica('attivo')
    setCostoOrarioOperaioModifica('')
  }

  const salvaModificaOperaio = async () => {
    if (!operaioInModifica) {
      alert('Nessun operaio selezionato')
      return
    }

    if (!nomeOperaioModifica.trim()) {
      alert('Inserisci il nome dell’operaio')
      return
    }

    if (!pinOperaioModifica.trim()) {
      alert('Inserisci il PIN dell’operaio')
      return
    }

    const { data: duplicati, error: erroreCheck } = await supabase
      .from('operai')
      .select('*')
      .eq('pin', pinOperaioModifica.trim())

    if (erroreCheck) {
      alert('Errore controllo PIN: ' + erroreCheck.message)
      return
    }

    const pinUsatoDaAltro =
      duplicati &&
      duplicati.some((o) => o.id !== operaioInModifica)

    if (pinUsatoDaAltro) {
      alert('Questo PIN è già usato da un altro operaio')
      return
    }

    const costo = parseFloat(String(costoOrarioOperaioModifica).replace(',', '.'))
    const costoPulito = isNaN(costo) ? 0 : costo

    const { error } = await supabase
      .from('operai')
      .update({
        nome: nomeOperaioModifica.trim(),
        telefono: telefonoOperaioModifica.trim(),
        qualifica: qualificaOperaioModifica.trim(),
        pin: pinOperaioModifica.trim(),
        nota: notaOperaioModifica.trim(),
        stato: statoOperaioModifica,
        costo_orario: costoPulito,
      })
      .eq('id', operaioInModifica)

    if (error) {
      alert('Errore modifica operaio: ' + error.message)
      return
    }

    annullaModificaOperaio()
    await caricaOperai()
    alert('Operaio modificato correttamente')
  }

  const cambiaStatoOperaio = async (operaio: Operaio, nuovoStato: 'attivo' | 'sospeso') => {
    if (!operaio.id) return

    const { error } = await supabase
      .from('operai')
      .update({ stato: nuovoStato })
      .eq('id', operaio.id)

    if (error) {
      alert('Errore aggiornamento stato operaio: ' + error.message)
      return
    }

    await caricaOperai()
    alert(`Operaio ${nuovoStato === 'attivo' ? 'riattivato' : 'sospeso'}`)
  }

  const eliminaOperaio = async (id?: string) => {
    if (!id) return

    const conferma = confirm('Vuoi eliminare questo operaio?')
    if (!conferma) return

    const { error } = await supabase
      .from('operai')
      .delete()
      .eq('id', id)

    if (error) {
      alert('Errore eliminazione operaio: ' + error.message)
      return
    }

    await caricaOperai()
    alert('Operaio eliminato')
  }

  const timbraEntrata = async () => {
    if (!operaioTimbratura || !cantiereTimbratura) {
      alert('Seleziona operaio e cantiere')
      return
    }

    const { data: aperte, error: errCheck } = await supabase
      .from('timbrature')
      .select('*')
      .eq('operaio_nome', operaioTimbratura)
      .eq('cantiere', cantiereTimbratura)
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

    const { error } = await supabase
      .from('timbrature')
      .insert([
        {
          operaio_nome: operaioTimbratura,
          cantiere: cantiereTimbratura,
          data: oggi,
          ora_entrata: oraAttuale(),
          stato: 'aperto',
        },
      ])

    if (error) {
      alert('Errore timbratura entrata: ' + error.message)
      return
    }

    await caricaTimbrature()
    alert('Entrata registrata')
  }

  const timbraUscita = async () => {
    if (!operaioTimbratura || !cantiereTimbratura) {
      alert('Seleziona operaio e cantiere')
      return
    }

    const { data: aperte, error: errFind } = await supabase
      .from('timbrature')
      .select('*')
      .eq('operaio_nome', operaioTimbratura)
      .eq('cantiere', cantiereTimbratura)
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

    const timbraturaAperta = aperte[0]

    const { error } = await supabase
      .from('timbrature')
      .update({
        ora_uscita: oraAttuale(),
        stato: 'chiuso',
      })
      .eq('id', timbraturaAperta.id)

    if (error) {
      alert('Errore timbratura uscita: ' + error.message)
      return
    }

    await caricaTimbrature()
    alert('Uscita registrata')
  }

  const timbraEntrataConPin = async () => {
    if (!pinTimbratura.trim() || !cantiereTimbratura) {
      alert('Inserisci PIN e seleziona il cantiere')
      return
    }

    const { data: operaiTrovati, error: erroreOperaio } = await supabase
      .from('operai')
      .select('*')
      .eq('pin', pinTimbratura.trim())

    if (erroreOperaio) {
      alert('Errore ricerca operaio: ' + erroreOperaio.message)
      return
    }

    if (!operaiTrovati || operaiTrovati.length === 0) {
      alert('PIN non valido')
      return
    }

    const operaio = operaiTrovati[0]

    if (operaio.stato === 'sospeso') {
      alert(`L'operaio ${operaio.nome} è sospeso`)
      return
    }

    const { data: aperte, error: errCheck } = await supabase
      .from('timbrature')
      .select('*')
      .eq('operaio_nome', operaio.nome)
      .eq('cantiere', cantiereTimbratura)
      .eq('data', oggi)
      .eq('stato', 'aperto')

    if (errCheck) {
      alert('Errore controllo timbratura: ' + errCheck.message)
      return
    }

    if (aperte && aperte.length > 0) {
      alert(`Esiste già una timbratura aperta per ${operaio.nome}`)
      return
    }

    const { error } = await supabase
      .from('timbrature')
      .insert([
        {
          operaio_nome: operaio.nome,
          cantiere: cantiereTimbratura,
          data: oggi,
          ora_entrata: oraAttuale(),
          stato: 'aperto',
        },
      ])

    if (error) {
      alert('Errore timbratura entrata: ' + error.message)
      return
    }

    setPinTimbratura('')
    await caricaTimbrature()
    alert(`Entrata registrata per ${operaio.nome}`)
  }

  const timbraUscitaConPin = async () => {
    if (!pinTimbratura.trim() || !cantiereTimbratura) {
      alert('Inserisci PIN e seleziona il cantiere')
      return
    }

    const { data: operaiTrovati, error: erroreOperaio } = await supabase
      .from('operai')
      .select('*')
      .eq('pin', pinTimbratura.trim())

    if (erroreOperaio) {
      alert('Errore ricerca operaio: ' + erroreOperaio.message)
      return
    }

    if (!operaiTrovati || operaiTrovati.length === 0) {
      alert('PIN non valido')
      return
    }

    const operaio = operaiTrovati[0]

    const { data: aperte, error: errFind } = await supabase
      .from('timbrature')
      .select('*')
      .eq('operaio_nome', operaio.nome)
      .eq('cantiere', cantiereTimbratura)
      .eq('data', oggi)
      .eq('stato', 'aperto')
      .order('created_at', { ascending: false })

    if (errFind) {
      alert('Errore ricerca timbratura aperta: ' + errFind.message)
      return
    }

    if (!aperte || aperte.length === 0) {
      alert(`Nessuna entrata aperta trovata per ${operaio.nome}`)
      return
    }

    const timbraturaAperta = aperte[0]

    const { error } = await supabase
      .from('timbrature')
      .update({
        ora_uscita: oraAttuale(),
        stato: 'chiuso',
      })
      .eq('id', timbraturaAperta.id)

    if (error) {
      alert('Errore timbratura uscita: ' + error.message)
      return
    }

    setPinTimbratura('')
    await caricaTimbrature()
    alert(`Uscita registrata per ${operaio.nome}`)
  }

  const eliminaTimbratura = async (id?: string) => {
    if (!id) return

    const conferma = confirm('Vuoi eliminare questa timbratura?')
    if (!conferma) return

    const { error } = await supabase
      .from('timbrature')
      .delete()
      .eq('id', id)

    if (error) {
      alert('Errore eliminazione timbratura: ' + error.message)
      return
    }

    await caricaTimbrature()
    alert('Timbratura eliminata')
  }

  const compilaRapportinoDaTimbrature = () => {
    if (!cantiereRapporto) {
      alert('Seleziona prima un cantiere nel rapportino')
      return
    }

    const timbratureDelCantiere = timbrature.filter(
      (t) => t.cantiere === cantiereRapporto && t.data === oggi
    )

    if (timbratureDelCantiere.length === 0) {
      alert('Nessuna timbratura trovata oggi per questo cantiere')
      return
    }

    const mappaOperai = new Map<string, number>()

    timbratureDelCantiere.forEach((t) => {
      const nome = t.operaio_nome?.trim()
      if (!nome) return

      const entrata = parseOra(t.ora_entrata)
      const uscita = parseOra(t.ora_uscita)

      if (entrata === null) return

      let minutiLavorati = 0

      if (uscita !== null && uscita >= entrata) {
        minutiLavorati = uscita - entrata
      }

      const attuale = mappaOperai.get(nome) || 0
      mappaOperai.set(nome, attuale + minutiLavorati)
    })

    const nomiOperai = Array.from(mappaOperai.keys())

    if (nomiOperai.length === 0) {
      alert('Nessun operaio valido trovato nelle timbrature di oggi')
      return
    }

    const totaleMinuti = Array.from(mappaOperai.values()).reduce((a, b) => a + b, 0)
    const totaleOreNumero = totaleMinuti / 60

    const dettaglioOre = Array.from(mappaOperai.entries())
      .map(([nome, minuti]) => {
        const oreDecimali = (minuti / 60).toFixed(2)
        return `${nome}: ${oreDecimali} h`
      })
      .join(' | ')

    setOperai(nomiOperai.join(', '))
    setNumeroPresenti(String(nomiOperai.length))
    setOre(totaleOreNumero.toFixed(2))
    setOrePerOperaio(dettaglioOre)
    setData(oggi)

    alert('Rapportino compilato automaticamente dalle timbrature')
  }

  const preparaModificaCantiere = (nome: string) => {
    setCantiereDaModificare(nome)
    setNuovoNomeCantiere(nome)
    window.scrollTo({ top: 0, behavior: 'smooth' })
  }

  const salvaModificaCantiere = async () => {
    if (!cantiereDaModificare || !nuovoNomeCantiere.trim()) {
      alert('Seleziona un cantiere e scrivi il nuovo nome')
      return
    }

    const nuovoNome = nuovoNomeCantiere.trim()

    if (cantiereDaModificare === nuovoNome) {
      alert('Il nuovo nome è uguale a quello attuale')
      return
    }

    const { error: errorCantieri } = await supabase
      .from('cantieri')
      .update({ nome: nuovoNome })
      .eq('nome', cantiereDaModificare)

    if (errorCantieri) {
      alert('Errore modifica cantiere: ' + errorCantieri.message)
      return
    }

    const { error: errorRapportini } = await supabase
      .from('rapportini')
      .update({ cantiere: nuovoNome })
      .eq('cantiere', cantiereDaModificare)

    if (errorRapportini) {
      alert('Errore aggiornamento rapportini: ' + errorRapportini.message)
      return
    }

    const { error: errorFoto } = await supabase
      .from('foto_cantiere')
      .update({ cantiere: nuovoNome })
      .eq('cantiere', cantiereDaModificare)

    if (errorFoto) {
      alert('Errore aggiornamento foto: ' + errorFoto.message)
      return
    }

    const { error: errorTimbrature } = await supabase
      .from('timbrature')
      .update({ cantiere: nuovoNome })
      .eq('cantiere', cantiereDaModificare)

    if (errorTimbrature) {
      alert('Errore aggiornamento timbrature: ' + errorTimbrature.message)
      return
    }

    if (cantiereRapporto === cantiereDaModificare) setCantiereRapporto(nuovoNome)
    if (cantiereFoto === cantiereDaModificare) setCantiereFoto(nuovoNome)
    if (cantiereTimbratura === cantiereDaModificare) setCantiereTimbratura(nuovoNome)
    if (filtroCantiere === cantiereDaModificare) setFiltroCantiere(nuovoNome)
    if (cantiereScheda === cantiereDaModificare) setCantiereScheda(nuovoNome)

    setCantiereDaModificare('')
    setNuovoNomeCantiere('')

    await caricaCantieri()
    await caricaRapportini()
    await caricaFotoCantiere()
    await caricaTimbrature()

    alert('Cantiere modificato correttamente')
  }

  const eliminaCantiere = async (nome: string) => {
    const conferma = confirm(
      `Vuoi eliminare il cantiere "${nome}"?\n\nVerranno eliminati anche rapportini, foto e timbrature collegate.`
    )
    if (!conferma) return

    const { error: errorRapportini } = await supabase
      .from('rapportini')
      .delete()
      .eq('cantiere', nome)

    if (errorRapportini) {
      alert('Errore eliminazione rapportini collegati: ' + errorRapportini.message)
      return
    }

    const { error: errorFoto } = await supabase
      .from('foto_cantiere')
      .delete()
      .eq('cantiere', nome)

    if (errorFoto) {
      alert('Errore eliminazione foto collegate: ' + errorFoto.message)
      return
    }

    const { error: errorTimbrature } = await supabase
      .from('timbrature')
      .delete()
      .eq('cantiere', nome)

    if (errorTimbrature) {
      alert('Errore eliminazione timbrature collegate: ' + errorTimbrature.message)
      return
    }

    const { error: errorCantiere } = await supabase
      .from('cantieri')
      .delete()
      .eq('nome', nome)

    if (errorCantiere) {
      alert('Errore eliminazione cantiere: ' + errorCantiere.message)
      return
    }

    if (cantiereRapporto === nome) setCantiereRapporto('')
    if (cantiereFoto === nome) setCantiereFoto('')
    if (cantiereTimbratura === nome) setCantiereTimbratura('')
    if (filtroCantiere === nome) setFiltroCantiere('')
    if (cantiereScheda === nome) setCantiereScheda('')

    await caricaCantieri()
    await caricaRapportini()
    await caricaFotoCantiere()
    await caricaTimbrature()

    alert('Cantiere eliminato con tutti i dati collegati')
  }

  const salvaRapportino = async () => {
    if (!cantiereRapporto || !data || !ore || !note.trim()) {
      alert('Compila almeno cantiere, data, ore e note')
      return
    }

    const nuovoRapportino: Rapportino = {
      cantiere: cantiereRapporto,
      data,
      ore,
      note,
      operai,
      numero_presenti: numeroPresenti,
      ore_per_operaio: orePerOperaio,
      materiali,
      quantita_materiali: quantitaMateriali,
      costo_materiali: costoMateriali,
    }

    const { error } = await supabase
      .from('rapportini')
      .insert([nuovoRapportino])

    if (error) {
      alert('Errore salvataggio rapportino: ' + error.message)
      return
    }

    setUltimoRapportino(nuovoRapportino)
    resetFormRapportino()
    await caricaRapportini()
    alert('Rapportino salvato')
  }

  const preparaModificaRapportino = (r: Rapportino) => {
    setRapportinoInModifica(r.id || null)
    setCantiereRapporto(r.cantiere ?? '')
    setData(r.data ?? '')
    setOre(r.ore ?? '')
    setNote(r.note ?? '')
    setOperai(r.operai ?? '')
    setNumeroPresenti(r.numero_presenti ?? '')
    setOrePerOperaio(r.ore_per_operaio ?? '')
    setMateriali(r.materiali ?? '')
    setQuantitaMateriali(r.quantita_materiali ?? '')
    setCostoMateriali(r.costo_materiali ?? '')
    window.scrollTo({ top: 0, behavior: 'smooth' })
  }

  const aggiornaRapportino = async () => {
    if (!rapportinoInModifica) {
      alert('Nessun rapportino selezionato')
      return
    }

    if (!cantiereRapporto || !data || !ore || !note.trim()) {
      alert('Compila almeno cantiere, data, ore e note')
      return
    }

    const { error } = await supabase
      .from('rapportini')
      .update({
        cantiere: cantiereRapporto,
        data,
        ore,
        note,
        operai,
        numero_presenti: numeroPresenti,
        ore_per_operaio: orePerOperaio,
        materiali,
        quantita_materiali: quantitaMateriali,
        costo_materiali: costoMateriali,
      })
      .eq('id', rapportinoInModifica)

    if (error) {
      alert('Errore aggiornamento rapportino: ' + error.message)
      return
    }

    resetFormRapportino()
    await caricaRapportini()
    alert('Rapportino aggiornato')
  }

  const eliminaRapportino = async (id?: string) => {
    if (!id) return

    const conferma = confirm('Vuoi eliminare questo rapportino?')
    if (!conferma) return

    const { error } = await supabase
      .from('rapportini')
      .delete()
      .eq('id', id)

    if (error) {
      alert('Errore eliminazione rapportino: ' + error.message)
      return
    }

    await caricaRapportini()
    alert('Rapportino eliminato')
  }

  const gestisciFileImmagine = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return

    const reader = new FileReader()
    reader.onloadend = () => {
      const risultato = reader.result
      if (typeof risultato === 'string') {
        setImmagineBase64(risultato)
      }
    }
    reader.readAsDataURL(file)
  }

  const usaPosizioneAttuale = () => {
    if (!navigator.geolocation) {
      alert('Geolocalizzazione non supportata dal browser')
      return
    }

    navigator.geolocation.getCurrentPosition(
      (position) => {
        const lat = position.coords.latitude.toFixed(6)
        const lng = position.coords.longitude.toFixed(6)
        setGeolocalizzazione(`${lat}, ${lng}`)
      },
      () => {
        alert('Impossibile ottenere la posizione')
      }
    )
  }

  const salvaFotoCantiere = async () => {
    if (!cantiereFoto || !immagineBase64) {
      alert('Seleziona cantiere e foto')
      return
    }

    const nuovaFoto: FotoCantiere = {
      cantiere: cantiereFoto,
      nota: notaFoto,
      immagine_base64: immagineBase64,
      data_foto: dataFoto,
      geolocalizzazione,
    }

    const { error } = await supabase
      .from('foto_cantiere')
      .insert([nuovaFoto])

    if (error) {
      alert('Errore salvataggio foto: ' + error.message)
      return
    }

    resetFormFoto()
    await caricaFotoCantiere()
    alert('Foto salvata')
  }

  const preparaModificaFoto = (f: FotoCantiere) => {
    setFotoInModifica(f.id || null)
    setCantiereFoto(f.cantiere ?? '')
    setNotaFoto(f.nota ?? '')
    setImmagineBase64(f.immagine_base64 ?? '')
    setDataFoto(f.data_foto ?? '')
    setGeolocalizzazione(f.geolocalizzazione ?? '')
    window.scrollTo({ top: document.body.scrollHeight, behavior: 'smooth' })
  }

  const aggiornaFoto = async () => {
    if (!fotoInModifica) {
      alert('Nessuna foto selezionata')
      return
    }

    if (!cantiereFoto || !immagineBase64) {
      alert('Seleziona cantiere e foto')
      return
    }

    const { error } = await supabase
      .from('foto_cantiere')
      .update({
        cantiere: cantiereFoto,
        nota: notaFoto,
        immagine_base64: immagineBase64,
        data_foto: dataFoto,
        geolocalizzazione,
      })
      .eq('id', fotoInModifica)

    if (error) {
      alert('Errore aggiornamento foto: ' + error.message)
      return
    }

    resetFormFoto()
    await caricaFotoCantiere()
    alert('Foto aggiornata')
  }

  const eliminaFoto = async (id?: string) => {
    if (!id) return

    const conferma = confirm('Vuoi eliminare questa foto?')
    if (!conferma) return

    const { error } = await supabase
      .from('foto_cantiere')
      .delete()
      .eq('id', id)

    if (error) {
      alert('Errore eliminazione foto: ' + error.message)
      return
    }

    await caricaFotoCantiere()
    alert('Foto eliminata')
  }

  const calcolaCostoTimbratura = (timbratura: Timbratura) => {
    const entrata = parseOra(timbratura.ora_entrata)
    const uscita = parseOra(timbratura.ora_uscita)

    if (entrata === null || uscita === null || uscita < entrata) return 0

    const minuti = uscita - entrata
    const ore = minuti / 60

    const operaio = operaiAnagrafica.find((o) => o.nome === timbratura.operaio_nome)
    const costoOrario = Number(operaio?.costo_orario || 0)

    return ore * costoOrario
  }

  const generaPDF = () => {
    const r = ultimoRapportino || {
      cantiere: cantiereRapporto,
      data,
      ore,
      note,
      operai,
      numero_presenti: numeroPresenti,
      ore_per_operaio: orePerOperaio,
      materiali,
      quantita_materiali: quantitaMateriali,
      costo_materiali: costoMateriali,
    }

    if (!r.cantiere) {
      alert('Non ci sono dati da esportare')
      return
    }

    const doc = new jsPDF()
    let y = 20

    doc.setFont('helvetica', 'bold')
    doc.setFontSize(20)
    doc.text('ARTECNA', 20, y)

    doc.setFont('helvetica', 'normal')
    doc.setFontSize(10)
    doc.text('Gestione cantieri e rapportini di lavoro', 20, y + 6)

    doc.setLineWidth(0.6)
    doc.line(20, y + 10, 190, y + 10)

    y += 20

    doc.setFont('helvetica', 'bold')
    doc.setFontSize(16)
    doc.text('RAPPORTINO GIORNALIERO DI CANTIERE', 20, y)

    y += 12

    doc.setFont('helvetica', 'bold')
    doc.text('Cantiere:', 20, y)
    doc.setFont('helvetica', 'normal')
    doc.text(String(r.cantiere || '-'), 45, y)

    doc.setFont('helvetica', 'bold')
    doc.text('Data:', 140, y)
    doc.setFont('helvetica', 'normal')
    doc.text(String(r.data || '-'), 155, y)

    y += 10

    doc.setFont('helvetica', 'bold')
    doc.text('Ore totali:', 20, y)
    doc.setFont('helvetica', 'normal')
    doc.text(String(r.ore || '-'), 45, y)

    y += 15

    doc.setFont('helvetica', 'bold')
    doc.text('OPERAI PRESENTI', 20, y)
    doc.line(20, y + 2, 80, y + 2)

    y += 10

    doc.setFont('helvetica', 'bold')
    doc.text('Nomi:', 20, y)
    doc.setFont('helvetica', 'normal')
    const operaiLines = doc.splitTextToSize(String(r.operai || '-'), 145)
    doc.text(operaiLines, 45, y)

    y += operaiLines.length * 6 + 4

    doc.setFont('helvetica', 'bold')
    doc.text('Numero presenti:', 20, y)
    doc.setFont('helvetica', 'normal')
    doc.text(String(r.numero_presenti || '-'), 55, y)

    doc.setFont('helvetica', 'bold')
    doc.text('Ore per operaio:', 100, y)
    doc.setFont('helvetica', 'normal')
    doc.text(String(r.ore_per_operaio || '-'), 140, y)

    y += 15

    doc.setFont('helvetica', 'bold')
    doc.text('MATERIALI USATI', 20, y)
    doc.line(20, y + 2, 85, y + 2)

    y += 10

    doc.setFont('helvetica', 'bold')
    doc.text('Materiali:', 20, y)
    doc.setFont('helvetica', 'normal')
    const materialiLines = doc.splitTextToSize(String(r.materiali || '-'), 140)
    doc.text(materialiLines, 50, y)

    y += materialiLines.length * 6 + 4

    doc.setFont('helvetica', 'bold')
    doc.text('Quantità:', 20, y)
    doc.setFont('helvetica', 'normal')
    doc.text(String(r.quantita_materiali || '-'), 40, y)

    doc.setFont('helvetica', 'bold')
    doc.text('Costo materiali:', 100, y)
    doc.setFont('helvetica', 'normal')
    doc.text(String(r.costo_materiali || '-'), 138, y)

    y += 15

    doc.setFont('helvetica', 'bold')
    doc.text('NOTE LAVORAZIONI', 20, y)
    doc.line(20, y + 2, 95, y + 2)

    y += 10

    doc.setFont('helvetica', 'normal')
    const noteLines = doc.splitTextToSize(String(r.note || '-'), 170)
    doc.text(noteLines, 20, y)

    y += noteLines.length * 6 + 20

    if (y < 240) {
      doc.setFont('helvetica', 'normal')
      doc.line(20, y, 80, y)
      doc.line(120, y, 180, y)
      doc.text('Firma impresa', 20, y + 7)
      doc.text('Firma cliente', 120, y + 7)
    }

    doc.save(`rapportino-${String(r.cantiere || 'artecna')}.pdf`)
  }

  const rapportiniFiltrati = filtroCantiere
    ? rapportini.filter((r) => r.cantiere === filtroCantiere)
    : rapportini

  const fotoFiltrate = filtroCantiere
    ? fotoCantiere.filter((f) => f.cantiere === filtroCantiere)
    : fotoCantiere

  const rapportiniScheda = cantiereScheda
    ? rapportini.filter((r) => r.cantiere === cantiereScheda)
    : []

  const fotoScheda = cantiereScheda
    ? fotoCantiere.filter((f) => f.cantiere === cantiereScheda)
    : []

  const timbratureOggi = timbrature.filter((t) => t.data === oggi)

  const operaiFiltrati = operaiAnagrafica.filter((o) => {
    const testo =
      `${o.nome || ''} ${o.telefono || ''} ${o.qualifica || ''} ${o.nota || ''} ${o.stato || ''}`.toLowerCase()
    return testo.includes(ricercaOperaio.toLowerCase())
  })

  const operaiAttivi = operaiAnagrafica.filter((o) => o.stato !== 'sospeso')

  const totaleCantieri = cantieri.length
  const totaleRapportini = rapportini.length
  const totaleFoto = fotoCantiere.length
  const totaleOperai = operaiAnagrafica.length

  const rapportiniOggi = rapportini.filter((r) => r.data === oggi)
  const totaleRapportiniOggi = rapportiniOggi.length

  const oreTotaliOggi = rapportiniOggi.reduce((tot, r) => {
    const valore = parseFloat(String(r.ore).replace(',', '.'))
    return tot + (isNaN(valore) ? 0 : valore)
  }, 0)

  const costoTotaleTimbratureOggi = timbratureOggi.reduce((tot, t) => {
    return tot + calcolaCostoTimbratura(t)
  }, 0)

  const costoGiornalieroCantiereSelezionato = timbrature
    .filter((t) => t.cantiere === cantiereScheda && t.data === oggi)
    .reduce((tot, t) => tot + calcolaCostoTimbratura(t), 0)

  const costoGiornalieroRapportino = timbrature
    .filter((t) => t.cantiere === cantiereRapporto && t.data === oggi)
    .reduce((tot, t) => tot + calcolaCostoTimbratura(t), 0)

  const ultimiCantieri = cantieri.slice(0, 5)
  const ultimiRapportini = rapportini.slice(0, 5)
  const ultimeFoto = fotoCantiere.slice(0, 4)

  const cardStyle: CSSProperties = {
    padding: 16,
    border: '1px solid #d9d9d9',
    borderRadius: 12,
    background: '#ffffff',
    boxShadow: '0 2px 10px rgba(0,0,0,0.04)',
  }

  const buttonPrimary: CSSProperties = {
    padding: '10px 14px',
    backgroundColor: '#0f172a',
    color: 'white',
    border: 'none',
    borderRadius: 8,
    cursor: 'pointer',
    fontWeight: 600,
  }

  const buttonSecondary: CSSProperties = {
    padding: '10px 14px',
    backgroundColor: '#f3f4f6',
    color: '#111827',
    border: '1px solid #d1d5db',
    borderRadius: 8,
    cursor: 'pointer',
    fontWeight: 600,
  }

  const badgeStyle = (stato?: string): CSSProperties => ({
    display: 'inline-block',
    padding: '4px 8px',
    borderRadius: 999,
    fontSize: 12,
    fontWeight: 700,
    marginLeft: 8,
    backgroundColor: stato === 'sospeso' ? '#fee2e2' : '#dcfce7',
    color: stato === 'sospeso' ? '#991b1b' : '#166534',
    border: stato === 'sospeso' ? '1px solid #fecaca' : '1px solid #bbf7d0',
  })

  return (
    <div style={{ padding: 20, fontFamily: 'Arial, sans-serif', maxWidth: 1100 }}>
      <div
        style={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          gap: 16,
          flexWrap: 'wrap',
          marginBottom: 20,
        }}
      >
        <div>
          <h1 style={{ margin: 0, fontSize: 32 }}>ARTECNA Dashboard</h1>
          <p style={{ margin: '6px 0 0 0', color: '#555' }}>
            Controllo cantieri, rapportini, foto, operai e timbrature
          </p>
        </div>

        <div style={{ textAlign: 'right' }}>
          <div style={{ fontSize: 14, color: '#666' }}>Data di oggi</div>
          <div style={{ fontWeight: 700, fontSize: 18 }}>{oggi}</div>
        </div>
      </div>

      <div
        style={{
          marginTop: 20,
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))',
          gap: 12,
        }}
      >
        <div style={cardStyle}>
          <div style={{ fontSize: 14, color: '#666' }}>Cantieri attivi</div>
          <div style={{ fontSize: 30, fontWeight: 700, marginTop: 8 }}>{totaleCantieri}</div>
        </div>

        <div style={cardStyle}>
          <div style={{ fontSize: 14, color: '#666' }}>Rapportini totali</div>
          <div style={{ fontSize: 30, fontWeight: 700, marginTop: 8 }}>{totaleRapportini}</div>
        </div>

        <div style={cardStyle}>
          <div style={{ fontSize: 14, color: '#666' }}>Rapportini di oggi</div>
          <div style={{ fontSize: 30, fontWeight: 700, marginTop: 8 }}>{totaleRapportiniOggi}</div>
        </div>

        <div style={cardStyle}>
          <div style={{ fontSize: 14, color: '#666' }}>Ore totali oggi</div>
          <div style={{ fontSize: 30, fontWeight: 700, marginTop: 8 }}>{oreTotaliOggi}</div>
        </div>

        <div style={cardStyle}>
          <div style={{ fontSize: 14, color: '#666' }}>Operai registrati</div>
          <div style={{ fontSize: 30, fontWeight: 700, marginTop: 8 }}>{totaleOperai}</div>
        </div>

        <div style={cardStyle}>
          <div style={{ fontSize: 14, color: '#666' }}>Timbrature oggi</div>
          <div style={{ fontSize: 30, fontWeight: 700, marginTop: 8 }}>{timbratureOggi.length}</div>
        </div>

        <div style={cardStyle}>
          <div style={{ fontSize: 14, color: '#666' }}>Manodopera oggi</div>
          <div style={{ fontSize: 30, fontWeight: 700, marginTop: 8 }}>
            {formatMoney(costoTotaleTimbratureOggi)}
          </div>
        </div>
      </div>

      <div style={{ ...cardStyle, marginTop: 20 }}>
        <h2 style={{ marginTop: 0 }}>Azioni rapide</h2>

        <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap' }}>
          <button onClick={() => window.scrollTo({ top: 1600, behavior: 'smooth' })} style={buttonPrimary}>
            Nuovo rapportino
          </button>

          <button onClick={() => window.scrollTo({ top: 2850, behavior: 'smooth' })} style={buttonSecondary}>
            Nuova foto
          </button>

          <button onClick={() => window.scrollTo({ top: 1100, behavior: 'smooth' })} style={buttonSecondary}>
            Nuovo cantiere
          </button>

          <button onClick={() => window.scrollTo({ top: 1350, behavior: 'smooth' })} style={buttonSecondary}>
            Anagrafica operai
          </button>

          <button onClick={() => window.scrollTo({ top: 2150, behavior: 'smooth' })} style={buttonSecondary}>
            Timbratura operai
          </button>

          <button onClick={generaPDF} style={buttonSecondary}>
            Genera PDF
          </button>
        </div>
      </div>

      <div
        style={{
          marginTop: 20,
          display: 'grid',
          gridTemplateColumns: '1.2fr 1.2fr 1fr',
          gap: 16,
        }}
      >
        <div style={cardStyle}>
          <h2 style={{ marginTop: 0 }}>Ultimi cantieri</h2>
          {ultimiCantieri.length === 0 ? (
            <p>Nessun cantiere presente</p>
          ) : (
            <div>
              {ultimiCantieri.map((c, i) => (
                <div
                  key={c.id || i}
                  style={{
                    padding: '10px 0',
                    borderBottom: i < ultimiCantieri.length - 1 ? '1px solid #eee' : 'none',
                  }}
                >
                  <div style={{ fontWeight: 600 }}>{c.nome}</div>
                </div>
              ))}
            </div>
          )}
        </div>

        <div style={cardStyle}>
          <h2 style={{ marginTop: 0 }}>Ultimi rapportini</h2>
          {ultimiRapportini.length === 0 ? (
            <p>Nessun rapportino presente</p>
          ) : (
            <div>
              {ultimiRapportini.map((r, i) => (
                <div
                  key={r.id || i}
                  style={{
                    padding: '10px 0',
                    borderBottom: i < ultimiRapportini.length - 1 ? '1px solid #eee' : 'none',
                  }}
                >
                  <div style={{ fontWeight: 600 }}>{r.cantiere}</div>
                  <div style={{ fontSize: 14, color: '#666' }}>
                    {r.data} · {r.ore} ore
                  </div>
                  <div style={{ fontSize: 14, marginTop: 4 }}>
                    {String(r.note || '').slice(0, 60)}
                    {String(r.note || '').length > 60 ? '...' : ''}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        <div style={cardStyle}>
          <h2 style={{ marginTop: 0 }}>Ultime foto</h2>
          {ultimeFoto.length === 0 ? (
            <p>Nessuna foto presente</p>
          ) : (
            <div
              style={{
                display: 'grid',
                gridTemplateColumns: '1fr 1fr',
                gap: 8,
              }}
            >
              {ultimeFoto.map((f, i) => (
                <div key={f.id || i}>
                  <img
                    src={f.immagine_base64}
                    alt="Foto cantiere"
                    style={{
                      width: '100%',
                      height: 100,
                      objectFit: 'cover',
                      borderRadius: 8,
                      border: '1px solid #ddd',
                    }}
                  />
                  <div style={{ fontSize: 12, marginTop: 4 }}>{f.cantiere}</div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      <div style={{ marginTop: 20, padding: 15, border: '1px solid #ccc', borderRadius: 8 }}>
        <h2>Filtro per cantiere</h2>

        <select
          value={filtroCantiere}
          onChange={(e) => setFiltroCantiere(e.target.value)}
          style={{ padding: 8, width: 260, marginRight: 10 }}
        >
          <option value="">Tutti i cantieri</option>
          {cantieri.map((c, i) => (
            <option key={c.id || i} value={c.nome}>
              {c.nome}
            </option>
          ))}
        </select>

        <button onClick={() => setFiltroCantiere('')} style={{ padding: 8 }}>
          Azzera filtro
        </button>
      </div>

      <div style={{ marginTop: 20, padding: 15, border: '1px solid #ccc', borderRadius: 8 }}>
        <h2>Scheda singolo cantiere</h2>

        <select
          value={cantiereScheda}
          onChange={(e) => setCantiereScheda(e.target.value)}
          style={{ padding: 8, width: 260, marginBottom: 15 }}
        >
          <option value="">Seleziona cantiere</option>
          {cantieri.map((c, i) => (
            <option key={c.id || i} value={c.nome}>
              {c.nome}
            </option>
          ))}
        </select>

        {!cantiereScheda ? (
          <p>Seleziona un cantiere per vedere la scheda completa.</p>
        ) : (
          <div>
            <h3>{cantiereScheda}</h3>
            <p><strong>Rapportini collegati:</strong> {rapportiniScheda.length}</p>
            <p><strong>Foto collegate:</strong> {fotoScheda.length}</p>
            <p><strong>Costo giornaliero manodopera oggi:</strong> {formatMoney(costoGiornalieroCantiereSelezionato)}</p>

            <div style={{ marginTop: 15 }}>
              <h4>Rapportini del cantiere</h4>
              {rapportiniScheda.length === 0 ? (
                <p>Nessun rapportino collegato.</p>
              ) : (
                <ul>
                  {rapportiniScheda.map((r, i) => (
                    <li key={r.id || i} style={{ marginBottom: 10 }}>
                      <strong>{r.data}</strong> - {r.ore} ore
                      <br />
                      {r.note}
                    </li>
                  ))}
                </ul>
              )}
            </div>

            <div style={{ marginTop: 15 }}>
              <h4>Foto del cantiere</h4>
              {fotoScheda.length === 0 ? (
                <p>Nessuna foto collegata.</p>
              ) : (
                <div>
                  {fotoScheda.map((f, i) => (
                    <div key={f.id || i} style={{ marginBottom: 20 }}>
                      <strong>Data foto:</strong> {f.data_foto || '-'}
                      <br />
                      <strong>Geolocalizzazione:</strong> {f.geolocalizzazione || '-'}
                      <br />
                      {f.nota}
                      <br />
                      <img
                        src={f.immagine_base64}
                        alt="Foto cantiere"
                        style={{ maxWidth: 250, marginTop: 8, border: '1px solid #ccc' }}
                      />
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        )}
      </div>

      <div style={{ marginTop: 30, padding: 15, border: '1px solid #ccc', borderRadius: 8 }}>
        <h2>Aggiungi cantiere</h2>
        <input
          placeholder="Nome cantiere"
          value={nomeCantiere}
          onChange={(e) => setNomeCantiere(e.target.value)}
          style={{ padding: 8, marginRight: 8, width: 250 }}
        />
        <button onClick={aggiungiCantiere} style={{ padding: 8 }}>
          Aggiungi cantiere
        </button>
      </div>

      <div style={{ marginTop: 30, padding: 15, border: '1px solid #ccc', borderRadius: 8 }}>
        <h2>Modifica nome cantiere</h2>
        <div style={{ marginBottom: 10 }}>
          <select
            value={cantiereDaModificare}
            onChange={(e) => {
              setCantiereDaModificare(e.target.value)
              setNuovoNomeCantiere(e.target.value)
            }}
            style={{ padding: 8, width: 260, marginRight: 8 }}
          >
            <option value="">Seleziona cantiere</option>
            {cantieri.map((c, i) => (
              <option key={c.id || i} value={c.nome}>
                {c.nome}
              </option>
            ))}
          </select>

          <input
            placeholder="Nuovo nome cantiere"
            value={nuovoNomeCantiere}
            onChange={(e) => setNuovoNomeCantiere(e.target.value)}
            style={{ padding: 8, width: 260 }}
          />
        </div>

        <button onClick={salvaModificaCantiere} style={{ padding: 8 }}>
          Salva modifica cantiere
        </button>
      </div>

      <div style={{ marginTop: 30, padding: 15, border: '1px solid #ccc', borderRadius: 8 }}>
        <h2>Anagrafica operai</h2>

        <div style={{ marginBottom: 10, display: 'flex', gap: 8, flexWrap: 'wrap' }}>
          <input
            placeholder="Cerca operaio"
            value={ricercaOperaio}
            onChange={(e) => setRicercaOperaio(e.target.value)}
            style={{ padding: 8, width: 220 }}
          />

          <select
            value={statoOperaio}
            onChange={(e) => setStatoOperaio(e.target.value)}
            style={{ padding: 8, width: 160 }}
          >
            <option value="attivo">Attivo</option>
            <option value="sospeso">Sospeso</option>
          </select>
        </div>

        <div style={{ marginBottom: 10, display: 'flex', gap: 8, flexWrap: 'wrap' }}>
          <input
            placeholder="Nome operaio"
            value={nomeOperaio}
            onChange={(e) => setNomeOperaio(e.target.value)}
            style={{ padding: 8, width: 220 }}
          />

          <input
            placeholder="Telefono"
            value={telefonoOperaio}
            onChange={(e) => setTelefonoOperaio(e.target.value)}
            style={{ padding: 8, width: 180 }}
          />

          <input
            placeholder="Qualifica"
            value={qualificaOperaio}
            onChange={(e) => setQualificaOperaio(e.target.value)}
            style={{ padding: 8, width: 180 }}
          />

          <input
            placeholder="PIN operaio"
            value={pinOperaio}
            onChange={(e) => setPinOperaio(e.target.value)}
            style={{ padding: 8, width: 140 }}
          />

          <input
            placeholder="Costo orario €"
            value={costoOrarioOperaio}
            onChange={(e) => setCostoOrarioOperaio(e.target.value)}
            style={{ padding: 8, width: 140 }}
          />
        </div>

        <div style={{ marginBottom: 10 }}>
          <textarea
            placeholder="Nota operaio"
            value={notaOperaio}
            onChange={(e) => setNotaOperaio(e.target.value)}
            style={{ padding: 8, width: '100%', minHeight: 70 }}
          />
        </div>

        <button onClick={aggiungiOperaio} style={{ padding: 8 }}>
          Aggiungi operaio
        </button>

        {operaioInModifica && (
          <div style={{ marginTop: 20, padding: 15, border: '1px solid #ddd', borderRadius: 8 }}>
            <h3>Modifica operaio</h3>

            <div style={{ marginBottom: 10, display: 'flex', gap: 8, flexWrap: 'wrap' }}>
              <input
                placeholder="Nome operaio"
                value={nomeOperaioModifica}
                onChange={(e) => setNomeOperaioModifica(e.target.value)}
                style={{ padding: 8, width: 220 }}
              />

              <input
                placeholder="Telefono"
                value={telefonoOperaioModifica}
                onChange={(e) => setTelefonoOperaioModifica(e.target.value)}
                style={{ padding: 8, width: 180 }}
              />

              <input
                placeholder="Qualifica"
                value={qualificaOperaioModifica}
                onChange={(e) => setQualificaOperaioModifica(e.target.value)}
                style={{ padding: 8, width: 180 }}
              />

              <input
                placeholder="PIN operaio"
                value={pinOperaioModifica}
                onChange={(e) => setPinOperaioModifica(e.target.value)}
                style={{ padding: 8, width: 140 }}
              />

              <input
                placeholder="Costo orario €"
                value={costoOrarioOperaioModifica}
                onChange={(e) => setCostoOrarioOperaioModifica(e.target.value)}
                style={{ padding: 8, width: 140 }}
              />

              <select
                value={statoOperaioModifica}
                onChange={(e) => setStatoOperaioModifica(e.target.value)}
                style={{ padding: 8, width: 160 }}
              >
                <option value="attivo">Attivo</option>
                <option value="sospeso">Sospeso</option>
              </select>
            </div>

            <div style={{ marginBottom: 10 }}>
              <textarea
                placeholder="Nota operaio"
                value={notaOperaioModifica}
                onChange={(e) => setNotaOperaioModifica(e.target.value)}
                style={{ padding: 8, width: '100%', minHeight: 70 }}
              />
            </div>

            <button onClick={salvaModificaOperaio} style={{ padding: 8 }}>
              Salva modifica operaio
            </button>

            <button
              onClick={annullaModificaOperaio}
              style={{ padding: 8, marginLeft: 10 }}
            >
              Annulla modifica
            </button>
          </div>
        )}

        <div style={{ marginTop: 20 }}>
          {operaiFiltrati.length === 0 ? (
            <p>Nessun operaio presente</p>
          ) : (
            <div style={{ display: 'grid', gap: 12 }}>
              {operaiFiltrati.map((o, i) => (
                <div
                  key={o.id || i}
                  style={{
                    border: '1px solid #e5e7eb',
                    borderRadius: 10,
                    padding: 12,
                    background: '#fafafa',
                  }}
                >
                  <div style={{ display: 'flex', justifyContent: 'space-between', gap: 12, flexWrap: 'wrap' }}>
                    <div>
                      <strong>{o.nome}</strong>
                      <span style={badgeStyle(o.stato)}>{o.stato || 'attivo'}</span>
                      <div style={{ marginTop: 6, fontSize: 14, color: '#374151' }}>
                        {o.qualifica ? `Qualifica: ${o.qualifica}` : 'Qualifica: -'}
                      </div>
                      <div style={{ marginTop: 4, fontSize: 14, color: '#374151' }}>
                        {o.telefono ? `Telefono: ${o.telefono}` : 'Telefono: -'}
                      </div>
                      <div style={{ marginTop: 4, fontSize: 14, color: '#374151' }}>
                        {o.pin ? `PIN: ${o.pin}` : 'PIN: -'}
                      </div>
                      <div style={{ marginTop: 4, fontSize: 14, color: '#374151' }}>
                        Costo orario: {formatMoney(Number(o.costo_orario || 0))}
                      </div>
                      <div style={{ marginTop: 4, fontSize: 14, color: '#374151' }}>
                        Nota: {o.nota || '-'}
                      </div>
                    </div>

                    <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', alignItems: 'flex-start' }}>
                      <button
                        onClick={() => preparaModificaOperaio(o)}
                        style={{
                          padding: 8,
                          backgroundColor: '#0275d8',
                          color: 'white',
                          border: 'none',
                          borderRadius: 6,
                          cursor: 'pointer',
                        }}
                      >
                        Modifica
                      </button>

                      {o.stato === 'sospeso' ? (
                        <button
                          onClick={() => cambiaStatoOperaio(o, 'attivo')}
                          style={{
                            padding: 8,
                            backgroundColor: '#16a34a',
                            color: 'white',
                            border: 'none',
                            borderRadius: 6,
                            cursor: 'pointer',
                          }}
                        >
                          Riattiva
                        </button>
                      ) : (
                        <button
                          onClick={() => cambiaStatoOperaio(o, 'sospeso')}
                          style={{
                            padding: 8,
                            backgroundColor: '#f59e0b',
                            color: 'white',
                            border: 'none',
                            borderRadius: 6,
                            cursor: 'pointer',
                          }}
                        >
                          Sospendi
                        </button>
                      )}

                      <button
                        onClick={() => eliminaOperaio(o.id)}
                        style={{
                          padding: 8,
                          backgroundColor: '#d9534f',
                          color: 'white',
                          border: 'none',
                          borderRadius: 6,
                          cursor: 'pointer',
                        }}
                      >
                        Elimina
                      </button>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      <div style={{ marginTop: 30, padding: 15, border: '1px solid #ccc', borderRadius: 8 }}>
        <h2>Timbratura operai per cantiere</h2>

        <div style={{ marginBottom: 10, display: 'flex', gap: 8, flexWrap: 'wrap' }}>
          <select
            value={operaioTimbratura}
            onChange={(e) => setOperaioTimbratura(e.target.value)}
            style={{ padding: 8, width: 220 }}
          >
            <option value="">Seleziona operaio attivo</option>
            {operaiAttivi.map((o, i) => (
              <option key={o.id || i} value={o.nome}>
                {o.nome}
              </option>
            ))}
          </select>

          <select
            value={cantiereTimbratura}
            onChange={(e) => setCantiereTimbratura(e.target.value)}
            style={{ padding: 8, width: 240 }}
          >
            <option value="">Seleziona cantiere</option>
            {cantieri.map((c, i) => (
              <option key={c.id || i} value={c.nome}>
                {c.nome}
              </option>
            ))}
          </select>
        </div>

        <div style={{ marginBottom: 10, display: 'flex', gap: 8, flexWrap: 'wrap' }}>
          <input
            placeholder="PIN operaio"
            value={pinTimbratura}
            onChange={(e) => setPinTimbratura(e.target.value)}
            style={{ padding: 8, width: 180 }}
          />
        </div>

        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
          <button onClick={timbraEntrata} style={buttonPrimary}>
            Timbra entrata
          </button>

          <button onClick={timbraUscita} style={buttonSecondary}>
            Timbra uscita
          </button>
        </div>

        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginTop: 10 }}>
          <button onClick={timbraEntrataConPin} style={buttonPrimary}>
            Entrata con PIN
          </button>

          <button onClick={timbraUscitaConPin} style={buttonSecondary}>
            Uscita con PIN
          </button>
        </div>

        <div style={{ marginTop: 20 }}>
          <h3>Timbrature di oggi</h3>

          {timbratureOggi.length === 0 ? (
            <p>Nessuna timbratura presente oggi</p>
          ) : (
            <ul>
              {timbratureOggi.map((t, i) => (
                <li key={t.id || i} style={{ marginBottom: 12 }}>
                  <strong>{t.operaio_nome}</strong> - {t.cantiere}
                  <br />
                  Entrata: {t.ora_entrata || '-'} | Uscita: {t.ora_uscita || '-'} | Stato:{' '}
                  {t.stato || '-'}
                  <br />
                  Costo: {formatMoney(calcolaCostoTimbratura(t))}
                  <br />
                  <button
                    onClick={() => eliminaTimbratura(t.id)}
                    style={{
                      marginTop: 6,
                      padding: 5,
                      backgroundColor: '#d9534f',
                      color: 'white',
                      border: 'none',
                      borderRadius: 4,
                      cursor: 'pointer',
                    }}
                  >
                    Elimina timbratura
                  </button>
                </li>
              ))}
            </ul>
          )}
        </div>
      </div>

      <div style={{ marginTop: 30, padding: 15, border: '1px solid #ccc', borderRadius: 8 }}>
        <h2>Elenco cantieri</h2>

        {cantieri.length === 0 ? (
          <p>Nessun cantiere presente</p>
        ) : (
          <ul>
            {cantieri.map((c, i) => (
              <li key={c.id || i} style={{ marginBottom: 10 }}>
                {c.nome}
                <br />
                <button
                  onClick={() => preparaModificaCantiere(c.nome)}
                  style={{
                    marginTop: 6,
                    marginRight: 8,
                    padding: 5,
                    backgroundColor: '#0275d8',
                    color: 'white',
                    border: 'none',
                    borderRadius: 4,
                    cursor: 'pointer',
                  }}
                >
                  Modifica
                </button>

                <button
                  onClick={() => setCantiereScheda(c.nome)}
                  style={{
                    marginTop: 6,
                    marginRight: 8,
                    padding: 5,
                    backgroundColor: '#5cb85c',
                    color: 'white',
                    border: 'none',
                    borderRadius: 4,
                    cursor: 'pointer',
                  }}
                >
                  Apri scheda
                </button>

                <button
                  onClick={() => eliminaCantiere(c.nome)}
                  style={{
                    marginTop: 6,
                    padding: 5,
                    backgroundColor: '#d9534f',
                    color: 'white',
                    border: 'none',
                    borderRadius: 4,
                    cursor: 'pointer',
                  }}
                >
                  Elimina cantiere
                </button>
              </li>
            ))}
          </ul>
        )}
      </div>

      <div style={{ marginTop: 30, padding: 15, border: '1px solid #ccc', borderRadius: 8 }}>
        <h2>{rapportinoInModifica ? 'Modifica rapportino in corso' : 'Rapportino giornaliero'}</h2>

        <div style={{ marginBottom: 10 }}>
          <select
            value={cantiereRapporto}
            onChange={(e) => setCantiereRapporto(e.target.value)}
            style={{ padding: 8, width: 260 }}
          >
            <option value="">Seleziona cantiere</option>
            {cantieri.map((c, i) => (
              <option key={c.id || i} value={c.nome}>
                {c.nome}
              </option>
            ))}
          </select>
        </div>

        <div style={{ marginBottom: 10 }}>
          <input
            type="date"
            value={data}
            onChange={(e) => setData(e.target.value)}
            style={{ padding: 8, marginRight: 8 }}
          />
          <input
            placeholder="Ore totali lavorate"
            value={ore}
            onChange={(e) => setOre(e.target.value)}
            style={{ padding: 8, width: 180 }}
          />
        </div>

        <div style={{ marginBottom: 10 }}>
          <textarea
            placeholder="Note lavoro"
            value={note}
            onChange={(e) => setNote(e.target.value)}
            style={{ padding: 8, width: '100%', minHeight: 90 }}
          />
        </div>

        <h3>Operai presenti</h3>

        <div style={{ marginBottom: 10 }}>
          <textarea
            placeholder="Nomi operai presenti"
            value={operai}
            onChange={(e) => setOperai(e.target.value)}
            style={{ padding: 8, width: '100%', minHeight: 70 }}
          />
        </div>

        <div style={{ marginBottom: 10 }}>
          <input
            placeholder="Numero presenti"
            value={numeroPresenti}
            onChange={(e) => setNumeroPresenti(e.target.value)}
            style={{ padding: 8, marginRight: 8, width: 180 }}
          />
          <input
            placeholder="Ore per ciascuno"
            value={orePerOperaio}
            onChange={(e) => setOrePerOperaio(e.target.value)}
            style={{ padding: 8, width: 180 }}
          />
        </div>

        <div style={{ marginTop: 12, fontWeight: 700 }}>
          Costo manodopera da timbrature oggi: {formatMoney(costoGiornalieroRapportino)}
        </div>

        <h3>Materiali usati</h3>

        <div style={{ marginBottom: 10 }}>
          <textarea
            placeholder="Materiali usati"
            value={materiali}
            onChange={(e) => setMateriali(e.target.value)}
            style={{ padding: 8, width: '100%', minHeight: 70 }}
          />
        </div>

        <div style={{ marginBottom: 10 }}>
          <input
            placeholder="Quantità"
            value={quantitaMateriali}
            onChange={(e) => setQuantitaMateriali(e.target.value)}
            style={{ padding: 8, marginRight: 8, width: 180 }}
          />
          <input
            placeholder="Costo materiali"
            value={costoMateriali}
            onChange={(e) => setCostoMateriali(e.target.value)}
            style={{ padding: 8, width: 180 }}
          />
        </div>

        {rapportinoInModifica ? (
          <>
            <button onClick={aggiornaRapportino} style={{ padding: 8 }}>
              Aggiorna rapportino
            </button>
            <button onClick={resetFormRapportino} style={{ padding: 8, marginLeft: 10 }}>
              Annulla modifica
            </button>
          </>
        ) : (
          <button onClick={salvaRapportino} style={{ padding: 8 }}>
            Salva rapportino
          </button>
        )}

        <button
          onClick={compilaRapportinoDaTimbrature}
          style={{ padding: 8, marginLeft: 10 }}
        >
          Compila da timbrature
        </button>

        <button onClick={generaPDF} style={{ padding: 8, marginLeft: 10 }}>
          Scarica PDF
        </button>
      </div>

      <div style={{ marginTop: 30, padding: 15, border: '1px solid #ccc', borderRadius: 8 }}>
        <h2>{fotoInModifica ? 'Modifica foto in corso' : 'Foto cantiere'}</h2>

        <div style={{ marginBottom: 10 }}>
          <select
            value={cantiereFoto}
            onChange={(e) => setCantiereFoto(e.target.value)}
            style={{ padding: 8, width: 260 }}
          >
            <option value="">Seleziona cantiere</option>
            {cantieri.map((c, i) => (
              <option key={c.id || i} value={c.nome}>
                {c.nome}
              </option>
            ))}
          </select>
        </div>

        <div style={{ marginBottom: 10 }}>
          <input type="file" accept="image/*" onChange={gestisciFileImmagine} />
          <p style={{ fontSize: 12, color: '#666', marginTop: 6 }}>
            In modifica, l’immagine attuale resta nell’anteprima. Se vuoi sostituirla,
            seleziona un nuovo file.
          </p>
        </div>

        <div style={{ marginBottom: 10 }}>
          <input
            type="date"
            value={dataFoto}
            onChange={(e) => setDataFoto(e.target.value)}
            style={{ padding: 8, marginRight: 8 }}
          />

          <input
            placeholder="Geolocalizzazione"
            value={geolocalizzazione}
            onChange={(e) => setGeolocalizzazione(e.target.value)}
            style={{ padding: 8, width: 260 }}
          />

          <button onClick={usaPosizioneAttuale} style={{ padding: 8, marginLeft: 8 }}>
            Usa posizione attuale
          </button>
        </div>

        <div style={{ marginBottom: 10 }}>
          <textarea
            placeholder="Nota foto"
            value={notaFoto}
            onChange={(e) => setNotaFoto(e.target.value)}
            style={{ padding: 8, width: '100%', minHeight: 70 }}
          />
        </div>

        {fotoInModifica ? (
          <>
            <button onClick={aggiornaFoto} style={{ padding: 8 }}>
              Aggiorna foto
            </button>
            <button onClick={resetFormFoto} style={{ padding: 8, marginLeft: 10 }}>
              Annulla modifica
            </button>
          </>
        ) : (
          <button onClick={salvaFotoCantiere} style={{ padding: 8 }}>
            Salva foto
          </button>
        )}

        {immagineBase64 && (
          <div style={{ marginTop: 15 }}>
            <p>Anteprima foto:</p>
            <img
              src={immagineBase64}
              alt="Anteprima"
              style={{ maxWidth: 250, border: '1px solid #ccc' }}
            />
          </div>
        )}
      </div>

      <div style={{ marginTop: 30, padding: 15, border: '1px solid #ccc', borderRadius: 8 }}>
        <h2>Rapportini salvati</h2>

        {rapportiniFiltrati.length === 0 ? (
          <p>Nessun rapportino presente</p>
        ) : (
          <ul>
            {rapportiniFiltrati.map((r, i) => (
              <li key={r.id || i} style={{ marginBottom: 14 }}>
                <strong>{r.cantiere}</strong> - {r.data} - {r.ore} ore
                <br />
                {r.note}
                <br />
                <em>Operai:</em> {r.operai || '-'}
                <br />
                <em>Materiali:</em> {r.materiali || '-'}
                <br />

                <button
                  onClick={() => preparaModificaRapportino(r)}
                  style={{
                    marginTop: 6,
                    marginRight: 8,
                    padding: 5,
                    backgroundColor: '#0275d8',
                    color: 'white',
                    border: 'none',
                    borderRadius: 4,
                    cursor: 'pointer',
                  }}
                >
                  Modifica rapportino
                </button>

                <button
                  onClick={() => eliminaRapportino(r.id)}
                  style={{
                    marginTop: 6,
                    padding: 5,
                    backgroundColor: '#d9534f',
                    color: 'white',
                    border: 'none',
                    borderRadius: 4,
                    cursor: 'pointer',
                  }}
                >
                  Elimina rapportino
                </button>
              </li>
            ))}
          </ul>
        )}
      </div>

      <div style={{ marginTop: 30, padding: 15, border: '1px solid #ccc', borderRadius: 8 }}>
        <h2>Foto salvate</h2>

        {fotoFiltrate.length === 0 ? (
          <p>Nessuna foto presente</p>
        ) : (
          <div>
            {fotoFiltrate.map((f, i) => (
              <div key={f.id || i} style={{ marginBottom: 20 }}>
                <strong>{f.cantiere}</strong>
                <br />
                <strong>Data foto:</strong> {f.data_foto || '-'}
                <br />
                <strong>Geolocalizzazione:</strong> {f.geolocalizzazione || '-'}
                <br />
                {f.nota}
                <br />
                <img
                  src={f.immagine_base64}
                  alt="Foto cantiere"
                  style={{ maxWidth: 250, marginTop: 8, border: '1px solid #ccc' }}
                />
                <br />

                <button
                  onClick={() => preparaModificaFoto(f)}
                  style={{
                    marginTop: 8,
                    marginRight: 8,
                    padding: 5,
                    backgroundColor: '#0275d8',
                    color: 'white',
                    border: 'none',
                    borderRadius: 4,
                    cursor: 'pointer',
                  }}
                >
                  Modifica foto
                </button>

                <button
                  onClick={() => eliminaFoto(f.id)}
                  style={{
                    marginTop: 8,
                    padding: 5,
                    backgroundColor: '#d9534f',
                    color: 'white',
                    border: 'none',
                    borderRadius: 4,
                    cursor: 'pointer',
                  }}
                >
                  Elimina foto
                </button>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}