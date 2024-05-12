/* eslint-disable no-undef */
// date.js

function getDate() {
    const currentDate = new Date();
    const year = currentDate.getFullYear();
    const month = ('0' + (currentDate.getMonth() + 1)).slice(-2);
    const day = ('0' + currentDate.getDate()).slice(-2);
    const hour = ('0' + currentDate.getHours()).slice(-2);
    const minute = ('0' + currentDate.getMinutes()).slice(-2);
    const second = ('0' + currentDate.getSeconds()).slice(-2);
    const millisecond = ('00' + currentDate.getMilliseconds()).slice(-3);
    const formattedDate = `${year}-${month}-${day}T${hour}:${minute}:${second}.${millisecond}Z`;
    return formattedDate;
}

function getDateInOneHour() {
    const currentDate = new Date();
    currentDate.setMinutes(currentDate.getMinutes() + 60); // Add 60 minutes

    const year = currentDate.getFullYear();
    const month = ('0' + (currentDate.getMonth() + 1)).slice(-2);
    const day = ('0' + currentDate.getDate()).slice(-2);
    const hour = ('0' + currentDate.getHours()).slice(-2);
    const minute = ('0' + currentDate.getMinutes()).slice(-2);
    const second = ('0' + currentDate.getSeconds()).slice(-2);
    const millisecond = ('00' + currentDate.getMilliseconds()).slice(-3);
    const formattedDate = `${year}-${month}-${day}T${hour}:${minute}:${second}.${millisecond}Z`;
    return formattedDate;
}


module.exports = { getDate, getDateInOneHour };
