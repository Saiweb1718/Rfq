const fs = require('fs');
const path = require('path');

function walk(dir, callback) {
  fs.readdirSync(dir).forEach(f => {
    let dirPath = path.join(dir, f);
    let isDirectory = fs.statSync(dirPath).isDirectory();
    isDirectory ? walk(dirPath, callback) : callback(path.join(dir, f));
  });
}

const replacements = [
  // Text gradients
  { regex: /bg-gradient-to-[a-z]+\s+from-[-a-zA-Z0-9/]+\s+to-[-a-zA-Z0-9/]+\s+bg-clip-text\s+text-transparent/g, replace: 'text-primary-600' },
  { regex: /text-transparent\s+bg-clip-text\s+bg-gradient-to-[a-z]+\s+from-[-a-zA-Z0-9/]+\s+to-[-a-zA-Z0-9/]+/g, replace: 'text-primary-600' },
  // Button gradients
  { regex: /bg-gradient-to-[a-z]+\s+from-[-a-zA-Z0-9/]+\s+to-[-a-zA-Z0-9/]+/g, replace: 'bg-primary-600' },
  { regex: /hover:from-[-a-zA-Z0-9/]+\s+hover:to-[-a-zA-Z0-9/]+/g, replace: 'hover:bg-primary-700' },
  // Surface backgrounds
  { regex: /bg-surface-950(?:\/\d+)?/g, replace: 'bg-white' },
  { regex: /bg-surface-[89]00(?:\/\d+)?/g, replace: 'bg-white' },
  { regex: /bg-surface-700(?:\/\d+)?/g, replace: 'bg-surface-50' },
  // Surface hover backgrounds
  { regex: /hover:bg-surface-700(?:\/\d+)?/g, replace: 'hover:bg-surface-100' },
  // Text colors
  { regex: /text-surface-50/g, replace: 'text-surface-900' },
  { regex: /text-surface-200(?:\/\d+)?/g, replace: 'text-surface-600' },
  // Borders
  { regex: /border-surface-700(?:\/\d+)?/g, replace: 'border-surface-200' },
  { regex: /hover:border-surface-200(?:\/\d+)?/g, replace: 'hover:border-surface-400' },
  // Placeholders
  { regex: /placeholder-surface-200(?:\/\d+)?/g, replace: 'placeholder-surface-400' }
];

walk('c:/Users/saide/gocomet_assignment/frontend/src', (filePath) => {
  if (filePath.endsWith('.jsx')) {
    let content = fs.readFileSync(filePath, 'utf8');
    let original = content;
    
    replacements.forEach(({ regex, replace }) => {
      content = content.replace(regex, replace);
    });

    if (content !== original) {
      fs.writeFileSync(filePath, content, 'utf8');
      console.log('Updated:', filePath);
    }
  }
});
