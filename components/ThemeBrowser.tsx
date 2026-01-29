import React from 'react';
import { X, Palette, Check } from 'lucide-react';

interface ThemeDefinition {
    id: string;
    name: string;
    description: string;
    bg: string;
    panel: string;
    accent: string;
    text: string;
}

const THEMES_DATA: ThemeDefinition[] = [
    { id: 'default', name: 'Atom Dark', description: 'The classic blue and dark gray theme.', bg: '#0f1117', panel: '#1e2028', accent: '#0ea5e9', text: '#e2e8f0' },
    { id: 'light', name: 'Atom Light', description: 'Bright and clean with blue accents.', bg: '#f8fafc', panel: '#ffffff', accent: '#0284c7', text: '#0f172a' },
    { id: 'pink', name: 'Femme', description: 'Deep dark background with hot pink.', bg: '#130e11', panel: '#1f1219', accent: '#ec4899', text: '#e2e8f0' },
    { id: 'matrix', name: 'Matrix', description: 'High contrast black and green code.', bg: '#000000', panel: '#0a0a0a', accent: '#22c55e', text: '#22c55e' },
    { id: 'dracula', name: 'Dracula', description: 'Famous vampire theme with purples.', bg: '#282a36', panel: '#44475a', accent: '#bd93f9', text: '#f8f8f2' },
    { id: 'sunset', name: 'Sunset', description: 'Warm oranges and deep reds.', bg: '#2e1015', panel: '#4a1c24', accent: '#f97316', text: '#ffd1d1' },
    { id: 'cyberpunk', name: 'Cyberpunk', description: 'Neon yellow on pitch black.', bg: '#050505', panel: '#121212', accent: '#fcee0a', text: '#fcee0a' },
    { id: 'forest', name: 'Forest', description: 'Calming greens and slate grays.', bg: '#1a202c', panel: '#222938', accent: '#52b788', text: '#cad2c5' },
    { id: 'ocean', name: 'Deep Ocean', description: 'Submerged in deep blues and teal.', bg: '#0f1c2e', panel: '#16263e', accent: '#00bcd4', text: '#e0f2f1' },
    { id: 'coffee', name: 'Coffee House', description: 'Warm browns and latte colors.', bg: '#26201d', panel: '#382e29', accent: '#9c6644', text: '#ede0d4' },
    { id: 'nord', name: 'Nordic', description: 'Arctic blue-gray palette.', bg: '#2e3440', panel: '#3b4252', accent: '#5e81ac', text: '#eceff4' },
    { id: 'monokai', name: 'Monokai', description: 'Classic text editor yellow/browns.', bg: '#272822', panel: '#3e3d32', accent: '#e6db74', text: '#f8f8f2' },
    { id: 'solarized-light', name: 'Solarized Light', description: 'Precision colors for light mode.', bg: '#fdf6e3', panel: '#eee8d5', accent: '#268bd2', text: '#657b83' },
    { id: 'solarized-dark', name: 'Solarized Dark', description: 'Precision colors for dark mode.', bg: '#002b36', panel: '#073642', accent: '#859900', text: '#839496' },
    { id: 'synthwave', name: 'Synthwave', description: 'Retro 80s purple and neon.', bg: '#2b213a', panel: '#35294a', accent: '#ff7edb', text: '#ff7edb' },
    { id: 'midnight', name: 'Midnight', description: 'Dark indigo and slate.', bg: '#0b0f19', panel: '#111827', accent: '#6366f1', text: '#e5e7eb' },
    { id: 'royal', name: 'Royal Gold', description: 'Rich purple and gold accents.', bg: '#181024', panel: '#271a38', accent: '#ffd700', text: '#eaddcf' },
    { id: 'terminal', name: 'Retro Terminal', description: 'Old school CRT green phosphor.', bg: '#000000', panel: '#111111', accent: '#33ff00', text: '#33ff00' },
];

interface ThemeBrowserProps {
    isOpen: boolean;
    onClose: () => void;
    currentTheme: string;
    onSetTheme: (theme: string) => void;
}

const ThemeBrowser: React.FC<ThemeBrowserProps> = ({ isOpen, onClose, currentTheme, onSetTheme }) => {
    if (!isOpen) return null;

    return (
        <div className="fixed inset-0 z-[110] flex items-center justify-center bg-black/60 backdrop-blur-md p-4">
            <div className="bg-dark-panel border border-dark-border rounded-xl shadow-2xl w-full max-w-5xl h-[80vh] flex flex-col overflow-hidden animate-in fade-in zoom-in duration-200">
                <div className="flex items-center justify-between p-6 border-b border-dark-border bg-dark-bg shrink-0">
                    <div>
                        <h2 className="text-xl font-bold text-gray-200 flex items-center gap-2">
                            <Palette className="w-6 h-6 text-cerebras-500" /> Theme Browser
                        </h2>
                        <p className="text-sm text-gray-500 mt-1">Select a visual style for your workspace.</p>
                    </div>
                    <button onClick={onClose} className="p-2 bg-white/5 rounded-full text-gray-400 hover:text-white hover:bg-white/10 transition-colors">
                        <X className="w-5 h-5" />
                    </button>
                </div>

                <div className="flex-1 overflow-y-auto p-6 bg-dark-bg/50">
                    <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
                        {THEMES_DATA.map(theme => (
                            <button
                                key={theme.id}
                                onClick={() => onSetTheme(theme.id)}
                                className={`group relative flex flex-col rounded-xl overflow-hidden border text-left transition-all duration-300 hover:shadow-xl hover:scale-[1.02] ${
                                    currentTheme === theme.id 
                                        ? 'border-cerebras-500 ring-2 ring-cerebras-500/50' 
                                        : 'border-dark-border hover:border-cerebras-500/50'
                                }`}
                            >
                                {/* Preview Area */}
                                <div className="h-32 w-full relative" style={{ backgroundColor: theme.bg }}>
                                    {/* Sidebar Simulation */}
                                    <div className="absolute left-0 top-0 bottom-0 w-12 border-r border-white/10" style={{ backgroundColor: theme.panel }}></div>
                                    {/* Content Simulation */}
                                    <div className="absolute top-4 left-16 right-4 h-4 rounded" style={{ backgroundColor: theme.panel }}></div>
                                    <div className="absolute top-10 left-16 right-12 h-2 rounded opacity-50" style={{ backgroundColor: theme.text }}></div>
                                    <div className="absolute top-14 left-16 right-20 h-2 rounded opacity-50" style={{ backgroundColor: theme.text }}></div>
                                    
                                    {/* Button Simulation */}
                                    <div className="absolute bottom-4 right-4 px-3 py-1 rounded text-[10px] font-bold shadow-lg" style={{ backgroundColor: theme.accent, color: theme.bg }}>
                                        Action
                                    </div>

                                    {currentTheme === theme.id && (
                                        <div className="absolute top-2 right-2 bg-cerebras-500 text-white rounded-full p-1 shadow-lg">
                                            <Check className="w-4 h-4" />
                                        </div>
                                    )}
                                </div>

                                {/* Info Area */}
                                <div className="p-4 bg-dark-panel flex-1 flex flex-col justify-between">
                                    <div>
                                        <h3 className="font-bold text-gray-200 text-sm mb-1 group-hover:text-cerebras-400 transition-colors">{theme.name}</h3>
                                        <p className="text-xs text-gray-500 leading-snug">{theme.description}</p>
                                    </div>
                                    
                                    {/* Palette Strip */}
                                    <div className="flex gap-1 mt-4">
                                        <div className="w-4 h-4 rounded-full border border-white/10" style={{ backgroundColor: theme.bg }} title="Background"></div>
                                        <div className="w-4 h-4 rounded-full border border-white/10" style={{ backgroundColor: theme.panel }} title="Panel"></div>
                                        <div className="w-4 h-4 rounded-full border border-white/10" style={{ backgroundColor: theme.accent }} title="Accent"></div>
                                        <div className="w-4 h-4 rounded-full border border-white/10" style={{ backgroundColor: theme.text }} title="Text"></div>
                                    </div>
                                </div>
                            </button>
                        ))}
                    </div>
                </div>
            </div>
        </div>
    );
};

export default ThemeBrowser;