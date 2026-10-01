export default function NoteIcon({ name, size = 22, ...props }) {
  const paths = {
    folder: <path d="M3 7a2 2 0 0 1 2-2h5l2 2h7a2 2 0 0 1 2 2v10a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2Z" />,
    newFolder: <><path d="M21 12V9a2 2 0 0 0-2-2h-7l-2-2H5a2 2 0 0 0-2 2v12a2 2 0 0 0 2 2h8" /><path d="M18 15v6m-3-3h6" /></>,
    compose: <><path d="M20 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V6a2 2 0 0 1 2-2h7" /><path d="m14 4 3 3M10 14l4-1 8-8-3-3-8 8Z" /></>,
    notes: <><rect x="4" y="3" width="16" height="19" rx="3" /><path d="M4 8h16M8 12h8m-8 4h6" /></>,
    trash: <><path d="M3 6h18M9 6V3h6v3M5 6l1 15h12l1-15M10 10v7m4-7v7" /></>,
    chevron: <path d="m9 5 7 7-7 7" />,
    back: <path d="m15 4-8 8 8 8" />,
    search: <><circle cx="10.5" cy="10.5" r="6.5" /><path d="m16 16 5 5" /></>,
    pin: <><path d="m9 3 6 0-1 7 4 4v2H6v-2l4-4-1-7ZM12 16v6" /></>,
    more: <><circle cx="12" cy="12" r="9" /><path d="M7.5 12h.01M12 12h.01m4.5 0h.01" strokeWidth="3" /></>,
    checklist: <><circle cx="6" cy="7" r="3" /><path d="m4.5 7 1 1 2-2M12 7h9" /><circle cx="6" cy="17" r="3" /><path d="M12 17h9" /></>,
    list: <><path d="M9 6h12M9 12h12M9 18h12" /><path d="M3 6h.01M3 12h.01M3 18h.01" strokeWidth="3" /></>,
    undo: <><path d="M9 4 4 9l5 5M4 9h10a6 6 0 0 1 0 12" /></>,
    redo: <><path d="m15 4 5 5-5 5M20 9H10a6 6 0 0 0 0 12" /></>,
    close: <path d="m6 6 12 12M18 6 6 18" />,
    check: <path d="m5 12 4 4L19 6" />,
  }
  return <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" {...props}>{paths[name] || paths.notes}</svg>
}
