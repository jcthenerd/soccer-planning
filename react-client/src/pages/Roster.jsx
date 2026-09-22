import { useEffect, useState } from 'react';
import { api } from '../api.js';

function PositionChecks({ positions, selectedIds, onChange }) {
  return (
    <div className="position-checks">
      {positions.map((p) => (
        <label className="check" key={p.id}>
          <input
            type="checkbox"
            checked={selectedIds.includes(p.id)}
            onChange={(e) => {
              const next = e.target.checked
                ? [...selectedIds, p.id]
                : selectedIds.filter((id) => id !== p.id);
              onChange(next);
            }}
          />
          {p.name}
        </label>
      ))}
    </div>
  );
}

const EMPTY_FORM = { name: '', jersey_number: '', notes: '', restrict_positions: false, eligible_position_ids: [] };

export default function Roster() {
  const [positions, setPositions] = useState([]);
  const [players, setPlayers] = useState([]);
  const [addForm, setAddForm] = useState(EMPTY_FORM);
  const [editingId, setEditingId] = useState(null);
  const [editDraft, setEditDraft] = useState(null);

  async function loadPlayers() {
    setPlayers(await api.get('/api/players'));
  }

  useEffect(() => {
    (async () => {
      setPositions(await api.get('/api/positions'));
      await loadPlayers();
    })();
  }, []);

  function positionNames(ids) {
    if (!ids.length) return 'Any';
    return ids.map((id) => positions.find((p) => p.id === id)?.name || '?').join(', ');
  }

  async function handleAddSubmit(e) {
    e.preventDefault();
    const name = addForm.name.trim();
    if (!name) return;
    await api.post('/api/players', {
      name,
      jersey_number: addForm.jersey_number === '' ? null : Number(addForm.jersey_number),
      notes: addForm.notes,
      restrict_positions: addForm.restrict_positions,
      eligible_position_ids: addForm.eligible_position_ids,
    });
    setAddForm(EMPTY_FORM);
    await loadPlayers();
  }

  async function handleToggleActive(player) {
    await api.patch(`/api/players/${player.id}/active`, { active: !player.active });
    await loadPlayers();
  }

  function startEdit(player) {
    setEditingId(player.id);
    setEditDraft({
      name: player.name,
      jersey_number: player.jersey_number ?? '',
      notes: player.notes ?? '',
      restrict_positions: player.restrict_positions,
      eligible_position_ids: player.eligible_position_ids,
    });
  }

  async function handleSaveEdit(player) {
    const name = editDraft.name.trim();
    if (!name) { alert('Name is required'); return; }
    await api.put(`/api/players/${player.id}`, {
      name,
      jersey_number: editDraft.jersey_number === '' ? null : Number(editDraft.jersey_number),
      notes: editDraft.notes,
      restrict_positions: editDraft.restrict_positions,
      eligible_position_ids: editDraft.eligible_position_ids,
    });
    setEditingId(null);
    await loadPlayers();
  }

  return (
    <>
      <h1>Roster</h1>

      <section className="card">
        <h2>Add Player</h2>
        <form onSubmit={handleAddSubmit}>
          <label>Name <input type="text" required value={addForm.name} onChange={(e) => setAddForm({ ...addForm, name: e.target.value })} /></label>
          <label>Jersey # <input type="number" value={addForm.jersey_number} onChange={(e) => setAddForm({ ...addForm, jersey_number: e.target.value })} /></label>
          <label>Notes <input type="text" value={addForm.notes} onChange={(e) => setAddForm({ ...addForm, notes: e.target.value })} /></label>
          <fieldset>
            <legend>Position eligibility</legend>
            <label className="check">
              <input
                type="checkbox"
                checked={addForm.restrict_positions}
                onChange={(e) => setAddForm({ ...addForm, restrict_positions: e.target.checked })}
              />
              Restrict to specific positions
            </label>
            <PositionChecks
              positions={positions}
              selectedIds={addForm.eligible_position_ids}
              onChange={(ids) => setAddForm({ ...addForm, eligible_position_ids: ids })}
            />
          </fieldset>
          <button type="submit">Add Player</button>
        </form>
      </section>

      <section className="card">
        <h2>Players</h2>
        <table>
          <thead>
            <tr><th>Name</th><th>#</th><th>Eligible Positions</th><th>Status</th><th>Notes</th><th></th></tr>
          </thead>
          <tbody>
            {players.map((player) => editingId === player.id ? (
              <tr key={player.id}>
                <td><input type="text" value={editDraft.name} onChange={(e) => setEditDraft({ ...editDraft, name: e.target.value })} /></td>
                <td><input type="number" style={{ width: '4em' }} value={editDraft.jersey_number} onChange={(e) => setEditDraft({ ...editDraft, jersey_number: e.target.value })} /></td>
                <td>
                  <label className="check">
                    <input
                      type="checkbox"
                      checked={editDraft.restrict_positions}
                      onChange={(e) => setEditDraft({ ...editDraft, restrict_positions: e.target.checked })}
                    />
                    Restrict
                  </label>
                  <PositionChecks
                    positions={positions}
                    selectedIds={editDraft.eligible_position_ids}
                    onChange={(ids) => setEditDraft({ ...editDraft, eligible_position_ids: ids })}
                  />
                </td>
                <td>{player.active ? 'Active' : 'Inactive'}</td>
                <td><input type="text" value={editDraft.notes} onChange={(e) => setEditDraft({ ...editDraft, notes: e.target.value })} /></td>
                <td>
                  <button type="button" data-action="save" onClick={() => handleSaveEdit(player)}>Save</button>
                  <button type="button" data-action="cancel" onClick={() => setEditingId(null)}>Cancel</button>
                </td>
              </tr>
            ) : (
              <tr key={player.id}>
                <td>{player.name}</td>
                <td>{player.jersey_number ?? ''}</td>
                <td>{player.restrict_positions ? positionNames(player.eligible_position_ids) : 'Any'}</td>
                <td>{player.active ? 'Active' : 'Inactive'}</td>
                <td>{player.notes ?? ''}</td>
                <td>
                  <button type="button" data-action="edit" onClick={() => startEdit(player)}>Edit</button>
                  <button
                    type="button"
                    data-action="toggle-active"
                    className={player.active ? 'danger' : undefined}
                    onClick={() => handleToggleActive(player)}
                  >
                    {player.active ? 'Deactivate' : 'Activate'}
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </section>
    </>
  );
}
