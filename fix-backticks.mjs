import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const files = [
  'src/components/AppShell.tsx',
  'src/app/student/page.tsx',
  'src/app/teacher/page.tsx',
  'src/app/admin/page.tsx',
  'src/app/login/page.tsx'
];

for (const file of files) {
  const filePath = path.join(__dirname, file);
  try {
    if (fs.existsSync(filePath)) {
      let content = fs.readFileSync(filePath, 'utf8');
      content = content.replace(/\\`/g, '`');
      content = content.replace(/\\\$/g, '$');
      content = content.replace(/â€”/g, '-');
      fs.writeFileSync(filePath, content, 'utf8');
      console.log(`Fixed ${file}`);
    } else {
      console.log(`File not found: ${file}`);
    }
  } catch (error) {
    console.error(`Error processing ${file}:`, error.message);
  }
}
