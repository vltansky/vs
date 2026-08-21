export function pickPublicFields(record) {
  return {
    id: record.id,
    status: record.status,
    summary: record.summary,
  };
}

export function publicHandoff(record) {
  throw new Error('Not implemented');
}
