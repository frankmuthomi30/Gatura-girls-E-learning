import fs from 'fs';
import path from 'path';

const files = [
  'src/components/AppShell.tsx',
  'src/app/student/page.tsx'
];

for (const file of files) {
  const filePath = path.resolve(file);
  if (!fs.existsSync(filePath)) {
    console.log(`File not found: ${filePath}`);
    continue;
  }
  let content = fs.readFileSync(filePath, 'utf8');

  const originalLength = content.length;
  
  // Remove zero-width spaces, BOM, and other invisible/problematic characters
  content = content.replace(/[\u200B-\u200D\uFEFF\u2028\u2029\u200E\u200F]/g, '');
  
  // Fix accidental spaces after `<` or `</` that break JSX JSX identifiers
  content = content.replace(/<\s+([a-zA-Z0-9_\.]+)/g, '<$1');
  content = content.replace(/<\/\s+([a-zA-Z0-9_\.]+)/g, '</$1');
  
  fs.writeFileSync(filePath, content, 'utf8');
  console.log(`Processed and re-saved standard utf8: ${file} (Length changed: ${originalLength !== content.length ? 'Yes' : 'No'})`);
}
