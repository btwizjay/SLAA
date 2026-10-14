// Mirror of db/seed_reference.sql for building dropdowns without a DB round
// trip. tests/reference.test.ts fails if the two drift apart.

export const DISTRICTS = [
  "Ampara", "Anuradhapura", "Badulla", "Batticaloa", "Colombo", "Galle",
  "Gampaha", "Hambantota", "Jaffna", "Kalutara", "Kandy", "Kegalle",
  "Kilinochchi", "Kurunegala", "Mannar", "Matale", "Matara", "Monaragala",
  "Mullaitivu", "Nuwara Eliya", "Polonnaruwa", "Puttalam", "Ratnapura",
  "Trincomalee", "Vavuniya",
] as const;

export type District = (typeof DISTRICTS)[number];

export const EVENTS: { code: string; name: string; category: string }[] = [
  { code: "100m", name: "100 metres", category: "Sprints" },
  { code: "200m", name: "200 metres", category: "Sprints" },
  { code: "400m", name: "400 metres", category: "Sprints" },
  { code: "800m", name: "800 metres", category: "Middle distance" },
  { code: "1500m", name: "1500 metres", category: "Middle distance" },
  { code: "3000m", name: "3000 metres", category: "Long distance" },
  { code: "5000m", name: "5000 metres", category: "Long distance" },
  { code: "10000m", name: "10,000 metres", category: "Long distance" },
  { code: "100mH", name: "100 metres hurdles", category: "Hurdles" },
  { code: "110mH", name: "110 metres hurdles", category: "Hurdles" },
  { code: "400mH", name: "400 metres hurdles", category: "Hurdles" },
  { code: "3000mSC", name: "3000 metres steeplechase", category: "Hurdles" },
  { code: "HJ", name: "High jump", category: "Jumps" },
  { code: "PV", name: "Pole vault", category: "Jumps" },
  { code: "LJ", name: "Long jump", category: "Jumps" },
  { code: "TJ", name: "Triple jump", category: "Jumps" },
  { code: "SP", name: "Shot put", category: "Throws" },
  { code: "DT", name: "Discus throw", category: "Throws" },
  { code: "HT", name: "Hammer throw", category: "Throws" },
  { code: "JT", name: "Javelin throw", category: "Throws" },
  { code: "4x100m", name: "4 x 100 metres relay", category: "Relays" },
  { code: "4x400m", name: "4 x 400 metres relay", category: "Relays" },
  { code: "HEP", name: "Heptathlon", category: "Combined events" },
  { code: "DEC", name: "Decathlon", category: "Combined events" },
  { code: "RW", name: "Race walk", category: "Race walk" },
];

export const EVENT_CODES = EVENTS.map((e) => e.code);
