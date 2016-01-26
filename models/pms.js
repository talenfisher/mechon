/*
 * To change this license header, choose License Headers in Project Properties.
 * To change this template file, choose Tools | Templates
 * and open the template in the editor.
 */

let
    Room = require('./room.js'),
    Request = require('urllib-sync').request,
    Events = require('../events.js'),
    R = require('request');

let
    $auth = Symbol();


module.exports = class PMS extends Room {
    constructor(options) {
        super(options);

        this.name = this.user;
        this.events = Events.pms;
        this.server = "c1";
        this.auth = this[$auth]();
        this.stmt = `tlogin:${this.auth}:2:${this.uid}\x00`;
        this.friends = {};
        this.blocklist = [];

        this.start();
    }

    [$auth](user, pass) {
        var res = Request("http://chatango.com/login", {
            'method' : 'POST',
            'data' : {
                'user_id' : this.user,
                'password' : this.pass,
                'checkerrors' : 'yes',
                'storecookie' : 'on',
            },
            'headers' : {
                'User-Agent':'Mozilla/5.0 (Windows NT 6.3; WOW64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/42.0.2311.90 Safari/537.36'
            }
        });

        let cookies = res.headers['set-cookie'].join(";");
        cookies = cookies.split(";");

        let c = {};
        for(let cookie of cookies) {
            let p = cookie.split("=");
            if(p.length == 2) {
                c[p[0]] = p[1]
            }
        }
        return c['auth.chatango.com'];
    }

    close() {
        this.con.connected = false;
        clearInterval(this.heartbeat);
        this.con.removeAllListeners();
        this.con.close();
        this.mgr.pms = null
    }

    message(user, message) {
        let f = this.mgr.format;
        let m = "<n"+f.nameColor+"/>";
        m += "<m v=\"1\">";
        m += "<g x"+f.fontSize+"s"+f.fontColor+"=\""+f.fontFace+"\">"
        m += message+"</g></m>";
        this.echo("msg", user, m);
    }

    friend(user) {
        if(Object.keys(this.friends).includes(user)) throw "Already have friend.";
        this.echo("wladd", user);
    }

    unfriend(user) {
        if(!Object.keys(this.friends).includes(user)) throw "Dont have friend";
        this.echo("wldelete", user);
    }

    meet(opts = {}) {
        let data = { lo : this.user, p : this.pass, ami : '13', ama : '99', t : '20', f : '0'}
        if(opts.country) data.c = opts.country;
        if(opts.online) data.o = 'y';
        if(opts.sex) data.s = { 'male' : 'M', 'female' : 'F', 'both' : "B"}[opts.sex];
        if(opts.minage) data.ami = opts.minage;
        if(opts.maxage) data.ama = opts.maxage;
        if(opts.photos) data.p = 'y';
        if(opts.query) data.ss = opts.query;

        let p = new Promise((resolve, reject) => {
            let j = R.jar();
            j.setCookie(R.cookie("auth.chatango.com="+this.auth),"http://.chatango.com");
            j.setCookie(R.cookie("id.chatango.com="+this.user), "http://.chatango.com");
            j.setCookie(R.cookie("cookies_enabled.chatango.com=yes"), "http://.chatango.com");
            j.setCookie(R.cookie('fph.chatango.com=http'), "http://.chatango.com");
            R.post("http://chatango.com/flashdir", {
                formData : data,
                headers : {
                    "User-Agent" : "Mozilla/5.0",
                    "Origin" : "http://st.chatango.com",
                    "Referrer" : "http://st.chatango.com/flash/sellers_external.swf",
                    "X-Requested-With": "ShockwaveFlash/20.0.0.267"
                },
                jar : j
            }, (err, body, reply) => {
                console.log(reply);
                reply = reply.replace("h=", "").split(":");
                let r = {};
                for(let u of reply) {
                    u = u.split(";");
                    r[u[0]] = {"1" : "online", "0" : "offline"}[u[1]];
                }
                resolve(r);
            });
        });
        return p;

    }
}
