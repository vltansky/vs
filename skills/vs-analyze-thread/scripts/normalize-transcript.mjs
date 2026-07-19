#!/usr/bin/env node

import { readFile } from 'node:fs/promises';
import { basename, extname } from 'node:path';

const usage = () => {
  console.error('Usage: node normalize-transcript.mjs <transcript-file> [more-files]');
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

const paths = process.argv.slice(2);
if (paths.length === 0) {
  usage();
} else {
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
    console.log(`# Source: ${basename(path)} (${turns.length} turns)`);
    for (const [index, turn] of turns.entries()) {
      const timestamp = turn.timestamp ? ` | ${turn.timestamp}` : '';
      console.log(`\n## Turn ${index + 1} | ${turn.role}${timestamp}\n`);
      console.log(turn.text);
    }
  }
}
