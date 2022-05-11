import * as cron from 'node-cron'
const moment = require('moment');

export default function intializeSchedular() {
    primaryJob();
}

function primaryJob() {
    let counter = 0;
    cron.schedule('*/1 * * * *', () => {
        console.log('running a task every one minute ------- Subscription', moment().toString(), counter++);
    });
}