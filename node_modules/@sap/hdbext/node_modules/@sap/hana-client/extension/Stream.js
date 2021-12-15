'use strict';

module.exports =
{
    // Create an readable stream which returns object
    createObjectStream: function (resultset) {
        return new HanaObjectStream(resultset);
    },

    // Create an readable stream which returns array
    createArrayStream: function (resultset) {
        return new HanaArrayStream(resultset);
    },

    // Create a LOB stream
    createLobStream: function (resultset, columnIndex, options) {
        return new HanaLobStream(resultset, columnIndex, options);
    },

    // Create a LOB stream for a LOB output parameter
    createParameterLobStream: function (statement, paramIndex, options) {
        return new HanaParameterLobStream(statement, paramIndex, options);
    },

    // Create a statement which allows user to pass readable streams for input parameters
    createStatement: function (connection, sql, callback) {
        return new HanaStatement(connection, sql, callback);
    },

    // Create a statement for procedure call. After calling exec, output parameters
    // (err, scalarParams, table1, table2...) will be passed to the callback
    createProcStatement: function (connection, sql, callback) {
        return new HanaProcStatement(connection, sql, callback);
    }
};

var util = require('util');
var streamModule = require('stream');
var Stream = streamModule.Stream;
var Readable = streamModule.Readable;

// Object stream
function HanaObjectStream(resultset) {
    checkParameter('resultset', resultset)
    Readable.call(this, { objectMode: true });
    this.resultset = resultset;
};

util.inherits(HanaObjectStream, Readable);

HanaObjectStream.prototype._read = function () {
    var stream = this;
    this.resultset.next(function (err, ret) {
        if (err === undefined) {
            if (ret) {
                stream.push(stream.resultset.getValues());
            } else {
                stream.push(null);
            }
        } else {
            stream.emit('error', err);
        }
    });
};

HanaObjectStream.prototype._destroy = function () {
    this.push(null);
};

// Array stream
function HanaArrayStream(resultset) {
    checkParameter('resultset', resultset)
    Readable.call(this, { objectMode: true });
    this.resultset = resultset;
    this.columnInfo = this.resultset.getColumnInfo();
    this.colCount = this.columnInfo.length;
};

util.inherits(HanaArrayStream, Readable);

HanaArrayStream.prototype._read = function () {
    var stream = this;
    this.resultset.next(function (err, ret) {
        if (err === undefined) {
            if (ret) {
                var values = [];
                for (var i = 0; i < stream.colCount; i++) {
                    values.push(stream.resultset.getValue(i));
                }
                stream.push(values);
            } else {
                stream.push(null);
            }
        } else {
            stream.emit('error', err);
        }
    });
};

HanaArrayStream.prototype._destroy = function () {
    this.push(null);
};

// Lob stream
function HanaLobStream(resultset, columnIndex, options) {
    checkParameter('resultset', resultset);

    var opts = getLobStreamOptions(options);
    Readable.call(this, opts);

    this.resultset = resultset;
    this.columnInfo = this.resultset.getColumnInfo();
    this.columnIndex = columnIndex;

    checkColumnIndex(this.columnInfo, columnIndex);
    checkLobType(this.columnInfo, columnIndex);

    this.isString = this.columnInfo[this.columnIndex].typeName === 'STRING';
    this.offset = 0;
    this.noPause = opts.noPause;
    this.valueAsString = false;
    if (typeof opts.valueAsString === "boolean") {
        this.valueAsString = opts.valueAsString;
    }
};

util.inherits(HanaLobStream, Readable);

HanaLobStream.prototype._read = function (bufferSize) {
    if (this.resultset.isNull(this.columnIndex)) {
        this.push(null);
        return;
    }

    var stream = this;
    stream.bufferSize = bufferSize;
    var buffer = createBuffer(bufferSize);

    if (!this.noPause) {
        this.pause();
    }

    this.resultset.getData(this.columnIndex, this.offset, buffer, 0, bufferSize, function (err, bytesRetrieved) {
        if (err === undefined) {
            if (stream.isString) {
                if (bytesRetrieved > 0) {
                    let nullChar = buffer.indexOf(0);
                    if (nullChar === 0) {
                        stream.push(null);
                    } else {
                        let newBuffer = buffer;
                        if (nullChar > 0) {
                            newBuffer = buffer.slice(0, nullChar);
                        }
                        let str = newBuffer.toString('utf8');
                        stream.offset += str.length;
                        if (stream.valueAsString) {
                            stream.push(str);
                        } else {
                            stream.push(newBuffer);
                        }
                        if (bytesRetrieved < stream.bufferSize) {
                            stream.push(null);
                        }
                    }
                } else {
                    stream.push(null);
                }
            } else { // LOB
                stream.offset += bytesRetrieved;
                if (bytesRetrieved > 0) {
                    if (bytesRetrieved < stream.bufferSize) {
                        stream.push(buffer.slice(0, bytesRetrieved));
                        stream.push(null);
                    } else {
                        stream.push(buffer);
                    }
                } else {
                    stream.push(null);
                }
            }
        } else {
            if (err.code === 100) { // No more result
                stream.push(null);
            } else {
                stream.emit('error', err);
            }
        }
        if (!stream.noPause) {
            stream.resume();
        }
    });
};

HanaLobStream.prototype._destroy = function () {
    this.push(null);
};

// Parameter lob stream
function HanaParameterLobStream(statement, paramIndex, options) {
    checkParameter('statement', statement);

    var opts = getLobStreamOptions(options);
    Readable.call(this, opts);

    this.statement = statement;
    this.paramInfo = this.statement.getParameterInfo();
    this.paramIndex = paramIndex;

    checkParameterIndex(this.paramInfo, paramIndex);
    checkParameterLobType(this.paramInfo, paramIndex);

    this.isString = this.paramInfo[this.paramIndex].typeName === 'STRING';
    this.offset = 0;
    this.noPause = opts.noPause;
    this.valueAsString = false;
    if (typeof opts.valueAsString === "boolean") {
        this.valueAsString = opts.valueAsString;
    }
};

util.inherits(HanaParameterLobStream, Readable);

HanaParameterLobStream.prototype._read = function (bufferSize) {
    if (this.statement.isParameterNull(this.paramIndex)) {
        this.push(null);
        return;
    }

    var stream = this;
    stream.bufferSize = bufferSize;
    var buffer = createBuffer(bufferSize);

    if (!this.noPause) {
        this.pause();
    }

    this.statement.getData(this.paramIndex, this.offset, buffer, 0, bufferSize, function (err, bytesRetrieved) {
        if (err === undefined) {
            if (stream.isString) {
                if (bytesRetrieved > 0) {
                    let nullChar = buffer.indexOf(0);
                    if (nullChar === 0) {
                        stream.push(null);
                    } else {
                        let newBuffer = buffer;
                        if (nullChar > 0) {
                            newBuffer = buffer.slice(0, nullChar);
                        }
                        let str = newBuffer.toString('utf8');
                        stream.offset += str.length;
                        if (stream.valueAsString) {
                            stream.push(str);
                        } else {
                            stream.push(newBuffer);
                        }
                        if (bytesRetrieved < stream.bufferSize) {
                            stream.push(null);
                        }
                    }
                } else {
                    stream.push(null);
                }
            } else { // LOB
                stream.offset += bytesRetrieved;
                if (bytesRetrieved > 0) {
                    if (bytesRetrieved < stream.bufferSize) {
                        stream.push(buffer.slice(0, bytesRetrieved));
                        stream.push(null);
                    } else {
                        stream.push(buffer);
                    }
                } else {
                    stream.push(null);
                }
            }
        } else {
            if (err.code === 100) { // No more result
                stream.push(null);
            } else {
                stream.emit('error', err);
            }
        }
        if (!stream.noPause) {
            stream.resume();
        }
    });
};

HanaParameterLobStream.prototype._destroy = function () {
    this.push(null);
};

// Statement which allows user to pass readable streams for input parameters
function HanaStatement(connection, sql, callback) {
    if (connection === undefined || connection === null) {
        handleError("Invalid parameter 'connection'.", callback);
        return;
    }
    if (sql === undefined || sql === null) {
        handleError("Invalid parameter 'sql'.", callback);
        return;
    }

    this.connection = connection;
    this.sql = sql;
    this.stmt = null;
    this.result = 0;

    if (callback) {
        var hanaStmt = this;
        this.connection.prepare(sql, function (err, stmt) {
            hanaStmt.stmt = stmt;
            callback(err, hanaStmt);
        });
    } else {
        this.stmt = this.connection.prepare(sql);
    }
};

HanaStatement.prototype.getStatement = function () {
    return this.stmt;
};

HanaStatement.prototype.drop = function (callback) {
    if (this.stmt) {
        var stmt = this.stmt;
        this.stmt = null;
        stmt.drop(callback);
    }
};

HanaStatement.prototype.exec = function (params, callback) {
    if (callback === undefined || callback === null || (callback instanceof Function) === false) {
        throw new Error("Invalid parameter 'callback'.");
    }
    if (params === undefined || params === null || !(params instanceof Array)) {
        handleError("Invalid parameter 'params'.", callback);
        return;
    }
    if (!this.stmt) {
        handleError("Invalid statement.", callback);
        return;
    }

    var hasArrayParam = false;
    var hasNonArrayParam = false;

    for (var i = 0; i < params.length; i++) {
        if (params[i] instanceof Array) {
            hasArrayParam = true;
        } else {
            hasNonArrayParam = true;
        }
        if (hasArrayParam && hasNonArrayParam) {
            handleError("Invalid parameter 'params': contains both array and non-array parameters.", callback);
            return;
        }
    }

    if (params.length === 0) {
        callback(null, 0);
        return;
    }

    this.callback = callback;
    this.currentRow = 0;

    if (hasArrayParam) {
        this.paramsArray = params;
    } else {
        this.paramsArray = [];
        this.paramsArray.push(params);
    }

    this._exec();
}

HanaStatement.prototype._exec = function () {
    this.params = this.paramsArray[this.currentRow];

    var isStream = [];
    var paramsNew = [];
    var streamCount = 0;
    var hanaStmt = this;

    for (var i = 0; i < this.params.length; i++) {
        if (this.params[i] instanceof Stream) {
            this.params[i].pause();
            isStream.push(true);
            paramsNew.push({sendParameterData : true});
            streamCount++;
        } else {
            isStream.push(false);
            paramsNew.push(this.params[i]);
        }
    }

    if (streamCount <= 0) {
        this.stmt.exec(paramsNew, function (err, result) {
            if (err) {
                hanaStmt.callback(err, result);
            } else {
                hanaStmt.currentRow++;
                hanaStmt.result += result;
                if (hanaStmt.currentRow === hanaStmt.paramsArray.length) {
                    hanaStmt.callback(null, hanaStmt.result);
                } else {
                    hanaStmt._exec();
                }
            }
        });
    } else {
        this.stmt.exec(paramsNew, function (err, result) {
            if (err) {
                hanaStmt.callback(err, result);
            } else {
                for (var paramIndex = 0; paramIndex < hanaStmt.params.length; paramIndex++) {
                    if (hanaStmt.params[paramIndex] instanceof Stream) {
                        break;
                    }
                }
                hanaStmt.sendParameterData(paramIndex);
            }
        });
    }
};

HanaStatement.prototype.sendParameterData = function (paramIndex) {
    var hanaStmt = this;

    this.params[paramIndex].on('error', function (error) {
        hanaStmt.callback(error);
    });

    this.params[paramIndex].on('end', function () {
        hanaStmt.stmt.sendParameterData(paramIndex, null, function (err) {
            if (err) {
                hanaStmt.callback(err);
            } else {
                var nextStream = -1;
                for (var i = paramIndex + 1; i < hanaStmt.params.length; i++) {
                    if (hanaStmt.params[i] instanceof Stream) {
                        nextStream = i;
                        break;
                    }
                }
                if (nextStream >= 0) {
                    hanaStmt.sendParameterData(nextStream);
                } else {
                    hanaStmt.currentRow++;
                    hanaStmt.result += 1;
                    if (hanaStmt.currentRow === hanaStmt.paramsArray.length) {
                        hanaStmt.callback(null, hanaStmt.result);
                    } else {
                        hanaStmt._exec();
                    }
                }
            }
        });
    });

    this.params[paramIndex].on('data', function (buffer) {
        hanaStmt.params[paramIndex].pause();
        hanaStmt.stmt.sendParameterData(paramIndex, buffer, function (err) {
            if (err) {
                hanaStmt.callback(err);
            } else {
                hanaStmt.params[paramIndex].resume();
            }
        });
    });

    this.params[paramIndex].resume();
};

// Statement for procedure call
function HanaProcStatement(connection, sql, callback) {
    if (connection === undefined || connection === null) {
        handleError("Invalid parameter 'connection'.", callback);
        return;
    }
    if (sql === undefined || sql === null) {
        handleError("Invalid parameter 'sql'.", callback);
        return;
    }
    if (callback !== undefined && callback !== null && !(callback instanceof Function)) {
        throw new Error("Invalid parameter 'callback'.");
    }

    this.connection = connection;
    this.columnInfo = [];

    if (callback) {
        var hanaStmt = this;
        connection.prepare(sql, function (err, stmt) {
            hanaStmt.stmt = stmt;
            callback(err, hanaStmt);
        });
    } else {
        this.stmt = connection.prepare(sql);
        return this;
    }
};

HanaProcStatement.prototype.drop = function (callback) {
    if (this.stmt) {
        var stmt = this.stmt;
        this.stmt = null;
        stmt.drop(callback);
    }
};

HanaProcStatement.prototype.exec = function (params, callback) {
    if (params !== undefined && params !== null &&
        (!(params instanceof Array) && !(params instanceof Object))) {
        handleError("Invalid parameter 'params'.", callback);
        return;
    }
    if (callback === undefined || callback === null || !(callback instanceof Function)) {
        throw new Error("Invalid parameter 'callback'.");
    }
    if (!this.stmt) {
        handleError("Invalid statement.", callback);
        return;
    }

    this.callback = callback;
    this.scalarParams = {};
    this.hasScalarParams = false;
    this.tableParams = [[]];
    this.currentTable = 0;
    this.columnInfo = [];

    var hanaStmt = this;
    this.stmt.execQuery(params, function (err, rs) {
        if (err) {
            hanaStmt.callback(err);
        } else {
            hanaStmt.rs = rs;
            var paramInfo = hanaStmt.stmt.getParameterInfo();
            var paramCount = 0;
            for (var i = 0; i < paramInfo.length; i++) {
                if (paramInfo[i].direction === 2 || paramInfo[i].direction === 3) {
                    hanaStmt.hasScalarParams = true;
                    hanaStmt.stmt.getParameterValue(i, (function() {
                        var index = i;
                        return function(err, val) {
                            if(err) {
                                hanaStmt.callback(err);
                            } else {
                                ++paramCount;
                                hanaStmt.scalarParams[paramInfo[index].name] = val;
                                if (paramCount === paramInfo.length) {
                                    return hanaStmt.fetchTableParam();
                                }
                            }
                        };
                    })() );
                } else {
                    ++paramCount;
                }
            }
            if (paramCount === paramInfo.length) {
                hanaStmt.fetchTableParam();
            }
        }
    });
}

// Returns an array of arrays. Each array contains column info for each output table.
HanaProcStatement.prototype.getColumnInfo = function () {
    return this.columnInfo;
};

HanaProcStatement.prototype.execute = function (params, callback) {
    this.exec(params, callback);
}

HanaProcStatement.prototype.fetchTableParam = function () {
    var hanaStmt = this;
    this.rs.next(function (err, hasData) {
        if (err) {
            hanaStmt.callback(err);
        } else {
            if (hasData) {
                try {
                    hanaStmt.tableParams[hanaStmt.currentTable].push(hanaStmt.rs.getValues());
                } catch (newerr) {
                    hanaStmt.callback(newerr);
                    return;
                }
                hanaStmt.fetchTableParam();
            } else {
                var columns = hanaStmt.rs.getColumnInfo();
                if ((columns != null) && (columns != undefined) && (columns.length > 0)) {
                    hanaStmt.columnInfo.push(columns);
                }

                hanaStmt.rs.nextResult(function (err, hasResult) {
                    if (err) {
                        hanaStmt.callback(err);
                    } else if (hasResult) {
                        hanaStmt.currentTable++;
                        hanaStmt.tableParams.push([]);
                        hanaStmt.fetchTableParam();
                    } else {
                        hanaStmt.rs.close(function (err) {
                            if (err) {
                                hanaStmt.callback(err);
                            } else {
                                var args = [];
                                if (hanaStmt.hasScalarParams) {
                                    args.push(hanaStmt.scalarParams);
                                } else {
                                    args.push({});
                                }
                                for (var i = 0; i < hanaStmt.tableParams.length; i++) {
                                    args.push(hanaStmt.tableParams[i]);
                                }
                                var evalStr = 'hanaStmt.callback(null';
                                for (var j = 0; j < args.length; j++) {
                                    evalStr += ', args[' + j + ']';
                                }
                                evalStr += ')';
                                eval(evalStr);
                            }
                        });
                    }
                });
            }
        }
    });
}

function handleError(err, callback) {
    if (callback) {
        callback(err);
    } else {
        throw err;
    }
};

function isLob(type) {
    if (type === 25 || // CLOB
        type === 26 || // NCLOB
        type === 27 || // BLOB
        type === 13) { // VARBINARY
        return true;
    }
    return false;
};

function checkParameter(name, param) {
    if (param === undefined || param === null) {
        throw new Error("Invalid parameter '" + name + "'.");
    }
};

function checkColumnIndex(columnInfo, columnIndex) {
    if (columnIndex === undefined || columnIndex === null ||
        columnIndex < 0 || columnIndex >= columnInfo.length) {
        throw new Error("Invalid parameter 'columnIndex'.");
    }
};

function checkLobType(columnInfo, columnIndex) {
    var type = columnInfo[columnIndex].nativeType;
    if (!isLob(type)) {
        throw new Error('Column is not LOB type.');
    }
};

function checkParameterIndex(paramInfo, paramIndex) {
    if (paramIndex === undefined || paramIndex === null ||
        paramIndex < 0 || paramIndex >= paramInfo.length) {
        throw new Error("Invalid parameter 'paramIndex'.");
    }
};

function checkParameterLobType(paramInfo, paramIndex) {
    var type = paramInfo[paramIndex].nativeType;
    if (!isLob(type)) {
        throw new Error('Parameter is not LOB type.');
    }
};

function createBuffer(size) {
    if (typeof Buffer.alloc === 'function') {
        return Buffer.alloc(size);
    } else {
        return new Buffer(size);
    }
};

function isInteger(value) {
    if (typeof value === 'number' && value % 1 === 0) {
        return true;
    } else {
        return false;
    }
}

function getLobStreamOptions(options) {
    var opts = {};
    Object.assign(opts, options);
    opts.objectMode = false;
    if (isInteger(opts.readSize) && opts.readSize > 0) {
        opts.highWaterMark = opts.readSize;
    }
    opts.noPause = false;
    if (options && 'noPause' in options && (typeof options.noPause === 'boolean')) {
        opts.noPause = options.noPause;
    }
    return opts;
}

var MAX_READ_SIZE = Math.pow(2, 18);
var DEFAULT_READ_SIZE = Math.pow(2, 11) * 100;
