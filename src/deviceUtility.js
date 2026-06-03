import Base from "./baseClass.js";
import dotenv from 'dotenv';
import deviceOperations from "./deviceOperations.js";
import fs from "fs";

dotenv.config();


const POWER_OFF_ENDPOINT = process.env.CASHMATIC_POWER_OFF_ENDPOINT;
const REBOOT_ENDPOINT = process.env.CASHMATIC_REBOOT_ENDPOINT;
const REPORT_ENDPOINT = process.env.CASMATIC_REPORT_ENDPOINT;


class CashmaticUtility extends Base {
    constructor(agent, DEFAULT_REASON, DEFAULT_REFERENCE, PORT, PROTOCOL, SERVER_IP, HOST) {
        super(agent, DEFAULT_REASON, DEFAULT_REFERENCE, PORT, PROTOCOL, SERVER_IP, HOST)
    }

    _initialDay = (data = new Date().toISOString().split("T")[0]) => {
        return String(`${data} 00:00:00`)
    }

    /**
     * JUST POWER OFF CAHMATIC
     * @param {string} token - required token released after login 
     * @returns {Promise<{code:number,message:string}>}
     */
    async powerOff(token) {
        return await this._simpleReq(token, POWER_OFF_ENDPOINT)
    }


    /**
     * JUST REBOOT OFF CAHMATIC
     * @param {string} token - required token released after login 
     * @returns {Promise<{code:number,message:string}>}
     */
    async reboot(token) {
        return await this._simpleReq(token, REBOOT_ENDPOINT)
    }

    /**
     * GET CASHMATIC REPORT (CAN SPECIFY WHAT DO YOU WANT IN THE REPORT DEFAULT=ALL)
     * @param {object} opts - option object 
     * @param {number} [opts.userId=0] - user id, automatic indexed
     * @param {string}  [opts.startTime=TODAY_DATETIME] - starting date (yyyy-MM-dd hh:mm:ss) es 2023-11-01 21:30:00
     * @param {string} endtime - date by which we want the results (yyyy-MM-dd hh:mm:ss) es 2023-11-01 21:30:00
     * @param {string} opts.token - required token released after login
     * @returns {Promise<Array<{id:number,requested:number,inserted:number,dispensed:number,notDispensed:number,currency:string,operation:string,success:boolean,endType:string,moduleType:string,startTime:string,endTime:string,source:string,reason:string,reference:string,userId:number,username:string,firstName:string,lastName:string,powerFail:boolean}>>}
     */
    async report({
        userId = 0,
        startTime = this._initialDay(),
        token,
        endTime,
        refill = true,
        withdrawal = true,
        payment = true,
        empty = true,
        empty_coins = true,
        empty_notes = true,
        float = true,
        float_coins = true,
        float_notes = true,
        cashbox = true,
        cashbox_coins = true,
        cashbox_notes = true,
        withdrawal_denominations = true,
        change_denominations = true,
        correct_level = true,
        deposit = true
    }) {


        return await this._objectedReq(
            token,
            {
                userId,
                startTime,
                endTime,
                operations: {
                    refill,
                    withdrawal, payment,
                    empty,
                    empty_coins,
                    empty_notes,
                    float,
                    float_coins,
                    float_notes,
                    cashbox,
                    cashbox_coins,
                    cashbox_notes,
                    withdrawal_denominations,
                    change_denominations,
                    correct_level,
                    deposit
                }
            },
            REPORT_ENDPOINT
        )
    }
}




// const credenziali = {
//     username: process.env.CASHMATIC_USERNAME,
//     password: process.env.CASHMATIC_PASSWORD
// }

// const t = new Utility();
// const user = await deviceOperations.login(credenziali)
// const token = await user.data.token;


export default new CashmaticUtility();