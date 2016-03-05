(function (root) {

  var plugin = {
    name: 'ViewLogger',
    scope: 'ViewLogger',
  };

  function ViewLogger (options) {
    options || (options = {});
    this._options = options;
    this._findElements();
    this._generateLoggerMethods();
  }

  ViewLogger.prototype.getLogObject = function () {
    return {
      log: this._loggerMethod('log'),
      info: this._loggerMethod('info'),
      debug: this._loggerMethod('debug'),
      warn: this._loggerMethod('warn'),
      error: this._loggerMethod('error'),
      memory: this._loggerMethod('memory'),
    };
  };

  ViewLogger.prototype.clearLogs = function () {
    return this._elements.logArea && (this._elements.logArea.innerHTML = '');
  };

  /**
   * Local Methods
   */
  ViewLogger.prototype._findElements = function () {
    this._elements = {};
    var elements = this._elements;
    elements.logArea = this._options.element || window.document.getElementById('log-area');
  };

  ViewLogger.prototype._generateLoggerMethods = function () {
    var loggerMethods = this.getLogObject();
    this.log = loggerMethods.log;
    this.info = loggerMethods.info;
    this.debug = loggerMethods.debug;
    this.warn = loggerMethods.warn;
    this.error = loggerMethods.error;
    this.memory = loggerMethods.memory;
    return loggerMethods;
  };

  ViewLogger.prototype._loggerMethod = function (level) {
    var self = this;
    return function () {
      self._logger(level, arguments);
    };
  };

  ViewLogger.prototype._logger = function (level, logArguments, options) {
    options || (options = {});
    this._elements.logArea && (this._elements.logArea.innerHTML += '<div class="' + level + ' log-item">' + this._getPrintableText(logArguments) + '</div>');
    return window.console[level].apply(window.console, logArguments);
  };

  ViewLogger.prototype._getPrintableText = function (logArguments) {
    var index,
        text = '&nbsp;>&nbsp;',
        logArgumentsLength = logArguments.length,
        logArgument;

    for (index = 0; index < logArgumentsLength; index++) {
      logArgument = logArguments[index];
      text += ' ' + (typeof(logArgument) === 'string' ? logArgument : JSON.stringify(logArgument));
    }
    text = text.replace(/(?:\r\n|\r|\n)/g, '<br/>&nbsp;&nbsp;&nbsp;&nbsp;');
    return text;
  };

  root[plugin.scope] = ViewLogger;

})(window);