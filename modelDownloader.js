const { app } = require('electron');
const https = require('https');
const http = require('http');
const fs = require('fs');
const path = require('path');
const { URL } = require('url');

class ModelDownloader {
    constructor() {
        // Gunakan environment variable atau default ke localhost
        this.laravelBaseUrl = process.env.APP_URL || 'http://localhost:8000';
        this.localModelPath = 'D:\\Electron-FR\\scripts\\Model';
        this.apiEndpoint = '/api/models';
          // Pastikan direktori local ada
        this.ensureDirectoryExists();
    }


    /**
     * Test models endpoint specifically
     */
    async testModelsEndpoint() {
        return new Promise((resolve, reject) => {
            const url = `${this.laravelBaseUrl}${this.apiEndpoint}/list`;
            console.log(`Testing models endpoint: ${url}`);
            
            this.makeRequest(url, (data, statusCode, error) => {
                if (error) {
                    reject(error);
                    return;
                }
                
                console.log(`Models endpoint status: ${statusCode}`);
                resolve({
                    status: statusCode,
                    data: data,
                    url: url
                });
            });
        });
    }

    /**
     * Pastikan direktori model local exists
     */
    ensureDirectoryExists() {
        try {
            if (!fs.existsSync(this.localModelPath)) {
                fs.mkdirSync(this.localModelPath, { recursive: true });
                console.log('Created model directory:', this.localModelPath);
            }
        } catch (error) {
            console.error('Error creating directory:', error);
        }
    }    /**
     * Mendapatkan daftar file model dari server
     */
    async getModelList() {
        return new Promise((resolve, reject) => {
            const url = `${this.laravelBaseUrl}${this.apiEndpoint}/list`;
            console.log(`Getting model list from: ${url}`); // Debug log
            
            this.makeRequest(url, (data, statusCode) => {
                try {
                    console.log(`Model list response status: ${statusCode}`); // Debug log
                    console.log(`Model list response data: ${data}`); // Debug log
                    
                    if (statusCode !== 200) {
                        reject(new Error(`HTTP ${statusCode} when getting model list from ${url}`));
                        return;
                    }
                    
                    const response = JSON.parse(data);
                    if (response.success) {
                        resolve(response.files);
                    } else {
                        reject(new Error('Failed to get model list: ' + (response.message || 'Unknown error')));
                    }
                } catch (error) {
                    console.error('Error parsing model list response:', error);
                    reject(error);
                }
            });
        });
    }    /**
     * Download file individual dengan mode background
     */
    async downloadFile(fileName, silent = true) {
        return new Promise(async (resolve, reject) => {
            try {
                // First get the model list to find the correct download URL
                const remoteFiles = await this.getModelList();
                const fileInfo = remoteFiles.find(file => file.name === fileName);
                
                if (!fileInfo) {
                    reject(new Error(`File ${fileName} not found in remote file list`));
                    return;
                }
                
                // Use the download_url from the API response if available
                const downloadUrl = fileInfo.download_url || `${this.laravelBaseUrl}${this.apiEndpoint}/download/${fileName}`;
                
                // Try different URL formats to handle potential routing issues
                const urls = [
                    downloadUrl, // Use the URL provided by the API first
                    `${this.laravelBaseUrl}${this.apiEndpoint}/download/${fileName}`,
                    `${this.laravelBaseUrl}/api/models/download/${fileName}`,
                    `${this.laravelBaseUrl}/models/download/${fileName}`,
                    `${this.laravelBaseUrl}/storage/models/${fileName}` // Direct storage access
                ];
                
                this.tryDownloadFromUrls(urls, fileName, silent, 0, resolve, reject);
            } catch (error) {
                reject(error);
            }
        });
    }

    /**
     * Try downloading from multiple URLs
     */
    tryDownloadFromUrls(urls, fileName, silent, urlIndex, resolve, reject) {
        if (urlIndex >= urls.length) {
            reject(new Error(`Failed to download ${fileName} from all attempted URLs`));
            return;
        }

        const url = urls[urlIndex];
        const localFilePath = path.join(this.localModelPath, fileName);
        
        if (!silent) console.log(`Trying URL ${urlIndex + 1}/${urls.length}: ${url}`);
        console.log(`Request URL: ${url}`); // Debug log
        
        const protocol = url.startsWith('https') ? https : http;
        const file = fs.createWriteStream(localFilePath);
        
        const request = protocol.get(url, (response) => {
            console.log(`Response status: ${response.statusCode} for ${fileName} from ${url}`); // Debug log
              if (response.statusCode === 200) {
                // Success! Proceed with download
                response.pipe(file);
                
                file.on('finish', () => {
                    file.close();
                    if (!silent) console.log(`Downloaded: ${fileName} from ${url}`);
                    resolve(localFilePath);
                });
                
                file.on('error', (error) => {
                    fs.unlink(localFilePath, () => {});
                    reject(error);
                });
            } else if (response.statusCode === 301 || response.statusCode === 302) {
                // Handle redirects
                file.close();
                fs.unlink(localFilePath, () => {});
                
                const redirectUrl = response.headers.location;
                if (redirectUrl) {
                    console.log(`Redirect to: ${redirectUrl}`);
                    urls[urlIndex] = redirectUrl;
                    this.tryDownloadFromUrls(urls, fileName, silent, urlIndex, resolve, reject);
                } else {
                    this.tryDownloadFromUrls(urls, fileName, silent, urlIndex + 1, resolve, reject);
                }
            } else {
                // Try to get error details from response body
                let errorData = '';
                response.on('data', (chunk) => {
                    errorData += chunk;
                });
                
                response.on('end', () => {
                    file.close();
                    fs.unlink(localFilePath, () => {});
                    
                    let errorMessage = `HTTP ${response.statusCode}`;
                    try {
                        const errorJson = JSON.parse(errorData);
                        if (errorJson.error) {
                            errorMessage += `: ${errorJson.error}`;
                        }
                    } catch (e) {
                        // If not JSON, use raw response
                        if (errorData && errorData.length < 200) {
                            errorMessage += `: ${errorData}`;
                        }
                    }
                    
                    console.log(`Failed with ${errorMessage} from ${url}, trying next URL...`);
                    this.tryDownloadFromUrls(urls, fileName, silent, urlIndex + 1, resolve, reject);
                });
            }
        });
        
        request.on('error', (error) => {
            console.error(`Request error for ${fileName} from ${url}:`, error);
            file.close();
            fs.unlink(localFilePath, () => {});
            // Try next URL
            this.tryDownloadFromUrls(urls, fileName, silent, urlIndex + 1, resolve, reject);
        });
        
        // Add timeout handling
        request.setTimeout(30000, () => {
            request.destroy();
            file.close();
            fs.unlink(localFilePath, () => {});
            console.log(`Request timeout for ${fileName} from ${url}, trying next URL...`);
            this.tryDownloadFromUrls(urls, fileName, silent, urlIndex + 1, resolve, reject);
        });
    }

    /**
     * Original download method (kept for backward compatibility)
     */
    async downloadFileSingle(fileName, silent = true) {
        return new Promise((resolve, reject) => {
            const url = `${this.laravelBaseUrl}${this.apiEndpoint}/download/${fileName}`;
            const localFilePath = path.join(this.localModelPath, fileName);
            
            if (!silent) console.log(`Downloading: ${fileName}`);
            console.log(`Request URL: ${url}`); // Debug log
            
            const protocol = url.startsWith('https') ? https : http;
            const file = fs.createWriteStream(localFilePath);
            
            const request = protocol.get(url, (response) => {
                console.log(`Response status: ${response.statusCode} for ${fileName}`); // Debug log
                console.log(`Response headers:`, response.headers); // Debug log
                
                if (response.statusCode !== 200) {
                    file.close();
                    fs.unlink(localFilePath, () => {}); // Clean up incomplete file
                    reject(new Error(`HTTP ${response.statusCode}: ${response.statusMessage} for URL: ${url}`));
                    return;                }
                
                response.pipe(file);
                
                file.on('finish', () => {
                    file.close();
                    if (!silent) console.log(`Downloaded: ${fileName}`);
                    resolve(localFilePath);
                });
                
                file.on('error', (error) => {
                    fs.unlink(localFilePath, () => {}); // Hapus file yang gagal
                    reject(error);
                });
                
            });
            
            request.on('error', (error) => {
                console.error(`Request error for ${fileName}:`, error);
                file.close();
                fs.unlink(localFilePath, () => {});
                reject(error);
            });
            
            // Add timeout handling
            request.setTimeout(30000, () => {
                request.destroy();
                file.close();
                fs.unlink(localFilePath, () => {});
                reject(new Error(`Request timeout for ${fileName}`));
            });
        });
    }

    /**
     * Cek apakah file perlu diupdate berdasarkan timestamp
     */
    needsUpdate(localFile, remoteModified) {
        try {
            if (!fs.existsSync(localFile)) {
                return true;
            }
            
            const localStats = fs.statSync(localFile);
            const localModified = localStats.mtime;
            const remoteDate = new Date(remoteModified);
            
            return remoteDate > localModified;
        } catch (error) {
            return true; // Jika error, download ulang
        }
    }    /**
     * Sync semua model files dengan mode background
     */
    async syncModels(silent = true) {
        try {
            if (!silent) console.log('Starting model synchronization...');
            
            
            const remoteFiles = await this.getModelList();
            const downloadPromises = [];
            const errors = [];
            
            for (const file of remoteFiles) {
                const localFilePath = path.join(this.localModelPath, file.name);
                
                if (this.needsUpdate(localFilePath, file.modified)) {
                    try {
                        const result = await this.downloadFile(file.name, silent);
                        downloadPromises.push(result);
                        if (!silent) console.log(`✓ Downloaded: ${file.name}`);
                    } catch (error) {
                        const errorMsg = `✗ Failed to download ${file.name}: ${error.message}`;
                        errors.push(errorMsg);
                        if (!silent) console.error(errorMsg);
                        
                        // If it's a "File type not allowed" error, provide specific guidance
                        if (error.message.includes('File type not allowed') || error.message.includes('403')) {
                            console.error(`  → This is likely a Laravel configuration issue. The server is blocking .${file.name.split('.').pop()} files.`);
                            console.error(`  → Check your Laravel controller's file type validation.`);
                        }
                    }
                } else {
                    if (!silent) console.log(`⏭ Skipped (up to date): ${file.name}`);
                }
            }
            
            const result = {
                success: errors.length === 0,
                downloaded: downloadPromises.length,
                total: remoteFiles.length,
                errors: errors
            };
            
            if (!silent) {
                if (errors.length > 0) {
                    console.log(`❌ Sync completed with ${errors.length} errors. Downloaded ${downloadPromises.length}/${remoteFiles.length} files`);
                    console.log('Errors:');
                    errors.forEach(error => console.log(`  ${error}`));
                } else {
                    console.log(`✅ Sync completed successfully. Downloaded ${downloadPromises.length}/${remoteFiles.length} files`);
                }
            }
            
            return result;
            
        } catch (error) {
            if (!silent) console.error('Error during model sync:', error);
            throw error;
        }
    }/**
     * Helper method untuk HTTP requests
     */
    makeRequest(url, callback) {
        const protocol = url.startsWith('https') ? https : http;
        
        const request = protocol.get(url, (response) => {
            let data = '';
            
            console.log(`makeRequest response status: ${response.statusCode} for ${url}`); // Debug log
            
            response.on('data', (chunk) => {
                data += chunk;
            });
            
            response.on('end', () => {
                callback(data, response.statusCode);
            });
            
        });
        
        request.on('error', (error) => {
            console.error('Request error:', error);
            callback(null, 0, error);
        });
        
        // Add timeout
        request.setTimeout(30000, () => {
            request.destroy();
            callback(null, 0, new Error('Request timeout'));
        });
    }

    /**
     * Download dengan progress tracking
     */
    async downloadWithProgress(fileName, onProgress) {
        return new Promise((resolve, reject) => {
            const url = `${this.laravelBaseUrl}${this.apiEndpoint}/download/${fileName}`;
            const localFilePath = path.join(this.localModelPath, fileName);
            
            const protocol = url.startsWith('https') ? https : http;
            const file = fs.createWriteStream(localFilePath);
            
            protocol.get(url, (response) => {
                if (response.statusCode !== 200) {
                    reject(new Error(`HTTP ${response.statusCode}`));
                    return;
                }
                
                const totalSize = parseInt(response.headers['content-length'], 10);
                let downloadedSize = 0;
                
                response.on('data', (chunk) => {
                    downloadedSize += chunk.length;
                    if (onProgress && totalSize) {
                        const progress = (downloadedSize / totalSize) * 100;
                        onProgress(progress, downloadedSize, totalSize);
                    }
                });
                
                response.pipe(file);
                
                file.on('finish', () => {
                    file.close();
                    resolve(localFilePath);
                });
                
                file.on('error', (error) => {
                    fs.unlink(localFilePath, () => {});
                    reject(error);
                });
                
            }).on('error', reject);
        });
    }
}

module.exports = ModelDownloader;