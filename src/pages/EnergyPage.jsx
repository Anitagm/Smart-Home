import { useState } from 'react';
import { Bar, Line } from 'react-chartjs-2';
import PageHeader from '../components/PageHeader.jsx';
import EnergyDistributionDiagram from '../components/EnergyDistributionDiagram.jsx';
import SourcesTable from '../components/SourcesTable.jsx';
import GaugeDonut from '../components/GaugeDonut.jsx';
import GridBalanceBar from '../components/GridBalanceBar.jsx';
import EnergyFlowSankey from '../components/EnergyFlowSankey.jsx';
import EnergyPeriodBar from '../components/EnergyPeriodBar.jsx';
import EnergyNowPanel from '../components/EnergyNowPanel.jsx';
import ForecastPanel from '../components/ForecastPanel.jsx';
import '../chartSetup.js';
import { baseChartOptions, cssVar } from '../chartSetup.js';
import {
  energySummary,
  sources,
  monthLabels,
  electricityUsage,
  powerSources,
  gasConsumptionMonthly,
  waterConsumptionMonthly,
  solarProductionMonthly,
  deviceMonthlyUsage,
  deviceTotalUsage,
  gridBalance,
  gauges,
  detailedSources
} from '../data/energy-data.js';

const TABS = [
  { id: 'summary', label: 'Summary' },
  { id: 'electricity', label: 'Electricity' },
  { id: 'gas', label: 'Gas' },
  { id: 'water', label: 'Water' },
  { id: 'now', label: 'Now' },
  { id: 'forecast', label: 'Forecast 🤖' }
];

export default function EnergyPage() {
  const [tab, setTab] = useState('summary');

  function handleTabClick(id) {
    setTab(id);
  }

  const text3 = cssVar('--text-3', '#728096');
  const border = cssVar('--border', '#293442');

  const s = energySummary;
  const electricityTotal = electricityUsage.consumedSolar.reduce((a, b) => a + b, 0)
    + electricityUsage.consumedBattery.reduce((a, b) => a + b, 0)
    + electricityUsage.combinedFromGrid.reduce((a, b) => a + b, 0);
  const solarProdTotal = solarProductionMonthly.reduce((a, b) => a + b, 0);
  const deviceTotalMax = Math.max(...deviceTotalUsage.map((d) => d.kwh));
  const sortedDeviceTotals = [...deviceTotalUsage].sort((a, b) => b.kwh - a.kwh);
  const gasTotal = gasConsumptionMonthly.reduce((a, b) => a + b, 0);
  const waterTotal = waterConsumptionMonthly.reduce((a, b) => a + b, 0);

  const electricityChartData = {
    labels: monthLabels,
    datasets: [
      { label: 'Consumed solar', data: electricityUsage.consumedSolar, backgroundColor: '#f4b942', stack: 'usage' },
      { label: 'Consumed battery', data: electricityUsage.consumedBattery, backgroundColor: '#55d187', stack: 'usage' },
      { label: 'Combined from grid', data: electricityUsage.combinedFromGrid, backgroundColor: '#6ea8fe', stack: 'usage' },
      { label: 'Returned to grid low tariff', data: electricityUsage.returnedLowTariff, backgroundColor: '#a78bfa', stack: 'usage' },
      { label: 'Returned to grid high tariff', data: electricityUsage.returnedHighTariff, backgroundColor: '#38c7c2', stack: 'usage' }
    ]
  };

  const electricityLegend = [
    { label: 'Consumed solar', color: '#f4b942' },
    { label: 'Consumed battery', color: '#55d187' },
    { label: 'Combined from grid', color: '#6ea8fe' },
    { label: 'Returned to grid low tariff', color: '#a78bfa' },
    { label: 'Returned to grid high tariff', color: '#38c7c2' }
  ];

  return (
    <div className="content">
      <PageHeader title="Energy Dashboard" subtitle="Today's production, consumption and cost overview" />

      <nav className="energy-tabs">
        {TABS.map((t) => (
          <button
            key={t.id}
            type="button"
            className={`energy-tab${tab === t.id ? ' active' : ''}`}
            onClick={() => handleTabClick(t.id)}
          >
            {t.label}
          </button>
        ))}
      </nav>

      <section className="energy-page-content">
        {tab === 'summary' && (
          <div className="tab-panel active">
            <div className="status-bar">
              <div className="stat-card amber">
                <div className="stat-val">{s.solarProductionKWh} kWh</div>
                <div className="stat-label">Solar Production</div>
              </div>
              <div className="stat-card blue">
                <div className="stat-val">{s.gridConsumptionKWh} kWh</div>
                <div className="stat-label">Grid Consumption</div>
              </div>
              <div className="stat-card green">
                <div className="stat-val">{s.batteryKWh} kWh</div>
                <div className="stat-label">Battery</div>
              </div>
              <div className="stat-card purple">
                <div className="stat-val">{s.currency}{s.netCost.toFixed(2)}</div>
                <div className="stat-label">Net Cost Today</div>
              </div>
            </div>

            <div className="energy-grid-3col">
              <div className="card energy-diagram-card">
                <h3 className="card-title">Energy distribution</h3>
                <EnergyDistributionDiagram
                  values={{
                    solar: '3.66 kWh', gas: '0 m³', gridIn: '3.29 kWh', gridOut: '1.20 kWh',
                    home: '7.42 kWh', battIn: '0 kWh', battOut: '0 kWh', water: '0 L'
                  }}
                />
              </div>

              <div className="card energy-sources-card">
                <h3 className="card-title">Sources</h3>
                <SourcesTable sources={sources} />
              </div>

              <div className="card energy-chart-card">
                <h3 className="card-title">Power sources</h3>
                <Line
                  data={{
                    labels: monthLabels,
                    datasets: [
                      { label: 'Solar', data: powerSources.solar, borderColor: '#f4b942', backgroundColor: 'rgba(244,185,66,0.2)', fill: true, tension: 0.35, pointRadius: 0 },
                      { label: 'Grid', data: powerSources.grid, borderColor: '#6ea8fe', backgroundColor: 'rgba(110,168,254,0.15)', fill: true, tension: 0.35, pointRadius: 0 },
                      { label: 'Battery', data: powerSources.battery, borderColor: '#55d187', backgroundColor: 'rgba(85,209,135,0.15)', fill: true, tension: 0.35, pointRadius: 0 }
                    ]
                  }}
                  options={baseChartOptions(text3, border)}
                />
              </div>

              <div className="card energy-chart-card energy-chart-card--wide">
                <div className="chart-card-head">
                  <h3 className="card-title">Electricity usage</h3>
                  <span className="chart-card-total">+{electricityTotal.toLocaleString()} kWh</span>
                </div>
                <Bar data={electricityChartData} options={baseChartOptions(text3, border, true)} />
                <div className="chart-legend">
                  {electricityLegend.map((i) => (
                    <span className="chart-legend-item" key={i.label}>
                      <span className="chart-legend-dot" style={{ background: i.color }}></span>
                      {i.label}
                    </span>
                  ))}
                </div>
              </div>

              <div className="card energy-chart-card">
                <h3 className="card-title">Gas consumption</h3>
                <Bar
                  data={{ labels: monthLabels, datasets: [{ label: 'Gas', data: gasConsumptionMonthly, backgroundColor: '#f27676' }] }}
                  options={baseChartOptions(text3, border)}
                />
              </div>

              <div className="card energy-chart-card">
                <h3 className="card-title">Water consumption</h3>
                <Line
                  data={{ labels: monthLabels, datasets: [{ label: 'Water', data: waterConsumptionMonthly, borderColor: '#38c7c2', backgroundColor: 'rgba(56,199,194,0.15)', fill: true, tension: 0.35, pointRadius: 0 }] }}
                  options={baseChartOptions(text3, border)}
                />
              </div>
            </div>
          </div>
        )}

        {tab === 'electricity' && (
          <div className="tab-panel active">
            <div className="energy-two-col">
              <div className="energy-col-main">
                <div className="card energy-chart-card">
                  <div className="chart-card-head">
                    <h3 className="card-title">Electricity usage</h3>
                    <span className="chart-card-total">+{electricityTotal.toLocaleString()} kWh</span>
                  </div>
                  <Bar data={electricityChartData} options={baseChartOptions(text3, border, true)} />
                </div>

                <div className="card energy-chart-card">
                  <div className="chart-card-head">
                    <h3 className="card-title">Solar production</h3>
                    <span className="chart-card-total">{solarProdTotal.toLocaleString()} kWh</span>
                  </div>
                  <Bar
                    data={{ labels: monthLabels, datasets: [{ label: 'Solar', data: solarProductionMonthly, backgroundColor: '#f4b942', borderRadius: 3 }] }}
                    options={baseChartOptions(text3, border)}
                  />
                </div>

                <div className="card energy-chart-card">
                  <h3 className="card-title">Individual devices detail usage</h3>
                  <Bar
                    data={{
                      labels: monthLabels,
                      datasets: Object.entries(deviceMonthlyUsage).map(([name, data], i) => ({
                        label: name,
                        data,
                        backgroundColor: ['#6ea8fe', '#f4b942', '#f27676', '#55d187', '#a78bfa', '#38c7c2'][i % 6],
                        stack: 'devices'
                      }))
                    }}
                    options={baseChartOptions(text3, border, true)}
                  />
                  <div className="chart-legend">
                    {Object.keys(deviceMonthlyUsage).map((name, i) => (
                      <span className="chart-legend-item" key={name}>
                        <span className="chart-legend-dot" style={{ background: ['#6ea8fe', '#f4b942', '#f27676'][i % 3] }}></span>
                        {name}
                      </span>
                    ))}
                  </div>
                </div>

                <div className="card energy-chart-card">
                  <h3 className="card-title">Individual devices total usage</h3>
                  <Bar
                    data={{
                      labels: sortedDeviceTotals.map((d) => d.name),
                      datasets: [{ data: sortedDeviceTotals.map((d) => d.kwh), backgroundColor: '#6ea8fe', borderRadius: 3 }]
                    }}
                    options={{
                      indexAxis: 'y',
                      responsive: true,
                      maintainAspectRatio: false,
                      plugins: { legend: { display: false } },
                      scales: {
                        x: { grid: { color: border }, ticks: { color: text3, font: { size: 10 } }, max: deviceTotalMax * 1.15 },
                        y: { grid: { display: false }, ticks: { color: text3, font: { size: 11 } } }
                      }
                    }}
                  />
                </div>

                <div className="card">
                  <h3 className="card-title">Current power flow</h3>
                  <EnergyFlowSankey
                    battery={energySummary.batteryKWh}
                    gridImport={energySummary.gridConsumptionKWh * 0.6}
                    solar={energySummary.solarProductionKWh}
                    solarExport={energySummary.gridReturnedKWh}
                    deviceTotals={deviceTotalUsage}
                    unit="kWh"
                  />
                </div>
              </div>

              <div className="energy-col-side">
                <div className="card">
                  <h3 className="card-title">Energy distribution</h3>
                  <EnergyDistributionDiagram
                    mini
                    values={{
                      solar: '3.35 MWh', gas: '0 m³', gridIn: '3.48 MWh', gridOut: '4.83 MWh',
                      home: '4.7 MWh', battIn: '0 MWh', battOut: '0 MWh', water: '0 L'
                    }}
                  />
                </div>

                <GridBalanceBar {...gridBalance} />

                <div className="gauge-row">
                  <GaugeDonut
                    label="Net imported from the grid"
                    value={<>{gauges.netImportedKWh.toLocaleString()}<br />kWh</>}
                    segments={[{ value: 70, color: '#a78bfa' }, { value: 30, color: '#6ea8fe' }]}
                  />
                  <GaugeDonut
                    label="Self-consumed solar energy"
                    value={`${gauges.selfConsumedSolarPercent}%`}
                    segments={[{ value: gauges.selfConsumedSolarPercent, color: '#f4b942' }, { value: 100 - gauges.selfConsumedSolarPercent, color: 'var(--surface-3)' }]}
                  />
                </div>

                <GaugeDonut
                  label="Self-sufficiency"
                  value={`${gauges.selfSufficiencyPercent}%`}
                  segments={[{ value: Math.max(gauges.selfSufficiencyPercent, 1), color: '#55d187' }, { value: 100 - Math.max(gauges.selfSufficiencyPercent, 1), color: 'var(--surface-3)' }]}
                />

                <div className="card">
                  <h3 className="card-title">Sources</h3>
                  <SourcesTable sources={detailedSources} detailed />
                </div>
              </div>
            </div>
          </div>
        )}

        {tab === 'gas' && (
          <div className="tab-panel active">
            <div className="energy-two-col">
              <div className="energy-col-main">
                <div className="card energy-chart-card energy-chart-card--tall">
                  <h3 className="card-title">Gas consumption</h3>
                  <Bar
                    data={{ labels: monthLabels, datasets: [{ label: 'Gas', data: gasConsumptionMonthly, backgroundColor: '#f27676', borderRadius: 3 }] }}
                    options={baseChartOptions(text3, border)}
                  />
                </div>
              </div>

              <div className="energy-col-side">
                <div className="card">
                  <h3 className="card-title">Totals</h3>
                  <SourcesTable
                    showHeader
                    sources={[{ name: 'Gas total', color: '#f27676', usage: `${gasTotal} m³`, cost: null }]}
                  />
                </div>
              </div>
            </div>

            <EnergyPeriodBar />
          </div>
        )}

        {tab === 'water' && (
          <div className="tab-panel active">
            <div className="energy-two-col">
              <div className="energy-col-main">
                <div className="card energy-chart-card energy-chart-card--tall">
                  <h3 className="card-title">Water consumption</h3>
                  <Bar
                    data={{ labels: monthLabels, datasets: [{ label: 'Water', data: waterConsumptionMonthly, backgroundColor: '#38c7c2', borderRadius: 3 }] }}
                    options={baseChartOptions(text3, border)}
                  />
                </div>
              </div>

              <div className="energy-col-side">
                <div className="card">
                  <h3 className="card-title">Totals</h3>
                  <SourcesTable
                    showHeader
                    sources={[{ name: 'Water total', color: '#38c7c2', usage: `${waterTotal} L`, cost: null }]}
                  />
                </div>
              </div>
            </div>

            <EnergyPeriodBar />
          </div>
        )}

        {tab === 'now' && <EnergyNowPanel />}
        {tab === 'forecast' && <ForecastPanel />}
      </section>
    </div>
  );
}
