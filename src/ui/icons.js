// Hand-built inline SVG icons: 3px ink strokes, round caps, flat palette fills (STYLE.md §6).
const S = 'stroke="#2A1E3F" stroke-width="3" stroke-linecap="round" stroke-linejoin="round"';
const svg = (body, vb = 32) => `<svg viewBox="0 0 ${vb} ${vb}" aria-hidden="true" focusable="false">${body}</svg>`;

export const ICON = {
  pause: svg(`<rect x="8" y="7" width="5.5" height="18" rx="2" fill="#FFF6E6" ${S}/><rect x="18.5" y="7" width="5.5" height="18" rx="2" fill="#FFF6E6" ${S}/>`),
  play: svg(`<path d="M10 6.5 L25 16 L10 25.5 Z" fill="#FFC830" ${S}/>`),
  gear: svg(
    `<path d="M16 4.5l2.2 3.1 3.7-.9.9 3.7 3.1 2.2-1.6 3.4 1.6 3.4-3.1 2.2-.9 3.7-3.7-.9L16 27.5l-2.2-3.1-3.7.9-.9-3.7-3.1-2.2L7.7 16 6.1 12.6l3.1-2.2.9-3.7 3.7.9z" fill="#B9A6EE" ${S}/><circle cx="16" cy="16" r="4.2" fill="#FFF6E6" ${S}/>`,
  ),
  back: svg(`<path d="M19 7 L10 16 L19 25" fill="none" ${S} stroke-width="4"/>`),
  close: svg(`<path d="M9 9 L23 23 M23 9 L9 23" fill="none" ${S} stroke-width="4"/>`),
  star: svg(`<path d="M16 3.5l3.6 7.6 8.3 1-6.1 5.7 1.6 8.2L16 22l-7.4 4 1.6-8.2-6.1-5.7 8.3-1z" fill="#FFC830" ${S}/>`),
  starEmpty: svg(`<path d="M16 3.5l3.6 7.6 8.3 1-6.1 5.7 1.6 8.2L16 22l-7.4 4 1.6-8.2-6.1-5.7 8.3-1z" fill="#E7DCC8" ${S}/>`),
  lock: svg(`<rect x="7" y="14" width="18" height="13" rx="3" fill="#9AA0B5" ${S}/><path d="M11 14v-3a5 5 0 0 1 10 0v3" fill="none" ${S}/><circle cx="16" cy="20.5" r="1.6" fill="#2A1E3F"/>`),
  clock: svg(`<circle cx="16" cy="17" r="10.5" fill="#FFF6E6" ${S}/><path d="M16 11v6.5l4 2.5" fill="none" ${S}/><path d="M12 4h8" ${S}/>`),
  restart: svg(`<path d="M24.5 16a8.5 8.5 0 1 1-2.5-6" fill="none" ${S} stroke-width="3.5"/><path d="M23.5 5.5v5.5h-5.5" fill="none" ${S} stroke-width="3.5"/>`),
  home: svg(`<path d="M5 15 L16 6 L27 15" fill="none" ${S}/><path d="M8 13v13h16V13" fill="#FFF6E6" ${S}/><rect x="13.5" y="18" width="5" height="8" fill="#FF5C8A" ${S}/>`),
  book: svg(`<path d="M5 7h9a3 3 0 0 1 3 3v16a3 3 0 0 0-3-3H5z" fill="#5BC0F5" ${S}/><path d="M27 7h-9a3 3 0 0 0-3 3v16a3 3 0 0 1 3-3h9z" fill="#3457D5" ${S}/>`),
  check: svg(`<path d="M7 17 L13.5 23 L25.5 9" fill="none" ${S} stroke-width="4"/>`),
  camera: svg(`<rect x="4.5" y="9.5" width="23" height="16" rx="3" fill="#FF5C8A" ${S}/><path d="M11 9.5l2-3.5h6l2 3.5" fill="#FFF6E6" ${S}/><circle cx="16" cy="17.5" r="4.5" fill="#BDEBFA" ${S}/>`),
  music: svg(`<path d="M12 23V8l13-3v15" fill="none" ${S}/><circle cx="9" cy="23" r="3.5" fill="#FF5C8A" ${S}/><circle cx="22" cy="20" r="3.5" fill="#FF5C8A" ${S}/>`),
  speaker: svg(`<path d="M5 12h5l7-5.5v19L10 20H5z" fill="#FFC830" ${S}/><path d="M21.5 11.5a6 6 0 0 1 0 9M24.5 8a10.5 10.5 0 0 1 0 16" fill="none" ${S}/>`),
  buzz: svg(`<rect x="10" y="5" width="12" height="22" rx="3" fill="#19B3A6" ${S}/><path d="M5 11v10M27 11v10" ${S}/>`),
  eye: svg(`<path d="M3.5 16S8.5 8 16 8s12.5 8 12.5 8-5 8-12.5 8S3.5 16 3.5 16z" fill="#FFF6E6" ${S}/><circle cx="16" cy="16" r="4" fill="#2A1E3F"/>`),
  ball: svg(`<circle cx="16" cy="16" r="11" fill="#B9A6EE" ${S}/><circle cx="12" cy="12" r="2.5" fill="#FFC830" ${S} stroke-width="2"/><circle cx="20" cy="19" r="3" fill="#FF5C8A" ${S} stroke-width="2"/>`),
  next: svg(`<path d="M13 7 L22 16 L13 25" fill="none" ${S} stroke-width="4"/>`),
  zen: svg(`<path d="M6 21c3-1 5-6 10-6s7 5 10 6" fill="none" ${S}/><circle cx="16" cy="10" r="4" fill="#9AD94A" ${S}/><path d="M5 26h22" ${S}/>`),
  timer: svg(`<circle cx="16" cy="17" r="10.5" fill="#FFC830" ${S}/><path d="M16 11v6.5l4 2.5" fill="none" ${S}/><path d="M12 4h8" ${S}/>`),
  trash: svg(`<path d="M8 10h16l-1.5 16h-13z" fill="#F0412F" ${S}/><path d="M6 10h20M13 6h6" ${S}/>`),
};
