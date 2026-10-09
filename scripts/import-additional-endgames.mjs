// Import a pinned source file; publish only after every selected objective verifies.
// Usage: node scripts/import-additional-endgames.mjs /path/to/endgamedatabase.json
import { readFile, writeFile, rename } from 'node:fs/promises';
import { createHash } from 'node:crypto';
import { Chess } from 'chess.js';
import { setTimeout as delay } from 'node:timers/promises';

const revision = '0ff395ac711f54969fd2009d9b3df416a0eae936';
const sourceUrl = `https://github.com/supertorpe/chessendgametraining/blob/${revision}/code/src/static/endgamedatabase.json`;
if (!process.argv[2]) throw new Error('Usage: node scripts/import-additional-endgames.mjs /path/to/endgamedatabase.json');
const bytes = await readFile(process.argv[2]);
const sourceSha256 = createHash('sha256').update(bytes).digest('hex');
if (sourceSha256 !== '99fb7d70ee04b0006b15fa8a07e8e982020a4fbe24af44e6356d2b53942800d7') throw new Error('Source file does not match the pinned revision.');
const source = JSON.parse(bytes);

const batches = [
  { category: 'Basic', name: 'Queen', topic: 'Basic checkmates', hint: 'Restrict the king, bring your own king closer, and leave legal moves until the final check.', count: 4 },
  { category: 'Basic', name: 'Rook', topic: 'Basic checkmates', hint: 'Cut off the king and coordinate your king with the rook.', count: 4 },
  { category: 'Basic', name: 'Two Rooks', topic: 'Basic checkmates', hint: 'Use alternating rook checks to reduce the available ranks; protect both rooks.', count: 4 },
  { category: 'Pawn', name: 'Two Pawns vs Pawn', topic: 'King and pawn', hint: 'Compare pawn races and use your king to support a breakthrough.', count: 8 },
  { category: 'Rook-Pawn', name: 'Rook vs Pawn', topic: 'Rook', hint: 'Compare promotion threats with your king distance. Use checks to gain time.', count: 8 },
  { category: 'Rook-Pawn', name: 'Rook Pawn vs Rook', topic: 'Rook', hint: 'Activate your king and rook while watching checks from the defending rook.', count: 8 },
  { category: 'Bishop', name: 'Bishop Pawn vs King', topic: 'Bishop', hint: 'Check whether your bishop controls the promotion square before advancing.', count: 3 },
  { category: 'Bishop', name: 'King vs Bishop Pawn', topic: 'Bishop', hint: 'Look for a safe promotion-corner blockade and avoid being driven away.', count: 5 },
  { category: 'Knight', name: 'Knight vs Pawn', topic: 'Knight', hint: 'Calculate knight routes and pawn promotion threats; every tempo matters.', count: 4 },
  { category: 'Knight', name: 'Knight vs Two Pawns', topic: 'Knight', hint: 'Coordinate the king and knight to blockade the pawns before they advance.', count: 4 },
  { category: 'Queen', name: 'Queen vs Pawn', topic: 'Queen', hint: 'Use checks to bring your king closer and check stalemate traps before capturing.', count: 4 },
  { category: 'Queen', name: 'Queen vs Rook', topic: 'Queen', hint: 'Coordinate king and queen to separate the rook from its king; watch checks and stalemate.', count: 4 },
];
const positions = [];
const existing = JSON.parse(await readFile('lib/endgames/data/king-and-pawn.json', 'utf8'));
const originals = ['7k/8/8/8/8/2K5/3Q4/8 w - -', '7k/8/8/8/8/2K5/3R4/8 w - -', '8/3q4/2k5/8/8/8/8/7K b - -', '8/4P1k1/4K3/8/8/8/8/8 w - -', '8/8/8/8/8/4k3/4p1K1/8 b - -', '7k/8/5K1P/8/8/8/8/8 b - -'];
const seen = new Set([...originals, ...existing.map(p => p.fen.split(' ').slice(0, 4).join(' '))]);
for (const batch of batches) {
  const group = source.categories.find(item => item.name === batch.category).subcategories.find(item => item.name === batch.name);
  let count = 0;
  for (const [index, game] of group.games.entries()) {
    if (count >= batch.count) break;
    if (!['checkmate', 'draw'].includes(game.target)) continue;
    const board = new Chess(game.fen);
    const pieces = board.board().flat().filter(Boolean);
    const waitingKing = pieces.find(piece => piece.type === 'k' && piece.color !== board.turn());
    if (!waitingKing || board.isAttacked(waitingKing.square, board.turn()) || board.isGameOver() || pieces.length > 7) throw new Error(`Invalid source setup: ${batch.name} ${index + 1}`);
    const key = board.fen().split(' ').slice(0, 4).join(' ');
    if (seen.has(key)) continue;

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
    if (evidence.category !== expected) { console.log(`Skipped objective mismatch: ${batch.name} ${index + 1}: ${evidence.category}`); continue; }
    const objective = game.target === 'draw' ? 'draw' : 'mate';
    const id = `cet-${batch.category.toLowerCase()}-${batch.name.toLowerCase().replaceAll(' ', '-')}-${String(index + 1).padStart(3, '0')}`;
    positions.push({
      id, title: `${batch.name} · ${index + 1}`, topic: batch.topic, subtopic: batch.name,
      fen: board.fen(), color: board.turn() === 'w' ? 'WHITE' : 'BLACK', objective,
      description: objective === 'draw' ? 'Hold a draw against Stockfish. Play until the game ends in a draw.' : 'Convert this winning endgame and finish with checkmate.',
      hint: batch.hint,
      source: { name: 'Chess Endgame Training', url: sourceUrl, revision, category: batch.category, group: batch.name, position: index + 1, target: game.target, license: 'GPL-3.0', upstreamDatabase: 'https://ecochessopeningcodes.blogspot.com/' },
      validation: { service: 'Lichess Syzygy', checkedAt: new Date().toISOString(), category: evidence.category, dtz: evidence.dtz, dtm: evidence.dtm, fen: board.fen() },
    });
    count++;
    seen.add(key);
    console.log(`Verified ${positions.length}/60: ${id} (${evidence.category})`);
    await delay(200);
  }
  if (count !== batch.count) throw new Error(`Incomplete batch ${batch.name}`);
}
if (positions.length !== 60) throw new Error('Incomplete import');
const output = 'lib/endgames/data/additional-endgames.json';
await writeFile(output + '.tmp', JSON.stringify(positions, null, 2) + '\n');
await rename(output + '.tmp', output);
await writeFile('docs/imports/additional-endgames-evidence.json', JSON.stringify({ revision, sourceUrl, sourceSha256, count: positions.length, wins: positions.filter(p => p.objective === 'mate').length, draws: positions.filter(p => p.objective === 'draw').length, positions: positions.map(p => ({ id: p.id, source: p.source, validation: p.validation })) }, null, 2) + '\n');
console.log('Published 60 verified positions.');
