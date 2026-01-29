import * as docx from 'docx';
import * as XLSX from 'xlsx';
import PptxGenJS from 'pptxgenjs';
import { FileData } from '../types';

// --- Helpers ---

// Helper to get buffer from data URI
const getBufferFromDataUrl = (dataUrl: string): Uint8Array => {
    try {
        const base64 = dataUrl.split(',')[1];
        const binaryString = window.atob(base64);
        const len = binaryString.length;
        const bytes = new Uint8Array(len);
        for (let i = 0; i < len; i++) {
            bytes[i] = binaryString.charCodeAt(i);
        }
        return bytes;
    } catch (e) {
        console.error("Failed to convert data URL to buffer", e);
        return new Uint8Array(0);
    }
};

// Helper to find file content
const findFile = (files: FileData[], path: string): string | null => {
   const f = files.find(file => file.name === path || file.name === path.replace(/^\.\//, ''));
   return f ? f.content : null;
};

// Standard HTML/CSS Color Map
const COLOR_MAP: Record<string, string> = {
    black: "000000", white: "FFFFFF", red: "FF0000", green: "008000", blue: "0000FF",
    yellow: "FFFF00", cyan: "00FFFF", magenta: "FF00FF", gray: "808080", grey: "808080",
    orange: "FFA500", purple: "800080", pink: "FFC0CB", brown: "A52A2A", maroon: "800000",
    navy: "000080", olive: "808000", teal: "008080", silver: "C0C0C0", gold: "FFD700",
    lime: "00FF00", indigo: "4B0082", violet: "EE82EE", coral: "FF7F50", salmon: "FA8072",
    beige: "F5F5DC", mint: "98FF98", azure: "F0FFFF", lavender: "E6E6FA"
};

// Normalize color to Hex (6 chars) for docx
const normalizeColor = (color?: string): string | undefined => {
    if (!color) return undefined;
    const clean = color.trim().toLowerCase().replace('#', '');
    
    // Check named colors
    if (COLOR_MAP[clean]) return COLOR_MAP[clean];
    
    // Validate Hex
    if (/^[0-9a-f]{6}$/i.test(clean)) return clean;
    if (/^[0-9a-f]{3}$/i.test(clean)) {
        // Expand 3-digit hex
        return clean.split('').map(c => c + c).join('');
    }
    
    return undefined; // Invalid or unsupported
};

interface TextStyle {
    bold?: boolean;
    italic?: boolean;
    strike?: boolean;
    underline?: boolean;
    color?: string;
    background?: string;
}

// Recursive Markdown Parser
const parseMarkdownText = (text: string, currentStyle: TextStyle = {}): { text: string, style: TextStyle }[] => {
    // Regex for tokens. Priority: Color/BG > Underline > Bold > Strike > Italic
    // Supports: <color:red>...</color>, <bg:yellow>...</bg>, <u>...</u>, **...**, ~~...~~, *...*
    const regex = /(<color:([^>]+)>(.*?)<\/color>|<bg:([^>]+)>(.*?)<\/bg>|<u>(.*?)<\/u>|\*\*(.*?)\*\*|~~(.*?)~~|\*(.*?)\*)/;
    
    const match = text.match(regex);
    
    if (!match) {
        return [{ text, style: currentStyle }];
    }
    
    const fullMatch = match[0];
    const index = match.index!;
    const before = text.substring(0, index);
    const after = text.substring(index + fullMatch.length);
    
    const segments: { text: string, style: TextStyle }[] = [];
    
    if (before) {
        segments.push({ text: before, style: currentStyle });
    }
    
    let innerText = "";
    let newStyle = { ...currentStyle };
    
    if (match[2]) { // Color: <color:hex>text</color>
        newStyle.color = match[2];
        innerText = match[3];
    } else if (match[4]) { // Background: <bg:hex>text</bg>
        newStyle.background = match[4];
        innerText = match[5];
    } else if (match[6] !== undefined) { // Underline: <u>text</u>
        innerText = match[6];
        newStyle.underline = true;
    } else if (match[7] !== undefined) { // Bold: **text**
        innerText = match[7];
        newStyle.bold = true;
    } else if (match[8] !== undefined) { // Strike: ~~text~~
        innerText = match[8];
        newStyle.strike = true;
    } else if (match[9] !== undefined) { // Italic: *text*
        innerText = match[9];
        newStyle.italic = true;
    }
    
    segments.push(...parseMarkdownText(innerText, newStyle));
    
    if (after) {
        segments.push(...parseMarkdownText(after, currentStyle));
    }
    
    return segments;
};

// --- DOCX Generation ---

export const createWordDoc = async (contentMarkdown: string, files: FileData[]): Promise<string> => {
    const lines = contentMarkdown.split('\n');
    const children: any[] = [];

    // Helper to generate docx TextRuns from markdown string
    const createTextRuns = (text: string): docx.TextRun[] => {
        const segments = parseMarkdownText(text);
        return segments.map(seg => {
            const hexColor = normalizeColor(seg.style.color);
            const hexBg = normalizeColor(seg.style.background);

            return new docx.TextRun({
                text: seg.text,
                bold: seg.style.bold,
                italics: seg.style.italic,
                strike: seg.style.strike,
                underline: seg.style.underline ? { type: docx.UnderlineType.SINGLE } : undefined,
                color: hexColor,
                shading: hexBg ? {
                    type: docx.ShadingType.CLEAR,
                    fill: hexBg,
                    color: "auto"
                } : undefined
            });
        });
    };

    let inTable = false;
    let tableRows: docx.TableRow[] = [];

    for (let i = 0; i < lines.length; i++) {
        const line = lines[i];

        // Image handling: ![alt](path)
        const imgMatch = line.match(/^!\[(.*?)\]\((.*?)\)/);
        if (imgMatch) {
            const rawAlt = imgMatch[1];
            const path = imgMatch[2];
            const fileContent = findFile(files, path);
            if (fileContent && fileContent.startsWith('data:image')) {
                 const buffer = getBufferFromDataUrl(fileContent);
                 const mimeMatch = fileContent.match(/data:image\/(\w+);/);
                 let type: "png" | "jpg" | "gif" | "bmp" = "png";
                 if (mimeMatch) {
                    const t = mimeMatch[1].toLowerCase();
                    if (t === 'jpeg') type = 'jpg';
                    else if (t === 'gif') type = 'gif';
                    else if (t === 'bmp') type = 'bmp';
                 }

                 let width = 400;
                 let height = 300;
                 let rotation = 0;
                 let flipH = false;
                 let flipV = false;
                 let hyperlink = '';

                 if (rawAlt) {
                     const parts = rawAlt.split(';');
                     parts.forEach(part => {
                         const eqIdx = part.indexOf('=');
                         if (eqIdx === -1) return;
                         
                         const key = part.substring(0, eqIdx).trim().toLowerCase();
                         const value = part.substring(eqIdx + 1).trim();
                         const valNum = parseFloat(value);
                         
                         if ((key === 'w' || key === 'width') && !isNaN(valNum)) width = valNum;
                         if ((key === 'h' || key === 'height') && !isNaN(valNum)) height = valNum;
                         if ((key === 'rotate' || key === 'rotation') && !isNaN(valNum)) rotation = valNum;
                         if (key === 'fliph' && value.toLowerCase() === 'true') flipH = true;
                         if (key === 'flipv' && value.toLowerCase() === 'true') flipV = true;
                         if (key === 'link') hyperlink = value;
                     });
                 }

                 const imgRun = new docx.ImageRun({
                     data: buffer,
                     transformation: { 
                         width, 
                         height, 
                         rotation, 
                         flip: { horizontal: flipH, vertical: flipV } 
                     },
                     type: type
                 });

                 if (hyperlink) {
                     children.push(new docx.Paragraph({ 
                         children: [
                             new docx.ExternalHyperlink({
                                 children: [imgRun],
                                 link: hyperlink
                             })
                         ] 
                     }));
                 } else {
                     children.push(new docx.Paragraph({ children: [imgRun] }));
                 }
            }
            continue;
        }
        
        // Table handling
        if (line.trim().startsWith('|')) {
            if (!inTable) inTable = true;
            const cells = line.split('|').filter(c => c.trim() !== '').map(c => c.trim());
            if (cells.some(c => c.match(/^-+$/))) continue;

            const rowCells = cells.map(text => new docx.TableCell({
                children: [new docx.Paragraph({ children: createTextRuns(text) })],
                borders: {
                     top: { style: docx.BorderStyle.SINGLE, size: 1, color: "888888" },
                     bottom: { style: docx.BorderStyle.SINGLE, size: 1, color: "888888" },
                     left: { style: docx.BorderStyle.SINGLE, size: 1, color: "888888" },
                     right: { style: docx.BorderStyle.SINGLE, size: 1, color: "888888" },
                }
            }));
            tableRows.push(new docx.TableRow({ children: rowCells }));
            continue;
        } else if (inTable) {
            inTable = false;
            children.push(new docx.Table({ rows: tableRows }));
            tableRows = [];
        }

        // Standard Markdown parsing (headers, lists, rich text)
        if (line.startsWith('# ')) {
             children.push(new docx.Paragraph({
                children: createTextRuns(line.replace('# ', '')),
                heading: docx.HeadingLevel.HEADING_1,
                spacing: { before: 200, after: 100 }
            }));
        } else if (line.startsWith('## ')) {
             children.push(new docx.Paragraph({
                children: createTextRuns(line.replace('## ', '')),
                heading: docx.HeadingLevel.HEADING_2,
                spacing: { before: 200, after: 100 }
            }));
        } else if (line.startsWith('### ')) {
            children.push(new docx.Paragraph({
               children: createTextRuns(line.replace('### ', '')),
               heading: docx.HeadingLevel.HEADING_3,
               spacing: { before: 200, after: 100 }
           }));
       } else if (line.trim().startsWith('- ')) {
            children.push(new docx.Paragraph({
                children: createTextRuns(line.trim().replace('- ', '')),
                bullet: { level: 0 }
            }));
        } else if (line.trim().match(/^\d+\.\s/)) {
            children.push(new docx.Paragraph({
                children: createTextRuns(line.trim().replace(/^\d+\.\s/, '')),
                numbering: {
                    reference: "default-numbering",
                    level: 0
                }
            }));
        } else if (line.trim() === '') {
            children.push(new docx.Paragraph({ text: '' }));
        } else {
            // Standard paragraph with rich text support
            children.push(new docx.Paragraph({ children: createTextRuns(line) }));
        }
    }
    
    if (inTable && tableRows.length > 0) {
         children.push(new docx.Table({ rows: tableRows }));
    }

    const doc = new docx.Document({
        numbering: {
            config: [
                {
                    reference: "default-numbering",
                    levels: [
                        {
                            level: 0,
                            format: docx.LevelFormat.DECIMAL,
                            text: "%1.",
                            alignment: docx.AlignmentType.START,
                            style: {
                                paragraph: {
                                    indent: { left: 720, hanging: 260 },
                                },
                            },
                        },
                    ],
                },
            ],
        },
        sections: [{ children }]
    });

    const blob = await docx.Packer.toBlob(doc);
    return new Promise((resolve) => {
        const reader = new FileReader();
        reader.onloadend = () => resolve(reader.result as string);
        reader.readAsDataURL(blob);
    });
};

// --- XLSX Generation ---

export const createExcelSheet = async (dataJson: string): Promise<string> => {
    try {
        const data = JSON.parse(dataJson);
        const wb = XLSX.utils.book_new();

        const processSheet = (sheetName: string, sheetData: any[]) => {
             const ws = Array.isArray(sheetData) && Array.isArray(sheetData[0]) 
                ? XLSX.utils.aoa_to_sheet(sheetData)
                : XLSX.utils.json_to_sheet(sheetData);
             
             // Fix Formulas: Convert string values starting with '=' to actual formulas
             const range = XLSX.utils.decode_range(ws['!ref'] || 'A1');
             for(let R = range.s.r; R <= range.e.r; ++R) {
                for(let C = range.s.c; C <= range.e.c; ++C) {
                    const cell_ref = XLSX.utils.encode_cell({c:C, r:R});
                    if(!ws[cell_ref]) continue;
                    const cell = ws[cell_ref];
                    
                    if(cell.t === 's' && String(cell.v).startsWith('=')) {
                        cell.f = String(cell.v).substring(1);
                        delete cell.v;
                        cell.t = 'n'; // Default to number type for calculation results
                    }
                }
             }

             XLSX.utils.book_append_sheet(wb, ws, sheetName);
        };

        if (!Array.isArray(data) && typeof data === 'object' && Object.keys(data).length > 0) {
            for (const sheetName in data) {
                processSheet(sheetName, data[sheetName]);
            }
        } else {
             processSheet("Sheet1", data);
        }
        
        const base64 = XLSX.write(wb, { bookType: 'xlsx', type: 'base64' });
        return `data:application/vnd.openxmlformats-officedocument.spreadsheetml.sheet;base64,${base64}`;
    } catch (e) {
        throw new Error("Invalid JSON data for Excel generation.");
    }
};

// --- PPTX Generation ---

export const createPresentation = async (contentJson: string, files: FileData[]): Promise<string> => {
    try {
        const slidesData = JSON.parse(contentJson);
        const pptx = new PptxGenJS();

        // Helper to convert Markdown to PptxGenJS Text Items
        const convertToPptxText = (text: string) => {
            const segments = parseMarkdownText(text);
            return segments.map(seg => ({
                text: seg.text,
                options: {
                    bold: seg.style.bold,
                    italic: seg.style.italic,
                    strike: seg.style.strike,
                    underline: seg.style.underline ? { style: 'sng' } : undefined,
                    color: normalizeColor(seg.style.color),
                    // PPTXGenJS doesn't support shading/highlight via this options object easily per-word
                    // but we pass color at least.
                } as any
            }));
        };
        
        if (Array.isArray(slidesData)) {
            for (const slideInfo of slidesData) {
                const slide = pptx.addSlide();
                
                // Title
                if (slideInfo.title) {
                    // Title also supports rich text if needed, but usually is simple
                    slide.addText(convertToPptxText(slideInfo.title), { x: 0.5, y: 0.5, w: '90%', fontSize: 24, bold: true, color: '363636' });
                }
                
                // Content
                if (slideInfo.content) {
                    if (Array.isArray(slideInfo.content)) {
                        // Bullet points
                        let yPos = 1.5;
                        for (const point of slideInfo.content) {
                             slide.addText(convertToPptxText(point), { x: 1, y: yPos, w: '80%', fontSize: 16, bullet: true, color: '666666' });
                             yPos += 0.5;
                        }
                    } else {
                        // Text block
                         slide.addText(convertToPptxText(slideInfo.content), { x: 1, y: 1.5, w: '80%', fontSize: 16, color: '666666' });
                    }
                }

                // Images
                if (slideInfo.images && Array.isArray(slideInfo.images)) {
                    for (const img of slideInfo.images) {
                        const fileContent = findFile(files, img.path);
                        if (fileContent) {
                            slide.addImage({ 
                                data: fileContent, 
                                x: img.x || 1, 
                                y: img.y || 3, 
                                w: img.w || 3, 
                                h: img.h || 3,
                                rotate: img.rotate,
                                flipH: img.flipH,
                                flipV: img.flipV,
                                transparency: img.transparency,
                                sizing: img.sizing,
                                hyperlink: img.hyperlink,
                                shadow: img.shadow,
                                rounding: img.rounding,
                                placeholder: img.placeholder
                            });
                        }
                    }
                }
            }
        }
        
        const b64 = await pptx.write({ outputType: 'base64' });
        return `data:application/vnd.openxmlformats-officedocument.presentationml.presentation;base64,${b64}`;

    } catch (e) {
        throw new Error("Invalid JSON data for PPTX generation. Expected array of slide objects.");
    }
}