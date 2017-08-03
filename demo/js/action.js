(function(root) {

  var iframeElement = window.document.getElementById('child-frame'),
      console = new ViewLogger();

  /**
   * Instantiating IPost
   */
  var ipost = new IPost('http://localhost:8989/demo/iframe/index.html'),
    popupIpost = new IPost('http://localhost:8989/demo/popup/index.html', {
      mode: 'popup',
      target: '_blank',
      windowOptions: 'toolbar=no, scrollbars=no, resizable=no, top=500,left=500, width=400, height=400',
    });

  ipost.inject(iframeElement);
  ipost.listen();

  popupIpost.listen();

  /**
   * Binding event listeners to the buttons
   */
  document.getElementById('ask-who').addEventListener('click', function () {
    post('Who are you?');
  });

  document.getElementById('ask-name').addEventListener('click', function () {
    post('What is your name?');
  });

  document.getElementById('ask-age').addEventListener('click', function () {
    post('What is your age?');
  });

  document.getElementById('ask-bloodgroup').addEventListener('click', function () {
    post('What is your blood group?');
  });

  document.getElementById('clear-logs').addEventListener('click', function () {
    console.clearLogs();
  });

  document.getElementById('popup-ask-who').addEventListener('click', function () {
    popupPost('Who are you?');
  });

  document.getElementById('popup-ask-name').addEventListener('click', function () {
    popupPost('What is your name?');
  });

  document.getElementById('popup-ask-age').addEventListener('click', function () {
    popupPost('What is your age?');
  });

  document.getElementById('popup-ask-bloodgroup').addEventListener('click', function () {
    popupPost('What is your blood group?');
  });

  document.getElementById('popup-open').addEventListener('click', function () {
    console.log('Opening pop up');
    popupIpost.open();
  });

  document.getElementById('popup-close').addEventListener('click', function () {
    console.log('Closing pop up');
    popupIpost.close();
  });

  /**
   * Helper method to post message to iframe
   */
  function post (message) {
    console.log('Posting to iframe. Message:', message);
    // Posting message using ipost object
    ipost.post(message).then(function(reply) {
      console.info('Got reply from iframe:', reply);
    }).fail(function(reply) {
      console.error('Got error from iframe:', reply);
    });
  }

  function popupPost (message) {
    console.log('Posting to popup. Message:', message);
    // Posting message using popup ipost object
    popupIpost.post(message).then(function(reply) {
      console.info('Got reply from popup:', reply);
    }).fail(function(reply) {
      console.error('Got error from popup:', reply);
    });
  }

  /**
   * Message Listener
   */
  ipost.on('message', function (deferred, message) {
    console.log('Received message from iframe window:', message);
    var replyMessage = '';

    switch (message) {

      case 'Who are you?':
        replyMessage = 'I am your Dad';
        console.info('Resolving with message:', replyMessage);
        deferred.resolve(replyMessage);
        break;

      case 'What is your name?':
        replyMessage = 'My name is Daddy';
        console.info('Resolving with message:', replyMessage);
        deferred.resolve(replyMessage);
        break;

      case 'What is your age?':
        replyMessage = 'Oh oh! I do not know my age.';
        console.error('Rejecting with message:', replyMessage);
        deferred.reject(replyMessage);
        break;

      case 'What is your blood group?':
        replyMessage = 'My blood group is 0+';
        console.info('Resolving with message:', replyMessage);
        deferred.resolve(replyMessage);
        break;

      default:
        deferred.reject('Unknown question.');
        break;
    }
  });

})(window);