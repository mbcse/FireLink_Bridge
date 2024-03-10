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
runContractListner("0x68eDBdF3614F802D6fF34a74A3DBF4f97910754a", "0xF6b29cF96471e9bfbBb52623395759CA948f4554","wss://eth-sepolia.g.alchemy.com/v2/0c2JGynK1Nzrw1LsMD4TzMv-yOPujfdJ", "https://coston-api.flare.network/ext/C/rpc")
module.exports = app;
