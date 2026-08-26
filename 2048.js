#!/usr/bin/env node
/**
 * 2048（终端版 / 无图形界面）
 * 纯命令行游戏，4×4 棋盘，方向键 / WASD / HJKL 控制。
 *
 * 运行:  node 2048.js
 * 自检:  node 2048.js --selftest   （不进入游戏，仅验证合并逻辑）
 */
'use strict';

const readline = require('readline');

const SIZE = 4;

// 每个数字的前景色/背景色 (RGB)，经典 2048 配色
const COLORS = {
  2:    [119, 110, 101, 238, 228, 218],
  4:    [119, 110, 101, 237, 224, 200],
  8:    [249, 246, 242, 242, 177, 121],
  16:   [249, 246, 242, 245, 149,  99],
  32:   [249, 246, 242, 246, 124,  95],
  64:   [249, 246, 242, 246,  94,  59],
  128:  [249, 246, 242, 237, 207, 114],
  256:  [249, 246, 242, 237, 204,  97],
  512:  [249, 246, 242, 237, 200,  80],
  1024: [249, 246, 242, 237, 197,  63],
  2048: [249, 246, 242, 237, 194,  46],
};
const EMPTY_BG = [45, 43, 38];

let grid = [];
let score = 0;
let won = false;        // 是否已合成 2048
let continued = false;  // 达成 2048 后是否选择继续
let state = 'play';     // play | won | over

// ---------- 游戏核心 ----------

function emptyCells() {
  const list = [];
  for (let r = 0; r < SIZE; r++)
    for (let c = 0; c < SIZE; c++)
      if (grid[r][c] === 0) list.push([r, c]);
  return list;
}

function spawn() {
  const cells = emptyCells();
  if (cells.length === 0) return;
  const [r, c] = cells[Math.floor(Math.random() * cells.length)];
  grid[r][c] = Math.random() < 0.9 ? 2 : 4;
}

function init() {
  grid = Array.from({ length: SIZE }, () => Array(SIZE).fill(0));
  score = 0;
  won = false;
  continued = false;
  state = 'play';
  spawn();
  spawn();
}

// 把一行往左"压缩 + 合并"（每个方块每次移动最多参与一次合并）
function slideLine(line) {
  const tiles = line.filter(v => v !== 0);
  const out = [];
  let gained = 0;
  for (let i = 0; i < tiles.length; i++) {
    if (i + 1 < tiles.length && tiles[i] === tiles[i + 1]) {
      const merged = tiles[i] * 2;
      out.push(merged);
      gained += merged;
      if (merged === 2048) won = true;
      i++;
    } else {
      out.push(tiles[i]);
    }
  }
  while (out.length < SIZE) out.push(0);
  return { line: out, gained };
}

// 按方向取出四条"线"，统一按"向左滑动"处理
function getLines(dir) {
  const lines = [];
  for (let i = 0; i < SIZE; i++) {
    const line = [];
    for (let j = 0; j < SIZE; j++) {
      const r = dir === 'up' ? j : dir === 'down' ? SIZE - 1 - j : i;
      const c = dir === 'left' ? j : dir === 'right' ? SIZE - 1 - j : i;
      line.push(grid[r][c]);
    }
    lines.push(line);
  }
  return lines;
}

function setLines(dir, lines) {
  for (let i = 0; i < SIZE; i++)
    for (let j = 0; j < SIZE; j++) {
      const r = dir === 'up' ? j : dir === 'down' ? SIZE - 1 - j : i;
      const c = dir === 'left' ? j : dir === 'right' ? SIZE - 1 - j : i;
      grid[r][c] = lines[i][j];
    }
}

// 执行一次移动；棋盘有变化返回 true，否则 false
function move(dir) {
  const lines = getLines(dir);
  let moved = false;
  let gained = 0;
  const newLines = lines.map(line => {
    const { line: nl, gained: g } = slideLine(line);
    if (nl.join(',') !== line.join(',')) moved = true;
    gained += g;
    return nl;
  });
  if (!moved) return false;
  setLines(dir, newLines);
  score += gained;
  return true;
}

// 是否还有可移动/可合并的空间
function hasMove() {
  for (let r = 0; r < SIZE; r++)
    for (let c = 0; c < SIZE; c++) {
      if (grid[r][c] === 0) return true;
      if (c + 1 < SIZE && grid[r][c] === grid[r][c + 1]) return true;
      if (r + 1 < SIZE && grid[r][c] === grid[r + 1][c]) return true;
    }
  return false;
}

function checkState() {
  if (won && !continued) state = 'won';
  else if (!hasMove()) state = 'over';
  else state = 'play';
}

// ---------- 渲染 ----------

function cellStr(v) {
  if (v === 0) return `\x1b[48;2;${EMPTY_BG[0]};${EMPTY_BG[1]};${EMPTY_BG[2]}m       \x1b[0m`;
  const [fr, fg, fb, br, bg, bb] = COLORS[v] || [249, 246, 242, 60, 58, 50];
  const s = String(v).padStart(5).padEnd(7);
  return `\x1b[38;2;${fr};${fg};${fb}m\x1b[48;2;${br};${bg};${bb}m${s}\x1b[0m`;
}

function render() {
  const maxTile = Math.max(...grid.flat());
  const sep = '+-------+-------+-------+-------+';
  let s = '\x1b[2J\x1b[H'; // 清屏 + 光标归位
  s += '\n';
  s += '   \x1b[38;2;237;194;46m=== 2048（终端版）===\x1b[0m\n';
  s += `   得分: \x1b[38;2;255;215;106m${score}\x1b[0m    最高方块: \x1b[38;2;255;215;106m${maxTile}\x1b[0m\n\n`;
  s += '  ' + sep + '\n';
  for (let r = 0; r < SIZE; r++) {
    s += '  |';
    for (let c = 0; c < SIZE; c++) s += cellStr(grid[r][c]) + '|';
    s += '\n  ' + sep + '\n';
  }
  s += '\n';
  if (state === 'won') {
    s += '   \x1b[38;2;0;255;180m🎉 达成 2048！按 C 继续挑战，按 Q 退出\x1b[0m\n\n';
  } else if (state === 'over') {
    s += '   \x1b[38;2;255;90;90m游戏结束：无路可走！按 R 重开，按 Q 退出\x1b[0m\n\n';
  }
  s += '   操作: [W A S D] / [方向键] / [H J K L] 移动\n';
  s += '   [R] 重新开始    [Q] 退出\n';
  process.stdout.write(s);
}

// ---------- 输入 ----------

function cleanup() {
  if (process.stdin.isTTY) process.stdin.setRawMode(false);
  process.stdout.write('\x1b[?25h'); // 恢复光标
}

function bye() {
  cleanup();
  process.stdout.write('感谢游玩，再见！\n');
  process.exit(0);
}

function startGame() {
  process.stdout.write('\x1b[?25l'); // 隐藏光标
  process.stdin.setRawMode(true);
  process.stdin.resume();

  process.stdin.on('keypress', (str, key) => {
    if (key.ctrl && (key.name === 'c' || key.name === 'd')) return bye();

    if (key.name === 'q') return bye();
    if (key.name === 'r') { init(); return render(); }
    if (key.name === 'c' && state === 'won') { continued = true; checkState(); return render(); }

    let dir = null;
    if (key.name === 'w' || key.name === 'k' || key.name === 'up') dir = 'up';
    else if (key.name === 's' || key.name === 'j' || key.name === 'down') dir = 'down';
    else if (key.name === 'a' || key.name === 'h' || key.name === 'left') dir = 'left';
    else if (key.name === 'd' || key.name === 'l' || key.name === 'right') dir = 'right';

    if (dir && state === 'play') {
      if (move(dir)) {
        spawn();
        checkState();
      }
      render();
    }
  });

  init();
  render();
}

// ---------- 自检（无交互） ----------

function runSelfTest() {
  const failures = [];
  const eq = (a, b, msg) => {
    if (JSON.stringify(a) !== JSON.stringify(b))
      failures.push(`${msg} → 期望 ${JSON.stringify(b)}，实际 ${JSON.stringify(a)}`);
  };
  const ok = (cond, msg) => { if (!cond) failures.push(msg); };

  // slideLine 合并规则
  eq(slideLine([2, 2, 0, 0]).line, [4, 0, 0, 0], 'slide [2,2,0,0]');
  ok(slideLine([2, 2, 0, 0]).gained === 4, '[2,2,0,0] 得分应为 4');
  eq(slideLine([2, 2, 2, 2]).line, [4, 4, 0, 0], 'slide [2,2,2,2]');
  eq(slideLine([2, 2, 4, 0]).line, [4, 4, 0, 0], 'slide [2,2,4,0]（合并产物不参与本轮再合并）');
  eq(slideLine([2, 0, 2, 2]).line, [4, 2, 0, 0], 'slide [2,0,2,2]');
  eq(slideLine([0, 0, 0, 0]).line, [0, 0, 0, 0], 'slide 空行');
  eq(slideLine([2, 4, 8, 16]).line, [2, 4, 8, 16], 'slide 全不同');
  eq(slideLine([16, 16, 0, 0]).line, [32, 0, 0, 0], 'slide [16,16,0,0]');

  // 四个方向
  grid = [[2, 2, 0, 0], [0, 0, 0, 0], [0, 0, 0, 0], [0, 0, 0, 0]];
  move('left'); eq(grid[0], [4, 0, 0, 0], 'move left');

  grid = [[2, 0, 0, 0], [2, 0, 0, 0], [0, 0, 0, 0], [0, 0, 0, 0]];
  move('up'); eq(grid.map(r => r[0]), [4, 0, 0, 0], 'move up');

  grid = [[0, 0, 2, 2], [0, 0, 0, 0], [0, 0, 0, 0], [0, 0, 0, 0]];
  move('right'); eq(grid[0], [0, 0, 0, 4], 'move right');

  grid = [[0, 0, 0, 0], [0, 0, 0, 0], [2, 0, 0, 0], [2, 0, 0, 0]];
  move('down'); eq(grid.map(r => r[0]), [0, 0, 0, 4], 'move down');

  // 无路可走时 move 应返回 false 且棋盘不变
  grid = [[2, 4, 8, 16], [4, 8, 16, 32], [8, 16, 32, 64], [16, 32, 64, 128]];
  const before = JSON.stringify(grid);
  ok(move('up') === false, '满盘不可合并时 move 应返回 false');
  ok(JSON.stringify(grid) === before, '棋盘不应被改变');

  // 胜利检测
  won = false; continued = false; score = 0;
  grid = [[1024, 1024, 0, 0], [0, 0, 0, 0], [0, 0, 0, 0], [0, 0, 0, 0]];
  move('left');
  ok(won === true, '合成 2048 应触发胜利');
  ok(score === 2048, '合成 2048 得分应为 2048');

  // 死局 / 可移动检测
  grid = [[2, 4, 2, 4], [4, 2, 4, 2], [2, 4, 2, 4], [4, 2, 4, 2]];
  ok(hasMove() === false, '交替 2/4 满盘应判定为死局');
  grid = [[2, 4, 2, 4], [4, 2, 4, 2], [2, 4, 2, 4], [4, 2, 4, 4]];
  ok(hasMove() === true, '存在相邻相同方块应判定可移动');

  if (failures.length) {
    console.error('自检未通过：');
    failures.forEach(f => console.error('  ✗ ' + f));
    process.exit(1);
  }
  console.log('自检全部通过 ✓（合并规则 / 四方向 / 胜利 / 死局检测）');
  process.exit(0);
}

// ---------- 入口 ----------

if (process.argv.includes('--selftest')) {
  runSelfTest();
} else {
  readline.emitKeypressEvents(process.stdin);
  if (!process.stdin.isTTY) {
    console.error('错误：需要交互式终端才能运行游戏（请直接在终端里执行 node 2048.js）');
    process.exit(1);
  }
  startGame();
}
