// main.js
const { app, BrowserWindow, ipcMain } = require('electron');
const path = require('path');
const fs = require('fs');
const { spawn } = require('child_process');
require('dotenv').config();

const ElectronStore = require('electron-store').default;
const store = new ElectronStore();
let mainWindow;
let pythonProcess;

const PYTHON_EXECUTABLE = process.platform === 'win32' ? 'python' : 'python3';
const PYTHON_SCRIPT_PATH = path.join(__dirname, '/scripts/', 'main.py');
const envFilePath = path.join(__dirname, '.env'); // .env file in root folder
const URL_API = process.env.APP_URL + '/api'

function createWindow() {
  mainWindow = new BrowserWindow({
    width: 800,
    height: 600,
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      contextIsolation: true,
      enableRemoteModule: false,
    },
  });

  mainWindow.loadFile('src/html/login.html');

  // mainWindow.webContents.openDevTools(); // For debugging
}

app.whenReady().then(() => {
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
      // console.log(kelasData);
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

ipcMain.on('start-recognition', (event, { classId, className, courseId, courseName }) => {
  if (pythonProcess) {
    console.log('Recognition already running. Killing previous process.');
    pythonProcess.kill();
  }

  const projectPath = app.getAppPath();
  const paramsForPython = JSON.stringify({
    selected_class_id: classId,
    selected_class_name: className,
    selected_course_id: courseId,
    selected_course_name: courseName,
    project_path: projectPath,
    env_path: envFilePath
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

// Navigate to different pages
ipcMain.on('navigate', (event, page) => {
  const pagePath = path.join(__dirname, `src/html/${page}.html`);
  if (fs.existsSync(pagePath)) {
    mainWindow.loadFile(pagePath);
  } else {
    console.error(`Page not found: ${pagePath}`);
  }
});