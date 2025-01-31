// const mongoose = require('mongoose')
// const passportLocalMongoose = require('passport-local-mongoose')
// const Schema = mongoose.Schema
// const { ref } = require('joi')

// const UserSchema = new Schema({
//     email : {
//         type : String ,
//         required : true ,
//         unique : true 
//     },
//     cart: {
//         type: Schema.Types.ObjectId,
//         ref: 'Cart'
//     }
// })

// UserSchema.plugin(passportLocalMongoose)

// module.exports = mongoose.model('User',UserSchema)

const mongoose = require('mongoose');
const passportLocalMongoose = require('passport-local-mongoose');
const Schema = mongoose.Schema;

const UserSchema = new Schema({
    username: {
        type: String,
        required: true,
        unique: true
    },
    email: {
        type: String,
        required: true,
        unique: true
    }
});

UserSchema.plugin(passportLocalMongoose);

module.exports = mongoose.model('User', UserSchema); 