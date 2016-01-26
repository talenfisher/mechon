/*
 * To change this license header, choose License Headers in Project Properties.
 * To change this template file, choose Tools | Templates
 * and open the template in the editor.
 */

const
    Request = require('request').defaults({ headers : { "user-agent" : "Mozilla/5.0" } });



exports.iterate = function* (iterable, callable) {
    for(let i of iterable) yield callable(i);
};

exports.flags = (value, flags) => {
    var obj = {};
    for(let flag of Object.keys(flags)) {
        if(value & flags[flag]) obj[flag] = true;
        else obj[flag] = false;
    }
    return obj;
};

exports.flagsArray = (value, flags) => {
    let a = [];
    for(let flag of Object.keys(flags)) {
        if(value & flags[flag]) a.push(flag);
    }
    return a;
};

exports.flagsChoice = (value, flags) => {
    for(let flag of Object.keys(flags)) {
        if(value & flags[flag]) return flag;
    }
};

exports.stripTags = (input) => {
    return input.replace(/<\/?([a-z][a-z0-9]*)\b[^>]*>|<!--[\s\S]*?-->/gi, '');
};

exports.keyExists = (needle, haystack) => {
    return (Object.keys(haystack).includes(needle));
};

exports.urlName = user => {
    return (user[0]+"/"+user[1]+"/"+user).toLowerCase();
};

exports.cname = exports.urlName;

exports.escapeBW = (word, copyable) => {
    let string = '';

    if(copyable) for(let letter of word) string += "&amp;#"+letter.charCodeAt(0)+";";
    else for(let letter of word) string += "&#"+letter.charCodeAt(0)+";";
    return string;
};

exports.unescapeBW = word => {
    word = word.split(";");
    let final = '';
    for(let letter of word) final += String.fromCharCode(letter.replace('&#', ''));
    return final;
};

exports.cleaner = message => {
  return message
    .replace("<g xs0=\"0\">", '')
    .replace("<m v=\"1\">", '')
    .replace(/<\/(.*?)>/g, '')
    .replace(/<n(.*?)\/>/g, '')
    .replace(/<g x(.*?)\">/g, '')
    .replace(/<mws c='(.*?)' s='(.*?)'\/>/g, '')
    .replace(/ <i s=\"sm:\/\/(.*?)\" w=\"(.*?)\" h=\"(.*?)\"\/>/g, '')
    .replace(/<i s=\"sm:\/\/(.*?)\" w=\"(.*?)\" h=\"(.*?)\"\/>/g, '')
};

exports.range =(low, high, step) => {
    var arr = []
    for (var i=low;i<high;i+=step) { arr.push(i) }
    return arr
};

exports.queryVar = (variable, query) => {
    var vars = query.split('&');
    for (var i = 0; i < vars.length; i++) {
      var pair = vars[i].split('=');
      if (decodeURIComponent(pair[0]) == variable) {
          return decodeURIComponent(pair[1]);
      }
    }
};

exports.generatePass = (length) => {
    if(!length) length = 5;
    var text = "";
    var possible = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789";

    for(var i=0; i < length; i++ )
        text += possible.charAt(Math.floor(Math.random() * possible.length));

    return text;
};

exports.optionsReq = (url, callback) => {
    return new Promise((resolve, reject) => {
        Request(url, {method : "options"}, (err, reply, body) => {
            for(let cookie of reply.headers['set-cookie']) Request.cookie(cookie);
            callback.call(this, resolve, reply.headers['set-cookie'], body);
        });
    });
};

exports.unpack = (globals) => {
    for(let f of Object.keys(module.exports)) {
        if(f != "unpack") globals[f] = module.exports[f];
    }
};
