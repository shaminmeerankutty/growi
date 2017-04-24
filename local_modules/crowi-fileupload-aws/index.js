// crowi-fileupload-aws

module.exports = function(crowi) {
  'use strict';

  var aws = require('aws-sdk')
    , debug = require('debug')('crowi:lib:fileUploaderAws')
    , Config = crowi.model('Config')
    , config = crowi.getConfig()
    , lib = {}
    , getAwsConfig = function() {
        var config = crowi.getConfig();
        return {
          accessKeyId: config.crowi['aws:accessKeyId'],
          secretAccessKey: config.crowi['aws:secretAccessKey'],
          region: config.crowi['aws:region'],
          bucket: config.crowi['aws:bucket']
        };
      };

  lib.deleteFile = function(filePath) {
    return new Promise(function(resolve, reject) {
      debug('Unsupported file deletion.');
      resolve('TODO: ...');
    });
  };

  lib.uploadFile = function(filePath, contentType, fileStream, options) {
    var awsConfig = getAwsConfig();
    if (!Config.isUploadable(config)) {
      return Promise.reject(new Error('AWS is not configured.'));
    }

    aws.config.update({
      accessKeyId: awsConfig.accessKeyId,
      secretAccessKey: awsConfig.secretAccessKey,
      region: awsConfig.region
    });
    var s3 = new aws.S3();

    var params = {Bucket: awsConfig.bucket};
    params.ContentType = contentType;
    params.Key = filePath;
    params.Body = fileStream;
    params.ACL = 'public-read';

    return new Promise(function(resolve, reject) {
      s3.putObject(params, function(err, data) {
        if (err) {
          return reject(err);
        }

        return resolve(data);
      });
    });
  };

  lib.generateUrl = function(filePath) {
    var awsConfig = getAwsConfig()
      , url = 'https://' + awsConfig.bucket +'.s3.amazonaws.com/' + filePath;

    return url;
  };

  lib.findDeliveryFile = function (attachment) {
    var cacheFile = lib.createCacheFileName(attachment);

    return new Promise((resolve, reject) => {
      debug('find delivery file', cacheFile);
      if (!lib.shouldUpdateCacheFile(cacheFile)) {
        return resolve(cacheFile);
      }

      var fs = require('fs');
      var loader = require('https');

      var fileStream = fs.createWriteStream(cacheFile);
      var fileUrl = lib.generateUrl(attachment.filePath);
      debug('Load attachement file into local cache file', fileUrl, cacheFile);
      var request = loader.get(fileUrl, function(response) {
        response.pipe(fileStream, { end: false });
        response.on('end', () => {
          fileStream.end();
          resolve(cacheFile);
        });
      });
    });
  };

  // private
  lib.createCacheFileName = function(attachment) {
    return crowi.cacheDir + '/attachment-' + attachment._id;
  };

  // private
  lib.shouldUpdateCacheFile = function(filePath) {
    var fs = require('fs');

    try {
      var stats = fs.statSync(filePath);

      if (!stats.isFile()) {
        debug('Cache file not found or the file is not a regular fil.');
        return true;
      }

      if (stats.size <= 0) {
        debug('Cache file found but the size is 0');
        return true;
      }
    } catch (e) {
      // no such file or directory
      debug('Stats error', e);
      return true;
    }

    return false;
  };

  return lib;
};

