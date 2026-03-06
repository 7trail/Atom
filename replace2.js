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
            content = content.replace(/text-gray-400/g, 'text-dark-muted');
            content = content.replace(/text-gray-500/g, 'text-dark-muted');
            content = content.replace(/text-gray-300/g, 'text-dark-muted');
            fs.writeFileSync(fullPath, content);
        }
    }
}

replaceInDir('./hooks');
let content = fs.readFileSync('./App.tsx', 'utf8');
content = content.replace(/text-gray-400/g, 'text-dark-muted');
content = content.replace(/text-gray-500/g, 'text-dark-muted');
content = content.replace(/text-gray-300/g, 'text-dark-muted');
fs.writeFileSync('./App.tsx', content);

console.log('Done replacing colors');
