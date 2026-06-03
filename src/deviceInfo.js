import Base from './baseClass.js';
import dotenv from 'dotenv';
dotenv.config();


const ALL_LEVELS_ENDPOINT = process.env.CASHMATIC_ALL_LEVELS_ENDPOINT;
const ACTIVE_TRANSACTION_ENDPOINT = process.env.CASHMATIC_ACTIVE_TRANSACTION_ENDPOINT;
const LAST_TRANSACTION_ENDPOINT = process.env.CASHMATIC_LAST_TRANSACTION_ENDPOINT;
const DEVICE_INFO_ENDPOINT = process.env.CASHMATIC_DEVICE_INFO_ENDPOINT;
const DETAILS_ENDPOINT = process.env.CASHMATIC_DETAILS_ENDPOINT;

class CashmaticDeviceInfo extends Base {
    constructor(agent, DEFAULT_REASON, DEFAULT_REFERENCE, PORT, PROTOCOL, SERVER_IP, HOST) {
        super(agent, DEFAULT_REASON, DEFAULT_REFERENCE, PORT, PROTOCOL, SERVER_IP, HOST)
    }

    /**
    * GET ALL LEVELS DATA
    * @param {string} token - required field, token released after login
    * @returns {Promise<{code:number, message:string,data:[{value:number,currency:string,level:number,floatLevel:number,maxLevel:number,type:string,routing:string}]}>}
    */
    async allLevels(token) {
        return await this._simpleReq(token, ALL_LEVELS_ENDPOINT)
    }

    /**
     * GET CURRENT ACTIVE TRANSACTION
     * @param {string} token - required token, released after login
     * @returns {Promise<{code:number,message:string,data:{id:number,operation:string,operationInfo:string,requested:number,inserted:number, dispensed:number, dispensed:number, notDispensed:number,currency:string, queuePosition:number,operationPercentage:number,status:string,denominationsInserted:Array,denominationsDispensed:Array,denominationsTransfered:Array }}>}
     */
    async activeTransaction(token) {
        return await this._simpleReq(token, ACTIVE_TRANSACTION_ENDPOINT)
    }

    /**
     * GET LAST TRANSACTION
     * @param {string} token - required token, released after login
     * @returns {Promise<{code:number, message:string, data:{id:number, operation:string,operationInfo:string,requested:number,inserted:number,dispensed:number,notDispensed:number,currency:string,end:string,module:string,operationPercentage:number,denominationsInserted:Array,denominationsDispensed:Array,denominationsTransfered:Array}}>}
     */
    async lastTransaction(token) {
        return await this._simpleReq(token, LAST_TRANSACTION_ENDPOINT)
    }
    /**
     * GET BASIC DEVICE INFO
     * @param {token} token - required token, released after login
     * @returns {Promise<{code:number,message:string,data:{deviceName:string,model:string,serialNumber:string, vpnAddress:string, statusMessage:string,errorCode:number,errorMessage:string,functionalityCode:number,functionalityMessage:string,modules:Array<{typeCode:number, typeMessage:string, statusCode:number,statusMessage:string,peripherals:Array<{nameCode:number,name:string,operationalityCode:number,operationalityMessage:string,statusCode:number,statusMessage:string,modules:Array<{code:number,nameCode:string,serialNumber:number,firmware:string,billset:string,isActive:boolean,errorCodes:Array,coveredSensors:Array}>>}}>}>}
     */
    async info(token) {
        return await this._simpleReq(token, DEVICE_INFO_ENDPOINT);
    }

    /**
     * GET THE PERCENTAGE OF ACTIVE TRANSACTION
     * @param {string} token - required token released after login 
     * @returns {number}
     */
    async activeTransactionPercentage(token) {
        if (!token) throw new Error("token is required");
        return await this.activeTransaction(token).then(res => resolve(res.data.operationPercentage)).catch(err => reject(err))
    }

    /**
    * GET THE PERCENTAGE OF ACTIVE TRANSACTION
    * @param {string} token - required token released after login 
    * @returns {string}
    */
    async activeOperation(token) {
        if (!token) throw new Error("token is required");
        return new Promise(async (resolve,reject)=>{
            await this.activeTransaction(token).then(res => resolve(res.data.operation)).catch(err => reject(err))
        });
    }

    async userData({ token, id = 0 }) {
        if (!token) throw new Error("token is required");
        return await this._objectedReq(token, { id }, DETAILS_ENDPOINT)
    }

}
// const credenziali = {
//     username: process.env.CASHMATIC_USERNAME,
//     password: process.env.CASHMATIC_PASSWORD
// }


// const user = await operazioni.login(credenziali);
// const token = user.data.token;

// const c = new CashmaticDeviceInfo();

// // c.allLevels(token).then(res=>{
// //     console.log(res);
// // }).catch(err=>{
// //     console.log(err.message);
// // })



// await c.info(token).then(res=>{
//     console.log(res.data.modules[0].peripherals[0].modules[0]);
// });

export default new CashmaticDeviceInfo();