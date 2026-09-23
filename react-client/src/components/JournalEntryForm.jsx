import { useState } from 'react';

function blankDraft(fixedPlayerId, defaultPlayerId) {
  return {
    player_id: fixedPlayerId ?? defaultPlayerId ?? '',
    linkMode: 'date',
    entry_date: '',
    game_id: '',
    strengths: '',
    improvements: '',
    notes: '',
  };
}

function draftFromEntry(entry) {
  return {
    player_id: entry.player_id ?? 'team',
    linkMode: entry.game_id ? 'game' : 'date',
    entry_date: entry.entry_date ?? '',
    game_id: entry.game_id ?? '',
    strengths: entry.strengths ?? '',
    improvements: entry.improvements ?? '',
    notes: entry.notes ?? '',
  };
}

// Add/edit form for a journal entry. Pass `fixedPlayerId` when the player is
// already known (player detail page, or editing an existing entry in place)
// - `null` fixes it to a team-wide entry, a player id fixes it to that
// player - to hide the player picker; omit the prop entirely to show one
// (team-wide journal page), where "Whole team" is one of the choices.
export default function JournalEntryForm({ players = [], games = [], fixedPlayerId, defaultPlayerId, entry, onSubmit, onCancel }) {
  const [draft, setDraft] = useState(() => (entry ? draftFromEntry(entry) : blankDraft(fixedPlayerId, defaultPlayerId)));

  async function handleSubmit(e) {
    e.preventDefault();
    let playerId;
    if (fixedPlayerId !== undefined) {
      playerId = fixedPlayerId;
    } else {
      if (!draft.player_id) { alert('Select the team or a player'); return; }
      playerId = draft.player_id === 'team' ? null : Number(draft.player_id);
    }
    if (draft.linkMode === 'date' && !draft.entry_date) { alert('Date is required'); return; }
    if (draft.linkMode === 'game' && !draft.game_id) { alert('Select a game'); return; }

    await onSubmit({
      player_id: playerId,
      game_id: draft.linkMode === 'game' ? Number(draft.game_id) : null,
      entry_date: draft.linkMode === 'date' ? draft.entry_date : null,
      strengths: draft.strengths,
      improvements: draft.improvements,
      notes: draft.notes,
    });

    if (!entry) setDraft(blankDraft(fixedPlayerId, defaultPlayerId));
  }

  return (
    <form onSubmit={handleSubmit}>
      {fixedPlayerId === undefined && (
        <label>
          About
          <select value={draft.player_id} onChange={(e) => setDraft({ ...draft, player_id: e.target.value })} required>
            <option value="" disabled>Select the team or a player</option>
            <option value="team">Whole team</option>
            <optgroup label="Players">
              {players.map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}
            </optgroup>
          </select>
        </label>
      )}

      <label>
        Relates to
        <select value={draft.linkMode} onChange={(e) => setDraft({ ...draft, linkMode: e.target.value })}>
          <option value="date">A practice or other day</option>
          <option value="game">A game</option>
        </select>
      </label>

      {draft.linkMode === 'date' ? (
        <label>
          Date
          <input type="date" required value={draft.entry_date} onChange={(e) => setDraft({ ...draft, entry_date: e.target.value })} />
        </label>
      ) : (
        <label>
          Game
          <select value={draft.game_id} onChange={(e) => setDraft({ ...draft, game_id: e.target.value })} required>
            <option value="" disabled>Select a game</option>
            {games.map((g) => <option key={g.id} value={g.id}>{g.date} vs {g.opponent || 'TBD'}</option>)}
          </select>
        </label>
      )}

      <label>
        Strengths
        <textarea value={draft.strengths} onChange={(e) => setDraft({ ...draft, strengths: e.target.value })} />
      </label>
      <label>
        To Improve
        <textarea value={draft.improvements} onChange={(e) => setDraft({ ...draft, improvements: e.target.value })} />
      </label>
      <label>
        Notes
        <textarea value={draft.notes} onChange={(e) => setDraft({ ...draft, notes: e.target.value })} />
      </label>

      <button type="submit" data-action="save">{entry ? 'Save' : 'Add Entry'}</button>{' '}
      {onCancel && <button type="button" data-action="cancel" onClick={onCancel}>Cancel</button>}
    </form>
  );
}
