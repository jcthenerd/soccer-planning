'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const { parseAysoTeamDirectory, decodeRtfText } = require('./rosterImport');

const SAMPLE_RTF = String.raw`{\rtf1\ansicpg1252{\colortbl;\red255\green255\blue255;\red68\green68\blue68;\red242\green242\blue242;\red0\green0\blue0;\red176\green196\blue222;}{\fonttbl{\f0Calibri ;}{\f1Verdana ;}}\sectd\paperw16837\paperh11905\margl720\margr720\margt720\margb436\pgbrdropt40\pgbrdrt\pgbrdrb\pgbrdrl\pgbrdrr{\pard\posx0\posy0\absw15397\absh-8992\frmtxlrtb\cbpat1\ql\par}{\pard\posx0\posy634\absw15120\absh-2448\frmtxlrtb\cbpat1\ql\par}{\pard\posx0\posy634\absw15120\absh-288\frmtxlrtb\cbpat2\ql\par}{\pard\posx0\posy922\absw15120\absh-720\frmtxlrtb\cbpat3\ql\par}{\pard\posx0\posy1642\absw15120\absh-720\frmtxlrtb\cbpat3\ql\par}{\pard\posx0\posy2362\absw15120\absh-720\frmtxlrtb\cbpat3\ql\par}{\pard\posx0\posy3376\absw15397\absh-5616\frmtxlrtb\cbpat1\ql\par}{\pard\posx0\posy3376\absw15397\absh-576\frmtxlrtb\cbpat2\ql\par}{\pard\posx0\posy3376\absw1296\absh-390\frmtxlrtb\ql{\plain\f0\fs16\b\cf1 Player Name}\par}{\pard\posx0\posy3952\absw15397\absh-719\frmtxlrtb\cbpat3\ql\par}{\pard\posx0\posy3952\absw1296\absh-585\frmtxlrtb\ql{\plain\f0\fs16\cf4 Alex Sample}\par}{\pard\posx0\posy4672\absw15397\absh-719\frmtxlrtb\cbpat3\ql\par}{\pard\posx0\posy4672\absw1296\absh-585\frmtxlrtb\ql{\plain\f0\fs16\cf4 Bailey Example}\par}{\pard\posx0\posy5392\absw15397\absh-719\frmtxlrtb\cbpat3\ql\par}{\pard\posx0\posy5392\absw1296\absh-585\frmtxlrtb\ql{\plain\f0\fs16\cf4 Casey Placeholder}\par}{\pard\posx0\posy6112\absw15397\absh-719\frmtxlrtb\cbpat3\ql\par}{\pard\posx0\posy6112\absw1296\absh-585\frmtxlrtb\ql{\plain\f0\fs16\cf4 Drew Testerson}\par}{\pard\posx0\posy6832\absw15397\absh-720\frmtxlrtb\cbpat3\ql\par}{\pard\posx0\posy6832\absw1296\absh-585\frmtxlrtb\ql{\plain\f0\fs16\cf4 Emerson Fixture}\par}{\pard\posx0\posy7552\absw15397\absh-719\frmtxlrtb\cbpat3\ql\par}{\pard\posx0\posy7552\absw1296\absh-585\frmtxlrtb\ql{\plain\f0\fs16\cf4 Frankie Mockdata}\par}{\pard\posx0\posy8272\absw15397\absh-719\frmtxlrtb\cbpat3\ql\par}{\pard\posx0\posy8272\absw1296\absh-585\frmtxlrtb\ql{\plain\f0\fs16\cf4 Gray Dummyname}\par}{\pard\posx1584\posy0\absw5760\absh-341\frmtxlrtb\ql{\plain\f0\fs28\cf4 99U-T99 (Testteam)}\par}{\pard\posx0\posy0\absw1584\absh-341\frmtxlrtb\ql{\plain\f0\fs28\b\cf4 Team Name}\par}{\pard\posx0\posy3082\absw15120\absh-293\frmtxlrtb\cbpat5\ql\par}{\pard\posx0\posy3082\absw1320\absh-349\frmtxlrtb\ql{\plain\f0\fs24\b\cf4 Team Roster}\par}{\pard\posx0\posy341\absw15120\absh-293\frmtxlrtb\cbpat5\ql\par}{\pard\posx0\posy341\absw15120\absh-292\frmtxlrtb\ql{\plain\f0\fs24\b\cf4 Team Staff}\par}{\pard\posx11456\posy10252\absw3663\absh-194\frmtxlrtb\qr{\plain\f1\fs16\cf4 1 of 1}\par}\sect}`;

test('parseAysoTeamDirectory extracts the team name and roster player names in report order', () => {
  const result = parseAysoTeamDirectory(SAMPLE_RTF);
  assert.equal(result.teamName, '99U-T99 (Testteam)');
  assert.deepEqual(result.players, [
    'Alex Sample',
    'Bailey Example',
    'Casey Placeholder',
    'Drew Testerson',
    'Emerson Fixture',
    'Frankie Mockdata',
    'Gray Dummyname',
  ]);
});

test('parseAysoTeamDirectory excludes the header row and the page-footer run', () => {
  const result = parseAysoTeamDirectory(SAMPLE_RTF);
  assert.ok(!result.players.includes('Player Name'));
  assert.ok(!result.players.includes('1 of 1'));
});

test('parseAysoTeamDirectory rejects text that is not RTF', () => {
  assert.throws(() => parseAysoTeamDirectory('not rtf at all'), /does not look like an RTF document/);
});

test('parseAysoTeamDirectory returns no players when the roster section is empty', () => {
  const result = parseAysoTeamDirectory('{\\rtf1 no roster rows here}');
  assert.deepEqual(result.players, []);
});

test('decodeRtfText unescapes hex byte codes and braces', () => {
  assert.equal(decodeRtfText('Jos\\\'e9 Cruz'), 'José Cruz');
  assert.equal(decodeRtfText('O\\{Brien\\}'), 'O{Brien}');
});
