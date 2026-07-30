const assert = require('node:assert');
const { formatDuration } = require('./duration');

assert.strictEqual(formatDuration(0), '0:00');
assert.strictEqual(formatDuration(65), '1:05');

console.log('ok');
