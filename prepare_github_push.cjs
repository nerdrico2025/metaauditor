const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');

try {
    // Get file list - using git ls-files to respect .gitignore
    console.log("Listing tracked files...");
    const trackedFiles = execSync('git ls-files', { encoding: 'utf-8' }).split('\n').filter(Boolean);

    console.log("Listing untracked files...");
    const untrackedFiles = execSync('git ls-files --others --exclude-standard', { encoding: 'utf-8' }).split('\n').filter(Boolean);

    const allFiles = [...new Set([...trackedFiles, ...untrackedFiles])];
    console.log(`Found ${allFiles.length} files to process.`);

    const BATCH_SIZE = 40; // Conservative batch size
    let batches = [];
    let currentBatch = [];

    for (const file of allFiles) {
        // Skip if directory or special files
        if (fs.existsSync(file) && fs.lstatSync(file).isDirectory()) continue;
        if (file === 'prepare_github_push.js') continue;
        if (file === 'prepare_github_push.cjs') continue;
        if (file.includes('package-lock.json')) continue;

        try {
            // Read as base64 if binary, but mcp tool expects string content usually. 
            // Current tool definition says "content" is string. 
            // If file is binary (image?), we might have issues. 
            // For now, assume text. If we encounter binary, we might fail.
            // We can try to detect binary and skip or handle.

            const content = fs.readFileSync(file, 'utf-8');
            currentBatch.push({ path: file, content });
        } catch (err) {
            console.error(`Error reading ${file}: ${err.message}`);
            // Skip binary files or read errors
        }

        if (currentBatch.length >= BATCH_SIZE) {
            batches.push(currentBatch);
            currentBatch = [];
        }
    }

    if (currentBatch.length > 0) {
        batches.push(currentBatch);
    }

    // Write batches to files
    batches.forEach((batch, index) => {
        fs.writeFileSync(`push_batch_${index + 1}.json`, JSON.stringify(batch, null, 2));
        console.log(`Created push_batch_${index + 1}.json with ${batch.length} files.`);
    });

    console.log(`Total batches: ${batches.length}`);

} catch (error) {
    console.error('Error:', error);
}
