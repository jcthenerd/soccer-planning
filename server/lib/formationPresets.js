'use strict';

// Pure data: no DB access here, so this can be shared by the /api/setup
// route (which applies a preset) and reused verbatim by the frontend
// catalog response. drop_priority follows the same convention as
// db.js's default seed: lower number = dropped first when short-handed,
// null = never dropped (goalkeeper).
const AGE_GROUP_PRESETS = [
  {
    key: 'U8',
    label: 'U8',
    formatLabel: '5v5',
    formations: [
      {
        key: 'u8-1-3-1',
        name: 'U8: 1 Defender, 3 Midfielders, 1 Forward',
        description: '5v5 - 1 Defender, 3 Midfielders, 1 Forward',
        slots: [
          { position: 'Defender', count: 1, drop_priority: 3 },
          { position: 'Midfielder', count: 3, drop_priority: 2 },
          { position: 'Forward', count: 1, drop_priority: 1 },
        ],
      },
      {
        key: 'u8-2-2-1',
        name: 'U8: 2 Defenders, 2 Midfielders, 1 Forward',
        description: '5v5 - 2 Defenders, 2 Midfielders, 1 Forward',
        slots: [
          { position: 'Defender', count: 2, drop_priority: 3 },
          { position: 'Midfielder', count: 2, drop_priority: 2 },
          { position: 'Forward', count: 1, drop_priority: 1 },
        ],
      },
    ],
  },
  {
    key: 'U10',
    label: 'U10',
    formatLabel: '7v7',
    formations: [
      {
        key: 'u10-1-2-2-2',
        name: 'U10: 1 GK, 2 Defenders, 2 Midfielders, 2 Forwards',
        description: '7v7 - 1 Goalkeeper, 2 Defenders, 2 Midfielders, 2 Forwards',
        slots: [
          { position: 'Goalkeeper', count: 1, drop_priority: null },
          { position: 'Defender', count: 2, drop_priority: 3 },
          { position: 'Midfielder', count: 2, drop_priority: 2 },
          { position: 'Forward', count: 2, drop_priority: 1 },
        ],
      },
      {
        key: 'u10-1-2-3-1',
        name: 'U10: 1 GK, 2 Defenders, 3 Midfielders, 1 Forward',
        description: '7v7 - 1 Goalkeeper, 2 Defenders, 3 Midfielders, 1 Forward',
        slots: [
          { position: 'Goalkeeper', count: 1, drop_priority: null },
          { position: 'Defender', count: 2, drop_priority: 3 },
          { position: 'Midfielder', count: 3, drop_priority: 2 },
          { position: 'Forward', count: 1, drop_priority: 1 },
        ],
      },
    ],
  },
  {
    key: 'U12',
    label: 'U12',
    formatLabel: '9v9',
    formations: [
      {
        key: 'u12-1-3-3-2',
        name: 'U12: 1 GK, 3 Defenders, 3 Midfielders, 2 Forwards',
        description: '9v9 - 1 Goalkeeper, 3 Defenders, 3 Midfielders, 2 Forwards',
        slots: [
          { position: 'Goalkeeper', count: 1, drop_priority: null },
          { position: 'Defender', count: 3, drop_priority: 3 },
          { position: 'Midfielder', count: 3, drop_priority: 2 },
          { position: 'Forward', count: 2, drop_priority: 1 },
        ],
      },
      {
        key: 'u12-1-2-4-2',
        name: 'U12: 1 GK, 2 Defenders, 4 Midfielders, 2 Forwards',
        description: '9v9 - 1 Goalkeeper, 2 Defenders, 4 Midfielders, 2 Forwards',
        slots: [
          { position: 'Goalkeeper', count: 1, drop_priority: null },
          { position: 'Defender', count: 2, drop_priority: 3 },
          { position: 'Midfielder', count: 4, drop_priority: 2 },
          { position: 'Forward', count: 2, drop_priority: 1 },
        ],
      },
    ],
  },
  {
    key: 'U15',
    label: 'U15',
    formatLabel: '11v11',
    formations: [
      {
        key: 'u15-1-4-4-2',
        name: 'U15: 1 GK, 4 Defenders, 4 Midfielders, 2 Forwards',
        description: '11v11 - 1 Goalkeeper, 4 Defenders, 4 Midfielders, 2 Forwards',
        slots: [
          { position: 'Goalkeeper', count: 1, drop_priority: null },
          { position: 'Defender', count: 4, drop_priority: 3 },
          { position: 'Midfielder', count: 4, drop_priority: 2 },
          { position: 'Forward', count: 2, drop_priority: 1 },
        ],
      },
      {
        key: 'u15-1-4-3-3',
        name: 'U15: 1 GK, 4 Defenders, 3 Midfielders, 3 Forwards',
        description: '11v11 - 1 Goalkeeper, 4 Defenders, 3 Midfielders, 3 Forwards',
        slots: [
          { position: 'Goalkeeper', count: 1, drop_priority: null },
          { position: 'Defender', count: 4, drop_priority: 3 },
          { position: 'Midfielder', count: 3, drop_priority: 2 },
          { position: 'Forward', count: 3, drop_priority: 1 },
        ],
      },
    ],
  },
];

// Standard position set covering every preset above, in a sensible
// pitch-order sort. Created (as needed) whenever a preset is applied, and
// also on its own for coaches who'd rather build formations by hand.
const STANDARD_POSITIONS = [
  { name: 'Goalkeeper', sort_order: 0 },
  { name: 'Defender', sort_order: 1 },
  { name: 'Midfielder', sort_order: 2 },
  { name: 'Forward', sort_order: 3 },
];

function getAgeGroup(key) {
  return AGE_GROUP_PRESETS.find((g) => g.key === key);
}

module.exports = { AGE_GROUP_PRESETS, STANDARD_POSITIONS, getAgeGroup };
