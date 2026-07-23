/**
 * Save button that signals unsaved changes:
 *   dirty  -> red  ("Save")   — you have changes that aren't saved yet
 *   clean  -> green ("Saved") — everything is saved
 */
export default function SaveButton({ dirty, busy, onClick, saveLabel = 'Save', savedLabel = 'Saved', small = true }) {
  return (
    <button
      type="button"
      className={`btn ${small ? 'small' : ''} ${dirty ? 'danger' : 'success'}`}
      onClick={onClick}
      disabled={busy}
    >
      {busy ? 'Saving…' : dirty ? saveLabel : savedLabel}
    </button>
  )
}
