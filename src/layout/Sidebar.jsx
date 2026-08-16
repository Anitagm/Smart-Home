import { NavLink } from 'react-router-dom';

const navItemClass = ({ isActive }) => `nav-item${isActive ? ' active' : ''}`;

export default function Sidebar({ isOpen, profile, notificationCount = 0, onNotificationsClick }) {
  return (
    <aside className={`sidebar${isOpen ? ' is-open' : ''}`}>
      <div className="sidebar-logo">
        <div className="logo-icon">
          <svg viewBox="0 0 24 24">
            <path d="M3 9l9-7 9 7v11a2 2 0 01-2 2H5a2 2 0 01-2-2z"></path>
            <polyline points="9 22 9 12 15 12 15 22"></polyline>
          </svg>
        </div>
        <div>
          <div className="logo-text">Ferdowsi</div>
          <div className="logo-sub">Smart Home</div>
        </div>
      </div>

      <nav className="nav">
        <div className="nav-section">
          <div className="nav-label">Overview</div>

          <NavLink to="/" end className={navItemClass}>
            <svg className="nav-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8">
              <rect x="3" y="3" width="7" height="7"></rect>
              <rect x="14" y="3" width="7" height="7"></rect>
              <rect x="14" y="14" width="7" height="7"></rect>
              <rect x="3" y="14" width="7" height="7"></rect>
            </svg>
            Dashboard
          </NavLink>

          <NavLink to="/energy" className={navItemClass}>
            <svg className="nav-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8">
              <polyline points="22 12 18 12 15 21 9 3 6 12 2 12"></polyline>
            </svg>
            Energy
          </NavLink>

          <NavLink to="/map" className={navItemClass}>
            <svg className="nav-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8">
              <path d="M3 6l6-2 6 2 6-2v14l-6 2-6-2-6 2V6z"></path>
              <path d="M9 4v14"></path>
              <path d="M15 6v14"></path>
            </svg>
            Map
          </NavLink>

          <NavLink to="/ai-manager" className={navItemClass}>
            <svg className="nav-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8">
              <rect x="3" y="11" width="18" height="10" rx="2"></rect>
              <circle cx="12" cy="5" r="2"></circle>
              <path d="M12 7v4"></path>
              <line x1="8" y1="16" x2="8" y2="16"></line>
              <line x1="16" y1="16" x2="16" y2="16"></line>
            </svg>
            AI Manager 🤖
          </NavLink>

          <NavLink to="/automations" className={navItemClass}>
            <svg className="nav-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8">
              <circle cx="12" cy="12" r="3"></circle>
              <path d="M19.4 15a1.65 1.65 0 00.33 1.82l.06.06a2 2 0 11-2.83 2.83l-.06-.06a1.65 1.65 0 00-1.82-.33 1.65 1.65 0 00-1 1.51V21a2 2 0 01-4 0v-.09A1.65 1.65 0 009 19.4a1.65 1.65 0 00-1.82.33l-.06.06a2 2 0 11-2.83-2.83l.06-.06A1.65 1.65 0 004.6 15a1.65 1.65 0 00-1.51-1H3a2 2 0 010-4h.09A1.65 1.65 0 004.6 9a1.65 1.65 0 00-.33-1.82l-.06-.06a2 2 0 112.83-2.83l.06.06A1.65 1.65 0 009 4.6a1.65 1.65 0 001-1.51V3a2 2 0 014 0v.09A1.65 1.65 0 0015.4 4.6a1.65 1.65 0 001.82-.33l.06-.06a2 2 0 112.83 2.83l-.06.06A1.65 1.65 0 0019.4 9a1.65 1.65 0 001.51 1H21a2 2 0 010 4h-.09a1.65 1.65 0 00-1.51 1z"></path>
            </svg>
            Automations
          </NavLink>
        </div>

        <div className="nav-section">
          <div className="nav-label">System</div>

          <NavLink to="/settings" className={navItemClass}>
            <svg className="nav-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8">
              <circle cx="12" cy="12" r="3"></circle>
              <path d="M19.07 4.93a10 10 0 010 14.14M4.93 4.93a10 10 0 000 14.14"></path>
            </svg>
            Settings
          </NavLink>

          <button type="button" className="nav-item" onClick={onNotificationsClick}>
            <svg className="nav-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8">
              <path d="M18 8A6 6 0 006 8c0 7-3 9-3 9h18s-3-2-3-9"></path>
              <path d="M13.73 21a2 2 0 01-3.46 0"></path>
            </svg>
            Notifications
            {notificationCount > 0 && <span className="nav-badge">{notificationCount}</span>}
          </button>
        </div>
      </nav>

      <div className="sidebar-bottom">
        <NavLink to="/profile" className="user-row">
          <div className="user-avatar">{profile.initials}</div>
          <div>
            <div className="user-name">{profile.name}</div>
            <div className="user-status">● {profile.status === 'home' ? 'Home' : 'Away'}</div>
          </div>
        </NavLink>
      </div>
    </aside>
  );
}
