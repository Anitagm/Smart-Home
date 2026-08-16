import { useState } from 'react';
import { Bar } from 'react-chartjs-2';
import PageHeader from '../components/PageHeader.jsx';
import { useEnergyManager } from '../hooks/useEnergyManager.js';
import { cssVar } from '../chartSetup.js';

const ACTION_COLORS = {
  idle: '#728096',
  run_flexible_load: '#f4b942',
  charge_battery: '#55d187',
  discharge_battery: '#6ea8fe'
};

function StatusPill({ status }) {
  return <span className={`status-pill ${status}`}>{status}</span>;
}

export default function AIManagerPage() {
  const { recommendation, history, status, error, refresh, decide } = useEnergyManager();
  const [hour, setHour] = useState('');
  const [batteryPercent, setBatteryPercent] = useState(50);

  const text3 = cssVar('--text-3', '#728096');
  const border = cssVar('--border', '#293442');

  return (
    <div className="content">
      <PageHeader
        title="AI Energy Manager 🤖"
        subtitle="A Q-learning agent recommends the next action to cut cost while keeping devices usable — you decide whether to follow it."
      />

      {status === 'not-trained' && (
        <div className="ai-status-banner error">
          No trained agent yet. From <code>backend/</code> run{' '}
          <code>python manage.py train_energy_manager</code>, then reload.
          <button type="button" className="btn" onClick={() => refresh()} style={{ marginLeft: 'auto' }}>Retry</button>
        </div>
      )}

      {status === 'error' && (
        <div className="ai-status-banner error">
          {error?.message || 'Could not reach the AI backend.'}
          <button type="button" className="btn" onClick={() => refresh()} style={{ marginLeft: 'auto' }}>Retry</button>
        </div>
      )}

      <div className="ai-manager-controls">
        <div className="whatif-field">
          <label htmlFor="hour-input">Hour (0-23, blank = now)</label>
          <input id="hour-input" type="number" min="0" max="23" value={hour} onChange={(e) => setHour(e.target.value)} />
        </div>
        <div className="whatif-field">
          <label htmlFor="battery-input">Battery charge (%)</label>
          <input
            id="battery-input"
            type="number"
            min="0"
            max="100"
            value={batteryPercent}
            onChange={(e) => setBatteryPercent(Number(e.target.value))}
          />
        </div>
        <button
          type="button"
          className="btn btn-primary"
          onClick={() => refresh({ hour: hour === '' ? undefined : Number(hour), batteryPercent })}
        >
          Get recommendation
        </button>
      </div>

      {recommendation && (
        <div className="ai-manager-card ai-fade-in">
          <span className="forecast-metric-chip">
            hour {recommendation.state.hour} · price tier {recommendation.state.price_tier} · solar tier{' '}
            {recommendation.state.solar_tier} · battery tier {recommendation.state.battery_tier}
          </span>
          <div className="ai-manager-action">{recommendation.recommended_action_label}</div>
          <div className="ai-manager-explanation">{recommendation.explanation}</div>

          <div className="ai-manager-actions-row">
            <button
              type="button"
              className="btn btn-primary"
              onClick={() => decide(recommendation.recommendation_id, 'accepted')}
            >
              ✓ Accept
            </button>
            <button
              type="button"
              className="btn btn-secondary"
              onClick={() => decide(recommendation.recommendation_id, 'rejected')}
            >
              ✕ Reject
            </button>
          </div>

          <h3 className="card-title">Learned Q-value by action</h3>
          <div style={{ height: 180, marginBottom: 18 }}>
            <Bar
              data={{
                labels: recommendation.alternatives.map((a) => a.action_label.split(' (')[0]),
                datasets: [{
                  data: recommendation.alternatives.map((a) => a.q_value),
                  backgroundColor: recommendation.alternatives.map((a) => ACTION_COLORS[a.action] || '#6ea8fe'),
                  borderRadius: 4
                }]
              }}
              options={{
                indexAxis: 'y',
                responsive: true,
                maintainAspectRatio: false,
                plugins: { legend: { display: false } },
                scales: {
                  x: { grid: { color: border }, ticks: { color: text3, font: { size: 10 } } },
                  y: { grid: { display: false }, ticks: { color: text3, font: { size: 11 } } }
                }
              }}
            />
          </div>

          <h3 className="card-title">All options this agent considered</h3>
          <div className="ai-manager-alternatives">
            {recommendation.alternatives.map((alt) => (
              <div className="ai-manager-alt-row" key={alt.action}>
                <span>
                  <span className="q-color-dot" style={{ background: ACTION_COLORS[alt.action] }} />
                  {alt.action_label}
                </span>
                <span>Q = {alt.q_value}</span>
              </div>
            ))}
          </div>
        </div>
      )}

      <div className="card" style={{ marginTop: 20 }}>
        <h3 className="card-title">Recommendation history</h3>
        {history.length === 0 ? (
          <p className="ai-insights-empty">No recommendations yet — request one above.</p>
        ) : (
          <div style={{ overflowX: 'auto' }}>
            <table className="ai-manager-history-table">
              <thead>
                <tr>
                  <th>Time</th>
                  <th>Hour</th>
                  <th>Action</th>
                  <th>Q-value</th>
                  <th>Status</th>
                </tr>
              </thead>
              <tbody>
                {history.map((rec) => (
                  <tr key={rec.id}>
                    <td>{new Date(rec.created_at).toLocaleString()}</td>
                    <td>{rec.hour}</td>
                    <td>{rec.action_label}</td>
                    <td>{rec.q_value}</td>
                    <td><StatusPill status={rec.status} /></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
