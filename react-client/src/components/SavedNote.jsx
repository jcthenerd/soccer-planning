import { useEffect, useRef, useState } from 'react';

// Brief "Saved" confirmation for save buttons whose effect isn't otherwise
// visible (the form stays as-is after saving). Call `flash()` after a
// successful save and render `<SavedNote show={saved} />` next to the button.
// For a table of rows that each have their own Save button, call
// `flash(row.id)` and render `<SavedNote show={saved === row.id} />`.
export function useSavedFlash(durationMs = 2500) {
  const [shown, setShown] = useState(false);
  const timer = useRef(null);

  useEffect(() => () => clearTimeout(timer.current), []);

  function flash(key = true) {
    clearTimeout(timer.current);
    setShown(key);
    timer.current = setTimeout(() => setShown(false), durationMs);
  }

  return [shown, flash];
}

export default function SavedNote({ show, children = 'Saved' }) {
  return (
    <span className="saved-note" role="status" aria-live="polite">
      {show ? <>&#10003; {children}</> : null}
    </span>
  );
}
