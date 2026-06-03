import deviceOperations from "./deviceOperations.js";
import deviceInfo from "./deviceInfo.js";
import utility from "./deviceUtility.js";
import fs from 'fs';
import path from "path";

// dirname path
import { dirname } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));
/**
 * START A PAYMENT AND KEEP ALIVE THE CONNECTION UNTIL IT RESPONDS
 * @param {object} opts - config option object
 * @param {string} opts.token - required token to autenticate released after login 
 * @param {number} opts.amount -  required amount to request for the payment
 * @param {number} opts.timeout -  required parameter within which payment must take place
 * @param {boolean} [opts.queueAllowed=false] - optional parameter to allow adding items while paying
 * @returns {Promise<{code:number, message:string, data:{id:number, operation:string,operationInfo:string,requested:number,inserted:number,dispensed:number,notDispensed:number,currency:string,end:string,module:string,operationPercentage:number,denominationsInserted:Array,denominationsDispensed:Array,denominationsTransfered:Array}}>}
 */

export async function startPaymentKeepAlive({ token, amount, timeout, queueAllowed = false }) {
    if (!token) throw new Error("token is required");
    await deviceOperations.startPayments({ token, amount, timeout, queueAllowed }).then(async _ => {
        while (await deviceInfo.activeOperation(token) !== "idle") {
            // il processo di pagamento è in corso
        }
    }).catch(err => {
        throw new Error(err)
    })
    return new Promise(async (resolve, reject) => {
        deviceInfo.lastTransaction(token).then(res => {
            resolve(res);
        }).catch(err => reject(err))
    });
};

/**
 * START A WITHDRAW AND KEEP ALIVE THE CONNECTION UNTIL IT RESPONDS
 * @param {object} opts - config option object
 * @param {string} opts.token - required token to autenticate released after login 
 * @param {number} opts.amount -  required amount to withdraw
 * @param {string} [opts.reason=DEFAULT_REASON] -  not required, the reason of operation 
 * @param {string} [opts.reference=DEFAULT_REFERENCE] -  not required, the reference of operation 
 * @returns 
 */
export async function startWithdrawKeepAlive({ token, reference, reason, amount }) {
    if (!token) throw new Error("token is required");
    await deviceOperations.startWithdrawal({ token, reference, reason, amount }).then(async _ => {
        while (await deviceInfo.activeOperation(token) !== "idle") {
            // il processo di pagamento è in corso
        }
    }).catch(err => {
        throw new Error(err)
    })
    return new Promise(async (resolve, reject) => {
        deviceInfo.lastTransaction(token).then(res => {
            resolve(res);
        }).catch(err => reject(err))
    });
};


/**
 * DOWNLOAD CASHMATIC REPORT (CAN SPECIFY WHAT DO YOU WANT IN THE REPORT DEFAULT=ALL)
 * @param {object} opts - option object 
 * @param {string} [opts.startTime=TODAY_DATETIME] - starting date (yyyy-MM-dd hh:mm:ss) es 2023-11-01 21:30:00
 * @param {string} opts.endtime - date by which we want the results (yyyy-MM-dd hh:mm:ss) es 2023-11-01 21:30:00
 * @param {string} opts.token - required token released after login
 * @param {string} [opts.format=json] - output format
 * @returns  {Promise<Array<{id:number,requested:number,inserted:number,dispensed:number,notDispensed:number,currency:string,operation:string,success:boolean,endType:string,moduleType:string,startTime:string,endTime:string,source:string,reason:string,reference:string,userId:number,username:string,firstName:string,lastName:string,powerFail:boolean}>>}
*/
export async function downloadReport({
    token,
    startTime,
    endTime,
    format = "json"
}) {
    const payload = await utility.report({ token, endTime, startTime })
    const timestampName = String(new Date().toISOString() + "." + format).replace(":", "-").replace(":", "-")
    return new Promise((resolve, reject) => {
        fs.writeFile(path.join(__dirname, "reports", timestampName), JSON.stringify(payload.data), err => {
            if (err) return reject(err);
            resolve(200)
        })
    })
}




// await deviceOperations.renewToken(token)

// console.log(await downloadReport({token,endTime:"2023-11-27 23:00:00"}))

// const credenziali = {
//     username: process.env.CASHMATIC_USERNAME,
//     password: process.env.CASHMATIC_PASSWORD
// }

// console.log(await deviceOperations.login(credenziali));
