const { app, BrowserWindow, ipcMain } = require('electron');
const path = require('path');
const fs = require('fs');
const { spawn } = require('child_process');

// Configure dotenv with proper path for both dev and production
const envPath = app.isPackaged 
  ? path.join(__dirname, '.env')
  : path.join(__dirname, '.env');

require('dotenv').config({ path: envPath });

const ModelDownloader = require('./modelDownloader');

let mainWindow;
let pythonProcess;
let modelDownloader;
let modelsReady = false;

const PYTHON_EXECUTABLE = process.platform === 'win32' ? 'python' : 'python3';
const PYTHON_SCRIPT_PATH = app.isPackaged
  ? path.join(process.resourcesPath, 'scripts', 'main.py')
  : path.join(__dirname, 'scripts', 'main.py');
const envFilePath = app.isPackaged
  ? path.join(process.resourcesPath, '.env')
  : path.join(__dirname, '.env');
const URL_API = process.env.APP_URL + '/api';

// Debug logging for environment variables
console.log('Environment variables loaded:');
console.log('APP_URL:', process.env.APP_URL);
console.log('URL_API:', URL_API);
console.log('envPath:', envPath);
console.log('envFilePath:', envFilePath);

modelDownloader = new ModelDownloader();

async function downloadModelsBeforeStart() {
  try {
    console.log('Starting background model sync...');
    const result = await modelDownloader.syncModels(true);
    modelsReady = true;
    console.log(`Background model sync completed - Downloaded: ${result.downloaded}/${result.total} files`);
  } catch (error) {
    console.error('Background model sync failed:', error);
    modelsReady = false;
  }
}

function createWindow() {
  mainWindow = new BrowserWindow({
    width: 800,
    height: 600,
    show: false,
    webPreferences: {
      preload: app.isPackaged
        ? path.join(__dirname, 'preload.js')
        : path.join(__dirname, 'preload.js'),
      contextIsolation: true,
      enableRemoteModule: false,
    },
  });

  mainWindow.loadFile(app.isPackaged
    ? path.join(__dirname, 'src/html/login.html')
    : 'src/html/login.html');


  mainWindow.once('ready-to-show', () => {
    mainWindow.show();
  });


}

downloadModelsBeforeStart();

app.whenReady().then(async () => {
  if (!modelsReady) {
    console.log('Waiting for model download to complete...');
    await downloadModelsBeforeStart();
  }

  createWindow();

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) createWindow();
  });
});

app.on('window-all-closed', () => {
  if (pythonProcess) {
    pythonProcess.kill();
  }
  if (process.platform !== 'darwin') app.quit();
});

ipcMain.handle('check-models-status', async () => {
  return { ready: modelsReady };
});

ipcMain.handle('sync-models', async () => {
  try {
    const result = await modelDownloader.syncModels(false);
    return {
      success: true,
      message: `Models synced successfully - Downloaded: ${result.downloaded}/${result.total} files`
    };
  } catch (error) {
    return { success: false, message: error.message };
  }
});

ipcMain.handle('login', async (event, { email, password }) => {
  const axios = require('axios');
  const FormData = require('form-data');

  // Validate URL_API
  if (!process.env.APP_URL || process.env.APP_URL === 'undefined') {
    console.error('APP_URL is not defined in environment variables');
    return { 
      success: false, 
      message: 'Server configuration error: APP_URL not found. Please check .env file.' 
    };
  }

  const API_URL = process.env.APP_URL + '/api';
  console.log('Using API URL for login:', API_URL);

  const data = new FormData();
  data.append('email', email);
  data.append('password', password);

  try {
    const response = await axios.post(API_URL + '/guru/login', data, {
      headers: data.getHeaders(),
      maxBodyLength: Infinity,
    });

    const resData = response.data;

    if (resData.token && resData.user) {
      const kelasResponse = await axios.get('http://127.0.0.1:8000/api/guru/kelas', {
        headers: {
          'Authorization': `Bearer ${resData.token}`,
          'Content-Type': 'application/json',
          'Accept': 'application/json'
        }
      });
      const kelasData = kelasResponse.data;

      console.log('Kelas data:', kelasData.data);

      return {
        success: true,
        message: resData.message,
        user: resData.user,
        token: resData.token,
        kelas: kelasData.data
      };

    } else {
      return { success: false, message: 'Login gagal: data token atau user tidak ditemukan' };
    }

  } catch (error) {
    console.error('Login error:', error);
    if (error.response) {
      return {
        success: false,
        status: error.response.status,
        message: error.response.data?.message || 'Login gagal',
      };
    }
    return { success: false, message: error.message };
  }
});

ipcMain.on('start-recognition', (event, { classId, className, tipeAbsen }) => {
  if (pythonProcess) {
    console.log('Recognition already running. Killing previous process.');
    pythonProcess.kill();
  }

  // Get proper project path for both dev and packaged app
  const projectPath = app.isPackaged 
    ? process.resourcesPath 
    : app.getAppPath();
    
  const paramsForPython = JSON.stringify({
    selected_class_id: classId,
    selected_class_name: className,
    project_path: projectPath,
    env_path: envFilePath,
    tipe_absen: tipeAbsen,
    is_packaged: app.isPackaged
  });

  console.log(`Starting Python script: ${PYTHON_EXECUTABLE} ${PYTHON_SCRIPT_PATH}`);
  console.log(`Project path: ${projectPath}`);
  console.log(`Env file path: ${envFilePath}`);
  console.log(`Is packaged: ${app.isPackaged}`);
  console.log(`With parameters: ${paramsForPython}`);

  pythonProcess = spawn(PYTHON_EXECUTABLE, [PYTHON_SCRIPT_PATH], {
    stdio: ['pipe', 'pipe', 'pipe'],
  });

  pythonProcess.stdin.write(paramsForPython + '\n');
  pythonProcess.stdin.end();

  pythonProcess.stdout.on('data', (data) => {
    const message = data.toString();
    console.log(`Python stdout: ${message}`);
  });

  pythonProcess.stderr.on('data', (data) => {
    const message = data.toString();
    console.error(`Python stderr: ${message}`);
    mainWindow.webContents.send('python-error', message);
  });

  pythonProcess.on('close', (code) => {
    console.log(`Python script exited with code ${code}`);
    mainWindow.webContents.send('recognition-finished', `Recognition process finished with code ${code}.`);
    pythonProcess = null;
  });

  pythonProcess.on('error', (err) => {
    console.error('Failed to start Python script:', err);
    mainWindow.webContents.send('python-error', `Failed to start face recognition: ${err.message}`);
    pythonProcess = null;
  });
});

ipcMain.on('navigate', (event, page) => {
  const pagePath = app.isPackaged
    ? path.join(__dirname, `src/html/${page}.html`)
    : path.join(__dirname, `src/html/${page}.html`);
  if (fs.existsSync(pagePath)) {
    mainWindow.loadFile(pagePath);
  } else {
    console.error(`Page not found: ${pagePath}`);
  }
});