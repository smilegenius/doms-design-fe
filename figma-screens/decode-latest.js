const fs = require('fs');
const path = require('path');
const name = process.argv[2];
const toolResultsDir = 'C:/Users/Dell/.claude/projects/D--Calude-Design/2f7e96f6-6ef6-4daf-bef1-6e6f67917e8f/tool-results';
const files = fs.readdirSync(toolResultsDir)
  .filter(f => f.startsWith('mcp-Claude_Preview-preview_eval-') && f.endsWith('.txt'))
  .map(f => ({ f, t: parseInt(f.match(/(\d+)\.txt$/)[1]) }))
  .sort((a, b) => b.t - a.t);
const latest = files[0].f;
const raw = fs.readFileSync(path.join(toolResultsDir, latest), 'utf8');
const data = JSON.parse(raw);
const b64 = data[0].text;
const outPath = 'D:/dental-saas-supplier-portal/dental-project/figma-screens/' + name + '.jpg';
fs.writeFileSync(outPath, Buffer.from(b64, 'base64'));
console.log('saved ' + name + '.jpg from ' + latest + ' (' + fs.statSync(outPath).size + ' bytes)');
