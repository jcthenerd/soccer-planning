import { useEffect, useState } from 'react';
import { api, importDataFile } from '../api.js';

export default function Onboarding({ onComplete }) {
  const [presets, setPresets] = useState([]);
  const [selected, setSelected] = useState(null);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState(null);

  useEffect(() => {
    api.get('/api/setup/presets').then((rows) => {
      setPresets(rows);
      setSelected(rows[0]?.key ?? null);
    });
  }, []);

  async function applyPreset() {
    if (!selected) return;
    setSubmitting(true);
    setError(null);
    try {
      await api.post('/api/setup/apply', { ageGroup: selected });
      onComplete();
    } catch (err) {
      setError(err.message);
    } finally {
      setSubmitting(false);
    }
  }

  async function skip() {
    setSubmitting(true);
    setError(null);
    try {
      await api.post('/api/setup/apply', { ageGroup: null });
      onComplete();
    } catch (err) {
      setError(err.message);
    } finally {
      setSubmitting(false);
    }
  }

  async function importBackup(e) {
    const input = e.target;
    const file = input.files[0];
    input.value = '';
    if (!file) return;
    setSubmitting(true);
    setError(null);
    try {
      await importDataFile(file);
      window.location.reload();
    } catch (err) {
      setError(`Import failed: ${err.message}`);
      setSubmitting(false);
    }
  }

  return (
    <div className="page">
      <h1>Welcome to Soccer Planner</h1>
      <p>
        Pick your team's age group to start with standard formations for that
        format. You can add, edit, or delete formations later in Settings.
      </p>
      {error && <p style={{ color: 'var(--danger)' }}>{error}</p>}
      <div>
        {presets.map((group) => (
          <section
            key={group.key}
            className="card"
            style={selected === group.key ? { borderColor: 'var(--accent)' } : undefined}
          >
            <h2>
              <label className="check">
                <input
                  type="radio"
                  name="age-group"
                  checked={selected === group.key}
                  onChange={() => setSelected(group.key)}
                />
                {group.label} ({group.formatLabel})
              </label>
            </h2>
            {group.formations.map((formation) => (
              <div className="formation-card" key={formation.key}>
                <h3>{formation.name}</h3>
                <p>{formation.description}</p>
              </div>
            ))}
          </section>
        ))}
      </div>
      <button type="button" onClick={applyPreset} disabled={submitting || !selected}>
        Use this age group
      </button>
      <button type="button" className="secondary" onClick={skip} disabled={submitting}>
        Skip - I'll set up positions and formations myself
      </button>
      <section className="card" style={{ marginTop: '24px' }}>
        <h2>Already using Soccer Planner on another computer?</h2>
        <p>Import an export file from that computer to bring over your roster, games, and settings.</p>
        <label>
          Import from file{' '}
          <input type="file" accept=".json,application/json" disabled={submitting} onChange={importBackup} />
        </label>
      </section>
    </div>
  );
}
