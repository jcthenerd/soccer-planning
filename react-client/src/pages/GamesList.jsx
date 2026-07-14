import { useEffect, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { api } from '../api.js';

export default function GamesList() {
  const navigate = useNavigate();
  const [seasons, setSeasons] = useState([]);
  const [formations, setFormations] = useState([]);
  const [seasonId, setSeasonId] = useState(null);
  const [games, setGames] = useState([]);
  const [form, setForm] = useState({ date: '', opponent: '', formation_id: '', num_quarters: 4, notes: '' });
  const [error, setError] = useState(null);

  useEffect(() => {
    (async () => {
      const [seasonRows, formationRows] = await Promise.all([
        api.get('/api/seasons'),
        api.get('/api/formations'),
      ]);
      setSeasons(seasonRows);
      setFormations(formationRows);
      const active = seasonRows.find((s) => s.is_active) || seasonRows[0];
      if (active) setSeasonId(active.id);
      if (formationRows[0]) setForm((f) => ({ ...f, formation_id: formationRows[0].id }));
    })();
  }, []);

  useEffect(() => {
    if (seasonId === null) return;
    loadGames();
  }, [seasonId]);

  async function loadGames() {
    const url = seasonId ? `/api/games?season_id=${seasonId}` : '/api/games';
    setGames(await api.get(url));
  }

  async function handleCreate(e) {
    e.preventDefault();
    setError(null);
    if (!seasonId || !form.date || !form.formation_id) return;
    try {
      const game = await api.post('/api/games', {
        season_id: seasonId,
        date: form.date,
        opponent: form.opponent,
        formation_id: Number(form.formation_id),
        num_quarters: Number(form.num_quarters) || 4,
        notes: form.notes,
      });
      navigate(`/games/${game.id}`);
    } catch (err) {
      setError(err.message);
    }
  }

  async function handleDelete(game) {
    if (!confirm(`Delete the game vs ${game.opponent || 'TBD'} on ${game.date}? This cannot be undone.`)) return;
    try {
      await api.del(`/api/games/${game.id}`);
      await loadGames();
    } catch (err) {
      alert(err.message);
    }
  }

  return (
    <>
      <h1>Games</h1>

      <section className="card">
        <h2>Schedule a Game</h2>
        <form onSubmit={handleCreate}>
          <label>
            Season
            <select value={seasonId ?? ''} onChange={(e) => setSeasonId(Number(e.target.value))} required>
              {seasons.map((s) => (
                <option key={s.id} value={s.id}>
                  {s.name}{s.is_active ? ' (active)' : ''}
                </option>
              ))}
            </select>
          </label>
          <label>
            Date
            <input type="date" required value={form.date} onChange={(e) => setForm({ ...form, date: e.target.value })} />
          </label>
          <label>
            Opponent
            <input type="text" value={form.opponent} onChange={(e) => setForm({ ...form, opponent: e.target.value })} />
          </label>
          <label>
            Formation
            <select
              value={form.formation_id}
              onChange={(e) => setForm({ ...form, formation_id: e.target.value })}
              required
            >
              {formations.map((f) => (
                <option key={f.id} value={f.id}>{f.name}</option>
              ))}
            </select>
          </label>
          <label>
            Number of quarters
            <input
              type="number"
              min="1"
              style={{ maxWidth: 100 }}
              value={form.num_quarters}
              onChange={(e) => setForm({ ...form, num_quarters: e.target.value })}
            />
          </label>
          <label>
            Notes
            <input type="text" value={form.notes} onChange={(e) => setForm({ ...form, notes: e.target.value })} />
          </label>
          {error && <p style={{ color: 'var(--danger)' }}>{error}</p>}
          <button type="submit">Create Game</button>
        </form>
      </section>

      <section className="card">
        <h2>Upcoming &amp; Past Games</h2>
        <table>
          <thead>
            <tr><th>Date</th><th>Opponent</th><th>Formation</th><th>Quarters</th><th></th></tr>
          </thead>
          <tbody>
            {games.map((game) => (
              <tr key={game.id}>
                <td>{game.date}</td>
                <td>{game.opponent ?? ''}</td>
                <td>{game.formation_name}</td>
                <td>{game.num_quarters}</td>
                <td>
                  <Link to={`/games/${game.id}`} className="btn">Open</Link>{' '}
                  <button type="button" data-action="delete" onClick={() => handleDelete(game)}>Delete</button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </section>
    </>
  );
}
