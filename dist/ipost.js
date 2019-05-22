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
//@ sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJzb3VyY2VzIjpbIi9Vc2Vycy9Xb3JrL0RvY3VtZW50cy9UZW5taWxlcy9naXQvaXBvc3QvaW5kZXguanMiLCIvVXNlcnMvV29yay9Eb2N1bWVudHMvVGVubWlsZXMvZ2l0L2lwb3N0L25vZGVfbW9kdWxlcy9taW5pdmVudHMvZGlzdC9taW5pdmVudHMuY29tbW9uanMubWluLmpzIl0sIm5hbWVzIjpbXSwibWFwcGluZ3MiOiI7QUFBQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTs7QUNwVUEiLCJmaWxlIjoiZ2VuZXJhdGVkLmpzIiwic291cmNlUm9vdCI6IiIsInNvdXJjZXNDb250ZW50IjpbInZhciBFdmVudHMgPSByZXF1aXJlKCdtaW5pdmVudHMnKTtcblxudmFyIHBsdWdpbiA9IHtcbiAgbmFtZTogJ2lwb3N0JyxcbiAgZGVzY3JpcHRpb246ICdFYXNlcyB0aGUgd2F5IG9mIHBvc3RpbmcgYW5kIHJlY2lldmluZyBpZnJhbWUgbWVzc2FnZXMnLFxuICBhY2Nlc3NWYXJpYWJsZTogJ2lwb3N0JyxcbiAgdmVyc2lvbjogJzAuMC4xJ1xufTtcblxudmFyIGRlZmF1bHRzID0ge1xuICBpZnJhbWVUaW1lb3V0OiAxMCAqIDEwMDBcbn07XG5cbmZ1bmN0aW9uIElGcmFtZUNsYXNzKHRhcmdldE9yaWdpbiwgb3B0aW9ucykge1xuICBpZiAoIXdpbmRvdy5wYXJlbnQgJiYgdHlwZW9mKHRhcmdldE9yaWdpbikgIT09ICdzdHJpbmcnKSB7XG4gICAgdGhyb3cgbmV3IEVycm9yKCd0YXJnZXRPcmlnaW4gaXMgbWlzc2luZycpO1xuICB9XG4gIHRoaXMudGFyZ2V0T3JpZ2luID0gdGFyZ2V0T3JpZ2luO1xuICB0aGlzLmNvbmZpZyB8fCAodGhpcy5jb25maWcgPSB7fSk7XG4gIHRoaXMuY29uZmlnID0gZXh0ZW5kKGRlZmF1bHRzLCBvcHRpb25zKTtcbiAgdHlwZW9mKHRoaXMuY29uZmlnLm1vZGUpID09PSAnc3RyaW5nJyB8fCAodGhpcy5jb25maWcubW9kZSA9ICdpZnJhbWUnKTtcbiAgdGhpcy5fcmVxdWVzdFByb21pc2VzIHx8ICh0aGlzLl9yZXF1ZXN0UHJvbWlzZXMgPSB7fSk7XG4gIHRoaXMuX3JlYWR5RGVmZXJyZWQgPSAkLkRlZmVycmVkKCk7XG4gIHRoaXMuZXZlbnQgPSBuZXcgRXZlbnRzKCk7XG59XG5cbklGcmFtZUNsYXNzLnByb3RvdHlwZS5pbmplY3QgPSBmdW5jdGlvbigpIHtcbiAgcmV0dXJuIHRoaXMuX0lGcmFtZS5hcHBseSh0aGlzLCBhcmd1bWVudHMpO1xufTtcblxuSUZyYW1lQ2xhc3MucHJvdG90eXBlLm9wZW4gPSBmdW5jdGlvbiAoKSB7XG4gIHJldHVybiB0aGlzLl9vcGVuUG9wdXAuYXBwbHkodGhpcywgYXJndW1lbnRzKTtcbn07XG5cbklGcmFtZUNsYXNzLnByb3RvdHlwZS5jbG9zZSA9IGZ1bmN0aW9uICgpIHtcbiAgcmV0dXJuIHRoaXMuX2Nsb3NlUG9wdXAuYXBwbHkodGhpcywgYXJndW1lbnRzKTtcbn07XG5cbklGcmFtZUNsYXNzLnByb3RvdHlwZS5saXN0ZW4gPSBmdW5jdGlvbigpIHtcbiAgcmV0dXJuIHRoaXMuX2xpc3Rlbi5hcHBseSh0aGlzLCBhcmd1bWVudHMpO1xufTtcblxuSUZyYW1lQ2xhc3MucHJvdG90eXBlLnBvc3QgPSBmdW5jdGlvbihwYXlsb2FkKSB7XG4gIHJldHVybiB0aGlzLl9wb3N0LmFwcGx5KHRoaXMsIGFyZ3VtZW50cyk7XG59O1xuXG5JRnJhbWVDbGFzcy5wcm90b3R5cGUucmVhZHkgPSBmdW5jdGlvbigpIHtcbiAgcmV0dXJuIHRoaXMuX3Bvc3RSZWFkeSgpO1xufTtcblxuSUZyYW1lQ2xhc3MucHJvdG90eXBlLnJlYWR5RGVmZXJyZWQgPSBmdW5jdGlvbiAoKSB7XG4gIHJldHVybiB0aGlzLl9yZWFkeURlZmVycmVkO1xufTtcblxuSUZyYW1lQ2xhc3MucHJvdG90eXBlLm9uID0gZnVuY3Rpb24oZXZlbnROYW1lLCBoYW5kbGVyKSB7XG4gIHRoaXMuZXZlbnQub24oZXZlbnROYW1lLCBoYW5kbGVyKTtcbn07XG5cbi8qKlxuICogTG9jYWwgTWV0aG9kc1xuICovXG5JRnJhbWVDbGFzcy5wcm90b3R5cGUuX0lGcmFtZSA9IGZ1bmN0aW9uKCkge1xuICBpZiAoIXRoaXMuX2lmcmFtZVJlYWR5RGVmZXJyZWQpIHtcbiAgICB0aGlzLl9pZnJhbWVSZWFkeURlZmVycmVkID0gJC53aGVuKHRoaXMuX2luamVjdElGcmFtZS5hcHBseSh0aGlzLCBhcmd1bWVudHMpLCB0aGlzLl9yZWFkeURlZmVycmVkKS50aGVuKGZ1bmN0aW9uIChpZnJhbWVBcmdzKSB7XG4gICAgICB2YXIgZGVmZXJyZWQgPSAkLkRlZmVycmVkKCk7XG4gICAgICByZXR1cm4gZGVmZXJyZWQucmVzb2x2ZS5hcHBseShkZWZlcnJlZCwgaWZyYW1lQXJncyk7XG4gICAgfSk7XG4gIH1cbiAgcmV0dXJuIHRoaXMuX2lmcmFtZVJlYWR5RGVmZXJyZWQ7XG59O1xuXG5JRnJhbWVDbGFzcy5wcm90b3R5cGUuX1BvcHVwV2luZG93ID0gZnVuY3Rpb24gKCkge1xuICByZXR1cm4gJC53aGVuKHRoaXMuX29wZW5Qb3B1cC5hcHBseSh0aGlzLCBhcmd1bWVudHMpLCB0aGlzLl9yZWFkeURlZmVycmVkKS50aGVuKGZ1bmN0aW9uIChvcGVuUG9wdXBBcmdzKSB7XG4gICAgdmFyIGRlZmVycmVkID0gJC5EZWZlcnJlZCgpO1xuICAgIHJldHVybiBkZWZlcnJlZC5yZXNvbHZlLmFwcGx5KGRlZmVycmVkLCBvcGVuUG9wdXBBcmdzKTtcbiAgfSk7XG59O1xuXG5JRnJhbWVDbGFzcy5wcm90b3R5cGUuX2luamVjdElGcmFtZSA9IGZ1bmN0aW9uKGlmcmFtZSwgb3B0aW9ucykge1xuICB2YXIgZGVmZXJyZWQgPSAkLkRlZmVycmVkKCksXG4gICAgJGlmcmFtZSA9IChpZnJhbWUgJiYgJChpZnJhbWUpKSB8fCAkKCc8aWZyYW1lLz4nKTtcblxuICBvcHRpb25zIHx8IChvcHRpb25zID0ge30pO1xuICBvcHRpb25zLnNyYyAmJiAodGhpcy50YXJnZXRPcmlnaW4gPSBvcHRpb25zLnNyYyk7XG4gICRpZnJhbWUuYXR0cignc3JjJywgdGhpcy50YXJnZXRPcmlnaW4pO1xuICB0aGlzLl9pc0lGcmFtZUluamVjdGVkID0gdHJ1ZTtcbiAgJGlmcmFtZS5vbignbG9hZCcsIGZ1bmN0aW9uKCkge1xuICAgIHdpbmRvdy5jbGVhclRpbWVvdXQodGhpcy5faWZyYW1lTG9hZFRpbWVvdXRJbmRleCk7XG4gICAgZGVmZXJyZWQucmVzb2x2ZSgkaWZyYW1lLmdldCgwKSwgJGlmcmFtZSk7XG4gIH0pO1xuICAkKCdib2R5JykuYXBwZW5kKCRpZnJhbWUpO1xuICB0aGlzLl9pZnJhbWVMb2FkVGltZW91dEluZGV4ID0gd2luZG93LnNldFRpbWVvdXQoZnVuY3Rpb24oKSB7XG4gICAgdmFyIGVycm9yID0gbmV3IEVycm9yKCk7XG4gICAgZXJyb3IudHlwZSA9ICdpZnJhbWVfbG9hZF90aW1lb3V0JztcbiAgICBlcnJvci5tZXNzYWdlID0gJ0lGcmFtZSB0aW1lZCBvdXQgdG8gbG9hZCc7XG4gICAgZGVmZXJyZWQucmVqZWN0KGVycm9yKTtcbiAgfSwgdGhpcy5jb25maWcuaWZyYW1lVGltZW91dCk7XG4gIHJldHVybiBkZWZlcnJlZDtcbn07XG5cbklGcmFtZUNsYXNzLnByb3RvdHlwZS5fb3BlblBvcHVwID0gZnVuY3Rpb24gKCkge1xuICB2YXIgc2VsZiA9IHRoaXMsXG4gICAgZGVmZXJyZWQgPSAkLkRlZmVycmVkKCksXG4gICAgb3BlbkFyZ3M7XG4gIGlmICghdGhpcy5faXNQb3B1cFdpbmRvd09wZW4pIHtcbiAgICBvcGVuQXJncyA9IFsgdGhpcy50YXJnZXRPcmlnaW4sIF07XG4gICAgaWYgKHR5cGVvZih0aGlzLmNvbmZpZy50YXJnZXQpID09PSAnc3RyaW5nJykge1xuICAgICAgb3BlbkFyZ3MucHVzaCh0aGlzLmNvbmZpZy50YXJnZXQpO1xuICAgIH1cbiAgICBpZiAodHlwZW9mKHRoaXMuY29uZmlnLndpbmRvd09wdGlvbnMpID09PSAnc3RyaW5nJykge1xuICAgICAgb3BlbkFyZ3MucHVzaCh0aGlzLmNvbmZpZy53aW5kb3dPcHRpb25zKTtcbiAgICB9XG4gICAgdGhpcy5fcG9wdXBXaW5kb3cgPSB3aW5kb3cub3Blbi5hcHBseSh3aW5kb3csIG9wZW5BcmdzKTtcbiAgICB0aGlzLl9pc1BvcHVwV2luZG93T3BlbiA9IHRydWU7XG4gICAgdGhpcy5fcG9wdXBXaW5kb3dJbnRlcnZhbEluZGV4ID0gd2luZG93LnNldEludGVydmFsKGZ1bmN0aW9uICgpIHtcbiAgICAgIGlmIChzZWxmLl9wb3B1cFdpbmRvdy5jbG9zZWQpIHtcbiAgICAgICAgc2VsZi5fY2xvc2VQb3B1cCgpO1xuICAgICAgfVxuICAgIH0sIDUwMCk7XG4gIH1cbiAgZGVmZXJyZWQucmVzb2x2ZSh0aGlzLl9wb3B1cFdpbmRvdywgJCh0aGlzLl9wb3B1cFdpbmRvdykpO1xuICByZXR1cm4gZGVmZXJyZWQucHJvbWlzZSgpO1xufTtcblxuSUZyYW1lQ2xhc3MucHJvdG90eXBlLl9jbG9zZVBvcHVwID0gZnVuY3Rpb24gKCkge1xuICBpZiAodGhpcy5fcG9wdXBXaW5kb3cpIHtcbiAgICB3aW5kb3cuY2xlYXJJbnRlcnZhbCh0aGlzLl9wb3B1cFdpbmRvd0ludGVydmFsSW5kZXgpO1xuICAgIHRoaXMuX3BvcHVwV2luZG93LmNsb3NlKCk7XG4gICAgZGVsZXRlIHRoaXMuX3BvcHVwV2luZG93O1xuICAgIHRoaXMuX2lzUG9wdXBXaW5kb3dPcGVuID0gZmFsc2U7XG4gIH1cbn07XG5cbklGcmFtZUNsYXNzLnByb3RvdHlwZS5fcG9zdFJlYWR5ID0gZnVuY3Rpb24gKCkge1xuICB2YXIgcmVxdWVzdCA9IHt9O1xuICByZXF1ZXN0LnBsdWdpbiA9IHBsdWdpbi5uYW1lO1xuICByZXF1ZXN0LnR5cGUgPSAncmVhZHknO1xuICByZXF1ZXN0Lm1vZGUgPSB0aGlzLmNvbmZpZy5tb2RlO1xuICB0aGlzLl9wb3N0UmF3KHJlcXVlc3QpO1xufTtcblxuSUZyYW1lQ2xhc3MucHJvdG90eXBlLl9wb3N0ID0gZnVuY3Rpb24oKSB7XG4gIHZhciByZXF1ZXN0ID0ge30sXG4gICAgaW5kZXg7XG4gIHJlcXVlc3QuaWQgPSBSYW5kb20uczQoKTtcbiAgcmVxdWVzdC50eXBlID0gJ3BpbmcnO1xuICByZXF1ZXN0LnBheWxvYWQgPSBBcnJheS5wcm90b3R5cGUuc2xpY2UuY2FsbChhcmd1bWVudHMpO1xuICByZXF1ZXN0LnBsdWdpbiA9IHBsdWdpbi5uYW1lO1xuICB0aGlzLl9yZXF1ZXN0UHJvbWlzZXNbcmVxdWVzdC5pZF0gPSBuZXcgJC5EZWZlcnJlZCgpO1xuICB0aGlzLl9wb3N0UmF3KHJlcXVlc3QpO1xuICByZXR1cm4gdGhpcy5fcmVxdWVzdFByb21pc2VzW3JlcXVlc3QuaWRdO1xufTtcblxuSUZyYW1lQ2xhc3MucHJvdG90eXBlLl9wb3N0UmF3ID0gZnVuY3Rpb24ocmVxdWVzdCkge1xuICB2YXIgc2VsZiA9IHRoaXM7XG4gIGlmKHRoaXMuY29uZmlnLmNoaWxkICYmIHdpbmRvdy5wYXJlbnQpIHtcbiAgICB3aW5kb3cucGFyZW50LnBvc3RNZXNzYWdlKEpTT04uc3RyaW5naWZ5KHJlcXVlc3QpLCBzZWxmLnRhcmdldE9yaWdpbiB8fCAnKicpO1xuICAgIHJldHVybiAkLkRlZmVycmVkKCkucmVzb2x2ZSgpLnByb21pc2UoKTtcbiAgfSBlbHNlIGlmICh0aGlzLmNvbmZpZy5tb2RlID09PSAncG9wdXAnICYmICh0aGlzLmNvbmZpZy5wb3B1cCB8fCB0aGlzLmNvbmZpZy5jaGlsZCkgJiYgd2luZG93Lm9wZW5lcikge1xuICAgIHdpbmRvdy5vcGVuZXIucG9zdE1lc3NhZ2UoSlNPTi5zdHJpbmdpZnkocmVxdWVzdCksIHNlbGYudGFyZ2V0T3JpZ2luIHx8ICcqJyk7XG4gICAgcmV0dXJuICQuRGVmZXJyZWQoKS5yZXNvbHZlKCkucHJvbWlzZSgpO1xuICB9IGVsc2Uge1xuICAgIGlmICh0aGlzLmNvbmZpZy5tb2RlID09PSAncG9wdXAnKSB7XG4gICAgICByZXR1cm4gdGhpcy5fUG9wdXBXaW5kb3coKS50aGVuKGZ1bmN0aW9uKHdpbiwgJHdpbikge1xuICAgICAgICB2YXIgZGVmZXJyZWQgPSAkLkRlZmVycmVkKCk7XG4gICAgICAgIHRyeSB7XG4gICAgICAgICAgd2luLnBvc3RNZXNzYWdlKEpTT04uc3RyaW5naWZ5KHJlcXVlc3QpLCBzZWxmLnRhcmdldE9yaWdpbik7XG4gICAgICAgICAgZGVmZXJyZWQucmVzb2x2ZSgpO1xuICAgICAgICB9IGNhdGNoIChlcnIpIHtcbiAgICAgICAgICBkZWZlcnJlZC5yZWplY3QoZXJyKTtcbiAgICAgICAgfVxuICAgICAgICByZXR1cm4gZGVmZXJyZWQucHJvbWlzZSgpO1xuICAgICAgfSk7XG4gICAgfSBlbHNlIHtcbiAgICAgIHJldHVybiB0aGlzLl9JRnJhbWUoKS50aGVuKGZ1bmN0aW9uKGlmcmFtZSwgJGlmcmFtZSkge1xuICAgICAgICB2YXIgZGVmZXJyZWQgPSAkLkRlZmVycmVkKCk7XG4gICAgICAgIHRyeSB7XG4gICAgICAgICAgaWZyYW1lLmNvbnRlbnRXaW5kb3cucG9zdE1lc3NhZ2UoSlNPTi5zdHJpbmdpZnkocmVxdWVzdCksIHNlbGYudGFyZ2V0T3JpZ2luKTtcbiAgICAgICAgICBkZWZlcnJlZC5yZXNvbHZlKCk7XG4gICAgICAgIH0gY2F0Y2ggKGVycikge1xuICAgICAgICAgIGRlZmVycmVkLnJlamVjdChlcnIpO1xuICAgICAgICB9XG4gICAgICAgIHJldHVybiBkZWZlcnJlZC5wcm9taXNlKCk7XG4gICAgICB9KTtcbiAgICB9XG4gIH1cbn07XG5cbklGcmFtZUNsYXNzLnByb3RvdHlwZS5fbGlzdGVuID0gZnVuY3Rpb24ocmVxdWVzdCkge1xuICB2YXIgc2VsZiA9IHRoaXM7XG4gIGlmICghc2VsZi5faXNMaXN0ZW5pbmcpIHtcbiAgICAkKHdpbmRvdykub24oJ21lc3NhZ2UnLCBmdW5jdGlvbihldmVudCkge1xuICAgICAgc2VsZi5fbWVzc2FnZUhhbmRsZXIoZXZlbnQub3JpZ2luYWxFdmVudC5kYXRhKTtcbiAgICB9KTtcbiAgICBzZWxmLl9pc0xpc3RlbmluZyA9IHRydWU7XG4gIH1cbn07XG5cbklGcmFtZUNsYXNzLnByb3RvdHlwZS5fcG9zdFJlcGx5ID0gZnVuY3Rpb24oZGVmZXJyZWQsIF9hcmd1bWVudHMpIHtcbiAgdmFyIHN0YXRlID0gZGVmZXJyZWQuc3RhdGUoKSxcbiAgICBtZXNzYWdlID0gZGVmZXJyZWQuX2lwb3N0TWVzc2FnZTtcblxuICBtZXNzYWdlLnBheWxvYWQgPSBBcnJheS5wcm90b3R5cGUuc2xpY2UuY2FsbChfYXJndW1lbnRzKTtcbiAgaWYgKHN0YXRlID09PSAncmVzb2x2ZWQnIHx8IHN0YXRlID09PSAncmVqZWN0ZWQnKSB7XG4gICAgbWVzc2FnZS50eXBlID0gJ3BvbmcnO1xuICAgIG1lc3NhZ2Uuc3RhdGUgPSBzdGF0ZTtcbiAgfSBlbHNlIHtcbiAgICBtZXNzYWdlLnR5cGUgPSAnbm90aWZ5JztcbiAgfVxuICB0aGlzLl9wb3N0UmF3KG1lc3NhZ2UpO1xufTtcblxuSUZyYW1lQ2xhc3MucHJvdG90eXBlLl9tZXNzYWdlSGFuZGxlciA9IGZ1bmN0aW9uKG1lc3NhZ2UpIHtcbiAgdmFyIHNlbGYgPSB0aGlzO1xuXG4gIHRyeSB7XG4gICAgbWVzc2FnZSA9IEpTT04ucGFyc2UobWVzc2FnZSk7XG4gIH0gY2F0Y2ggKGV4Y2VwdGlvbikge1xuICAgIGNvbnNvbGUud2FybignQ291bGRub3QgcGFyc2UgdGhlIHJlY2VpdmVkIG1lc3NhZ2UuIE1lc3NhZ2U6JywgbWVzc2FnZSk7XG4gICAgcmV0dXJuO1xuICB9XG4gIGlmIChtZXNzYWdlLnBsdWdpbiA9PT0gcGx1Z2luLm5hbWUpIHtcblxuICAgIGlmIChtZXNzYWdlLnR5cGUgPT09ICdyZWFkeScgJiYgdGhpcy5jb25maWcubW9kZSA9PT0gbWVzc2FnZS5tb2RlKSB7XG5cbiAgICAgIHRoaXMuX3JlYWR5RGVmZXJyZWQucmVzb2x2ZSgpO1xuICAgICAgdGhpcy5ldmVudC5lbWl0KCdyZWFkeScpO1xuXG4gICAgfSBlbHNlIGlmKG1lc3NhZ2UudHlwZSA9PT0gJ3BpbmcnKSB7XG5cbiAgICAgIHZhciBwaW5nRGVmZXJyZWQgPSAkLkRlZmVycmVkKCk7XG4gICAgICBwaW5nRGVmZXJyZWQuX2lwb3N0TWVzc2FnZSA9IG1lc3NhZ2U7XG4gICAgICB2YXIgcGluZ0RlZmVycmVkID0gcGluZ0RlZmVycmVkLmFsd2F5cyhmdW5jdGlvbigpIHtcbiAgICAgICAgc2VsZi5fcG9zdFJlcGx5KHBpbmdEZWZlcnJlZCwgYXJndW1lbnRzKTtcbiAgICAgIH0pLnByb2dyZXNzKGZ1bmN0aW9uKCkge1xuICAgICAgICBzZWxmLl9wb3N0UmVwbHkocGluZ0RlZmVycmVkLCBhcmd1bWVudHMpO1xuICAgICAgfSk7XG5cbiAgICAgIHZhciBldmVudEVtaXRBcmd1bWVudHMgPSBbXTtcbiAgICAgIGV2ZW50RW1pdEFyZ3VtZW50cy5wdXNoKCdtZXNzYWdlJyk7XG4gICAgICBldmVudEVtaXRBcmd1bWVudHMucHVzaChwaW5nRGVmZXJyZWQpO1xuICAgICAgZXZlbnRFbWl0QXJndW1lbnRzID0gZXZlbnRFbWl0QXJndW1lbnRzLmNvbmNhdChtZXNzYWdlLnBheWxvYWQpO1xuICAgICAgdGhpcy5ldmVudC5lbWl0LmFwcGx5KHRoaXMuZXZlbnQsIGV2ZW50RW1pdEFyZ3VtZW50cyk7XG5cbiAgICB9IGVsc2Uge1xuXG4gICAgICB2YXIgcmVxdWVzdFByb21pc2UgPSB0aGlzLl9yZXF1ZXN0UHJvbWlzZXNbbWVzc2FnZS5pZF07XG4gICAgICBpZiAocmVxdWVzdFByb21pc2UpIHtcblxuICAgICAgICBzd2l0Y2ggKG1lc3NhZ2UudHlwZSkge1xuICAgICAgICAgIGNhc2UgJ3BvbmcnOlxuICAgICAgICAgICAgaWYgKG1lc3NhZ2Uuc3RhdGUgPT09ICdyZXNvbHZlZCcpIHtcbiAgICAgICAgICAgICAgcmVxdWVzdFByb21pc2UucmVzb2x2ZS5hcHBseShyZXF1ZXN0UHJvbWlzZSwgbWVzc2FnZS5wYXlsb2FkKTtcbiAgICAgICAgICAgIH0gZWxzZSB7XG4gICAgICAgICAgICAgIHJlcXVlc3RQcm9taXNlLnJlamVjdC5hcHBseShyZXF1ZXN0UHJvbWlzZSwgbWVzc2FnZS5wYXlsb2FkKTtcbiAgICAgICAgICAgIH1cbiAgICAgICAgICAgIHRoaXMuX3JlbW92ZVJlcXVlc3RQcm9taXNlKG1lc3NhZ2UuaWQpO1xuICAgICAgICAgICAgYnJlYWs7XG4gICAgICAgICAgY2FzZSAnbm90aWZ5JzpcbiAgICAgICAgICAgIHJlcXVlc3RQcm9taXNlLm5vdGlmeS5hcHBseShyZXF1ZXN0UHJvbWlzZSwgbWVzc2FnZS5wYXlsb2FkKTtcbiAgICAgICAgICAgIGJyZWFrO1xuICAgICAgICAgIGRlZmF1bHQ6XG4gICAgICAgICAgICBjb25zb2xlLndhcm4oJ1Vua25vd24gbWVzc2FnZSB0eXBlLiBtZXNzYWdlVHlwZTonLCBtZXNzYWdlLnR5cGUpO1xuICAgICAgICB9XG5cbiAgICAgIH1cblxuICAgIH1cbiAgfVxufTtcblxuSUZyYW1lQ2xhc3MucHJvdG90eXBlLl9yZW1vdmVSZXF1ZXN0UHJvbWlzZSA9IGZ1bmN0aW9uKHJlcXVlc3RJZCkge1xuICBkZWxldGUgdGhpcy5fcmVxdWVzdFByb21pc2VzW3JlcXVlc3RJZF07XG59O1xuXG5mdW5jdGlvbiBjcmVhdGVJUG9zdE9iamVjdCh0YXJnZXRPcmlnaW4sIG9wdGlvbnMpIHtcbiAgcmV0dXJuIG5ldyBJRnJhbWVDbGFzcyh0YXJnZXRPcmlnaW4sIG9wdGlvbnMpO1xufVxuXG4vKipcbiAqIC0tLS0tLS0tLS0tLS0tXG4gKiBIZWxwZXIgbWV0aG9kc1xuICogLS0tLS0tLS0tLS0tLS1cbiAqL1xuXG4vKipcbiAqIE1lcmdlIGRlZmF1bHRzIHdpdGggdXNlciBvcHRpb25zXG4gKiBAcGFyYW0ge09iamVjdH0gZGVmYXVsdHMgRGVmYXVsdCBzZXR0aW5nc1xuICogQHBhcmFtIHtPYmplY3R9IG9wdGlvbnMgVXNlciBvcHRpb25zXG4gKiBAcmV0dXJucyB7T2JqZWN0fSBNZXJnZWQgdmFsdWVzIG9mIGRlZmF1bHRzIGFuZCBvcHRpb25zXG4gKi9cbnZhciBleHRlbmQgPSBmdW5jdGlvbihkZWZhdWx0cywgb3B0aW9ucykge1xuICB2YXIgZXh0ZW5kZWQgPSB7fTtcbiAgdmFyIHByb3A7XG4gIGZvciAocHJvcCBpbiBkZWZhdWx0cykge1xuICAgIGlmIChPYmplY3QucHJvdG90eXBlLmhhc093blByb3BlcnR5LmNhbGwoZGVmYXVsdHMsIHByb3ApKSB7XG4gICAgICBleHRlbmRlZFtwcm9wXSA9IGRlZmF1bHRzW3Byb3BdO1xuICAgIH1cbiAgfVxuICBmb3IgKHByb3AgaW4gb3B0aW9ucykge1xuICAgIGlmIChPYmplY3QucHJvdG90eXBlLmhhc093blByb3BlcnR5LmNhbGwob3B0aW9ucywgcHJvcCkpIHtcbiAgICAgIGV4dGVuZGVkW3Byb3BdID0gb3B0aW9uc1twcm9wXTtcbiAgICB9XG4gIH1cbiAgcmV0dXJuIGV4dGVuZGVkO1xufTtcblxuLyoqXG4gKiBHZW5lcmF0ZSBSYW5kb20gSURcbiAqL1xudmFyIFJhbmRvbSA9IHtcblxuICBzNDogZnVuY3Rpb24oKSB7XG4gICAgcmV0dXJuICgoKDEgKyBNYXRoLnJhbmRvbSgpKSAqIDB4MTAwMDApIHwgMCkudG9TdHJpbmcoMTYpLnN1YnN0cmluZygxKTtcbiAgfSxcblxuICBndWlkOiBmdW5jdGlvbigpIHtcbiAgICByZXR1cm4gKHRoaXMuczQoKSArIHRoaXMuczQoKSArIFwiLVwiICsgdGhpcy5zNCgpICsgXCItXCIgKyB0aGlzLnM0KCkgKyBcIi1cIiArIHRoaXMuczQoKSArIFwiLVwiICsgdGhpcy5zNCgpICsgdGhpcy5zNCgpICsgdGhpcy5zNCgpKTtcbiAgfSxcblxufTtcblxud2luZG93LklQb3N0ID0gSUZyYW1lQ2xhc3M7XG5cbm1vZHVsZS5leHBvcnRzID0gSUZyYW1lQ2xhc3M7IiwibW9kdWxlLmV4cG9ydHM9ZnVuY3Rpb24obil7dmFyIHQ9e30sZT1bXTtuPW58fHRoaXMsbi5vbj1mdW5jdGlvbihuLGUsbCl7KHRbbl09dFtuXXx8W10pLnB1c2goW2UsbF0pfSxuLm9mZj1mdW5jdGlvbihuLGwpe258fCh0PXt9KTtmb3IodmFyIG89dFtuXXx8ZSxpPW8ubGVuZ3RoPWw/by5sZW5ndGg6MDtpLS07KWw9PW9baV1bMF0mJm8uc3BsaWNlKGksMSl9LG4uZW1pdD1mdW5jdGlvbihuKXtmb3IodmFyIGwsbz10W25dfHxlLGk9by5sZW5ndGg+MD9vLnNsaWNlKDAsby5sZW5ndGgpOm8sYz0wO2w9aVtjKytdOylsWzBdLmFwcGx5KGxbMV0sZS5zbGljZS5jYWxsKGFyZ3VtZW50cywxKSl9fTsiXX0=
;