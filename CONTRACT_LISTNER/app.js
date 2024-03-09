var express = require('express');
var path = require('path');
var cookieParser = require('cookie-parser');
var logger = require('morgan');
const cors = require("cors");

var indexRouter = require('./routes/index');
const { runContractListner } = require('./listners/contractTxListner');
var app = express();

app.use(logger('dev'));
app.use(express.json());
app.use(express.urlencoded({ extended: false }));
app.use(cookieParser());
app.use(express.static(path.join(__dirname, 'public')));
app.use(function(req, res, next) {
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
    res.setHeader('Access-Control-Allow-Credentials', true);
    next();
});



app.use('/', indexRouter);
runContractListner("0x98b240e598Fb1ccEA23ba9dD25d08e084c68760b","wss://eth-sepolia.g.alchemy.com/v2/0c2JGynK1Nzrw1LsMD4TzMv-yOPujfdJ")
module.exports = app;
