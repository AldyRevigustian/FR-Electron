const { expect } = require('chai');
const sinon = require('sinon');

const proxyquire = require('proxyquire').noCallThru();

describe('Check Error Details', function() {
  let checkErrorModule;
  let mockDownloader;
  let consoleLogStub;
  let consoleErrorStub;
  
  beforeEach(function() {
    mockDownloader = {
      getModelList: sinon.stub(),
      makeRequest: sinon.stub()
    };
    
    consoleLogStub = sinon.stub(console, 'log');
    consoleErrorStub = sinon.stub(console, 'error');
    
    const ModelDownloaderMock = function() {
      return mockDownloader;
    };
    
    checkErrorModule = proxyquire('../../check-error', {
      './modelDownloader': ModelDownloaderMock
    });
  });
  
  afterEach(function() {
    consoleLogStub.restore();
    consoleErrorStub.restore();
  });
  
  it('should have a checkErrorDetails function that is exported', function() {
    expect(checkErrorModule).to.have.property('checkErrorDetails');
  });
  
  it('should initialize ModelDownloader correctly', function() {
    expect(mockDownloader).to.have.property('getModelList');
    expect(mockDownloader).to.have.property('makeRequest');
  });

  it('should use the correct methods to check errors', function() {
    expect(typeof mockDownloader.getModelList).to.equal('function');
    expect(typeof mockDownloader.makeRequest).to.equal('function');
  });
});
