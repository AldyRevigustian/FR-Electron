const ModelDownloader = require('./modelDownloader');

async function testSync() {
    const downloader = new ModelDownloader();
    
    console.log('=== Testing Improved Sync Method ===');
    
    try {
        const result = await downloader.syncModels(false); // verbose mode
        console.log('\nSync Result:', result);
    } catch (error) {
        console.error('Sync Error:', error.message);
    }
}

testSync().catch(console.error);
