
const { app, BrowserWindow, ipcMain } = require('electron');
const path = require('path');
const fs = require('fs');
const { spawn } = require('child_process');
require('dotenv').config();

const ElectronStore = require('electron-store').default;
const ModelDownloader = require('./modelDownloader');

const store = new ElectronStore();
let mainWindow;
let pythonProcess;
let modelDownloader;
let modelsReady = false;

const PYTHON_EXECUTABLE = process.platform === 'win32' ? 'python' : 'python3';
const PYTHON_SCRIPT_PATH = path.join(__dirname, '/scripts/', 'main.py');
const envFilePath = path.join(__dirname, '.env');
const URL_API = process.env.APP_URL + '/api'

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
      preload: path.join(__dirname, 'preload.js'),
      contextIsolation: true,
      enableRemoteModule: false,
    },
  });

  mainWindow.loadFile('src/html/login.html');


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

  const data = new FormData();
  data.append('email', email);
  data.append('password', password);

  try {
    const response = await axios.post(URL_API + '/guru/login', data, {
      headers: data.getHeaders(),
      maxBodyLength: Infinity,
    });

    const resData = response.data;

    if (resData.token && resData.user) {
      store.set('auth.token', resData.token);
      store.set('auth.email', resData.user.email);
      store.set('auth.name', resData.user.nama);

      const res = await fetch('http://127.0.0.1:8000/api/guru/kelas', {
        headers: {
          'Authorization': `Bearer ${resData.token}`,
          'Content-Type': 'application/json',
          'Accept': 'application/json'
        }
      });
      const kelasData = await res.json();

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

  const projectPath = app.getAppPath();
  const paramsForPython = JSON.stringify({
    selected_class_id: classId,
    selected_class_name: className,
    project_path: projectPath,
    env_path: envFilePath,
    tipe_absen: tipeAbsen,
  });

  console.log(`Starting Python script: ${PYTHON_EXECUTABLE} ${PYTHON_SCRIPT_PATH}`);
  console.log(`With parameters: ${paramsForPython}`);
  console.log(`Using .env file at: ${envFilePath}`);

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
  const pagePath = path.join(__dirname, `src/html/${page}.html`);
  if (fs.existsSync(pagePath)) {
    mainWindow.loadFile(pagePath);
  } else {
    console.error(`Page not found: ${pagePath}`);
  }
});