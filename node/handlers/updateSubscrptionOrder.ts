import { json } from 'co-body';
import { cloneDeep } from 'lodash';
import { subscrJobEntity, subscrOrderEntity } from './../utils/entities';

const moment = require('moment');

export async function updatesubcrp(ctx: Context, next: () => Promise<any>) {
    const body = await json(ctx.req)
    const orderDetails = validate(body);
    console.log("ORDER DETAILS",orderDetails)
    const result = await setupdateSubscription(orderDetails, ctx);

    ctx.status = 200;
    ctx.body = result;
    ctx.set("cache-control", "no-cache");
    await next();
}

function validate(body: SubscriptionOrder) {
    const orderDetails = cloneDeep(body);
        if (!orderDetails.status || !orderDetails.internalStatus) {
            orderDetails.status = 'Active';
            orderDetails.internalStatus = 'Active'
        }
    return orderDetails;
}

async function setupdateSubscription(orderDetails: SubscriptionOrder, ctx: Context) {
    const subscrOrders = await updateSubscriptionDocument(ctx,
        orderDetails, subscrOrderEntity.name, subscrOrderEntity.schema);
    return subscrOrders 
}

async function updateSubscriptionJob(subscrOrder: any, orderdetails:any,ctx: Context) {
    console.log("Roughdata",subscrOrder,orderdetails)
    const getSubscriptionJob = await ctx.clients.masterdata.searchDocuments<{
        id: string
      }>({
        dataEntity: subscrJobEntity.name,
        fields: ["_all"],
        pagination: {
            page: 1,
            pageSize: 1,
        },
        where: `subscriptionOrderId=31801a6e-ca37-11ec-835d-02e5239efff3`, //needs to be changed
        schema:subscrJobEntity.schema
    });
    console.log("getsubsjob",getSubscriptionJob)
    const orderJob = {
        subscriptionOrderId: subscrOrder.DocumentId,
        nextShipmentDate: calculateNextShipmentDate(orderdetails.frequency, orderdetails.preferredCustomerDeliveryDate, orderdetails.productType),
        processed: false,
        actualExecutedTime: '2022-05-05T03:00:57.98Z', //Needs to be changed
        preferredStartTime: moment().add(1, 'days').set({ 'hour': 3, 'minute': 0 }).toISOString(),
        frequency: orderdetails.frequency,
        preferredCustomerDeliveryDate: orderdetails.preferredCustomerDeliveryDate,
        productType: orderdetails.productType
    };
    const UpdateSubscriptionJob = await ctx.clients.masterdata.updateEntireDocument({
        dataEntity: subscrJobEntity.name,
        id:getSubscriptionJob[0].id,
        fields: orderJob,
        schema:subscrJobEntity.schema
    });
    console.log("updatesubsjob",UpdateSubscriptionJob)
    return subscrOrder
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

async function updateSubscriptionDocument(ctx: Context, data: any, entity: string, schema: string) {
    const result = await ctx.clients.masterdata.createDocument({
                dataEntity: entity,
                fields: data,
                schema: schema
            });
            console.log("RESult ORDER",result)
    const PrevOrder = await ctx.clients.masterdata.updatePartialDocument({
                dataEntity: subscrOrderEntity.name,
                id: "d4477ed3-ca36-11ec-835d-0eb5938d9feb",
                fields: {
                    "status":'Inactive',
                    "internalStatus":'Inactive'
                }
            });
    console.log("PREV ORDER",PrevOrder)
    const finalResult = updateSubscriptionJob(result,data,ctx);
    return finalResult
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