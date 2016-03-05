(function(root) {

  var iframeElement = window.document.getElementById('child-frame'),
      console = new ViewLogger();

  /**
   * Instantiating IPost
   */
  var ipost = new IPost('http://localhost:8989/demo/iframe/index.html');
  ipost.inject(iframeElement);
  ipost.listen();

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