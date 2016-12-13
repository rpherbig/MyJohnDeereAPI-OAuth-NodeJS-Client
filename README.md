# MyJohnDeereAPI-OAuth-NodeJS-Client

A sample app that demonstrates how to connect to the MyJohnDeere API with OAuth using NodeJs.

## Installation and Start

Excecute `npm install`. 

Within the `app.js` put your client api key and client secret into the configuration.

Then start with `npm start` and wait until the app is ready to authenticate:

*Console output:*
```
listening on http://localhost:3000
----- Getting OAuth URIs from API Catalog -----
{
  "oAuthVersion": "1.0",
  "oAuthSignatureMethod": "HMAC-SHA1",
  "oAuthCustomHeaders": {
    "Accept": "application/vnd.deere.axiom.v3+json"
  },
  "clientKey": "YOUR_CLIENT_KEY",
  "clientSecret": "YOUR_CLIENT_SECRET",
  "platformBaseUri": "https://api.deere.com/platform",
  "authorizeCallbackUri": "http://localhost:3000/callback",
  "oauthRequestTokenUri": "https://api.deere.com/platform/oauth/request_token",
  "oauthAuthorizeRequestTokenUri": "https://my.deere.com/consentToUseOfData?oauth_token={token}",
  "oauthAccessTokenUri": "https://api.deere.com/platform/oauth/access_token"
}
----- Ready to authenticate -----
```

Call the URL [http://localhost:3000/oauth](http://localhost:3000/oauth) in a browser. The app will do the OAuth procedure and redirects you to the login page of the MyJohnDeere platform. (If you have been connected before, this step may be left out due to cached credentials.) Wait until the app si ready to do authenticated calls:

*Console output:*
```
----- Requesting Request Token and Secret -----
----- Request Token and Secret Received -----
{
  "requestToken": "YOUR_REQUEST_TOKEN",
  "requestTokenSecret": "YOUR_REQUEST_TOKEN_SECRET"
}
----- Redirecting to oauthAuthorizeRequestTokenUri -----
----- Callback - Verifier Received -----
{
  "requestToken": "YOUR_REQUEST_TOKEN",
  "requestTokenSecret": "YOUR_REQUEST_TOKEN_SECRET"
  "verifier": "YOUR_OAUTH_VERIFIER"
}
----- Requesting Access Token and Secret -----
----- Access Token and Secret Received -----
{
  "requestToken": "YOUR_REQUEST_TOKEN",
  "requestTokenSecret": "YOUR_REQUEST_TOKEN_SECRET"
  "verifier": "YOUR_OAUTH_VERIFIER"
  "accessToken": "YOUR_ACCESS_TOKEN",
  "accessTokenSecret": "YOUR_ACCESS_TOKEN_SECRET"
}
----- Ready to do OAuth authenticated calls now-----
```

Call the URL [http://localhost:3000/sampleRequest](http://localhost:3000/sampleRequest) in your browser to execute the sample request (getting the list of organizations). The result is logged to the console.