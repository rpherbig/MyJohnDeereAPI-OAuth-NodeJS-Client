"use strict";

const express = require('express');
const OAuth = require('oauth').OAuth;

var config = {
    'oAuthVersion': '1.0',
    'oAuthSignatureMethod': 'HMAC-SHA1',
    'oAuthNonceSize': undefined,

    /*
     * IMPORTANT: John Deere specific accept header has to be set to have oAuth working with the MyJohnDeere
     * platform. Othere headers are possible depending on what the endpoint supports.
     *
     * IMPORTANT: Be aware of that not all endpoints support all content types. The 'oauth' module from
     * NPM used in this example uses the same accept header for all requests that has been specified
     * when the oauth session has been created. This means if you explicitly want to hae data from another
     * endpoint in another content type you would need to establish another oauth session for that content type.
     * (Or use another library or modify the library)
     */
    'oAuthCustomHeaders': {
        'Accept': 'application/vnd.deere.axiom.v3+json'
    },

    'clientKey': 'PUT_CLIENT_KEY_HERE',
    'clientSecret': 'PUT_CLIENT_SECRET_HERE',

    'platformBaseUri': 'https://api.deere.com/platform',
    'authorizeCallbackUri': 'http://localhost:3000/callback'
};

var oAuthSession;
var apiCatalog;

/*
 * 1. Call platformBaseUri with client credentials to get the API Catalog
 *
 * The OAuthSession is initialized without (undefined) requestTokenUri and accessTokenUri as we
 * will get the URIs from the API Catalog. The get request is executed without any
 * accessToken information as we need  to get this during authentication.
 *
 * IMPORTANT: In order to get the OAuth working with the MyJohnDeere platform, it is 
 * always necessary to set the correct Accept header as configured above!
 *
 * From the API Catalog, we need the 'oauthRequestToken', 'oauthAuthorizationRequestToken', 
 * and 'oauthAccessToken' URIs to proceed.
 */

oAuthSession = new OAuth(undefined, undefined, config.clientKey, config.clientSecret,
    config.oAuthVersion, config.authorizeCallbackUri, config.oAuthSignatureMethod, config.oAuthNonceSize, config.oAuthCustomHeaders);

oAuthSession.get(config.platformBaseUri, null, null, function(error, responseData, result) {

    apiCatalog = JSON.parse(responseData);

    console.log('----- Getting OAuth URIs from API Catalog -----');

    apiCatalog.links.forEach(function(link) {
        if (link.rel === 'oauthRequestToken') {
            config.oauthRequestTokenUri = link.uri;
            return;
        }

        if (link.rel === 'oauthAuthorizeRequestToken') {
            config.oauthAuthorizeRequestTokenUri = link.uri;
            return;
        }

        if (link.rel === 'oauthAccessToken') {
            config.oauthAccessTokenUri = link.uri;
            return;
        }
    });

    console.log(JSON.stringify(config, null, 2));

    console.log('----- Ready to authenticate -----');
});

/*
 * Build local server to allow callback for OAuth authentication
 */

var app = express();

/*
 * Store for request and access tokens
 */
var tokens = {};

/*
 * 2. Local endpoint that is called to start the OAuth process by requesting
 * the request token and secret first.
 *
 * With the request token, the user is then redirected to the oauthAuthorizeRequestTokenUri
 * for authorization and to get the OAuth verifier.
 *
 * Before that, a new oAuthSession object is instantiated with the requestToken and accessToken
 * URI that we got above.
 */
app.get('/oauth', function(req, res) {
    oAuthSession = new OAuth(config.oauthRequestTokenUri, config.oauthAccessTokenUri, config.clientKey, config.clientSecret,
        config.oAuthVersion, config.authorizeCallbackUri, config.oAuthSignatureMethod, config.oAuthNonceSize, config.oAuthCustomHeaders);

    console.log('----- Requesting Request Token and Secret -----');

    oAuthSession.getOAuthRequestToken(function(error, token, secret, results) {
        tokens.requestToken = token;
        tokens.requestTokenSecret = secret;

        console.log('----- Request Token and Secret Received -----');
        console.log(JSON.stringify(tokens, null, 2));

        console.log('----- Redirecting to oauthAuthorizeRequestTokenUri -----');

        res.redirect(config.oauthAuthorizeRequestTokenUri.replace('{token}', token));
    });
});

/*
 * 3. Local endpoint that is called by the OAuth provider to pass back the OAuth verifier
 * after authentication.
 *
 * With the verifier, access token and secret can be obtained.
 */
app.get('/callback', function(req, res) {
    tokens.verifier = req.query.oauth_verifier;

    console.log('----- Callback - Verifier Received -----');
    console.log(JSON.stringify(tokens, null, 2));

    console.log('----- Requesting Access Token and Secret -----');

    oAuthSession.getOAuthAccessToken(tokens.requestToken, tokens.requestTokenSecret, tokens.verifier, function(error, token, secret, results) {
        tokens.accessToken = token;
        tokens.accessTokenSecret = secret;

        console.log('----- Access Token and Secret Received -----');
        console.log(JSON.stringify(tokens, null, 2));

        console.log('----- Ready to do OAuth authenticated calls now-----');
        res.end();
    });
});

/*
 * 4. Local endpoint to demonstrate how to perform authenticate requests
 */
app.get('/sampleRequest', function(req, res) {
    console.log('----- Doing Sample Request -----');

    // Get organizations URI from API catalog
    var organizationsLink = apiCatalog.links.find(function(link) {
        return link.rel === 'organizations';
    });

    oAuthSession.get(organizationsLink.uri, tokens.accessToken, tokens.accessTokenSecret, function(error, responseData, result) {
        console.log('----- Sample Request Response -----');
        console.log(JSON.stringify(JSON.parse(responseData), null, 2));

        res.end();
    });
});

app.listen(3000);

console.log('listening on http://localhost:3000');
