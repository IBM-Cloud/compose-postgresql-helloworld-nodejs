/**
 * Copyright 2016 IBM Corp. All Rights Reserved.
 *
 * Licensed under the Apache License, Version 2.0 (the “License”);
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *  https://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an “AS IS” BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */

 // First add the obligatory web framework
var express = require('express');
var app = express();
var bodyParser = require('body-parser');

app.use(bodyParser.urlencoded({
  extended: false
}));

// Util is handy to have around, so thats why that's here.
const util = require('util')
// and so is assert
const assert = require('assert');

// We want to extract the port to publish our app on
var port = process.env.VCAP_APP_PORT || 8080;

// Then we'll pull in the database client library
var pg = require('pg');

// Now lets get cfenv and ask it to parse the environment variable
var cfenv = require('cfenv');
var appenv = cfenv.getAppEnv();

// Within the application environment (appenv) there's a services object
var services = appenv.services;

// The services object is a map named by service so we extract the one for PostgreSQL
var pg_services = services["compose-for-postgresql"];

// This check ensures there is a services for PostgreSQL databases
// assert(!util.isUndefined(pg_services), "Must be bound to compose-for-postgresql services");

// We now take the first bound PostgreSQL service and extract it's credentials object
var credentials = pg_services[0].credentials;

// Within the credentials, an entry ca_certificate_base64 contains the SSL pinning key
// We convert that from a string into a Buffer entry in an array which we use when
// connecting.
var ca = new Buffer(credentials.ca_certificate_base64, 'base64');
var connectionString = credentials.uri;

// We want to parse connectionString to get username, password, database name, server, port
// So we can use those to connect to the database
var parse = require('pg-connection-string').parse;
config = parse(connectionString);

// Add some ssl
config.ssl = {
  rejectUnauthorized: false,
  ca: ca
}

// set up a new client using our config details
var client = new pg.Client(config);

client.connect(function(err) {
  if (err) {
   response.status(500).send(err);
  } else {
    client.query('CREATE TABLE words (word varchar(256) NOT NULL, definition varchar(256) NOT NULL)', function (err,result){
      if (err) {
        console.log(err)
      }
    });
  }
});

// We can now set up our web server. First up we set it to serve static pages
app.use(express.static(__dirname + '/public'));

app.put("/words", function(request, response) {
  // set up a new client using our config details
  var client = new pg.Client(config);
  client.connect(function(err) {
    if (err) {
     response.status(500).send(err);
    } else {
      var queryText = 'INSERT INTO words(word,definition) VALUES($1, $2)';

      client.query(queryText, [request.body.word,request.body.definition], function (error,result){
        if (error) {
         response.status(500).send(error);
        } else {
         response.send(result);
        }
      });
    }
  });
});

// Read from the database when someone visits /words
app.get("/words", function(request, response) {
  // set up a new client using our config details
  var client = new pg.Client(config);
  // connect to the database
  client.connect(function(err) {

    if (err) throw err;

    // execute a query on our database
    client.query('SELECT * FROM words ORDER BY word ASC', function (err, result) {
      if (err) {
       response.status(500).send(err);
      } else {
       response.send(result.rows);
      }

    });

  });

});

// Now we go and listen for a connection.
app.listen(port);

require("cf-deployment-tracker-client").track();
