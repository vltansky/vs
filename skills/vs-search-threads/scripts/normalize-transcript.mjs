#!/usr/bin/env node

import { createHash } from 'node:crypto';
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { basename, dirname, extname, resolve } from 'node:path';

const usage = () => {
  console.error('Usage: node normalize-transcript.mjs --output <normalized.md> <transcript-file...> | --stdout <transcript-file...>');
  process.exitCode = 1;
};

const textFromContent = (content) => {
  if (typeof content === 'string') return content.trim();
  if (!Array.isArray(content)) return '';

  return content
    .filter((block) => block && typeof block === 'object')
    .filter((block) => ['text', 'input_text', 'output_text'].includes(block.type))
    .map((block) => (typeof block.text === 'string' ? block.text : ''))
    .filter(Boolean)
    .join('\n')
    .trim();
};

const normalizeRole = (role) => {
  if (role === 'user' || role === 'human') return 'user';
  if (role === 'assistant' || role === 'agent') return 'assistant';
  return null;
};

const fromJsonRecord = (record) => {
  if (!record || typeof record !== 'object') return null;

  if (record.type === 'user' || record.type === 'assistant') {
    const role = normalizeRole(record.message?.role ?? record.type);
    const text = textFromContent(record.message?.content ?? record.content);
    return role && text ? { role, text, timestamp: record.timestamp } : null;
  }

  if (record.type === 'response_item' && record.payload?.type === 'message') {
    const role = normalizeRole(record.payload.role);
    const text = textFromContent(record.payload.content);
    return role && text ? { role, text, timestamp: record.timestamp } : null;
  }

  const role = normalizeRole(record.role);
  const text = textFromContent(record.content ?? record.message);
  return role && text ? { role, text, timestamp: record.timestamp } : null;
};

const parseJson = (raw) => {
  try {
    const parsed = JSON.parse(raw);
    const records = Array.isArray(parsed) ? parsed : parsed.messages;
    if (!Array.isArray(records)) return [];
    return records.map(fromJsonRecord).filter(Boolean);
  } catch {
    return [];
  }
};

const parseJsonLines = (raw) => raw
  .split(/\r?\n/)
  .filter(Boolean)
  .map((line) => {
    try {
      return fromJsonRecord(JSON.parse(line));
    } catch {
      return null;
    }
  })
  .filter(Boolean);

const SPEAKER_HEADING = /^(?:#{1,6}\s*)?(?:\*\*)?(user|human|assistant|agent)(?:\*\*)?\s*:?[ \t]*$/i;
const SPEAKER_PREFIX = /^(?:\*\*)?(user|human|assistant|agent)(?:\*\*)?\s*:\s*(.*)$/i;

const parseMarkdown = (raw) => {
  const turns = [];
  let current = null;

  const flush = () => {
    if (current?.text.trim()) turns.push({ ...current, text: current.text.trim() });
    current = null;
  };

  for (const line of raw.split(/\r?\n/)) {
    const heading = line.match(SPEAKER_HEADING);
    const prefix = line.match(SPEAKER_PREFIX);

    if (heading || prefix) {
      flush();
      const match = heading ?? prefix;
      current = {
        role: normalizeRole(match[1].toLowerCase()),
        text: prefix?.[2] ?? '',
      };
      continue;
    }

    if (current) current.text += `${current.text ? '\n' : ''}${line}`;
  }

  flush();
  return turns;
};

const dedupe = (turns) => turns.filter((turn, index) => {
  const previous = turns[index - 1];
  return !previous || previous.role !== turn.role || previous.text !== turn.text;
});

const parse = (path, raw) => {
  const extension = extname(path).toLowerCase();
  if (extension === '.jsonl') return parseJsonLines(raw);
  if (extension === '.json') return parseJson(raw);
  return parseMarkdown(raw);
};

const args = process.argv.slice(2);
const outputIndex = args.indexOf('--output');
const stdout = args.includes('--stdout');
const outputPath = outputIndex >= 0 ? resolve(args[outputIndex + 1]) : null;
const paths = args.filter((arg, index) => (
  arg !== '--stdout'
  && arg !== '--output'
  && index !== outputIndex + 1
));

if (paths.length === 0 || (!outputPath && !stdout)) {
  usage();
} else {
  const rendered = [];
  const index = [];
  const sourcePaths = new Map();

  for (const path of paths) {
    let raw;
    try {
      raw = await readFile(path, 'utf8');
    } catch (error) {
      console.error(`${path}: ${error.message}`);
      process.exitCode = 1;
      continue;
    }

    const turns = dedupe(parse(path, raw));
    const sourcePath = resolve(path);
    const source = `${basename(path)}#${createHash('sha256').update(sourcePath).digest('hex').slice(0, 8)}`;
    sourcePaths.set(source, sourcePath);
    rendered.push(`# Source: ${source} (${turns.length} turns)`);
    for (const [index, turn] of turns.entries()) {
      const timestamp = turn.timestamp ? ` | ${turn.timestamp}` : '';
      rendered.push('', `## Turn ${index + 1} | ${turn.role}${timestamp}`, '', turn.text);
    }
  }

  if (process.exitCode) process.exit();
  const normalized = `${rendered.join('\n')}\n`;

  if (stdout) {
    process.stdout.write(normalized);
  } else {
    let line = 1;
    let source = '';
    for (const entry of rendered) {
      const sourceMatch = entry.match(/^# Source: (.+) \(\d+ turns\)$/);
      if (sourceMatch) source = sourceMatch[1];
      const turnMatch = entry.match(/^## Turn (\d+) \| (user|assistant)(?: \| (.+))?$/);
      if (turnMatch) {
        index.push({
          source,
          sourcePath: sourcePaths.get(source),
          turn: Number(turnMatch[1]),
          role: turnMatch[2],
          timestamp: turnMatch[3],
          startLine: line,
        });
      }
      line += entry.split('\n').length;
    }
    for (const [entryIndex, entry] of index.entries()) {
      entry.endLine = (index[entryIndex + 1]?.startLine ?? line + 1) - 1;
    }

    await mkdir(dirname(outputPath), { recursive: true });
    await writeFile(outputPath, normalized);
    const indexPath = `${outputPath}.index.json`;
    await writeFile(indexPath, `${JSON.stringify(index, null, 2)}\n`);
    console.log(JSON.stringify({
      outputPath,
      indexPath,
      turns: index.length,
      bytes: Buffer.byteLength(normalized),
      sha256: createHash('sha256').update(normalized).digest('hex'),
    }));
  }
}
