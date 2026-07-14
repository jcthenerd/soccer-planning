import { Routes, Route, Link, useLocation } from 'react-router-dom';
import Dashboard from './pages/Dashboard.jsx';
import Roster from './pages/Roster.jsx';
import Settings from './pages/Settings.jsx';
import GamesList from './pages/GamesList.jsx';
import GameDetail from './pages/GameDetail.jsx';
import Stats from './pages/Stats.jsx';

const NAV_ITEMS = [
  { to: '/', label: 'Dashboard' },
  { to: '/roster', label: 'Roster' },
  { to: '/settings', label: 'Settings' },
  { to: '/games', label: 'Games' },
  { to: '/stats', label: 'Stats' },
];

function isActive(pathname, to) {
  if (to === '/') return pathname === '/';
  return pathname === to || pathname.startsWith(`${to}/`);
}

export default function App() {
  const { pathname } = useLocation();

  return (
    <div className="page">
      <nav className="topnav">
        <Link to="/" className="brand">⚽ Soccer Planner</Link>
        <div className="topnav-links">
          {NAV_ITEMS.map((item) => (
            <Link key={item.to} to={item.to} className={isActive(pathname, item.to) ? 'active' : ''}>
              {item.label}
            </Link>
          ))}
        </div>
      </nav>
      <Routes>
        <Route path="/" element={<Dashboard />} />
        <Route path="/roster" element={<Roster />} />
        <Route path="/settings" element={<Settings />} />
        <Route path="/games" element={<GamesList />} />
        <Route path="/games/:id" element={<GameDetail />} />
        <Route path="/stats" element={<Stats />} />
      </Routes>
    </div>
  );
}
