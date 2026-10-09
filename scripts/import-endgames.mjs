// Import a pinned source file; publish only after every selected objective verifies.
// Usage: node scripts/import-endgames.mjs /path/to/endgamedatabase.json
import { readFile, writeFile, rename } from 'node:fs/promises';
import { createHash } from 'node:crypto';
import { Chess } from 'chess.js';
import { setTimeout as delay } from 'node:timers/promises';

const revision = '0ff395ac711f54969fd2009d9b3df416a0eae936';
const sourceUrl = `https://github.com/supertorpe/chessendgametraining/blob/${revision}/code/src/static/endgamedatabase.json`;
if (!process.argv[2]) throw new Error('Usage: node scripts/import-endgames.mjs /path/to/endgamedatabase.json');
const bytes = await readFile(process.argv[2]);
const sourceSha256 = createHash('sha256').update(bytes).digest('hex');
if (sourceSha256 !== '99fb7d70ee04b0006b15fa8a07e8e982020a4fbe24af44e6356d2b53942800d7') throw new Error('Source file does not match the pinned revision.');
const source = JSON.parse(bytes);
const pawn = source.categories.find(item => item.name === 'Pawn');
const batches = [
  { name: 'Pawn vs King', slug: 'pawn-vs-king', win: 20, draw: 4 },
  { name: 'Pawn vs Pawn', slug: 'pawn-vs-pawn', win: 10, draw: 6 },
  { name: 'Two Pawns vs King', slug: 'two-pawns-vs-king', win: 9, draw: 1 },
];
const positions = [];
const seen = new Set();
for (const batch of batches) {
  const group = pawn.subcategories.find(item => item.name === batch.name);
  const counts = { checkmate: 0, draw: 0 };
  for (const [index, game] of group.games.entries()) {
    const limit = game.target === 'checkmate' ? batch.win : game.target === 'draw' ? batch.draw : 0;
    if ((counts[game.target] ?? 0) >= limit) continue;
    const board = new Chess(game.fen);
    const pieces = board.board().flat().filter(Boolean);
    const waitingKing = pieces.find(piece => piece.type === 'k' && piece.color !== board.turn());
    if (!waitingKing || board.isAttacked(waitingKing.square, board.turn()) || board.isGameOver() || pieces.some(piece => !['p', 'k'].includes(piece.type))) throw new Error(`Invalid source setup: ${batch.name} ${index + 1}`);
    const key = board.fen().split(' ').slice(0, 4).join(' ');
    if (seen.has(key)) continue;
    seen.add(key);
    const url = 'https://tablebase.lichess.ovh/standard?fen=' + encodeURIComponent(board.fen());
    let response;
    for (let attempt = 0; attempt < 3; attempt++) {
      response = await fetch(url, { signal: AbortSignal.timeout(20000) });
      if (response.ok) break;
      if (response.status !== 429 && response.status < 500) break;
      await delay(2000 * (attempt + 1));
    }
    if (!response.ok) throw new Error(`Tablebase failed: ${response.status}`);
    const evidence = await response.json();
    const expected = game.target === 'draw' ? 'draw' : 'win';
    if (evidence.category !== expected) throw new Error(`Objective mismatch: ${batch.name} ${index + 1}: ${evidence.category}, expected ${expected}`);
    const objective = game.target === 'draw' ? 'draw' : 'mate';
    const id = `cet-${batch.slug}-${String(index + 1).padStart(3, '0')}`;
    positions.push({
      id, title: `${batch.name} · ${index + 1}`, topic: 'King and pawn', subtopic: batch.name,
      fen: board.fen(), color: board.turn() === 'w' ? 'WHITE' : 'BLACK', objective,
      description: objective === 'draw' ? 'Hold a draw against Stockfish. Play until the game ends in a draw.' : 'Convert this winning pawn ending. Promote when appropriate and finish with checkmate.',
      hint: batch.name === 'Pawn vs King' ? 'Compare king distances and use opposition. Check whether the king can reach the pawn or its promotion square.' : batch.name === 'Pawn vs Pawn' ? 'Compare both pawn races before advancing. Look for king activity, captures, and useful waiting moves.' : 'Coordinate your king and pawns. Consider whether one pawn can distract the defending king.',
      source: { name: 'Chess Endgame Training', url: sourceUrl, revision, category: 'Pawn', group: batch.name, position: index + 1, target: game.target, license: 'GPL-3.0', upstreamDatabase: 'https://ecochessopeningcodes.blogspot.com/' },
      validation: { service: 'Lichess Syzygy', checkedAt: new Date().toISOString(), category: evidence.category, dtz: evidence.dtz, dtm: evidence.dtm, fen: board.fen() },
    });
    counts[game.target]++;
    console.log(`Verified ${positions.length}/50: ${id} (${evidence.category})`);
    await delay(200);
  }
  if (counts.checkmate !== batch.win || counts.draw !== batch.draw) throw new Error(`Incomplete batch ${batch.name}`);
}
if (positions.length !== 50) throw new Error('Incomplete import');
const output = 'lib/endgames/data/king-and-pawn.json';
await writeFile(output + '.tmp', JSON.stringify(positions, null, 2) + '\n');
await rename(output + '.tmp', output);
await writeFile('docs/imports/king-and-pawn-evidence.json', JSON.stringify({ revision, sourceUrl, sourceSha256, count: positions.length, wins: positions.filter(p => p.objective === 'mate').length, draws: positions.filter(p => p.objective === 'draw').length, positions: positions.map(p => ({ id: p.id, source: p.source, validation: p.validation })) }, null, 2) + '\n');
console.log('Published 50 verified positions.');
