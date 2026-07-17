const fs = require('fs');
const path = require('path');

function replaceInFile(filePath) {
  const content = fs.readFileSync(filePath, 'utf8');
  const newContent = content
    .replace(/Clínica RIM/g, 'Clínica Rim')
    .replace(/Clinica RIM/g, 'Clinica Rim');
    
  if (content !== newContent) {
    fs.writeFileSync(filePath, newContent, 'utf8');
    console.log('Updated', filePath);
  }
}

function walk(dir) {
  const list = fs.readdirSync(dir);
  for (let file of list) {
    const filePath = path.join(dir, file);
    const stat = fs.statSync(filePath);
    if (stat && stat.isDirectory()) {
      walk(filePath);
    } else if (stat.isFile() && !file.endsWith('.png') && !file.endsWith('.jpg')) {
      replaceInFile(filePath);
    }
  }
}

walk(path.join(__dirname, 'src'));
console.log('Replacement complete.');
