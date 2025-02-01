// const mongoose = require('mongoose');
// const Schema = mongoose.Schema;

// const orderSchema = new Schema({
//     user: {
//         type: Schema.Types.ObjectId,
//         ref: 'User',
//         required: true
//     },
//     items: [{
//         item: {
//             type: Schema.Types.ObjectId,
//             ref: 'Item'
//         },
//         quantity: {
//             type: Number,
//             required: true
//         }
//     }],
//     totalAmount: {
//         type: Number,
//         required: true
//     },
//     createdAt: {
//         type: Date,
//         default: Date.now
//     }
// });

// module.exports = mongoose.model('Order', orderSchema);


const mongoose = require('mongoose');
const Schema = mongoose.Schema;

const orderSchema = new Schema({
    user: {
        type: Schema.Types.ObjectId,
        ref: 'User',
        required: true
    },
    items: [{
        item: {
            type: Schema.Types.ObjectId,
            ref: 'Item'
        },
        quantity: {
            type: Number,
            required: true
        }
    }],
    totalAmount: {
        type: Number,
        required: true
    },
    createdAt: {
        type: Date,
        default: Date.now
    },
    status: {
        type: String,
        enum: ['Pending', 'Received', 'Completed', 'Delivered'],
        default: 'Pending'
    },
    confirmationMessage: {
        type: String,
        default: ''
    }
});

module.exports = mongoose.model('Order', orderSchema);