import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { api } from '../api.js';

export default function Dashboard() {
  const [activeSeason, setActiveSeason] = useState(undefined); // undefined = loading, null = none
  const [playerCount, setPlayerCount] = useState(0);
  const [games, setGames] = useState(null);

  useEffect(() => {
    (async () => {
      const [seasons, players] = await Promise.all([
        api.get('/api/seasons'),
        api.get('/api/players?active=1'),
      ]);
      const active = seasons.find((s) => s.is_active) || seasons[0] || null;
      setActiveSeason(active);
      setPlayerCount(players.length);
      if (active) {
        setGames(await api.get(`/api/games?season_id=${active.id}`));
      } else {
        setGames([]);
      }
    })();
  }, []);

  return (
    <>
      <h1>Soccer Planner</h1>

      <section className="card">
        <h2>{activeSeason === undefined ? 'Season' : activeSeason ? activeSeason.name : 'No season yet'}</h2>
        <p>
          {activeSeason === undefined
            ? 'Loading…'
            : activeSeason
              ? `${playerCount} active player${playerCount === 1 ? '' : 's'} on the roster.`
              : 'Create a season from the Settings page to get started.'}
        </p>
      </section>

      <section className="card">
        <h2>Quick Links</h2>
        <p><Link to="/roster">Manage roster</Link> &middot; add players and set position eligibility.</p>
        <p><Link to="/settings">Manage positions &amp; formations</Link> &middot; configure how the team lines up.</p>
        <p><Link to="/games">Schedule a game</Link> &middot; set attendance and generate a fair lineup plan.</p>
        <p><Link to="/stats">View stats</Link> &middot; playtime %, position variety, and pairings.</p>
      </section>

      <section className="card">
        <h2>Upcoming &amp; Recent Games</h2>
        <table>
          <thead><tr><th>Date</th><th>Opponent</th><th>Formation</th><th></th></tr></thead>
          <tbody>
            {games === null && (
              <tr><td colSpan={4}><em>Loading&hellip;</em></td></tr>
            )}
            {games !== null && games.length === 0 && (
              <tr><td colSpan={4}><em>{activeSeason ? 'No games scheduled yet.' : 'No games yet.'}</em></td></tr>
            )}
            {games !== null && games.slice(0, 8).map((g) => (
              <tr key={g.id}>
                <td>{g.date}</td>
                <td>{g.opponent ?? ''}</td>
                <td>{g.formation_name}</td>
                <td><Link to={`/games/${g.id}`} className="btn">Open</Link></td>
              </tr>
            ))}
          </tbody>
        </table>
      </section>
    </>
  );
}
