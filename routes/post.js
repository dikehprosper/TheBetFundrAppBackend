/* eslint-disable no-undef */
/* eslint-disable @typescript-eslint/no-var-requires */
// /* eslint-disable @typescript-eslint/no-var-requires */
// /* eslint-disable no-undef */
const express = require('express');

// const Post = require('../models/post');

const router = express.Router();

let isRequestProcessing = false;
function checkRequestProcessing(req, res, next) {
    if (isRequestProcessing) {
        res.status(429).send({ message: "Too many requests. Please try again later." });
    } else {
        isRequestProcessing = true;
        next();
    }
}

// /api/houses
router.get('/', checkRequestProcessing, (req, res) => {

    const posts = [
        {
            id: 1,
            name: "WhaleGuru",
            time: "2024-04-10T12:00:00Z",
            image: "https://encrypted-tbn0.gstatic.com/images?q=tbn:ANd9GcSXOtjibvD_PZPLzAtymBkRmL2H6VZQZsuUNIasn5M3sQ&s",
            profileImage:
                "https://images.unsplash.com/photo-1519289417163-b07e4859b01a?w=500&auto=format&fit=crop&q=60&ixlib=rb-4.0.3&ixid=M3wxMjA3fDB8MHxzZWFyY2h8MTJ8fGJldHRpbmd8ZW58MHx8MHx8fDA%3D",
            text: "We offer competitive odds on a variety of sports and events. Welcome Bonus for new users.Deposit match bonuses.Free bets. Aliquam lorem ante dapibus in viverra quis feugiat a tellus.",
            likeCount: 8999,
            commentCount: 2999,
            likes: [
                {
                    id: "1",
                    name: "john",
                    image: "https://encrypted-tbn0.gstatic.com/images?q=tbn:ANd9GcSXOtjibvD_PZPLzAtymBkRmL2H6VZQZsuUNIasn5M3sQ&s",
                },
                {
                    id: "2",
                    name: "john",
                    image: "https://encrypted-tbn0.gstatic.com/images?q=tbn:ANd9GcSXOtjibvD_PZPLzAtymBkRmL2H6VZQZsuUNIasn5M3sQ&s",
                },
                {
                    id: "3",
                    name: "john",
                    image: "https://encrypted-tbn0.gstatic.com/images?q=tbn:ANd9GcSXOtjibvD_PZPLzAtymBkRmL2H6VZQZsuUNIasn5M3sQ&s",
                },
            ],
            comments: [
                {
                    id: "1",
                    name: "john",
                    description: "done",
                    image: "https://encrypted-tbn0.gstatic.com/images?q=tbn:ANd9GcSXOtjibvD_PZPLzAtymBkRmL2H6VZQZsuUNIasn5M3sQ&s",
                },
                {
                    id: "2",
                    name: "john",
                    description: "done",
                    image: "https://encrypted-tbn0.gstatic.com/images?q=tbn:ANd9GcSXOtjibvD_PZPLzAtymBkRmL2H6VZQZsuUNIasn5M3sQ&s",
                },
                {
                    id: "3",
                    name: "john",
                    description: "done",
                    image: "https://encrypted-tbn0.gstatic.com/images?q=tbn:ANd9GcSXOtjibvD_PZPLzAtymBkRmL2H6VZQZsuUNIasn5M3sQ&s",
                },
            ],
            views: [
                {
                    id: "1",
                    name: "john",
                    image: "https://encrypted-tbn0.gstatic.com/images?q=tbn:ANd9GcSXOtjibvD_PZPLzAtymBkRmL2H6VZQZsuUNIasn5M3sQ&s",
                },
                {
                    id: "2",
                    name: "john",
                    image: "https://encrypted-tbn0.gstatic.com/images?q=tbn:ANd9GcSXOtjibvD_PZPLzAtymBkRmL2H6VZQZsuUNIasn5M3sQ&s",
                },
                {
                    id: "3",
                    name: "john",
                    image: "https://encrypted-tbn0.gstatic.com/images?q=tbn:ANd9GcSXOtjibvD_PZPLzAtymBkRmL2H6VZQZsuUNIasn5M3sQ&s",
                },
            ],
        },
        {
            id: 2,
            name: "WhaleGuru",
            time: "2024-04-11T12:00:00Z",
            image: "https://encrypted-tbn0.gstatic.com/images?q=tbn:ANd9GcSXOtjibvD_PZPLzAtymBkRmL2H6VZQZsuUNIasn5M3sQ&s",
            text: "We offer competitive odds on a variety of sports and events. Welcome Bonus for new users.Deposit match bonuses.Free bets. Aliquam lorem ante dapibus in viverra quis feugiat a tellus.",
            likeCount: 4000,
            commentCount: 80000,
            likes: [
                {
                    id: "1",
                    name: "john",
                    image: "https://encrypted-tbn0.gstatic.com/images?q=tbn:ANd9GcSXOtjibvD_PZPLzAtymBkRmL2H6VZQZsuUNIasn5M3sQ&s",
                },
                {
                    id: "2",
                    name: "john",
                    image: "https://encrypted-tbn0.gstatic.com/images?q=tbn:ANd9GcSXOtjibvD_PZPLzAtymBkRmL2H6VZQZsuUNIasn5M3sQ&s",
                },
                {
                    id: "3",
                    name: "john",
                    image: "https://encrypted-tbn0.gstatic.com/images?q=tbn:ANd9GcSXOtjibvD_PZPLzAtymBkRmL2H6VZQZsuUNIasn5M3sQ&s",
                },
            ],
            comments: [
                {
                    id: "1",
                    name: "john",
                    description: "done",
                    image: "https://encrypted-tbn0.gstatic.com/images?q=tbn:ANd9GcSXOtjibvD_PZPLzAtymBkRmL2H6VZQZsuUNIasn5M3sQ&s",
                },
                {
                    id: "2",
                    name: "john",
                    description: "done",
                    image: "https://encrypted-tbn0.gstatic.com/images?q=tbn:ANd9GcSXOtjibvD_PZPLzAtymBkRmL2H6VZQZsuUNIasn5M3sQ&s",
                },
                {
                    id: "3",
                    name: "john",
                    description: "done",
                    image: "https://encrypted-tbn0.gstatic.com/images?q=tbn:ANd9GcSXOtjibvD_PZPLzAtymBkRmL2H6VZQZsuUNIasn5M3sQ&s",
                },
            ],
            views: [
                {
                    id: "1",
                    name: "john",
                    image: "https://encrypted-tbn0.gstatic.com/images?q=tbn:ANd9GcSXOtjibvD_PZPLzAtymBkRmL2H6VZQZsuUNIasn5M3sQ&s",
                },
                {
                    id: "2",
                    name: "john",
                    image: "https://encrypted-tbn0.gstatic.com/images?q=tbn:ANd9GcSXOtjibvD_PZPLzAtymBkRmL2H6VZQZsuUNIasn5M3sQ&s",
                },
                {
                    id: "3",
                    name: "john",
                    image: "https://encrypted-tbn0.gstatic.com/images?q=tbn:ANd9GcSXOtjibvD_PZPLzAtymBkRmL2H6VZQZsuUNIasn5M3sQ&s",
                },
            ],

        },
        {
            id: 3,
            name: "WhaleGuru3",
            time: "2024-04-11T12:00:00Z",
            image: "https://encrypted-tbn0.gstatic.com/images?q=tbn:ANd9GcSXOtjibvD_PZPLzAtymBkRmL2H6VZQZsuUNIasn5M3sQ&s",
            text: "We offer competitive odds on a variety of sports and events. Welcome Bonus for new users.Deposit match bonuses.Free bets. Aliquam lorem ante dapibus in viverra quis feugiat a tellus.",
            likeCount: 5000,
            commentCount: 2999,
            likes: [
                {
                    id: "1",
                    name: "john",

                    image: "https://encrypted-tbn0.gstatic.com/images?q=tbn:ANd9GcSXOtjibvD_PZPLzAtymBkRmL2H6VZQZsuUNIasn5M3sQ&s",
                },
                {
                    id: "2",
                    name: "john",
                    image: "https://encrypted-tbn0.gstatic.com/images?q=tbn:ANd9GcSXOtjibvD_PZPLzAtymBkRmL2H6VZQZsuUNIasn5M3sQ&s",
                },
                {
                    id: "3",
                    name: "john",
                    image: "https://encrypted-tbn0.gstatic.com/images?q=tbn:ANd9GcSXOtjibvD_PZPLzAtymBkRmL2H6VZQZsuUNIasn5M3sQ&s",
                },
            ],
            comments: [
                {
                    id: "1",
                    name: "john",
                    description: "done",
                    image: "https://encrypted-tbn0.gstatic.com/images?q=tbn:ANd9GcSXOtjibvD_PZPLzAtymBkRmL2H6VZQZsuUNIasn5M3sQ&s",
                },
                {
                    id: "2",
                    name: "john",
                    description: "done",
                    image: "https://encrypted-tbn0.gstatic.com/images?q=tbn:ANd9GcSXOtjibvD_PZPLzAtymBkRmL2H6VZQZsuUNIasn5M3sQ&s",
                },
                {
                    id: "3",
                    name: "john",
                    description: "done",
                    image: "https://encrypted-tbn0.gstatic.com/images?q=tbn:ANd9GcSXOtjibvD_PZPLzAtymBkRmL2H6VZQZsuUNIasn5M3sQ&s",
                },
            ],
            views: [
                {
                    id: "1",
                    name: "john",
                    image: "https://encrypted-tbn0.gstatic.com/images?q=tbn:ANd9GcSXOtjibvD_PZPLzAtymBkRmL2H6VZQZsuUNIasn5M3sQ&s",
                },
                {
                    id: "2",
                    name: "john",
                    image: "https://encrypted-tbn0.gstatic.com/images?q=tbn:ANd9GcSXOtjibvD_PZPLzAtymBkRmL2H6VZQZsuUNIasn5M3sQ&s",
                },
                {
                    id: "3",
                    name: "john",
                    image: "https://encrypted-tbn0.gstatic.com/images?q=tbn:ANd9GcSXOtjibvD_PZPLzAtymBkRmL2H6VZQZsuUNIasn5M3sQ&s",
                },
            ],

        },
        {
            id: 4,
            name: "WhaleGuru",
            time: "2024-04-11T12:00:00Z",
            image: "https://encrypted-tbn0.gstatic.com/images?q=tbn:ANd9GcSXOtjibvD_PZPLzAtymBkRmL2H6VZQZsuUNIasn5M3sQ&s",
            profileImage:
                "https://images.unsplash.com/photo-1519289417163-b07e4859b01a?w=500&auto=format&fit=crop&q=60&ixlib=rb-4.0.3&ixid=M3wxMjA3fDB8MHxzZWFyY2h8MTJ8fGJldHRpbmd8ZW58MHx8MHx8fDA%3D",
            text: "We offer competitive odds on a variety of sports and events. Welcome Bonus for new users.Deposit match bonuses.Free bets. Aliquam lorem ante dapibus in viverra quis feugiat a tellus.",
            likeCount: 8999,
            commentCount: 2999,
            likes: [
                {
                    id: "1",
                    name: "john",
                    image: "https://encrypted-tbn0.gstatic.com/images?q=tbn:ANd9GcSXOtjibvD_PZPLzAtymBkRmL2H6VZQZsuUNIasn5M3sQ&s",
                },
                {
                    id: "2",
                    name: "john",
                    image: "https://encrypted-tbn0.gstatic.com/images?q=tbn:ANd9GcSXOtjibvD_PZPLzAtymBkRmL2H6VZQZsuUNIasn5M3sQ&s",
                },
                {
                    id: "3",
                    name: "john",
                    image: "https://encrypted-tbn0.gstatic.com/images?q=tbn:ANd9GcSXOtjibvD_PZPLzAtymBkRmL2H6VZQZsuUNIasn5M3sQ&s",
                },
            ],
            comments: [
                {
                    id: "1",
                    name: "john",
                    description: "done",
                    image: "https://encrypted-tbn0.gstatic.com/images?q=tbn:ANd9GcSXOtjibvD_PZPLzAtymBkRmL2H6VZQZsuUNIasn5M3sQ&s",
                },
                {
                    id: "2",
                    name: "john",
                    description: "done",
                    image: "https://encrypted-tbn0.gstatic.com/images?q=tbn:ANd9GcSXOtjibvD_PZPLzAtymBkRmL2H6VZQZsuUNIasn5M3sQ&s",
                },
                {
                    id: "3",
                    name: "john",
                    description: "done",
                    image: "https://encrypted-tbn0.gstatic.com/images?q=tbn:ANd9GcSXOtjibvD_PZPLzAtymBkRmL2H6VZQZsuUNIasn5M3sQ&s",
                },
            ],
            views: [
                {
                    id: "1",
                    name: "john",
                    image: "https://encrypted-tbn0.gstatic.com/images?q=tbn:ANd9GcSXOtjibvD_PZPLzAtymBkRmL2H6VZQZsuUNIasn5M3sQ&s",
                },
                {
                    id: "2",
                    name: "john",
                    image: "https://encrypted-tbn0.gstatic.com/images?q=tbn:ANd9GcSXOtjibvD_PZPLzAtymBkRmL2H6VZQZsuUNIasn5M3sQ&s",
                },
                {
                    id: "3",
                    name: "john",
                    image: "https://encrypted-tbn0.gstatic.com/images?q=tbn:ANd9GcSXOtjibvD_PZPLzAtymBkRmL2H6VZQZsuUNIasn5M3sQ&s",
                },
            ],

        },
    ];

    try{
        isRequestProcessing = false; // Set flag to false when response is returned
        res.send({
            message: 'successful',
            post: posts
        });
    } catch (error) {
        isRequestProcessing = false;
        res.status(500).json({ error: 'Internal server error' });
    }
})

// // /api/houses
// router.get('/', (req, res) => {
//     Post.find()
//         .then(houses => {
//             res.send(houses)
//         })
//         .catch(err => console.log(err))
// });

// // /api/houses/id
// router.get('/:id', (req, res) => {
//     const houseId = req.params.id;

//     Post.findById(houseId)
//         .then(house => {
//             res.send(house);
//         })
//         .catch(err => console.log(err))
// });

// // /api/houses/id
// router.put('/:id', validate, (req, res) => {
//     const houseId = req.params.id;

//     const errors = validationResult(req);

//     if (!errors.isEmpty()) {
//         return res.status(422).send({ errors: errors.array() })
//     }

//     Post.findById(houseId)
//         .then(house => {
//             house.title = req.body.title;
//             house.address = req.body.address;
//             house.homeType = req.body.homeType;
//             house.description = req.body.description;
//             house.price = req.body.price;
//             house.image = req.body.image;
//             house.yearBuilt = req.body.yearBuilt;

//             return house.save();
//         })
//         .then(result => {
//             res.send(result);
//         })
//         .catch(err => console.log(err))
// });

// // /api/houses/id
// router.delete('/:id', (req, res) => {
//     const houseId = req.params.id;

//     Post.findByIdAndRemove(houseId)
//         .then(result => {
//             res.send(result);
//         })
//         .catch(err => console.log(err))
// })

module.exports = router;