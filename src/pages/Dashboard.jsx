import { useState } from 'react';
import Topbar from '../components/Topbar.jsx';
import SecurityCard from '../components/SecurityCard.jsx';
import PresenceCard from '../components/PresenceCard.jsx';
import NetworkCard from '../components/NetworkCard.jsx';
import EnergyDistributionDiagram from '../components/EnergyDistributionDiagram.jsx';
import RoomsGrid from '../components/RoomsGrid.jsx';
import DevicesGrid from '../components/DevicesGrid.jsx';
import ManageDevicesModal from '../components/ManageDevicesModal.jsx';
import HistoryModal from '../components/HistoryModal.jsx';
import ActivityLogModal from '../components/ActivityLogModal.jsx';
import FloorPlanInteractive from '../components/FloorPlanInteractive.jsx';
import ThermostatCard from '../components/ThermostatCard.jsx';
import AIInsightsPanel from '../components/AIInsightsPanel.jsx';
import AISecurityAssistant from '../components/AISecurityAssistant.jsx';
import AIChatWidget from '../components/AIChatWidget.jsx';
import { useManagedDevices } from '../hooks/useManagedDevices.js';
import { useRoomDevices } from '../hooks/useRoomDevices.js';
import { useSecurityState } from '../hooks/useSecurityState.js';
import { useToast } from '../hooks/useToast.jsx';
import { useNotifications } from '../hooks/useNotifications.jsx';
import { activities, historyData } from '../data/dashboard-data.js';

export default function Dashboard() {
  const { devices, toggleDevice, setDim, addDevice, deleteDevice, applyChanges } = useManagedDevices();
  const { rooms, toggleRoomDevice } = useRoomDevices();
  const { securityState, setStatus } = useSecurityState();
  const showToast = useToast();
  const { addNotification, notifications } = useNotifications();
  const [activeRoom, setActiveRoom] = useState(null);
  const [manageOpen, setManageOpen] = useState(false);
  const [logOpen, setLogOpen] = useState(false);
  const [historyModalData, setHistoryModalData] = useState(null);

  function selectRoom(name) {
    setActiveRoom(name);
    showToast(`Viewing: ${name}`, 'Room', 'info');
  }

  function handleToggleDevice(idx) {
    const d = devices[idx];
    toggleDevice(idx);
    showToast(`${d.name} turned ${d.state === 'on' ? 'off' : 'on'}`, 'Device', d.state === 'on' ? 'info' : 'success');
  }

  function handleToggleRoomDevice(roomName, deviceLabel) {
    const room = rooms.find((r) => r.name === roomName);
    const device = room?.devices.find((d) => d.label === deviceLabel);
    const turningOn = !device?.on;
    toggleRoomDevice(roomName, deviceLabel);
    showToast(`${roomName} ${deviceLabel} turned ${turningOn ? 'on' : 'off'}`, 'Device', turningOn ? 'success' : 'info');
    addNotification('Device', `${roomName}: ${deviceLabel} turned ${turningOn ? 'on' : 'off'}`);
  }

  const onlineCount = devices.filter((d) => d.state === 'on').length;

  return (
    <>
      <Topbar />

      <div className="content">
        <div className="status-bar fade-up">
          <div className="stat-card blue">
            <div className="stat-icon blue">
              <svg viewBox="0 0 24 24"><path d="M13 2L3 14h9l-1 8 10-12h-9l1-8z"></path></svg>
            </div>
            <div className="stat-val">3.2<span style={{ fontSize: 14 }}> kW</span></div>
            <div className="stat-label">Current Usage</div>
            <div className="stat-trend down">↓ 12% vs yesterday</div>
          </div>

          <div className="stat-card green">
            <div className="stat-icon green">
              <svg viewBox="0 0 24 24"><circle cx="12" cy="12" r="10"></circle><polyline points="12 6 12 12 16 14"></polyline></svg>
            </div>
            <div className="stat-val">{onlineCount}</div>
            <div className="stat-label">Devices Online</div>
            <div className="stat-trend up">↑ All systems normal</div>
          </div>

          <div className="stat-card amber">
            <div className="stat-icon amber">
              <svg viewBox="0 0 24 24"><path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"></path></svg>
            </div>
            <div className="stat-val">Armed</div>
            <div className="stat-label">Security</div>
            <div className="stat-trend neutral">⊙ Away mode active</div>
          </div>

          <div className="stat-card purple">
            <div className="stat-icon purple">
              <svg viewBox="0 0 24 24"><path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0118 0z"></path><circle cx="12" cy="10" r="3"></circle></svg>
            </div>
            <div className="stat-val">Home</div>
            <div className="stat-label">Presence</div>
            <div className="stat-trend up">↑ 2 people detected</div>
          </div>
        </div>

        <div style={{ marginTop: 20 }}>
          <AIInsightsPanel devices={devices} notifications={notifications} />
        </div>

        <div className="dashboard-panels fade-up delay-1" style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(320px, 1fr))', gap: 20, marginTop: 20 }}>
          <SecurityCard securityState={securityState} setStatus={setStatus} />
          <ThermostatCard name="Upstairs" currentTemp={22} />
        </div>

        <div className="dashboard-panels fade-up delay-1" style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(320px, 1fr))', gap: 20, marginTop: 20 }}>
          <AISecurityAssistant
            onArmAway={() => setStatus('armed-away', 'Armed Away')}
            onLockFrontDoor={() => applyChanges([{ name: 'Front Lock', state: 'on' }])}
          />
        </div>

        <div className="dashboard-panels fade-up delay-1" style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(320px, 1fr))', gap: 20, marginTop: 20 }}>
          <div className="card">
            <h3 className="card-title">Presence Detection</h3>
            <PresenceCard />
          </div>

          <div className="card">
            <h3 className="card-title">Network & Infrastructure</h3>
            <NetworkCard />
          </div>
        </div>

        <div className="dashboard-panels fade-up delay-1" style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(350px, 1fr))', gap: 20, marginTop: 20 }}>
          <div className="card">
            <h3 className="card-title">Entertainment</h3>
            <div className="card-row">
              <div className="row-icon">○</div>
              <div className="row-label">Harmony</div>
              <div className="row-value">YouTube</div>
            </div>
            <div className="card-row">
              <div className="row-icon">📡</div>
              <div className="row-content" style={{ flex: 1 }}>
                <div className="row-label-sm">Activity</div>
                <select className="row-select"><option>YouTube</option></select>
              </div>
            </div>
            <div className="card-row">
              <div className="row-icon">📺</div>
              <div className="row-content" style={{ flex: 1 }}>
                <div className="row-label-sm">HDMI switcher</div>
                <select className="row-select"><option>Shield</option></select>
              </div>
            </div>
            <div className="card-row">
              <div className="row-icon">🔊</div>
              <div className="row-label">Volume</div>
              <div className="row-value-box">18</div>
            </div>
            <div className="card-row">
              <div className="row-icon">📄</div>
              <div className="row-label">Turn television off</div>
              <div className="row-action">Run</div>
            </div>
          </div>

          <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
            <div className="card">
              <h3 className="card-title">Information</h3>

              <div
                className="card-row interactive-row"
                role="button"
                tabIndex={0}
                onClick={() => setHistoryModalData(historyData['morning-commute'])}
              >
                <div className="row-icon">🚗</div>
                <div className="row-label">Morning commute</div>
                <div className="row-value">37</div>
              </div>

              <div
                className="card-row interactive-row"
                role="button"
                tabIndex={0}
                onClick={() => setHistoryModalData(historyData['commute-home'])}
              >
                <div className="row-icon">🚗</div>
                <div className="row-label">Commute to home</div>
                <div className="row-value">41</div>
              </div>

              <div className="card-row">
                <div className="row-icon">$</div>
                <div className="row-label">USDINR</div>
                <div className="row-value">71.25</div>
              </div>
            </div>

            <div className="card">
              <h3 className="card-title">Doorbell</h3>
              <div className="card-row">
                <div className="row-icon">🏠</div>
                <div className="row-label">Front Door Ding</div>
                <div className="row-value">Clear</div>
              </div>
              <div className="card-row">
                <div className="row-icon">🚶</div>
                <div className="row-label">Front Door Motion</div>
                <div className="row-value">Clear</div>
              </div>
              <div className="card-row">
                <div className="row-icon">🕒</div>
                <div className="row-label">Last Motion</div>
                <div className="row-value">13:21</div>
              </div>
            </div>
          </div>
        </div>

        <div className="energy-distro-card fade-up delay-1" style={{ marginTop: 20 }}>
          <div className="distro-header">
            <span className="distro-title">⚡ Energy distribution today</span>
            <span className="distro-date">Mon, 23 May</span>
          </div>

          <div className="distro-stats">
            <div className="distro-item">
              <div className="distro-icon">☀️</div>
              <div className="distro-name">Solar</div>
              <div className="distro-value">10.6 <span className="unit">kWh</span></div>
            </div>
            <div className="distro-item">
              <div className="distro-icon">🔥</div>
              <div className="distro-name">Gas</div>
              <div className="distro-value">0 <span className="unit">m³</span></div>
            </div>
            <div className="distro-item">
              <div className="distro-icon">💧</div>
              <div className="distro-name">Water</div>
              <div className="distro-value">13.2 <span className="unit">kWh</span></div>
            </div>
            <div className="distro-item">
              <div className="distro-icon">🔋</div>
              <div className="distro-name">Battery</div>
              <div className="distro-value" style={{ color: 'var(--green)' }}>&lt; 2.54 <span className="unit">kWh</span></div>
            </div>
            <div className="distro-item">
              <div className="distro-icon">⚡</div>
              <div className="distro-name">Grid</div>
              <div className="distro-value" style={{ color: 'var(--amber)' }}>&gt; 5.08 <span className="unit">kWh</span></div>
            </div>
          </div>

          <div className="distro-footer">
            <div className="family-room"><span className="room-icon">🛋️</span> Family room <span className="consumption">— 3.2 kWh</span></div>
            <div className="music-note">🎵 I Wasn't Born To Follow</div>
          </div>

          <div className="distro-flow">
            <div className="flow-bar">
              <div className="flow-segment solar" style={{ width: '48%' }}></div>
              <div className="flow-segment grid" style={{ width: '32%' }}></div>
              <div className="flow-segment battery" style={{ width: '20%' }}></div>
            </div>
            <div className="flow-labels">
              <span>🔆 Solar 48%</span>
              <span>⚡ Grid 32%</span>
              <span>🔋 Battery 20%</span>
            </div>
          </div>
        </div>

        <div className="energy-floorplan-grid" style={{ marginTop: 20 }}>
          <div className="ed-card fade-up delay-1">
            <div className="ed-title">⚡ Energy distribution</div>
            <EnergyDistributionDiagram
              values={{
                solar: '3.66 MWh',
                gas: '0 m³',
                gridIn: '3.29 MWh',
                gridOut: '7.05 MWh',
                home: '7.42 MWh',
                battIn: '0 MWh',
                battOut: '0 MWh',
                water: '0 L'
              }}
            />
          </div>

          <div className="floorplan-card fade-up delay-2">
            <FloorPlanInteractive />
          </div>
        </div>

        <div style={{ marginTop: 20 }}>
          <div className="section-header">
            <div className="section-title">Rooms</div>
            <button type="button" className="section-action" onClick={() => setManageOpen(true)}>View all →</button>
          </div>
          <RoomsGrid rooms={rooms} activeRoom={activeRoom} onSelectRoom={selectRoom} onToggleDevice={handleToggleRoomDevice} />
        </div>

        <div style={{ marginTop: 20 }}>
          <div className="section-header">
            <div className="section-title">Recent Activity</div>
            <button type="button" className="section-action" onClick={() => setLogOpen(true)}>View log →</button>
          </div>
          <div className="activity-card fade-up delay-4">
            <div className="activity-list">
              {activities.map((a, i) => (
                <div className="activity-item" key={i}>
                  <div className="activity-avi" style={{ background: a.color }}>
                    <span>{a.icon}</span>
                  </div>
                  <div className="activity-text">
                    <div className="activity-title">{a.title}</div>
                    <div className="activity-sub">{a.sub}</div>
                  </div>
                  <div className="activity-time">{a.time}</div>
                </div>
              ))}
            </div>
          </div>
        </div>

        <div className="devices-section fade-up delay-5" style={{ marginTop: 20 }}>
          <div className="section-header">
            <div className="section-title">All Devices</div>
            <button
              className="section-action manage-link"
              type="button"
              aria-haspopup="dialog"
              onClick={() => setManageOpen(true)}
            >
              Manage <span aria-hidden="true">→</span>
            </button>
          </div>
          <DevicesGrid devices={devices} onToggle={handleToggleDevice} onDim={setDim} />
        </div>
      </div>

      <AIChatWidget
        devices={devices}
        toggleDevice={toggleDevice}
        rooms={rooms}
        toggleRoomDevice={toggleRoomDevice}
        securityState={securityState}
        setStatus={setStatus}
      />

      <ManageDevicesModal
        open={manageOpen}
        onClose={() => setManageOpen(false)}
        devices={devices}
        onDelete={deleteDevice}
        onAdd={addDevice}
      />

      <ActivityLogModal open={logOpen} onClose={() => setLogOpen(false)} activities={activities} />

      {historyModalData && (
        <HistoryModal data={historyModalData} onClose={() => setHistoryModalData(null)} />
      )}
    </>
  );
}
