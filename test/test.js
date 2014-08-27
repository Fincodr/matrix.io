var _       = require('lodash'),
    Matrix  = require('../lib/matrixio/Matrix'),
    assert  = require("assert");

describe('Matrix', function(){

  var nodes;

  describe('Localhost connection a-to-b', function(){

    beforeEach(function(){
      nodes = {};
      nodes.node1 = new Matrix({
        banner: false,
        console: false,
        debug: false,
        identity: {
          name: 'Matrix 1',
          datacenter: 0,
          worker: 1,
        },
        endpoints: [
          "http://127.0.0.1:33310"
        ]
      });
      nodes.node2 = new Matrix({
        banner: false,
        console: false,
        debug: false,
        identity: {
          name: 'Matrix 2',
          datacenter: 0,
          worker: 2
        },
        endpoints: [
        ],
        connections: [
          "http://127.0.0.1:33310",
        ]
      });
    });

    it('Node b should connect with a node', function(done){
      nodes.node1.on('node::welcome', function(data){
        if (data.owner_name === 'Matrix 2') {
          done();
        }
      });
    });

    afterEach(function(done){
      _.forEach(nodes, function(node, key){
        node.shutdown();
      });
      setTimeout(done, 250);
    });

  });

  describe('Localhost connection b-to-a', function(){

    beforeEach(function(){
      nodes = {};
      nodes.node1 = new Matrix({
        banner: false,
        console: false,
        debug: false,
        identity: {
          name: 'Matrix 1',
          datacenter: 0,
          worker: 1,
        },
        endpoints: [
        ],
        connections: [
          "http://127.0.0.1:33320"
        ]
      });
      nodes.node2 = new Matrix({
        banner: false,
        console: false,
        debug: false,
        identity: {
          name: 'Matrix 2',
          datacenter: 0,
          worker: 2
        },
        endpoints: [
          "http://127.0.0.1:33320",
        ]
      });
    });

    it('Node a should connect with b node', function(done){
      nodes.node2.on('node::welcome', function(data){
        if (data.owner_name === 'Matrix 1') {
          done();
        }
      });
    });

    afterEach(function(done){
      _.forEach(nodes, function(node, key){
        node.shutdown();
      });
      setTimeout(done, 250);
    });

  });

});
