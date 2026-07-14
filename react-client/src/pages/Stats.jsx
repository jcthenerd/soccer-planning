import { useEffect, useState } from 'react';
import { api } from '../api.js';

const CATEGORICAL = ['var(--series-1)', 'var(--series-2)', 'var(--series-3)', 'var(--series-4)',
  'var(--series-5)', 'var(--series-6)', 'var(--series-7)', 'var(--series-8)'];

// Mirrors the --seq-* custom properties in css/styles.css; duplicated as hex
// here so we can compute per-cell text contrast (white vs ink) from the
// actual luminance, not just reference the variable for background-color.
const SEQ_STEPS = ['#cde2fb', '#b7d3f6', '#9ec5f4', '#86b6ef', '#6da7ec', '#5598e7',
  '#3987e5', '#2a78d6', '#256abf', '#1c5cab', '#184f95', '#104281', '#0d366b'];

function sequentialStep(rate) {
  const idx = Math.round(rate * (SEQ_STEPS.length - 1));
  return SEQ_STEPS[idx];
}

function textColorFor(hex) {
  const r = parseInt(hex.slice(1, 3), 16);
  const g = parseInt(hex.slice(3, 5), 16);
  const b = parseInt(hex.slice(5, 7), 16);
  const luminance = (0.299 * r + 0.587 * g + 0.114 * b) / 255;
  return luminance > 0.55 ? '#0b0b0b' : '#ffffff';
}

function initials(name) {
  return name.split(/\s+/).map((part) => part[0]).join('').slice(0, 3).toUpperCase();
}

function Playtime({ seasonId }) {
  const [data, setData] = useState(null);

  useEffect(() => {
    setData(null);
    api.get(`/api/stats/playtime?season_id=${seasonId}`).then(setData);
  }, [seasonId]);

  if (data === null) return <p><em>Loading&hellip;</em></p>;
  if (!data.length) return <p><em>No saved games yet this season.</em></p>;

  return (
    <div>
      {data.map((row) => {
        const pct = row.playtime_pct == null ? 0 : row.playtime_pct;
        const label = row.playtime_pct == null ? '—' : `${Math.round(pct * 100)}%`;
        return (
          <div className="stat-row" key={row.player_id ?? row.name}>
            <div className="stat-label" title={row.name}>{row.name}</div>
            <div className="stat-track"><div className="stat-fill" style={{ width: `${Math.round(pct * 100)}%` }} /></div>
            <div className="stat-value">
              {label} <span style={{ color: 'var(--text-muted)' }}>({row.played_quarters}/{row.available_quarters})</span>
            </div>
          </div>
        );
      })}
    </div>
  );
}

function Positions({ seasonId }) {
  const [data, setData] = useState(null);
  const [positions, setPositions] = useState([]);

  useEffect(() => { api.get('/api/positions').then(setPositions); }, []);
  useEffect(() => {
    setData(null);
    api.get(`/api/stats/positions?season_id=${seasonId}`).then(setData);
  }, [seasonId]);

  return (
    <>
      <div className="position-legend">
        {positions.map((pos, i) => (
          <span key={pos.id}>
            <span className="swatch" style={{ background: CATEGORICAL[i % CATEGORICAL.length] }} />
            {pos.name}
          </span>
        ))}
      </div>
      {data === null ? (
        <p><em>Loading&hellip;</em></p>
      ) : !data.length ? (
        <p><em>No saved games yet this season.</em></p>
      ) : (
        <div>
          {data.map((row) => {
            const total = row.played_quarters || 0;
            return (
              <div className="stack-row" key={row.player_id ?? row.name}>
                <div className="stat-label" title={row.name}>{row.name}</div>
                <div className="stack-track">
                  {total === 0 ? (
                    <div className="stack-segment" style={{ width: '100%', background: 'var(--gridline)' }} />
                  ) : row.position_counts.map((pc, i) => pc.count === 0 ? null : (
                    <div
                      key={pc.position_name}
                      className="stack-segment"
                      title={`${row.name}: ${pc.position_name} × ${pc.count}`}
                      style={{ width: `${(pc.count / total) * 100}%`, background: CATEGORICAL[i % CATEGORICAL.length] }}
                    />
                  ))}
                </div>
                <div className="stat-value">{total} quarter{total === 1 ? '' : 's'} played</div>
              </div>
            );
          })}
        </div>
      )}
    </>
  );
}

function Pairings({ seasonId }) {
  const [result, setResult] = useState(null);

  useEffect(() => {
    setResult(null);
    api.get(`/api/stats/pairings?season_id=${seasonId}`).then(setResult);
  }, [seasonId]);

  if (result === null) return <p><em>Loading&hellip;</em></p>;
  const { players, pairs } = result;
  if (players.length < 2) return <p><em>Need at least two players with season history to show pairings.</em></p>;

  const rateByPair = new Map();
  for (const p of pairs) rateByPair.set(`${p.player_id_a}:${p.player_id_b}`, p);

  return (
    <div className="pairing-table-wrap">
      <table className="pairing-table">
        <thead>
          <tr>
            <th></th>
            {players.map((p) => <th key={p.id}>{initials(p.name)}</th>)}
          </tr>
        </thead>
        <tbody>
          {players.map((rowPlayer) => (
            <tr key={rowPlayer.id}>
              <th className="row-label">{rowPlayer.name}</th>
              {players.map((colPlayer) => {
                if (rowPlayer.id === colPlayer.id) {
                  return <td className="diagonal" key={colPlayer.id}>—</td>;
                }
                const key = rowPlayer.id < colPlayer.id
                  ? `${rowPlayer.id}:${colPlayer.id}`
                  : `${colPlayer.id}:${rowPlayer.id}`;
                const pair = rateByPair.get(key);
                if (!pair || pair.pairing_rate == null) {
                  return <td className="empty" key={colPlayer.id}>—</td>;
                }
                const hex = sequentialStep(pair.pairing_rate);
                const pct = Math.round(pair.pairing_rate * 100);
                return (
                  <td
                    key={colPlayer.id}
                    style={{ background: hex, color: textColorFor(hex) }}
                    title={`${rowPlayer.name} & ${colPlayer.name}: ${pair.paired_quarters} of ${pair.co_available_quarters} shared quarters`}
                  >
                    {pct}%
                  </td>
                );
              })}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

export default function Stats() {
  const [seasons, setSeasons] = useState([]);
  const [seasonId, setSeasonId] = useState(null);

  useEffect(() => {
    (async () => {
      const rows = await api.get('/api/seasons');
      setSeasons(rows);
      const active = rows.find((s) => s.is_active) || rows[0];
      if (active) setSeasonId(active.id);
    })();
  }, []);

  return (
    <>
      <h1>Stats</h1>

      <label style={{ maxWidth: 320, display: 'block', marginBottom: 20 }}>
        Season
        <select value={seasonId ?? ''} onChange={(e) => setSeasonId(Number(e.target.value))}>
          {seasons.map((s) => (
            <option key={s.id} value={s.id}>{s.name}{s.is_active ? ' (active)' : ''}</option>
          ))}
        </select>
      </label>

      {seasonId && (
        <>
          <section className="card">
            <h2>Playtime</h2>
            <p>Share of available quarters each player has actually played this season.</p>
            <Playtime seasonId={seasonId} />
          </section>

          <section className="card">
            <h2>Position Variety</h2>
            <p>Mix of positions each player has played, as a share of their own played quarters.</p>
            <Positions seasonId={seasonId} />
          </section>

          <section className="card">
            <h2>Pairings</h2>
            <p>Share of shared availability that each pair of players has actually spent on the field together.</p>
            <Pairings seasonId={seasonId} />
          </section>
        </>
      )}
    </>
  );
}
