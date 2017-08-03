(function(root) {

  var console = new ViewLogger();

  /**
   * Instantiating IPost
   */
  var ipost = new IPost(undefined, {
    mode: 'popup',
    popup: true,
  });
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
    console.log('Posting to opener window. Message:', message);
    // Posting message using ipost object
    ipost.post(message).then(function(reply) {
      console.info('Got reply from parent window:', reply);
    }).fail(function(reply) {
      console.error('Got error from parent window:', reply);
    });
  }

  /**
   * Message Listener
   */
  ipost.on('message', function (deferred, message) {
    console.log('Received message from opener window:', message);
    var replyMessage = '';

    switch (message) {

      case 'Who are you?':
        replyMessage = 'I am your Child';
        console.info('Resolving with message:', replyMessage);
        deferred.resolve(replyMessage);
        break;

      case 'What is your name?':
        replyMessage = 'My name is Childy';
        console.info('Resolving with message:', replyMessage);
        deferred.resolve(replyMessage);
        break;

      case 'What is your age?':
        replyMessage = 'My age is 24';
        console.info('Resolving with message:', replyMessage);
        deferred.resolve(replyMessage);
        break;

      case 'What is your blood group?':
        replyMessage = 'Sorry! I do not know my blood group.';
        console.error('Rejecting with message:', replyMessage);
        deferred.reject(replyMessage);
        break;

      default:
        deferred.reject('Unknown question.');
        break;
    }
  });

  ipost.ready();

})(window);