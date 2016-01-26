/*
 * To change this license header, choose License Headers in Project Properties.
 * To change this template file, choose Tools | Templates
 * and open the template in the editor.
 */


let
    Request = require('request').defaults({ headers : { 'user-agent' : 'Mozilla/5.0' } }),
    WebSocket = require('ws'),
    EventEmitter = require('events').EventEmitter,
    Functions = require('../functions.js');


let
    $bind = Symbol(),
    $connect = Symbol();

module.exports = class Room extends EventEmitter {
    constructor(options) {
        super();
        this.mgr = options.mgr;
        this.router = new EventEmitter;

        // information about the connection
        this.name = options.name;
        this.user = this.mgr.user;
        this.pass = this.mgr.pass;
        this.sessid = this.mgr.sessid;
        this.chatid = this.mgr.chatid;
        this.uid = parseInt(String(this.sessid).substr(0,8), 10);
    }

    start(callback) {
        this[$bind]();
        this[$connect](callback);
    }


    [$bind]() {
        for(let event of Object.keys(this.events)) this.router.on(event, this.events[event].bind(this));
    }

    [$connect](callback) {
        let open, uri, close, message;

        this.con = new WebSocket(`ws://${this.server}.chatango.com:8080`, { origin: 'http://st.chatango.com' })
        open = () => {
            this.con.connected = true;
            this.con.send(this.stmt);
        }.bind(this);

        close = () => {
            this.con.connected = false;
            this.con.removeAllListeners();
            clearInterval(this.heartbeat);
            console.log(`Disconnected from ${this.name}, trying again in 5 seconds`);

            setTimeout(() => {
                if(this.server !== 'c1') this.mgr.groups[this.name.toLowerCase()][$connect](() => {});
                else this.mgr.pms[$connect](() => {});
            }.bind(this), 5000);
        }.bind(this);

        message = function(data, flags) {
            let entries, values, caller;
            entries = data.split("\r\n");

            for(let entry of entries) {
                values = entry.split(":")
                caller = values[0];

                if(caller == "ok") callback();
                if(caller == "b") values[10] = values.slice(10).join(":");
                if(caller == 'g_participants') { values[1] = (values.slice(1).join(":")).split(";"); }
                this.router.emit.apply(this.router, values);
            }
        }.bind(this);

        this.con.on('open', open);
        this.con.on('message', message);
        this.con.on('error', close);
        this.con.on('close', close);

        this.heartbeat = setInterval(() => {
              if(this.con.connected) {
                  this.con.send("\r\n");
              }
       }.bind(this), 20000);
    }

    echo(...args) {
        if(this.con.connected) this.con.send(args.join(":")+"\r\n");
    }
}
