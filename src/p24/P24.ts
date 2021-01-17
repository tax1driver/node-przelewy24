/**
 * MIT License
 *
 * Copyright (c) 2019 Kasun Vithanage
 *
 * Permission is hereby granted, free of charge, to any person obtaining a copy
 * of this software and associated documentation files (the "Software"), to deal
 * in the Software without restriction, including without limitation the rights
 * to use, copy, modify, merge, publish, distribute, sublicense, and/or sell
 * copies of the Software, and to permit persons to whom the Software is
 * furnished to do so, subject to the following conditions:
 *
 * The above copyright notice and this permission notice shall be included in all
 * copies or substantial portions of the Software.
 *
 * THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
 * IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,
 * FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE
 * AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER
 * LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM,
 * OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN THE
 * SOFTWARE.
 *
 */

import Axios, { AxiosInstance } from 'axios';
import { P24Error } from '../errors/P24Error';
import { P24Options } from './P24Options';
import { validIps } from './ips';
import { SuccessResponse } from '../responses/SuccessResponse';
import { ErrorResponse } from '../responses/ErrorResponse';
import { Order } from '../orders/Order';
import { BaseParameters } from './BaseParameters';
import { calculateSHA384 } from '../utils/hash';
import { OrderCreatedData } from '../orders/OrderCreatedData';
import { Transaction } from '../orders/Transaction';
import {
    EndpointTestAccess,
    EndpointTransactionRegister,
    EndpointTransactionRequest,
    EndpointTransactionVerify
} from './endpoints';
import { Verification } from '../verify/Verification';
import { VerificationData } from '../verify/VerificationData';


const ProductionUrl = 'https://secure.przelewy24.pl';
const SandboxUrl = 'https://sandbox.przelewy24.pl';


/**
 * Represents a P24 payment system
 *
 * @export
 * @class P24
 */
export class P24 {
    private merchantId: number;
    private posId: number;
    private crcKey: string;
    private apiKey: string;
    private client: AxiosInstance;
    private baseUrl: string;
    private options: P24Options;
    private baseParameters: BaseParameters;

    /**
    * Creates an instance of Przelewy24.
    * @param {number} merchantId Merchant ID given by Przelewy24
    * @param {number} posId Shop ID (defaults to merchantId)
    * @param {string} apiKey API Key from P24 panel(Klucz do raportów)
    * @param {string} crcKey CRC key from P24 panel
    * @param {P24Options} [options={ sandbox: false }] - additional options
    * @memberof P24
    */
    constructor(
        merchantId: number,
        posId: number,
        apiKey: string,
        crcKey: string,
        options: P24Options = { sandbox: false }
    ) {
        this.merchantId = merchantId;
        this.posId = posId;
        this.crcKey = crcKey;
        this.apiKey = apiKey;
        this.options = options
        if (!this.posId)
            this.posId = this.merchantId;

        this.baseUrl = !this.options.sandbox ? ProductionUrl : SandboxUrl;

        this.baseParameters = {
            merchantId: this.merchantId,
            posId: this.posId
        };

        this.client = Axios.create({
            baseURL: `${this.baseUrl}/api/v1`,
            auth: {
                username: posId.toString(),
                password: this.apiKey
            }
        });
    }

    /**
     * Test access to the service
     *
     * @returns {Promise<SuccessResponse<boolean>>}
     * @throws {P24Error}
     * @memberof P24
     */
    public async testAccess (): Promise<SuccessResponse<boolean>> {
        try {
            const { data } = await this.client.get(EndpointTestAccess)
            return <SuccessResponse<boolean>>data
        } catch (error) {
            if (error.response && error.response.data) {
                const resp = <ErrorResponse>error.response.data
                throw new P24Error(resp.error, resp.code)
            }
            throw new P24Error(`Unknown Error ${error}`, -1)
        }
    }

    /**
     * Creates a transaction
     *
     * @param {Order} order - order to be created
     * @returns {Promise<Transaction>}
     * @throws {P24Error}
     * @memberof P24
     */
    public async createTransaction (order: Order): Promise<Transaction> {
        try {
            const hashData = {
                sessionId: order.sessionId,
                merchantId: this.merchantId,
                amount: order.amount,
                currency: order.currency,
                crc: this.crcKey
            }

            const sign = calculateSHA384(JSON.stringify(hashData))

            const orderData = {
                ...this.baseParameters,
                ...order,
                sign,
            }

            const { data } = await this.client.post(EndpointTransactionRegister, orderData)
            const response = <SuccessResponse<OrderCreatedData>>data
            const transaction: Transaction = {
                token: response.data.token,
                link: `${this.baseUrl}${EndpointTransactionRequest}/${response.data.token}`
            }

            return transaction
        } catch (error) {
            if (error.response && error.response.data) {
                const resp = <ErrorResponse>error.response.data
                throw new P24Error(resp.error, resp.code)
            }
            throw new P24Error(`Unknown Error ${error}`, -1)
        }
    }


    /**
     * Verify transaction
     *
     * @param {Verification} verification - verification request
     * @returns {Promise<boolean>}
     * @throws {P24Error}
     * @memberof P24
     */
    public async verifyTransaction (verification: Verification): Promise<boolean> {
        try {
            const hashData = {
                sessionId: verification.sessionId,
                orderId: verification.orderId,
                amount: verification.amount,
                currency: verification.currency,
                crc: this.crcKey
            }

            const sign = calculateSHA384(JSON.stringify(hashData))

            const verificationData = {
                ...this.baseParameters,
                ...verification,
                sign
            }

            const { data } = await this.client.put(EndpointTransactionVerify, verificationData)
            const result = <SuccessResponse<VerificationData>>data
            const { status } = result.data

            return status === 'success'
        } catch (error) {
            if (error.response && error.response.data) {
                const resp = <ErrorResponse>error.response.data
                throw new P24Error(resp.error, resp.code)
            }
            throw new P24Error(`Unknown Error ${error}`, -1)
        }
    }

    /**
     * Validates IP with P24 backends
     *
     * @static
     * @param {string} ip - IP Address
     * @returns {boolean} - true on validated ip 
     * @memberof Przelewy24
     */
    public static isIpValid (ip: string): boolean {
        return validIps.includes(ip)
    }
}
