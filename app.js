const express = require('express');
const OAuth = require('oauth').OAuth;
const fs = require('fs-extra');

var config = {
    oAuthVersion: '1.0',
    oAuthSignatureMethod: 'HMAC-SHA1',
    oAuthNonceSize: undefined,

    /*
     * IMPORTANT: John Deere specific accept header has to be set to have oAuth working with the MyJohnDeere
     * platform. Other headers are possible depending on what the endpoint supports.
     *
     * IMPORTANT: Be aware of that not all endpoints support all content types. The 'oauth' module from
     * NPM used in this example uses the same accept header for all requests that has been specified
     * when the oauth session has been created. This means if you explicitly want to have data from another
     * endpoint in another content type you would need to establish another oauth session for that content type.
     * (Or use another library or modify the library)
     */
    oAuthCustomHeaders: {
        'Accept': 'application/vnd.deere.axiom.v3+json'
    },

    clientKey: 'PUT_CLIENT_KEY_HERE',
    clientSecret: 'PUT_CLIENT_SECRET_HERE',

    platformBaseUri: 'https://sandboxapi.deere.com/platform/',
    authorizeCallbackUri: 'http://localhost:3000/callback'
};
var oAuthSession;
var apiCatalog;
/*
 * Build local server to allow callback for OAuth authentication
 */
var app = express();
/*
 * Store for request and access tokens
 */
var tokens = {};

var getLinkFrom = function (links, rel) {
    let l = links.find(function (link) {
        return rel === link.rel;
    });
    if(l) {
        return l.uri;
    }
    return null;
};

/*
 * 1. Call platformBaseUri with client credentials to get the API Catalog
 *
 * The OAuthSession is initialized without (undefined) requestTokenUri and accessTokenUri as we
 * will get the URIs from the API Catalog. The get request is executed without any
 * accessToken information as we need to get this during authentication.
 *
 * IMPORTANT: In order to get the OAuth working with the MyJohnDeere platform, it is
 * always necessary to set the correct Accept header as configured above!
 *
 * From the API Catalog, we need the 'oauthRequestToken', 'oauthAuthorizationRequestToken',
 * and 'oauthAccessToken' URIs to proceed.
 */

oAuthSession = new OAuth(undefined, undefined, config.clientKey, config.clientSecret,
    config.oAuthVersion, config.authorizeCallbackUri, config.oAuthSignatureMethod, config.oAuthNonceSize, config.oAuthCustomHeaders);

oAuthSession.get(config.platformBaseUri, null, null, function (error, responseData, result) {

    apiCatalog = JSON.parse(responseData);

    console.log('----- Getting OAuth URIs from API Catalog -----');
    console.log('StatusCode => ' + result.statusCode);

    apiCatalog.links.forEach(function (link) {
        if ('oauthRequestToken' === link.rel) {
            config.oauthRequestTokenUri = link.uri;
            return;
        }

        if ('oauthAuthorizeRequestToken' === link.rel) {
            config.oauthAuthorizeRequestTokenUri = link.uri;
            return;
        }

        if ('oauthAccessToken' === link.rel) {
            config.oauthAccessTokenUri = link.uri;
            return;
        }
    });

    console.log(JSON.stringify(config, null, 2));

    console.log('----- Ready to authenticate -----');
});



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
app.get('/oauth', function (req, res) {
    oAuthSession = new OAuth(config.oauthRequestTokenUri, config.oauthAccessTokenUri, config.clientKey, config.clientSecret,
        config.oAuthVersion, config.authorizeCallbackUri, config.oAuthSignatureMethod, config.oAuthNonceSize, config.oAuthCustomHeaders);

    console.log('----- Requesting Request Token and Secret -----');

    oAuthSession.getOAuthRequestToken(function (error, token, secret, results) {
        tokens.requestToken = token;
        tokens.requestTokenSecret = secret;
        console.log('----- Request Token and Secret Received -----');
        console.log('StatusCode => ' + results.statusCode);
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
app.get('/callback', function (req, res) {
    tokens.verifier = req.query.oauth_verifier;

    console.log('----- Callback - Verifier Received -----');
    console.log(JSON.stringify(tokens, null, 2));

    console.log('----- Requesting Access Token and Secret -----');

    oAuthSession.getOAuthAccessToken(tokens.requestToken, tokens.requestTokenSecret, tokens.verifier, function (error, token, secret, results) {
        tokens.accessToken = token;
        tokens.accessTokenSecret = secret;

        console.log('----- Access Token and Secret Received -----');
        console.log('StatusCode => ' + results.statusCode);
        console.log(JSON.stringify(tokens, null, 2));

        oAuthSession.get(config.platformBaseUri, tokens.accessToken, tokens.accessTokenSecret, function (error, responseData, result) {

          console.log('----- Refreshing API Catalog -----');
          console.log('StatusCode => ' + result.statusCode);

          apiCatalog = JSON.parse(responseData);

          console.log('----- Ready to do OAuth authenticated calls now-----');
          res.end();
        });
    });
});

/*
 * 4. Local endpoint to demonstrate how to perform authenticate requests
 */

app.get('/sampleRequest', function (req, res) {
    console.log('----- Doing Sample Request -----');

    oAuthSession.get(getLinkFrom(apiCatalog.links, 'organizations'), tokens.accessToken, tokens.accessTokenSecret, function (error, responseData, result) {
        console.log('StatusCode => ' + result.statusCode);
        console.log('----- Sample Request Response -----');
        console.log(JSON.stringify(JSON.parse(responseData), null, 2));

        res.end();
    });
});

/*
 * 5. Local endpoint to demonstrate how to perform Create File in a MyJohnDeere organization. Below endpoint just picks up the first organization
 * user has access to upload a file and creates (POST) a spot and upload (PUT) a file.
 */

var uploadFile = function (createFileError, responseData, createFileResult) {
    if (!createFileError) {
        var location = createFileResult.headers.location;
        console.log('Uploading file with =>' + location);
        fs.readFile('./RX.zip', function (fsError, data) {
            if (!fsError) {
                oAuthSession.put(location, tokens.accessToken, tokens.accessTokenSecret, data,
                    'application/octet-stream', function (uploadError, uploadResponseData, result) {
                        if (uploadError) {
                            console.log('Error in uploading file' + uploadError);
                        }
                        console.log('File Uploaded =>' + result.statusCode);
                    });
            }
        });
    } else {
        console.log('Error in creating file' + createFileError);
    }
};

function createAndUploadFile(uri) {
    if (uri) {
        console.log('Creating a file with =>' + uri);
        oAuthSession.post(uri, tokens.accessToken, tokens.accessTokenSecret, JSON.stringify({name: 'fileName.zip'}),
            'application/vnd.deere.axiom.v3+json', uploadFile);
    } else {
        console.log('User does not have an organization he can upload files!!');
    }
}

function getFirstOrganizationWithFileUploadAccess(organizationResponseData) {
    var organizations = JSON.parse(organizationResponseData).values;
    var org = organizations.find(function (organization) {
        var uploadFileLink = getLinkFrom(organization.links, 'uploadFile');
        if (uploadFileLink) {
            return true;
        }
        return false;
    });
    return org;
}

app.get('/uploadFile', function (req, res) {
    console.log('----- Doing Create File Request -----');
    res.end();

    var organizationsLink = getLinkFrom(apiCatalog.links, 'organizations');

    oAuthSession.get(organizationsLink + ';count=100', tokens.accessToken, tokens.accessTokenSecret, function (error, organizationResponseData, result) {
        console.log('get Organizations StatusCode =>' + result.statusCode);

        var org = getFirstOrganizationWithFileUploadAccess(organizationResponseData);

        createAndUploadFile(getLinkFrom(org.links, 'uploadFile'));
    });
});

app.listen(3000);

console.log('listening on http://localhost:3000');
