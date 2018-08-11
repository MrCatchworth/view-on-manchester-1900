const express = require('express');
const path = require('path');

const app = express();



app.use('/', express.static('content'));

//script server, but only for specific modules
var jsSearchModules = [
    {
        webFile: 'jquery.min.js',
        localPath: 'node_modules/jquery/dist/jquery.min.js'
    }
]
app.get('/scripts/*.js', (req, res) => {
    let debugMsg = `Received request for ${req.path} ... `;
    let found = false;

    for (let ele of jsSearchModules) {
        if (ele.webFile === path.basename(req.path)) {
            res.sendFile(ele.localPath, {root: __dirname});
            found = true;
            
            debugMsg += `Responded with ${ele.localPath}`;
            break;
        }
    }

    if (!found) {
        res.status(404).end();
        debugMsg += 'Not found';
    }
    console.log(debugMsg);
});

app.listen(3000, () => {console.log('View on Manchester 1900 - listening...')});