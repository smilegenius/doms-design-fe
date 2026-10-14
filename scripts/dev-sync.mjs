// ─── npm run dev:sync ────────────────────────────────────────────────────────
// Runs the normal dev server (same port, 5173) and keeps your checkout up to
// date with the remote branch you are on, so merged PRs and pushes from other
// people show up on the page by themselves (Vite hot-reloads the changed files).
//
//   npm run dev:sync              dev server + check the remote every 30 s
//   npm run dev:sync -- --once    just check / pull once, no dev server
//   SYNC_SECONDS=10 npm run dev:sync
//
// Safe by design: it only fast-forwards (never creates a merge commit), keeps
// your uncommitted work (stash, pull, restore), and stops syncing with a
// message if something needs you (diverged branch, merge conflict).
// After a pull it runs `npm install` if package files changed and restarts the
// dev server if vite / tailwind / postcss config changed (Vite can't hot-reload those).
import { spawn, spawnSync } from 'node:child_process';

const once = process.argv.includes('--once');
const everyMs = Math.max(5, Number(process.env.SYNC_SECONDS) || 30) * 1000;
const isWin = process.platform === 'win32';

const git = (...args) => spawnSync('git', args, { encoding: 'utf8' });
const out = (...args) => (git(...args).stdout ?? '').trim();
const log = msg => console.log(`\x1b[36m[sync]\x1b[0m ${msg}`);

let dev = null;
const startDev = () => {
  dev = spawn(isWin ? 'npx.cmd' : 'npx', ['vite'], { stdio: 'inherit', shell: isWin });
  dev.on('exit', code => { if (!restarting) process.exit(code ?? 0); });
};
let restarting = false;
const restartDev = () => {
  restarting = true;
  if (isWin) spawnSync('taskkill', ['/pid', String(dev.pid), '/T', '/F']); else dev.kill();
  setTimeout(() => { restarting = false; startDev(); }, 800);
};

let paused = false;
function sync() {
  if (paused) return;
  const branch = out('rev-parse', '--abbrev-ref', 'HEAD');
  const upstream = out('rev-parse', '--abbrev-ref', '--symbolic-full-name', '@{u}');
  if (!branch || branch === 'HEAD' || !upstream) { if (once) log('No upstream branch to follow.'); return; }
  if (git('fetch', '--quiet').status !== 0) { log('Could not reach the remote. Will try again.'); return; }
  const behind = Number(out('rev-list', '--count', `HEAD..${upstream}`));
  const ahead = Number(out('rev-list', '--count', `${upstream}..HEAD`));
  if (!behind) { if (once) log(`Up to date with ${upstream}.`); return; }
  if (ahead) { log(`${branch} and ${upstream} have both moved on. Pull manually (git pull --rebase). Pausing sync.`); paused = true; return; }

  const before = out('rev-parse', 'HEAD');
  const dirty = out('status', '--porcelain', '--untracked-files=no') !== '';
  if (dirty) git('stash', 'push', '--quiet', '-m', 'dev-sync auto-stash');
  const pull = git('merge', '--ff-only', '--quiet', upstream);
  if (dirty) {
    const pop = git('stash', 'pop', '--quiet');
    if (pop.status !== 0) { log('Pulled, but your local changes clash with the new ones. They are kept in `git stash list`. Pausing sync.'); paused = true; return; }
  }
  if (pull.status !== 0) { log(`Could not fast-forward: ${(pull.stderr || '').trim()}. Pausing sync.`); paused = true; return; }

  const changed = out('diff', '--name-only', before, 'HEAD').split('\n').filter(Boolean);
  log(`Pulled ${behind} new commit${behind > 1 ? 's' : ''} from ${upstream} (${changed.length} file${changed.length === 1 ? '' : 's'}).`);
  if (changed.some(f => /^package(-lock)?\.json$/.test(f))) {
    log('Dependencies changed. Running npm install…');
    spawnSync('npm', ['install'], { stdio: 'inherit', shell: isWin });
    if (dev) restartDev();
  } else if (dev && changed.some(f => /(^|\/)(vite|tailwind|postcss)\.config\.|^index\.html$/.test(f))) {
    log('Config changed. Restarting the dev server…');
    restartDev();
  }
}

if (once) { sync(); process.exit(0); }
startDev();
setTimeout(() => { sync(); setInterval(sync, everyMs); }, 3000);
process.on('SIGINT', () => { if (dev) (isWin ? spawnSync('taskkill', ['/pid', String(dev.pid), '/T', '/F']) : dev.kill()); process.exit(0); });
