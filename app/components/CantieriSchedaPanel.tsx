'use client'

import { useEffect, useId, useState } from 'react'
import { ArrowLeft } from 'lucide-react'

type SchedaCantierePagina = 'panoramica' | 'lavori' | 'documenti'
type LavoriSezione = 'rapportini' | 'foto' | 'presenze' | 'materiali' | 'attrezzature'
import RapportiniCantierePanel from './RapportiniCantierePanel'
import SelectCantiere from './SelectCantiere'
import MaterialiCantierePanel from './MaterialiCantierePanel'
import AttrezzatureCantierePanel from './AttrezzatureCantierePanel'
import DocumentiCantierePanel from './DocumentiCantierePanel'
import DettaglioManodoperaPanel from './DettaglioManodoperaPanel'
import FotoCantiereToolbar from './FotoCantiereToolbar'
import FotoCantiereCamera from './FotoCantiereCamera'
import FotoCantiereForm from './FotoCantiereForm'
import FotoCantiereFiltri from './FotoCantiereFiltri'
import FotoCantiereGallery from './FotoCantiereGallery'
import FotoCantiereAnteprime from './FotoCantiereAnteprime'
import FotoCantiereCategoriaModal from './FotoCantiereCategoriaModal'

export default function CantieriSchedaPanel(props: any) {
  const p = props
  const [filtroOperaio, setFiltroOperaio] = useState('')
  const elencoOperaiId = useId()
  const ricercaOperaio = filtroOperaio.toLocaleLowerCase('it-IT')
  const nomeCantiereFoto = p.cantiereSelezionatoDaId?.nome ?? ''
  const fotoDelCantiere = p.cantiereSelezionatoDaId?.id && nomeCantiereFoto
    ? p.fotoCantiere.filter((foto: any) => foto.cantiere === nomeCantiereFoto)
    : []
  const fotoSelezionateDelCantiere = p.fotoCantiereSelezionate.filter((id: string) =>
    fotoDelCantiere.some((foto: any) => foto.id === id)
  )

  useEffect(() => {
    p.setFotoCantiereSelezionate([])
  }, [p.cantiereSelezionatoDaId?.id, p.setFotoCantiereSelezionate])
  const [paginaAttiva, setPaginaAttiva] = useState<SchedaCantierePagina>('panoramica')
  const [lavoriSezione, setLavoriSezione] = useState<LavoriSezione>('rapportini')
  const apriLavori = (sezione: LavoriSezione) => {
    setLavoriSezione(sezione)
    setPaginaAttiva('lavori')
  }

  const azioniRapide: Array<{
    id: LavoriSezione
    titolo: string
    sezione: string
    descrizione: string
  }> = [
    {
      id: 'rapportini', sezione: 'Rapportini',
      titolo: 'Rapportino', descrizione: 'Apri area rapportini',

    },
    {
      id: 'foto', sezione: 'Foto',
      titolo: 'Foto', descrizione: 'Galleria e caricamento',

    },
    {
      id: 'presenze', sezione: 'Presenze',
      titolo: 'Presenza', descrizione: 'Dettaglio manodopera',
    },
    {
      id: 'materiali', sezione: 'Materiali',
      titolo: 'Materiale', descrizione: 'Materiali del cantiere',
    },
    {
      id: 'attrezzature', sezione: 'Attrezzature',
      titolo: 'Attrezzature', descrizione: 'Attrezzature del cantiere',
    },
  ]

  return (
    <div style={{ ...p.cardStyle, minWidth: 0, background: '#f8fafc' }}>
      <header
        style={{
          display: 'flex', flexWrap: 'wrap', alignItems: 'flex-start',
          gap: 24, padding: 24, background: '#fff',
          border: '1px solid #e2e8f0', borderRadius: 16,
          boxShadow: '0 2px 6px rgb(15 23 42 / 3%)',
        }}
      >
        <div style={{ flex: '1 1 240px', minWidth: 0 }}>
          <p style={{ margin: '0 0 12px', color: '#64748b', fontSize: 13 }}>
            Scheda cantiere
          </p>
          {typeof p.cantiereSelezionatoDaId?.lavori_conclusi === 'boolean' && (
            <span style={{
              display: 'inline-block', padding: '4px 10px', borderRadius: 20,
              background: '#f1f5f9', color: '#475569', fontSize: 12,
              fontWeight: 600, marginBottom: 12,
            }}>
              {p.cantiereSelezionatoDaId.lavori_conclusi ? 'Lavori conclusi' : 'Lavori non conclusi'}
            </span>
          )}
          <h2 style={{
            margin: 0, color: '#0f172a', fontSize: 28, lineHeight: 1.2,
            letterSpacing: '-0.02em', overflowWrap: 'anywhere',
          }}>
            {p.cantiereNomeVisualizzato || 'Seleziona un cantiere'}
          </h2>
        </div>

        <div style={{ flex: '0 1 360px', minWidth: 0, width: '100%' }}>
          <p style={{ margin: '0 0 8px', color: '#334155', fontSize: 13, fontWeight: 600 }}>
            Cambia cantiere
          </p>
          <SelectCantiere
            cantieri={p.cantieri}
            value={p.cantiereScheda || ''}
            onChange={p.setCantiereScheda}
            onChangeId={p.setCantiereIdScheda}
            inputStyle={{
              padding: 10, width: '100%', maxWidth: '100%', boxSizing: 'border-box',
              border: '1px solid #94a3b8', borderRadius: 8, background: '#fff',
              color: '#0f172a', marginBottom: 12,
            }}
            buttonSecondary={p.buttonSecondary}
          />
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
            <input
              aria-label="Cerca cantiere"
              placeholder="Cerca cantiere..."
              value={p.ricercaCantiereEconomia}
              onChange={(e) => p.setRicercaCantiereEconomia(e.target.value)}
              style={{ ...p.inputStyle, flex: '1 1 160px', minWidth: 0, width: '100%', boxSizing: 'border-box' }}
            />
            <button
              type="button"
              onClick={() => p.setMostraConclusiEconomia(!p.mostraConclusiEconomia)}
              style={p.buttonSecondary}
            >
              {p.mostraConclusiEconomia ? 'Nascondi conclusi' : 'Mostra conclusi'}
            </button>
          </div>
          {p.cantiereSelezionatoDaId && (
            <details style={{ marginTop: 12, color: '#475569', fontSize: 13 }}>
              <summary style={{ cursor: 'pointer', padding: '8px 0' }}>Altro</summary>
              <button
                type="button"
                onClick={p.modificaNomeCantiereScheda}
                style={p.buttonSecondary}
              >
                Modifica nome
              </button>
            </details>
          )}
        </div>
      </header>

      <nav aria-label="Sezioni cantiere" style={{
        display: 'flex', gap: 4, overflowX: 'auto', maxWidth: '100%',
        marginTop: 20, marginBottom: 24, borderBottom: '1px solid #e2e8f0',
      }}>
        {(['panoramica', 'lavori', 'documenti'] as const).map((pagina) => (
          <button
            key={pagina}
            type="button"
            aria-current={paginaAttiva === pagina ? 'page' : undefined}
            onClick={() => setPaginaAttiva(pagina)}
            style={{
              flexShrink: 0, minHeight: 44, padding: '12px 16px', fontSize: 14,
              fontWeight: paginaAttiva === pagina ? 600 : 400,
              color: paginaAttiva === pagina ? '#1d4ed8' : '#475569',
              border: 0, background: 'transparent', cursor: 'pointer',
              borderBottom: paginaAttiva === pagina ? '2px solid #1d4ed8' : '2px solid transparent',
            }}
          >
            {pagina === 'panoramica' ? 'Panoramica' : pagina === 'lavori' ? 'Lavori' : 'Documenti'}
          </button>
        ))}
        {['Economia', 'Fascicolo', 'Timeline', 'Analisi AI'].map((sezione) => (
          <button key={sezione} type="button" disabled style={{
            flexShrink: 0, minHeight: 44, padding: '12px 16px', fontSize: 14,
            color: '#94a3b8', border: 0, background: 'transparent', cursor: 'not-allowed',
          }}>
            {sezione}
          </button>
        ))}
      </nav>
      {p.cantiereSelezionatoDaId && (
        <section hidden={paginaAttiva !== 'panoramica'} aria-label="Azioni rapide" style={{ marginBottom: 24 }}>
          <h3 style={{ margin: '0 0 14px', fontSize: 18, color: '#0f172a' }}>
            Azioni rapide
          </h3>
          <div className="scheda-cantiere-azioni-rapide">
            {azioniRapide.map((azione) => (
              <button
                key={azione.titolo}
                type="button"
                onClick={() => apriLavori(azione.id)}
                className="scheda-cantiere-azione-rapida"
              >
                <span style={{ display: 'block', fontSize: 16, fontWeight: 600 }}>
                  {azione.titolo}
                </span>
                <span style={{ display: 'block', marginTop: 8, fontSize: 13, color: '#64748b', lineHeight: 1.5 }}>
                  {azione.descrizione}
                </span>
              </button>
            ))}
          </div>
          <style>{`
            .scheda-cantiere-azioni-rapide {
              display: grid;
              grid-template-columns: repeat(2, minmax(0, 1fr));
              gap: 12px;
            }
            .scheda-cantiere-azione-rapida {
              min-width: 0;
              min-height: 112px;
              padding: 18px 14px;
              border: 1px solid #e2e8f0;
              border-radius: 12px;
              background: #fff;
              color: #0f172a;
              text-align: left;
              font-family: inherit;
              overflow-wrap: anywhere;
              cursor: pointer;
              box-shadow: 0 2px 6px rgb(15 23 42 / 3%);
            }
            .scheda-cantiere-azione-rapida:hover {
              background: #eff6ff;
              border-color: #93c5fd;
            }
            .scheda-cantiere-azione-rapida:focus-visible {
              outline: 2px solid #2563eb;
              outline-offset: 3px;
            }
            @media (min-width: 900px) {
              .scheda-cantiere-azioni-rapide {
                grid-template-columns: repeat(5, minmax(0, 1fr));
              }
            }
          `}</style>
        </section>
      )}
      {p.cantiereSelezionatoDaId && paginaAttiva === 'documenti' && (
        <DocumentiCantierePanel key={p.cantiereSelezionatoDaId.id}
          cantiere={p.cantiereSelezionatoDaId} panelProps={p.documentiPanelProps} />
      )}
      {p.cantiereSelezionatoDaId && paginaAttiva === 'lavori' && (
        <section aria-label="Lavori">
          <button type="button" onClick={() => setPaginaAttiva('panoramica')} style={{
            ...p.buttonSecondary, display: 'inline-flex', alignItems: 'center',
            gap: 8, minHeight: 44, marginBottom: 16,
          }}>
            <ArrowLeft size={18} aria-hidden="true" /> Panoramica
          </button>
          <h3 style={{ margin: '0 0 16px', color: '#0f172a', fontSize: 22 }}>Lavori</h3>
          <nav aria-label="Sezioni lavori" style={{
            display: 'flex', gap: 8, overflowX: 'auto', paddingBottom: 12,
            borderBottom: '1px solid #e2e8f0', marginBottom: 20,
          }}>
            {azioniRapide.map((azione) => (
              <button key={azione.id} type="button"
                aria-pressed={lavoriSezione === azione.id}
                onClick={() => setLavoriSezione(azione.id)}
                style={{
                  minHeight: 44, flexShrink: 0, padding: '10px 16px', borderRadius: 8,
                  border: lavoriSezione === azione.id ? '1px solid #2563eb' : '1px solid #e2e8f0',
                  background: lavoriSezione === azione.id ? '#eff6ff' : '#fff',
                  color: lavoriSezione === azione.id ? '#1d4ed8' : '#475569',
                  fontWeight: 600, cursor: 'pointer',
                }}>
                {azione.sezione}
              </button>
            ))}
          </nav>
          {lavoriSezione === 'attrezzature' && (
            <AttrezzatureCantierePanel key={p.cantiereSelezionatoDaId.id}
              cantiere={p.cantiereSelezionatoDaId} panelProps={p.attrezzaturePanelProps}
              fattureFornitori={p.fattureFornitori} righeAttrezzatureFatture={p.righeAttrezzatureFatture} />
          )}
          {lavoriSezione === 'materiali' && (
            <MaterialiCantierePanel key={p.cantiereSelezionatoDaId.id}
              cantiere={p.cantiereSelezionatoDaId}
              panelProps={p.materialiPanelProps}
              fattureFornitori={p.fattureFornitori}
              righeMaterialiFatture={p.righeMaterialiFatture}
            />
          )}
          {lavoriSezione === 'presenze' && (
            <section aria-label="Presenze del cantiere" style={{ padding: 20, border: '1px solid #e2e8f0', borderRadius: 12, background: '#fff', minWidth: 0 }}>
              <h4 style={{ margin: '0 0 16px', fontSize: 18 }}>Presenze del cantiere</h4>
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: 12, alignItems: 'flex-end', marginBottom: 16 }}>
                <label style={{ display: 'grid', gap: 6 }}>
                  Dal
                  <input type="date" value={p.economiaDataDa} onChange={(e) => p.setEconomiaDataDa(e.target.value)} />
                </label>
                <label style={{ display: 'grid', gap: 6 }}>
                  Al
                  <input type="date" value={p.economiaDataA} onChange={(e) => p.setEconomiaDataA(e.target.value)} />
                </label>
                <label style={{ display: 'grid', gap: 6, flex: '1 1 220px', minWidth: 0 }}>
                  Operaio
                  <input
                    type="text"
                    list={elencoOperaiId}
                    value={filtroOperaio}
                    onChange={(e) => setFiltroOperaio(e.target.value)}
                    placeholder="Digita o seleziona..."
                    autoComplete="off"
                    style={{ minWidth: 0, width: '100%', boxSizing: 'border-box' }}
                  />
                </label>
                <datalist id={elencoOperaiId}>
                  {Array.from(new Set<string>(p.operaiAnagrafica.map((operaio: { nome: string }) => operaio.nome)))
                    .filter((nome) => nome.toLocaleLowerCase('it-IT').includes(ricercaOperaio))
                    .map((nome) => <option key={nome} value={nome} />)}
                </datalist>
                <button type="button" onClick={() => {
                  p.setEconomiaDataDa('')
                  p.setEconomiaDataA('')
                  setFiltroOperaio('')
                }} style={p.buttonSecondary}>
                  Reset
                </button>
              </div>
              <DettaglioManodoperaPanel
                {...p}
                contestuale
                timbrature={p.timbrature
                  .filter((t: any) => t.cantiere === p.cantiereSelezionatoDaId.nome)
                  .filter((t: { operaio_nome: string }) => t.operaio_nome.toLocaleLowerCase('it-IT').includes(ricercaOperaio))}
                cantiereScheda={p.cantiereSelezionatoDaId.nome}
                totaleManodoperaCantiere={p.calcolaTotaleManodoperaCantiere(p.cantiereSelezionatoDaId.nome)}
              />
              <p style={{ margin: '12px 0 0', fontSize: 13, color: '#64748b' }}>
                La tabella mostra le timbrature filtrate. Il totale manodopera riguarda tutti gli operai del cantiere nel periodo selezionato e comprende anche i costi dei rapportini; non cambia con il filtro Operaio.
              </p>
            </section>
          )}
        </section>
      )}
      {p.cantiereSelezionatoDaId && (
        <div hidden={paginaAttiva !== 'lavori' || lavoriSezione !== 'rapportini'}>
          <RapportiniCantierePanel
            key={p.cantiereSelezionatoDaId.id}
            cantiere={p.cantiereSelezionatoDaId}
            rapportini={p.rapportini}
            formProps={p.rapportinoFormProps}
            resetFormRapportino={p.resetFormRapportino}
            preparaModificaRapportino={p.preparaModificaRapportinoLocale}
            eliminaRapportino={p.eliminaRapportino}
            generaPdfRapportinoFotografico={p.generaPdfRapportinoFotografico}
          />
        </div>
      )}
      {!p.cantiereSelezionatoDaId ? (
        <p>Seleziona un cantiere per vedere i dettagli.</p>
      ) : (
        (() => {
          const dati = p.calcoloEconomiaCantiere(p.cantiereScheda)

          const margine =
            dati.preventivo > 0
              ? ((dati.utileReale / dati.preventivo) * 100).toFixed(1)
              : 0

          return (
            <div>
              <div hidden={paginaAttiva !== 'panoramica'}>
              <div
                style={{
                  marginTop: 15,
                  padding: 15,
                  border: '1px solid #ddd',
                  borderRadius: 10,
                }}
              >
                <h3 style={{ marginTop: 0 }}>Stato cantiere</h3>

                <p>Preventivo: {p.formatMoney(dati.preventivo)}</p>
                <p>Manodopera: {p.formatMoney(dati.costoManodopera)}</p>
                <p>Fornitori: {p.formatMoney(dati.costoFornitori)}</p>

                <p>
                  <strong>
                    Costo totale: {p.formatMoney(dati.costoTotale)}
                  </strong>
                </p>

                <p>
                  <strong
                    style={{
                      color: dati.utileReale >= 0 ? 'green' : 'red',
                    }}
                  >
                    Utile: {p.formatMoney(dati.utileReale)}
                  </strong>
                </p>

                <p>
                  <strong>Margine: {margine}%</strong>
                </p>
              </div>

              <div style={{ marginTop: 15 }}>
                {dati.utileReale < 0 ? (
                  <strong style={{ color: 'red' }}>
                    🚨 Cantiere in perdita
                  </strong>
                ) : Number(margine) < 10 ? (
                  <strong style={{ color: '#f59e0b' }}>
                    ⚠️ Margine basso
                  </strong>
                ) : (
                  <strong style={{ color: 'green' }}>
                    ✅ Cantiere in utile
                  </strong>
                )}
              </div>

              </div>
              <div
                hidden={paginaAttiva !== 'lavori' || lavoriSezione !== 'foto'}
                tabIndex={-1}
                role="region"
                aria-label="Foto cantiere"
                style={{
                  marginTop: 20,
                  padding: 15,
                  border: '1px solid #d1d5db',
                  borderRadius: 12,
                  background: '#fff',
                }}
              >

                <FotoCantiereToolbar
                  contestuale
                  caricaFotoDaInput={p.caricaFotoDaInput}
                  cameraFotoCantiereAttiva={p.cameraFotoCantiereAttiva}
                  setCameraFotoCantiereAttiva={
                    p.setCameraFotoCantiereAttiva
                  }
                  rilevaPosizioneFoto={p.rilevaPosizioneFoto}
                  fotoDaCaricare={p.fotoDaCaricare}
                  categoriaFoto={p.categoriaFoto}
                  setCategoriaFotoDaSalvare={p.setCategoriaFotoDaSalvare}
                  setPopupCategoriaFotoCantiere={
                    p.setPopupCategoriaFotoCantiere
                  }
                  esportaPdfFotoCantiere={p.esportaPdfFotoCantiere}
                  buttonPrimary={p.buttonPrimary}
                  buttonSecondary={p.buttonSecondary}
                />

                <FotoCantiereCamera
                  cameraFotoCantiereAttiva={p.cameraFotoCantiereAttiva}
                  cameraFotoCantiereFullscreen={
                    p.cameraFotoCantiereFullscreen
                  }
                  setCameraFotoCantiereFullscreen={
                    p.setCameraFotoCantiereFullscreen
                  }
                  webcamFotoCantiereRef={p.webcamFotoCantiereRef}
                  scattaFotoCantiere={p.scattaFotoCantiere}
                />

                <FotoCantiereForm
                  notaFotoCantiere={p.notaFotoCantiere}
                  setNotaFotoCantiere={p.setNotaFotoCantiere}
                  categoriaFoto={p.categoriaFoto}
                  setCategoriaFoto={p.setCategoriaFoto}
                  note={p.note}
                  setNote={p.setNote}
                  avviaDettatura={p.avviaDettatura}
                  buttonSecondary={p.buttonSecondary}
                />

                <div style={{ marginTop: 15 }}>
                  <strong>
                    Foto salvate per questo cantiere:{' '}
                    {
                      fotoDelCantiere.length
                    }
                  </strong>
                </div>

                <FotoCantiereFiltri
                  filtroFotoCantiere={p.filtroFotoCantiere}
                  setFiltroFotoCantiere={p.setFiltroFotoCantiere}
                  fotoCantiereSelezionate={fotoSelezionateDelCantiere}
                  setFotoCantiereSelezionate={
                    p.setFotoCantiereSelezionate
                  }
                  categoriaFotoMultipla={p.categoriaFotoMultipla}
                  setCategoriaFotoMultipla={p.setCategoriaFotoMultipla}
                  aggiornaCategoriaFotoSelezionate={
                    p.aggiornaCategoriaFotoSelezionate
                  }
                  buttonPrimary={p.buttonPrimary}
                  buttonSecondary={p.buttonSecondary}
                />

                {fotoDelCantiere.length === 0 && (
                  <p style={{ margin: '18px 0', color: '#64748b' }}>
                    Nessuna foto registrata per questo cantiere.
                  </p>
                )}
                <FotoCantiereGallery
                  contestuale
                  fotoCantiere={fotoDelCantiere}
                  setFotoCantiere={p.setFotoCantiere}
                  cantiereScheda={nomeCantiereFoto}
                  filtroFotoCantiere={p.filtroFotoCantiere}
                  fotoCantiereSelezionate={fotoSelezionateDelCantiere}
                  setFotoCantiereSelezionate={
                    p.setFotoCantiereSelezionate
                  }
                  setFotoFullscreen={p.setFotoFullscreen}
                  supabase={p.supabase}
                  fotoStorageBucket={p.fotoStorageBucket}
                  caricaFotoCantiere={p.caricaFotoCantiere}
                  eliminaFotoCantiere={p.eliminaFotoCantiere}
                  buttonSecondary={p.buttonSecondary}
                />

                {p.geolocalizzazioneFoto && (
                  <div
                    style={{
                      marginBottom: 10,
                      fontSize: 13,
                      color: '#475569',
                    }}
                  >
                    📍 {p.geolocalizzazioneFoto}
                  </div>
                )}

                <FotoCantiereAnteprime
                  fotoDaCaricare={p.fotoDaCaricare}
                  setFotoDaCaricare={p.setFotoDaCaricare}
                />

                <FotoCantiereCategoriaModal
                  popupCategoriaFotoCantiere={p.popupCategoriaFotoCantiere}
                  fotoDaCaricare={p.fotoDaCaricare}
                  categoriaFotoDaSalvare={p.categoriaFotoDaSalvare}
                  setCategoriaFotoDaSalvare={p.setCategoriaFotoDaSalvare}
                  setPopupCategoriaFotoCantiere={
                    p.setPopupCategoriaFotoCantiere
                  }
                  setCategoriaFoto={p.setCategoriaFoto}
                  salvaFotoCantiere={p.salvaFotoCantiere}
                  buttonPrimary={p.buttonPrimary}
                  buttonSecondary={p.buttonSecondary}
                />
              </div>
            </div>
          )
        })()
      )}
    </div>
  )
}
