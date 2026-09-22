import { useEffect, useState, useCallback } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { api } from '../api.js';

function buildEditablePlanFromSaved(gameData) {
  if (!gameData.assignments.length) return null;
  return gameData.quarters.map((q) => {
    const rows = gameData.assignments.filter((a) => a.quarter_id === q.id);
    return {
      quarter_number: q.quarter_number,
      quarter_id: q.id,
      assignments: rows.filter((r) => r.position_id != null).map((r) => ({ player_id: r.player_id, position_id: r.position_id })),
      bench: rows.filter((r) => r.position_id == null).map((r) => r.player_id),
    };
  });
}

export default function GameDetail() {
  const { id: gameId } = useParams();
  const navigate = useNavigate();
  const [gameData, setGameData] = useState(null);
  const [positionsList, setPositionsList] = useState([]);
  const [editablePlan, setEditablePlan] = useState(null);
  const [attendanceDraft, setAttendanceDraft] = useState({});
  const [goalsDraft, setGoalsDraft] = useState({});
  const [opponentGoalsDraft, setOpponentGoalsDraft] = useState('');
  const [lineupPreviewUrl, setLineupPreviewUrl] = useState(null);

  const loadGame = useCallback(async () => {
    const data = await api.get(`/api/games/${gameId}`);
    setGameData(data);
    setAttendanceDraft(Object.fromEntries(data.attendance.map((a) => [a.player_id, a.available])));
    setGoalsDraft(Object.fromEntries(data.attendance.map((a) => [a.player_id, a.goals])));
    setOpponentGoalsDraft(data.opponent_goals == null ? '' : String(data.opponent_goals));
    setEditablePlan(buildEditablePlanFromSaved(data));
  }, [gameId]);

  useEffect(() => {
    api.get('/api/positions').then(setPositionsList);
    loadGame();
  }, [loadGame]);

  if (!gameData) return <p>Loading&hellip;</p>;

  const availablePlayerIds = gameData.attendance.filter((a) => attendanceDraft[a.player_id]).map((a) => a.player_id);
  const playerName = (playerId) => {
    const a = gameData.attendance.find((x) => x.player_id === playerId);
    return a ? a.name : `#${playerId}`;
  };

  async function handleSaveAttendance() {
    const attendance = gameData.attendance.map((a) => ({ player_id: a.player_id, available: !!attendanceDraft[a.player_id] }));
    await api.put(`/api/games/${gameId}/attendance`, { attendance });
    await loadGame();
  }

  async function handleSaveGoals() {
    const goals = gameData.attendance.map((a) => ({ player_id: a.player_id, goals: Number(goalsDraft[a.player_id]) || 0 }));
    const opponent_goals = opponentGoalsDraft === '' ? null : Number(opponentGoalsDraft);
    try {
      await api.put(`/api/games/${gameId}/goals`, { goals, opponent_goals });
      await loadGame();
    } catch (err) {
      alert(err.message);
    }
  }

  async function handleGeneratePlan() {
    const result = await api.post(`/api/games/${gameId}/generate-plan`, {});
    setEditablePlan(result.quarters.map((q) => ({
      quarter_number: q.quarter_number,
      quarter_id: q.quarter_id,
      assignments: q.assignments.map((a) => ({ player_id: a.player_id, position_id: a.position_id })),
      bench: q.bench.map((b) => b.player_id),
    })));
  }

  async function handleSavePlan() {
    const payload = {
      quarters: editablePlan.map((q) => ({
        quarter_number: q.quarter_number,
        assignments: q.assignments,
        bench: q.bench,
      })),
    };
    try {
      await api.put(`/api/games/${gameId}/plan`, payload);
      await loadGame();
    } catch (err) {
      alert(err.message);
    }
  }

  function toggleLineupPreview() {
    setLineupPreviewUrl(lineupPreviewUrl ? null : `/api/games/${gameId}/lineup-pdf?t=${Date.now()}`);
  }

  async function handleDeleteGame() {
    if (!confirm(`Delete the game vs ${gameData.opponent || 'TBD'} on ${gameData.date}? This cannot be undone.`)) return;
    try {
      await api.del(`/api/games/${gameId}`);
      navigate('/games');
    } catch (err) {
      alert(err.message);
    }
  }

  function findLocation(quarter, playerId) {
    const idx = quarter.assignments.findIndex((a) => a.player_id === playerId);
    if (idx !== -1) return { type: 'assignment', index: idx };
    const benchIdx = quarter.bench.indexOf(playerId);
    if (benchIdx !== -1) return { type: 'bench', index: benchIdx };
    return null;
  }

  function getPlayerAt(quarter, location) {
    return location.type === 'assignment' ? quarter.assignments[location.index].player_id : quarter.bench[location.index];
  }

  function setPlayerAt(quarter, location, playerId) {
    if (location.type === 'assignment') quarter.assignments[location.index].player_id = playerId;
    else quarter.bench[location.index] = playerId;
  }

  // Swapping (rather than just overwriting) keeps every quarter a valid
  // permutation of the available roster at all times.
  function swapPlayers(quarterIdx, location, newPlayerId) {
    const next = editablePlan.map((q) => ({ ...q, assignments: q.assignments.map((a) => ({ ...a })), bench: [...q.bench] }));
    const quarter = next[quarterIdx];
    const oldPlayerId = getPlayerAt(quarter, location);
    if (oldPlayerId !== newPlayerId) {
      const otherLocation = findLocation(quarter, newPlayerId);
      setPlayerAt(quarter, location, newPlayerId);
      if (otherLocation) setPlayerAt(quarter, otherLocation, oldPlayerId);
    }
    setEditablePlan(next);
  }

  return (
    <>
      <h1>{gameData.date} vs {gameData.opponent || 'TBD'}</h1>
      <p>Formation: {gameData.formation_name} &middot; {gameData.num_quarters} quarters</p>
      <button type="button" onClick={toggleLineupPreview}>
        {lineupPreviewUrl ? 'Hide Lineup PDF Preview' : 'Preview Lineup PDF'}
      </button>{' '}
      <a className="btn" href={`/api/games/${gameId}/lineup-pdf`} download>Download Lineup PDF</a>{' '}
      <button type="button" data-action="delete" onClick={handleDeleteGame}>Delete Game</button>

      {lineupPreviewUrl && (
        <iframe
          title="Lineup PDF preview"
          src={lineupPreviewUrl}
          style={{ width: '100%', height: '80vh', border: '1px solid var(--gridline)', marginTop: 12, borderRadius: 6 }}
        />
      )}

      <section className="card">
        <h2>Attendance</h2>
        <p>Uncheck any player who is not available for this game.</p>
        <div>
          {gameData.attendance.map((a) => (
            <label key={a.player_id} className="check" style={{ display: 'block', marginBottom: 6 }}>
              <input
                type="checkbox"
                checked={!!attendanceDraft[a.player_id]}
                onChange={(e) => setAttendanceDraft({ ...attendanceDraft, [a.player_id]: e.target.checked })}
              />
              {a.name}{a.jersey_number != null ? ` (#${a.jersey_number})` : ''}
            </label>
          ))}
        </div>
        <button type="button" onClick={handleSaveAttendance}>Save Attendance</button>
      </section>

      <section className="card">
        <h2>Goals</h2>
        <p>How many goals did each player score in this game?</p>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 16, maxWidth: 320 }}>
          <label style={{ flex: 1 }}>Opponent&rsquo;s goals</label>
          <input
            type="number"
            min="0"
            style={{ width: '4.5em' }}
            value={opponentGoalsDraft}
            onChange={(e) => setOpponentGoalsDraft(e.target.value)}
          />
        </div>
        {opponentGoalsDraft !== '' && (
          <p style={{ color: 'var(--text-secondary)' }}>
            Final score: {Object.values(goalsDraft).reduce((sum, v) => sum + (Number(v) || 0), 0)} &ndash; {opponentGoalsDraft}
          </p>
        )}
        <div>
          {gameData.attendance.map((a) => (
            <div key={a.player_id} style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 8, maxWidth: 320 }}>
              <label style={{ flex: 1 }}>
                {a.name}{a.jersey_number != null ? ` (#${a.jersey_number})` : ''}
              </label>
              <input
                type="number"
                min="0"
                style={{ width: '4.5em' }}
                value={goalsDraft[a.player_id] ?? 0}
                onChange={(e) => setGoalsDraft({ ...goalsDraft, [a.player_id]: e.target.value })}
              />
            </div>
          ))}
        </div>
        <button type="button" onClick={handleSaveGoals}>Save Goals</button>
      </section>

      <section className="card">
        <h2>Lineup Plan</h2>
        <button type="button" onClick={handleGeneratePlan}>Generate Plan</button>
        {editablePlan && (
          <button type="button" className="secondary" onClick={handleSavePlan}>Save Plan</button>
        )}
        <div style={{ overflowX: 'auto', marginTop: 12 }}>
          {editablePlan && (
            <PlanGrid
              editablePlan={editablePlan}
              positionsList={positionsList}
              availablePlayerIds={availablePlayerIds}
              playerName={playerName}
              onSwap={swapPlayers}
            />
          )}
        </div>
      </section>
    </>
  );
}

function PlanGrid({ editablePlan, positionsList, availablePlayerIds, playerName, onSwap }) {
  const rows = [];

  for (const pos of positionsList) {
    const maxSlots = Math.max(0, ...editablePlan.map((q) => q.assignments.filter((a) => a.position_id === pos.id).length));
    for (let slotIdx = 0; slotIdx < maxSlots; slotIdx++) {
      rows.push({ label: slotIdx === 0 ? pos.name : '', key: `${pos.id}-${slotIdx}`, cells: editablePlan.map((q, qIdx) => {
        const slotsForPos = q.assignments.map((a, i) => ({ a, i })).filter((x) => x.a.position_id === pos.id);
        const slot = slotsForPos[slotIdx];
        if (!slot) return null;
        return { quarterIdx: qIdx, location: { type: 'assignment', index: slot.i }, playerId: slot.a.player_id };
      }) });
    }
  }

  const maxBench = Math.max(0, ...editablePlan.map((q) => q.bench.length));
  for (let slotIdx = 0; slotIdx < maxBench; slotIdx++) {
    rows.push({ label: slotIdx === 0 ? 'Bench' : '', key: `bench-${slotIdx}`, cells: editablePlan.map((q, qIdx) => {
      const playerId = q.bench[slotIdx];
      if (playerId === undefined) return null;
      return { quarterIdx: qIdx, location: { type: 'bench', index: slotIdx }, playerId };
    }) });
  }

  return (
    <table className="quarter-grid-table">
      <thead>
        <tr>
          <th></th>
          {editablePlan.map((q) => <th key={q.quarter_number}>Q{q.quarter_number}</th>)}
        </tr>
      </thead>
      <tbody>
        {rows.map((row) => (
          <tr key={row.key}>
            <th>{row.label}</th>
            {row.cells.map((cell, i) => (
              <td className="cell" key={i}>
                {!cell ? <>&mdash;</> : (
                  <select
                    value={cell.playerId}
                    onChange={(e) => onSwap(cell.quarterIdx, cell.location, Number(e.target.value))}
                  >
                    {availablePlayerIds.map((pid) => (
                      <option key={pid} value={pid}>{playerName(pid)}</option>
                    ))}
                  </select>
                )}
              </td>
            ))}
          </tr>
        ))}
      </tbody>
    </table>
  );
}
