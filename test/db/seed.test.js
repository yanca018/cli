'use strict';

var expect    = require('expect.js');
var Support   = require(__dirname + '/../support');
var helpers   = require(__dirname + '/../support/helpers');
var gulp      = require('gulp');
var _         = require('lodash');

([
  'db:seed --seed seedPerson.js',
  'db:seed --seeders-path seeders --seed seedPerson.js',
  '--seeders-path seeders db:seed --seed seedPerson.js',
  'db:seed --seeders-path ./seeders --seed seedPerson.js',
  'db:seed --seeders-path ./seeders/ --seed seedPerson.js',
  'db:seed --coffee --seed seedPerson.coffee',
  'db:seed --config ../../support/tmp/config/config.json --seed seedPerson.js',
  'db:seed --seed seedPerson.js --config ' +
    Support.resolveSupportPath('tmp', 'config', 'config.json'),
  'db:seed --seed seedPerson.js --config ../../support/tmp/config/config.js',
  'db:seed --seed seedPerson.js --config ../../support/tmp/config/config-promise.js'
]).forEach(function (flag) {
  var prepare = function (callback, options) {
    options = _.assign({ config: {} }, options || {});

    var configPath    = 'config/';
    var seederFile    = 'seedPerson';
    var config        = _.assign({}, helpers.getTestConfig(), options.config);
    var configContent = JSON.stringify(config);
    var migrationFile = 'createPerson.'  + ((flag.indexOf('coffee') === -1) ? 'js' : 'coffee');

    seederFile = seederFile + '.'  + ((flag.indexOf('coffee') === -1) ? 'js' : 'coffee');

    if (flag.match(/config\.js$/)) {
      configPath    = configPath + 'config.js';
      configContent = 'module.exports = ' + configContent;
    } else if (flag.match(/config-promise\.js/)) {
      configPath    = configPath + 'config-promise.js';
      configContent = '' +
        'var b = require("bluebird");' +
        'module.exports = b.resolve(' + configContent + ');';
    } else {
      configPath = configPath + 'config.json';
    }

    gulp
      .src(Support.resolveSupportPath('tmp'))
      .pipe(helpers.clearDirectory())
      .pipe(helpers.runCli('init'))
      .pipe(helpers.removeFile('config/config.json'))
      .pipe(helpers.copyMigration(migrationFile))
      .pipe(helpers.copySeeder(seederFile))
      .pipe(helpers.overwriteFile(configContent, configPath))
      .pipe(helpers.runCli('db:migrate' +
        ((flag.indexOf('coffee') === -1 && flag.indexOf('config') === -1) ? ''
          : flag.replace('db:seed', ''))))
      .pipe(helpers.runCli(flag, { pipeStdout: true }))
      .pipe(helpers.teardown(callback));
  };

  describe(Support.getTestDialectTeaser(flag), function () {
    it('creates a SequelizeData table', function (done) {
      var self = this;

      prepare(function () {
        helpers.readTables(self.sequelize, function (tables) {
          expect(tables).to.have.length(3);
          expect(tables).to.contain('SequelizeData');
          done();
        });
      }, { config: { seederStorage: 'sequelize' } });
    });

    it('populates the respective table', function (done) {
      var self = this;

      prepare(function () {
        helpers.countTable(self.sequelize, 'Person', function (result) {
          expect(result).to.have.length(1);
          expect(result[0].count).to.eql(1);
          done();
        });
      });
    });

    describe('the logging option', function () {
      it('does not print sql queries by default', function (done) {
        prepare(function (_, stdout) {
          expect(stdout).to.not.contain('Executing');
          done();
        });
      });

      it('interpretes a custom option', function (done) {
        prepare(function (_, stdout) {
          expect(stdout).to.contain('Executing');
          done();
        }, { config: { logging: true } });
      });
    });

    describe('custom meta table name', function () {
      it('correctly uses the defined table name', function (done) {
        var self = this;

        prepare(function () {
          helpers.readTables(self.sequelize, function (tables) {
            expect(tables.sort()).to.eql(['Person', 'SequelizeMeta', 'sequelize_data']);
            done();
          });
        }, {
          config: { seederStorage: 'sequelize', seederStorageTableName: 'sequelize_data' }
        });
      });
    });
  });
});
