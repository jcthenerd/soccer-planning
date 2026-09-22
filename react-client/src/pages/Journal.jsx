import { useCallback, useEffect, useState } from 'react';
import { api } from '../api.js';
import JournalEntryForm from '../components/JournalEntryForm.jsx';
import JournalEntryList from '../components/JournalEntryList.jsx';

export default function Journal() {
  const [players, setPlayers] = useState([]);
  const [games, setGames] = useState([]);
  const [entries, setEntries] = useState([]);
  const [filterPlayerId, setFilterPlayerId] = useState('');

  const loadEntries = useCallback(async () => {
    const url = filterPlayerId ? `/api/journal-entries?player_id=${filterPlayerId}` : '/api/journal-entries';
    setEntries(await api.get(url));
  }, [filterPlayerId]);

  useEffect(() => {
    api.get('/api/players').then(setPlayers);
    api.get('/api/games').then(setGames);
  }, []);

  useEffect(() => { loadEntries(); }, [loadEntries]);

  async function handleCreate(payload) {
    await api.post('/api/journal-entries', payload);
    await loadEntries();
  }

  async function handleUpdate(entryId, payload) {
    await api.put(`/api/journal-entries/${entryId}`, payload);
    await loadEntries();
  }

  async function handleDelete(entryId) {
    if (!confirm('Delete this journal entry? This cannot be undone.')) return;
    await api.del(`/api/journal-entries/${entryId}`);
    await loadEntries();
  }

  return (
    <>
      <h1>Journal</h1>

      <section className="card">
        <h2>Add Journal Entry</h2>
        <JournalEntryForm players={players} games={games} defaultPlayerId={filterPlayerId || undefined} onSubmit={handleCreate} />
      </section>

      <section className="card">
        <h2>Entries</h2>
        <label>
          Filter
          <select value={filterPlayerId} onChange={(e) => setFilterPlayerId(e.target.value)}>
            <option value="">Everyone</option>
            <option value="team">Whole team</option>
            {players.map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}
          </select>
        </label>
        <JournalEntryList entries={entries} players={players} games={games} showPlayerName onUpdate={handleUpdate} onDelete={handleDelete} />
      </section>
    </>
  );
}
