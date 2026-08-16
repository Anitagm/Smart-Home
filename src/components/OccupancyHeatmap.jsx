import { useOccupancy } from '../hooks/useOccupancy.js';

function probColor(p) {
  if (p >= 0.66) return '#55d187';
  if (p >= 0.33) return '#f4b942';
  return '#6ea8fe';
}

export default function OccupancyHeatmap() {
  const { data, status, error, reload } = useOccupancy();

  return (
    <div className="map-occupancy-panel card">
      <div className="occupancy-panel-head">
        <h3 className="card-title">
          <span className="ai-badge">🤖 AI</span> Predicted occupancy
        </h3>
        <span className="energy-live-badge">
          <span className="energy-live-dot"></span> Live
        </span>
      </div>

      {status === 'loading' && !data && <p className="ai-insights-empty">Loading…</p>}

      {status === 'not-trained' && (
        <p className="ai-insights-empty">
          Model not trained yet. Run <code>python manage.py train_occupancy</code> in{' '}
          <code>backend/</code>.
        </p>
      )}

      {status === 'error' && (
        <div>
          <p className="ai-insights-empty">{error?.message || 'Could not reach the AI backend.'}</p>
          <button type="button" className="btn" onClick={reload}>Retry</button>
        </div>
      )}

      {data && (
        <div className="occupancy-grid">
          {data.rooms.map((room, i) => (
            <div
              className="occupancy-room-card ai-fade-in"
              key={room.room}
              style={{ animationDelay: `${i * 60}ms` }}
            >
              <span className="occupancy-room-name">{room.room}</span>
              <div className="occupancy-bar-track">
                <div
                  className="occupancy-bar-fill"
                  style={{
                    width: `${Math.round(room.occupancy_probability * 100)}%`,
                    background: probColor(room.occupancy_probability)
                  }}
                />
              </div>
              <span className="occupancy-prob">{Math.round(room.occupancy_probability * 100)}% likely occupied</span>
              <span className={`occupancy-badge ${room.occupied ? 'occupied' : 'empty'}`}>
                {room.occupied ? 'Likely occupied' : 'Likely empty'}
              </span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
