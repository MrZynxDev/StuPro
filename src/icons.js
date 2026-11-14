const svg = (d, size = 24) =>
  `<svg width="${size}" height="${size}" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${d}</svg>`;

export const icons = {
  calendar: svg('<rect x="3.5" y="5" width="17" height="15.5" rx="2.5"/><path d="M8 3v4M16 3v4M3.5 10h17"/><path d="M8 14h.01M12 14h.01M16 14h.01M8 17.5h.01M12 17.5h.01"/>'),
  tasks: svg('<path d="M4 6.5l1.6 1.6L8.5 5M4 13.5l1.6 1.6L8.5 12M4 20l1.6-1.4"/><path d="M12 7h8M12 14h8M12 20h8"/>'),
  settings: svg('<path d="M4 7h9M17 7h3M4 17h3M11 17h9"/><circle cx="15" cy="7" r="2"/><circle cx="9" cy="17" r="2"/>'),
  plus: svg('<path d="M12 5v14M5 12h14"/>', 26),
  left: svg('<path d="M15 6l-6 6 6 6"/>', 20),
  right: svg('<path d="M9 6l6 6-6 6"/>', 20),
  check: svg('<path d="M5 12.5l4.5 4.5L19 7.5"/>', 16),
  close: svg('<path d="M6 6l12 12M18 6L6 18"/>', 22),
  logout: svg('<path d="M14 4h4a2 2 0 012 2v12a2 2 0 01-2 2h-4"/><path d="M10 16l-4-4 4-4M6 12h10"/>', 22),
  bell: svg('<path d="M6 16V11a6 6 0 1112 0v5l1.5 2h-15z"/><path d="M10 20.5a2 2 0 004 0"/>', 20),
  trash: svg('<path d="M5 7h14M10 7V5h4v2M7 7l1 12h8l1-12"/>', 18),
};
