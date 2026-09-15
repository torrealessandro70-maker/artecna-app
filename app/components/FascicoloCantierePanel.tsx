'use client'

import FascicoloCockpit from './FascicoloCockpit'
import { createPhotoRuntimeFeed, createReportRuntimeFeed, createDocumentRuntimeFeed, createSalRuntimeFeed, createRuntimeFeedSnapshot } from '../runtime/feed'

type RigaCantiere = { id?: string; cantiere?: string; created_at?: string }
export type FascicoloPanelProps = {
  foto: (RigaCantiere & { nota?: string; data_foto?: string })[]
  rapportini: (RigaCantiere & { note?: string; data?: string })[]
  preventivi: RigaCantiere[]
  sal: { cantiere?: string }[]
}
type Props = {
  cantiere: { id: string; nome: string; lavori_conclusi?: boolean | null }
  panelProps: FascicoloPanelProps
  onApriArea: (area: 'lavori' | 'documenti' | 'economia') => void
}

export default function FascicoloCantierePanel({ cantiere, panelProps: p, onApriArea }: Props) {
  const foto = p.foto.filter((riga) => riga.cantiere === cantiere.nome)
  const rapportini = p.rapportini.filter((riga) => riga.cantiere === cantiere.nome)
  const preventivi = p.preventivi.filter((riga) => riga.cantiere === cantiere.nome)
  const sal = p.sal.filter((riga) => riga.cantiere === cantiere.nome)
  const feed = createRuntimeFeedSnapshot([
    ...createPhotoRuntimeFeed(foto),
    ...createReportRuntimeFeed(rapportini),
    ...createDocumentRuntimeFeed({ count: preventivi.length, cantiere: cantiere.nome }),
    ...createSalRuntimeFeed({ count: sal.length, cantiere: cantiere.nome }),
  ])
  const stato = cantiere.lavori_conclusi === true ? 'Lavori conclusi'
    : cantiere.lavori_conclusi === false ? 'Lavori non conclusi' : 'Stato lavori non disponibile'
  const contenuti = [
    { label: 'Foto', count: foto.length },
    { label: 'Rapportini', count: rapportini.length },
    { label: 'Preventivi archiviati', count: preventivi.length },
    { label: 'Lavorazioni SAL', count: sal.length },
  ]
  return (
    <section aria-label="Fascicolo del cantiere" style={{ display: 'grid', gap: 16, minWidth: 0 }}>
      <header>
        <h3 style={{ margin: '0 0 8px', fontSize: 22 }}>Fascicolo del cantiere</h3>
        <p style={{ margin: 0, color: '#64748b' }}>Quadro gestionale e consistenza dei contenuti collegati.</p>
      </header>
      <FascicoloCockpit sintetico cantiereName={cantiere.nome} nomeCantiereVisualizzato={cantiere.nome}
        subtitle="Sintesi dei contenuti registrati nel cantiere" focus={stato} feed={feed} />
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(150px, 1fr))', gap: 12 }}>
        {contenuti.map((item) => <article key={item.label} style={{ padding: 16, background: '#fff', border: '1px solid #e2e8f0', borderRadius: 10 }}>
          <div style={{ color: '#64748b', fontSize: 13 }}>{item.label}</div>
          <strong style={{ fontSize: 24 }}>{item.count}</strong>
        </article>)}
      </div>
      <nav aria-label="Aree del cantiere" style={{ display: 'flex', flexWrap: 'wrap', gap: 10 }}>
        {(['lavori', 'documenti', 'economia'] as const).map((area) => <button key={area} type="button" onClick={() => onApriArea(area)}
          style={{ minHeight: 44, padding: '10px 16px', background: '#fff', border: '1px solid #cbd5e1', borderRadius: 8, cursor: 'pointer', color: '#334155' }}>
          {area === 'lavori' ? 'Apri Lavori' : area === 'documenti' ? 'Apri Documenti' : 'Apri Economia'}
        </button>)}
      </nav>
    </section>
  )
}
