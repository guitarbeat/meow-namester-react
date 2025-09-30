#!/usr/bin/env node

/**
 * Demo script to show the welcome screen in both light and dark modes
 */

const { spawn } = require('child_process');
const path = require('path');
const fs = require('fs');

console.log('🎨 Welcome Screen Theme Demo');
console.log('============================\n');

// Check if we're in the right directory
if (!fs.existsSync('package.json')) {
    console.error('❌ Please run this script from the project root directory');
    process.exit(1);
}

// Check if node_modules exists
if (!fs.existsSync('node_modules')) {
    console.log('📦 Installing dependencies...');
    const install = spawn('npm', ['install'], { stdio: 'inherit' });
    install.on('close', (code) => {
        if (code === 0) {
            startDemo();
        } else {
            console.error('❌ Failed to install dependencies');
            process.exit(1);
        }
    });
} else {
    startDemo();
}

function startDemo() {
    console.log('🚀 Starting development server...');
    console.log('📱 Opening theme comparison page...\n');
    
    // Start the development server
    const devServer = spawn('npm', ['run', 'dev'], { stdio: 'pipe' });
    
    let serverReady = false;
    
    devServer.stdout.on('data', (data) => {
        const output = data.toString();
        console.log(output);
        
        // Check if server is ready
        if (output.includes('Local:') && !serverReady) {
            serverReady = true;
            console.log('\n✅ Development server is ready!');
            console.log('🌐 You can now view the theme demos:');
            console.log('   • Side-by-side comparison: file://' + path.resolve('welcome-theme-comparison.html'));
            console.log('   • Interactive demo: file://' + path.resolve('welcome-screen-demo.html'));
            console.log('   • React app: http://localhost:5173');
            console.log('\n💡 Use the theme toggle buttons to switch between light and dark modes');
            console.log('🔄 Press Ctrl+C to stop the server\n');
        }
    });
    
    devServer.stderr.on('data', (data) => {
        console.error(data.toString());
    });
    
    devServer.on('close', (code) => {
        console.log(`\n🛑 Development server stopped (exit code: ${code})`);
    });
    
    // Handle Ctrl+C
    process.on('SIGINT', () => {
        console.log('\n🛑 Stopping development server...');
        devServer.kill('SIGINT');
        process.exit(0);
    });
}