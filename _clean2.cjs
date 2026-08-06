const fs = require('fs');
const file = 'C:/Users/bangn/Documents/Kerja/lomba/lomba-app/test-v4-system.cjs';
let c = fs.readFileSync(file, 'utf8');
// Remove trailing whitespace including non-breaking spaces and BOM
c = c.replace(/[\s\u00A0\u200B-\u200D\uFEFF]+$/, '\n');
fs.writeFileSync(file, c, 'utf8');
console.log('Trimmed, length:', c.length);
