;(function e(t,n,r){function s(o,u){if(!n[o]){if(!t[o]){var a=typeof require=="function"&&require;if(!u&&a)return a(o,!0);if(i)return i(o,!0);throw new Error("Cannot find module '"+o+"'")}var f=n[o]={exports:{}};t[o][0].call(f.exports,function(e){var n=t[o][1][e];return s(n?n:e)},f,f.exports,e,t,n,r)}return n[o].exports}var i=typeof require=="function"&&require;for(var o=0;o<r.length;o++)s(r[o]);return s})({1:[function(require,module,exports){
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
  $iframe.attr('src', this.targetOrigin);
  this._isIFrameInjected = true;
  $iframe.on('load', function() {
    window.clearTimeout(this._iframeLoadTimeoutIndex);
    deferred.resolve($iframe.get(0), $iframe);
  });
  $('body').append($iframe);
  this._iframeLoadTimeoutIndex = window.setTimeout(function() {
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

IFrameClass.prototype._listen = function(request) {
  var self = this;
  if (!self._isListening) {
    $(window).on('message', function(event) {
      self._messageHandler(event.originalEvent.data);
    });
    self._isListening = true;
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
      console.warn('Couldnot parse the received message. Message:', message);
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

},{"minivents":2}],2:[function(require,module,exports){
module.exports=function(n){var t={},e=[];n=n||this,n.on=function(e,r,l){return(t[e]=t[e]||[]).push([r,l]),n},n.off=function(r,l){r||(t={});for(var o=t[r]||e,u=o.length=l?o.length:0;u--;)l==o[u][0]&&o.splice(u,1);return n},n.emit=function(r){for(var l,o=t[r]||e,u=o.length>0?o.slice(0,o.length):o,i=0;l=u[i++];)l[0].apply(l[1],e.slice.call(arguments,1));return n}};
},{}]},{},[1])
//@ sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJzb3VyY2VzIjpbIi9Vc2Vycy9oYXBweWZveC9Eb2N1bWVudHMvSGFwcHlmb3gvR2l0aHViL2lwb3N0L2luZGV4LmpzIiwiL1VzZXJzL2hhcHB5Zm94L0RvY3VtZW50cy9IYXBweWZveC9HaXRodWIvaXBvc3Qvbm9kZV9tb2R1bGVzL21pbml2ZW50cy9kaXN0L21pbml2ZW50cy5jb21tb25qcy5taW4uanMiXSwibmFtZXMiOltdLCJtYXBwaW5ncyI6IjtBQUFBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7O0FDeFVBIiwiZmlsZSI6ImdlbmVyYXRlZC5qcyIsInNvdXJjZVJvb3QiOiIiLCJzb3VyY2VzQ29udGVudCI6WyJ2YXIgRXZlbnRzID0gcmVxdWlyZSgnbWluaXZlbnRzJyk7XG5cbnZhciBwbHVnaW4gPSB7XG4gIG5hbWU6ICdpcG9zdCcsXG4gIGRlc2NyaXB0aW9uOiAnRWFzZXMgdGhlIHdheSBvZiBwb3N0aW5nIGFuZCByZWNpZXZpbmcgaWZyYW1lIG1lc3NhZ2VzJyxcbiAgYWNjZXNzVmFyaWFibGU6ICdpcG9zdCcsXG4gIHZlcnNpb246ICcwLjAuMSdcbn07XG5cbnZhciBkZWZhdWx0cyA9IHtcbiAgaWZyYW1lVGltZW91dDogMTAgKiAxMDAwXG59O1xuXG5mdW5jdGlvbiBJRnJhbWVDbGFzcyh0YXJnZXRPcmlnaW4sIG9wdGlvbnMpIHtcbiAgaWYgKCF3aW5kb3cucGFyZW50ICYmIHR5cGVvZih0YXJnZXRPcmlnaW4pICE9PSAnc3RyaW5nJykge1xuICAgIHRocm93IG5ldyBFcnJvcigndGFyZ2V0T3JpZ2luIGlzIG1pc3NpbmcnKTtcbiAgfVxuICB0aGlzLnRhcmdldE9yaWdpbiA9IHRhcmdldE9yaWdpbjtcbiAgdGhpcy5jb25maWcgfHwgKHRoaXMuY29uZmlnID0ge30pO1xuICB0aGlzLmNvbmZpZyA9IGV4dGVuZChkZWZhdWx0cywgb3B0aW9ucyk7XG4gIHR5cGVvZih0aGlzLmNvbmZpZy5tb2RlKSA9PT0gJ3N0cmluZycgfHwgKHRoaXMuY29uZmlnLm1vZGUgPSAnaWZyYW1lJyk7XG4gIHRoaXMuX3JlcXVlc3RQcm9taXNlcyB8fCAodGhpcy5fcmVxdWVzdFByb21pc2VzID0ge30pO1xuICB0aGlzLl9yZWFkeURlZmVycmVkID0gJC5EZWZlcnJlZCgpO1xuICB0aGlzLmV2ZW50ID0gbmV3IEV2ZW50cygpO1xufVxuXG5JRnJhbWVDbGFzcy5wcm90b3R5cGUuaW5qZWN0ID0gZnVuY3Rpb24oKSB7XG4gIHJldHVybiB0aGlzLl9JRnJhbWUuYXBwbHkodGhpcywgYXJndW1lbnRzKTtcbn07XG5cbklGcmFtZUNsYXNzLnByb3RvdHlwZS5vcGVuID0gZnVuY3Rpb24gKCkge1xuICByZXR1cm4gdGhpcy5fb3BlblBvcHVwLmFwcGx5KHRoaXMsIGFyZ3VtZW50cyk7XG59O1xuXG5JRnJhbWVDbGFzcy5wcm90b3R5cGUuY2xvc2UgPSBmdW5jdGlvbiAoKSB7XG4gIHJldHVybiB0aGlzLl9jbG9zZVBvcHVwLmFwcGx5KHRoaXMsIGFyZ3VtZW50cyk7XG59O1xuXG5JRnJhbWVDbGFzcy5wcm90b3R5cGUubGlzdGVuID0gZnVuY3Rpb24oKSB7XG4gIHJldHVybiB0aGlzLl9saXN0ZW4uYXBwbHkodGhpcywgYXJndW1lbnRzKTtcbn07XG5cbklGcmFtZUNsYXNzLnByb3RvdHlwZS5wb3N0ID0gZnVuY3Rpb24ocGF5bG9hZCkge1xuICByZXR1cm4gdGhpcy5fcG9zdC5hcHBseSh0aGlzLCBhcmd1bWVudHMpO1xufTtcblxuSUZyYW1lQ2xhc3MucHJvdG90eXBlLnJlYWR5ID0gZnVuY3Rpb24oKSB7XG4gIHJldHVybiB0aGlzLl9wb3N0UmVhZHkoKTtcbn07XG5cbklGcmFtZUNsYXNzLnByb3RvdHlwZS5yZWFkeURlZmVycmVkID0gZnVuY3Rpb24gKCkge1xuICByZXR1cm4gdGhpcy5fcmVhZHlEZWZlcnJlZDtcbn07XG5cbklGcmFtZUNsYXNzLnByb3RvdHlwZS5vbiA9IGZ1bmN0aW9uKGV2ZW50TmFtZSwgaGFuZGxlcikge1xuICB0aGlzLmV2ZW50Lm9uKGV2ZW50TmFtZSwgaGFuZGxlcik7XG59O1xuXG4vKipcbiAqIExvY2FsIE1ldGhvZHNcbiAqL1xuSUZyYW1lQ2xhc3MucHJvdG90eXBlLl9JRnJhbWUgPSBmdW5jdGlvbigpIHtcbiAgaWYgKCF0aGlzLl9pZnJhbWVSZWFkeURlZmVycmVkKSB7XG4gICAgdGhpcy5faWZyYW1lUmVhZHlEZWZlcnJlZCA9ICQud2hlbih0aGlzLl9pbmplY3RJRnJhbWUuYXBwbHkodGhpcywgYXJndW1lbnRzKSwgdGhpcy5fcmVhZHlEZWZlcnJlZCkudGhlbihmdW5jdGlvbiAoaWZyYW1lQXJncykge1xuICAgICAgdmFyIGRlZmVycmVkID0gJC5EZWZlcnJlZCgpO1xuICAgICAgcmV0dXJuIGRlZmVycmVkLnJlc29sdmUuYXBwbHkoZGVmZXJyZWQsIGlmcmFtZUFyZ3MpO1xuICAgIH0pO1xuICB9XG4gIHJldHVybiB0aGlzLl9pZnJhbWVSZWFkeURlZmVycmVkO1xufTtcblxuSUZyYW1lQ2xhc3MucHJvdG90eXBlLl9Qb3B1cFdpbmRvdyA9IGZ1bmN0aW9uICgpIHtcbiAgcmV0dXJuICQud2hlbih0aGlzLl9vcGVuUG9wdXAuYXBwbHkodGhpcywgYXJndW1lbnRzKSwgdGhpcy5fcmVhZHlEZWZlcnJlZCkudGhlbihmdW5jdGlvbiAob3BlblBvcHVwQXJncykge1xuICAgIHZhciBkZWZlcnJlZCA9ICQuRGVmZXJyZWQoKTtcbiAgICByZXR1cm4gZGVmZXJyZWQucmVzb2x2ZS5hcHBseShkZWZlcnJlZCwgb3BlblBvcHVwQXJncyk7XG4gIH0pO1xufTtcblxuSUZyYW1lQ2xhc3MucHJvdG90eXBlLl9pbmplY3RJRnJhbWUgPSBmdW5jdGlvbihpZnJhbWUsIG9wdGlvbnMpIHtcbiAgdmFyIGRlZmVycmVkID0gJC5EZWZlcnJlZCgpLFxuICAgICRpZnJhbWUgPSAoaWZyYW1lICYmICQoaWZyYW1lKSkgfHwgJCgnPGlmcmFtZS8+Jyk7XG5cbiAgb3B0aW9ucyB8fCAob3B0aW9ucyA9IHt9KTtcbiAgb3B0aW9ucy5zcmMgJiYgKHRoaXMudGFyZ2V0T3JpZ2luID0gb3B0aW9ucy5zcmMpO1xuICAkaWZyYW1lLmF0dHIoJ3NyYycsIHRoaXMudGFyZ2V0T3JpZ2luKTtcbiAgdGhpcy5faXNJRnJhbWVJbmplY3RlZCA9IHRydWU7XG4gICRpZnJhbWUub24oJ2xvYWQnLCBmdW5jdGlvbigpIHtcbiAgICB3aW5kb3cuY2xlYXJUaW1lb3V0KHRoaXMuX2lmcmFtZUxvYWRUaW1lb3V0SW5kZXgpO1xuICAgIGRlZmVycmVkLnJlc29sdmUoJGlmcmFtZS5nZXQoMCksICRpZnJhbWUpO1xuICB9KTtcbiAgJCgnYm9keScpLmFwcGVuZCgkaWZyYW1lKTtcbiAgdGhpcy5faWZyYW1lTG9hZFRpbWVvdXRJbmRleCA9IHdpbmRvdy5zZXRUaW1lb3V0KGZ1bmN0aW9uKCkge1xuICAgIHZhciBlcnJvciA9IG5ldyBFcnJvcigpO1xuICAgIGVycm9yLnR5cGUgPSAnaWZyYW1lX2xvYWRfdGltZW91dCc7XG4gICAgZXJyb3IubWVzc2FnZSA9ICdJRnJhbWUgdGltZWQgb3V0IHRvIGxvYWQnO1xuICAgIGRlZmVycmVkLnJlamVjdChlcnJvcik7XG4gIH0sIHRoaXMuY29uZmlnLmlmcmFtZVRpbWVvdXQpO1xuICByZXR1cm4gZGVmZXJyZWQ7XG59O1xuXG5JRnJhbWVDbGFzcy5wcm90b3R5cGUuX29wZW5Qb3B1cCA9IGZ1bmN0aW9uICgpIHtcbiAgdmFyIHNlbGYgPSB0aGlzLFxuICAgIGRlZmVycmVkID0gJC5EZWZlcnJlZCgpLFxuICAgIG9wZW5BcmdzO1xuICBpZiAoIXRoaXMuX2lzUG9wdXBXaW5kb3dPcGVuKSB7XG4gICAgb3BlbkFyZ3MgPSBbIHRoaXMudGFyZ2V0T3JpZ2luLCBdO1xuICAgIGlmICh0eXBlb2YodGhpcy5jb25maWcudGFyZ2V0KSA9PT0gJ3N0cmluZycpIHtcbiAgICAgIG9wZW5BcmdzLnB1c2godGhpcy5jb25maWcudGFyZ2V0KTtcbiAgICB9XG4gICAgaWYgKHR5cGVvZih0aGlzLmNvbmZpZy53aW5kb3dPcHRpb25zKSA9PT0gJ3N0cmluZycpIHtcbiAgICAgIG9wZW5BcmdzLnB1c2godGhpcy5jb25maWcud2luZG93T3B0aW9ucyk7XG4gICAgfVxuICAgIHRoaXMuX3BvcHVwV2luZG93ID0gd2luZG93Lm9wZW4uYXBwbHkod2luZG93LCBvcGVuQXJncyk7XG4gICAgdGhpcy5faXNQb3B1cFdpbmRvd09wZW4gPSB0cnVlO1xuICAgIHRoaXMuX3BvcHVwV2luZG93SW50ZXJ2YWxJbmRleCA9IHdpbmRvdy5zZXRJbnRlcnZhbChmdW5jdGlvbiAoKSB7XG4gICAgICBpZiAoc2VsZi5fcG9wdXBXaW5kb3cuY2xvc2VkKSB7XG4gICAgICAgIHNlbGYuX2Nsb3NlUG9wdXAoKTtcbiAgICAgIH1cbiAgICB9LCA1MDApO1xuICB9XG4gIGRlZmVycmVkLnJlc29sdmUodGhpcy5fcG9wdXBXaW5kb3csICQodGhpcy5fcG9wdXBXaW5kb3cpKTtcbiAgcmV0dXJuIGRlZmVycmVkLnByb21pc2UoKTtcbn07XG5cbklGcmFtZUNsYXNzLnByb3RvdHlwZS5fY2xvc2VQb3B1cCA9IGZ1bmN0aW9uICgpIHtcbiAgaWYgKHRoaXMuX3BvcHVwV2luZG93KSB7XG4gICAgd2luZG93LmNsZWFySW50ZXJ2YWwodGhpcy5fcG9wdXBXaW5kb3dJbnRlcnZhbEluZGV4KTtcbiAgICB0aGlzLl9wb3B1cFdpbmRvdy5jbG9zZSgpO1xuICAgIGRlbGV0ZSB0aGlzLl9wb3B1cFdpbmRvdztcbiAgICB0aGlzLl9pc1BvcHVwV2luZG93T3BlbiA9IGZhbHNlO1xuICB9XG59O1xuXG5JRnJhbWVDbGFzcy5wcm90b3R5cGUuX3Bvc3RSZWFkeSA9IGZ1bmN0aW9uICgpIHtcbiAgdmFyIHJlcXVlc3QgPSB7fTtcbiAgcmVxdWVzdC5wbHVnaW4gPSBwbHVnaW4ubmFtZTtcbiAgcmVxdWVzdC50eXBlID0gJ3JlYWR5JztcbiAgcmVxdWVzdC5tb2RlID0gdGhpcy5jb25maWcubW9kZTtcbiAgdGhpcy5fcG9zdFJhdyhyZXF1ZXN0KTtcbn07XG5cbklGcmFtZUNsYXNzLnByb3RvdHlwZS5fcG9zdCA9IGZ1bmN0aW9uKCkge1xuICB2YXIgcmVxdWVzdCA9IHt9LFxuICAgIGluZGV4O1xuICByZXF1ZXN0LmlkID0gUmFuZG9tLnM0KCk7XG4gIHJlcXVlc3QudHlwZSA9ICdwaW5nJztcbiAgcmVxdWVzdC5wYXlsb2FkID0gQXJyYXkucHJvdG90eXBlLnNsaWNlLmNhbGwoYXJndW1lbnRzKTtcbiAgcmVxdWVzdC5wbHVnaW4gPSBwbHVnaW4ubmFtZTtcbiAgdGhpcy5fcmVxdWVzdFByb21pc2VzW3JlcXVlc3QuaWRdID0gbmV3ICQuRGVmZXJyZWQoKTtcbiAgdGhpcy5fcG9zdFJhdyhyZXF1ZXN0KTtcbiAgcmV0dXJuIHRoaXMuX3JlcXVlc3RQcm9taXNlc1tyZXF1ZXN0LmlkXTtcbn07XG5cbklGcmFtZUNsYXNzLnByb3RvdHlwZS5fcG9zdFJhdyA9IGZ1bmN0aW9uKHJlcXVlc3QpIHtcbiAgdmFyIHNlbGYgPSB0aGlzO1xuICBpZih0aGlzLmNvbmZpZy5jaGlsZCAmJiB3aW5kb3cucGFyZW50KSB7XG4gICAgd2luZG93LnBhcmVudC5wb3N0TWVzc2FnZShKU09OLnN0cmluZ2lmeShyZXF1ZXN0KSwgc2VsZi50YXJnZXRPcmlnaW4gfHwgJyonKTtcbiAgICByZXR1cm4gJC5EZWZlcnJlZCgpLnJlc29sdmUoKS5wcm9taXNlKCk7XG4gIH0gZWxzZSBpZiAodGhpcy5jb25maWcubW9kZSA9PT0gJ3BvcHVwJyAmJiAodGhpcy5jb25maWcucG9wdXAgfHwgdGhpcy5jb25maWcuY2hpbGQpICYmIHdpbmRvdy5vcGVuZXIpIHtcbiAgICB3aW5kb3cub3BlbmVyLnBvc3RNZXNzYWdlKEpTT04uc3RyaW5naWZ5KHJlcXVlc3QpLCBzZWxmLnRhcmdldE9yaWdpbiB8fCAnKicpO1xuICAgIHJldHVybiAkLkRlZmVycmVkKCkucmVzb2x2ZSgpLnByb21pc2UoKTtcbiAgfSBlbHNlIHtcbiAgICBpZiAodGhpcy5jb25maWcubW9kZSA9PT0gJ3BvcHVwJykge1xuICAgICAgcmV0dXJuIHRoaXMuX1BvcHVwV2luZG93KCkudGhlbihmdW5jdGlvbih3aW4sICR3aW4pIHtcbiAgICAgICAgdmFyIGRlZmVycmVkID0gJC5EZWZlcnJlZCgpO1xuICAgICAgICB0cnkge1xuICAgICAgICAgIHdpbi5wb3N0TWVzc2FnZShKU09OLnN0cmluZ2lmeShyZXF1ZXN0KSwgc2VsZi50YXJnZXRPcmlnaW4pO1xuICAgICAgICAgIGRlZmVycmVkLnJlc29sdmUoKTtcbiAgICAgICAgfSBjYXRjaCAoZXJyKSB7XG4gICAgICAgICAgZGVmZXJyZWQucmVqZWN0KGVycik7XG4gICAgICAgIH1cbiAgICAgICAgcmV0dXJuIGRlZmVycmVkLnByb21pc2UoKTtcbiAgICAgIH0pO1xuICAgIH0gZWxzZSB7XG4gICAgICByZXR1cm4gdGhpcy5fSUZyYW1lKCkudGhlbihmdW5jdGlvbihpZnJhbWUsICRpZnJhbWUpIHtcbiAgICAgICAgdmFyIGRlZmVycmVkID0gJC5EZWZlcnJlZCgpO1xuICAgICAgICB0cnkge1xuICAgICAgICAgIGlmcmFtZS5jb250ZW50V2luZG93LnBvc3RNZXNzYWdlKEpTT04uc3RyaW5naWZ5KHJlcXVlc3QpLCBzZWxmLnRhcmdldE9yaWdpbik7XG4gICAgICAgICAgZGVmZXJyZWQucmVzb2x2ZSgpO1xuICAgICAgICB9IGNhdGNoIChlcnIpIHtcbiAgICAgICAgICBkZWZlcnJlZC5yZWplY3QoZXJyKTtcbiAgICAgICAgfVxuICAgICAgICByZXR1cm4gZGVmZXJyZWQucHJvbWlzZSgpO1xuICAgICAgfSk7XG4gICAgfVxuICB9XG59O1xuXG5JRnJhbWVDbGFzcy5wcm90b3R5cGUuX2xpc3RlbiA9IGZ1bmN0aW9uKHJlcXVlc3QpIHtcbiAgdmFyIHNlbGYgPSB0aGlzO1xuICBpZiAoIXNlbGYuX2lzTGlzdGVuaW5nKSB7XG4gICAgJCh3aW5kb3cpLm9uKCdtZXNzYWdlJywgZnVuY3Rpb24oZXZlbnQpIHtcbiAgICAgIHNlbGYuX21lc3NhZ2VIYW5kbGVyKGV2ZW50Lm9yaWdpbmFsRXZlbnQuZGF0YSk7XG4gICAgfSk7XG4gICAgc2VsZi5faXNMaXN0ZW5pbmcgPSB0cnVlO1xuICB9XG59O1xuXG5JRnJhbWVDbGFzcy5wcm90b3R5cGUuX3Bvc3RSZXBseSA9IGZ1bmN0aW9uKGRlZmVycmVkLCBfYXJndW1lbnRzKSB7XG4gIHZhciBzdGF0ZSA9IGRlZmVycmVkLnN0YXRlKCksXG4gICAgbWVzc2FnZSA9IGRlZmVycmVkLl9pcG9zdE1lc3NhZ2U7XG5cbiAgbWVzc2FnZS5wYXlsb2FkID0gQXJyYXkucHJvdG90eXBlLnNsaWNlLmNhbGwoX2FyZ3VtZW50cyk7XG4gIGlmIChzdGF0ZSA9PT0gJ3Jlc29sdmVkJyB8fCBzdGF0ZSA9PT0gJ3JlamVjdGVkJykge1xuICAgIG1lc3NhZ2UudHlwZSA9ICdwb25nJztcbiAgICBtZXNzYWdlLnN0YXRlID0gc3RhdGU7XG4gIH0gZWxzZSB7XG4gICAgbWVzc2FnZS50eXBlID0gJ25vdGlmeSc7XG4gIH1cbiAgdGhpcy5fcG9zdFJhdyhtZXNzYWdlKTtcbn07XG5cbklGcmFtZUNsYXNzLnByb3RvdHlwZS5fbWVzc2FnZUhhbmRsZXIgPSBmdW5jdGlvbihtZXNzYWdlKSB7XG4gIHZhciBzZWxmID0gdGhpcztcblxuICBpZiAodHlwZW9mIG1lc3NhZ2UgPT09ICdzdHJpbmcnKSB7XG4gICAgdHJ5IHtcbiAgICAgIG1lc3NhZ2UgPSBKU09OLnBhcnNlKG1lc3NhZ2UpO1xuICAgIH0gY2F0Y2ggKGV4Y2VwdGlvbikge1xuICAgICAgY29uc29sZS53YXJuKCdDb3VsZG5vdCBwYXJzZSB0aGUgcmVjZWl2ZWQgbWVzc2FnZS4gTWVzc2FnZTonLCBtZXNzYWdlKTtcbiAgICAgIHJldHVyblxuICAgIH1cbiAgfVxuICBcbiAgaWYgKG1lc3NhZ2UucGx1Z2luID09PSBwbHVnaW4ubmFtZSkge1xuXG4gICAgaWYgKG1lc3NhZ2UudHlwZSA9PT0gJ3JlYWR5JyAmJiB0aGlzLmNvbmZpZy5tb2RlID09PSBtZXNzYWdlLm1vZGUpIHtcblxuICAgICAgdGhpcy5fcmVhZHlEZWZlcnJlZC5yZXNvbHZlKCk7XG4gICAgICB0aGlzLmV2ZW50LmVtaXQoJ3JlYWR5Jyk7XG5cbiAgICB9IGVsc2UgaWYobWVzc2FnZS50eXBlID09PSAncGluZycpIHtcblxuICAgICAgdmFyIHBpbmdEZWZlcnJlZCA9ICQuRGVmZXJyZWQoKTtcbiAgICAgIHBpbmdEZWZlcnJlZC5faXBvc3RNZXNzYWdlID0gbWVzc2FnZTtcbiAgICAgIHZhciBwaW5nRGVmZXJyZWQgPSBwaW5nRGVmZXJyZWQuYWx3YXlzKGZ1bmN0aW9uKCkge1xuICAgICAgICBzZWxmLl9wb3N0UmVwbHkocGluZ0RlZmVycmVkLCBhcmd1bWVudHMpO1xuICAgICAgfSkucHJvZ3Jlc3MoZnVuY3Rpb24oKSB7XG4gICAgICAgIHNlbGYuX3Bvc3RSZXBseShwaW5nRGVmZXJyZWQsIGFyZ3VtZW50cyk7XG4gICAgICB9KTtcblxuICAgICAgdmFyIGV2ZW50RW1pdEFyZ3VtZW50cyA9IFtdO1xuICAgICAgZXZlbnRFbWl0QXJndW1lbnRzLnB1c2goJ21lc3NhZ2UnKTtcbiAgICAgIGV2ZW50RW1pdEFyZ3VtZW50cy5wdXNoKHBpbmdEZWZlcnJlZCk7XG4gICAgICBldmVudEVtaXRBcmd1bWVudHMgPSBldmVudEVtaXRBcmd1bWVudHMuY29uY2F0KG1lc3NhZ2UucGF5bG9hZCk7XG4gICAgICB0aGlzLmV2ZW50LmVtaXQuYXBwbHkodGhpcy5ldmVudCwgZXZlbnRFbWl0QXJndW1lbnRzKTtcblxuICAgIH0gZWxzZSB7XG5cbiAgICAgIHZhciByZXF1ZXN0UHJvbWlzZSA9IHRoaXMuX3JlcXVlc3RQcm9taXNlc1ttZXNzYWdlLmlkXTtcbiAgICAgIGlmIChyZXF1ZXN0UHJvbWlzZSkge1xuXG4gICAgICAgIHN3aXRjaCAobWVzc2FnZS50eXBlKSB7XG4gICAgICAgICAgY2FzZSAncG9uZyc6XG4gICAgICAgICAgICBpZiAobWVzc2FnZS5zdGF0ZSA9PT0gJ3Jlc29sdmVkJykge1xuICAgICAgICAgICAgICByZXF1ZXN0UHJvbWlzZS5yZXNvbHZlLmFwcGx5KHJlcXVlc3RQcm9taXNlLCBtZXNzYWdlLnBheWxvYWQpO1xuICAgICAgICAgICAgfSBlbHNlIHtcbiAgICAgICAgICAgICAgcmVxdWVzdFByb21pc2UucmVqZWN0LmFwcGx5KHJlcXVlc3RQcm9taXNlLCBtZXNzYWdlLnBheWxvYWQpO1xuICAgICAgICAgICAgfVxuICAgICAgICAgICAgdGhpcy5fcmVtb3ZlUmVxdWVzdFByb21pc2UobWVzc2FnZS5pZCk7XG4gICAgICAgICAgICBicmVhaztcbiAgICAgICAgICBjYXNlICdub3RpZnknOlxuICAgICAgICAgICAgcmVxdWVzdFByb21pc2Uubm90aWZ5LmFwcGx5KHJlcXVlc3RQcm9taXNlLCBtZXNzYWdlLnBheWxvYWQpO1xuICAgICAgICAgICAgYnJlYWs7XG4gICAgICAgICAgZGVmYXVsdDpcbiAgICAgICAgICAgIGNvbnNvbGUud2FybignVW5rbm93biBtZXNzYWdlIHR5cGUuIG1lc3NhZ2VUeXBlOicsIG1lc3NhZ2UudHlwZSk7XG4gICAgICAgIH1cblxuICAgICAgfVxuXG4gICAgfVxuICB9XG59O1xuXG5JRnJhbWVDbGFzcy5wcm90b3R5cGUuX3JlbW92ZVJlcXVlc3RQcm9taXNlID0gZnVuY3Rpb24ocmVxdWVzdElkKSB7XG4gIGRlbGV0ZSB0aGlzLl9yZXF1ZXN0UHJvbWlzZXNbcmVxdWVzdElkXTtcbn07XG5cbmZ1bmN0aW9uIGNyZWF0ZUlQb3N0T2JqZWN0KHRhcmdldE9yaWdpbiwgb3B0aW9ucykge1xuICByZXR1cm4gbmV3IElGcmFtZUNsYXNzKHRhcmdldE9yaWdpbiwgb3B0aW9ucyk7XG59XG5cbi8qKlxuICogLS0tLS0tLS0tLS0tLS1cbiAqIEhlbHBlciBtZXRob2RzXG4gKiAtLS0tLS0tLS0tLS0tLVxuICovXG5cbi8qKlxuICogTWVyZ2UgZGVmYXVsdHMgd2l0aCB1c2VyIG9wdGlvbnNcbiAqIEBwYXJhbSB7T2JqZWN0fSBkZWZhdWx0cyBEZWZhdWx0IHNldHRpbmdzXG4gKiBAcGFyYW0ge09iamVjdH0gb3B0aW9ucyBVc2VyIG9wdGlvbnNcbiAqIEByZXR1cm5zIHtPYmplY3R9IE1lcmdlZCB2YWx1ZXMgb2YgZGVmYXVsdHMgYW5kIG9wdGlvbnNcbiAqL1xudmFyIGV4dGVuZCA9IGZ1bmN0aW9uKGRlZmF1bHRzLCBvcHRpb25zKSB7XG4gIHZhciBleHRlbmRlZCA9IHt9O1xuICB2YXIgcHJvcDtcbiAgZm9yIChwcm9wIGluIGRlZmF1bHRzKSB7XG4gICAgaWYgKE9iamVjdC5wcm90b3R5cGUuaGFzT3duUHJvcGVydHkuY2FsbChkZWZhdWx0cywgcHJvcCkpIHtcbiAgICAgIGV4dGVuZGVkW3Byb3BdID0gZGVmYXVsdHNbcHJvcF07XG4gICAgfVxuICB9XG4gIGZvciAocHJvcCBpbiBvcHRpb25zKSB7XG4gICAgaWYgKE9iamVjdC5wcm90b3R5cGUuaGFzT3duUHJvcGVydHkuY2FsbChvcHRpb25zLCBwcm9wKSkge1xuICAgICAgZXh0ZW5kZWRbcHJvcF0gPSBvcHRpb25zW3Byb3BdO1xuICAgIH1cbiAgfVxuICByZXR1cm4gZXh0ZW5kZWQ7XG59O1xuXG4vKipcbiAqIEdlbmVyYXRlIFJhbmRvbSBJRFxuICovXG52YXIgUmFuZG9tID0ge1xuXG4gIHM0OiBmdW5jdGlvbigpIHtcbiAgICByZXR1cm4gKCgoMSArIE1hdGgucmFuZG9tKCkpICogMHgxMDAwMCkgfCAwKS50b1N0cmluZygxNikuc3Vic3RyaW5nKDEpO1xuICB9LFxuXG4gIGd1aWQ6IGZ1bmN0aW9uKCkge1xuICAgIHJldHVybiAodGhpcy5zNCgpICsgdGhpcy5zNCgpICsgXCItXCIgKyB0aGlzLnM0KCkgKyBcIi1cIiArIHRoaXMuczQoKSArIFwiLVwiICsgdGhpcy5zNCgpICsgXCItXCIgKyB0aGlzLnM0KCkgKyB0aGlzLnM0KCkgKyB0aGlzLnM0KCkpO1xuICB9LFxuXG59O1xuXG53aW5kb3cuSVBvc3QgPSBJRnJhbWVDbGFzcztcblxubW9kdWxlLmV4cG9ydHMgPSBJRnJhbWVDbGFzcztcbiIsIm1vZHVsZS5leHBvcnRzPWZ1bmN0aW9uKG4pe3ZhciB0PXt9LGU9W107bj1ufHx0aGlzLG4ub249ZnVuY3Rpb24oZSxyLGwpe3JldHVybih0W2VdPXRbZV18fFtdKS5wdXNoKFtyLGxdKSxufSxuLm9mZj1mdW5jdGlvbihyLGwpe3J8fCh0PXt9KTtmb3IodmFyIG89dFtyXXx8ZSx1PW8ubGVuZ3RoPWw/by5sZW5ndGg6MDt1LS07KWw9PW9bdV1bMF0mJm8uc3BsaWNlKHUsMSk7cmV0dXJuIG59LG4uZW1pdD1mdW5jdGlvbihyKXtmb3IodmFyIGwsbz10W3JdfHxlLHU9by5sZW5ndGg+MD9vLnNsaWNlKDAsby5sZW5ndGgpOm8saT0wO2w9dVtpKytdOylsWzBdLmFwcGx5KGxbMV0sZS5zbGljZS5jYWxsKGFyZ3VtZW50cywxKSk7cmV0dXJuIG59fTsiXX0=
;