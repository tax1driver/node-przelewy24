export interface TransactionDetails {
    statement: string;
    orderId: number;
    sessionId: string;
    status: number;
    amount: number;
    currency: "PLN";
    date: string;
    dateOfTransaction: string;
    clientEmail: string;
    accountMD5: string;
    paymentMethod: number;
    description: string;
    clientName: string;
    clientAddress: string;
    clientCity: string;
    clientPostcode: string;
    batchId: number;
    fee: string;
}