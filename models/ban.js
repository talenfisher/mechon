/* 
 * To change this license header, choose License Headers in Project Properties.
 * To change this template file, choose Tools | Templates
 * and open the template in the editor.
 */


module.exports = class Ban {
    constructor(options) {
        this.user = options.user;
        this.mod = options.mod;
        this.ip = options.ip;
        this.unid = options.unid;
        this.time = options.time;
    }
}