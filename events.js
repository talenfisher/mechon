/*
 * To change this license header, choose License Headers in Project Properties.
 * To change this template file, choose Tools | Templates
 * and open the template in the editor.
 */

const
    Flags = require('./data/flags.json'),
    Post = require('./models/post.js'),
    Functions = require('./functions.js'),
    User = require('./models/user.js'),
    Ban = require('./models/ban.js'),
    Mod = require('./models/mod.js'),

    OWNER_SUM = 387070;

Functions.unpack(global); // Unpacks all functions into the global object

module.exports = {
    group : {
        /*===================================
         * INITIALIZATION AND UPDATING INITIAL INFORMATION
         * -------------------------------------------------
         * This section of events covers initialization of
         * group data and the updating of that initial data
         * such as mods, group flags, information
         * such as title, description, etc.
         ========================================*/

        "inited" : function() {
            this.echo("v");
            this.echo("getpremium", 1);
            this.echo("g_participants", "start");
            this.echo("blocklist", "block", "", "next", "500");
            this.echo("blocklist", "unblock", "", "next", "500");
            this.echo("getbannedwords");
            this.echo("getratelimit");
            this.echo("getannouncement");
            this.echo("get_more", 20, 0);

            this.router.emit("inited.complete");
        },

        "ok" : function(owner, sessionid, success, user, time, ip, mods, flagsum) {
            // setup chatango group variables
            // some of these may have changed from when we auto generated them
            // such as the sessionid or uid
            this.owner = owner;
            this.time = time;
            this.sessid = sessionid;
            this.uid = parseInt(String(sessionid).substr(0,8), 10);
            this.ip = ip;
            this.flagsum = flagsum;
            this.flags = flags(flagsum, Flags.group);

            // Get Mods
            for(let mod of iterate(mods.split(";"), mod => { return mod.split(",") }))
                this.mods[mod[0]] = new Mod({ name : mod[0], perms : mod[1], group : this });

            this.botLevel = this.level(this.user.toLowerCase());
            if(this.botLevel > 0) this.botFlags = (this.botLevel == 2) ? this.botFlags = flags(OWNER_SUM, Flags.mods) : this.mods[this.user.toLowerCase()].perms;
            this.mgr.emit('connected', this);
        },

        "groupflagsupdate": function(flagsum) {
            this.flagsum = flagsum
            this.flags = Functions.flags(flagsum, Flags.group);
        },

        "mods" : function(...args) {
            this.mods = {};
            for(let mod of iterate(args, mod => { return mod.split(",") })) {
                this.mods[mod[0]] = new Mod({ name : mod[0], perms : mod[1], group : this });
            }

            this.botLevel = this.level(this.user.toLowerCase());
            if(this.botLevel > 0) this.botFlags = (this.botLevel == 2) ? this.botFlags = flags(OWNER_SUM, Flags.mods) : this.mods[this.user.toLowerCase()].perms;
        },

        "updgroupinfo" : function(title, description) {
            this._setProfile(title, description); // gotta do this because we dont know the title and description symbols.
        },

        /*===================================
         * MESSAGING
         ========================================*/
        "b" : function(time, user, anon, uid, unid, pnum, ip, extras, anonauth, message) {

            // Create the Post
            let
                post = new Post({
                   time : time,
                   user : (user.toLowerCase() || "#"+anon.toLowerCase()),
                   uid : uid,
                   unid : unid,
                   pnum : pnum,
                   group : this,
                   ip : ip,
                   extras : extras,
                   message : message
               }),
                msg = post.message.toLowerCase(),
                botname = this.user.toLowerCase();

            // Add Post to this array
            if(this.posts[pnum]) {
                let pid = this.posts[pnum];
                this.posts[pnum] = post
                this.posts[pnum].pid = pid;
            } else this.posts[pnum] = post;


            // No action if the bot is speaking.
            if(botname === post.user.toLowerCase()) return;
            if(["!", "#"].includes(post.user.toString()[0])) return;

            // On Ping
            setImmediate(() => { if([`@${botname}`, botname].includes(msg.toLowerCase())) return this.mgr.emit('ping', this, post.user, this.posts[pnum]); });


            // on Command
            let
                prefix = (this.mgr.customUsr) ? (post.user.prefix || this.mgr.prefix) : this.mgr.prefix, // prefix customization
                pieces = post.message.split(" ");

            if((post.message.length > 1 && post.message[0] === prefix) || (pieces.length > 1 && pieces[0].toLowerCase() === botname)) {
                let
                    firstpiece = pieces.shift(),
                    command = (firstpiece === botname) ? pieces.shift() : firstpiece.substr(1).toLowerCase(),
                    args = pieces.join(" ");

                if(command && Object.keys(this.mgr.commands).includes(command)) this.mgr.emit('command', this.mgr.commands[command], this, post.user, args, post);
                return;
            }


            if(post.pid) this.mgr.emit('message.idready', this, post.user, post);
            this.mgr.emit('message', this, post.user, post);
        },

        "i" : function(time, user, anon, uid, unid, pid, ip, extras, anonauth, message) {
            // Create the Post
            let post = new Post({
               time : time,
               user : (user.toLowerCase() || "#"+anon.toLowerCase()),
               uid : uid,
               unid : unid,
               pnum : null,
               group : this,
               ip : ip,
               extras : extras,
               message : message
            });

            post.pid = pid;
            this.posts[pid] = post;
            this.mgr.emit("message.past", this, post.user, post)
        },

        "u" : function(pnum, pid) {
            if(this.posts[pnum] && this.posts[pnum] != pid) {
                try {
                    this.posts[pnum].pid = pid;
                    this.mgr.emit("message.idready", this, this.posts[pnum].user, this.posts[pnum]);
                } catch(e) {}
            } else this.posts[pnum] = pid;
        },

        "gotmore" : function(amount) {
            this.echo("get_more", 20, parseInt(amount)+1);
        },

        "nomore" : function() {
            this.loadedposts = true;
        },

        "delete" : function(pid) {
            delete this.getLastPost(pid, 'pid')
        },

        "deleteall" : function(...pids) {
            for(let pid of pids) delete this.getLastPost(pid, 'pid');
        },

        "clearall" : function(ok) {
            if(ok === "ok") this.posts = {};
        },

        /*===================================
         * PARTICIPANT HANDLING
         ========================================*/


        "g_participants" : function(users) {
            // just there for reference
            let uvals = { ref : 0, timestamp : 1, uid : 2, name : 3, tempname : 4 };

            for(let user of users) {
                user = user.split(":");
                user[3] = String(user[3]).toLowerCase();

                if(user[3] != 'none' && user[4] == 'None') {
                    if(!Object.keys(this.users).includes(user[3])) {
                        this.users[user[3]] = new User(user[3], user[0], user[1], user[2]);
                    }
                    this.uids[user[2]] = user[3];
                }
            }
        },

        "participant" : function(mode, ref, uid, user, time) {
            user = user.toLowerCase();

            switch(mode) {
                // User Leaves
                case "0":
                    if(user !== 'none' && Object.keys(this.users).includes(user)) {
                        delete this.users[user];
                    }

                    delete this.uids[uid];
                    this.mgr.emit('user.leave', this, user);
                    break;

                // User Joins
                case "1":
                    if(user !== 'none' && !Object.keys(this.users).includes(user)) {
                        this.users[user] = new User(user, ref, time, uid);
                        this.uids[uid] = user;
                    }
                    this.mgr.emit('user.join', this, user);
                    break;


                // User Relogs
                case "2":
                    console.log(user+":"+uid);
                    // Switched to an Anon
                    if(user == 'none' && Object.keys(this.uids).includes(uid)) {
                        delete this.users[this.uids[uid]];
                        delete this.uids[uid];
                    // Switched to diff acct
                    } else if(user != 'none') {
                        this.users[user] = new User(user, ref, time, uid);
                        this.uids[uid] = user;
                    }
                    break;
            }
        },

        "n" : function(count) {
            this.usercount = count;
        },


        /*===================================
         * BANS
         ========================================*/
        "blocklist" : function(...bans) {
            let time;

            if(arguments[0]) {
                bans = (bans.join(":")).split(";");
                time = new Date().getTime();

                for(let ban of bans) {
                    let bdata = ban.split(":");

                    this.bans[bdata[2].toLowerCase()] = new Ban({
                        unid : bdata[0],
                        ip : bdata[1],
                        user : bdata[2].toLowerCase(),
                        time : bdata[3],
                        mod : bdata[4]
                    });
                    time = bdata[3];
                }

                this.echo("blocklist", "block", time, "next", "500");
            }
        },

        "unblocklist" : function(...unbans) {
            let bans, time;

            if(arguments[0]) {
                bans = (unbans.join(":")).split(";");
                time = new Date().getTime();

                for(let ban of bans) {
                    let bdata = ban.split(":");

                    this.unbans[bdata[2].toLowerCase()] = new Ban({
                        unid : bdata[0],
                        ip : bdata[1],
                        user : bdata[2].toLowerCase(),
                        time : bdata[3],
                        mod : bdata[4]
                    });
                    time = bdata[3];
                }

                this.echo("blocklist", "unblock", time, "next", "500");
            }
        },

        "blocked" : function(unid, ip, user, mod, time) {
            this.bans[user] = new Ban({
                unid : unid,
                ip : ip,
                user: user,
                mod : mod,
                time : time
            });

            this.mgr.emit("banned", this, this.bans[user]);
        },

        "unblocked" : function(unid, ip, user, mod, time) {
            this.unbans[user] = new Ban({
               unid : unid,
               ip : ip,
               user : user,
               mod : mod,
               time : time
            });

            this.mgr.emit("unbanned", this, this.unbans[user]);
            delete this.bans[user];
        },

        /*===================================
         * Rate Limit
         ========================================*/
        "bw" : function(part, whole) {
            this.bannedwords = {
                parts : part.split("%2C"),
                wholes : whole.split("%2C")
            }

            for(let word of this.bannedwords.parts) {
                if(word == "") this.bannedwords.parts.splice(this.bannedwords.parts.indexOf(""),1);
            }

            for(let word of this.bannedwords.wholes) {
                if(word == "") this.bannedwords.wholes.splice(this.bannedwords.wholes.indexOf(""),1);
            }
        },

        "ubw" : function() {
            this.echo("getbannedwords");
        },

        /*===================================
         * Rate Limit
         ========================================*/
        "getratelimit" : function(limit, unknown) {
            this.ratelimit = limit;
        },

        "ratelimitset" : function(limit) {
            this.ratelimit = limit;
        },

        "ratelimited" : function(limit) {
            this.ratelimit = limit;
        },

        /*===================================
         * UTILITIES / MISC
         ========================================*/
        "climited" : function(time, ...commands) {

            setTimeout(function() {
                if(this.con.connected) this.con.send(commands.join(':')+'\r\n');
            }.bind(this),  new Date().getTime() - Number(time));
        },

        "premium" : function() {
            this.echo("msgbg", 1);
            this.mgr.emit("background", this);
        },


        "getannc" : function(...args) {

        }
    },

    "pms" : {
        "OK" : function() {
            this.echo("wl");
            this.echo("getpremium", 1);
            this.echo("settings");
            this.echo("getblock");
            this.mgr.emit('connect.pms');
        },

        "settings" : function(...settings) {
            let count = 1;

            for(let setting of settings) {

            }
        },


        "wl" : function() {
            for(let i of Functions.range(0, Object.keys(arguments).length, 4)) {
                this.friends[arguments[i]] = {
                    user : arguments[i],
                    time : arguments[i+1],
                    status : arguments[i+2]
                };
            }
        },

        "wladd" : function(user, status, time) {
            this.friends[user] = {
                user : user,
                time : time,
                status : status
            }
        },

        "wlonline" : function(user, time) {
            if(this.friends[user]) {
                this.friends[user].time = time;
                this.friends[user].status = "on";
            }
        },

        "wloffline" : function(user, time) {
            if(this.friends[user]) {
                this.friends[user].time = time;
                this.friends[user].status = "off";
            }
        },

        "status" : function(user, time, status) {
            this.friends[user] = {
                user: user,
                time : time,
                status : status
            }
        },

        "idleupdate" : function(user, time) {
            if(this.friends[user]) {
                this.friends[user].time = time;
            }
        },

        "msgoff" : function(user, dank, time, field, test, message) {
            this.mgr.emit('pmoff', user, Functions.cleaner(message));
        },

        "msg" : function(user, dank, time, field, test, message) {
            this.mgr.emit('pm', user, Functions.cleaner(message));
        },

        "block_list" : function(...blocks) {
            this.blocklist = blocks;
        },

        "premium" : function() {
            this.echo("msgbg", 1);
        },

    }
}
