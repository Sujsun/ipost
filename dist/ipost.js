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

  try {
    message = JSON.parse(message);
  } catch (exception) {
    console.warn('Couldnot parse the received message. Message:', message);
    return;
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
module.exports=function(n){var t={},e=[];n=n||this,n.on=function(n,e,l){(t[n]=t[n]||[]).push([e,l])},n.off=function(n,l){n||(t={});for(var o=t[n]||e,i=o.length=l?o.length:0;i--;)l==o[i][0]&&o.splice(i,1)},n.emit=function(n){for(var l,o=t[n]||e,i=o.length>0?o.slice(0,o.length):o,c=0;l=i[c++];)l[0].apply(l[1],e.slice.call(arguments,1))}};
},{}]},{},[1])
//@ sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJzb3VyY2VzIjpbIi9Vc2Vycy9Xb3JrL0RvY3VtZW50cy9UZW5taWxlcy9naXQvaXBvc3QvaW5kZXguanMiLCIvVXNlcnMvV29yay9Eb2N1bWVudHMvVGVubWlsZXMvZ2l0L2lwb3N0L25vZGVfbW9kdWxlcy9taW5pdmVudHMvZGlzdC9taW5pdmVudHMuY29tbW9uanMubWluLmpzIl0sIm5hbWVzIjpbXSwibWFwcGluZ3MiOiI7QUFBQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7O0FDblVBIiwiZmlsZSI6ImdlbmVyYXRlZC5qcyIsInNvdXJjZVJvb3QiOiIiLCJzb3VyY2VzQ29udGVudCI6WyJ2YXIgRXZlbnRzID0gcmVxdWlyZSgnbWluaXZlbnRzJyk7XG5cbnZhciBwbHVnaW4gPSB7XG4gIG5hbWU6ICdpcG9zdCcsXG4gIGRlc2NyaXB0aW9uOiAnRWFzZXMgdGhlIHdheSBvZiBwb3N0aW5nIGFuZCByZWNpZXZpbmcgaWZyYW1lIG1lc3NhZ2VzJyxcbiAgYWNjZXNzVmFyaWFibGU6ICdpcG9zdCcsXG4gIHZlcnNpb246ICcwLjAuMSdcbn07XG5cbnZhciBkZWZhdWx0cyA9IHtcbiAgaWZyYW1lVGltZW91dDogMTAgKiAxMDAwXG59O1xuXG5mdW5jdGlvbiBJRnJhbWVDbGFzcyh0YXJnZXRPcmlnaW4sIG9wdGlvbnMpIHtcbiAgaWYgKCF3aW5kb3cucGFyZW50ICYmIHR5cGVvZih0YXJnZXRPcmlnaW4pICE9PSAnc3RyaW5nJykge1xuICAgIHRocm93IG5ldyBFcnJvcigndGFyZ2V0T3JpZ2luIGlzIG1pc3NpbmcnKTtcbiAgfVxuICB0aGlzLnRhcmdldE9yaWdpbiA9IHRhcmdldE9yaWdpbjtcbiAgdGhpcy5jb25maWcgfHwgKHRoaXMuY29uZmlnID0ge30pO1xuICB0aGlzLmNvbmZpZyA9IGV4dGVuZChkZWZhdWx0cywgb3B0aW9ucyk7XG4gIHR5cGVvZih0aGlzLmNvbmZpZy5tb2RlKSA9PT0gJ3N0cmluZycgfHwgKHRoaXMuY29uZmlnLm1vZGUgPSAnaWZyYW1lJyk7XG4gIHRoaXMuX3JlcXVlc3RQcm9taXNlcyB8fCAodGhpcy5fcmVxdWVzdFByb21pc2VzID0ge30pO1xuICB0aGlzLl9yZWFkeURlZmVycmVkID0gJC5EZWZlcnJlZCgpO1xuICB0aGlzLmV2ZW50ID0gbmV3IEV2ZW50cygpO1xufVxuXG5JRnJhbWVDbGFzcy5wcm90b3R5cGUuaW5qZWN0ID0gZnVuY3Rpb24oKSB7XG4gIHJldHVybiB0aGlzLl9JRnJhbWUuYXBwbHkodGhpcywgYXJndW1lbnRzKTtcbn07XG5cbklGcmFtZUNsYXNzLnByb3RvdHlwZS5vcGVuID0gZnVuY3Rpb24gKCkge1xuICByZXR1cm4gdGhpcy5fb3BlblBvcHVwLmFwcGx5KHRoaXMsIGFyZ3VtZW50cyk7XG59O1xuXG5JRnJhbWVDbGFzcy5wcm90b3R5cGUuY2xvc2UgPSBmdW5jdGlvbiAoKSB7XG4gIHJldHVybiB0aGlzLl9jbG9zZVBvcHVwLmFwcGx5KHRoaXMsIGFyZ3VtZW50cyk7XG59O1xuXG5JRnJhbWVDbGFzcy5wcm90b3R5cGUubGlzdGVuID0gZnVuY3Rpb24oKSB7XG4gIHJldHVybiB0aGlzLl9saXN0ZW4uYXBwbHkodGhpcywgYXJndW1lbnRzKTtcbn07XG5cbklGcmFtZUNsYXNzLnByb3RvdHlwZS5wb3N0ID0gZnVuY3Rpb24ocGF5bG9hZCkge1xuICByZXR1cm4gdGhpcy5fcG9zdC5hcHBseSh0aGlzLCBhcmd1bWVudHMpO1xufTtcblxuSUZyYW1lQ2xhc3MucHJvdG90eXBlLnJlYWR5ID0gZnVuY3Rpb24oKSB7XG4gIHJldHVybiB0aGlzLl9wb3N0UmVhZHkoKTtcbn07XG5cbklGcmFtZUNsYXNzLnByb3RvdHlwZS5yZWFkeURlZmVycmVkID0gZnVuY3Rpb24gKCkge1xuICByZXR1cm4gdGhpcy5fcmVhZHlEZWZlcnJlZDtcbn07XG5cbklGcmFtZUNsYXNzLnByb3RvdHlwZS5vbiA9IGZ1bmN0aW9uKGV2ZW50TmFtZSwgaGFuZGxlcikge1xuICB0aGlzLmV2ZW50Lm9uKGV2ZW50TmFtZSwgaGFuZGxlcik7XG59O1xuXG4vKipcbiAqIExvY2FsIE1ldGhvZHNcbiAqL1xuSUZyYW1lQ2xhc3MucHJvdG90eXBlLl9JRnJhbWUgPSBmdW5jdGlvbigpIHtcbiAgaWYgKCF0aGlzLl9pZnJhbWVSZWFkeURlZmVycmVkKSB7XG4gICAgdGhpcy5faWZyYW1lUmVhZHlEZWZlcnJlZCA9ICQud2hlbih0aGlzLl9pbmplY3RJRnJhbWUuYXBwbHkodGhpcywgYXJndW1lbnRzKSwgdGhpcy5fcmVhZHlEZWZlcnJlZCkudGhlbihmdW5jdGlvbiAoaWZyYW1lQXJncykge1xuICAgICAgdmFyIGRlZmVycmVkID0gJC5EZWZlcnJlZCgpO1xuICAgICAgcmV0dXJuIGRlZmVycmVkLnJlc29sdmUuYXBwbHkoZGVmZXJyZWQsIGlmcmFtZUFyZ3MpO1xuICAgIH0pO1xuICB9XG4gIHJldHVybiB0aGlzLl9pZnJhbWVSZWFkeURlZmVycmVkO1xufTtcblxuSUZyYW1lQ2xhc3MucHJvdG90eXBlLl9Qb3B1cFdpbmRvdyA9IGZ1bmN0aW9uICgpIHtcbiAgcmV0dXJuICQud2hlbih0aGlzLl9vcGVuUG9wdXAuYXBwbHkodGhpcywgYXJndW1lbnRzKSwgdGhpcy5fcmVhZHlEZWZlcnJlZCkudGhlbihmdW5jdGlvbiAob3BlblBvcHVwQXJncykge1xuICAgIHZhciBkZWZlcnJlZCA9ICQuRGVmZXJyZWQoKTtcbiAgICByZXR1cm4gZGVmZXJyZWQucmVzb2x2ZS5hcHBseShkZWZlcnJlZCwgb3BlblBvcHVwQXJncyk7XG4gIH0pO1xufTtcblxuSUZyYW1lQ2xhc3MucHJvdG90eXBlLl9pbmplY3RJRnJhbWUgPSBmdW5jdGlvbihpZnJhbWUsIG9wdGlvbnMpIHtcbiAgdmFyIGRlZmVycmVkID0gJC5EZWZlcnJlZCgpLFxuICAgICRpZnJhbWUgPSAoaWZyYW1lICYmICQoaWZyYW1lKSkgfHwgJCgnPGlmcmFtZS8+Jyk7XG5cbiAgb3B0aW9ucyB8fCAob3B0aW9ucyA9IHt9KTtcbiAgb3B0aW9ucy5zcmMgJiYgKHRoaXMudGFyZ2V0T3JpZ2luID0gb3B0aW9ucy5zcmMpO1xuICAkaWZyYW1lLmF0dHIoJ3NyYycsIHRoaXMudGFyZ2V0T3JpZ2luKTtcbiAgdGhpcy5faXNJRnJhbWVJbmplY3RlZCA9IHRydWU7XG4gICRpZnJhbWUub24oJ2xvYWQnLCBmdW5jdGlvbigpIHtcbiAgICB3aW5kb3cuY2xlYXJUaW1lb3V0KHRoaXMuX2lmcmFtZUxvYWRUaW1lb3V0SW5kZXgpO1xuICAgIGRlZmVycmVkLnJlc29sdmUoJGlmcmFtZS5nZXQoMCksICRpZnJhbWUpO1xuICB9KTtcbiAgJCgnYm9keScpLmFwcGVuZCgkaWZyYW1lKTtcbiAgdGhpcy5faWZyYW1lTG9hZFRpbWVvdXRJbmRleCA9IHdpbmRvdy5zZXRUaW1lb3V0KGZ1bmN0aW9uKCkge1xuICAgIHZhciBlcnJvciA9IG5ldyBFcnJvcigpO1xuICAgIGVycm9yLnR5cGUgPSAnaWZyYW1lX2xvYWRfdGltZW91dCc7XG4gICAgZXJyb3IubWVzc2FnZSA9ICdJRnJhbWUgdGltZWQgb3V0IHRvIGxvYWQnO1xuICAgIGRlZmVycmVkLnJlamVjdChlcnJvcik7XG4gIH0sIHRoaXMuY29uZmlnLmlmcmFtZVRpbWVvdXQpO1xuICByZXR1cm4gZGVmZXJyZWQ7XG59O1xuXG5JRnJhbWVDbGFzcy5wcm90b3R5cGUuX29wZW5Qb3B1cCA9IGZ1bmN0aW9uICgpIHtcbiAgdmFyIHNlbGYgPSB0aGlzLFxuICAgIGRlZmVycmVkID0gJC5EZWZlcnJlZCgpLFxuICAgIG9wZW5BcmdzO1xuICBpZiAoIXRoaXMuX2lzUG9wdXBXaW5kb3dPcGVuKSB7XG4gICAgb3BlbkFyZ3MgPSBbIHRoaXMudGFyZ2V0T3JpZ2luLCBdO1xuICAgIGlmICh0eXBlb2YodGhpcy5jb25maWcudGFyZ2V0KSA9PT0gJ3N0cmluZycpIHtcbiAgICAgIG9wZW5BcmdzLnB1c2godGhpcy5jb25maWcudGFyZ2V0KTtcbiAgICB9XG4gICAgaWYgKHR5cGVvZih0aGlzLmNvbmZpZy53aW5kb3dPcHRpb25zKSA9PT0gJ3N0cmluZycpIHtcbiAgICAgIG9wZW5BcmdzLnB1c2godGhpcy5jb25maWcud2luZG93T3B0aW9ucyk7XG4gICAgfVxuICAgIHRoaXMuX3BvcHVwV2luZG93ID0gd2luZG93Lm9wZW4uYXBwbHkod2luZG93LCBvcGVuQXJncyk7XG4gICAgdGhpcy5faXNQb3B1cFdpbmRvd09wZW4gPSB0cnVlO1xuICAgIHRoaXMuX3BvcHVwV2luZG93SW50ZXJ2YWxJbmRleCA9IHdpbmRvdy5zZXRJbnRlcnZhbChmdW5jdGlvbiAoKSB7XG4gICAgICBpZiAoc2VsZi5fcG9wdXBXaW5kb3cuY2xvc2VkKSB7XG4gICAgICAgIHNlbGYuX2Nsb3NlUG9wdXAoKTtcbiAgICAgIH1cbiAgICB9LCA1MDApO1xuICB9XG4gIGRlZmVycmVkLnJlc29sdmUodGhpcy5fcG9wdXBXaW5kb3csICQodGhpcy5fcG9wdXBXaW5kb3cpKTtcbiAgcmV0dXJuIGRlZmVycmVkLnByb21pc2UoKTtcbn07XG5cbklGcmFtZUNsYXNzLnByb3RvdHlwZS5fY2xvc2VQb3B1cCA9IGZ1bmN0aW9uICgpIHtcbiAgaWYgKHRoaXMuX3BvcHVwV2luZG93KSB7XG4gICAgd2luZG93LmNsZWFySW50ZXJ2YWwodGhpcy5fcG9wdXBXaW5kb3dJbnRlcnZhbEluZGV4KTtcbiAgICB0aGlzLl9wb3B1cFdpbmRvdy5jbG9zZSgpO1xuICAgIGRlbGV0ZSB0aGlzLl9wb3B1cFdpbmRvdztcbiAgICB0aGlzLl9pc1BvcHVwV2luZG93T3BlbiA9IGZhbHNlO1xuICB9XG59O1xuXG5JRnJhbWVDbGFzcy5wcm90b3R5cGUuX3Bvc3RSZWFkeSA9IGZ1bmN0aW9uICgpIHtcbiAgdmFyIHJlcXVlc3QgPSB7fTtcbiAgcmVxdWVzdC5wbHVnaW4gPSBwbHVnaW4ubmFtZTtcbiAgcmVxdWVzdC50eXBlID0gJ3JlYWR5JztcbiAgcmVxdWVzdC5tb2RlID0gdGhpcy5jb25maWcubW9kZTtcbiAgdGhpcy5fcG9zdFJhdyhyZXF1ZXN0KTtcbn07XG5cbklGcmFtZUNsYXNzLnByb3RvdHlwZS5fcG9zdCA9IGZ1bmN0aW9uKCkge1xuICB2YXIgcmVxdWVzdCA9IHt9LFxuICAgIGluZGV4O1xuICByZXF1ZXN0LmlkID0gUmFuZG9tLnM0KCk7XG4gIHJlcXVlc3QudHlwZSA9ICdwaW5nJztcbiAgcmVxdWVzdC5wYXlsb2FkID0gQXJyYXkucHJvdG90eXBlLnNsaWNlLmNhbGwoYXJndW1lbnRzKTtcbiAgcmVxdWVzdC5wbHVnaW4gPSBwbHVnaW4ubmFtZTtcbiAgdGhpcy5fcmVxdWVzdFByb21pc2VzW3JlcXVlc3QuaWRdID0gbmV3ICQuRGVmZXJyZWQoKTtcbiAgdGhpcy5fcG9zdFJhdyhyZXF1ZXN0KTtcbiAgcmV0dXJuIHRoaXMuX3JlcXVlc3RQcm9taXNlc1tyZXF1ZXN0LmlkXTtcbn07XG5cbklGcmFtZUNsYXNzLnByb3RvdHlwZS5fcG9zdFJhdyA9IGZ1bmN0aW9uKHJlcXVlc3QpIHtcbiAgdmFyIHNlbGYgPSB0aGlzO1xuICBpZih0aGlzLmNvbmZpZy5jaGlsZCAmJiB3aW5kb3cucGFyZW50KSB7XG4gICAgd2luZG93LnBhcmVudC5wb3N0TWVzc2FnZShKU09OLnN0cmluZ2lmeShyZXF1ZXN0KSwgc2VsZi50YXJnZXRPcmlnaW4gfHwgJyonKTtcbiAgICByZXR1cm4gJC5EZWZlcnJlZCgpLnJlc29sdmUoKS5wcm9taXNlKCk7XG4gIH0gZWxzZSBpZiAodGhpcy5jb25maWcubW9kZSA9PT0gJ3BvcHVwJyAmJiAodGhpcy5jb25maWcucG9wdXAgfHwgdGhpcy5jb25maWcuY2hpbGQpICYmIHdpbmRvdy5vcGVuZXIpIHtcbiAgICB3aW5kb3cub3BlbmVyLnBvc3RNZXNzYWdlKEpTT04uc3RyaW5naWZ5KHJlcXVlc3QpLCBzZWxmLnRhcmdldE9yaWdpbiB8fCAnKicpO1xuICAgIHJldHVybiAkLkRlZmVycmVkKCkucmVzb2x2ZSgpLnByb21pc2UoKTtcbiAgfSBlbHNlIHtcbiAgICBpZiAodGhpcy5jb25maWcubW9kZSA9PT0gJ3BvcHVwJykge1xuICAgICAgcmV0dXJuIHRoaXMuX1BvcHVwV2luZG93KCkudGhlbihmdW5jdGlvbih3aW4sICR3aW4pIHtcbiAgICAgICAgdmFyIGRlZmVycmVkID0gJC5EZWZlcnJlZCgpO1xuICAgICAgICB0cnkge1xuICAgICAgICAgIHdpbi5wb3N0TWVzc2FnZShKU09OLnN0cmluZ2lmeShyZXF1ZXN0KSwgc2VsZi50YXJnZXRPcmlnaW4pO1xuICAgICAgICAgIGRlZmVycmVkLnJlc29sdmUoKTtcbiAgICAgICAgfSBjYXRjaCAoZXJyKSB7XG4gICAgICAgICAgZGVmZXJyZWQucmVqZWN0KGVycik7XG4gICAgICAgIH1cbiAgICAgICAgcmV0dXJuIGRlZmVycmVkLnByb21pc2UoKTtcbiAgICAgIH0pO1xuICAgIH0gZWxzZSB7XG4gICAgICByZXR1cm4gdGhpcy5fSUZyYW1lKCkudGhlbihmdW5jdGlvbihpZnJhbWUsICRpZnJhbWUpIHtcbiAgICAgICAgdmFyIGRlZmVycmVkID0gJC5EZWZlcnJlZCgpO1xuICAgICAgICB0cnkge1xuICAgICAgICAgIGlmcmFtZS5jb250ZW50V2luZG93LnBvc3RNZXNzYWdlKEpTT04uc3RyaW5naWZ5KHJlcXVlc3QpLCBzZWxmLnRhcmdldE9yaWdpbik7XG4gICAgICAgICAgZGVmZXJyZWQucmVzb2x2ZSgpO1xuICAgICAgICB9IGNhdGNoIChlcnIpIHtcbiAgICAgICAgICBkZWZlcnJlZC5yZWplY3QoZXJyKTtcbiAgICAgICAgfVxuICAgICAgICByZXR1cm4gZGVmZXJyZWQucHJvbWlzZSgpO1xuICAgICAgfSk7XG4gICAgfVxuICB9XG59O1xuXG5JRnJhbWVDbGFzcy5wcm90b3R5cGUuX2xpc3RlbiA9IGZ1bmN0aW9uKHJlcXVlc3QpIHtcbiAgdmFyIHNlbGYgPSB0aGlzO1xuICBpZiAoIXNlbGYuX2lzTGlzdGVuaW5nKSB7XG4gICAgJCh3aW5kb3cpLm9uKCdtZXNzYWdlJywgZnVuY3Rpb24oZXZlbnQpIHtcbiAgICAgIHNlbGYuX21lc3NhZ2VIYW5kbGVyKGV2ZW50Lm9yaWdpbmFsRXZlbnQuZGF0YSk7XG4gICAgfSk7XG4gIH1cbn07XG5cbklGcmFtZUNsYXNzLnByb3RvdHlwZS5fcG9zdFJlcGx5ID0gZnVuY3Rpb24oZGVmZXJyZWQsIF9hcmd1bWVudHMpIHtcbiAgdmFyIHN0YXRlID0gZGVmZXJyZWQuc3RhdGUoKSxcbiAgICBtZXNzYWdlID0gZGVmZXJyZWQuX2lwb3N0TWVzc2FnZTtcblxuICBtZXNzYWdlLnBheWxvYWQgPSBBcnJheS5wcm90b3R5cGUuc2xpY2UuY2FsbChfYXJndW1lbnRzKTtcbiAgaWYgKHN0YXRlID09PSAncmVzb2x2ZWQnIHx8IHN0YXRlID09PSAncmVqZWN0ZWQnKSB7XG4gICAgbWVzc2FnZS50eXBlID0gJ3BvbmcnO1xuICAgIG1lc3NhZ2Uuc3RhdGUgPSBzdGF0ZTtcbiAgfSBlbHNlIHtcbiAgICBtZXNzYWdlLnR5cGUgPSAnbm90aWZ5JztcbiAgfVxuICB0aGlzLl9wb3N0UmF3KG1lc3NhZ2UpO1xufTtcblxuSUZyYW1lQ2xhc3MucHJvdG90eXBlLl9tZXNzYWdlSGFuZGxlciA9IGZ1bmN0aW9uKG1lc3NhZ2UpIHtcbiAgdmFyIHNlbGYgPSB0aGlzO1xuXG4gIHRyeSB7XG4gICAgbWVzc2FnZSA9IEpTT04ucGFyc2UobWVzc2FnZSk7XG4gIH0gY2F0Y2ggKGV4Y2VwdGlvbikge1xuICAgIGNvbnNvbGUud2FybignQ291bGRub3QgcGFyc2UgdGhlIHJlY2VpdmVkIG1lc3NhZ2UuIE1lc3NhZ2U6JywgbWVzc2FnZSk7XG4gICAgcmV0dXJuO1xuICB9XG4gIGlmIChtZXNzYWdlLnBsdWdpbiA9PT0gcGx1Z2luLm5hbWUpIHtcblxuICAgIGlmIChtZXNzYWdlLnR5cGUgPT09ICdyZWFkeScgJiYgdGhpcy5jb25maWcubW9kZSA9PT0gbWVzc2FnZS5tb2RlKSB7XG5cbiAgICAgIHRoaXMuX3JlYWR5RGVmZXJyZWQucmVzb2x2ZSgpO1xuICAgICAgdGhpcy5ldmVudC5lbWl0KCdyZWFkeScpO1xuXG4gICAgfSBlbHNlIGlmKG1lc3NhZ2UudHlwZSA9PT0gJ3BpbmcnKSB7XG5cbiAgICAgIHZhciBwaW5nRGVmZXJyZWQgPSAkLkRlZmVycmVkKCk7XG4gICAgICBwaW5nRGVmZXJyZWQuX2lwb3N0TWVzc2FnZSA9IG1lc3NhZ2U7XG4gICAgICB2YXIgcGluZ0RlZmVycmVkID0gcGluZ0RlZmVycmVkLmFsd2F5cyhmdW5jdGlvbigpIHtcbiAgICAgICAgc2VsZi5fcG9zdFJlcGx5KHBpbmdEZWZlcnJlZCwgYXJndW1lbnRzKTtcbiAgICAgIH0pLnByb2dyZXNzKGZ1bmN0aW9uKCkge1xuICAgICAgICBzZWxmLl9wb3N0UmVwbHkocGluZ0RlZmVycmVkLCBhcmd1bWVudHMpO1xuICAgICAgfSk7XG5cbiAgICAgIHZhciBldmVudEVtaXRBcmd1bWVudHMgPSBbXTtcbiAgICAgIGV2ZW50RW1pdEFyZ3VtZW50cy5wdXNoKCdtZXNzYWdlJyk7XG4gICAgICBldmVudEVtaXRBcmd1bWVudHMucHVzaChwaW5nRGVmZXJyZWQpO1xuICAgICAgZXZlbnRFbWl0QXJndW1lbnRzID0gZXZlbnRFbWl0QXJndW1lbnRzLmNvbmNhdChtZXNzYWdlLnBheWxvYWQpO1xuICAgICAgdGhpcy5ldmVudC5lbWl0LmFwcGx5KHRoaXMuZXZlbnQsIGV2ZW50RW1pdEFyZ3VtZW50cyk7XG5cbiAgICB9IGVsc2Uge1xuXG4gICAgICB2YXIgcmVxdWVzdFByb21pc2UgPSB0aGlzLl9yZXF1ZXN0UHJvbWlzZXNbbWVzc2FnZS5pZF07XG4gICAgICBpZiAocmVxdWVzdFByb21pc2UpIHtcblxuICAgICAgICBzd2l0Y2ggKG1lc3NhZ2UudHlwZSkge1xuICAgICAgICAgIGNhc2UgJ3BvbmcnOlxuICAgICAgICAgICAgaWYgKG1lc3NhZ2Uuc3RhdGUgPT09ICdyZXNvbHZlZCcpIHtcbiAgICAgICAgICAgICAgcmVxdWVzdFByb21pc2UucmVzb2x2ZS5hcHBseShyZXF1ZXN0UHJvbWlzZSwgbWVzc2FnZS5wYXlsb2FkKTtcbiAgICAgICAgICAgIH0gZWxzZSB7XG4gICAgICAgICAgICAgIHJlcXVlc3RQcm9taXNlLnJlamVjdC5hcHBseShyZXF1ZXN0UHJvbWlzZSwgbWVzc2FnZS5wYXlsb2FkKTtcbiAgICAgICAgICAgIH1cbiAgICAgICAgICAgIHRoaXMuX3JlbW92ZVJlcXVlc3RQcm9taXNlKG1lc3NhZ2UuaWQpO1xuICAgICAgICAgICAgYnJlYWs7XG4gICAgICAgICAgY2FzZSAnbm90aWZ5JzpcbiAgICAgICAgICAgIHJlcXVlc3RQcm9taXNlLm5vdGlmeS5hcHBseShyZXF1ZXN0UHJvbWlzZSwgbWVzc2FnZS5wYXlsb2FkKTtcbiAgICAgICAgICAgIGJyZWFrO1xuICAgICAgICAgIGRlZmF1bHQ6XG4gICAgICAgICAgICBjb25zb2xlLndhcm4oJ1Vua25vd24gbWVzc2FnZSB0eXBlLiBtZXNzYWdlVHlwZTonLCBtZXNzYWdlLnR5cGUpO1xuICAgICAgICB9XG5cbiAgICAgIH1cblxuICAgIH1cbiAgfVxufTtcblxuSUZyYW1lQ2xhc3MucHJvdG90eXBlLl9yZW1vdmVSZXF1ZXN0UHJvbWlzZSA9IGZ1bmN0aW9uKHJlcXVlc3RJZCkge1xuICBkZWxldGUgdGhpcy5fcmVxdWVzdFByb21pc2VzW3JlcXVlc3RJZF07XG59O1xuXG5mdW5jdGlvbiBjcmVhdGVJUG9zdE9iamVjdCh0YXJnZXRPcmlnaW4sIG9wdGlvbnMpIHtcbiAgcmV0dXJuIG5ldyBJRnJhbWVDbGFzcyh0YXJnZXRPcmlnaW4sIG9wdGlvbnMpO1xufVxuXG4vKipcbiAqIC0tLS0tLS0tLS0tLS0tXG4gKiBIZWxwZXIgbWV0aG9kc1xuICogLS0tLS0tLS0tLS0tLS1cbiAqL1xuXG4vKipcbiAqIE1lcmdlIGRlZmF1bHRzIHdpdGggdXNlciBvcHRpb25zXG4gKiBAcGFyYW0ge09iamVjdH0gZGVmYXVsdHMgRGVmYXVsdCBzZXR0aW5nc1xuICogQHBhcmFtIHtPYmplY3R9IG9wdGlvbnMgVXNlciBvcHRpb25zXG4gKiBAcmV0dXJucyB7T2JqZWN0fSBNZXJnZWQgdmFsdWVzIG9mIGRlZmF1bHRzIGFuZCBvcHRpb25zXG4gKi9cbnZhciBleHRlbmQgPSBmdW5jdGlvbihkZWZhdWx0cywgb3B0aW9ucykge1xuICB2YXIgZXh0ZW5kZWQgPSB7fTtcbiAgdmFyIHByb3A7XG4gIGZvciAocHJvcCBpbiBkZWZhdWx0cykge1xuICAgIGlmIChPYmplY3QucHJvdG90eXBlLmhhc093blByb3BlcnR5LmNhbGwoZGVmYXVsdHMsIHByb3ApKSB7XG4gICAgICBleHRlbmRlZFtwcm9wXSA9IGRlZmF1bHRzW3Byb3BdO1xuICAgIH1cbiAgfVxuICBmb3IgKHByb3AgaW4gb3B0aW9ucykge1xuICAgIGlmIChPYmplY3QucHJvdG90eXBlLmhhc093blByb3BlcnR5LmNhbGwob3B0aW9ucywgcHJvcCkpIHtcbiAgICAgIGV4dGVuZGVkW3Byb3BdID0gb3B0aW9uc1twcm9wXTtcbiAgICB9XG4gIH1cbiAgcmV0dXJuIGV4dGVuZGVkO1xufTtcblxuLyoqXG4gKiBHZW5lcmF0ZSBSYW5kb20gSURcbiAqL1xudmFyIFJhbmRvbSA9IHtcblxuICBzNDogZnVuY3Rpb24oKSB7XG4gICAgcmV0dXJuICgoKDEgKyBNYXRoLnJhbmRvbSgpKSAqIDB4MTAwMDApIHwgMCkudG9TdHJpbmcoMTYpLnN1YnN0cmluZygxKTtcbiAgfSxcblxuICBndWlkOiBmdW5jdGlvbigpIHtcbiAgICByZXR1cm4gKHRoaXMuczQoKSArIHRoaXMuczQoKSArIFwiLVwiICsgdGhpcy5zNCgpICsgXCItXCIgKyB0aGlzLnM0KCkgKyBcIi1cIiArIHRoaXMuczQoKSArIFwiLVwiICsgdGhpcy5zNCgpICsgdGhpcy5zNCgpICsgdGhpcy5zNCgpKTtcbiAgfSxcblxufTtcblxud2luZG93LklQb3N0ID0gSUZyYW1lQ2xhc3M7XG5cbm1vZHVsZS5leHBvcnRzID0gSUZyYW1lQ2xhc3M7IiwibW9kdWxlLmV4cG9ydHM9ZnVuY3Rpb24obil7dmFyIHQ9e30sZT1bXTtuPW58fHRoaXMsbi5vbj1mdW5jdGlvbihuLGUsbCl7KHRbbl09dFtuXXx8W10pLnB1c2goW2UsbF0pfSxuLm9mZj1mdW5jdGlvbihuLGwpe258fCh0PXt9KTtmb3IodmFyIG89dFtuXXx8ZSxpPW8ubGVuZ3RoPWw/by5sZW5ndGg6MDtpLS07KWw9PW9baV1bMF0mJm8uc3BsaWNlKGksMSl9LG4uZW1pdD1mdW5jdGlvbihuKXtmb3IodmFyIGwsbz10W25dfHxlLGk9by5sZW5ndGg+MD9vLnNsaWNlKDAsby5sZW5ndGgpOm8sYz0wO2w9aVtjKytdOylsWzBdLmFwcGx5KGxbMV0sZS5zbGljZS5jYWxsKGFyZ3VtZW50cywxKSl9fTsiXX0=
;