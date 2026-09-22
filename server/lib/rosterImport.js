'use strict';

// Windows-1252 code points in the 0x80-0x9F range that differ from Latin-1
// (RTF \'xx escapes are Windows-1252 bytes, not raw Unicode code points).
const CP1252_HIGH = {
  0x80: 0x20ac, 0x82: 0x201a, 0x83: 0x0192, 0x84: 0x201e, 0x85: 0x2026,
  0x86: 0x2020, 0x87: 0x2021, 0x88: 0x02c6, 0x89: 0x2030, 0x8a: 0x0160,
  0x8b: 0x2039, 0x8c: 0x0152, 0x8e: 0x017d, 0x91: 0x2018, 0x92: 0x2019,
  0x93: 0x201c, 0x94: 0x201d, 0x95: 0x2022, 0x96: 0x2013, 0x97: 0x2014,
  0x98: 0x02dc, 0x99: 0x2122, 0x9a: 0x0161, 0x9b: 0x203a, 0x9c: 0x0153,
  0x9e: 0x017e, 0x9f: 0x0178,
};

function decodeRtfText(raw) {
  return raw
    .replace(/\\'([0-9a-fA-F]{2})/g, (_, hex) => {
      const code = parseInt(hex, 16);
      return String.fromCharCode(CP1252_HIGH[code] || code);
    })
    .replace(/\\{/g, '{')
    .replace(/\\}/g, '}')
    .replace(/\\\\/g, '\\')
    .replace(/\s+/g, ' ')
    .trim();
}

// Parses an AYSO "Team Directory" report saved as .rtf. That report lays
// each roster row out as its own absolutely-positioned text frame rather
// than a real RTF table, so there's no table structure to walk - instead we
// match the specific run style AYSO uses for roster name cells
// (\plain\f0\fs16\cf<n>, no \b) which only that column uses; the "Player
// Name" header run adds \b and the page-footer run uses \f1, so both are
// excluded for free. The report has no jersey number, position, or other
// player fields beyond the name.
function parseAysoTeamDirectory(rtfText) {
  if (typeof rtfText !== 'string' || !rtfText.includes('\\rtf1')) {
    throw new Error('That file does not look like an RTF document.');
  }

  const teamNameMatch = rtfText.match(/\{\\plain\\f0\\fs28\\cf\d\s+([^}]*)\}\\par/);
  const teamName = teamNameMatch ? decodeRtfText(teamNameMatch[1]) : null;

  const playerRowRe = /\{\\plain\\f0\\fs16\\cf\d\s+([^}]*)\}\\par/g;
  const players = [];
  let match;
  while ((match = playerRowRe.exec(rtfText))) {
    const name = decodeRtfText(match[1]);
    if (name) players.push(name);
  }

  return { teamName, players };
}

module.exports = { parseAysoTeamDirectory, decodeRtfText };
