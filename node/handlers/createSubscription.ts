import { json } from 'co-body';
import { cloneDeep } from 'lodash';
import { subscrJobEntity, subscrOrderEntity } from './../utils/entities';
// import * as moment from 'moment';

const moment = require('moment');

export async function createSubscr(ctx: Context, next: () => Promise<any>) {
    const body = await json(ctx.req)
    console.log('response create Subscr', body);
    const orderDetails = validate(body);

    const result = await setupSubscription(orderDetails, ctx);

    ctx.status = 200;
    ctx.body = result;
    ctx.set("cache-control", "no-cache");
    await next();
}

function validate(body: [SubscriptionOrder]) {
    const orderDetails = cloneDeep(body);
    orderDetails.forEach(order => {
        if (!order.status || !order.internalStatus) {
            order.status = 'Active';
            order.internalStatus = 'Active'
        }
    });
    return orderDetails;
}

async function setupSubscription(orderDetails: [SubscriptionOrder], ctx: Context) {
    const subscrOrders = await createMutipleDocument(ctx,
        orderDetails, subscrOrderEntity.name, subscrOrderEntity.schema);
    const subscrJobs = await createSubscriptionJob(subscrOrders, ctx);
    return { subscrOrders, subscrJobs };
}

async function createSubscriptionJob(subscrOrders: any, ctx: Context) {
    console.log('subscrOrders', subscrOrders);

    const orderDetails = await Promise.all(subscrOrders.map(async (order: any) => {
        return await ctx.clients.masterdata.getDocument({
            dataEntity: subscrOrderEntity.name,
            id: order.DocumentId,
            fields: ["_all"]
        });
      })
    );
    console.log('orderDetails', orderDetails);
    const orderJobs: any = orderDetails.map((order: any) => {
        const orderJob = {
            subscriptionOrderId: order.id,
            nextShipmentDate: calculateNextShipmentDate(order.frequency, order.preferredCustomerDeliveryDate, order.productType),
            processed: false,
            actualExecutedTime: '',
            preferredStartTime: moment().add(1, 'days').set({ 'hour': 3, 'minute': 0 }).toISOString(),
            frequency: order.frequency,
            preferredCustomerDeliveryDate: order.preferredCustomerDeliveryDate,
            productType: order.productType
        };
        return orderJob;
    });
    console.log('orderJobs', orderJobs);
    const subscrJobs = await createMutipleDocument(ctx,
        orderJobs, subscrJobEntity.name, subscrJobEntity.schema)
    console.log('subscrJobs', subscrJobs);
    return subscrJobs;
}

function calculateNextShipmentDate(frequency: number, preferredCustomerDeliveryDate: number, productType: string) {
    const now = moment();
    // console.log('now', now.toISOString());
    const customerPreferredDate = now.set('date', preferredCustomerDeliveryDate);
    // console.log('customerPreferredDate', customerPreferredDate.toISOString());
    const nextShipmentMonth = customerPreferredDate.add(frequency, 'months');
    // console.log('nextShipmentMonth', nextShipmentMonth.toISOString());
    let nextShipmentDate;
    if (productType === 'Imprint') {
        nextShipmentDate = nextShipmentMonth.subtract(2, 'weeks');
    } else {
        nextShipmentDate = nextShipmentMonth.subtract(5, 'days');
    }
    // console.log('nextShipmentDate', nextShipmentDate.toISOString());
    return nextShipmentDate.toISOString();
}

async function createMutipleDocument(ctx: Context, dataArr: [any], entity: string, schema: string) {
    const result = await Promise.all(
        dataArr.map(async (data) => {
            return await ctx.clients.masterdata.createDocument({
                dataEntity: entity,
                fields: data,
                schema: schema
            });
        })
    );
    return result;
}

interface SubscriptionOrder {
    itemSku: string,
    internalStatus: 'Active' | 'Inactive',
    status: 'Active' | 'Inactive',
    orderPlaced: Date,
    customerPreferredShipmentDate: number,
    frequency: number,
    shippingAddress: string,
    billingAddress: string,
    quantity: number,
    startDate: Date,
    subscriptionOwnerID: string,
    lastUpdatedUserID: string,
    customerID: string,
    productType: 'Imprint' | 'Original',
    imprintDetails: string,
    kitDetails: {
        kitName: string,
        kitItems: [{
            skuId: string,
            itemType: string,
            selected: boolean
        }]
    }
}