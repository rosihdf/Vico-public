import { useEffect, useRef } from 'react'
import { MapContainer, TileLayer, Marker, Popup, useMap } from 'react-leaflet'
import L from 'leaflet'
import { formatCoords } from '../../../shared/geolocationUtils'
import iconUrl from 'leaflet/dist/images/marker-icon.png'
import iconRetinaUrl from 'leaflet/dist/images/marker-icon-2x.png'
import shadowUrl from 'leaflet/dist/images/marker-shadow.png'
import 'leaflet/dist/leaflet.css'

/** Marker-Icon-Fix für Leaflet (Vite/Webpack-Pfadproblem) */
const defaultIcon = L.icon({
  iconUrl,
  iconRetinaUrl,
  shadowUrl,
  iconSize: [25, 41],
  iconAnchor: [12, 41],
  popupAnchor: [1, -34],
  shadowSize: [41, 41],
})

const MapCenterUpdater = ({ center }: { center: [number, number] }) => {
  const map = useMap()
  useEffect(() => {
    map.setView(center, 17)
  }, [map, center])
  return null
}

type LocationMapModalProps = {
  lat: number
  lon: number
  label: string
  onClose: () => void
}

const LocationMapModal = ({ lat, lon, label, onClose }: LocationMapModalProps) => {
  const center: [number, number] = [lat, lon]
  const overlayRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    overlayRef.current?.focus()
  }, [])

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose()
    }
    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [onClose])

  const osmLink = `https://www.openstreetmap.org/?mlat=${lat}&mlon=${lon}&zoom=17`

  return (
    <div
      ref={overlayRef}
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50"
      role="dialog"
      aria-modal
      aria-labelledby="location-map-title"
      onClick={onClose}
      tabIndex={-1}
    >
      <div
        className="bg-white dark:bg-slate-800 rounded-xl shadow-xl max-w-lg w-full overflow-hidden border border-slate-200 dark:border-slate-600"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between gap-2 p-3 border-b border-slate-200 dark:border-slate-600">
          <h3 id="location-map-title" className="text-lg font-semibold text-slate-800 dark:text-slate-100">
            {label}
          </h3>
          <button
            type="button"
            onClick={onClose}
            className="p-2 rounded-lg text-slate-500 dark:text-slate-400 hover:text-slate-700 dark:hover:text-slate-100 hover:bg-slate-100 dark:hover:bg-slate-700"
            aria-label="Schließen"
          >
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>
        <div className="p-3">
          <p className="text-sm text-slate-600 dark:text-slate-300 mb-2">{formatCoords(lat, lon)}</p>
          <div className="h-64 rounded-lg overflow-hidden border border-slate-200 dark:border-slate-600">
            <MapContainer
              center={center}
              zoom={17}
              className="h-full w-full"
              scrollWheelZoom
            >
              <MapCenterUpdater center={center} />
              <TileLayer
                attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>'
                url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
              />
              <Marker position={center} icon={defaultIcon}>
                <Popup>{label}</Popup>
              </Marker>
            </MapContainer>
          </div>
          <a
            href={osmLink}
            target="_blank"
            rel="noopener noreferrer"
            className="mt-2 inline-block text-sm text-vico-primary hover:underline"
          >
            In OpenStreetMap öffnen
          </a>
        </div>
      </div>
    </div>
  )
}

export default LocationMapModal
