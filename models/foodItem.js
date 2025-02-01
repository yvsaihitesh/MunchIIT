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
    type:  {
        type: String,
        required: true
    },
});

module.exports = mongoose.model('Item', foodItemSchema);
