import { useState } from 'react';
import { Line } from 'react-chartjs-2';
import { useForecast } from '../hooks/useForecast.js';
import { baseChartOptions, cssVar } from '../chartSetup.js';

function formatHour(iso) {
  return new Date(iso).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
}

export default function ForecastPanel() {
  const { data, status, error, reload, applyWhatIf } = useForecast(48);
  const [applianceKwh, setApplianceKwh] = useState(1.5);
  const [hourOffset, setHourOffset] = useState(6);

  const text3 = cssVar('--text-3', '#728096');
  const border = cssVar('--border', '#293442');

  if (status === 'not-trained') {
    return (
      <div className="ai-status-banner error">
        No trained forecasting model yet. From <code>backend/</code> run{' '}
        <code>python manage.py train_forecast</code>, then reload this page.
        <button type="button" className="btn" onClick={reload} style={{ marginLeft: 'auto' }}>Retry</button>
      </div>
    );
  }

  if (status === 'error') {
    return (
      <div className="ai-status-banner error">
        {error?.message || 'Could not load the forecast.'}
        <button type="button" className="btn" onClick={reload} style={{ marginLeft: 'auto' }}>Retry</button>
      </div>
    );
  }

  if (!data) {
    return <div className="ai-status-banner">Loading forecast…</div>;
  }

  const chartData = {
    labels: data.timestamps.map(formatHour),
    datasets: [
      {
        label: 'Upper bound',
        data: data.upper_kw,
        borderColor: 'transparent',
        backgroundColor: 'rgba(110,168,254,0.12)',
        fill: '+1',
        pointRadius: 0,
        tension: 0.3
      },
      {
        label: 'Forecast (kW)',
        data: data.ensemble_mean_kw,
        borderColor: '#6ea8fe',
        backgroundColor: 'rgba(110,168,254,0.25)',
        fill: false,
        pointRadius: 0,
        tension: 0.3,
        borderWidth: 2
      },
      {
        label: 'Lower bound',
        data: data.lower_kw,
        borderColor: 'transparent',
        backgroundColor: 'rgba(110,168,254,0.12)',
        fill: false,
        pointRadius: 0,
        tension: 0.3
      }
    ]
  };

  const tableRows = data.timestamps.map((ts, i) => ({
    time: formatHour(ts),
    mean: data.ensemble_mean_kw[i],
    lower: data.lower_kw[i],
    upper: data.upper_kw[i],
    ...Object.fromEntries(Object.entries(data.per_model_kw).map(([name, vals]) => [name, vals[i]]))
  }));

  return (
    <div className="ai-fade-in">
      <div className="ai-status-banner">
        🤖 Ensemble forecast from {Object.keys(data.per_model_kw).join(' + ')} trained on the UCI household power
        dataset. Shaded band = model disagreement (95% interval).
      </div>

      <div className="whatif-panel">
        <div className="whatif-field">
          <label htmlFor="whatif-kwh">What-if: run an appliance drawing</label>
          <input
            id="whatif-kwh"
            type="number"
            step="0.1"
            min="0"
            value={applianceKwh}
            onChange={(e) => setApplianceKwh(Number(e.target.value))}
          />
        </div>
        <div className="whatif-field">
          <label htmlFor="whatif-hour">…at hour offset (0-{data.horizon_hours - 1})</label>
          <input
            id="whatif-hour"
            type="number"
            min="0"
            max={data.horizon_hours - 1}
            value={hourOffset}
            onChange={(e) => setHourOffset(Number(e.target.value))}
          />
        </div>
        <button
          type="button"
          className="btn btn-primary"
          onClick={() => applyWhatIf(applianceKwh, [hourOffset])}
        >
          Apply scenario
        </button>
        <button type="button" className="btn btn-secondary" onClick={reload}>Reset</button>
      </div>

      <div className="card energy-chart-card energy-chart-card--wide">
        <h3 className="card-title">Next {data.horizon_hours}h — Global active power</h3>
        <Line data={chartData} options={{ ...baseChartOptions(text3, border), plugins: { legend: { display: false } } }} />
      </div>

      <div className="forecast-metrics-row">
        {Object.entries(data.model_test_metrics).map(([name, m]) => (
          <span className="forecast-metric-chip" key={name}>
            {name.replace('_', ' ')}: <b>MAE {m.test_mae_kw.toFixed(2)} kW</b> · RMSE {m.test_rmse_kw.toFixed(2)} kW
          </span>
        ))}
        {data.baseline_test_metrics && (
          <span className="forecast-metric-chip">
            seasonal-naive baseline: <b>MAE {data.baseline_test_metrics.test_mae_kw.toFixed(2)} kW</b>
          </span>
        )}
      </div>

      <div className="card" style={{ marginTop: 16 }}>
        <h3 className="card-title">Hour-by-hour forecast table</h3>
        <div style={{ overflowX: 'auto', maxHeight: 360, overflowY: 'auto' }}>
          <table className="ai-manager-history-table">
            <thead>
              <tr>
                <th>Time</th>
                {Object.keys(data.per_model_kw).map((name) => (
                  <th key={name}>{name.replace('_', ' ')} (kW)</th>
                ))}
                <th>Ensemble (kW)</th>
                <th>Interval (kW)</th>
              </tr>
            </thead>
            <tbody>
              {tableRows.map((row, i) => (
                <tr key={i}>
                  <td>{row.time}</td>
                  {Object.keys(data.per_model_kw).map((name) => (
                    <td key={name}>{row[name].toFixed(2)}</td>
                  ))}
                  <td><b>{row.mean.toFixed(2)}</b></td>
                  <td>{row.lower.toFixed(2)} – {row.upper.toFixed(2)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
