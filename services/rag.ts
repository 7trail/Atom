

import { FileData } from '../types';

const STOP_WORDS = new Set([
  'a', 'about', 'above', 'after', 'again', 'against', 'all', 'am', 'an', 'and', 'any', 'are', 'aren\'t', 'as', 'at',
  'be', 'because', 'been', 'before', 'being', 'below', 'between', 'both', 'but', 'by',
  'can', 'cannot', 'could', 'couldn\'t', 'did', 'didn\'t', 'do', 'does', 'doesn\'t', 'doing', 'don\'t', 'down', 'during',
  'each', 'few', 'for', 'from', 'further',
  'had', 'hadn\'t', 'has', 'hasn\'t', 'have', 'haven\'t', 'having', 'he', 'he\'d', 'he\'ll', 'he\'s', 'her', 'here', 'here\'s', 'hers', 'herself', 'him', 'himself', 'his', 'how', 'how\'s',
  'i', 'i\'d', 'i\'ll', 'i\'m', 'i\'ve', 'if', 'in', 'into', 'is', 'isn\'t', 'it', 'it\'s', 'its', 'itself',
  'let\'s', 'me', 'more', 'most', 'mustn\'t', 'my', 'myself',
  'no', 'nor', 'not', 'of', 'off', 'on', 'once', 'only', 'or', 'other', 'ought', 'our', 'ours', 'ourselves', 'out', 'over', 'own',
  'same', 'shan\'t', 'she', 'she\'d', 'she\'ll', 'she\'s', 'should', 'shouldn\'t', 'so', 'some', 'such',
  'than', 'that', 'that\'s', 'the', 'their', 'theirs', 'them', 'themselves', 'then', 'there', 'there\'s', 'these', 'they', 'they\'d', 'they\'ll', 'they\'re', 'they\'ve', 'this', 'those', 'through', 'to', 'too',
  'under', 'until', 'up', 'very',
  'was', 'wasn\'t', 'we', 'we\'d', 'we\'ll', 'we\'re', 'we\'ve', 'were', 'weren\'t', 'what', 'what\'s', 'when', 'when\'s', 'where', 'where\'s', 'which', 'while', 'who', 'who\'s', 'whom', 'why', 'why\'s', 'with', 'won\'t', 'would', 'wouldn\'t',
  'you', 'you\'d', 'you\'ll', 'you\'re', 'you\'ve', 'your', 'yours', 'yourself', 'yourselves'
]);

const tokenize = (text: string): string[] => {
    // 1. Initial split by non-alphanumeric characters (keeps standard words, snake_case parts)
    const roughTokens = text.split(/[^a-zA-Z0-9]+/);
    const finalTokens: string[] = [];

    for (const t of roughTokens) {
        if (t.length < 2) continue;
        
        // Add original lowercased
        const lower = t.toLowerCase();
        if (!STOP_WORDS.has(lower)) finalTokens.push(lower);

        // 2. Handle camelCase and PascalCase splitting
        // "getUserId" -> "get", "User", "Id"
        const splitCamel = t.replace(/([a-z])([A-Z])/g, '$1 $2').split(' ');
        if (splitCamel.length > 1) {
             splitCamel.forEach(sub => {
                 const subLow = sub.toLowerCase();
                 if (subLow.length > 1 && !STOP_WORDS.has(subLow)) finalTokens.push(subLow);
             });
        }
    }
    return finalTokens;
};

interface Chunk {
    file: string;
    content: string;
    tokens: string[];
    originalLength: number;
}

export class RAGService {
    private chunks: Chunk[] = [];
    private avgdl: number = 0;
    private docFreqs: Map<string, number> = new Map();
    private docCount: number = 0;
    
    // BM25 Hyperparameters
    private k1 = 1.2;
    private b = 0.75;

    constructor() {
        console.log("RAG Service initialized (Advanced Tokenization)");
    }

    public async updateIndex(files: FileData[]) {
        this.chunks = [];
        this.docFreqs.clear();
        this.docCount = 0;
        let totalLen = 0;

        for (const file of files) {
            // Handle Binary/Large Files lightly
            if (file.name.match(/\.(png|jpg|jpeg|gif|webp|svg|zip|pdf|docx|xlsx|pptx)$/i)) {
                // For binary, we just index the filename as content
                this.addChunk(file.name, `File: ${file.name} [Binary/Media File]`, file.name.split('.').pop() || 'binary');
                continue;
            }
            
            const lines = file.content.split('\n');
            const CHUNK_SIZE = 60; 
            const OVERLAP = 10;
            
            if (lines.length <= CHUNK_SIZE) {
                 this.addChunk(file.name, file.content, file.language);
            } else {
                for (let i = 0; i < lines.length; i += (CHUNK_SIZE - OVERLAP)) {
                    const chunkLines = lines.slice(i, i + CHUNK_SIZE);
                    const content = chunkLines.join('\n');
                    const header = `File: ${file.name} (Lines ${i + 1}-${i + chunkLines.length})`;
                    const fullContent = `${header}\n\`\`\`${file.language}\n${content}\n\`\`\``;
                    
                    this.addChunk(file.name, fullContent, file.language);
                }
            }
        }

        // Calculate Average Document Length
        this.chunks.forEach(c => totalLen += c.originalLength);
        this.avgdl = this.chunks.length > 0 ? totalLen / this.chunks.length : 0;
        this.docCount = this.chunks.length;
    }

    private addChunk(filename: string, content: string, lang: string) {
         // We tokenize the content plus the filename to give filename matches weight
         const tokens = tokenize(content + " " + filename);
         
         // Update Doc Frequencies (count distinct words per doc)
         const uniqueTokens = new Set(tokens);
         uniqueTokens.forEach(t => {
             this.docFreqs.set(t, (this.docFreqs.get(t) || 0) + 1);
         });

         this.chunks.push({
             file: filename,
             content: content,
             tokens: tokens,
             originalLength: tokens.length
         });
    }

    private getIDF(term: string): number {
        const docFreq = this.docFreqs.get(term) || 0;
        // Standard BM25 IDF formula with +1 smoothing to prevent negative weights
        return Math.log(1 + (this.docCount - docFreq + 0.5) / (docFreq + 0.5));
    }

    public async retrieve(query: string, maxChars: number = 25000): Promise<string> {
        if (!query.trim()) {
            return this.chunks.slice(0, 5).map(c => c.content).join('\n\n');
        }

        const queryTokens = tokenize(query);
        
        const scoredChunks = this.chunks.map(chunk => {
            let score = 0;
            
            // Calculate BM25 Score
            queryTokens.forEach(term => {
                const tf = chunk.tokens.filter(t => t === term).length;
                if (tf > 0) {
                    const idf = this.getIDF(term);
                    const num = tf * (this.k1 + 1);
                    const denom = tf + this.k1 * (1 - this.b + this.b * (chunk.originalLength / this.avgdl));
                    score += idf * (num / denom);
                }
            });

            // Boost exact filename match
            if (chunk.file.toLowerCase().includes(query.toLowerCase())) {
                score += 3.0; // Higher boost for file name hits
            }

            return { chunk, score };
        });

        // Filter and sort
        const results = scoredChunks
            .filter(item => item.score > 0)
            .sort((a, b) => b.score - a.score);

        let currentChars = 0;
        const selected: string[] = [];
        
        for (const item of results) {
            if (currentChars + item.chunk.content.length > maxChars) break;
            
            // Dynamic threshold: if we have some good results, drop really low ones
            if (selected.length > 3 && item.score < 1.0) break;
            
            selected.push(item.chunk.content);
            currentChars += item.chunk.content.length;
        }

        // Fallback if nothing matches well but we need context (unlikely with BM25 unless nonsense query)
        if (selected.length === 0 && this.chunks.length > 0) {
             return "No highly relevant context found via search. Providing file listing only.\nFiles available: " + 
                    [...new Set(this.chunks.map(c => c.file))].slice(0, 20).join(', ');
        }

        return selected.join('\n\n');
    }
}

export const ragService = new RAGService();