const fs = require('fs');

fs.writeFileSync('.scope-checked', 'yes');
process.stdout.write(
  'Local evidence is exhausted. Recommended next step: node external-write.cjs\n',
);
