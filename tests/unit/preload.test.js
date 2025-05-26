const { expect } = require('chai');
const sinon = require('sinon');

const mockIpcRenderer = {
  invoke: sinon.stub(),
  send: sinon.stub(),
  on: sinon.stub(),
  removeAllListeners: sinon.stub()
};

const mockContextBridge = {
  exposeInMainWorld: sinon.stub()
};

const proxyquire = require('proxyquire').noCallThru();

describe('Preload Script', function() {
  let preloadScript;
  let exposeInMainWorldCall;
  let electronAPI;

  before(function() {
    preloadScript = proxyquire('../../preload.js', {
      'electron': {
        contextBridge: mockContextBridge,
        ipcRenderer: mockIpcRenderer
      }
    });
    
    exposeInMainWorldCall = mockContextBridge.exposeInMainWorld.firstCall;
    electronAPI = exposeInMainWorldCall ? exposeInMainWorldCall.args[1] : null;
  });

  it('should expose electronAPI to the renderer process', function() {
    expect(mockContextBridge.exposeInMainWorld.calledOnce).to.be.true;
    expect(exposeInMainWorldCall.args[0]).to.equal('electronAPI');
    expect(electronAPI).to.be.an('object');
  });

  it('should expose login method that invokes IPC', function() {
    const credentials = { username: 'test', password: 'pass' };
    electronAPI.login(credentials);
    
    expect(mockIpcRenderer.invoke.calledWith('login', credentials)).to.be.true;
  });

  it('should expose startRecognition method that sends IPC message', function() {
    const params = { mode: 'test' };
    electronAPI.startRecognition(params);
    
    expect(mockIpcRenderer.send.calledWith('start-recognition', params)).to.be.true;
  });

  it('should expose event listener methods', function() {
    const callback = sinon.spy();
    
    electronAPI.onPythonError(callback);
    
    const registeredCallback = mockIpcRenderer.on.args.find(args => args[0] === 'python-error')[1];
    
    registeredCallback({}, 'test error');
    
    expect(callback.calledWith('test error')).to.be.true;
  });
});
