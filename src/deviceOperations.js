import Base from './baseClass.js';
import dotenv from 'dotenv';
dotenv.config();

// appunti
// il cashbox rappresenta una riserva monetaria che non
// viene contata durante l'emissione del resto

// USER
const RENEW_TOKEN_ENDPOINT = process.env.CASHMATIC_RENEW_TOKEN_ENDPOINT;
const LOGIN_TOKEN_ENDPOINT = process.env.CASHMATIC_LOGIN_ENDPOINT;

// REFILL
const START_REFILL_ENDPOINT = process.env.CASHMATIC_START_REFILL_ENDPOINT;
const STOP_REFILL_ENDPOINT = process.env.CASHMATIC_STOP_REFILL_ENDPOINT;

// PAYMENTS
const START_PAYMENTS_ENDPOINT = process.env.CASHMATIC_START_PAYMENTS_ENDPOINT;
const CANCEL_PAYMENTS_ENDPOINT = process.env.CASHMATIC_CANCEL_PAYMENTS_ENDPOINT;
const COMMIT_PAYMENTS_ENDPOINT = process.env.CASHMATIC_COMMIT_PAYMENTS_ENDPOINT;

// WITHDRAWAL
const START_WITHDRAWAL_ENDPOINT = process.env.CASHMATIC_START_WITHDRAWAL_ENDPOINT;
const EMPTY_CASHBOX_ENDPOINT = process.env.CASHMATIC_EMPTY_CASHBOX_ENDPOINT;
// FONDO CASSA ..

const credenziali = {
    "username": process.env.CASHMATIC_USERNAME,
    "password": process.env.CASHMATIC_PASSWORD
}




class CashmaticOperations extends Base {

    constructor(agent, DEFAULT_REASON, DEFAULT_REFERENCE, PORT, PROTOCOL, SERVER_IP, HOST) {
        super(agent, DEFAULT_REASON, DEFAULT_REFERENCE, PORT, PROTOCOL, SERVER_IP, HOST)
    }

    /**
     * login to get the token
     * @param {object} opts - config options
     * @param {string} opts.password - required password to autenticate
     * @param {string} opts.username - required username to autenticate
     * @returns {Promise<{code:number,message:number,data:{token:string,type:number,refreshToken:string}}>}
     */
    async login({password,username}) {
        if(!password || !username) throw new Error("password | username are required fields")
        
        const req = this.HOST + LOGIN_TOKEN_ENDPOINT;
        const httpClient = await this._unauthenticatedClient();
        return new Promise((resolve, reject) => {
            httpClient.post(req, { password, username })
                .then(res => resolve(res.data))
                .catch(err => reject(err));
        });
    }

    /** 
     * renew token before before expires (every 15 minutes)
     * @param {string} token - required field, token released after login
     * @returns {Promise<{code:number,message:string,data:{token:string}}>}
    */
    async renewToken(token) {
        if(!token) throw new Error("token is rquired")
        return await this._simpleReq(token, RENEW_TOKEN_ENDPOINT);
    }

    /**
     * start refill operation
     * @param {object} opts - config options
     * @param {string} [opts.reason=DEFAULT_REASON] -  not required, the reason of operation 
     * @param {string} [opts.reference=DEFAULT_REFERENCE] -  not required, the reference of operation 
     * @param {string} opts.token - required field, token released after login
     * @returns {Promise<{code:number, message:string}>}
     */
    async startRefill({reason=this.DEFAULT_REASON,reference=this.DEFAULT_REFERENCE,token}) {
        if(!token) throw new Error("token is required")
        return await this._objectedReq(token, { reason, reference }, START_REFILL_ENDPOINT)
    }


    /** 
     * stop current refill
     * @param {string} token - required field, token released after login
     * @returns {Promise<{code:number,message:string}>}
    */
    async stopRefill(token) {
        if(!token) throw new Error("token is a required field");
        return await this._simpleReq(token, STOP_REFILL_ENDPOINT)
    }

    /**
     * start a payments transaction with timer
     * @param {object} opts - object with options
     * @param {number} opts.amount - required the amount of transaction in cents
     * @param {boolean} [opts.queueAllowed=false] - required allow to add new product to payments queue 
     * @param {number} opts.timeout - required time in seconds within which to complete the transaction before it is automatically cancelled
     * @param {string} opts.token - required field, token released after login
     * @returns {Promise<{code:number,message:string}>}
    */
    async startPayments({ token, amount, queueAllowed=false, timeout }) {
        if(!token || !amount || typeof queueAllowed!== "boolean" || !timeout) throw new Error("token | amount | queueAllowed | timeout are required fields")
        return await this._objectedReq(token, { amount, queueAllowed, timeout }, START_PAYMENTS_ENDPOINT)
    }

    /** 
     * stop payments giving back money insert by customer
     * @param {string} token - required field, token released after login
     * @returns {Promise<{code:number,message:string}>}
    */
    async cancelPayments(token) {
        if(!token) throw new Error("token is a required field");
        return await this._simpleReq(token, CANCEL_PAYMENTS_ENDPOINT)
    }

     /** 
      * accept the transaction even if the amount is not enough 
      * @param {string} token - required field, token released after login
      * @returns {Promise<{code:number,message:string}>}
    */
    async commitPayments(token) {
        if(!token) throw new Error("token is a required field");
        return await this._simpleReq(token, COMMIT_PAYMENTS_ENDPOINT)
    }

    /**
     * withdraw a certain amount
     * @param {object} opts - config options object
     * @param {string} [opts.reason=DEFAULT_REASON] -  not required, the reason of operation 
     * @param {string} [opts.reference=DEFAULT_REFERENCE] -  not required, the reference of operation 
     * @param {string} opts.token - required field, token released after login
     * @param {string} opts.amount - required field, amout to withdraw
     * @returns {Promise<{code:number,message:string}>}
     */
    async startWithdrawal({token,amount,reason=this.DEFAULT_REASON,reference=this.DEFAULT_REFERENCE}) {
        if(!token) throw new Error("token is a required field");
        return await this._objectedReq(token, { amount, reason, reference }, START_WITHDRAWAL_ENDPOINT)
    }

    async emptyCashbox({token, reason=this.DEFAULT_REASON,reference=this.DEFAULT_REFERENCE}){
        if(!token) throw new Error("token is a required field");
        return await this._objectedReq(token, { reason, reference }, EMPTY_CASHBOX_ENDPOINT)
    }
}




// console.log(await client.login(credenziali));

// const token = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJleHAiOjE3MDA3MzYxOTkuMTEwOTc4LCJpYXQiOjE3MDA3MzUyOTkuMTEwOTc1LCJuYmYiOjE3MDA3MzUyOTkuMTEwOTc1LCJyZW1vdGVBY2NvdW50IjpmYWxzZSwic3ViIjoiQ2FzaG1hdGljIEpXVCB0b2tlbiIsInR0eXBlIjowLCJ1aWQiOjF9.15N8ql8qexAtIH5yb-95F0YRZkMflGM7Ygvx3zd_ORo";
// // console.log(await client.login(credenziali));

// console.log(await client.renewToken(token)); // refresh token



// // console.log(await client.startRefill({token}));


// const startRefillOptions = {
//     token: token,
//     reason: "prova ricarica",
//     reference: "11/23"
// }

// const startPaymentsOptions = {
//     amount: 300,
//     queueAllowed: false,
//     timeout: 20,
//     token: token
// }

// // await client.startPayments(startPaymentsOptions);

// // console.log(await client.cancelPayments(token));

// const startWithdrawalOptions = {
//     reason: "prova prelievo",
//     reference: "11/23",
//     amount: 10,
//     token: token
// }


export default new CashmaticOperations();