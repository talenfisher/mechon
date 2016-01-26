const
    Flags = require('../data/flags.json'),
    Functions = require('../functions.js');

module.exports = class Mod {
    constructor({name : name, perms : perms, group : group }) {
        this.name = name.toLowerCase();
        this.permsum = perms;
        this.perms = Functions.flags(this.permsum, Flags.mods);
        this.flags = Functions.flagsArray(this.permsum, Flags.mods);
        this.group = group;
    }

    toString() {
        return this.name;
    }

    update(perms) {
        this.permsum = perms;
        this.perms = Functions.flags(this.permsum, Flags.mods);
        this.flags = Functions.flagsArray(this.permsum, Flags.mods);
    }

    addFlags(flags) {
        let ps = this.permsum;
        if(Array.isArray(flags)) {
            for(let flag of flags) ps += Flags.mods[flag]
        } else ps += flags;
        this.group.echo("updmod", this.name, ps);
    }

    removeFlags(flags) {
        let ps = this.permsum;
        if(Array.isArray(flags)) {
            for(let flag of flags) ps -= Flags.mods[flag]
        } else ps += flags;
        this.group.echo("updmod", this.name, ps);
    }

    demod() {
        this.group.echo("removemod", this.name);
    }
}
