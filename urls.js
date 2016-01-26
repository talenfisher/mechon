require('./functions.js').unpack(global);

const
    URLS = {
        "groupinfo" : "http://ust.chatango.com/groupinfo/$/gprofile.xml",
        "backgroundinfo" : "http://ust.chatango.com/profileimg/$/msgbg.xml",
        "backgroundimage" : "http://ust.chatango.com/profileimg/$/msgbg.jpg",
        "updatebackground" : "http://chatango.com/updatemsgbg",
        "profile" : "http://ust.chatango.com/profileimg/$/mod1.xml",
        "updateprofile" : "http://chatango.com/updateprofile",
        "thumbnail" : 'http://fp.chatango.com/profileimg/$/thumb.jpg',
        "avatar" : 'http://fp.chatango.com/profileimg/$/full.jpg',
    };



for(let url of Object.keys(URLS)) {
    module.exports[url] = function(name) {
        return URLS[url].replace("$", cname(name));
    };

    module.exports[url].toString = () => {
        return URLS[url];
    }
}
