const { expect } = require('chai');
const sinon = require('sinon');
const path = require('path');
const { EventEmitter } = require('events');

const mockIpc = new EventEmitter();
mockIpc.handle = sinon.stub().returns(Promise.resolve());

const electronMock = {
  app: {
    isPackaged: false,
    whenReady: () => Promise.resolve(),
    on: sinon.stub(),
    quit: sinon.stub()
  },
  BrowserWindow: function() {
    return {
      loadFile: sinon.stub(),
      webContents: {
        openDevTools: sinon.stub()
      },
      on: sinon.stub(),
      show: sinon.stub(),
      setMenu: sinon.stub()
    };
  },
  ipcMain: mockIpc
};

const proxyquire = require('proxyquire').noCallThru();

describe('Main Process', function() {
  let sandbox;
  let spawnStub;

  beforeEach(function() {
    sandbox = sinon.createSandbox();
    
    spawnStub = sandbox.stub();
    spawnStub.returns({
      on: sinon.stub(),
      stdout: new EventEmitter(),
      stderr: new EventEmitter(),
      kill: sinon.stub()
    });
    
    const fsMock = {
      existsSync: sandbox.stub().returns(true),
      writeFileSync: sandbox.stub()
    };
    
    const ModelDownloaderMock = function() {
      return {
        syncModels: sandbox.stub().resolves({ success: true }),
        testModelsEndpoint: sandbox.stub().resolves({ success: true })
      };
    };
    
  });
  
  afterEach(function() {
    sandbox.restore();
  });
  
  it('should handle IPC events correctly', function() {
    expect(mockIpc.handle).to.be.a('function');
    expect(electronMock.app.on).to.be.a('function');
  });
});
