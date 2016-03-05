# ipost
Promise feature for iframe post message

###Example:
**In parent window:**
```javascript
var ipost = new IPost('http://localhost:8888/iframe.html');
ipost.inject();
ipost.listen();

ipost('What is your name?').then(function (message) {
  console.log('Reply:', message);
}).fail(function (err) {
  console.error('Error:', err);
})
```

**In iframe window:**
```javascript
ipost.on('message', function (deferred, message) {

  switch(message) {

    case 'What is your name?':
      deferred.resolve('My name is Sundarasan Natarajan.');
      break;

    case 'What is your age?':
      deferred.reject('Sorry! I do not know my birth date.');
      break;

  }

});
```


###To see demo
- Clone the project
```
git clone https://github.com/Sujsun/ipost.git
```

- Install npm dependencies
```
npm install 
```

- Run the server
`npm start` or `grunt`

- Visit
`http://localhost:8989` or ` http://127.0.0.1:8989`