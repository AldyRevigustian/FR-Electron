const ModelDownloader = require('./modelDownloader');

async function checkErrorDetails() {
    const downloader = new ModelDownloader();
    
    console.log('=== Checking Error Details ===');
    
    try {
        const files = await downloader.getModelList();
        const testFile = files[0];
        
        console.log(`Testing download URL: ${testFile.download_url}`);
        
        await new Promise((resolve) => {
            downloader.makeRequest(testFile.download_url, (data, statusCode, error) => {
                console.log(`Status: ${statusCode}`);
                console.log(`Full response: ${data}`);
                resolve();
            });
        });
        
    } catch (error) {
        console.error('Error:', error);
    }
}

if (require.main === module) {
    checkErrorDetails().catch(console.error);
}

module.exports = {
    checkErrorDetails
};
