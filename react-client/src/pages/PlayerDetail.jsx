import { useCallback, useEffect, useState } from 'react';
import { useParams, Link } from 'react-router-dom';
import { api } from '../api.js';
import JournalEntryForm from '../components/JournalEntryForm.jsx';
import JournalEntryList from '../components/JournalEntryList.jsx';

export default function PlayerDetail() {
  const { id } = useParams();
  const [player, setPlayer] = useState(null);
  const [entries, setEntries] = useState([]);
  const [games, setGames] = useState([]);

  const loadEntries = useCallback(async () => {
    setEntries(await api.get(`/api/journal-entries?player_id=${id}`));
  }, [id]);

  useEffect(() => {
    api.get(`/api/players/${id}`).then(setPlayer);
    api.get('/api/games').then(setGames);
    loadEntries();
  }, [id, loadEntries]);

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

  if (!player) return <p>Loading&hellip;</p>;

  return (
    <>
      <p><Link to="/roster">&larr; Back to Roster</Link></p>
      <h1>{player.name}{player.jersey_number != null ? ` (#${player.jersey_number})` : ''}</h1>

      <section className="card">
        <h2>Add Journal Entry</h2>
        <JournalEntryForm fixedPlayerId={player.id} games={games} onSubmit={handleCreate} />
      </section>

      <section className="card">
        <h2>Journal</h2>
        <JournalEntryList entries={entries} games={games} onUpdate={handleUpdate} onDelete={handleDelete} />
      </section>
    </>
  );
}
