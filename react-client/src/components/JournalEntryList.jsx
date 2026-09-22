import { useState } from 'react';
import JournalEntryForm from './JournalEntryForm.jsx';

function effectiveLabel(entry) {
  if (entry.game_id) return `${entry.game_date} vs ${entry.game_opponent || 'TBD'}`;
  // entry_date can be null if this entry was linked to a game that was later
  // deleted (the FK is ON DELETE SET NULL, so the entry survives dateless).
  return entry.entry_date || 'Undated (linked game was deleted)';
}

function scopeLabel(entry) {
  return entry.player_id ? entry.player_name : 'Whole Team';
}

// Renders a list of journal entries as cards, with edit-in-place (matching
// the row-editing pattern in Roster.jsx) and delete.
export default function JournalEntryList({ entries, players = [], games = [], showPlayerName = false, onUpdate, onDelete }) {
  const [editingId, setEditingId] = useState(null);

  if (!entries.length) return <p>No journal entries yet.</p>;

  return (
    <div>
      {entries.map((entry) => (
        <div className="journal-entry" key={entry.id}>
          {editingId === entry.id ? (
            <JournalEntryForm
              players={players}
              games={games}
              fixedPlayerId={entry.player_id}
              entry={entry}
              onSubmit={async (payload) => { await onUpdate(entry.id, payload); setEditingId(null); }}
              onCancel={() => setEditingId(null)}
            />
          ) : (
            <>
              <div className="journal-entry-header">
                <strong>{effectiveLabel(entry)}</strong>
                {showPlayerName && <span>{scopeLabel(entry)}</span>}
              </div>
              <div className="journal-entry-field"><span className="label">Strengths</span>{entry.strengths || '—'}</div>
              <div className="journal-entry-field"><span className="label">To Improve</span>{entry.improvements || '—'}</div>
              <div className="journal-entry-field"><span className="label">Notes</span>{entry.notes || '—'}</div>
              <button type="button" data-action="edit" onClick={() => setEditingId(entry.id)}>Edit</button>{' '}
              <button type="button" data-action="delete" className="danger" onClick={() => onDelete(entry.id)}>Delete</button>
            </>
          )}
        </div>
      ))}
    </div>
  );
}
