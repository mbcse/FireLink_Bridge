var express = require('express');
var path = require('path');
var cookieParser = require('cookie-parser');
var logger = require('morgan');
const cors = require("cors");

var indexRouter = require('./routes/index');
const { runContractListner } = require('./listners/contractTxListner');
const { runAddressValidity } = require('./transactionChecker.js'); 
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
runAddressValidity(
    "eth",
    "0xaa635eb271a827e1a68825db8404aa81fb03a5e252f01b82c5e22028231aca74"
  );
// runContractListner("0xE5124c10cA1D248456d8ec6bA22274Cfd23Aa405","https://avax-dfk.gateway.pokt.network/v1/lb/fc64c9c8")
module.exports = app;
