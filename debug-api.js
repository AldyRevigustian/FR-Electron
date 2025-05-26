const ModelDownloader = require('./modelDownloader');

async function debugAPI() {
    const downloader = new ModelDownloader();
    
    console.log('=== API Debug Tool ===');
    console.log(`Base URL: ${downloader.laravelBaseUrl}`);
    console.log(`API Endpoint: ${downloader.apiEndpoint}`);
    console.log('');
    
    try {
        console.log('1. Testing connection...');
        const connectionTest = await downloader.testConnection();
        console.log('Connection test result:', connectionTest);
        console.log('');
    } catch (error) {
        console.error('Connection test failed:', error.message);
        console.log('');
    }
    
    try {
        console.log('2. Testing model list endpoint...');
        const modelList = await downloader.getModelList();
        console.log('Model list:', modelList);
        console.log('');
    } catch (error) {
        console.error('Model list failed:', error.message);
        console.log('');
    }
    
    console.log('3. Testing alternative endpoints...');
    const testUrls = [
        `${downloader.laravelBaseUrl}/api/models/list`,
        `${downloader.laravelBaseUrl}/models/list`,
        `${downloader.laravelBaseUrl}/api/models`,
        `${downloader.laravelBaseUrl}/models`
    ];
    
    for (const url of testUrls) {
        try {
            console.log(`Testing: ${url}`);
            await new Promise((resolve, reject) => {
                downloader.makeRequest(url, (data, statusCode, error) => {
                    if (error) {
                        console.log(`  Error: ${error.message}`);
                    } else {
                        console.log(`  Status: ${statusCode}`);
                        if (statusCode === 200) {
                            console.log(`  Response: ${data.substring(0, 200)}...`);
                        }
                    }
                    resolve();
                });
            });
        } catch (error) {
            console.log(`  Failed: ${error.message}`);
        }
    }
    
    console.log('');
    console.log('=== Debug Complete ===');
}

if (require.main === module) {
    debugAPI().catch(console.error);
}

module.exports = {
    debugAPI
};
