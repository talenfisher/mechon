/*
 * To change this license header, choose License Headers in Project Properties.
 * To change this template file, choose Tools | Templates
 * and open the template in the editor.
 */

let
    Room = require('./room.js'),
    EventEmitter = require('events').EventEmitter,
    Events = require('../events.js'),
    Weights = require('../data/weights.json'),
    Flags = require('../data/flags.json'),
    Request = require('request').defaults({ headers : { 'user-agent' : 'Mozilla/5.0' } }),
    Modes = require('../data/modes.json'),
    Functions = require('../functions.js'),
    parseString = require('xml2js').parseString;

let
    $server = Symbol(),
    $badge = Symbol(),
    $compile = Symbol(),
    $extras = Symbol(),
    $channels = Symbol(),
    $title = Symbol(),
    $description = Symbol(),
    $profile = Symbol(),
    $flags = Symbol(),
    $requireLevel = Symbol(),
    $requireFlag = Symbol(),
    $updatebw = Symbol();

let Group = module.exports = class extends Room {
    constructor(options) {
        super(options);

        // chatango variables
        this.owner = '';
        this.time = 0;
        this.mods = {};
        this.posts = {};
        this.loadedposts = false;
        this.silent = false;
        this.uids = {};
        this.bans = {};
        this.users = {};
        this.usercount = 0;
        this.anoncount = 0;
        this.ip = null;
        this.ratelimit = 0;
        this.bannedwords = [];
        this.unbans = {};
        this.hidden = false;

        // bot variables
        this.botLevel = 0;
        this.botFlags = false;

        // setup symbols
        this[$extras] = 0;
        this[$badge] = 'none';
        this[$channels] = [];


        // connection variables
        this.events = Events.group;
        this.server = this[$server]();
        this.stmt = `bauth:${this.name}:${this.sessid}:${this.user}:${this.pass}\x00`;

        this.start(() => {
            this[$profile]();
        });
    }

    [$server]() {
        let customs = Weights.weights;
        let defaults = Weights.defaults;

        if(Object.keys(defaults).indexOf(this.name) !== -1) return defaults[this.name];

        let name = this.name.replace(/[-|_]/g, 'q');
        let weight = 0;
        let cw = 0;

        for(let w of customs) weight += w[1];
        let n1 = (name.length < 7) ? 1000 : Math.max(parseInt(name.substr(6,3), 36), 1000);
        let n2 = (parseInt(name.substr(0, 5), 36) % n1) / n1;

        for(let w of customs) {
            cw += w[1] / weight;
            if(cw >= n2) return "s"+w[0];
        }
    }

    [$compile]() {
        this[$extras] = 0;
        this[$extras] += Flags.posts.badges[this[$badge]];
        for(let channel of this[$channels]) this[$extras] += Flags.posts.channels[channel];
    }


    [$profile](title, description) {
        if(title || description) {
            if(title) this[$title] = title;
            if(description) this[$description] = description;
            return;
        }

        Request("http://ust.chatango.com/groupinfo/"+Functions.urlName(this.name)+"/gprofile.xml", function(err, reply, body) {
            parseString(body, function(err, reply) {
                this[$title] = decodeURIComponent(reply.gp.title);
                this[$description] = decodeURIComponent(reply.gp.desc);
            }.bind(this));
        }.bind(this));
    }

    [$requireFlag](flag) {
        if(this.level == 0 || !this.botFlags[flag]) throw "Insufficient permissions";
    }

    [$requireLevel](level) {
        if(this.level < level) throw "Insufficient permissions";
    }

    [$flags](flagson, flagsoff) {
        let
            on = 0,
            off = 0;

        if(!Array.isArray(flagson)) flagson = [flagson];
        if(!Array.isArray(flagsoff)) flagsoff = [flagsoff];

        for(let flag of flagson) on += Flags.group[flag];
        for(let flag of flagsoff) off += Flags.group[flag];
        this.echo("updategroupflags", on, off);
    }

    [$updatebw]() {
        this.echo("setbannedwords", this.bannedwords.parts.join("%2C"), this.bannedwords.wholes.join("%2C"));
    }

    leave() {
        this.con.connected = false;
        clearInterval(this.heartbeat);
        this.con.removeAllListeners();
        this.con.close();
        delete this.mgr.groups[this.name]
        delete this;
    }

    message(message) {
        message = String(message);

        if(message.indexOf(this.pass) !== -1) {
            var match = new RegExp(this.pass);
    	    message = message.replace(match, "[removed]");
        }

        if(message.indexOf('{{ftag}}') != -1) message = message.replace(/\{\{ftag\}\}/g, this.mgr.format.ftag);

        // only message if not on silent mode.
        if(!this.silent && this.con.connected) this.echo("bm", this.chatid, this[$extras], this.mgr.format+message);
    }

    clear(user) {
        this[$requireLevel](1);
        if(!user) {
            if(this._flagCheck("editgroup")) {
                this.echo("clearall")
                return true;
            }

            let users = [];
            for(let post of Object.keys(this.posts)) {
                post = this.posts[post];
                if(!users.includes(post.user)) {
                    users.push(post.user);
                    if(["#","!"].includes(post.user.toString()[0])) this.echo("delallmsg", post.unid, post.ip, "");
                    else this.echo("delallmsg", post.unid, post.ip, post.user);
                }
            }
        }

        let post = this.getLastPost(user);
        if(!post || !post.pid) post = this.getLastPost(user, 'user', 2);
        if(!post || !post.pid) return false;
        if(["#","!"].includes(String(post.user)[0])) {
            this.echo("delallmsg", post.unid, post.ip, "");
            return true;
        }

        this.echo("delallmsg", post.unid, post.ip, post.user);
        return true
    }

    level(name) {
        name = name.toLowerCase();
        if(this.owner == name) return 2;
        if(Object.keys(this.mods).includes(name)) return 1;
        return 0;
    }

    getLastPost(value, delimeter, depth = 1) {
        delimeter = typeof delimeter !== 'undefined' ?  delimeter : 'user';
        var posts = Object.keys(this.posts).sort(function(a, b) { return (this.posts[a].time > this.posts[b].time) ? -1 : 1; }.bind(this));
        let count = 1;
        for(var key of posts) {
            if(String(this.posts[key][delimeter]) == value && count == depth) return this.posts[key];
            else if(String(this.posts[key][delimeter]) == value) count++;
        }
        return false;
    }

    flag(user) {
        let pid = this.getLastPost(user).pid;
        if(pid) {
            this.echo("g_flag", pid);
            return true;
        } else return false;
    }

    rateLimit(limit) {
        this[$requireFlag]("editrestrictions");
        this.echo("setratelimit", limit);
    }

    mode(mode, slow) {
        if(!Object.keys(Modes).includes(mode)) throw "Invalid mode.";
        if(!slow) slow = 30;

        this[$requireFlag]('editgroup');
        if(mode === "slow") this.echo("setratelimit", slow);
        else if(mode === "flood") this.echo("setratelimit", 0);
        else this[$flags](Modes[mode][0], Modes[mode][1]);

        return true;
    }


    /***
     * BANNING
     *************/
    ban(user) {
        let post = this.getLastPost(user);
        if(post) {
            if(["!","#"].includes(user[0])) this.echo("block", post.unid, post.ip, "");
            else this.echo("block", post.unid, post.ip, user);
            return true;
        }
        return false;
    }

    unban(user) {
        let ban = this.bans[user];
        if(ban) {
            this.echo("removeblock", ban.unid, ban.ip, user);
            return true;
        }
        return false;
    }

    /***
     * MODDING
     *************/
    mod(mod, perms) {
        this[$requireFlag]('editmods');
        let extra = "";
        if(perms) {
            let n = 0;
            for(let flag of perms) n += Flags.mods[flag];
            extra = ":"+n;
        }

        this.echo("addmod", mod+extra);
    }

    unmod(mod) {
        this[$requireFlag]('editmods');
        this.echo("removemod", mod);
    }

    updmod(mod, fon, foff) {
        this[$requireFlag]('editmods');
        let perm = Number(this.mods[mod].permsum);

        if(fon) for(let flag of fon) if(!this.mods[mod].perms[flag]) perm += Flags.mods[flag];
        if(foff) for(let flag of foff) if(this.mods[mod].perms[flag]) perm -= Flags.mods[flag];
        this.echo("updmod", mod, perm);
    }

    /***
     * BANNED WORDS
     *************/
    banword(part, whole) {
        this[$requireFlag]('editbw');
        if(part) this.bannedwords.parts.push(part);
        if(whole) this.bannedwords.wholes.push(whole);
        this[$updatebw]();
    }

    unbanword(part, whole) {
        this[$requireFlag]('editbw');
        if(part) this.bannedwords.parts.splice(this.bannedwords.parts.indexOf(part)-1, 1);
        if(whole) this.bannedwords.wholes.splice(this.bannedwords.wholes.indexOf(whole)-1, 1);
        this[$updatebw]();
    }

    unbanallwords() {
        this[$requireFlag]('editbw');
        this.bannedwords.parts = [];
        this.bannedwords.wholes = [];
        this[$updatebw]();
    }

    // Utility / Helper Methods
    _setProfile(title, description) { this[$profile](decodeURIComponent(title), decodeURIComponent(description)); }
    _flagCheck(flag) { if(this.botLevel == 0){ return false; } return this.botFlags[flag]; }

    // =======================
    // Group Badge Property
    // =======================
    get badge() { return this[$badge]; }
    set badge(badge) {
        this[$requireLevel](1);
        if(!Object.keys(Flags.posts.badges).includes(badge)) throw "Bad badge value.";
        this[$badge] = badge;
        this.echo("setmodicon", Flags.posts.badges[badge]);
        this[$compile]();
    }

    // =======================
    // Group Channels Property
    // =======================
    get channels() { return this[$channels]; }
    set channels(channels) {
        if(!Array.isArray(channels)) throw "Bad channels.  Please provide an array.";
        for(let channel of channels) {
            if(!Object.keys(Flags.posts.channels).includes(channel)) throw "Invalid channel: "+channel+" specified."
        }

        this[$channels] = channels;
        this[$compile]();
    }

    // =======================
    // Title Property
    // =======================
    get title() { return this[$title]; },
    set title(title) {
        this[$requireFlag]("editgroup");
        new Request("http://chatango.com/updategroupprofile", {
           method : "POST",
           form : {
               erase : 0,
               l: 1,
               lo : this.user,
               p : this.pass,
               n : title,
               u : this.name,
               d : decodeURIComponent(this[$description]),
           }
        });
        this[$title] = title;
    }

    // =======================
    // Description Property
    // =======================
    get description() { return this[$description]; },
    set description(description) {
        this[$requireFlag]("editgroup");
        new Request("http://chatango.com/updategroupprofile", {
           method : "POST",
           form : {
               erase : 0,
               l: 1,
               lo : this.user,
               p : this.pass,
               n : decodeURIComponent(this[$title]),
               u : this.name,
               d : description,
           }
        });
        this[$description] = description;
    }
}
