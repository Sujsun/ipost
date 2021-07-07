var Events = require('minivents');

var plugin = {
  name: 'ipost',
  description: 'Eases the way of posting and recieving iframe messages',
  accessVariable: 'ipost',
  version: '0.0.1'
};

var defaults = {
  iframeTimeout: 10 * 1000
};

function IFrameClass(targetOrigin, options) {
  if (!window.parent && typeof(targetOrigin) !== 'string') {
    throw new Error('targetOrigin is missing');
  }
  this.targetOrigin = targetOrigin;
  this.config || (this.config = {});
  this.config = extend(defaults, options);
  typeof(this.config.mode) === 'string' || (this.config.mode = 'iframe');
  this._requestPromises || (this._requestPromises = {});
  this._readyDeferred = $.Deferred();
  this.event = new Events();
}

IFrameClass.prototype.inject = function() {
  return this._IFrame.apply(this, arguments);
};

IFrameClass.prototype.open = function () {
  return this._openPopup.apply(this, arguments);
};

IFrameClass.prototype.close = function () {
  return this._closePopup.apply(this, arguments);
};

IFrameClass.prototype.listen = function() {
  return this._listen.apply(this, arguments);
};

IFrameClass.prototype.unlisten = function() {
  return this._unlisten.apply(this, arguments);
};

IFrameClass.prototype.post = function(payload) {
  return this._post.apply(this, arguments);
};

IFrameClass.prototype.ready = function() {
  return this._postReady();
};

IFrameClass.prototype.readyDeferred = function () {
  return this._readyDeferred;
};

IFrameClass.prototype.on = function(eventName, handler) {
  this.event.on(eventName, handler);
};

IFrameClass.prototype.off = function(eventName, handler) {
  this.event.off(eventName, handler);
};

/**
 * Local Methods
 */
IFrameClass.prototype._IFrame = function() {
  if (!this._iframeReadyDeferred) {
    this._iframeReadyDeferred = $.when(this._injectIFrame.apply(this, arguments), this._readyDeferred).then(function (iframeArgs) {
      var deferred = $.Deferred();
      return deferred.resolve.apply(deferred, iframeArgs);
    });
  }
  return this._iframeReadyDeferred;
};

IFrameClass.prototype._PopupWindow = function () {
  return $.when(this._openPopup.apply(this, arguments), this._readyDeferred).then(function (openPopupArgs) {
    var deferred = $.Deferred();
    return deferred.resolve.apply(deferred, openPopupArgs);
  });
};

IFrameClass.prototype._injectIFrame = function(iframe, options) {
  var deferred = $.Deferred(),
    $iframe = (iframe && $(iframe)) || $('<iframe/>');

  options || (options = {});
  options.src && (this.targetOrigin = options.src);
  var iframeId = Random.guid();
  $iframe.attr('name', iframeId);

  $('body').append($iframe);
  this._isIFrameInjected = true;

  $iframe.on('load', function () {
    window.clearTimeout(this._iframeLoadTimeoutIndex);
    deferred.resolve($iframe.get(0), $iframe);
    $iframe.removeAttr('name')
  });

  iframe = window.open(this.targetOrigin, iframeId)

  this.childWindow = iframe

  this._iframeLoadTimeoutIndex = window.setTimeout(function () {
    var error = new Error();
    error.type = 'iframe_load_timeout';
    error.message = 'IFrame timed out to load';
    deferred.reject(error);
  }, this.config.iframeTimeout);
  return deferred;
};

IFrameClass.prototype._openPopup = function () {
  var self = this,
    deferred = $.Deferred(),
    openArgs;
  if (!this._isPopupWindowOpen) {
    openArgs = [ this.targetOrigin, ];
    if (typeof(this.config.target) === 'string') {
      openArgs.push(this.config.target);
    }
    if (typeof(this.config.windowOptions) === 'string') {
      openArgs.push(this.config.windowOptions);
    }
    this._popupWindow = window.open.apply(window, openArgs);
    this._isPopupWindowOpen = true;
    this._popupWindowIntervalIndex = window.setInterval(function () {
      if (self._popupWindow.closed) {
        self._closePopup();
      }
    }, 500);
  }
  deferred.resolve(this._popupWindow, $(this._popupWindow));
  return deferred.promise();
};

IFrameClass.prototype._closePopup = function () {
  if (this._popupWindow) {
    window.clearInterval(this._popupWindowIntervalIndex);
    this._popupWindow.close();
    delete this._popupWindow;
    this._isPopupWindowOpen = false;
  }
};

IFrameClass.prototype._postReady = function () {
  var request = {};
  request.plugin = plugin.name;
  request.type = 'ready';
  request.mode = this.config.mode;
  this._postRaw(request);
};

IFrameClass.prototype._post = function() {
  var request = {},
    index;
  request.id = Random.s4();
  request.type = 'ping';
  request.payload = Array.prototype.slice.call(arguments);
  request.plugin = plugin.name;
  this._requestPromises[request.id] = new $.Deferred();
  this._postRaw(request);
  return this._requestPromises[request.id];
};

IFrameClass.prototype._postRaw = function(request) {
  var self = this;
  if(this.config.child && window.parent) {
    window.parent.postMessage(JSON.stringify(request), self.targetOrigin || '*');
    return $.Deferred().resolve().promise();
  } else if (this.config.mode === 'popup' && (this.config.popup || this.config.child) && window.opener) {
    window.opener.postMessage(JSON.stringify(request), self.targetOrigin || '*');
    return $.Deferred().resolve().promise();
  } else {
    if (this.config.mode === 'popup') {
      return this._PopupWindow().then(function(win, $win) {
        var deferred = $.Deferred();
        try {
          win.postMessage(JSON.stringify(request), self.targetOrigin);
          deferred.resolve();
        } catch (err) {
          deferred.reject(err);
        }
        return deferred.promise();
      });
    } else {
      return this._IFrame().then(function(iframe, $iframe) {
        var deferred = $.Deferred();
        try {
          iframe.contentWindow.postMessage(JSON.stringify(request), self.targetOrigin);
          deferred.resolve();
        } catch (err) {
          deferred.reject(err);
        }
        return deferred.promise();
      });
    }
  }
};

IFrameClass.prototype._listen = function({ domain, window: targetWindow }) {
  var self = this;

  if (self._isListening) {
    return
  }

  $(window).on('message', function (e) {
    var event = e.originalEvent

    if (self.config.child && targetWindow !== window.opener) {
      return
    }

    else if (!self.config.child && (self.childWindow !== event.source || domain !== event.origin)) {
      return
    }

    self._messageHandler(event.data);
  });

  self._isListening = true;
};

IFrameClass.prototype._unlisten = function(request) {
  if (this._isListening) {
    $(window).off('message', this._messageHandlerFunc);
    this._isListening = false;
  }
};

IFrameClass.prototype._postReply = function(deferred, _arguments) {
  var state = deferred.state(),
    message = deferred._ipostMessage;

  message.payload = Array.prototype.slice.call(_arguments);
  if (state === 'resolved' || state === 'rejected') {
    message.type = 'pong';
    message.state = state;
  } else {
    message.type = 'notify';
  }
  this._postRaw(message);
};

IFrameClass.prototype._messageHandler = function(message) {
  var self = this;

  if (typeof message === 'string') {
    try {
      message = JSON.parse(message);
    } catch (exception) {
      if (self.config.debug) {
        console.warn('Couldnot parse the received message. Message:', message);
      }
      return
    }
  }

  if (message.plugin === plugin.name) {

    if (message.type === 'ready' && this.config.mode === message.mode) {

      this._readyDeferred.resolve();
      this.event.emit('ready');

    } else if(message.type === 'ping') {

      var pingDeferred = $.Deferred();
      pingDeferred._ipostMessage = message;
      var pingDeferred = pingDeferred.always(function() {
        self._postReply(pingDeferred, arguments);
      }).progress(function() {
        self._postReply(pingDeferred, arguments);
      });

      var eventEmitArguments = [];
      eventEmitArguments.push('message');
      eventEmitArguments.push(pingDeferred);
      eventEmitArguments = eventEmitArguments.concat(message.payload);
      this.event.emit.apply(this.event, eventEmitArguments);

    } else {

      var requestPromise = this._requestPromises[message.id];
      if (requestPromise) {

        switch (message.type) {
          case 'pong':
            if (message.state === 'resolved') {
              requestPromise.resolve.apply(requestPromise, message.payload);
            } else {
              requestPromise.reject.apply(requestPromise, message.payload);
            }
            this._removeRequestPromise(message.id);
            break;
          case 'notify':
            requestPromise.notify.apply(requestPromise, message.payload);
            break;
          default:
            console.warn('Unknown message type. messageType:', message.type);
        }

      }

    }
  }
};

IFrameClass.prototype._removeRequestPromise = function(requestId) {
  delete this._requestPromises[requestId];
};

function createIPostObject(targetOrigin, options) {
  return new IFrameClass(targetOrigin, options);
}

/**
 * --------------
 * Helper methods
 * --------------
 */

/**
 * Merge defaults with user options
 * @param {Object} defaults Default settings
 * @param {Object} options User options
 * @returns {Object} Merged values of defaults and options
 */
var extend = function(defaults, options) {
  var extended = {};
  var prop;
  for (prop in defaults) {
    if (Object.prototype.hasOwnProperty.call(defaults, prop)) {
      extended[prop] = defaults[prop];
    }
  }
  for (prop in options) {
    if (Object.prototype.hasOwnProperty.call(options, prop)) {
      extended[prop] = options[prop];
    }
  }
  return extended;
};

/**
 * Generate Random ID
 */
var Random = {

  s4: function() {
    return (((1 + Math.random()) * 0x10000) | 0).toString(16).substring(1);
  },

  guid: function() {
    return (this.s4() + this.s4() + "-" + this.s4() + "-" + this.s4() + "-" + this.s4() + "-" + this.s4() + this.s4() + this.s4());
  },

};

window.IPost = IFrameClass;

module.exports = IFrameClass;
