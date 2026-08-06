const fs = require('fs');
const file = 'C:/Users/bangn/Documents/Kerja/lomba/lomba-app/test-v4-system.cjs';
let c = fs.readFileSync(file, 'utf8');
// Replace mojibake patterns
c = c.replace(/â€[œ˜—™]/g, '—');  // em-dash variants
c = c.replace(/â€[žŸ¡]/g, '–');  // en-dash
c = c.replace(/â€ž/g, '"');
c = c.replace(/â€/g, '"');
c = c.replace(/â€˜/g, "'");
c = c.replace(/â€™/g, "'");
c = c.replace(/â€¢/g, '·');
fs.writeFileSync(file, c, 'utf8');
console.log('Cleaned, length:', c.length);
