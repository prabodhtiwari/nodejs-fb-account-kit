const fs = require('fs');
const GuId = require('guid');
const express = require('express');
const bodyParser = require("body-parser");
const Mustache = require('mustache');
const Request = require('request');
const Querystring = require('querystring');
const app = express();

app.use(bodyParser.urlencoded({ extended: false }));
app.use(bodyParser.json());

//import {appId, appSecret} from './config';
const config = require("./config")

console.log("config", config)

const guId = GuId.raw();
const accountKitApiVersion = 'v1.1';
const redirectUrl = "http://localhost:3000/success"
const appId = config.appId
const appSecret = config.appSecret
const meEndpointBaseUrl = 'https://graph.accountkit.com/v1.1/me';
const tokenExchangeBaseUrl = 'https://graph.accountkit.com/v1.1/access_token';

function loadLogin() {
  return fs.readFileSync('dist/login.html').toString();
}

app.get('/', function (request, response) {
  const view = {
    appId: appId,
    csrf: guId,
    version: accountKitApiVersion,
    redirect_url: redirectUrl,
  };

  const html = Mustache.to_html(loadLogin(), view);
  response.send(html);
});

function loadLoginSuccess() {
  return fs.readFileSync('dist/login_success.html').toString();
}

app.post('/success', function (request, response) {

  console.log("body", request.body)

  // CSRF check
  if (request.body.csrf === guId) {
    const appAccessToken = ['AA', appId, appSecret].join('|');
    var params = {
      grant_type: 'authorization_code',
      code: request.body.code,
      access_token: appAccessToken
    };

    // exchange tokens
    const tokenExchangeUrl = tokenExchangeBaseUrl + '?' + Querystring.stringify(params);
    Request.get({ url: tokenExchangeUrl, json: true }, function (err, resp, respBody) {
      console.log("respBody", respBody)
      var view = {
        userAccessToken: respBody.access_token,
        expiresAt: respBody.expires_at,
        userId: respBody.id,
      };

      // get account details at /me endpoint
      const meEndpointUrl = meEndpointBaseUrl + '?access_token=' + respBody.access_token;
      Request.get({ url: meEndpointUrl, json: true }, function (err, resp, respBody) {
        // send login_success.html
        console.log("respBody", respBody)
        if (respBody.phone) {
          view.phone = respBody.phone.number;
        } else if (respBody.email) {
          view.email = respBody.email.address;
        }
        var html = Mustache.to_html(loadLoginSuccess(), view);
        response.send(html);
      });
    });
  }
  else {
    // login failed
    response.writeHead(200, { 'Content-Type': 'text/html' });
    response.end("Something went wrong. :( ");
  }
});

app.listen(3000);