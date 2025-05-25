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
    }

    /**
     * Mendapatkan daftar file model dari server
     */
    async getModelList() {
        return new Promise((resolve, reject) => {
            const url = `${this.laravelBaseUrl}${this.apiEndpoint}/list`;
            
            this.makeRequest(url, (data) => {
                try {
                    const response = JSON.parse(data);
                    if (response.success) {
                        resolve(response.files);
                    } else {
                        reject(new Error('Failed to get model list'));
                    }
                } catch (error) {
                    reject(error);
                }
            });
        });
    }

    /**
     * Download file individual dengan mode background
     */
    async downloadFile(fileName, silent = true) {
        return new Promise((resolve, reject) => {
            const url = `${this.laravelBaseUrl}${this.apiEndpoint}/download/${fileName}`;
            const localFilePath = path.join(this.localModelPath, fileName);
            
            if (!silent) console.log(`Downloading: ${fileName}`);
            
            const protocol = url.startsWith('https') ? https : http;
            const file = fs.createWriteStream(localFilePath);
            
            protocol.get(url, (response) => {
                if (response.statusCode !== 200) {
                    reject(new Error(`HTTP ${response.statusCode}: ${response.statusMessage}`));
                    return;
                }
                
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
                
            }).on('error', (error) => {
                reject(error);
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
    }

    /**
     * Sync semua model files dengan mode background
     */
    async syncModels(silent = true) {
        try {
            if (!silent) console.log('Starting model synchronization...');
            
            const remoteFiles = await this.getModelList();
            const downloadPromises = [];
            
            for (const file of remoteFiles) {
                const localFilePath = path.join(this.localModelPath, file.name);
                
                if (this.needsUpdate(localFilePath, file.modified)) {
                    downloadPromises.push(this.downloadFile(file.name));
                } else {
                    if (!silent) console.log(`Skipped (up to date): ${file.name}`);
                }
            }
            
            if (downloadPromises.length > 0) {
                await Promise.all(downloadPromises);
                if (!silent) console.log(`Successfully downloaded ${downloadPromises.length} files`);
            } else {
                if (!silent) console.log('All files are up to date');
            }
            
            return {
                success: true,
                downloaded: downloadPromises.length,
                total: remoteFiles.length
            };
            
        } catch (error) {
            if (!silent) console.error('Error during model sync:', error);
            throw error;
        }
    }

    /**
     * Helper method untuk HTTP requests
     */
    makeRequest(url, callback) {
        const protocol = url.startsWith('https') ? https : http;
        
        protocol.get(url, (response) => {
            let data = '';
            
            response.on('data', (chunk) => {
                data += chunk;
            });
            
            response.on('end', () => {
                callback(data);
            });
            
        }).on('error', (error) => {
            console.error('Request error:', error);
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