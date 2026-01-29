

import yaml from 'js-yaml';
import { FileData, Skill } from '../types';
import { isRenderHosted } from '../constants';

export const parseSkill = (file: FileData): Skill | null => {
    // pattern: --- \n yaml \n --- \n content
    // We handle optional CRLF
    const match = file.content.match(/^---\s*[\r\n]+([\s\S]*?)[\r\n]+---\s*[\r\n]+([\s\S]*)$/);
    if (!match) return null;
    
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
    const existingIdx = skills.findIndex(s => s.id === skill.id);
    const skillWithSource = { ...skill, source: 'storage' as const };
    
    if (existingIdx >= 0) {
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