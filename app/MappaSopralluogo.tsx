'use client'

import 'leaflet/dist/leaflet.css'
import { MapContainer, TileLayer, Marker, useMapEvents } from 'react-leaflet'

type Punto = {
  lat: number
  lng: number
}

type Props = {
  punto: Punto | null
  setPunto: (punto: Punto) => void
}

function ClickMappa({ setPunto }: { setPunto: (punto: Punto) => void }) {
  useMapEvents({
    click(e) {
      setPunto({
        lat: e.latlng.lat,
        lng: e.latlng.lng,
      })
    },
  })

  return null
}

export default function MappaSopralluogo({ punto, setPunto }: Props) {
  return (
    <MapContainer
      center={punto ? [punto.lat, punto.lng] : [37.5079, 15.083]}
      zoom={15}
      style={{
        height: '100%',
        width: '100%',
      }}
    >
      <TileLayer
        attribution="&copy; OpenStreetMap"
        url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
      />

      <ClickMappa setPunto={setPunto} />

      {punto && <Marker position={[punto.lat, punto.lng]} />}
    </MapContainer>
  )
}