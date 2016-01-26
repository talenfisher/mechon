
let
    Request = require('request').defaults({
        headers : {
            'origin' : 'http://st.chatango.com',
            'user-agent' : 'Mozilla/5.0',
            'referrer' : 'http://st.chatango.com/h5/gz/r1119151706/id.html'
        }
    });

let
    $fontFace = Symbol(),
    $fontSize = Symbol(),
    $nameColor = Symbol(),
    $fontColor = Symbol(),
    $sync = Symbol();

module.exports = class Format {
    constructor({ u : user, p : pass}) {
        this.user = user;
        this.pass = pass;

        let u = user.toLowerCase()
        Request("http://ust.chatango.com/profileimg/"+u[0]+"/"+u[1]+"/"+u+"/msgstyles.json", (err, response, body) => {
            let reply = JSON.parse(body);
            this[$fontFace] = reply.fontFamily;
            this[$fontSize] = reply.fontSize;
            this[$nameColor] = reply.nameColor;
            this[$fontColor] = reply.textColor;
            this.updtags();
        });
    }

    updtags() {
        let size = this[$fontSize];
        if(this[$fontSize] == 9) size = "09";
        this.ftag = "<f x"+size+this[$fontColor]+"=\""+this[$fontFace]+"\">";
        this.ntag = "<n"+this[$nameColor]+"/>";
        this.ctag = this.ntag + this.ftag;
    }

    [$sync]() {
        new Promise((resolve, reject) => {
            Request("http://chatango.com/updatemsgstyles", {
                method : "options"
            }, (err, body, reply) => {
                for(let cookie of body.headers['set-cookie']) Request.cookie(cookie);
                console.log(body.headers['set-cookie']);
                resolve();
            });
        })
        .then(() => {
            console.log(this.user);
            Request("http://chatango.com/updatemsgstyles",{
                method : "post",
                formData : {
                    lo : this.user,
                    p : this.pass,
                    hasrec : String(new Date().getTime()),
                    fontFamily : String(this[$fontFace]),
                    fontSize : String(this[$fontSize]),
                    textColor : this[$fontColor],
                    nameColor : this[$nameColor],
                    bold : 'false',
                    italics : 'false',
                    underline : 'false',
                    stylesOn : 'true',
                    useBackground : 'true'
                }
            }, function(err, reply, body) {
                console.log(body);
            });
        });
        this.updtags();
    }

    toString() {
        return this.ctag;
    }

    get fontSize() { return this[$fontSize]; }
    set fontSize(val) {
        this[$fontSize] = val;
        this[$sync]();
    }

    get fontFace() { return this[$fontFace]; }
    set fontFace(val) {
        this[$fontFace] = val;
        this[$sync]();
    }

    get nameColor() { return this[$nameColor]; }
    set nameColor(val) {
        this[$nameColor] = val;
        this[$sync]();
    }

    get fontColor() { return this[$fontColor]; }
    set fontColor(val) {
        this[$fontColor] = val;
        this[$sync]();
    }
}
