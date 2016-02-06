require('./functions.js').unpack(global);

const
    Format = require('./models/format.js'),
    Group = require('./models/group.js'),
    PMS = require('./models/pms.js'),
    Request = require('request').defaults({ headers : { 'user-agent' : 'Mozilla/5.0' } }),
    EventEmitter = require('events').EventEmitter,
    parseString = require('xml2js').parseString,
    URLS = require('./urls.js'),

    // Symbols
    $sessid = Symbol(),
    $start = Symbol(),
    $commands = Symbol(),
    $format = Symbol(),
    $profile = Symbol(),
    $bg = {
        tile : Symbol(),
        color : Symbol(),
        align : Symbol(),
        imgopacity : Symbol(),
        bgopacity : Symbol(),
        useimg : Symbol()
    },
    $getbg = Symbol();

class Mechon extends EventEmitter {
    constructor(options) {
        super();
        this._opts = options;
        this.user = options.user;
        this.pass = options.pass;
        this.sessid = Math.floor(Math.random() * (((Math.pow(10, 16) - 1) - Math.pow(10, 15)) + 1)) + Math.pow(10, 15);
        this.chatid = Math.floor(Math.random() * 15E5).toString(36)
        this.groups = {};
        this.prefix = options.prefix;
        this.commands = options.commands || {}
        this.format = new Format({u:this.user, p:this.pass});
        this.owner = options.owner;

        if(options.props) { for(let data of Object.keys(options.props)) this[data] = options.props[data]; }

        process.title = options.title || "Bot@Mechon v1"

        // setup custom user retrieval
        if(options.customUsr) {
            this.customUsr = true;
            this.storage = options.customUsr.storage;
            this.retrieve = options.customUsr.retrieve.bind(this);
        }

        this[$start](options.groups, options.hidden);
    }

    [$start](groups, hidden) {
        this[$profile]();
        this[$getbg]();
        this.pms = new PMS({mgr : this});
        for(let group of groups) this.join(group);
    }

    [$profile]() {
        Request.get(URLS.profile(this.user), (err, rep, body) => {
            parseString(body, (err, reply) => {
                this.profileData = {};
                if(!reply.mod) {
                    this.profileData.age = 'N/A';
                    this.profileData.location = 'N/A';
                    this.profileData.gender = 'N/A';
                    this.profileData.mini = 'N/A';
                    return;
                }
                this.profileData = {};
                this.profileData.age = (!reply.mod.b) ? 'N/A' : new Date().getFullYear() - parseInt(reply.mod.b[0].substr(0,4));
                this.profileData.location = (!reply.mod.l) ? 'N/A' : (reply.mod.l[0]['_'] || reply.mod.l);
                this.profileData.gender = (!reply.mod.s) ? 'N/A' : reply.mod.s[0];
                this.profileData.mini = (!reply.mod.body) ? 'N/A' : decodeURIComponent(reply.mod.body);
            });
        });
    }

    [$getbg]() {
        Request.get(URLS.backgroundinfo(this.user), (err, body, reply) => {
            parseString(reply, (err, reply) => {
                let i = reply.bgi.$;

                this[$bg.tile] = i.tile;
                this[$bg.imgopacity] = i.ialp;
                this[$bg.bgopacity] = i.bgalp;
                this[$bg.align] = i.align;
                this[$bg.useimg] = i.useimg;
                this[$bg.color] = i.bgc;
            });
        });
    }



    join(group) {
        return (new Promise((resolve, reject) => {
            Request(URLS.groupinfo(group), { method : "head" },
                (err, reply, data) => { resolve(reply.statusCode); });
        })

        .then(val => {
            if(val == 404) throw "Invalid Group";
            if(Object.keys(this.groups).includes(group)) throw "Already in Group."

            // Join Room
            this.groups[group] = new Group({ mgr : this, name : group });
        }));
    }

    leave(group) {
        if(!Object.keys(this.groups).includes(group)) throw "Not in Group.";
        this.groups[group].leave()
        return true;
    }

    pm(user, message) {
        this.pms.message(user, message);
    }

    exit() {
        for(let group of Object.keys(this.groups)) this.groups[group].leave();
        this.pms.close();
    }




    get profile() { return this.profileData; }
    set profile(options) {
        options.u = this.user;
        options.p = this.pass;
        options.auth = "pwd";
        options.arch = "h5";
        options.action = "update";
        options.dir = "checked";

        Request.post(URLS.updateprofile, { formData : options }, (err, res, body) => { this[$profile](); });
    }

    get bg() { return { image : URLS.backgroundimage(this.user), color : this[$bg.color], align : this[$bg.align], imgopacity : this[$bg.imgopacity], bgopacity : this[$bg.bgopacity], tile : this[$bg.tile], useimg : this[$bg.useimg] } }
    set bg({ image : image, color: color, align : align, imgopacity : imgopacity, bgopacity : bgopacity, tile : tile, useimg : useimg}) {
        optionsReq(URLS.updatebackground, (resolve, cookies, body) => {
            if(image) Request(image, { encoding : null }, (err, resp, body)  => { resolve(body); });
            else resolve(false);
        })
        .then(data => {
            let update = data => {
                Request(URLS.updatebackground, { method : "post", formData : data }, (err, resp, body) => {
                    this[$bgmethod]();
                    for(let group of Object.keys(this.groups)) this.groups[group].echo("miu");
                });
            };

            update({
                lo : this.user,
                p : this.pass,
                tile : (tile || this[$bg.tile]),
                bgc : (color || this[$bg.color]),
                ialp : (imgopacity || this[$bg.imgopacity]),
                bgalp : (bgopacity || this[$bg.bgopacity]),
                align : (align || this[$bg.align]),
                useimg : (useimg || this[$bg.useimg]),
                isvid : '0',
                hasrec : '0'
            })

            if(data) {
                update({
                    lo : this.user,
                    p : this.pass,
                    Filedata : {
                        value : data,
                        options : {
                            filename: 'topsecret.jpg',
                            contentType: "image/jpg"
                        }
                    }
                });
            }

        });
    }

    get thumb() { return URLS.thumbnail(this.user); }
    get avatar() { return URLS.avatar(this.user); }
    set avatar(url) {
        return (new Promise((resolve, reject) => {
            Request.get({url : url, 'encoding' : null }, (err, response, data) => { resolve(data); });
        })
        .then((data) => {
            let formData = {
                u : this.user,
                p : this.pass,
                auth : "pwd",
                src : "group",
                arch : "h5",
                action : "fullpic",
                Filedata: {
                    value : data,
                    options : {
                        filename: 'topsecret.jpg',
                        contentType: "image/jpg"
                    }
                }
            };
            Request.post(URLS.updateprofile, { formData : formData });
        })
        .catch((err) => { console.log(err.stack); }));
    }
}

Mechon.Flags = require('./data/flags.json');
Mechon.Functions = require('./functions.js');
Mechon.URLS = require('./urls.js');
Mechon.Version = require('./package.json').version;
module.exports = Mechon;
