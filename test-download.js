const ModelDownloader = require('./modelDownloader');

async function testDownload() {
    const downloader = new ModelDownloader();

    console.log('=== Download Test ===');

    try {
        console.log('Getting file list...');
        const files = await downloader.getModelList();
        console.log('Files available:', files.map(f => f.name));

        if (files.length > 0) {
            const testFile = files[0];
            console.log(`\nTesting download of: ${testFile.name}`);
            console.log(`Official download URL: ${testFile.download_url}`);

            try {
                const result = await downloader.downloadFile(testFile.name, false);
                console.log(`Download successful: ${result}`);
            } catch (error) {
                console.error(`Download failed: ${error.message}`);

                console.log('\nTrying manual test of download URL...');
                await new Promise((resolve) => {
                    downloader.makeRequest(testFile.download_url, (data, statusCode, error) => {
                        if (error) {
                            console.log(`Manual test error: ${error.message}`);
                        } else {
                            console.log(`Manual test status: ${statusCode}`);
                            if (statusCode !== 200) {
                                console.log(`Response data: ${data.substring(0, 500)}...`);
                            } else {
                                console.log(`Response looks good (${data.length} bytes)`);
                            }
                        }
                        resolve();
                    });
                });
            }
        } else {
            console.log('No files available to test');
        }
    } catch (error) {
        console.error('Test failed:', error);
    }
}

testDownload().catch(console.error);
