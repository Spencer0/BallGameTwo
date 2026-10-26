// Level table (DESIGN.md §6). Sizes are diameters in metres, time in seconds.
import * as l1 from './l1.js';

export const LEVELS = [
  {
    n: 1,
    id: 'crumb',
    name: 'Crumb Patrol',
    place: 'The Breakfast Table',
    start: 0.04,
    target: 0.22,
    time: 240,
    packs: ['L1'],
    cell: 0.08,
    mod: l1,
    theme: 'crumb',
    color: 'tomato',
  },
  { n: 2, id: 'bedroom', name: 'Bedroom Bedlam', place: "The Kid's Bedroom", start: 0.2, target: 1.1, time: 360, packs: ['L1', 'L2'], cell: 0.4, theme: 'bedroom', color: 'cobalt' },
  { n: 3, id: 'house', name: 'House Party', place: 'The Whole House', start: 1.0, target: 5, time: 420, packs: ['L1', 'L2', 'L3'], cell: 2, theme: 'house', color: 'teal' },
  { n: 4, id: 'culdesac', name: 'Cul-de-Sac', place: 'Maple Loop', start: 4.5, target: 22, time: 480, packs: ['L3', 'L4'], cell: 8, theme: 'culdesac', color: 'leaf' },
  { n: 5, id: 'town', name: 'Small Town', place: 'Puddleford', start: 18, target: 90, time: 540, packs: ['L3', 'L4', 'L5'], cell: 30, theme: 'town', color: 'tangerine' },
  { n: 6, id: 'city', name: 'The Big Tidy', place: 'The Whole City', start: 75, target: 400, time: 600, packs: ['L4', 'L5', 'L6'], cell: 100, theme: 'city', color: 'grape' },
];

export function levelByIndex(i) {
  return LEVELS[i];
}
