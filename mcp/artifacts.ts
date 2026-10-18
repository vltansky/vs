import { createHash, randomUUID } from 'node:crypto';
import { chmod, lstat, mkdir, open, readdir, readFile, realpath, stat } from 'node:fs/promises';
import { isAbsolute, join, relative, sep } from 'node:path';
import { DatabaseSync } from 'node:sqlite';
import { isDeepStrictEqual } from 'node:util';
import { basename } from 'node:path';
import { commentSchema, type ReviewComment, type Artifact, type CommentEvent } from './contracts.ts';
const maxArtifactBytes = 3 * 1024 * 1024;
const hash = (text: string) => createHash('sha256').update(text).digest('hex');
const htmdxPattern = /<(?:script|template)\b[^>]*type=["']text\/htmdx["']/i;

export class ArtifactStore {
  private database?: DatabaseSync;
  private opening?: Promise<DatabaseSync>;
  constructor(readonly root: string) {}

  private db() {
    return this.opening ??= this.openDatabase().catch(error => { this.opening = undefined; throw error; });
  }

  private async openDatabase() {
    await mkdir(this.root, { recursive: true });
    const directory = join(this.root, '.mcp');
    await mkdir(directory, { recursive: true, mode: 0o700 });
    // Review state stays inside the artifact root even when local files contain symlinks.
    if ((await lstat(directory)).isSymbolicLink()) throw new Error('VS state directory cannot be a symlink.');
    const file = join(directory, 'artifacts.sqlite');
    for (const suffix of ['', '-wal', '-shm']) {
      try { if ((await lstat(file + suffix)).isSymbolicLink()) throw new Error('VS database cannot be a symlink.'); }
      catch (error) { if (!(error instanceof Error && 'code' in error && error.code === 'ENOENT')) throw error; }
    }
    const handle = await open(file, 'a', 0o600);
    await handle.close();
    await chmod(file, 0o600);
    this.database = new DatabaseSync(file);
    this.database.exec(`PRAGMA journal_mode=WAL; PRAGMA busy_timeout=5000;
      CREATE TABLE IF NOT EXISTS comments (artifact_id TEXT NOT NULL, id TEXT NOT NULL, body TEXT NOT NULL, PRIMARY KEY (artifact_id,id));
      CREATE TABLE IF NOT EXISTS pending_events (id TEXT PRIMARY KEY, body TEXT NOT NULL);`);
    return this.database;
  }

  async read(path: string) {
    const [root, file] = await Promise.all([realpath(this.root), realpath(path)]);
    const withinRoot = relative(root, file);
    if (!isAbsolute(path) || !file.endsWith('.html') || withinRoot === '..' || withinRoot.startsWith(`..${sep}`) || isAbsolute(withinRoot) || withinRoot.split(sep).includes('.mcp')) throw new Error('Choose an HTML artifact under ~/.vs.');
    if ((await stat(file)).size > maxArtifactBytes) throw new Error('Artifact exceeds the 3 MB limit.');
    const html = await readFile(file, 'utf8');
    if (Buffer.byteLength(html) > maxArtifactBytes) throw new Error('Artifact exceeds the 3 MB limit.');
    if (!htmdxPattern.test(html)) throw new Error('The file is not an HTMDX artifact.');
    return { html, id: hash(withinRoot), revision: hash(html), path: file, project: withinRoot.includes(sep) ? withinRoot.split(sep)[0] : 'Unsorted' };
  }

  async list({ query = '', project, offset = 0, limit = 50 }: { query?: string; project?: string; offset?: number; limit?: number } = {}) {
    const database = await this.db();
    const paths: string[] = [];
    const walk = async (directory: string, depth: number) => {
      if (depth > 12) return;
      for (const entry of await readdir(directory, { withFileTypes: true })) {
        if (entry.name.startsWith('.') || entry.name === 'node_modules' || entry.isSymbolicLink()) continue;
        const path = join(directory, entry.name);
        if (entry.isDirectory()) await walk(path, depth + 1);
        else if (entry.isFile() && entry.name.endsWith('.html')) paths.push(path);
      }
    };
    await walk(this.root, 0);
    const artifacts: Artifact[] = [];
    for (const path of paths) {
      let saved: Awaited<ReturnType<ArtifactStore['read']>>;
      try { saved = await this.read(path); }
      catch (error) {
        if (error instanceof Error && (('code' in error && ['ENOENT', 'EACCES'].includes(String(error.code))) || /not an HTMDX|3 MB limit/.test(error.message))) continue;
        throw error;
      }
      const title = saved.html.match(/<title[^>]*>([^<]*)<\/title>/i)?.[1]?.trim() || saved.html.match(/^#\s+(.+)$/m)?.[1]?.trim() || basename(path, '.html');
      const comments = database.prepare('SELECT body FROM comments WHERE artifact_id=?').all(saved.id);
      artifacts.push({ id: saved.id, title, project: saved.project, path: saved.path, revision: saved.revision, updatedAt: (await stat(path)).mtime.toISOString(), openComments: comments.filter(row => commentSchema.parse(JSON.parse(String(row.body))).status === 'open').length });
    }
    // Tie-break equal mtimes by path so pagination is deterministic between calls.
    artifacts.sort((a, b) => b.updatedAt.localeCompare(a.updatedAt) || a.path.localeCompare(b.path));
    const projects = [...new Set(artifacts.map(a => a.project))].sort();
    const matches = artifacts.filter(a => (!project || a.project === project) && `${a.title} ${a.project} ${a.path}`.toLowerCase().includes(query.toLowerCase()));
    return { artifacts: matches.slice(offset, offset + limit), total: matches.length, projects, nextOffset: offset + limit < matches.length ? offset + limit : null };
  }

  async find(id: string) {
    // Resolve IDs against the current filesystem rather than trusting caller-provided paths.
    const page = await this.list({ limit: Number.MAX_SAFE_INTEGER });
    const artifact = page.artifacts.find(a => a.id === id);
    if (!artifact) throw new Error('Artifact not found. Refresh the library.');
    return { ...artifact, ...(await this.read(artifact.path)) };
  }

  async comments(artifactId: string) {
    await this.find(artifactId);
    const database = await this.db();
    return database.prepare('SELECT body FROM comments WHERE artifact_id=? ORDER BY rowid').all(artifactId).map(row => commentSchema.parse(JSON.parse(String(row.body))));
  }

  async save(artifactId: string, revision: string, input: ReviewComment) {
    const artifact = await this.find(artifactId);
    const comment = commentSchema.parse(input);
    if (JSON.stringify(comment.anchor).length > 16000) throw new Error('Comment anchor is too large.');
    const database = await this.db();
    database.exec('BEGIN IMMEDIATE');
    try {
      const row = database.prepare('SELECT body FROM comments WHERE artifact_id=? AND id=?').get(artifactId, comment.id);
      const previous = row ? commentSchema.parse(JSON.parse(String(row.body))) : undefined;
      if (!previous && revision !== artifact.revision) throw new Error('Artifact revision changed. Reopen it before adding feedback.');
      if (previous && (previous.revision !== revision || previous.comment !== comment.comment || !isDeepStrictEqual(previous.anchor, comment.anchor) || previous.intent !== comment.intent)) throw new Error('Comment ID already belongs to different feedback.');
      const saved = { ...comment, createdAt: previous?.createdAt ?? comment.createdAt, revision };
      database.prepare('INSERT INTO comments(artifact_id,id,body) VALUES(?,?,?) ON CONFLICT(artifact_id,id) DO UPDATE SET body=excluded.body').run(artifactId, comment.id, JSON.stringify(saved));
      if (!previous) {
        const event: CommentEvent = { eventId: randomUUID(), name: 'comment.created', timestamp: new Date().toISOString(), data: { artifact_id: artifactId, project_id: artifact.project, comment_id: comment.id, text: comment.comment, revision, anchor: comment.anchor }, cursor: null };
        // Persist feedback and its event together; a crash cannot leave a saved comment unpublishable.
        database.prepare('INSERT INTO pending_events(id,body) VALUES(?,?)').run(event.eventId, JSON.stringify(event));
      }
      database.exec('COMMIT');
      return saved;
    } catch (error) { database.exec('ROLLBACK'); throw error; }
  }

  async resolve(artifactId: string, commentId: string, resolved: boolean) {
    const comments = await this.comments(artifactId);
    const comment = comments.find(c => c.id === commentId);
    if (!comment) throw new Error('Comment not found.');
    if (!comment.revision) throw new Error('Stored feedback is missing its revision.');
    return this.save(artifactId, comment.revision, { ...comment, status: resolved ? 'resolved' : 'open' });
  }

  async pendingEvents() {
    // SAFETY: pending_events is private, and only the typed save transaction writes its JSON bodies.
    return (await this.db()).prepare('SELECT body FROM pending_events ORDER BY rowid').all().map(row => JSON.parse(String(row.body)) as CommentEvent);
  }
  async acknowledgeEvent(id: string) {
    const database = await this.db();
    return database.prepare('DELETE FROM pending_events WHERE id=?').run(id).changes > 0;
  }
  close() { this.database?.close(); this.database = undefined; this.opening = undefined; }
}
