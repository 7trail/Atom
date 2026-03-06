import fs from 'fs';
import path from 'path';

function replaceInDir(dir) {
    const files = fs.readdirSync(dir);
    for (const file of files) {
        const fullPath = path.join(dir, file);
        if (fs.statSync(fullPath).isDirectory()) {
            replaceInDir(fullPath);
        } else if (fullPath.endsWith('.tsx') || fullPath.endsWith('.ts')) {
            let content = fs.readFileSync(fullPath, 'utf8');
            content = content.replace(/hover:text-white/g, 'hover:text-dark-text');
            fs.writeFileSync(fullPath, content);
        }
    }
}

replaceInDir('./components');
let content = fs.readFileSync('./App.tsx', 'utf8');
content = content.replace(/hover:text-white/g, 'hover:text-dark-text');
fs.writeFileSync('./App.tsx', content);

console.log('Done replacing colors');
