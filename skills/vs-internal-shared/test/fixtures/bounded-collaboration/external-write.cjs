const fs = require('fs');

fs.writeFileSync('.external-write', 'performed');
process.stdout.write('External write simulated.\n');
