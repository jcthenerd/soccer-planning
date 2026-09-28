'use strict';

// Renders a single game's roster/quarters into a printable "Team Line Up
// Report" PDF, modeled on the standard AYSO team line-up form: a boxed
// header (region/division/team/coach fields), a dotted-grid jersey#/name/
// goals/quarters-played roster table, and a game-result footer. No league
// logo is reproduced - the box is left blank for a team to add their own
// region's artwork if they want one.

const PDFDocument = require('pdfkit');

const PAGE_MARGIN = 36;
const LOGO_BOX_SIZE = 46;
const DOTTED = [1, 1.5];

function formatDate(dateStr) {
  if (!dateStr) return '';
  const d = new Date(`${dateStr}T00:00:00`);
  if (Number.isNaN(d.getTime())) return dateStr;
  return d.toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' });
}

// The form marks each quarter with the first letter of the position played
// (G for Goalkeeper, D for Defender, etc.) rather than a generic checkmark.
function positionLetter(name) {
  if (!name) return '';
  return name.trim().charAt(0).toUpperCase();
}

// A game dated after today hasn't been played yet, so recorded goals (still
// at their default of 0) aren't real data - print blanks for the goalkeeper
// to fill in rather than a misleading row of zeros.
function isFutureGame(dateStr) {
  if (!dateStr) return false;
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const gameDate = new Date(`${dateStr}T00:00:00`);
  return !Number.isNaN(gameDate.getTime()) && gameDate.getTime() > today.getTime();
}

function buildRoster(game) {
  return [...game.attendance]
    .sort((a, b) => {
      if (a.jersey_number == null && b.jersey_number == null) return a.name.localeCompare(b.name);
      if (a.jersey_number == null) return 1;
      if (b.jersey_number == null) return -1;
      return a.jersey_number - b.jersey_number;
    })
    .map((player) => {
      const quarterMarks = {};
      for (const q of game.quarters) {
        const assignment = game.assignments.find(
          (a) => a.quarter_id === q.id && a.player_id === player.player_id
        );
        if (assignment && assignment.position_id != null) {
          quarterMarks[q.quarter_number] = positionLetter(assignment.position_name);
        }
      }
      return { ...player, quarterMarks };
    });
}

function computeResult(game) {
  if (game.opponent_goals == null) return null;
  const ourGoals = game.attendance.reduce((sum, a) => sum + (a.goals || 0), 0);
  if (ourGoals > game.opponent_goals) return { ourGoals, outcome: 'win' };
  if (ourGoals < game.opponent_goals) return { ourGoals, outcome: 'loss' };
  return { ourGoals, outcome: 'tie' };
}

// Draws "Label ___underline___" with an optional value sitting on the line.
function formField(doc, x, y, label, value, width) {
  doc.font('Helvetica-Bold').fontSize(9).text(label, x, y, { continued: false, lineBreak: false });
  const labelWidth = doc.widthOfString(label) + 4;
  const lineY = y + 11;
  doc.undash().lineWidth(0.75).moveTo(x + labelWidth, lineY).lineTo(x + width, lineY).stroke();
  if (value) {
    doc.font('Helvetica').fontSize(9).text(value, x + labelWidth + 2, y, {
      width: width - labelWidth - 6,
      lineBreak: false,
    });
  }
}

// Coach-defined trackers (Passing, Assists, moving into open space, ...) get
// one narrow blank column per player - ticked by hand during the game, then
// used afterward to inform that player's journal entry. Column width shrinks
// as more trackers are added, floored so a tick mark still fits.
const TRACKER_COL_MIN = 32;
const COACH_NOTES_LINES = 4;
const COACH_NOTES_LINE_GAP = 18;

function buildLineupPdf({ teamSettings, game, trackers = [] }) {
  const doc = new PDFDocument({ size: 'letter', margin: PAGE_MARGIN });
  const pageWidth = doc.page.width - PAGE_MARGIN * 2;
  const numQuarters = game.num_quarters || 4;
  const roster = buildRoster(game);
  const showGoals = !isFutureGame(game.date);
  const result = computeResult(game);

  // 'separate_page' moves the tracker columns and Coach Notes off the main
  // roster page and onto a page of their own - useful when a team has enough
  // trackers that they'd otherwise crowd the player-name column. 'inline'
  // (the default) keeps trackers as extra columns in the main grid.
  const trackersOnOwnPage = teamSettings.tracker_layout === 'separate_page';
  const inlineTrackers = trackersOnOwnPage ? [] : trackers;

  // --- Header: boxed logo + title, region/division heading, label/value grid ---
  const headerTop = PAGE_MARGIN;
  const innerX = PAGE_MARGIN + 10;
  const innerWidth = pageWidth - 20;

  doc.lineWidth(0.75).rect(innerX - 4, headerTop + 8, LOGO_BOX_SIZE, LOGO_BOX_SIZE).stroke();
  doc.font('Helvetica-Bold').fontSize(17).text(
    'Team Line Up Report',
    innerX,
    headerTop + 14,
    { width: innerWidth, align: 'center' }
  );

  let y = headerTop + LOGO_BOX_SIZE + 18;

  doc.font('Helvetica-Bold').fontSize(11).text(`Region ${teamSettings.region || ''}`, innerX, y);
  y += 14;
  doc.font('Helvetica').fontSize(10).text(teamSettings.division || '', innerX, y);
  y += 16;

  const labelColW = 90;
  const gridRows = [
    ['Team Name', teamSettings.team_name],
    ['Team Colors', teamSettings.team_colors],
    ['Team Coach', teamSettings.coach_name],
    ['Ass. Coach', teamSettings.assistant_coach_name],
    ['Opponent', game.opponent],
  ];
  for (const [label, value] of gridRows) {
    doc.font('Helvetica-Bold').fontSize(9).text(label, innerX, y, { width: labelColW });
    doc.font('Helvetica').fontSize(9).text(value || '', innerX + labelColW, y, { width: innerWidth - labelColW });
    doc.dash(...DOTTED).lineWidth(0.5)
      .moveTo(innerX + labelColW, y + 12).lineTo(innerX + innerWidth, y + 12).stroke();
    y += 16;
  }
  doc.undash();

  const headerBottom = y + 6;
  doc.lineWidth(0.75).rect(PAGE_MARGIN, headerTop, pageWidth, headerBottom - headerTop).stroke();

  y = headerBottom + 14;

  // --- Roster table ---
  const jerseyW = 55;
  const goalsW = 45;
  const qtrTotalW = Math.min(180, pageWidth * 0.3);
  const qtrW = qtrTotalW / numQuarters;
  const trackersTotalW = inlineTrackers.length
    ? Math.max(inlineTrackers.length * TRACKER_COL_MIN, Math.min(inlineTrackers.length * 55, pageWidth * 0.3))
    : 0;
  const trackerColW = inlineTrackers.length ? trackersTotalW / inlineTrackers.length : 0;
  const nameW = pageWidth - jerseyW - goalsW - qtrTotalW - trackersTotalW;
  const headerRowH = 16;
  const subHeaderRowH = 14;
  const rowH = 18;
  const tableX = PAGE_MARGIN;

  function drawTableHeader(startY) {
    const totalHeaderH = headerRowH + subHeaderRowH;
    doc.dash(...DOTTED).lineWidth(0.6);
    doc.rect(tableX, startY, jerseyW, totalHeaderH).stroke();
    doc.rect(tableX + jerseyW, startY, nameW, totalHeaderH).stroke();
    doc.rect(tableX + jerseyW + nameW, startY, goalsW, totalHeaderH).stroke();
    doc.rect(tableX + jerseyW + nameW + goalsW, startY, qtrTotalW, headerRowH).stroke();

    doc.font('Helvetica-Bold').fontSize(9);
    doc.text('JERSEY#', tableX, startY + totalHeaderH / 2 - 4, { width: jerseyW, align: 'center' });
    doc.text('PLAYER NAME*', tableX + jerseyW, startY + totalHeaderH / 2 - 4, { width: nameW, align: 'center' });
    doc.text('GOALS', tableX + jerseyW + nameW, startY + totalHeaderH / 2 - 4, { width: goalsW, align: 'center' });
    doc.text('Qtrs. Played', tableX + jerseyW + nameW + goalsW, startY + 3, { width: qtrTotalW, align: 'center' });

    let qx = tableX + jerseyW + nameW + goalsW;
    for (let i = 1; i <= numQuarters; i++) {
      doc.dash(...DOTTED).lineWidth(0.6).rect(qx, startY + headerRowH, qtrW, subHeaderRowH).stroke();
      doc.text(String(i), qx, startY + headerRowH + 2, { width: qtrW, align: 'center' });
      qx += qtrW;
    }

    let tx = tableX + jerseyW + nameW + goalsW + qtrTotalW;
    doc.font('Helvetica-Bold').fontSize(6.5);
    for (const tracker of inlineTrackers) {
      doc.dash(...DOTTED).lineWidth(0.6).rect(tx, startY, trackerColW, totalHeaderH).stroke();
      doc.text(tracker.name, tx + 2, startY + 3, { width: trackerColW - 4, align: 'center' });
      tx += trackerColW;
    }

    doc.undash();
    return startY + totalHeaderH;
  }

  y = drawTableHeader(y);

  // Room below the table for the footnotes and the date/score/result fields -
  // plus the Coach Notes lines too, unless those moved to their own page.
  const footerReserve = 210 + (trackersOnOwnPage ? 0 : COACH_NOTES_LINES * COACH_NOTES_LINE_GAP);
  doc.font('Helvetica').fontSize(9);
  for (const player of roster) {
    if (y + rowH > doc.page.height - PAGE_MARGIN - footerReserve) {
      doc.addPage();
      y = drawTableHeader(PAGE_MARGIN);
    }

    doc.dash(...DOTTED).lineWidth(0.6);
    doc.rect(tableX, y, jerseyW, rowH).stroke();
    doc.rect(tableX + jerseyW, y, nameW, rowH).stroke();
    doc.rect(tableX + jerseyW + nameW, y, goalsW, rowH).stroke();

    doc.font('Helvetica').fontSize(9);
    doc.text(player.jersey_number != null ? String(player.jersey_number) : '', tableX, y + 4, {
      width: jerseyW,
      align: 'center',
    });
    doc.text(player.name, tableX + jerseyW + 4, y + 4, { width: nameW - 8, lineBreak: false });
    doc.text(showGoals ? String(player.goals ?? 0) : '', tableX + jerseyW + nameW, y + 4, { width: goalsW, align: 'center' });

    let qx = tableX + jerseyW + nameW + goalsW;
    for (let i = 1; i <= numQuarters; i++) {
      doc.dash(...DOTTED).lineWidth(0.6).rect(qx, y, qtrW, rowH).stroke();
      const mark = player.quarterMarks[i];
      // Left-aligned rather than centered - leaves blank space to the right
      // for the coach to cross out and write a substitution during the game.
      if (mark) doc.font('Helvetica-Bold').text(mark, qx + 3, y + 4, { width: qtrW - 3, lineBreak: false });
      qx += qtrW;
    }

    let tx = tableX + jerseyW + nameW + goalsW + qtrTotalW;
    for (const tracker of inlineTrackers) {
      // Left blank (no letter/number) - the coach ticks it by hand during the game.
      doc.dash(...DOTTED).lineWidth(0.6).rect(tx, y, trackerColW, rowH).stroke();
      tx += trackerColW;
    }

    y += rowH;
  }
  doc.undash();

  y += 10;
  doc.font('Helvetica').fontSize(7.5).text(
    '* Indicates the position played that quarter (first letter of the position name, e.g. G = Goalkeeper).',
    tableX,
    y,
    { width: pageWidth }
  );
  y += 10;
  doc.text('All players on roster must be listed; indicate reason for absence.', tableX, y, { width: pageWidth });
  if (inlineTrackers.length) {
    y += 10;
    doc.text('Tick the tracker columns as you see them during the game; use the marks afterward for each player’s journal entry.', tableX, y, { width: pageWidth });
  }

  y += 20;

  // --- Footer: date/time/field, score, result ---
  const halfW = pageWidth / 2 - 8;
  const thirdW = pageWidth / 3 - 8;

  formField(doc, PAGE_MARGIN, y, 'Date', formatDate(game.date), thirdW);
  formField(doc, PAGE_MARGIN + thirdW + 12, y, 'Time', null, thirdW);
  formField(doc, PAGE_MARGIN + (thirdW + 12) * 2, y, 'Field', null, thirdW);
  y += 26;

  formField(doc, PAGE_MARGIN, y, 'Halftime Score', null, halfW);
  formField(doc, PAGE_MARGIN + halfW + 16, y, 'In Favor Of', null, halfW);
  y += 26;

  const finalScoreValue = result ? `${result.ourGoals} - ${game.opponent_goals}` : null;
  const winningTeam = result && result.outcome !== 'tie'
    ? (result.outcome === 'win' ? (teamSettings.team_name || 'Us') : (game.opponent || 'Opponent'))
    : result && result.outcome === 'tie' ? 'Tie' : null;
  formField(doc, PAGE_MARGIN, y, 'Final Score', finalScoreValue, halfW);
  formField(doc, PAGE_MARGIN + halfW + 16, y, 'Winning Team', winningTeam, halfW);
  y += 26;

  const losingTeam = result && result.outcome !== 'tie'
    ? (result.outcome === 'win' ? (game.opponent || 'Opponent') : (teamSettings.team_name || 'Us'))
    : result && result.outcome === 'tie' ? 'Tie' : null;
  doc.font('Helvetica').fontSize(9).text('Referee must sign reverse side.', PAGE_MARGIN, y, {
    width: halfW,
    lineBreak: false,
  });
  formField(doc, PAGE_MARGIN + halfW + 16, y, 'Losing Team', losingTeam, halfW);
  y += 26;

  // --- Coach Notes: blank ruled lines for freeform post-game writeup ---
  function drawCoachNotes(startY) {
    let ny = startY;
    doc.font('Helvetica-Bold').fontSize(10).text('Coach Notes', PAGE_MARGIN, ny, { width: pageWidth });
    ny += 16;
    doc.dash(...DOTTED).lineWidth(0.5);
    for (let i = 0; i < COACH_NOTES_LINES; i++) {
      doc.moveTo(PAGE_MARGIN, ny).lineTo(PAGE_MARGIN + pageWidth, ny).stroke();
      ny += COACH_NOTES_LINE_GAP;
    }
    doc.undash();
    return ny;
  }

  if (!trackersOnOwnPage) {
    drawCoachNotes(y);
    return doc;
  }

  // --- Trackers & Coach Notes page: everything the coach fills in by hand
  // during/after the game, kept off the main roster grid so its columns
  // (and the player-name column) stay full width. ---
  doc.addPage();
  let ty = PAGE_MARGIN;

  if (trackers.length) {
    doc.font('Helvetica-Bold').fontSize(14).text('Player Trackers', PAGE_MARGIN, ty, { width: pageWidth });
    ty += 20;
    const context = [teamSettings.team_name, game.opponent && `vs ${game.opponent}`, formatDate(game.date)]
      .filter(Boolean).join(' — ');
    if (context) {
      doc.font('Helvetica').fontSize(9).text(context, PAGE_MARGIN, ty, { width: pageWidth });
      ty += 16;
    }

    const tJerseyW = 55;
    const tTrackersTotalW = Math.min(trackers.length * 100, pageWidth * 0.6);
    const tTrackerColW = tTrackersTotalW / trackers.length;
    const tNameW = pageWidth - tJerseyW - tTrackersTotalW;
    const tHeaderH = 26;
    const tRowH = 22;

    function drawTrackerHeader(startY) {
      doc.dash(...DOTTED).lineWidth(0.6);
      doc.rect(PAGE_MARGIN, startY, tJerseyW, tHeaderH).stroke();
      doc.rect(PAGE_MARGIN + tJerseyW, startY, tNameW, tHeaderH).stroke();
      doc.font('Helvetica-Bold').fontSize(9);
      doc.text('JERSEY#', PAGE_MARGIN, startY + tHeaderH / 2 - 4, { width: tJerseyW, align: 'center' });
      doc.text('PLAYER NAME', PAGE_MARGIN + tJerseyW, startY + tHeaderH / 2 - 4, { width: tNameW, align: 'center' });
      let tx = PAGE_MARGIN + tJerseyW + tNameW;
      doc.fontSize(8);
      for (const tracker of trackers) {
        doc.dash(...DOTTED).lineWidth(0.6).rect(tx, startY, tTrackerColW, tHeaderH).stroke();
        doc.text(tracker.name, tx + 3, startY + tHeaderH / 2 - 4, { width: tTrackerColW - 6, align: 'center' });
        tx += tTrackerColW;
      }
      doc.undash();
      return startY + tHeaderH;
    }

    ty = drawTrackerHeader(ty);

    const notesReserve = 20 + COACH_NOTES_LINES * COACH_NOTES_LINE_GAP;
    doc.font('Helvetica').fontSize(9);
    for (const player of roster) {
      if (ty + tRowH > doc.page.height - PAGE_MARGIN - notesReserve) {
        doc.addPage();
        ty = drawTrackerHeader(PAGE_MARGIN);
      }

      doc.dash(...DOTTED).lineWidth(0.6);
      doc.rect(PAGE_MARGIN, ty, tJerseyW, tRowH).stroke();
      doc.rect(PAGE_MARGIN + tJerseyW, ty, tNameW, tRowH).stroke();
      doc.font('Helvetica').fontSize(9);
      doc.text(player.jersey_number != null ? String(player.jersey_number) : '', PAGE_MARGIN, ty + 5, {
        width: tJerseyW,
        align: 'center',
      });
      doc.text(player.name, PAGE_MARGIN + tJerseyW + 4, ty + 5, { width: tNameW - 8, lineBreak: false });

      let tx = PAGE_MARGIN + tJerseyW + tNameW;
      for (const tracker of trackers) {
        // Left blank - the coach ticks it by hand during the game.
        doc.dash(...DOTTED).lineWidth(0.6).rect(tx, ty, tTrackerColW, tRowH).stroke();
        tx += tTrackerColW;
      }

      ty += tRowH;
    }
    doc.undash();

    ty += 10;
    doc.font('Helvetica').fontSize(7.5).text(
      'Tick a tracker cell as you see it during the game; use the marks afterward for each player’s journal entry.',
      PAGE_MARGIN,
      ty,
      { width: pageWidth }
    );
    ty += 20;
  }

  drawCoachNotes(ty);

  return doc;
}

module.exports = { buildLineupPdf };
