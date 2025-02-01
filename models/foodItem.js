// const mongoose = require('mongoose');
// const Schema = mongoose.Schema;

// const foodItemSchema = new Schema({
//     ItemName: {
//         type: String,
//         required: true
//     },
//     image: {
//         type: String,
//         required: true
//     },
//     Price: {
//         type: Number,
//         required: true
//     },
//     ingredients: {
//         type: [String],
//         required: true
//     },
//     Category: {
//         type: String,
//         required: true
//     },
//     reviews: [
//         {
//             type: Schema.Types.ObjectId,
//             ref: 'Review'
//         }
//     ]
// });

// module.exports = mongoose.model('Item', foodItemSchema);


const mongoose = require('mongoose');
const Schema = mongoose.Schema;

const foodItemSchema = new Schema({
    ItemName: {
        type: String,
        required: true
    },
    image: {
        type: String,
        required: true
    },
    Price: {
        type: Number,
        required: true
    },
    ingredients: {
        type: [String],
        required: true
    },
    Category: {
        type: String,
        required: true
    },
    reviews: [
        {
            type: Schema.Types.ObjectId,
            ref: 'Review'
        }
    ],
    status: {
        type: String,
        enum: ['In Stock', 'Out of Stock'],
        default: 'In Stock' 
    },
    type: {
        type : String,
        default : 'Veg'
    }
});

module.exports = mongoose.model('Item', foodItemSchema);