const
    Functions = require('../functions.js'),
    Flags = require('../data/flags.json'),

    // REGEXES
    FTAG_REGEX = /<f x([0-9a-fA-F]+)?=\"([0-9a-zA-Z]+)?\">/gi,
    NTAG_REGEX = /<n([a-fA-F0-9]+)?\/>/g;

module.exports = class Post {
    constructor(options) {
        this.time = options.time;
        this.user = options.user;
        this.group = options.group;
        this.uid = options.uid;
        this.unid = options.unid;
        this.pnum = options.pnum;
        this.ip = options.ip;
        this.flagsum = options.extras;
        this.message = String(options.message);
        this.raw = this.message;
        this.message = Functions.stripTags(this.message);


        this.unpack();
        setImmediate(() => { this.format(); });
        this.anon();
        this.customUser();
    }

    toString() {
        return this.message;
    }

    unpack() {
        let nflags = {};
        for(let f of Object.keys(Flags.posts)) {
            if(typeof Flags.posts[f] === "string") nflags[f] = Flags.posts[f];
        }
        this.flags = Functions.flags(this.flagsum, nflags);
        this.channels = Functions.flagsArray(this.flagsum, Flags.posts.channels);
        this.badge = Functions.flagsChoice(this.flagsum, Flags.posts.badges);
    }

    format() {
        // faster then testing for a match with match, and then matching again
        // thought i'd just create a shortcut for better reading.
        function bettermatch(needle, haystack, fallback) {
            let match = haystack.match(needle);
            if(match === null) return fallback;
            return match[0];
        }

        this.ftag = bettermatch(FTAG_REGEX, this.raw, '<f x="0">');
        this.ntag = bettermatch(NTAG_REGEX, this.raw, "<n/>");
        this.nameColor = bettermatch(/([a-fA-F0-9]+)/g, this.ntag,'000');
        this.fontFace = bettermatch(/=\"([0-9a-zA-Z]+)\"/g, this.ftag, '0').replace(/\"|=/g, '');


        let fsc = bettermatch(/x([a-fA-F0-9]+)/g, this.ftag, '000').replace('x', '');
        let l = fsc.length;

        if([3,6].includes(l)) {
            this.fontSize = 8;
            this.fontColor = fsc;
        }
        if([4,7].includes(l)) {
            this.fontSize = fsc[0];
            this.fontColor = fsc.substr(1);
        }
        if([5,8].includes(l)) {
            this.fontSize = fsc.substr(0, 2);
            this.fontColor = fsc.substr(2);
        }
    }

    anon() {
        if(this.user !== "#") return;
        if(!this.raw.includes("<n")) return (this.user = "!anon");

        let number = this.raw.match(/<n(.*)?\/>/)[0].replace(/<n|\/>/g, '').split(".")[0],
            uid = this.uid.toString().slice(-4),
            anon = '';

        number = (Number.isInteger(Number(number))) ? number.slice(-4) : '3452';
        for(let i in number) anon += (parseInt(number[i], 10) + parseInt(uid[i], 10)) % 10;

        this.user = "!anon"+anon;
        this.anon = true;
    }

    delete() {
        if(!this.pid) return false;
        this.group.echo("delmsg", this.pid);
        return true;
    }

    customUser() {
        if(this.group.mgr.customUsr) this.user = this.group.mgr.retrieve(this.user);
    }
}
