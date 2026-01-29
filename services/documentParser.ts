import mammoth from 'mammoth';
import * as XLSX from 'xlsx';
import JSZip from 'jszip';
import { FileData, Attachment } from '../types';

export const isDocument = (filename: string) => {
    return !!filename.match(/\.(docx|xlsx|xls|pptx)$/i);
};

const base64ToArrayBuffer = (base64: string) => {
    // handle data URI scheme if present (e.g. data:application/vnd...;base64,...)
    const base64Clean = base64.split(',')[1] || base64;
    try {
        const binaryString = window.atob(base64Clean);
        const len = binaryString.length;
        const bytes = new Uint8Array(len);
        for (let i = 0; i < len; i++) {
            bytes[i] = binaryString.charCodeAt(i);
        }
        return bytes.buffer;
    } catch (e) {
        console.error("Failed to decode base64 for document parsing", e);
        return new ArrayBuffer(0);
    }
};

const base64ToString = (base64: string) => {
    const base64Clean = base64.split(',')[1] || base64;
    try {
        return window.atob(base64Clean);
    } catch (e) {
        return "";
    }
};

export const parseDocument = async (file: FileData | Attachment): Promise<string> => {
    try {
        // Binary Documents
        if (file.name.match(/\.(docx|xlsx|xls|pptx)$/i)) {
            const arrayBuffer = base64ToArrayBuffer(file.content);

            if (file.name.match(/\.docx$/i)) {
                const result = await mammoth.extractRawText({ arrayBuffer });
                return `--- Content of ${file.name} (Word Document) ---\n\n${result.value}`;
            }

            if (file.name.match(/\.xlsx?$/i)) {
                 const workbook = XLSX.read(arrayBuffer, { type: 'array' });
                 let text = `--- Content of ${file.name} (Excel Document) ---\n`;
                 workbook.SheetNames.forEach(sheetName => {
                     const sheet = workbook.Sheets[sheetName];
                     const csv = XLSX.utils.sheet_to_csv(sheet);
                     text += `\n[Sheet: ${sheetName}]\n${csv}\n`;
                 });
                 return text;
            }

            if (file.name.match(/\.pptx$/i)) {
                const zip = await JSZip.loadAsync(arrayBuffer);
                let text = `--- Content of ${file.name} (PowerPoint Presentation) ---\n`;
                
                // Basic slide extraction
                const slideFiles = Object.keys(zip.files).filter(k => k.match(/ppt\/slides\/slide\d+\.xml/));
                
                slideFiles.sort((a, b) => {
                    const matchA = a.match(/slide(\d+)\.xml/);
                    const matchB = b.match(/slide(\d+)\.xml/);
                    const numA = matchA ? parseInt(matchA[1]) : 0;
                    const numB = matchB ? parseInt(matchB[1]) : 0;
                    return numA - numB;
                });

                for (const slidePath of slideFiles) {
                    const slideXml = await zip.file(slidePath)?.async('string');
                    if (slideXml) {
                        const parser = new DOMParser();
                        const xmlDoc = parser.parseFromString(slideXml, "text/xml");
                        const textNodes = xmlDoc.getElementsByTagName("a:t");
                        let slideText = "";
                        for(let i=0; i<textNodes.length; i++) {
                            slideText += textNodes[i].textContent + " ";
                        }
                        if (slideText.trim()) {
                            const slideNum = slidePath.match(/slide(\d+)/)?.[1] || '?';
                            text += `\n[Slide ${slideNum}]\n${slideText.trim()}\n`;
                        }
                    }
                }
                return text;
            }
        }
        
        // Text Files (js, ts, py, txt, md, json, etc)
        // Assume if it's not a binary media type (image/video/audio) and not above docs, it's text.
        // Or if content starts with 'data:text' or 'data:application/json' etc.
        const mime = file.content.split(';')[0].split(':')[1] || '';
        if (mime.startsWith('text/') || mime.includes('json') || mime.includes('javascript') || mime.includes('xml')) {
            return `--- Content of ${file.name} ---\n${base64ToString(file.content)}`;
        }

        // Fallback for simple text extensions
        if (file.name.match(/\.(txt|md|js|ts|tsx|jsx|html|css|py|json|csv|xml|yaml|yml|log|ini|conf|sh|bat)$/i)) {
             return `--- Content of ${file.name} ---\n${base64ToString(file.content)}`;
        }

        return `[Binary File: ${file.name}] (Use 'analyze_media' to inspect if it is an image/video)`;

    } catch (e: any) {
        console.error("Parse error", e);
        return `Error parsing document: ${e.message}`;
    }
};