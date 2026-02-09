
const fs = require('fs');
const path = require('path');

const inputPath = 'C:\\Users\\gusze\\.gemini\\antigravity\\brain\\a6d2db38-be49-4851-a8de-347f6d2d7dd5\\.system_generated\\steps\\2314\\output.txt';
const outputPath = 'c:\\Users\\gusze\\OneDrive\\Documentos\\Trabalho ClickHero Novo\\src\\integrations\\supabase\\types.ts';

try {
    const content = fs.readFileSync(inputPath, 'utf8');
    const json = JSON.parse(content);
    fs.writeFileSync(outputPath, json.types);
    console.log('Successfully wrote types to ' + outputPath);
} catch (e) {
    console.error('Error:', e);
}
