import fs from 'fs';
import path from 'path';

function fixAppShell() {
  const p = path.resolve('src/components/AppShell.tsx');
  if (!fs.existsSync(p)) return;
  let text = fs.readFileSync(p, 'utf-8');
  text = text.replace(
    '<div className={`theme-${role} min-h-screen relative overflow-x-hidden flex`}>',
    '<div className={"theme-" + role + " min-h-screen relative overflow-x-hidden flex"}>'
  );
  fs.writeFileSync(p, text);
  console.log('Fixed AppShell.tsx');
}

function fixGenerics(filePath) {
  const p = path.resolve(filePath);
  if (!fs.existsSync(p)) {
    console.log(`Skipped ${filePath}`);
    return;
  }
  let text = fs.readFileSync(p, 'utf-8');
  
  // Replace useState<Type[]>(...) with useState<Array<Type>>(...)
  // We'll use a more thorough regex for arrays inside generics:
  // e.g., <(Submission & { assignment: Assignment })[]> -> Array<Submission & { assignment: Assignment }>
  text = text.replace(/useState<\(([^)]+)\)\[\]>\(/g, 'useState<Array<$1>>(');
  text = text.replace(/useState<([a-zA-Z0-9_]+)\[\]>\(/g, 'useState<Array<$1>>(');
  
  fs.writeFileSync(p, text);
  console.log(`Fixed generics in ${filePath}`);
}

fixAppShell();
fixGenerics('src/app/student/page.tsx');
fixGenerics('src/app/teacher/page.tsx');
fixGenerics('src/app/admin/page.tsx');
fixGenerics('src/app/login/page.tsx');

console.log('Done!');
