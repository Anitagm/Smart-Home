import { useRef } from 'react';
import { MapContainer, TileLayer, Circle, Marker, Popup } from 'react-leaflet';
import L from 'leaflet';
import { homeZone, mapPersons } from '../data/map-data.js';
import OccupancyHeatmap from '../components/OccupancyHeatmap.jsx';

function personIcon(person) {
  return L.divIcon({
    className: 'map-marker-wrapper',
    html: `<div class="person-pin ${person.home ? 'is-home' : 'is-away'}">${person.name.charAt(0)}</div>`,
    iconSize: [38, 38],
    iconAnchor: [19, 19]
  });
}

export default function MapPage() {
  const mapRef = useRef(null);

  return (
    <div className="map-fullpage">
      <div className="map-toolbar">
        <button className="map-btn" type="button" aria-label="Zoom In" onClick={() => mapRef.current?.zoomIn()}>+</button>
        <button className="map-btn" type="button" aria-label="Zoom Out" onClick={() => mapRef.current?.zoomOut()}>−</button>
        <button className="map-btn" type="button" aria-label="Center Map" onClick={() => mapRef.current?.setView([homeZone.lat, homeZone.lng], 17)}>⌖</button>
      </div>

      <MapContainer
        center={[homeZone.lat, homeZone.lng]}
        zoom={17}
        zoomControl={false}
        style={{ height: '100%', width: '100%' }}
        ref={mapRef}
      >
        <TileLayer
          url="https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png"
          attribution="&copy; OpenStreetMap contributors &copy; CARTO"
          maxZoom={20}
          subdomains="abcd"
        />

        <Circle
          center={[homeZone.lat, homeZone.lng]}
          radius={homeZone.radius}
          pathOptions={{ color: '#6ea8fe', weight: 1, fillColor: '#6ea8fe', fillOpacity: 0.12 }}
        />

        {mapPersons.map((person) => (
          <Marker key={person.id} position={[person.lat, person.lng]} icon={personIcon(person)}>
            <Popup>
              <div className="map-popup">
                <div className="map-popup-header">
                  <span>🧑</span>
                  <strong>{person.name}</strong>
                </div>
                <div className="map-popup-desc">{person.description}</div>
                <div className="map-popup-status">Status: <strong>{person.home ? 'Home' : 'Away'}</strong></div>
              </div>
            </Popup>
          </Marker>
        ))}
      </MapContainer>

      <OccupancyHeatmap />
    </div>
  );
}
