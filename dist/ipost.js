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
  this._requestPromises || (this._requestPromises = {});
  this.event = new Events();
}

IFrameClass.prototype.inject = function() {
  return this._IFrame.apply(this, arguments);
};

IFrameClass.prototype.listen = function() {
  return this._listen.apply(this, arguments);
};

IFrameClass.prototype.post = function(payload) {
  return this._post.apply(this, arguments);
};

IFrameClass.prototype.on = function(eventName, handler) {
  this.event.on(eventName, handler);
};

/**
 * Local Methods
 */
IFrameClass.prototype._IFrame = function() {
  if (!this._iframeReadyDeferred) {
    this._iframeReadyDeferred = this._injectIFrame.apply(this, arguments);
  }
  return this._iframeReadyDeferred;
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
  if (this.config.child && window.parent) {
    window.parent.postMessage(JSON.stringify(request), self.targetOrigin || '*');
    return $.Deferred().resolve().promise();
  } else {
    return this._IFrame().then(function(iframe, $iframe) {
      iframe.contentWindow.postMessage(JSON.stringify(request), self.targetOrigin);
      return $.Deferred().resolve().promise();
    });
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

    if (message.type === 'ping') {

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
module.exports=function(n){var o={},t=[];n=n||this,n.on=function(n,t,e){(o[n]=o[n]||[]).push([t,e])},n.off=function(n,e){n||(o={});for(var f=o[n]||t,i=f.length=e?f.length:0;i--;)e==f[i][0]&&f.splice(i,1)},n.emit=function(n){for(var e,f=o[n]||t,i=0;e=f[i++];)e[0].apply(e[1],t.slice.call(arguments,1))}};
},{}]},{},[1])
//@ sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJzb3VyY2VzIjpbIi9Vc2Vycy9zdW5kYXJhc2FuL0RvY3VtZW50cy9UZW5taWxlcy9naXQvaXBvc3QvaW5kZXguanMiLCIvVXNlcnMvc3VuZGFyYXNhbi9Eb2N1bWVudHMvVGVubWlsZXMvZ2l0L2lwb3N0L25vZGVfbW9kdWxlcy9taW5pdmVudHMvZGlzdC9taW5pdmVudHMuY29tbW9uanMubWluLmpzIl0sIm5hbWVzIjpbXSwibWFwcGluZ3MiOiI7QUFBQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7O0FDbk9BIiwiZmlsZSI6ImdlbmVyYXRlZC5qcyIsInNvdXJjZVJvb3QiOiIiLCJzb3VyY2VzQ29udGVudCI6WyJ2YXIgRXZlbnRzID0gcmVxdWlyZSgnbWluaXZlbnRzJyk7XG5cbnZhciBwbHVnaW4gPSB7XG4gIG5hbWU6ICdpcG9zdCcsXG4gIGRlc2NyaXB0aW9uOiAnRWFzZXMgdGhlIHdheSBvZiBwb3N0aW5nIGFuZCByZWNpZXZpbmcgaWZyYW1lIG1lc3NhZ2VzJyxcbiAgYWNjZXNzVmFyaWFibGU6ICdpcG9zdCcsXG4gIHZlcnNpb246ICcwLjAuMSdcbn07XG5cbnZhciBkZWZhdWx0cyA9IHtcbiAgaWZyYW1lVGltZW91dDogMTAgKiAxMDAwXG59O1xuXG5mdW5jdGlvbiBJRnJhbWVDbGFzcyh0YXJnZXRPcmlnaW4sIG9wdGlvbnMpIHtcbiAgaWYgKCF3aW5kb3cucGFyZW50ICYmIHR5cGVvZih0YXJnZXRPcmlnaW4pICE9PSAnc3RyaW5nJykge1xuICAgIHRocm93IG5ldyBFcnJvcigndGFyZ2V0T3JpZ2luIGlzIG1pc3NpbmcnKTtcbiAgfVxuICB0aGlzLnRhcmdldE9yaWdpbiA9IHRhcmdldE9yaWdpbjtcbiAgdGhpcy5jb25maWcgfHwgKHRoaXMuY29uZmlnID0ge30pO1xuICB0aGlzLmNvbmZpZyA9IGV4dGVuZChkZWZhdWx0cywgb3B0aW9ucyk7XG4gIHRoaXMuX3JlcXVlc3RQcm9taXNlcyB8fCAodGhpcy5fcmVxdWVzdFByb21pc2VzID0ge30pO1xuICB0aGlzLmV2ZW50ID0gbmV3IEV2ZW50cygpO1xufVxuXG5JRnJhbWVDbGFzcy5wcm90b3R5cGUuaW5qZWN0ID0gZnVuY3Rpb24oKSB7XG4gIHJldHVybiB0aGlzLl9JRnJhbWUuYXBwbHkodGhpcywgYXJndW1lbnRzKTtcbn07XG5cbklGcmFtZUNsYXNzLnByb3RvdHlwZS5saXN0ZW4gPSBmdW5jdGlvbigpIHtcbiAgcmV0dXJuIHRoaXMuX2xpc3Rlbi5hcHBseSh0aGlzLCBhcmd1bWVudHMpO1xufTtcblxuSUZyYW1lQ2xhc3MucHJvdG90eXBlLnBvc3QgPSBmdW5jdGlvbihwYXlsb2FkKSB7XG4gIHJldHVybiB0aGlzLl9wb3N0LmFwcGx5KHRoaXMsIGFyZ3VtZW50cyk7XG59O1xuXG5JRnJhbWVDbGFzcy5wcm90b3R5cGUub24gPSBmdW5jdGlvbihldmVudE5hbWUsIGhhbmRsZXIpIHtcbiAgdGhpcy5ldmVudC5vbihldmVudE5hbWUsIGhhbmRsZXIpO1xufTtcblxuLyoqXG4gKiBMb2NhbCBNZXRob2RzXG4gKi9cbklGcmFtZUNsYXNzLnByb3RvdHlwZS5fSUZyYW1lID0gZnVuY3Rpb24oKSB7XG4gIGlmICghdGhpcy5faWZyYW1lUmVhZHlEZWZlcnJlZCkge1xuICAgIHRoaXMuX2lmcmFtZVJlYWR5RGVmZXJyZWQgPSB0aGlzLl9pbmplY3RJRnJhbWUuYXBwbHkodGhpcywgYXJndW1lbnRzKTtcbiAgfVxuICByZXR1cm4gdGhpcy5faWZyYW1lUmVhZHlEZWZlcnJlZDtcbn07XG5cbklGcmFtZUNsYXNzLnByb3RvdHlwZS5faW5qZWN0SUZyYW1lID0gZnVuY3Rpb24oaWZyYW1lLCBvcHRpb25zKSB7XG4gIHZhciBkZWZlcnJlZCA9ICQuRGVmZXJyZWQoKSxcbiAgICAkaWZyYW1lID0gKGlmcmFtZSAmJiAkKGlmcmFtZSkpIHx8ICQoJzxpZnJhbWUvPicpO1xuXG4gIG9wdGlvbnMgfHwgKG9wdGlvbnMgPSB7fSk7XG4gIG9wdGlvbnMuc3JjICYmICh0aGlzLnRhcmdldE9yaWdpbiA9IG9wdGlvbnMuc3JjKTtcbiAgJGlmcmFtZS5hdHRyKCdzcmMnLCB0aGlzLnRhcmdldE9yaWdpbik7XG4gIHRoaXMuX2lzSUZyYW1lSW5qZWN0ZWQgPSB0cnVlO1xuICAkaWZyYW1lLm9uKCdsb2FkJywgZnVuY3Rpb24oKSB7XG4gICAgd2luZG93LmNsZWFyVGltZW91dCh0aGlzLl9pZnJhbWVMb2FkVGltZW91dEluZGV4KTtcbiAgICBkZWZlcnJlZC5yZXNvbHZlKCRpZnJhbWUuZ2V0KDApLCAkaWZyYW1lKTtcbiAgfSk7XG4gICQoJ2JvZHknKS5hcHBlbmQoJGlmcmFtZSk7XG4gIHRoaXMuX2lmcmFtZUxvYWRUaW1lb3V0SW5kZXggPSB3aW5kb3cuc2V0VGltZW91dChmdW5jdGlvbigpIHtcbiAgICB2YXIgZXJyb3IgPSBuZXcgRXJyb3IoKTtcbiAgICBlcnJvci50eXBlID0gJ2lmcmFtZV9sb2FkX3RpbWVvdXQnO1xuICAgIGVycm9yLm1lc3NhZ2UgPSAnSUZyYW1lIHRpbWVkIG91dCB0byBsb2FkJztcbiAgICBkZWZlcnJlZC5yZWplY3QoZXJyb3IpO1xuICB9LCB0aGlzLmNvbmZpZy5pZnJhbWVUaW1lb3V0KTtcbiAgcmV0dXJuIGRlZmVycmVkO1xufTtcblxuSUZyYW1lQ2xhc3MucHJvdG90eXBlLl9wb3N0ID0gZnVuY3Rpb24oKSB7XG4gIHZhciByZXF1ZXN0ID0ge30sXG4gICAgaW5kZXg7XG4gIHJlcXVlc3QuaWQgPSBSYW5kb20uczQoKTtcbiAgcmVxdWVzdC50eXBlID0gJ3BpbmcnO1xuICByZXF1ZXN0LnBheWxvYWQgPSBBcnJheS5wcm90b3R5cGUuc2xpY2UuY2FsbChhcmd1bWVudHMpO1xuICByZXF1ZXN0LnBsdWdpbiA9IHBsdWdpbi5uYW1lO1xuICB0aGlzLl9yZXF1ZXN0UHJvbWlzZXNbcmVxdWVzdC5pZF0gPSBuZXcgJC5EZWZlcnJlZCgpO1xuICB0aGlzLl9wb3N0UmF3KHJlcXVlc3QpO1xuICByZXR1cm4gdGhpcy5fcmVxdWVzdFByb21pc2VzW3JlcXVlc3QuaWRdO1xufTtcblxuSUZyYW1lQ2xhc3MucHJvdG90eXBlLl9wb3N0UmF3ID0gZnVuY3Rpb24ocmVxdWVzdCkge1xuICB2YXIgc2VsZiA9IHRoaXM7XG4gIGlmICh0aGlzLmNvbmZpZy5jaGlsZCAmJiB3aW5kb3cucGFyZW50KSB7XG4gICAgd2luZG93LnBhcmVudC5wb3N0TWVzc2FnZShKU09OLnN0cmluZ2lmeShyZXF1ZXN0KSwgc2VsZi50YXJnZXRPcmlnaW4gfHwgJyonKTtcbiAgICByZXR1cm4gJC5EZWZlcnJlZCgpLnJlc29sdmUoKS5wcm9taXNlKCk7XG4gIH0gZWxzZSB7XG4gICAgcmV0dXJuIHRoaXMuX0lGcmFtZSgpLnRoZW4oZnVuY3Rpb24oaWZyYW1lLCAkaWZyYW1lKSB7XG4gICAgICBpZnJhbWUuY29udGVudFdpbmRvdy5wb3N0TWVzc2FnZShKU09OLnN0cmluZ2lmeShyZXF1ZXN0KSwgc2VsZi50YXJnZXRPcmlnaW4pO1xuICAgICAgcmV0dXJuICQuRGVmZXJyZWQoKS5yZXNvbHZlKCkucHJvbWlzZSgpO1xuICAgIH0pO1xuICB9XG59O1xuXG5JRnJhbWVDbGFzcy5wcm90b3R5cGUuX2xpc3RlbiA9IGZ1bmN0aW9uKHJlcXVlc3QpIHtcbiAgdmFyIHNlbGYgPSB0aGlzO1xuICBpZiAoIXNlbGYuX2lzTGlzdGVuaW5nKSB7XG4gICAgJCh3aW5kb3cpLm9uKCdtZXNzYWdlJywgZnVuY3Rpb24oZXZlbnQpIHtcbiAgICAgIHNlbGYuX21lc3NhZ2VIYW5kbGVyKGV2ZW50Lm9yaWdpbmFsRXZlbnQuZGF0YSk7XG4gICAgfSk7XG4gIH1cbn07XG5cbklGcmFtZUNsYXNzLnByb3RvdHlwZS5fcG9zdFJlcGx5ID0gZnVuY3Rpb24oZGVmZXJyZWQsIF9hcmd1bWVudHMpIHtcbiAgdmFyIHN0YXRlID0gZGVmZXJyZWQuc3RhdGUoKSxcbiAgICBtZXNzYWdlID0gZGVmZXJyZWQuX2lwb3N0TWVzc2FnZTtcblxuICBtZXNzYWdlLnBheWxvYWQgPSBBcnJheS5wcm90b3R5cGUuc2xpY2UuY2FsbChfYXJndW1lbnRzKTtcbiAgaWYgKHN0YXRlID09PSAncmVzb2x2ZWQnIHx8IHN0YXRlID09PSAncmVqZWN0ZWQnKSB7XG4gICAgbWVzc2FnZS50eXBlID0gJ3BvbmcnO1xuICAgIG1lc3NhZ2Uuc3RhdGUgPSBzdGF0ZTtcbiAgfSBlbHNlIHtcbiAgICBtZXNzYWdlLnR5cGUgPSAnbm90aWZ5JztcbiAgfVxuICB0aGlzLl9wb3N0UmF3KG1lc3NhZ2UpO1xufTtcblxuSUZyYW1lQ2xhc3MucHJvdG90eXBlLl9tZXNzYWdlSGFuZGxlciA9IGZ1bmN0aW9uKG1lc3NhZ2UpIHtcbiAgdmFyIHNlbGYgPSB0aGlzO1xuXG4gIHRyeSB7XG4gICAgbWVzc2FnZSA9IEpTT04ucGFyc2UobWVzc2FnZSk7XG4gIH0gY2F0Y2ggKGV4Y2VwdGlvbikge1xuICAgIGNvbnNvbGUud2FybignQ291bGRub3QgcGFyc2UgdGhlIHJlY2VpdmVkIG1lc3NhZ2UuIE1lc3NhZ2U6JywgbWVzc2FnZSk7XG4gICAgcmV0dXJuO1xuICB9XG4gIGlmIChtZXNzYWdlLnBsdWdpbiA9PT0gcGx1Z2luLm5hbWUpIHtcblxuICAgIGlmIChtZXNzYWdlLnR5cGUgPT09ICdwaW5nJykge1xuXG4gICAgICB2YXIgcGluZ0RlZmVycmVkID0gJC5EZWZlcnJlZCgpO1xuICAgICAgcGluZ0RlZmVycmVkLl9pcG9zdE1lc3NhZ2UgPSBtZXNzYWdlO1xuICAgICAgdmFyIHBpbmdEZWZlcnJlZCA9IHBpbmdEZWZlcnJlZC5hbHdheXMoZnVuY3Rpb24oKSB7XG4gICAgICAgIHNlbGYuX3Bvc3RSZXBseShwaW5nRGVmZXJyZWQsIGFyZ3VtZW50cyk7XG4gICAgICB9KS5wcm9ncmVzcyhmdW5jdGlvbigpIHtcbiAgICAgICAgc2VsZi5fcG9zdFJlcGx5KHBpbmdEZWZlcnJlZCwgYXJndW1lbnRzKTtcbiAgICAgIH0pO1xuXG4gICAgICB2YXIgZXZlbnRFbWl0QXJndW1lbnRzID0gW107XG4gICAgICBldmVudEVtaXRBcmd1bWVudHMucHVzaCgnbWVzc2FnZScpO1xuICAgICAgZXZlbnRFbWl0QXJndW1lbnRzLnB1c2gocGluZ0RlZmVycmVkKTtcbiAgICAgIGV2ZW50RW1pdEFyZ3VtZW50cyA9IGV2ZW50RW1pdEFyZ3VtZW50cy5jb25jYXQobWVzc2FnZS5wYXlsb2FkKTtcbiAgICAgIHRoaXMuZXZlbnQuZW1pdC5hcHBseSh0aGlzLmV2ZW50LCBldmVudEVtaXRBcmd1bWVudHMpO1xuXG4gICAgfSBlbHNlIHtcblxuICAgICAgdmFyIHJlcXVlc3RQcm9taXNlID0gdGhpcy5fcmVxdWVzdFByb21pc2VzW21lc3NhZ2UuaWRdO1xuICAgICAgaWYgKHJlcXVlc3RQcm9taXNlKSB7XG5cbiAgICAgICAgc3dpdGNoIChtZXNzYWdlLnR5cGUpIHtcbiAgICAgICAgICBjYXNlICdwb25nJzpcbiAgICAgICAgICAgIGlmIChtZXNzYWdlLnN0YXRlID09PSAncmVzb2x2ZWQnKSB7XG4gICAgICAgICAgICAgIHJlcXVlc3RQcm9taXNlLnJlc29sdmUuYXBwbHkocmVxdWVzdFByb21pc2UsIG1lc3NhZ2UucGF5bG9hZCk7XG4gICAgICAgICAgICB9IGVsc2Uge1xuICAgICAgICAgICAgICByZXF1ZXN0UHJvbWlzZS5yZWplY3QuYXBwbHkocmVxdWVzdFByb21pc2UsIG1lc3NhZ2UucGF5bG9hZCk7XG4gICAgICAgICAgICB9XG4gICAgICAgICAgICB0aGlzLl9yZW1vdmVSZXF1ZXN0UHJvbWlzZShtZXNzYWdlLmlkKTtcbiAgICAgICAgICAgIGJyZWFrO1xuICAgICAgICAgIGNhc2UgJ25vdGlmeSc6XG4gICAgICAgICAgICByZXF1ZXN0UHJvbWlzZS5ub3RpZnkuYXBwbHkocmVxdWVzdFByb21pc2UsIG1lc3NhZ2UucGF5bG9hZCk7XG4gICAgICAgICAgICBicmVhaztcbiAgICAgICAgICBkZWZhdWx0OlxuICAgICAgICAgICAgY29uc29sZS53YXJuKCdVbmtub3duIG1lc3NhZ2UgdHlwZS4gbWVzc2FnZVR5cGU6JywgbWVzc2FnZS50eXBlKTtcbiAgICAgICAgfVxuXG4gICAgICB9XG5cbiAgICB9XG4gIH1cbn07XG5cbklGcmFtZUNsYXNzLnByb3RvdHlwZS5fcmVtb3ZlUmVxdWVzdFByb21pc2UgPSBmdW5jdGlvbihyZXF1ZXN0SWQpIHtcbiAgZGVsZXRlIHRoaXMuX3JlcXVlc3RQcm9taXNlc1tyZXF1ZXN0SWRdO1xufTtcblxuZnVuY3Rpb24gY3JlYXRlSVBvc3RPYmplY3QodGFyZ2V0T3JpZ2luLCBvcHRpb25zKSB7XG4gIHJldHVybiBuZXcgSUZyYW1lQ2xhc3ModGFyZ2V0T3JpZ2luLCBvcHRpb25zKTtcbn1cblxuLyoqXG4gKiAtLS0tLS0tLS0tLS0tLVxuICogSGVscGVyIG1ldGhvZHNcbiAqIC0tLS0tLS0tLS0tLS0tXG4gKi9cblxuLyoqXG4gKiBNZXJnZSBkZWZhdWx0cyB3aXRoIHVzZXIgb3B0aW9uc1xuICogQHBhcmFtIHtPYmplY3R9IGRlZmF1bHRzIERlZmF1bHQgc2V0dGluZ3NcbiAqIEBwYXJhbSB7T2JqZWN0fSBvcHRpb25zIFVzZXIgb3B0aW9uc1xuICogQHJldHVybnMge09iamVjdH0gTWVyZ2VkIHZhbHVlcyBvZiBkZWZhdWx0cyBhbmQgb3B0aW9uc1xuICovXG52YXIgZXh0ZW5kID0gZnVuY3Rpb24oZGVmYXVsdHMsIG9wdGlvbnMpIHtcbiAgdmFyIGV4dGVuZGVkID0ge307XG4gIHZhciBwcm9wO1xuICBmb3IgKHByb3AgaW4gZGVmYXVsdHMpIHtcbiAgICBpZiAoT2JqZWN0LnByb3RvdHlwZS5oYXNPd25Qcm9wZXJ0eS5jYWxsKGRlZmF1bHRzLCBwcm9wKSkge1xuICAgICAgZXh0ZW5kZWRbcHJvcF0gPSBkZWZhdWx0c1twcm9wXTtcbiAgICB9XG4gIH1cbiAgZm9yIChwcm9wIGluIG9wdGlvbnMpIHtcbiAgICBpZiAoT2JqZWN0LnByb3RvdHlwZS5oYXNPd25Qcm9wZXJ0eS5jYWxsKG9wdGlvbnMsIHByb3ApKSB7XG4gICAgICBleHRlbmRlZFtwcm9wXSA9IG9wdGlvbnNbcHJvcF07XG4gICAgfVxuICB9XG4gIHJldHVybiBleHRlbmRlZDtcbn07XG5cbi8qKlxuICogR2VuZXJhdGUgUmFuZG9tIElEXG4gKi9cbnZhciBSYW5kb20gPSB7XG5cbiAgczQ6IGZ1bmN0aW9uKCkge1xuICAgIHJldHVybiAoKCgxICsgTWF0aC5yYW5kb20oKSkgKiAweDEwMDAwKSB8IDApLnRvU3RyaW5nKDE2KS5zdWJzdHJpbmcoMSk7XG4gIH0sXG5cbiAgZ3VpZDogZnVuY3Rpb24oKSB7XG4gICAgcmV0dXJuICh0aGlzLnM0KCkgKyB0aGlzLnM0KCkgKyBcIi1cIiArIHRoaXMuczQoKSArIFwiLVwiICsgdGhpcy5zNCgpICsgXCItXCIgKyB0aGlzLnM0KCkgKyBcIi1cIiArIHRoaXMuczQoKSArIHRoaXMuczQoKSArIHRoaXMuczQoKSk7XG4gIH0sXG5cbn07XG5cbndpbmRvdy5JUG9zdCA9IElGcmFtZUNsYXNzO1xuXG5tb2R1bGUuZXhwb3J0cyA9IElGcmFtZUNsYXNzOyIsIm1vZHVsZS5leHBvcnRzPWZ1bmN0aW9uKG4pe3ZhciBvPXt9LHQ9W107bj1ufHx0aGlzLG4ub249ZnVuY3Rpb24obix0LGUpeyhvW25dPW9bbl18fFtdKS5wdXNoKFt0LGVdKX0sbi5vZmY9ZnVuY3Rpb24obixlKXtufHwobz17fSk7Zm9yKHZhciBmPW9bbl18fHQsaT1mLmxlbmd0aD1lP2YubGVuZ3RoOjA7aS0tOyllPT1mW2ldWzBdJiZmLnNwbGljZShpLDEpfSxuLmVtaXQ9ZnVuY3Rpb24obil7Zm9yKHZhciBlLGY9b1tuXXx8dCxpPTA7ZT1mW2krK107KWVbMF0uYXBwbHkoZVsxXSx0LnNsaWNlLmNhbGwoYXJndW1lbnRzLDEpKX19OyJdfQ==
;