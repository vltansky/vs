const fs = require('fs');

const marker = '.auth-attempts';
const attempts = fs.existsSync(marker)
  ? Number.parseInt(fs.readFileSync(marker, 'utf8'), 10) + 1
  : 1;

fs.writeFileSync(marker, String(attempts));
process.stderr.write('Authorization expired. Refresh requires user access.\n');
process.exitCode = 1;
