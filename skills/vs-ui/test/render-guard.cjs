// Shared by render-page-mcp.cjs (the server) and visual-look.helpers.ts (the
// eval): path confinement, the request allowlist, and the page hash.
const crypto = require('node:crypto');
const fs = require('node:fs');
const path = require('node:path');
const { fileURLToPath } = require('node:url');

function within(root, p) {
  return p === root || p.startsWith(root + path.sep);
}

// Resolve p (relative to root) and follow symlinks on the parts that exist.
// Returns the real path or null when it lands outside root.
function realInside(root, abs) {
  let probe = abs;
  while (!fs.existsSync(probe) && probe !== path.dirname(probe)) probe = path.dirname(probe);
  const real = path.join(fs.realpathSync(probe), path.relative(probe, abs));
  return within(root, real) ? real : null;
}

// Relative paths only, no "..", and the real path must stay inside root.
function insideRoot(root, p, label) {
  if (!root) throw new Error('RENDER_ROOT is not set');
  if (typeof p !== 'string' || !p) throw new Error(`${label} is required`);
  if (path.isAbsolute(p)) throw new Error(`${label} must be relative to the workspace`);
  if (p.split(/[\\/]/).includes('..')) throw new Error(`${label} must not contain ".."`);
  const real = realInside(root, path.resolve(root, p));
  if (!real) throw new Error(`${label} is outside the workspace`);
  return real;
}

// The output path itself must not be a symlink (a link planted there would
// redirect the write); the write also uses O_NOFOLLOW.
function assertNotSymlink(abs, label) {
  let st;
  try {
    st = fs.lstatSync(abs);
  } catch {
    return;
  }
  if (st.isSymbolicLink()) throw new Error(`${label} is a symlink`);
  if (!st.isFile()) throw new Error(`${label} is not a regular file`);
}

function writeNoFollow(abs, bytes) {
  const fd = fs.openSync(abs, fs.constants.O_WRONLY | fs.constants.O_CREAT | fs.constants.O_TRUNC | fs.constants.O_NOFOLLOW, 0o644);
  try {
    fs.writeSync(fd, bytes);
  } finally {
    fs.closeSync(fd);
  }
}

// Page requests: only data: URLs and file:// URLs whose real path is inside
// root. Everything else (other files, http(s), localhost, ws) is blocked.
function allowRequest(root, url) {
  if (url.startsWith('data:') || url === 'about:blank') return true;
  if (!url.startsWith('file:')) return false;
  let p;
  try {
    p = fileURLToPath(url);
  } catch {
    return false;
  }
  return realInside(root, path.resolve(p)) !== null;
}

// Hash of everything the page can load from the workspace: every file under
// root except shots/, dot directories (skills, git, pathgrade config) and
// node_modules. Covers HTML, CSS, SVG and any other asset.
function pageHash(root) {
  const files = [];
  const walk = (dir) => {
    for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
      if (e.name.startsWith('.') || e.name === 'node_modules') continue;
      const abs = path.join(dir, e.name);
      if (e.isDirectory()) {
        if (dir === root && e.name === 'shots') continue;
        walk(abs);
      } else if (e.isFile()) {
        files.push(abs);
      }
    }
  };
  walk(root);
  const h = crypto.createHash('sha256');
  for (const f of files.sort()) h.update(path.relative(root, f)).update(fs.readFileSync(f));
  return h.digest('hex');
}

module.exports = { insideRoot, assertNotSymlink, writeNoFollow, allowRequest, pageHash };
