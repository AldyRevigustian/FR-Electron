const { expect } = require('chai');
const sinon = require('sinon');
const path = require('path');
const fs = require('fs');
const ModelDownloader = require('../../modelDownloader');

describe('ModelDownloader', function() {
  let modelDownloader;
  let sandbox;
  
  beforeEach(function() {
    sandbox = sinon.createSandbox();
    
    process.env.APP_URL = 'http://test-server.com';
    global.electron = {
      app: {
        isPackaged: false
      }
    };
    
    sandbox.stub(fs, 'existsSync').returns(true);
    sandbox.stub(fs, 'mkdirSync').returns(undefined);
    
    modelDownloader = new ModelDownloader();
  });
  
  afterEach(function() {
    sandbox.restore();
    delete process.env.APP_URL;
    delete global.electron;
  });
  
  describe('constructor', function() {
    it('should initialize with correct base URL and local model path', function() {
      expect(modelDownloader.laravelBaseUrl).to.equal('http://test-server.com');
      expect(modelDownloader.localModelPath).to.include(path.join('scripts', 'Model'));
      expect(modelDownloader.apiEndpoint).to.equal('/api/models');
    });
  });
  
  describe('testModelsEndpoint', function() {    it('should resolve with success when API is accessible', function(done) {
      sandbox.stub(modelDownloader, 'makeRequest').callsFake((url, callback) => {
        callback(JSON.stringify({ success: true }), 200, null);
      });
      
      modelDownloader.testModelsEndpoint()
        .then(result => {
          expect(result).to.exist;
          done();
        })
        .catch(done);
    });
    
    it('should reject with error when API is not accessible', function(done) {
      sandbox.stub(modelDownloader, 'makeRequest').callsFake((url, callback) => {
        callback(null, 500, new Error('Server error'));
      });
      
      modelDownloader.testModelsEndpoint()
        .then(() => {
          done(new Error('Should have rejected'));
        })
        .catch(error => {
          expect(error.message).to.include('Server error');
          done();
        });
    });
  });
});
