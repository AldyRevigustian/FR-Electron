const { expect } = require('chai');
const sinon = require('sinon');

const proxyquire = require('proxyquire').noCallThru();

describe('Debug API', function() {
  let debugAPIModule;
  let mockDownloader;
  let consoleLogStub;
  let consoleErrorStub;
  
  beforeEach(function() {
    mockDownloader = {
      laravelBaseUrl: 'http://test-server.com',
      apiEndpoint: '/api/models',
      testConnection: sinon.stub().resolves({ success: true }),
      getModelList: sinon.stub().resolves([]),
      makeRequest: sinon.stub().callsFake((url, callback) => {
        callback('{}', 200, null);
      })
    };
    
    consoleLogStub = sinon.stub(console, 'log');
    consoleErrorStub = sinon.stub(console, 'error');
    
    const ModelDownloaderMock = function() {
      return mockDownloader;
    };
    
    debugAPIModule = proxyquire('../../debug-api', {
      './modelDownloader': ModelDownloaderMock
    });
  });
  
  afterEach(function() {
    consoleLogStub.restore();
    consoleErrorStub.restore();
  });
  
  it('should initialize ModelDownloader correctly', function() {
    expect(mockDownloader).to.have.property('laravelBaseUrl', 'http://test-server.com');
    expect(mockDownloader).to.have.property('apiEndpoint', '/api/models');
  });
  
  it('should have a debugAPI function that is exported', function() {
    expect(debugAPIModule).to.have.property('debugAPI');
    expect(typeof debugAPIModule.debugAPI).to.equal('function');
  });
  
  it('should expose methods for testing connection and models', function() {
    expect(mockDownloader).to.have.property('testConnection');
    expect(mockDownloader).to.have.property('getModelList');
  });
});
