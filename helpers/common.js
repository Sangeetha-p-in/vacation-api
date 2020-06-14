// Common helper functions
const uuidv1 = require('uuid/v1');
const randtoken = require('rand-token');
const _ = require('lodash');

exports.randomString = (length = 6) => {
  var text = "";
  var possible = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";

  for (var i = 0; i < length; i++)
    text += possible.charAt(Math.floor(Math.random() * possible.length));

  return text;
}

exports.randomNumber = (length = 6) => {
  var text = "";
  var possible = "0123456789";

  for (var i = 0; i < length; i++)
    text += possible.charAt(Math.floor(Math.random() * possible.length));

  return text;
}

exports.uniqueId = () => {
  return uuidv1();
}

exports.randomToken = (length = 255) => {
  return randtoken.uid(length);
}

exports.validEmail = (email) => {
  var filter = /^([a-zA-Z0-9_\.\-])+\@(([a-zA-Z0-9\-])+\.)+([a-zA-Z0-9]{2,4})+$/;
  return filter.test(email);
}

exports.validPassword = (password) => {
  /* var re;
  if (password.length < 6) {
    return [false, "Password must contain at least six characters!"];
  }
  re = /[0-9]/;
  if (!re.test(password)) {
    return [false, "Password must contain at least one number (0-9)!"];
  }
  re = /[a-z]/;
  if (!re.test(password)) {
    return [false, "Password must contain at least one lowercase letter (a-z)!"];
  }
  re = /[A-Z]/;
  if (!re.test(password)) {
    return [false, "Password must contain at least one uppercase letter (A-Z)!"];
  }
  re = /[!@#$%^&*]/;
  if (!re.test(password)) {
    return [false, "Password must contain at least one special character!"];
  } */
  return [true, null];
}

exports.removeNull = (input) => {
  
  function checkNull(data) {
    if (data == null) {
      data = '';
    } else if (typeof data === 'string') {
      data = data.trim();
    } else if (typeof data === 'object') {
      _.forEach(data, (value, key) => {
        data[key] = checkNull(value);
      });
    }
    return data;
  }
  
  return checkNull(input);
}
