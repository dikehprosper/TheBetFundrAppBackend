/* eslint-disable no-undef */
const MTN = [
    "97",
    "96",
    "91",
    "90",
    "57",
    "56",
    "54",
    "53",
    "52",
    "51",
    "50",
    "46",
    "42",
];
const MOOV = ["99", "98", "95", "94", "68", "65", "64", "55"];

const VerifyMobileNumber = ({ numberPrefix }) => {
    const network = [];
    MTN.map((data) => {
        if (data === numberPrefix) {
            network.push("MTN");
        }
    });
    MOOV.map((data) => {
        if (data === numberPrefix) {
            network.push("MOOV");
        }
    });
    console.log(network);
    return network;
};
module.exports = VerifyMobileNumber