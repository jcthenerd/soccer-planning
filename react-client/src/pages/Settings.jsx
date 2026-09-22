import { useEffect, useState } from 'react';
import { api, importDataFile } from '../api.js';

const TEAM_INFO_FIELDS = [
  ['region', 'Region'],
  ['division', 'Division (e.g. "10U - Coed")'],
  ['team_name', 'Team Name'],
  ['team_colors', 'Team Colors'],
  ['coach_name', 'Coach'],
  ['assistant_coach_name', 'Ass. Coach'],
];

function TeamInfoSection() {
  const [draft, setDraft] = useState(null);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    api.get('/api/settings/team').then((row) => setDraft(row));
  }, []);

  async function handleSave(e) {
    e.preventDefault();
    setSaving(true);
    try {
      const saved = await api.put('/api/settings/team', draft);
      setDraft(saved);
    } finally {
      setSaving(false);
    }
  }

  if (!draft) return null;

  return (
    <section className="card">
      <h2>Team Info</h2>
      <p>Used to fill in the header of the exported lineup PDF.</p>
      <form onSubmit={handleSave}>
        {TEAM_INFO_FIELDS.map(([key, label]) => (
          <label key={key} style={{ display: 'block', marginBottom: 6 }}>
            {label}{' '}
            <input
              type="text"
              value={draft[key] ?? ''}
              onChange={(e) => setDraft({ ...draft, [key]: e.target.value })}
            />
          </label>
        ))}
        <button type="submit" disabled={saving}>Save</button>
      </form>
    </section>
  );
}

function SeasonsSection() {
  const [seasons, setSeasons] = useState([]);
  const [drafts, setDrafts] = useState({});
  const [addForm, setAddForm] = useState({ name: '', year: '', is_active: false });

  async function loadSeasons() {
    const rows = await api.get('/api/seasons');
    setSeasons(rows);
    setDrafts(Object.fromEntries(rows.map((s) => [s.id, { name: s.name, year: s.year ?? '' }])));
  }

  useEffect(() => { loadSeasons(); }, []);

  async function handleSave(season) {
    const draft = drafts[season.id];
    const name = draft.name.trim();
    if (!name) { alert('Name is required'); return; }
    await api.put(`/api/seasons/${season.id}`, { name, year: draft.year === '' ? null : Number(draft.year) });
    await loadSeasons();
  }

  async function handleSetActive(season) {
    await api.put(`/api/seasons/${season.id}`, { is_active: true });
    await loadSeasons();
  }

  async function handleDelete(season) {
    if (!confirm(`Delete season "${season.name}"? Games in this season must be deleted first.`)) return;
    try {
      await api.del(`/api/seasons/${season.id}`);
      await loadSeasons();
    } catch (err) {
      alert(err.message);
    }
  }

  async function handleAdd(e) {
    e.preventDefault();
    const name = addForm.name.trim();
    if (!name) return;
    await api.post('/api/seasons', {
      name,
      year: addForm.year === '' ? null : Number(addForm.year),
      is_active: addForm.is_active,
    });
    setAddForm({ name: '', year: '', is_active: false });
    await loadSeasons();
  }

  return (
    <section className="card">
      <h2>Seasons</h2>
      <table>
        <thead><tr><th>Name</th><th>Year</th><th>Active</th><th></th></tr></thead>
        <tbody>
          {seasons.map((season) => (
            <tr key={season.id}>
              <td>
                <input
                  type="text"
                  value={drafts[season.id]?.name ?? ''}
                  onChange={(e) => setDrafts({ ...drafts, [season.id]: { ...drafts[season.id], name: e.target.value } })}
                />
              </td>
              <td>
                <input
                  type="number"
                  style={{ width: '6em' }}
                  value={drafts[season.id]?.year ?? ''}
                  onChange={(e) => setDrafts({ ...drafts, [season.id]: { ...drafts[season.id], year: e.target.value } })}
                />
              </td>
              <td>
                <input type="radio" name="active-season" checked={!!season.is_active} onChange={() => handleSetActive(season)} />
              </td>
              <td>
                <button type="button" data-action="save" onClick={() => handleSave(season)}>Save</button>
                <button type="button" data-action="delete" onClick={() => handleDelete(season)}>Delete</button>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
      <form className="inline-form" onSubmit={handleAdd}>
        <input
          type="text"
          placeholder="Season name"
          required
          value={addForm.name}
          onChange={(e) => setAddForm({ ...addForm, name: e.target.value })}
        />
        <input
          type="number"
          placeholder="Year"
          style={{ width: '8em' }}
          value={addForm.year}
          onChange={(e) => setAddForm({ ...addForm, year: e.target.value })}
        />
        <label className="check">
          <input
            type="checkbox"
            checked={addForm.is_active}
            onChange={(e) => setAddForm({ ...addForm, is_active: e.target.checked })}
          />
          Make active
        </label>
        <button type="submit">Add Season</button>
      </form>
    </section>
  );
}

function PositionsSection({ positions, onChange }) {
  const [drafts, setDrafts] = useState({});
  const [addForm, setAddForm] = useState({ name: '', sort_order: 0 });

  useEffect(() => {
    setDrafts(Object.fromEntries(positions.map((p) => [p.id, { name: p.name, sort_order: p.sort_order }])));
  }, [positions]);

  async function handleSave(pos) {
    const draft = drafts[pos.id];
    const name = draft.name.trim();
    if (!name) { alert('Name is required'); return; }
    await api.put(`/api/positions/${pos.id}`, { name, sort_order: Number(draft.sort_order) });
    await onChange();
  }

  async function handleDelete(pos) {
    if (!confirm(`Delete position "${pos.name}"?`)) return;
    try {
      await api.del(`/api/positions/${pos.id}`);
      await onChange();
    } catch (err) {
      alert(err.message);
    }
  }

  async function handleAdd(e) {
    e.preventDefault();
    const name = addForm.name.trim();
    if (!name) return;
    await api.post('/api/positions', { name, sort_order: Number(addForm.sort_order) || 0 });
    setAddForm({ name: '', sort_order: 0 });
    await onChange();
  }

  return (
    <section className="card">
      <h2>Positions</h2>
      <table>
        <thead><tr><th>Name</th><th>Sort Order</th><th></th></tr></thead>
        <tbody>
          {positions.map((pos) => (
            <tr key={pos.id}>
              <td>
                <input
                  type="text"
                  value={drafts[pos.id]?.name ?? ''}
                  onChange={(e) => setDrafts({ ...drafts, [pos.id]: { ...drafts[pos.id], name: e.target.value } })}
                />
              </td>
              <td>
                <input
                  type="number"
                  style={{ width: '5em' }}
                  value={drafts[pos.id]?.sort_order ?? 0}
                  onChange={(e) => setDrafts({ ...drafts, [pos.id]: { ...drafts[pos.id], sort_order: e.target.value } })}
                />
              </td>
              <td>
                <button type="button" data-action="save" onClick={() => handleSave(pos)}>Save</button>
                <button type="button" data-action="delete" onClick={() => handleDelete(pos)}>Delete</button>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
      <form className="inline-form" onSubmit={handleAdd}>
        <input
          type="text"
          placeholder="Position name"
          required
          value={addForm.name}
          onChange={(e) => setAddForm({ ...addForm, name: e.target.value })}
        />
        <input
          type="number"
          placeholder="Sort order"
          style={{ width: '6em' }}
          value={addForm.sort_order}
          onChange={(e) => setAddForm({ ...addForm, sort_order: e.target.value })}
        />
        <button type="submit">Add Position</button>
      </form>
    </section>
  );
}

const EMPTY_SLOT = () => ({ position_id: '', count: 1, drop_priority: '' });

function PresetLoaderSection({ onApplied }) {
  const [presets, setPresets] = useState([]);
  const [ageGroup, setAgeGroup] = useState('');
  const [applying, setApplying] = useState(false);

  useEffect(() => {
    api.get('/api/setup/presets').then((rows) => {
      setPresets(rows);
      setAgeGroup(rows[0]?.key ?? '');
    });
  }, []);

  async function handleApply() {
    if (!ageGroup) return;
    setApplying(true);
    try {
      const result = await api.post('/api/setup/apply', { ageGroup });
      if (result.formationsCreated === 0) {
        alert('Those preset formations already exist.');
      }
      await onApplied();
    } finally {
      setApplying(false);
    }
  }

  if (!presets.length) return null;

  return (
    <div className="inline-form" style={{ marginBottom: '16px' }}>
      <label>
        Load age-group preset formations{' '}
        <select value={ageGroup} onChange={(e) => setAgeGroup(e.target.value)}>
          {presets.map((group) => (
            <option key={group.key} value={group.key}>{group.label} ({group.formatLabel})</option>
          ))}
        </select>
      </label>
      <button type="button" onClick={handleApply} disabled={applying}>Add formations</button>
    </div>
  );
}

function FormationsSection({ positions, onPositionsChange }) {
  const [formations, setFormations] = useState([]);
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [slots, setSlots] = useState([EMPTY_SLOT()]);

  async function loadFormations() {
    setFormations(await api.get('/api/formations'));
  }

  useEffect(() => { loadFormations(); }, []);

  useEffect(() => {
    if (positions.length && slots.length === 1 && slots[0].position_id === '') {
      setSlots([{ ...EMPTY_SLOT(), position_id: positions[0].id }]);
    }
  }, [positions]);

  async function handleDelete(formation) {
    if (!confirm(`Delete formation "${formation.name}"?`)) return;
    try {
      await api.del(`/api/formations/${formation.id}`);
      await loadFormations();
    } catch (err) {
      alert(err.message);
    }
  }

  function updateSlot(index, patch) {
    setSlots(slots.map((s, i) => (i === index ? { ...s, ...patch } : s)));
  }

  function removeSlot(index) {
    setSlots(slots.filter((_, i) => i !== index));
  }

  function addSlot() {
    setSlots([...slots, { ...EMPTY_SLOT(), position_id: positions[0]?.id ?? '' }]);
  }

  async function handleAdd(e) {
    e.preventDefault();
    const trimmedName = name.trim();
    if (!trimmedName) return;
    if (!slots.length) { alert('Add at least one position slot'); return; }
    await api.post('/api/formations', {
      name: trimmedName,
      description,
      slots: slots.map((s) => ({
        position_id: Number(s.position_id),
        count: Number(s.count) || 1,
        drop_priority: s.drop_priority === '' ? null : Number(s.drop_priority),
      })),
    });
    setName('');
    setDescription('');
    setSlots([{ ...EMPTY_SLOT(), position_id: positions[0]?.id ?? '' }]);
    await loadFormations();
  }

  return (
    <section className="card">
      <h2>Formations</h2>
      <PresetLoaderSection
        onApplied={async () => {
          await loadFormations();
          await onPositionsChange();
        }}
      />
      <div>
        {formations.map((formation) => (
          <div className="formation-card" key={formation.id}>
            <h3>{formation.name} <small>({formation.total_field_slots} on field)</small></h3>
            <p>{formation.description ?? ''}</p>
            <ul>
              {formation.slots.map((s) => (
                <li key={s.id}>
                  {s.position_name} &times; {s.count}
                  {s.drop_priority != null ? ` (drop priority ${s.drop_priority})` : ' (never dropped when short-handed)'}
                </li>
              ))}
            </ul>
            <button type="button" data-action="delete" onClick={() => handleDelete(formation)}>Delete</button>
          </div>
        ))}
      </div>
      <form onSubmit={handleAdd}>
        <h3>New Formation</h3>
        <label>Name <input type="text" required value={name} onChange={(e) => setName(e.target.value)} /></label>
        <label>Description <input type="text" value={description} onChange={(e) => setDescription(e.target.value)} /></label>
        <div>
          {slots.map((slot, i) => (
            <div className="slot-row" key={i}>
              <select value={slot.position_id} onChange={(e) => updateSlot(i, { position_id: e.target.value })}>
                {positions.map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}
              </select>
              <input
                type="number"
                min="1"
                style={{ width: '4em' }}
                value={slot.count}
                onChange={(e) => updateSlot(i, { count: e.target.value })}
              /> count
              <input
                type="number"
                placeholder="drop priority (blank = never drop)"
                style={{ width: '16em' }}
                value={slot.drop_priority}
                onChange={(e) => updateSlot(i, { drop_priority: e.target.value })}
              />
              <button type="button" data-action="remove-slot" onClick={() => removeSlot(i)}>Remove</button>
            </div>
          ))}
        </div>
        <button type="button" onClick={addSlot}>Add position slot</button>
        <button type="submit">Save Formation</button>
      </form>
    </section>
  );
}

function DataSection() {
  const [importing, setImporting] = useState(false);

  async function handleFileChosen(e) {
    const input = e.target;
    const file = input.files[0];
    input.value = '';
    if (!file) return;
    if (!confirm(
      `Import "${file.name}"?\n\nThis REPLACES all data on this computer (players, games, seasons, formations) with the contents of the file. This can't be undone - export first if you want a backup.`
    )) return;
    setImporting(true);
    try {
      await importDataFile(file);
      window.location.reload();
    } catch (err) {
      alert(`Import failed: ${err.message}`);
      setImporting(false);
    }
  }

  return (
    <section className="card">
      <h2>Export &amp; Import</h2>
      <p>
        Move your data to another computer: export it here, copy the file over, then import it
        on the other machine. Importing replaces everything on that machine, so keep the
        computers in sync by always importing from whichever one you used last.
      </p>
      <div className="inline-form">
        <a className="btn" href="/api/data/export" download>Export data</a>
        <label>
          Import from file{' '}
          <input type="file" accept=".json,application/json" disabled={importing} onChange={handleFileChosen} />
        </label>
      </div>
    </section>
  );
}

export default function Settings() {
  const [positions, setPositions] = useState([]);

  async function loadPositions() {
    setPositions(await api.get('/api/positions'));
  }

  useEffect(() => { loadPositions(); }, []);

  return (
    <>
      <h1>Settings</h1>
      <TeamInfoSection />
      <SeasonsSection />
      <PositionsSection positions={positions} onChange={loadPositions} />

      <FormationsSection positions={positions} onPositionsChange={loadPositions} />
      <DataSection />
    </>
  );
}
