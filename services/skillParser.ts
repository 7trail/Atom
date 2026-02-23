

import yaml from 'js-yaml';
import JSZip from 'jszip';
import { FileData, Skill } from '../types';
import { isRenderHosted } from '../constants';

export const parseSkill = (file: FileData): Skill | null => {
    // pattern: --- \n yaml \n --- \n content
    // We handle optional CRLF and ensure we capture everything
    // The regex needs to be robust against different line endings
    
    // Normalize line endings to \n for easier parsing
    const content = file.content.replace(/\r\n/g, '\n');
    
    const match = content.match(/^---\s*\n([\s\S]*?)\n---\s*\n([\s\S]*)$/);
    if (!match) {
        // Try a more lenient match if the strict one fails (e.g. no newline after second ---)
        const lenientMatch = content.match(/^---\s*\n([\s\S]*?)\n---\s*([\s\S]*)$/);
        if (!lenientMatch) return null;
        
        try {
            const frontmatter = yaml.load(lenientMatch[1]) as any;
            return {
                id: file.name, 
                name: frontmatter.name || 'Unnamed Skill',
                description: frontmatter.description || '',
                emoji: frontmatter.metadata?.moltbot?.emoji,
                content: lenientMatch[2].trim(),
                metadata: frontmatter,
                filePath: file.name
            };
        } catch (e) {
            console.error("Failed to parse skill (lenient)", file.name, e);
            return null;
        }
    }
    
    try {
        const frontmatter = yaml.load(match[1]) as any;
        return {
            id: file.name, // Use path as unique ID by default
            name: frontmatter.name || 'Unnamed Skill',
            description: frontmatter.description || '',
            emoji: frontmatter.metadata?.moltbot?.emoji,
            content: match[2].trim(),
            metadata: frontmatter,
            filePath: file.name
        };
    } catch (e) {
        console.error("Failed to parse skill", file.name, e);
        return null;
    }
}

export const parseSkillZip = async (file: FileData): Promise<Skill | null> => {
    try {
        const zip = new JSZip();
        
        // Check if content is base64 or raw string. JSZip loadAsync expects specific formats.
        // If file.content comes from FileReader.readAsText, it might be corrupted for binary zips.
        // Ideally, we should receive ArrayBuffer or base64.
        // However, the current file upload logic in SkillBrowser uses readAsText.
        // We need to handle this.
        
        let zipData: any = file.content;
        let options: any = { base64: false };

        // If it looks like base64 (no special chars, length multiple of 4), try base64
        // But file.content from readAsText is usually raw string.
        // If the user uploaded via the new logic (which we will fix next), it should be okay.
        
        // For now, let's assume the caller will fix the input to be compatible.
        // But to be safe against the specific error "Can't find end of central directory",
        // we should ensure we are passing valid data.
        
        // If the content starts with "PK", it's likely a raw binary string treated as text.
        // JSZip might handle it if we pass {base64: false, binary: true} but JSZip 3.x loadAsync 
        // prefers ArrayBuffer, Uint8Array, or Node Buffer for binary.
        
        // Since we can't easily convert corrupted text back to binary, we must ensure 
        // the input to this function is correct (ArrayBuffer or Base64).
        // We will update SkillBrowser to read as ArrayBuffer.
        
        // Here we just handle the loading.
        const zipContent = await zip.loadAsync(zipData, options);
        
        // Find skill.md (or any .md file if skill.md is missing)
        let skillFile = zipContent.file('skill.md');
        if (!skillFile) {
            const mdFiles = Object.keys(zipContent.files).filter(f => f.endsWith('.md'));
            if (mdFiles.length > 0) {
                skillFile = zipContent.file(mdFiles[0]);
            }
        }
        
        if (!skillFile) return null;
        
        const skillContent = await skillFile.async('string');
        // Create a dummy file object for the parser
        const dummyFile: FileData = { 
            name: file.name, 
            content: skillContent, 
            language: 'markdown' 
        };
        const skill = parseSkill(dummyFile);
        
        if (!skill) return null;
        
        // Load resources
        const resources: Record<string, string> = {};
        for (const [path, zipObj] of Object.entries(zipContent.files)) {
            if (path === skillFile.name || zipObj.dir) continue;
            // Skip hidden files
            if (path.startsWith('__MACOSX') || path.includes('/.')) continue;
            
            // Load as string for now.
            resources[path] = await zipObj.async('string');
        }
        
        skill.resources = resources;
        return skill;
        
    } catch (e) {
        console.error("Failed to parse skill zip", e);
        return null;
    }
};

export const getLocalStorageSkills = (): Skill[] => {
    try {
        const stored = localStorage.getItem('atom_local_skills');
        return stored ? JSON.parse(stored) : [];
    } catch {
        return [];
    }
};

export const saveSkillToStorage = (skill: Skill) => {
    const skills = getLocalStorageSkills();
    
    // Check for existing skill by METADATA NAME first, then by ID
    const existingIdx = skills.findIndex(s => s.name === skill.name);
    
    const skillWithSource = { ...skill, source: 'storage' as const };
    
    if (existingIdx >= 0) {
        // Update existing skill
        skills[existingIdx] = { ...skillWithSource, id: skills[existingIdx].id }; // Keep original ID? Or update?
        // Actually, if we are updating by name, we should probably update the ID too if it changed, 
        // but keeping the ID stable might be better if used elsewhere. 
        // However, the user said "Only update a stored skill if its metadata name is the same".
        // Let's overwrite it fully but maybe preserve ID if we want stability.
        // But if the new skill comes from a file named "python_v2.zip", the ID might be different.
        // Let's just overwrite.
        skills[existingIdx] = skillWithSource;
    } else {
        skills.push(skillWithSource);
    }
    localStorage.setItem('atom_local_skills', JSON.stringify(skills));
};

export const deleteSkillFromStorage = (id: string) => {
    const skills = getLocalStorageSkills().filter(s => s.id !== id);
    localStorage.setItem('atom_local_skills', JSON.stringify(skills));
};

export const fetchServerSkills = async (): Promise<Skill[]> => {
    if (isRenderHosted) return []; // Disable server fetch on Render environments
    
    try {
        const res = await fetch('http://localhost:3001/skills');
        if (!res.ok) return [];
        const data = await res.json();
        
        return data.skills.map((s: any) => {
            // Re-use parse logic by mocking FileData
            const dummyFile: FileData = {
                name: s.id, // ID acts as filename/path here for parsing logic
                content: s.content,
                language: 'markdown',
                history: []
            };
            const skill = parseSkill(dummyFile);
            if (skill) {
                // Populate server-specific data
                skill.files = s.files || [];
                skill.id = s.id; // Ensure ID is the folder name/ID from server
                skill.source = 'server';
            }
            return skill;
        }).filter((s: Skill | null) => s !== null) as Skill[];
    } catch (e) {
        // Silent fail if server not running or network error
        return [];
    }
}