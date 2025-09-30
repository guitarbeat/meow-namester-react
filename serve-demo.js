#!/usr/bin/env node

/**
 * Simple HTTP server to serve the theme demo files
 */

const http = require('http');
const fs = require('fs');
const path = require('path');
const { URL } = require('url');

const PORT = 3000;

const mimeTypes = {
    '.html': 'text/html',
    '.css': 'text/css',
    '.js': 'application/javascript',
    '.json': 'application/json',
    '.png': 'image/png',
    '.jpg': 'image/jpeg',
    '.jpeg': 'image/jpeg',
    '.gif': 'image/gif',
    '.svg': 'image/svg+xml',
    '.ico': 'image/x-icon'
};

function getMimeType(filePath) {
    const ext = path.extname(filePath).toLowerCase();
    return mimeTypes[ext] || 'text/plain';
}

function serveFile(filePath, res) {
    fs.readFile(filePath, (err, data) => {
        if (err) {
            res.writeHead(404, { 'Content-Type': 'text/plain' });
            res.end('File not found');
            return;
        }
        
        const mimeType = getMimeType(filePath);
        res.writeHead(200, { 'Content-Type': mimeType });
        res.end(data);
    });
}

const server = http.createServer((req, res) => {
    const url = new URL(req.url, `http://localhost:${PORT}`);
    let filePath = path.join(__dirname, url.pathname);
    
    // Default to index.html for root
    if (url.pathname === '/') {
        filePath = path.join(__dirname, 'welcome-theme-comparison.html');
    }
    
    // Security check - prevent directory traversal
    if (!filePath.startsWith(__dirname)) {
        res.writeHead(403, { 'Content-Type': 'text/plain' });
        res.end('Forbidden');
        return;
    }
    
    // Check if file exists
    fs.stat(filePath, (err, stats) => {
        if (err || !stats.isFile()) {
            res.writeHead(404, { 'Content-Type': 'text/plain' });
            res.end('File not found');
            return;
        }
        
        serveFile(filePath, res);
    });
});

server.listen(PORT, () => {
    console.log('🎨 Welcome Screen Theme Demo Server');
    console.log('====================================\n');
    console.log(`🚀 Server running at http://localhost:${PORT}`);
    console.log('\n📱 Available demos:');
    console.log(`   • Side-by-side comparison: http://localhost:${PORT}/`);
    console.log(`   • Interactive demo: http://localhost:${PORT}/welcome-screen-demo.html`);
    console.log(`   • Theme comparison: http://localhost:${PORT}/welcome-theme-comparison.html`);
    console.log('\n💡 Use the theme toggle buttons to switch between light and dark modes');
    console.log('🔄 Press Ctrl+C to stop the server\n');
});

// Handle Ctrl+C
process.on('SIGINT', () => {
    console.log('\n🛑 Stopping demo server...');
    server.close(() => {
        console.log('✅ Demo server stopped');
        process.exit(0);
    });
});